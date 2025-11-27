import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
  computed,
  DestroyRef,
  effect,
  type OnInit,
  type AfterViewInit
} from '@angular/core';
import type { FormControl, FormGroup } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { Project } from '../../../../core/models/project.model';
import type { Customer } from '../../../../core/models/customer.model';
import type { Quote, QuotePayload, Materials, QuoteCategory } from '../../../../core/models/quote.model';
import { QuoteService } from '../../../../core/services/quote/quote.service';
import { HttpErrorService } from '../../../../core/services/error/http-error.service';
import { NotificationService } from '../../../../core/services/notification/notification.service';
import { AdditionalWorkCalculationService } from '../../../../core/services/calculation/additional-work-calculation.service';
import { AdditionalWorkInputsService, type AdditionalWorkInput } from '../../../../core/services/additional-work-inputs/additional-work-inputs.service';
import { DynamicFormFieldComponent } from '../kitchen-quote-form/dynamic-form-field/dynamic-form-field.component';
import { MaterialsTabComponent } from '../kitchen-quote-form/tabs/materials-tab/materials-tab.component';
import type { AdditionalWorkQuoteFormValue, AdditionalWorkQuoteFormGroup } from './additional-work-quote-form.types';

@Component({
  selector: 'app-additional-work-quote-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicFormFieldComponent,
    MaterialsTabComponent
  ],
  templateUrl: './additional-work-quote-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdditionalWorkQuoteFormComponent implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly quoteService = inject(QuoteService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly calculationService = inject(AdditionalWorkCalculationService);
  private readonly inputsService = inject(AdditionalWorkInputsService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) project!: Project;
  @Input({ required: true }) customer!: Customer;
  @Input({ required: true }) companyId!: string;
  @Input({ required: true }) isSubmitting = false;
  @Input() quoteId: string | null = null;
  @Input() category: QuoteCategory = 'additional-work'; // Categoría del quote (additional-work, bathroom, basement)
  @Output() readonly submitQuote = new EventEmitter<AdditionalWorkQuoteFormValue>();
  @Output() readonly cancelQuote = new EventEmitter<void>();

  protected readonly activeTab = signal<string>('additional-work-details');
  protected readonly showCostCounter = signal<boolean>(false);
  
  // Referencia al componente de materiales
  @ViewChild(MaterialsTabComponent, { static: false }) protected materialsTabComponent: MaterialsTabComponent | null = null;
  
  // Quote original para obtener versionNumber
  private originalQuote: Quote | null = null;

  // Signal para forzar recálculo cuando cambie el formulario
  private readonly formChangeTrigger = signal<number>(0);

  // Inputs agrupados por categoría y ordenados
  protected readonly inputsByCategory = computed(() => {
    return this.inputsService.getOrderedGroupedInputs();
  });

  // Cálculo del costo total en tiempo real
  protected readonly totalCost = computed(() => {
    // Usar formChangeTrigger para forzar reactividad
    this.formChangeTrigger();
    return this.calculationService.calculateEstimateTotal(this.form);
  });

  protected readonly statusOptions = ['draft', 'sent', 'approved', 'rejected', 'in_progress', 'completed'];
  protected readonly sourceOptions = ['website', 'referral', 'social_media', 'advertisement', 'other'];

  protected readonly form: AdditionalWorkQuoteFormGroup = this.fb.group({
    customer: this.fb.group({
      name: ['', [Validators.required]],
      email: [null as string | null],
      phone: [null as string | null]
    }) as FormGroup<{
      name: FormControl<string>;
      email: FormControl<string | null>;
      phone: FormControl<string | null>;
    }>,
    projectName: ['', [Validators.required]],
    status: ['draft', [Validators.required]],
    category: this.fb.control<QuoteCategory>('additional-work'), // Se actualizará en ngOnInit
    source: [null as string | null],
    address: [null as string | null],
    notes: [null as string | null],
    materials: [null as Materials | null]
  }) as unknown as AdditionalWorkQuoteFormGroup;

  constructor() {
    // Efecto para generar campos dinámicos cuando se carguen los inputs
    effect(() => {
      const inputs = this.inputsService.inputs();
      if (inputs.length > 0) {
        this.generateDynamicFormFields(inputs);
      }
    });
  }

  ngOnInit(): void {
    // Establecer la categoría en el formulario
    this.form.controls.category.setValue(this.category);
    
    this.form.patchValue({
      customer: {
        name: `${this.customer.name} ${this.customer.lastName}`,
        email: this.customer.email ?? null,
        phone: this.customer.phone ?? null
      },
      projectName: this.project.name,
      address: this.customer.address ?? null,
      category: this.category
    });

    // Si hay un quoteId, cargar los datos del quote para crear una nueva versión
    if (this.quoteId) {
      this.loadQuoteForEdit(this.quoteId);
    }

    // Suscribirse a los cambios del formulario para recalcular el costo en tiempo real
    this.form.valueChanges
      .pipe(
        debounceTime(100),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.formChangeTrigger.update(val => val + 1);
      });

    // También escuchar cambios en statusChanges
    this.form.statusChanges
      .pipe(
        debounceTime(100),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.formChangeTrigger.update(val => val + 1);
      });

    // Forzar un cálculo inicial
    this.formChangeTrigger.update(val => val + 1);
  }

  ngAfterViewInit(): void {
    // Configurar callback para sincronizar materiales con el formulario
    setTimeout(() => {
      this.setupMaterialsSync();
    }, 0);
  }
  
  /**
   * Configura la sincronización de materiales con el formulario
   */
  private setupMaterialsSync(): void {
    if (this.materialsTabComponent) {
      // Establecer callback para actualizar el formulario cuando cambien los materiales
      this.materialsTabComponent.setUpdateCallback((value) => {
        this.form.controls.materials.setValue(value, { emitEvent: false });
      });
      
      // Si hay materiales cargados, establecerlos en el componente
      if (this.form.controls.materials.value) {
        this.materialsTabComponent.setMaterialsValue(this.form.controls.materials.value);
      }
    } else {
      // Si el componente aún no está disponible, intentar de nuevo después de un delay
      setTimeout(() => {
        this.setupMaterialsSync();
      }, 100);
    }
  }

  /**
   * Genera los campos del formulario dinámicamente desde inputs_additional_work.json
   */
  private generateDynamicFormFields(inputs: AdditionalWorkInput[]): void {
    for (const input of inputs) {
      // Crear el control principal
      let defaultValue: unknown = null;

      if (input.element === 'numberInput') {
        defaultValue = null;
      } else if (input.element === 'radioButton' || input.element === 'select' || input.element === 'selectCustomInputText') {
        defaultValue = null;
      }

      // Si el control ya existe, no lo recreamos
      if (this.form.get(input.name)) {
        continue;
      }

      this.form.addControl(input.name, this.fb.control(defaultValue));

      // Si necesita cantidad (UNIT * PRICE), crear campo de cantidad
      if (
        (input.element === 'radioButton' || input.element === 'selectCustomInputText') &&
        input.formula === 'UNIT * PRICE'
      ) {
        const quantityFieldName = `${input.name}Quantity`;
        if (!this.form.get(quantityFieldName)) {
          this.form.addControl(quantityFieldName, this.fb.control<number | null>(null));
        }
      }

      // Si tiene custom, crear campo custom
      if (input.custom) {
        const customFieldName = `${input.name}Custom`;
        if (!this.form.get(customFieldName)) {
          this.form.addControl(customFieldName, this.fb.control<number | null>(null));
        }
      }
    }
  }

  protected toggleCostCounter(): void {
    this.showCostCounter.update(val => !val);
  }

  private loadQuoteForEdit(quoteId: string): void {
    this.quoteService.getQuote(quoteId).subscribe({
      next: (quote) => {
        // Guardar el quote original para obtener versionNumber
        this.originalQuote = quote;

        // Actualizar la categoría si viene del quote (por si acaso)
        if (quote.category && quote.category !== this.category) {
          this.category = quote.category;
          this.form.controls.category.setValue(quote.category);
        }

        // Asegurar que los campos dinámicos estén generados ANTES de asignar valores
        const inputs = this.inputsService.inputs();
        if (inputs.length > 0) {
          this.generateDynamicFormFields(inputs);
        }

        // Crear mapa de inputs para acceso rápido
        const inputsMap = new Map(inputs.map(inp => [inp.name, inp]));

        // Cargar la información según la categoría del quote
        let categoryInformation: Record<string, unknown> | undefined;
        if (quote.category === 'additional-work' && quote.additionalWorkInformation) {
          categoryInformation = quote.additionalWorkInformation;
        } else if (quote.category === 'bathroom' && quote.bathroomInformation) {
          categoryInformation = quote.bathroomInformation;
        } else if (quote.category === 'basement' && quote.basementInformation) {
          categoryInformation = quote.basementInformation;
        }

        if (categoryInformation) {
          // Cargar cada campo dinámico
          Object.keys(categoryInformation).forEach(key => {
            // Excluir campos especiales
            if (['source', 'address'].includes(key) || key.endsWith('Custom') || key.endsWith('Quantity')) {
              return;
            }

            const control = this.form.get(key);
            if (!control) {
              return;
            }

            const input = inputsMap.get(key);
            const value = categoryInformation![key];

            // Convertir valores según el tipo de campo
            if (input) {
              if (input.element === 'checkbox') {
                control.setValue(Boolean(value), { emitEvent: false });
              } else if (input.element === 'radioButton' || input.element === 'selectCustomInputText') {
                if (typeof value === 'boolean') {
                  control.setValue(value ? 'Yes' : 'No', { emitEvent: false });
                } else if (typeof value === 'number') {
                  const stringValue = String(value);
                  if (input.selections.includes(stringValue)) {
                    control.setValue(stringValue, { emitEvent: false });
                  } else if (input.custom) {
                    const customValue = categoryInformation![`${key}Custom`] as number | undefined;
                    if (customValue !== undefined) {
                      control.setValue('custom', { emitEvent: false });
                      const customControl = this.form.get(`${key}Custom`);
                      if (customControl) {
                        customControl.setValue(customValue, { emitEvent: false });
                      }
                    } else {
                      control.setValue(stringValue, { emitEvent: false });
                    }
                  } else {
                    control.setValue(stringValue, { emitEvent: false });
                  }
                } else {
                  control.setValue(value, { emitEvent: false });
                }
              } else {
                control.setValue(value, { emitEvent: false });
              }
            } else {
              control.setValue(value, { emitEvent: false });
            }
          });
        }

        // Cargar campos base
        if (quote.status) {
          this.form.controls.status.setValue(quote.status, { emitEvent: false });
        }
        if (quote.notes !== undefined) {
          this.form.controls.notes.setValue(quote.notes ?? null, { emitEvent: false });
        }
        const source = categoryInformation?.['source'] as string | undefined;
        if (source) {
          this.form.controls.source.setValue(source, { emitEvent: false });
        }
        const address = categoryInformation?.['address'] as string | undefined;
        if (address) {
          this.form.controls.address.setValue(address, { emitEvent: false });
        }

        // Cargar materials
        if (quote.materials) {
          const materialsValue = quote.materials as Materials;
          this.form.controls.materials.setValue(materialsValue, { emitEvent: false });
          if (this.materialsTabComponent) {
            this.materialsTabComponent.setMaterialsValue(materialsValue);
          }
        }

        // Actualizar formulario y calcular total
        this.form.updateValueAndValidity({ emitEvent: false });
        this.formChangeTrigger.update(val => val + 1);
        this.showCostCounter.set(true);
      },
      error: (error) => {
        const message = this.errorService.handle(error);
        this.notificationService.error('Error', `Could not load estimate: ${message}`);
      }
    });
  }

  protected setActiveTab(tab: string): void {
    this.activeTab.set(tab);
  }

  /**
   * Verifica si se debe mostrar el título de la subcategoría
   * No se muestra si todos los inputs tienen el mismo label que el título de la subcategoría
   */
  protected shouldShowSubcategoryTitle(subcategoryGroup: { title: string; inputs: { label: string }[] }): boolean {
    if (!subcategoryGroup.title || subcategoryGroup.inputs.length === 0) {
      return false;
    }

    // Normalizar el título (case insensitive, sin espacios extra)
    const normalizedTitle = subcategoryGroup.title.trim().toLowerCase();
    
    // Verificar si todos los inputs tienen el mismo label que el título
    const allLabelsMatch = subcategoryGroup.inputs.every(input => {
      const normalizedLabel = input.label.trim().toLowerCase();
      return normalizedLabel === normalizedTitle;
    });

    // Si todos los labels coinciden con el título, no mostrar el título
    return !allLabelsMatch;
  }

  /**
   * Verifica si se debe mostrar el título de la categoría
   * No se muestra si todos los inputs de todas las subcategorías tienen el mismo label que el título de la categoría
   */
  protected shouldShowCategoryTitle(categoryGroup: { title: string; subcategories: { inputs: { label: string }[] }[] }): boolean {
    if (!categoryGroup.title || categoryGroup.subcategories.length === 0) {
      return true; // Siempre mostrar si no hay subcategorías
    }

    // Normalizar el título de la categoría
    const normalizedCategoryTitle = categoryGroup.title.trim().toLowerCase();
    
    // Obtener todos los inputs de todas las subcategorías
    const allInputs = categoryGroup.subcategories.flatMap(sub => sub.inputs);
    
    if (allInputs.length === 0) {
      return true;
    }

    // Verificar si todos los inputs tienen el mismo label que el título de la categoría
    const allLabelsMatch = allInputs.every(input => {
      const normalizedLabel = input.label.trim().toLowerCase();
      return normalizedLabel === normalizedCategoryTitle;
    });

    // Si todos los labels coinciden con el título de la categoría, no mostrar el título
    return !allLabelsMatch;
  }

  protected goBack(): void {
    this.cancelQuote.emit();
  }

  protected submit(): void {
    if (this.isSubmitting || this.form.invalid) {
      this.form.markAllAsTouched();
      this.notificationService.error('Form Invalid', 'Please fill in all required fields');
      return;
    }

    const userId = this.getCurrentUserId();
    if (!userId) {
      this.notificationService.error('Error', 'User ID is required');
      return;
    }

    const formValue = this.form.getRawValue();

    // Construir additionalWorkInformation solo con campos de inputs_additional_work.json
    const additionalWorkInformation = this.buildAdditionalWorkInformation(formValue);

    // Obtener materials: primero intentar del componente si está disponible, sino del formulario
    let materials: Materials | null = null;
    
    if (this.materialsTabComponent) {
      materials = this.materialsTabComponent.getMaterialsValue();
    }
    
    if (materials === null || materials === undefined) {
      materials = formValue.materials ?? null;
    }

    // No enviar versionNumber - el backend lo calcula automáticamente por projectId + category
    // Si hay quoteId, estamos creando una nueva versión, pero el backend calculará el número correcto
    // Construir el payload base
    const quotePayload: QuotePayload = {
      customerId: this.customer._id,
      companyId: this.companyId,
      projectId: this.project._id,
      category: this.category,
      status: formValue.status as QuotePayload['status'],
      experience: 'basic', // Para bathroom y basement usar 'basic' por defecto
      totalPrice: this.totalCost(),
      notes: formValue.notes ?? undefined,
      userId
      // versionNumber no se envía - el backend lo calcula automáticamente
    };

    // Agregar el campo de información según la categoría
    if (this.category === 'additional-work') {
      quotePayload.additionalWorkInformation = additionalWorkInformation;
    } else if (this.category === 'bathroom') {
      quotePayload.bathroomInformation = additionalWorkInformation;
    } else if (this.category === 'basement') {
      quotePayload.basementInformation = additionalWorkInformation;
    }
    
    // Agregar materials solo si tiene valor
    if (materials !== null && materials !== undefined) {
      quotePayload.materials = materials;
    }

    // Siempre usar createQuote, incluso para nuevas versiones
    this.quoteService
      .createQuote(quotePayload)
      .subscribe({
        next: () => {
          const categoryName = this.getCategoryDisplayName(this.category);
          const message = this.quoteId
            ? 'New version created successfully'
            : `${categoryName} estimate created successfully`;
          this.notificationService.success('Success', message);
          void this.router.navigateByUrl(`/projects/${this.project._id}`);
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Error', message);
        }
      });
  }

  protected saveAsDraft(): void {
    this.form.controls.status.setValue('draft');
    this.submit();
  }

  protected cancelForm(): void {
    this.cancelQuote.emit();
  }

  private getCurrentUserId(): string | null {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) {
        return null;
      }
      const user = JSON.parse(raw) as { id: string };
      return user.id ?? null;
    } catch {
      return null;
    }
  }

  protected getCategoryDisplayName(category: QuoteCategory): string {
    const nameMap: Record<QuoteCategory, string> = {
      kitchen: 'Kitchen',
      bathroom: 'Bathroom',
      basement: 'Basement',
      'additional-work': 'Additional Work'
    };
    return nameMap[category] ?? category;
  }

  /**
   * Construye el objeto additionalWorkInformation con solo los campos de inputs_additional_work.json
   */
  private buildAdditionalWorkInformation(formValue: AdditionalWorkQuoteFormValue): Record<string, unknown> {
    const inputs = this.inputsService.inputs();
    const additionalWorkInfo: Record<string, unknown> = {};

    // Campos base del formulario que NO deben ir en additionalWorkInformation
    const excludedFields = new Set([
      'customer',
      'projectName',
      'status',
      'category',
      'source',
      'address',
      'notes',
      'materials'
    ]);

    // Obtener todos los nombres de campos válidos desde inputs_additional_work.json
    const validFieldNames = new Set<string>();
    for (const input of inputs) {
      validFieldNames.add(input.name);

      // Si tiene custom, agregar el campo custom
      if (input.custom) {
        validFieldNames.add(`${input.name}Custom`);
      }

      // Si necesita quantity, agregar el campo quantity
      if (
        (input.element === 'radioButton' || input.element === 'selectCustomInputText') &&
        input.formula === 'UNIT * PRICE'
      ) {
        validFieldNames.add(`${input.name}Quantity`);
      }
    }

    // Filtrar formValue para incluir solo campos válidos de additionalWorkInformation
    for (const [key, value] of Object.entries(formValue)) {
      // Excluir campos base del formulario
      if (excludedFields.has(key)) {
        continue;
      }

      // Solo incluir campos válidos de inputs_additional_work.json
      if (validFieldNames.has(key)) {
        // Solo agregar si tiene valor
        if (value !== null && value !== undefined && value !== '') {
          additionalWorkInfo[key] = value;
        }
      }
    }

    return additionalWorkInfo;
  }
}
