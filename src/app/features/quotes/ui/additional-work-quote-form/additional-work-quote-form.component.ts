import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
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
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
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
import { S3UploadService } from '../../../../core/services/upload/s3-upload.service';
import { AudioRecorderService } from '../../../../core/services/audio/audio-recorder.service';
import { AudioService } from '../../../../core/services/audio/audio.service';
import { IosMediaService } from '../../../../core/services/ios/ios-media.service';
import { PermissionsService } from '../../../../core/services/permissions/permissions.service';
import { MediaPickerService } from '../../../../core/services/media/media-picker.service';
import { DrawingCanvasService } from '../../../../core/services/drawing-canvas/drawing-canvas.service';
import { LogService } from '../../../../core/services/log/log.service';
import { LoadingService } from '../../../../core/services/loading/loading.service';
import { DynamicFormFieldComponent } from '../kitchen-quote-form/dynamic-form-field/dynamic-form-field.component';
import { MaterialsTabComponent } from '../kitchen-quote-form/tabs/materials-tab/materials-tab.component';
import { MediaPreviewService } from '../../../../core/services/media-preview/media-preview.service';
import { MediaPickerMenuComponent } from '../../../../shared/ui/media-picker-menu/media-picker-menu.component';
import type { AdditionalWorkQuoteFormValue, AdditionalWorkQuoteFormGroup } from './additional-work-quote-form.types';

@Component({
  selector: 'app-additional-work-quote-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicFormFieldComponent,
    MaterialsTabComponent,
    MediaPickerMenuComponent
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
  private readonly s3UploadService = inject(S3UploadService);
  private readonly audioRecorderService = inject(AudioRecorderService);
  private readonly audioService = inject(AudioService);
  private readonly iosMediaService = inject(IosMediaService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly mediaPickerService = inject(MediaPickerService);
  private readonly drawingCanvasService = inject(DrawingCanvasService);
  private readonly logService = inject(LogService);
  private readonly loadingService = inject(LoadingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly mediaPreview = inject(MediaPreviewService);

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

  // Flag para controlar si ya se cargaron los datos guardados
  private hasLoadedSavedData = false;

  // Flag para saber si es un draft explícito (cuando se hace clic en "Save as Draft")
  private isExplicitDraft = false;

  // Estado de grabación de audio
  protected readonly isRecording = this.audioRecorderService.isRecording;
  protected readonly isUploadingAudio = signal(false);
  protected readonly isProcessingAudio = signal(false);

  // Estado de dibujo
  protected readonly isUploadingSketch = signal(false);
  protected readonly uploadingAdditionalMedia = signal<
    Map<string, { file: File; preview: string; progress: number }>
  >(new Map());

  // Estados para la sección de estimación
  protected readonly showBudgetDetails = signal<boolean>(false);
  protected readonly showSummary = signal<boolean>(false);

  // Estados para la vista de destinatarios y pantalla de confirmación
  protected readonly showRecipientsView = signal<boolean>(false);
  protected readonly showConfirmationScreen = signal<boolean>(false);
  protected readonly selectedRecipients = signal<string[]>([]);
  protected readonly submittedQuote = signal<Quote | null>(null);

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

  // Verificar que el formulario esté listo
  protected get isFormReady(): boolean {
    return !!(this.form && this.form.controls.roughQuote && this.form.controls.clientBudget);
  }

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
    materials: [null as Materials | null],
    audioNotes: [null as { url: string; transcription?: string; summary?: string }[] | null],
    sketchFiles: [null as string[] | null],
    additionalComments: this.fb.group({
      comment: [null as string | null],
      mediaFiles: [null as string[] | null]
    }) as FormGroup<{
      comment: FormControl<string | null>;
      mediaFiles: FormControl<string[] | null>;
    }>,
    roughQuote: [null as number | null],
    clientBudget: [null as number | null]
  }) as unknown as AdditionalWorkQuoteFormGroup;

  constructor() {
    // Efecto para generar campos dinámicos cuando se carguen los inputs
    effect(() => {
      const inputs = this.inputsService.inputs();
      if (inputs.length > 0) {
        this.generateDynamicFormFields(inputs);
        
        // Cargar datos guardados después de generar los campos dinámicos
        // Solo si no hay quoteId y aún no se han cargado los datos guardados
        if (!this.quoteId && !this.hasLoadedSavedData) {
          // Usar setTimeout para asegurar que los campos estén completamente generados
          setTimeout(() => {
            this.loadSavedFormData();
            this.hasLoadedSavedData = true;
          }, 0);
        }
      }
    });
  }

  ngOnInit(): void {
    // Verificar si es un nuevo estimado (sin quoteId y con flag isNewQuote)
    const isNewQuote = sessionStorage.getItem('isNewQuote') === 'true';
    const hasPendingCanvasResult = sessionStorage.getItem('drawingCanvasResult') !== null;
    
    // Si es un nuevo estimado y no hay resultado pendiente del canvas, limpiar localStorage
    // No limpiar si:
    // - Hay quoteId (es una nueva versión de un estimado existente)
    // - Hay resultado pendiente del canvas (se está regresando desde sketch)
    // - No hay flag isNewQuote (se actualizó la página o se navegó de otra forma)
    if (isNewQuote && !this.quoteId && !hasPendingCanvasResult) {
      console.log('[AdditionalWork] ngOnInit - Es un nuevo estimado, limpiando localStorage');
      this.clearSavedFormData();
      // Limpiar el flag después de usarlo
      sessionStorage.removeItem('isNewQuote');
    }

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

    // Nota: Los datos guardados se cargan en el effect() después de generar los campos dinámicos
    // para asegurar que todos los campos estén disponibles antes de restaurar valores

    // Si hay un quoteId, cargar los datos del quote para crear una nueva versión
    if (this.quoteId) {
      this.loadQuoteForEdit(this.quoteId);
    }

    // Suscribirse a los cambios del formulario para recalcular el costo en tiempo real y guardar
    this.form.valueChanges
      .pipe(
        debounceTime(500),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.formChangeTrigger.update(val => val + 1);
        // Guardar automáticamente en localStorage
        this.saveFormData();
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

    // Escuchar eventos de navegación para procesar resultados del canvas cuando se regresa
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        const navEnd = event as NavigationEnd;
        console.log('[AdditionalWork] NavigationEnd - URL:', navEnd.url);
        console.log('[AdditionalWork] NavigationEnd - Verificando resultado pendiente');
        
        // Procesar resultado del canvas si hay uno pendiente después de navegar
        setTimeout(() => {
          this.processPendingCanvasResult();
        }, 100);
      });
  }

  /**
   * Procesa el resultado pendiente del canvas
   */
  private processPendingCanvasResult(): void {
    console.log('[AdditionalWork] processPendingCanvasResult - Verificando resultado pendiente');
    const hasPending = this.drawingCanvasService.hasPendingResult();
    console.log('[AdditionalWork] processPendingCanvasResult - hasPendingResult:', hasPending);
    
    if (hasPending) {
      const resultStr = sessionStorage.getItem('drawingCanvasResult');
      console.log('[AdditionalWork] processPendingCanvasResult - resultStr existe:', !!resultStr);
      
      if (resultStr) {
        const result = JSON.parse(resultStr);
        console.log('[AdditionalWork] processPendingCanvasResult - result.action:', result.action);
        console.log('[AdditionalWork] processPendingCanvasResult - result.dataUrl existe:', !!result.dataUrl);
        
        if (result.action === 'save' && result.dataUrl) {
          // Limpiar el resultado ANTES de procesarlo para evitar procesamiento duplicado
          console.log('[AdditionalWork] processPendingCanvasResult - Limpiando sessionStorage antes de procesar');
          sessionStorage.removeItem('drawingCanvasResult');
          sessionStorage.removeItem('drawingCanvasCallback');

          // Si hay un resultado de guardado, procesarlo directamente
          console.log('[AdditionalWork] processPendingCanvasResult - Llamando a onSketchSaved');
          void this.onSketchSaved(result.dataUrl);
          // NO restaurar scroll aquí - onSketchSaved manejará el scroll hacia la sección de notas
        } else {
          // Para otros casos, usar el servicio
          console.log('[AdditionalWork] processPendingCanvasResult - Usando servicio processResult');
          void this.drawingCanvasService.processResult();
        }
      } else {
        console.log('[AdditionalWork] processPendingCanvasResult - No hay resultStr, usando servicio');
        void this.drawingCanvasService.processResult();
      }
    }
  }

  ngAfterViewInit(): void {
    // Configurar callback para sincronizar materiales con el formulario
    setTimeout(() => {
      this.setupMaterialsSync();
    }, 0);

    // Procesar resultado del canvas si hay uno pendiente al inicializar
    // Usar setTimeout para asegurar que el DOM esté completamente renderizado
    setTimeout(() => {
      this.processPendingCanvasResult();
    }, 100);
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
          // Crear el control deshabilitado por defecto (se habilitará cuando se seleccione una opción)
          const quantityControl = this.fb.control<number | null>(null);
          quantityControl.disable();
          this.form.addControl(quantityFieldName, quantityControl);
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

        // Cargar audioNotes
        if (quote.audioNotes) {
          // Ordenar de más reciente a más antiguo manteniendo el orden original del backend
          this.form.controls.audioNotes.setValue([...quote.audioNotes].reverse(), { emitEvent: false });
        }

        // Hacer merge de sketchFiles: combinar los existentes con los del quote (sin duplicados)
        const existingSketches = this.form.controls.sketchFiles.value ?? [];
        const quoteSketches = quote.sketchFiles ?? [];
        
        // Combinar ambos arrays sin duplicados
        const mergedSketches = [...new Set([...existingSketches, ...quoteSketches])];
        console.log('[AdditionalWork] loadQuoteForEdit - Merging sketches');
        console.log('[AdditionalWork] loadQuoteForEdit - Existing sketches:', existingSketches);
        console.log('[AdditionalWork] loadQuoteForEdit - Quote sketches:', quoteSketches);
        console.log('[AdditionalWork] loadQuoteForEdit - Merged sketches:', mergedSketches);
        
        if (mergedSketches.length > 0) {
          this.form.controls.sketchFiles.setValue(mergedSketches, { emitEvent: false });
        }

        // Cargar additionalComments
        if (quote.additionalComments) {
          this.form.controls.additionalComments.setValue({
            comment: quote.additionalComments.comment ?? null,
            mediaFiles: quote.additionalComments.mediaFiles ?? null
          }, { emitEvent: false });
        }

        // Cargar roughQuote y clientBudget
        if (quote.roughQuote !== undefined) {
          this.form.controls.roughQuote.setValue(quote.roughQuote, { emitEvent: false });
        }
        if (quote.clientBudget !== undefined) {
          this.form.controls.clientBudget.setValue(quote.clientBudget, { emitEvent: false });
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

    // Mostrar resumen antes de enviar
    if (!this.showSummary()) {
      this.showSummary.set(true);
      return;
    }

    // Si ya se mostró el resumen, llamar al método real de envío
    this.actuallySubmit();
  }

  /**
   * Cierra el resumen y vuelve al formulario
   */
  protected closeSummary(): void {
    this.showSummary.set(false);
  }

  /**
   * Confirma el envío del formulario después de revisar el resumen
   */
  protected confirmSubmit(): void {
    this.showSummary.set(false);
    // Mostrar vista de destinatarios antes de enviar
    // Preseleccionar todos los destinatarios por defecto
    this.selectedRecipients.set(['Baldemar', 'Fila', 'Office']);
    this.showRecipientsView.set(true);
  }

  /**
   * Maneja la selección de destinatarios y procede con el envío
   */
  protected onRecipientsSelected(): void {
    const recipients = this.selectedRecipients();
    if (recipients.length === 0) {
      this.notificationService.error('Error', 'Please select at least one recipient');
      return;
    }
    // Proceder con el envío
    this.actuallySubmit();
  }

  /**
   * Cancela la selección de destinatarios y vuelve al resumen
   */
  protected cancelRecipientsSelection(): void {
    this.showRecipientsView.set(false);
    this.showSummary.set(true); // Volver al resumen
  }

  /**
   * Alterna la selección de un destinatario
   */
  protected toggleRecipient(recipient: string): void {
    const current = this.selectedRecipients();
    if (current.includes(recipient)) {
      this.selectedRecipients.set(current.filter((r) => r !== recipient));
    } else {
      this.selectedRecipients.set([...current, recipient]);
    }
  }

  /**
   * Realiza el envío real del formulario
   */
  private actuallySubmit(): void {
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

    // Calcular versionNumber
    // Si hay originalQuote, crear una nueva versión (versionNumber + 1)
    // Si no hay, es un nuevo quote (versionNumber = 1)
    let versionNumber = 1;
    if (this.originalQuote && this.originalQuote.versionNumber) {
      versionNumber = this.originalQuote.versionNumber + 1;
    }

    // Determinar el status final
    // Si es 'draft' y no fue establecido explícitamente (saveAsDraft), cambiarlo a 'sent'
    let finalStatus = formValue.status as QuotePayload['status'];
    if (finalStatus === 'draft' && !this.isExplicitDraft) {
      finalStatus = 'sent';
    }

    // Construir el payload base
    const quotePayload: QuotePayload = {
      customerId: this.customer._id,
      companyId: this.companyId,
      projectId: this.project._id,
      category: this.category,
      status: finalStatus,
      experience: 'basic', // Para bathroom y basement usar 'basic' por defecto
      totalPrice: this.totalCost(),
      notes: formValue.notes ?? undefined,
      userId,
      versionNumber
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
        next: (quote) => {
          // Limpiar datos guardados después de enviar exitosamente
          this.clearSavedFormData();
          
          // Resetear flag de draft explícito
          this.isExplicitDraft = false;
          
          // Cerrar la vista de recipients
          this.showRecipientsView.set(false);
          
          // Guardar el quote creado para mostrar en la pantalla de confirmación
          this.submittedQuote.set(quote);
          // Mostrar pantalla de confirmación
          this.showConfirmationScreen.set(true);
        },
        error: (error) => {
          const message = this.errorService.handle(error);
          this.notificationService.error('Error', message);
          // Volver a la vista de recipients en caso de error
          this.showRecipientsView.set(true);
        }
      });
  }

  protected saveAsDraft(): void {
    this.isExplicitDraft = true;
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
      'materials', // materials va en el nivel raíz del payload, no en additionalWorkInformation
    ]);

    // Agregar campos de archivos si existen
    if (formValue['audioNotes']) {
      additionalWorkInfo['audioNotes'] = formValue['audioNotes'];
    }

    if (formValue['sketchFiles'] && formValue['sketchFiles']?.length > 0) {
      additionalWorkInfo['sketchFiles'] = formValue['sketchFiles'];
    }

    if (formValue['additionalComments']) {
      additionalWorkInfo['additionalComments'] = formValue['additionalComments'];
    }

    // Agregar campos de budget
    if (formValue['roughQuote'] !== null && formValue['roughQuote'] !== undefined) {
      additionalWorkInfo['roughQuote'] = formValue['roughQuote'];
    }
    if (formValue['clientBudget'] !== null && formValue['clientBudget'] !== undefined) {
      additionalWorkInfo['clientBudget'] = formValue['clientBudget'];
    }

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

  /**
   * Verifica si una URL es una imagen
   */
  protected isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  }

  /**
   * Verifica si una URL es un video
   */
  protected isVideoUrl(url: string): boolean {
    return /\.(mp4|mov|avi|mkv|webm|heic)$/i.test(url);
  }

  /**
   * Crea un thumbnail de un video para mostrar como preview
   */
  private async createVideoThumbnail(file: File): Promise<string> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const videoUrl = URL.createObjectURL(file);

      if (!ctx) {
        URL.revokeObjectURL(videoUrl);
        resolve('');
        return;
      }

      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        video.src = '';
        canvas.width = 0;
        canvas.height = 0;
        URL.revokeObjectURL(videoUrl);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve('');
      }, 5000);

      video.onloadedmetadata = () => {
        try {
          const maxWidth = 320;
          const maxHeight = 240;
          let width = video.videoWidth;
          let height = video.videoHeight;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          const seekTime = video.duration > 1 ? 1 : video.duration / 2;
          video.currentTime = Math.max(0.1, seekTime);
        } catch (error) {
          clearTimeout(timeout);
          cleanup();
          resolve('');
        }
      };

      video.onseeked = () => {
        try {
          clearTimeout(timeout);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const thumbnailUrl = URL.createObjectURL(blob);
                cleanup();
                resolve(thumbnailUrl);
              } else {
                cleanup();
                resolve('');
              }
            },
            'image/jpeg',
            0.8
          );
        } catch (error) {
          clearTimeout(timeout);
          cleanup();
          resolve('');
        }
      };

      video.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        resolve('');
      };

      video.src = videoUrl;
    });
  }

  /**
   * Toggle grabación de audio
   */
  protected async toggleRecording(): Promise<void> {
    if (this.isRecording()) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      await this.audioRecorderService.startRecording();
    } catch (error) {
      this.notificationService.error(
        'Error',
        'Could not start recording. Please check microphone permissions.'
      );
      await this.logService.logError('Error al iniciar grabación de audio', error, {
        severity: 'medium',
        description: 'Error al intentar iniciar la grabación de audio en el formulario de additional-work',
        source: 'additional-work-quote-form',
        metadata: {
          component: 'AdditionalWorkQuoteFormComponent',
          action: 'startRecording',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      const audioFile = await this.audioRecorderService.stopRecording();
      await this.processAudioFile(audioFile);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.notificationService.error('Error', `Error stopping recording: ${errorMsg}`);
      await this.logService.logError('Error al detener grabación de audio', error, {
        severity: 'medium',
        description: 'Error al intentar detener la grabación de audio en el formulario de additional-work',
        source: 'additional-work-quote-form',
        metadata: {
          component: 'AdditionalWorkQuoteFormComponent',
          action: 'stopRecording',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  private async processAudioFile(file: File): Promise<void> {
    this.isUploadingAudio.set(true);
    this.isProcessingAudio.set(true);

    try {
      const url = await this.s3UploadService.uploadFile(file);
      this.isUploadingAudio.set(false);

      this.notificationService.info('Processing', 'Generating audio summary...');

      // Procesar con API de audio usando la URL de S3
      // El interceptor HTTP activará automáticamente el loader
      this.audioService.summarizeAudioFromUrl(url).subscribe({
        next: (response) => {
          const currentAudios = this.form.controls.audioNotes.value || [];
          const newAudio = response.success
            ? {
                url,
                transcription: response.data.transcription,
                summary: response.data.summary,
              }
            : { url };
          
          // Agregar el nuevo audio al inicio del array (más reciente primero)
          this.form.controls.audioNotes.setValue([newAudio, ...currentAudios], { emitEvent: true });
          
          if (response.success) {
            this.notificationService.success('Success', 'Audio processed successfully');
          } else {
            this.notificationService.info(
              'Warning',
              'Audio saved, but summary could not be generated'
            );
            void this.logService.logNotification('Audio guardado pero resumen no generado', {
              description: 'El audio se subió correctamente pero no se pudo generar el resumen',
              source: 'additional-work-quote-form',
              metadata: {
                component: 'AdditionalWorkQuoteFormComponent',
                action: 'processAudioFile',
                audioUrl: url,
                projectId: this.project._id,
                customerId: this.customer._id,
              },
            });
          }
          this.isProcessingAudio.set(false);
          // Asegurar que el loader se cierre después de que el interceptor HTTP termine
          setTimeout(() => this.loadingService.reset(), 200);
        },
        error: (error) => {
          const currentAudios = this.form.controls.audioNotes.value || [];
          // Guardar solo la URL al inicio (más reciente primero)
          this.form.controls.audioNotes.setValue([{ url }, ...currentAudios], { emitEvent: true });
          this.notificationService.info('Warning', 'Audio saved, but text processing failed');
          this.isProcessingAudio.set(false);
          // Asegurar que el loader se cierre después de que el interceptor HTTP termine
          setTimeout(() => this.loadingService.reset(), 200);
          void this.logService.logError('Error al procesar audio con API', error, {
            severity: 'medium',
            description:
              'Error al procesar el audio con la API de resumen, pero el archivo se guardó correctamente',
            source: 'additional-work-quote-form',
            metadata: {
              component: 'AdditionalWorkQuoteFormComponent',
              action: 'summarizeAudio',
              audioUrl: url,
              projectId: this.project._id,
              customerId: this.customer._id,
            },
          });
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.notificationService.error('Error', `Could not upload audio file: ${errorMsg}`);
      this.isUploadingAudio.set(false);
      this.isProcessingAudio.set(false);
      // Asegurar que el loader se cierre después de que el interceptor HTTP termine
      setTimeout(() => this.loadingService.reset(), 200);
      await this.logService.logError('Error al subir archivo de audio', error, {
        severity: 'high',
        description: 'Error al subir el archivo de audio a S3',
        source: 'additional-work-quote-form',
        metadata: {
          component: 'AdditionalWorkQuoteFormComponent',
          action: 'processAudioFile',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  protected deleteAudioNote(index: number): void {
    const currentAudios = this.form.controls.audioNotes.value || [];
    const updatedAudios = currentAudios.filter((_, i) => i !== index);
    this.form.controls.audioNotes.setValue(updatedAudios.length > 0 ? updatedAudios : null, { emitEvent: true });
  }

  /**
   * Abre la página de dibujo
   */
  protected openDrawingCanvas(event?: Event): void {
    console.log('[AdditionalWork] openDrawingCanvas - Iniciando');
    const currentSketches = this.form.controls.sketchFiles.value ?? [];
    console.log('[AdditionalWork] openDrawingCanvas - Sketches actuales:', currentSketches.length, currentSketches);
    
    // Obtener la URL actual para regresar después
    const currentUrl = this.router.url;
    console.log('[AdditionalWork] openDrawingCanvas - URL actual:', currentUrl);
    
    // Abrir el canvas navegando a la nueva página
    this.drawingCanvasService.openCanvas(currentUrl, (dataUrl) => this.onSketchSaved(dataUrl));
  }

  /**
   * Maneja el guardado del dibujo
   */
  protected async onSketchSaved(dataUrl: string): Promise<void> {
    console.log('[AdditionalWork] onSketchSaved - Iniciando guardado de sketch');
    console.log('[AdditionalWork] onSketchSaved - dataUrl recibido:', dataUrl.substring(0, 50) + '...');
    
    this.isUploadingSketch.set(true);

    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      let file = new File([blob], `sketch-${Date.now()}.png`, { type: 'image/png' });
      console.log('[AdditionalWork] onSketchSaved - Archivo creado:', file.name, file.size, 'bytes');

      file = await this.iosMediaService.processMediaFile(file);
      console.log('[AdditionalWork] onSketchSaved - Archivo procesado:', file.name, file.size, 'bytes');

      console.log('[AdditionalWork] onSketchSaved - Subiendo a S3...');
      const url = await this.s3UploadService.uploadFile(file);
      console.log('[AdditionalWork] onSketchSaved - URL obtenida de S3:', url);

      // Agregar a la lista de dibujos (múltiples)
      // Asegurarse de que no se duplique si ya existe
      const currentSketches = this.form.controls.sketchFiles.value ?? [];
      console.log('[AdditionalWork] onSketchSaved - Sketches actuales ANTES de agregar:', currentSketches.length, currentSketches);
      console.log('[AdditionalWork] onSketchSaved - URL ya existe?', currentSketches.includes(url));
      
      if (!currentSketches.includes(url)) {
        const newSketches = [...currentSketches, url];
        console.log('[AdditionalWork] onSketchSaved - Nuevos sketches:', newSketches.length, newSketches);
        this.form.controls.sketchFiles.setValue(newSketches, { emitEvent: true });
        
        // Verificar inmediatamente después de setValue
        const afterSetValue = this.form.controls.sketchFiles.value ?? [];
        console.log('[AdditionalWork] onSketchSaved - Sketches DESPUÉS de setValue:', afterSetValue.length, afterSetValue);

        // Forzar detección de cambios para mostrar el sketch inmediatamente
        this.cdr.markForCheck();

        // Guardar el estado del formulario después de agregar el sketch
        // Usar setTimeout para asegurar que el cambio se haya propagado completamente
        setTimeout(() => {
          const beforeSave = this.form.controls.sketchFiles.value ?? [];
          console.log('[AdditionalWork] onSketchSaved - Sketches ANTES de saveFormData:', beforeSave.length, beforeSave);
          this.saveFormData();
          
          // Verificar después de guardar
          const afterSave = this.form.controls.sketchFiles.value ?? [];
          console.log('[AdditionalWork] onSketchSaved - Sketches DESPUÉS de saveFormData:', afterSave.length, afterSave);
          
          // Forzar otra vez la detección de cambios después de guardar
          this.cdr.markForCheck();
        }, 100);
      } else {
        console.warn('[AdditionalWork] onSketchSaved - URL ya existe, no se agregará:', url);
      }

      this.notificationService.success('Success', 'Sketch saved successfully');
      
      // Hacer scroll suave hacia la sección de notas después de guardar
      setTimeout(() => {
        this.scrollToNotesSection();
      }, 100);
    } catch (error) {
      this.notificationService.error('Error', 'Could not save sketch');
      await this.logService.logError('Error al guardar sketch', error, {
        severity: 'high',
        description: 'Error al subir el sketch (dibujo) a S3',
        source: 'additional-work-quote-form',
        metadata: {
          component: 'AdditionalWorkQuoteFormComponent',
          action: 'onSketchSaved',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    } finally {
      this.isUploadingSketch.set(false);
    }
  }

  /**
   * Hace scroll hacia la sección de notas de forma imperceptible
   */
  private scrollToNotesSection(): void {
    const notesSection = document.getElementById('notes-section');
    if (notesSection) {
      // Calcular la posición con un pequeño offset para mejor visualización
      const offset = 20;
      const elementPosition = notesSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      // Usar requestAnimationFrame para asegurar que el DOM esté renderizado
      // Scroll instantáneo para que sea imperceptible
      requestAnimationFrame(() => {
        window.scrollTo({
          top: offsetPosition,
          behavior: 'auto' // Cambiar a 'auto' para scroll instantáneo e imperceptible
        });
      });
    }
  }

  protected deleteSketch(index: number): void {
    const currentSketches = this.form.controls.sketchFiles.value ?? [];
    const updatedSketches = currentSketches.filter((_, i) => i !== index);
    this.form.controls.sketchFiles.setValue(updatedSketches.length > 0 ? updatedSketches : null);
  }

  /**
   * Handles capture from camera for additional images
   */
  protected async onAdditionalImagesCaptureFromCamera(): Promise<void> {
    try {
      const hasPermission = await this.permissionsService.requestMediaPermissions();
      if (!hasPermission) {
        this.notificationService.error(
          'Permissions Required',
          'Camera access is needed to take photos. Please enable permissions in your device settings.'
        );
        return;
      }

      const files = await this.mediaPickerService.captureImageFromCamera();
      if (files.length === 0) return;

      void this.processAdditionalMediaFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not capture image');
      await this.logService.logError('Error capturing additional image', error, {
        severity: 'medium',
        description: 'Error capturing additional image in additional-work form',
        source: 'additional-work-quote-form',
        metadata: {
          component: 'AdditionalWorkQuoteFormComponent',
          action: 'onAdditionalImagesCaptureFromCamera',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles selection from gallery for additional images
   */
  protected async onAdditionalImagesSelectFromGallery(): Promise<void> {
    try {
      const hasPermission = await this.permissionsService.requestMediaPermissions();
      if (!hasPermission) {
        this.notificationService.error(
          'Permissions Required',
          'Photo library access is needed to select images. Please enable permissions in your device settings.'
        );
        return;
      }

      const files = await this.mediaPickerService.pickImages(true);
      if (files.length === 0) return;

      void this.processAdditionalMediaFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not select images');
      await this.logService.logError('Error selecting additional images', error, {
        severity: 'medium',
        description: 'Error selecting additional images in additional-work form',
        source: 'additional-work-quote-form',
        metadata: {
          component: 'AdditionalWorkQuoteFormComponent',
          action: 'onAdditionalImagesSelectFromGallery',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles capture from camera for additional videos
   */
  protected async onAdditionalVideosCaptureFromCamera(): Promise<void> {
    try {
      const hasPermission = await this.permissionsService.requestMediaPermissions();
      if (!hasPermission) {
        this.notificationService.error(
          'Permissions Required',
          'Camera access is needed to record videos. Please enable permissions in your device settings.'
        );
        return;
      }

      const files = await this.mediaPickerService.captureVideoFromCamera();
      if (files.length === 0) return;

      void this.processAdditionalMediaFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not capture video');
      await this.logService.logError('Error capturing additional video', error, {
        severity: 'medium',
        description: 'Error capturing additional video in additional-work form',
        source: 'additional-work-quote-form',
        metadata: {
          component: 'AdditionalWorkQuoteFormComponent',
          action: 'onAdditionalVideosCaptureFromCamera',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles selection from gallery for additional videos
   */
  protected async onAdditionalVideosSelectFromGallery(): Promise<void> {
    try {
      const hasPermission = await this.permissionsService.requestMediaPermissions();
      if (!hasPermission) {
        this.notificationService.error(
          'Permissions Required',
          'Photo library access is needed to select videos. Please enable permissions in your device settings.'
        );
        return;
      }

      const files = await this.mediaPickerService.pickVideos(true);
      if (files.length === 0) return;

      void this.processAdditionalMediaFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not select videos');
      await this.logService.logError('Error selecting additional videos', error, {
        severity: 'medium',
        description: 'Error selecting additional videos in additional-work form',
        source: 'additional-work-quote-form',
        metadata: {
          component: 'AdditionalWorkQuoteFormComponent',
          action: 'onAdditionalVideosSelectFromGallery',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles selection and upload of files for additional comments
   */
  protected async onAdditionalFilesSelected(): Promise<void> {
    try {
      const hasPermission = await this.permissionsService.requestMediaPermissions();
      if (!hasPermission) {
        this.notificationService.error(
          'Permissions Required',
          'File access is needed to select documents. Please enable permissions in your device settings.'
        );
        return;
      }

      const files = await this.mediaPickerService.pickFiles(true);
      if (files.length === 0) return;

      void this.processAdditionalMediaFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not select files');
      await this.logService.logError('Error selecting additional files', error, {
        severity: 'medium',
        description: 'Error selecting additional files in additional-work form',
        source: 'additional-work-quote-form',
        metadata: {
          component: 'AdditionalWorkQuoteFormComponent',
          action: 'onAdditionalFilesSelected',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Procesa los archivos de medios adicionales
   */
  private async processAdditionalMediaFiles(fileArray: File[]): Promise<void> {
    const currentComments = this.form.controls.additionalComments.value;
    const currentFiles = currentComments?.mediaFiles ?? [];
    const uploadingMap = new Map<string, { file: File; preview: string; progress: number }>();

    for (const file of fileArray) {
      const fileId = `${Date.now()}-${Math.random()}-${file.name}`;
      let preview = '';
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        preview = await this.createVideoThumbnail(file);
      }
      uploadingMap.set(fileId, { file, preview, progress: 0 });
    }

    this.uploadingAdditionalMedia.set(uploadingMap);

    try {
      const uploadedUrls: string[] = [];

      for (const [fileId, fileData] of uploadingMap.entries()) {
        try {
          let processedFile: File;
          try {
            processedFile = await this.iosMediaService.processMediaFile(fileData.file);
          } catch (compressionError) {
            const errorMsg =
              compressionError instanceof Error
                ? compressionError.message
                : String(compressionError);

            if (errorMsg.includes('Unsupported') || errorMsg.includes('too large')) {
              this.notificationService.error(
                'Error de archivo',
                `${fileData.file.name}: ${errorMsg}`
              );
            } else {
              this.notificationService.error(
                'Error al procesar archivo',
                `No se pudo procesar ${fileData.file.name}. Por favor, intenta con otro archivo.`
              );
            }

            await this.logService.logError(
              'Error al procesar archivo multimedia',
              compressionError,
              {
                severity: 'medium',
                description: `Error al procesar archivo: ${fileData.file.name}`,
                source: 'additional-work-quote-form',
                metadata: {
                  component: 'AdditionalWorkQuoteFormComponent',
                  action: 'processAdditionalMediaFiles',
                  step: 'processMediaFile',
                  fileName: fileData.file.name,
                  fileSize: fileData.file.size,
                  fileType: fileData.file.type,
                  projectId: this.project._id,
                  customerId: this.customer._id,
                },
              }
            );

            continue;
          }

          const url = await this.s3UploadService.uploadFile(processedFile, (progress) => {
            const updatedMap = new Map(this.uploadingAdditionalMedia());
            const existing = updatedMap.get(fileId);
            if (existing) {
              updatedMap.set(fileId, { ...existing, progress: progress.percentage });
              this.uploadingAdditionalMedia.set(updatedMap);
            }
          });
          uploadedUrls.push(url);

          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }

          const updatedMap = new Map(this.uploadingAdditionalMedia());
          updatedMap.delete(fileId);
          this.uploadingAdditionalMedia.set(updatedMap);
        } catch (error) {
          const updatedMap = new Map(this.uploadingAdditionalMedia());
          updatedMap.delete(fileId);
          this.uploadingAdditionalMedia.set(updatedMap);
          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }

          const errorMsg = error instanceof Error ? error.message : String(error);
          const isVideo = fileData.file.type.startsWith('video/');
          const fileTypeLabel = isVideo ? 'video' : 'archivo';

          this.notificationService.error(
            'Error al subir archivo',
            `No se pudo subir el ${fileTypeLabel} "${fileData.file.name}". ${errorMsg.includes('Failed')
              ? 'Por favor, verifica tu conexión e intenta nuevamente.'
              : 'Por favor, intenta con otro archivo.'
            }`
          );

          await this.logService.logError('Error al subir archivo de medios adicionales', error, {
            severity: 'high',
            description: `Error al subir archivo de medios adicionales: ${fileData.file.name}`,
            source: 'additional-work-quote-form',
            metadata: {
              component: 'AdditionalWorkQuoteFormComponent',
              action: 'processAdditionalMediaFiles',
              fileName: fileData.file.name,
              fileSize: fileData.file.size,
              fileType: fileData.file.type,
              projectId: this.project._id,
              customerId: this.customer._id,
            },
          });
        }
      }

      const updatedFiles = [...currentFiles, ...uploadedUrls];
      const currentComment = currentComments?.comment ?? null;
      this.form.controls.additionalComments.setValue({
        comment: currentComment,
        mediaFiles: updatedFiles,
      });
    } catch (error) {
      this.notificationService.error('Error', 'No se pudieron subir los archivos');
      await this.logService.logError(
        'Error general al procesar archivos de medios adicionales',
        error,
        {
          severity: 'high',
          description: 'Error general al procesar y subir archivos de medios adicionales',
          source: 'additional-work-quote-form',
          metadata: {
            component: 'AdditionalWorkQuoteFormComponent',
            action: 'processAdditionalMediaFiles',
            filesCount: fileArray.length,
            projectId: this.project._id,
            customerId: this.customer._id,
          },
        }
      );

      for (const fileData of uploadingMap.values()) {
        if (fileData.preview) {
          URL.revokeObjectURL(fileData.preview);
        }
      }
      this.uploadingAdditionalMedia.set(new Map());
    }
  }

  /**
   * Elimina un archivo de comentarios adicionales
   */
  protected removeAdditionalMediaFile(index: number): void {
    const currentComments = this.form.controls.additionalComments.value;
    const currentFiles = currentComments?.mediaFiles ?? [];
    const updatedFiles = currentFiles.filter((_, i) => i !== index);
    const currentComment = currentComments?.comment ?? null;
    this.form.controls.additionalComments.setValue({
      comment: currentComment,
      mediaFiles: updatedFiles.length > 0 ? updatedFiles : null,
    });
  }

  /**
   * Navega a la pantalla de previsualización de media (patrón nativo iOS)
   */
  protected openMediaPreview(url: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.mediaPreview.setPreview(url);
    this.router.navigateByUrl('/media-preview');
  }

  /**
   * Toggle para mostrar/ocultar detalles del budget
   */
  protected toggleBudgetDetails(): void {
    this.showBudgetDetails.update((val) => !val);
  }

  /**
   * Calcula la diferencia entre el budget calculado y el client budget
   */
  protected getBudgetDifference(): number {
    const total = this.totalCost();
    const clientBudget = this.form.controls.clientBudget.value ?? 0;
    return total - clientBudget;
  }

  /**
   * Verifica si hay fotos/videos subidos
   */
  protected hasMediaFiles(): boolean {
    const additional = this.form.controls.additionalComments.value?.mediaFiles?.length ?? 0;
    return additional > 0;
  }

  /**
   * Verifica si hay audio subido
   */
  protected hasAudio(): boolean {
    const audioNotes = this.form.controls.audioNotes.value;
    return audioNotes !== null && Array.isArray(audioNotes) && audioNotes.length > 0;
  }

  /**
   * Verifica si hay sketches subidos
   */
  protected hasSketches(): boolean {
    return (this.form.controls.sketchFiles.value?.length ?? 0) > 0;
  }

  /**
   * Convierte un valor a número para usar en el pipe number
   */
  /**
   * Maneja el evento input para roughQuote / clientBudget.
   * Misma lógica que en KitchenQuoteForm: permitir escritura natural,
   * limitar a 2 decimales y NO aplicar formato de moneda completo mientras se escribe.
   */
  protected onCurrencyInput(event: Event, controlName: 'roughQuote' | 'clientBudget'): void {
    const input = event.target as HTMLInputElement;
    const raw = (input.value || '').replace(/[^0-9.,]/g, '');
    input.value = raw;
  }

  /**
   * Al hacer blur, redondeamos a 2 decimales y dejamos que el binding
   * se encargue de mostrarlo.
   */
  protected onCurrencyBlur(controlName: 'roughQuote' | 'clientBudget'): void {
    const control = this.form.controls[controlName];
    const raw = control.value;
    if (raw === null || raw === undefined) {
      control.setValue(null, { emitEvent: false });
      return;
    }

    const normalized = String(raw).replace(/,/g, '').trim();
    const parsed = parseFloat(normalized);

    if (isNaN(parsed)) {
      control.setValue(null, { emitEvent: false });
    } else {
      const rounded = Number(parsed.toFixed(2));
      control.setValue(rounded, { emitEvent: false });
    }
  }

  protected toNumber(value: number | null | undefined): number {
    return value ?? 0;
  }

  /**
   * Genera una clave única para guardar el estado del formulario
   */
  private getFormStorageKey(): string {
    const parts = [
      'additional-work-quote-form',
      this.project._id,
      this.customer._id,
      this.companyId,
      this.category,
      this.quoteId || 'new'
    ];
    return parts.join('::');
  }

  /**
   * Guarda el estado del formulario en localStorage
   */
  private saveFormData(): void {
    try {
      const formValue = this.form.getRawValue();
      const storageKey = this.getFormStorageKey();
      const sketchFiles = formValue.sketchFiles ?? [];
      console.log('[AdditionalWork] saveFormData - Guardando formulario');
      console.log('[AdditionalWork] saveFormData - sketchFiles en formValue:', sketchFiles.length, sketchFiles);
      console.log('[AdditionalWork] saveFormData - storageKey:', storageKey);
      
      localStorage.setItem(storageKey, JSON.stringify(formValue));
      
      // Verificar que se guardó correctamente
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedValue = JSON.parse(saved);
        const savedSketches = savedValue.sketchFiles ?? [];
        console.log('[AdditionalWork] saveFormData - Verificación: sketchFiles guardados:', savedSketches.length, savedSketches);
      } else {
        console.error('[AdditionalWork] saveFormData - ERROR: No se pudo guardar en localStorage');
      }
    } catch (error) {
      console.error('[AdditionalWork] saveFormData - Error saving form data:', error);
    }
  }

  /**
   * Carga el estado del formulario desde localStorage
   */
  private loadSavedFormData(): void {
    try {
      const storageKey = this.getFormStorageKey();
      console.log('[AdditionalWork] loadSavedFormData - storageKey:', storageKey);
      const savedData = localStorage.getItem(storageKey);
      console.log('[AdditionalWork] loadSavedFormData - savedData existe:', !!savedData);
      
      if (savedData) {
        const formValue = JSON.parse(savedData);
        const savedSketches = formValue.sketchFiles ?? [];
        console.log('[AdditionalWork] loadSavedFormData - sketchFiles en datos guardados:', savedSketches.length, savedSketches);
        
        // Restaurar valores del formulario, pero mantener los valores iniciales si no hay guardados
        this.form.patchValue(formValue, { emitEvent: false });
        
        // Verificar después de patchValue
        const afterPatch = this.form.controls.sketchFiles.value ?? [];
        console.log('[AdditionalWork] loadSavedFormData - sketchFiles DESPUÉS de patchValue:', afterPatch.length, afterPatch);

        // Actualizar trigger para recalcular el costo total
        this.formChangeTrigger.update((val) => val + 1);
        
        // Forzar detección de cambios para actualizar la UI
        this.cdr.markForCheck();
      } else {
        console.log('[AdditionalWork] loadSavedFormData - No hay datos guardados');
      }
    } catch (error) {
      console.error('[AdditionalWork] loadSavedFormData - Error loading saved form data:', error);
    }
  }

  /**
   * Limpia el estado guardado del formulario
   */
  private clearSavedFormData(): void {
    try {
      const storageKey = this.getFormStorageKey();
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Error clearing saved form data:', error);
    }
  }

  /**
   * Navega al proyecto después de la confirmación
   */
  protected goToProject(): void {
    void this.router.navigateByUrl(`/projects/${this.project._id}`);
  }

  /**
   * Cierra la pantalla de confirmación
   */
  protected closeConfirmationScreen(): void {
    this.showConfirmationScreen.set(false);
    void this.router.navigateByUrl(`/projects/${this.project._id}`);
  }
}
