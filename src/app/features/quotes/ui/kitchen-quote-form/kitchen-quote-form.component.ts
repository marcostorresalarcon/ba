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
  type AfterViewInit,
  type OnDestroy
} from '@angular/core';
import type { FormControl, FormGroup} from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { Project } from '../../../../core/models/project.model';
import type { Customer } from '../../../../core/models/customer.model';
import type { Quote, QuotePayload, Materials } from '../../../../core/models/quote.model';
import { QuoteService } from '../../../../core/services/quote/quote.service';
import { HttpErrorService } from '../../../../core/services/error/http-error.service';
import { NotificationService } from '../../../../core/services/notification/notification.service';
import { KitchenCalculationService } from '../../../../core/services/calculation/kitchen-calculation.service';
import { KitchenInputsService, type KitchenInput } from '../../../../core/services/kitchen-inputs/kitchen-inputs.service';
import { S3UploadService } from '../../../../core/services/upload/s3-upload.service';
import { AudioRecorderService } from '../../../../core/services/audio/audio-recorder.service';
import { AudioService } from '../../../../core/services/audio/audio.service';
import { DynamicFormFieldComponent } from './dynamic-form-field/dynamic-form-field.component';
import { DrawingCanvasComponent } from '../../../../shared/ui/drawing-canvas/drawing-canvas.component';
import { MaterialsTabComponent } from './tabs/materials-tab/materials-tab.component';
import type { KitchenQuoteFormValue, KitchenQuoteFormGroup } from './kitchen-quote-form.types';

@Component({
  selector: 'app-kitchen-quote-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicFormFieldComponent,
    DrawingCanvasComponent,
    MaterialsTabComponent
  ],
  templateUrl: './kitchen-quote-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KitchenQuoteFormComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly quoteService = inject(QuoteService);
  private readonly errorService = inject(HttpErrorService);
  private readonly notificationService = inject(NotificationService);
  private readonly calculationService = inject(KitchenCalculationService);
  private readonly inputsService = inject(KitchenInputsService);
  private readonly s3UploadService = inject(S3UploadService);
  private readonly audioRecorderService = inject(AudioRecorderService);
  private readonly audioService = inject(AudioService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) project!: Project;
  @Input({ required: true }) customer!: Customer;
  @Input({ required: true }) companyId!: string;
  @Input({ required: true }) isSubmitting = false;
  @Input() initialExperience: string | null = null;
  @Input() quoteId: string | null = null;
  @Output() readonly submitQuote = new EventEmitter<KitchenQuoteFormValue>();
  @Output() readonly cancelQuote = new EventEmitter<void>();
  @Output() readonly createClient = new EventEmitter<void>();

  protected readonly activeTab = signal<string>('kitchen-details');
  
  // Referencia al componente de materiales
  @ViewChild(MaterialsTabComponent, { static: false }) protected materialsTabComponent: MaterialsTabComponent | null = null;
  protected readonly selectedKitchenTypeValue = signal<string>('basic');
  protected readonly kitchenSize = signal<'small' | 'medium' | 'large'>('small');
  protected readonly showCostCounter = signal<boolean>(false);

  // Estados de carga de archivos
  protected readonly uploadingCountertopsFiles = signal<Map<string, { file: File; preview: string; progress: number }>>(new Map());
  protected readonly uploadingBacksplashFiles = signal<Map<string, { file: File; preview: string; progress: number }>>(new Map());
  
  // Estado de grabación de audio
  protected readonly isRecording = this.audioRecorderService.isRecording;
  protected readonly isUploadingAudio = signal(false);
  protected readonly isProcessingAudio = signal(false);
  
  // Estado de dibujo
  protected readonly showDrawingCanvas = signal(false);
  protected readonly isUploadingSketch = signal(false);
  
  // Quote original para obtener versionNumber
  private originalQuote: Quote | null = null;

  // Signal para forzar recálculo cuando cambie el formulario
  private readonly formChangeTrigger = signal<number>(0);

  // Inputs agrupados por categoría y ordenados
  protected readonly inputsByCategory = computed(() => {
    const experience = this.getExperienceForCalculation();
    return this.inputsService.getOrderedGroupedInputs(experience);
  });

  // Categorías ordenadas
  protected readonly categories = computed(() => {
    const grouped = this.inputsByCategory();
    return grouped; // Ya es un array ordenado
  });

  // Cálculo del costo total en tiempo real
  protected readonly totalCost = computed(() => {
    // Usar formChangeTrigger para forzar reactividad
    this.formChangeTrigger();
    const experience = this.getExperienceForCalculation();
    const size = this.kitchenSize();
    return this.calculationService.calculateEstimateTotal(this.form, experience, size);
  });

  protected readonly statusOptions = ['draft', 'sent', 'approved', 'rejected', 'in_progress', 'completed'];
  protected readonly sourceOptions = ['website', 'referral', 'social_media', 'advertisement', 'other'];

  protected readonly form: KitchenQuoteFormGroup = this.fb.group({
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
    category: this.fb.control<'kitchen'>('kitchen'),
    source: [null as string | null],
    address: [null as string | null],
    experience: ['basic', [Validators.required]],
    notes: [null as string | null],
    type: ['small' as string | null],
    countertopsFiles: [null as string[] | null],
    backsplashFiles: [null as string[] | null],
    audioNotes: [null as { url: string; transcription?: string; summary?: string } | null],
    sketchFile: [null as string | null],
    materials: [null as Materials | null]
  }) as unknown as KitchenQuoteFormGroup;

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
    // Inicializar experiencia si se proporciona (viene del paso previo)
    const experience = this.initialExperience ?? 'basic';
    // Inicializar size por defecto como 'small'
    const size = 'small';

    this.form.patchValue({
      customer: {
        name: `${this.customer.name} ${this.customer.lastName}`,
        email: this.customer.email ?? null,
        phone: this.customer.phone ?? null
      },
      projectName: this.project.name,
      address: this.customer.address ?? null,
      experience,
      type: size
    });

    // Establecer el tamaño en el signal
    this.kitchenSize.set(size);

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
    // Usar setTimeout para asegurar que el ViewChild esté disponible
    setTimeout(() => {
      this.setupMaterialsSync();
    }, 0);
  }
  
  ngOnDestroy(): void {
    // Cleanup si es necesario
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
   * Genera los campos del formulario dinámicamente desde inputs.json
   */
  private generateDynamicFormFields(inputs: KitchenInput[]): void {
    for (const input of inputs) {
      // Crear el control principal
      let defaultValue: unknown = null;

      if (input.element === 'checkbox') {
        defaultValue = false;
      } else if (input.element === 'numberInput') {
        defaultValue = null;
      } else if (input.element === 'radioButton' || input.element === 'select') {
        defaultValue = null;
      }

      // Si el control ya existe, no lo recreamos
      if (this.form.get(input.name)) {
        continue;
      }

      this.form.addControl(input.name, this.fb.control(defaultValue));

      // Si necesita cantidad (UNIT * PRICE), crear campo de cantidad
      if (
        input.element === 'radioButton' &&
        (input.formula === 'UNIT * PRICE' || input.formula === 'Selection Price/UNIT * PRICE')
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

        // Asegurar que los campos dinámicos estén generados antes de asignar valores
        const inputs = this.inputsService.inputs();
        if (inputs.length > 0) {
          this.generateDynamicFormFields(inputs);
        }

        // Cargar kitchenInformation después de generar los campos
        if (quote.kitchenInformation) {
          // Extraer campos de archivos antes de patchValue
          const countertopsFiles = quote.kitchenInformation['countertopsFiles'] as string[] | undefined;
          const backsplashFiles = quote.kitchenInformation['backsplashFiles'] as string[] | undefined;
          const audioNotes = quote.kitchenInformation['audioNotes'] as { url: string; transcription?: string; summary?: string } | undefined;
          const sketchFile = quote.kitchenInformation['sketchFile'] as string | undefined;

          this.form.patchValue(quote.kitchenInformation as Partial<KitchenQuoteFormValue>, { emitEvent: false });
          
          // Establecer campos de archivos si existen
          if (countertopsFiles) {
            this.form.controls.countertopsFiles.setValue(countertopsFiles, { emitEvent: false });
          }
          if (backsplashFiles) {
            this.form.controls.backsplashFiles.setValue(backsplashFiles, { emitEvent: false });
          }
          if (audioNotes) {
            this.form.controls.audioNotes.setValue(audioNotes, { emitEvent: false });
          }
          if (sketchFile) {
            this.form.controls.sketchFile.setValue(sketchFile, { emitEvent: false });
          }
        }
        
        // Si hay información de tipo (size), establecerlo
        if (quote.kitchenInformation) {
          const type = quote.kitchenInformation['type'] as string | undefined;
          if (type && (type === 'small' || type === 'medium' || type === 'large')) {
            this.kitchenSize.set(type);
            this.form.controls.type.setValue(type, { emitEvent: false });
          }
        }
        
        // Cargar materials si existen (están en el nivel raíz del quote, no en kitchenInformation)
        if (quote.materials) {
          // El backend envía materials como objeto {file?: string, items?: MaterialItem[]}
          const materialsValue = quote.materials as Materials;
          this.form.controls.materials.setValue(materialsValue, { emitEvent: false });
          
          // También establecer en el componente de materiales usando setTimeout para asegurar que esté inicializado
          setTimeout(() => {
            if (this.materialsTabComponent) {
              this.materialsTabComponent.setMaterialsValue(materialsValue);
            }
          }, 0);
        }
        
        // Cargar experience
        if (quote.experience) {
          this.form.controls.experience.setValue(quote.experience, { emitEvent: false });
          this.form.controls.experience.disable({ emitEvent: false });
        }

        // Actualizar el estado del formulario sin disparar valueChanges
        this.form.updateValueAndValidity({ emitEvent: false });

        // Forzar el cálculo del total después de que Angular haya procesado todos los cambios
        // Usar requestAnimationFrame para asegurar que el cálculo ocurra después del render
        requestAnimationFrame(() => {
          this.formChangeTrigger.update(val => val + 1);
          this.showCostCounter.set(true);
        });
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


  protected handleKitchenSizeChange(size: 'small' | 'medium' | 'large'): void {
    this.kitchenSize.set(size);
    this.form.controls.type.setValue(size);
    this.formChangeTrigger.update(val => val + 1);
  }

  protected readonly window = window;
  
  protected getObjectKeys(obj: Record<string, unknown>): string[] {
    return Object.keys(obj);
  }

  protected getSelectedKitchenTypeValue(): string {
    return this.selectedKitchenTypeValue();
  }

  /**
   * Obtiene las opciones de tamaño de cocina
   */
  protected getKitchenSizeOptions(): { label: string; size: 'small' | 'medium' | 'large' }[] {
    return [
      { label: 'Small', size: 'small' },
      { label: 'Medium', size: 'medium' },
      { label: 'Large', size: 'large' }
    ];
  }

  /**
   * Obtiene el experience en su formato original (sin capitalizar) para cálculos
   */
  private getExperienceForCalculation(): string {
    const experience = this.form.controls.experience.value || '';
    return experience.toLowerCase();
  }

  /**
   * Obtiene el experience capitalizado para mostrar en la UI
   */
  protected getCurrentExperience(): string {
    const experience = this.form.controls.experience.value || '';
    return experience.charAt(0).toUpperCase() + experience.slice(1).toLowerCase();
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
    const experience = this.form.controls.experience.disabled
      ? this.form.controls.experience.value
      : formValue.experience;

    // Construir kitchenInformation solo con campos de inputs.json
    const kitchenInformation = this.buildKitchenInformation(formValue);

    // Obtener materials: primero intentar del componente si está disponible, sino del formulario
    let materials: Materials | null = null;
    
    // Forzar sincronización antes de obtener el valor
    if (this.materialsTabComponent) {
      // Obtener el valor directamente del componente (ya está sincronizado por el callback)
      materials = this.materialsTabComponent.getMaterialsValue();
    }
    
    // Si no hay materiales del componente, obtener del formulario
    if (materials === null || materials === undefined) {
      materials = formValue.materials ?? null;
    }

    // Determinar versionNumber: si hay quoteId, sumar 1 al versionNumber del quote original
    const versionNumber = this.quoteId && this.originalQuote
      ? (this.originalQuote.versionNumber ?? 1) + 1
      : 1;

    const quotePayload: QuotePayload & { versionNumber: number } = {
      customerId: this.customer._id,
      companyId: this.companyId,
      projectId: this.project._id,
      category: 'kitchen',
      status: formValue.status as QuotePayload['status'],
      experience: experience || 'basic',
      totalPrice: this.totalCost(),
      notes: formValue.notes ?? undefined,
      userId,
      versionNumber, // Sumar 1 si es nueva versión
      kitchenInformation
    };
    
    // Agregar materials solo si tiene valor
    if (materials !== null && materials !== undefined) {
      quotePayload.materials = materials;
    }

    // Siempre usar createQuote, incluso para nuevas versiones
    this.quoteService
      .createQuote(quotePayload)
      .subscribe({
        next: () => {
          const message = this.quoteId
            ? 'New version created successfully'
            : 'Kitchen estimate created successfully';
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

  /**
   * Obtiene el título de la categoría formateado
   */
  protected getCategoryTitle(category: string): string {
    return category
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Construye el objeto kitchenInformation con solo los campos de inputs.json
   * Excluye campos del formulario base como customer, projectName, status, etc.
   */
  private buildKitchenInformation(formValue: KitchenQuoteFormValue): Record<string, unknown> {
    const inputs = this.inputsService.inputs();
    const kitchenInfo: Record<string, unknown> = {};

    // Campos base del formulario que NO deben ir en kitchenInformation
    const excludedFields = new Set([
      'customer',
      'projectName',
      'status',
      'category',
      'source',
      'address',
      'experience',
      'notes',
      'type',
      'materials' // materials va en el nivel raíz del payload, no en kitchenInformation
    ]);

    // Agregar campos de archivos si existen
    if (formValue['countertopsFiles'] && formValue['countertopsFiles']?.length > 0) {
      kitchenInfo['countertopsFiles'] = formValue['countertopsFiles'];
    }
    if (formValue['backsplashFiles'] && formValue['backsplashFiles']?.length > 0) {
      kitchenInfo['backsplashFiles'] = formValue['backsplashFiles'];
    }
    
    if (formValue['audioNotes']) {
      kitchenInfo['audioNotes'] = formValue['audioNotes'];
    }
    
    if (formValue['sketchFile']) {
      kitchenInfo['sketchFile'] = formValue['sketchFile'];
    }

    // Obtener todos los nombres de campos válidos desde inputs.json
    const validFieldNames = new Set<string>();
    for (const input of inputs) {
      validFieldNames.add(input.name);

      // Si tiene custom, agregar el campo custom
      if (input.custom) {
        validFieldNames.add(`${input.name}Custom`);
      }

      // Si necesita quantity, agregar el campo quantity
      if (
        input.element === 'radioButton' &&
        (input.formula === 'UNIT * PRICE' || input.formula === 'Selection Price/UNIT * PRICE')
      ) {
        validFieldNames.add(`${input.name}Quantity`);
      }
    }

    // Filtrar formValue para incluir solo campos válidos de kitchenInformation
    for (const [key, value] of Object.entries(formValue)) {
      // Excluir campos base del formulario
      if (excludedFields.has(key)) {
        continue;
      }

      // Incluir solo si es un campo válido de inputs.json o un campo relacionado (custom, quantity)
      if (validFieldNames.has(key)) {
        // Reglas de exclusión para el payload:
        // 1. No nulo ni undefined
        if (value === null || value === undefined) continue;
        
        // 2. No string vacío
        if (typeof value === 'string' && value.trim() === '') continue;
        
        // 3. Convertir "Yes"/"No" a booleanos para radio buttons Yes/No
        let processedValue = value;
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          // Verificar si el input tiene selecciones Yes/No
          const input = inputs.find(inp => inp.name === key);
          if (input && input.element === 'radioButton' && input.selections.length === 2) {
            const selections = input.selections.map(s => s.toLowerCase());
            const hasYesNo = selections.includes('yes') && selections.includes('no');
            
            if (hasYesNo) {
              if (lowerValue === 'yes') {
                processedValue = true;
              } else if (lowerValue === 'no') {
                processedValue = false;
              }
            }
          }
        }
        
        // 4. No false (para checkboxes y radio buttons con "No")
        if (processedValue === false) continue;

        // 5. Si es un campo custom (termina en "Custom"), debe ser número
        if (key.endsWith('Custom')) {
          if (typeof processedValue === 'number') {
            kitchenInfo[key] = processedValue;
          } else if (typeof processedValue === 'string') {
            const numValue = parseFloat(processedValue);
            if (!isNaN(numValue)) {
              kitchenInfo[key] = numValue;
            }
          }
          continue;
        }

        // 6. Si el campo tiene custom: true y el valor es "custom", usar el valor custom en su lugar
        const input = inputs.find(inp => inp.name === key);
        if (input?.custom && typeof processedValue === 'string' && processedValue.toLowerCase() === 'custom') {
          const customFieldName = `${key}Custom`;
          const customValue = formValue[customFieldName];
          if (customValue !== null && customValue !== undefined) {
            // Convertir custom value a número si es posible
            if (typeof customValue === 'number') {
              kitchenInfo[key] = customValue;
            } else if (typeof customValue === 'string') {
              const numValue = parseFloat(customValue);
              if (!isNaN(numValue)) {
                kitchenInfo[key] = numValue;
              }
            }
          }
          continue;
        }

        // 7. Si es un string que representa un número puro (sin letras), convertirlo a número
        if (typeof processedValue === 'string') {
          // Verificar si es un número válido (puede tener decimales)
          const numValue = parseFloat(processedValue);
          if (!isNaN(numValue) && isFinite(numValue) && processedValue.trim() === numValue.toString()) {
            kitchenInfo[key] = numValue;
            continue;
          }
        }

        // 8. Si pasa todas las reglas, incluir el valor procesado
        kitchenInfo[key] = processedValue;
      }
    }

    return kitchenInfo;
  }

  /**
   * Maneja la subida de archivos para countertops
   */
  protected async onCountertopsFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const currentFiles = this.form.controls.countertopsFiles.value ?? [];
    const uploadingMap = new Map<string, { file: File; preview: string; progress: number }>();

    // Crear previews y agregar a la lista de carga
    for (const file of fileArray) {
      const fileId = `${Date.now()}-${Math.random()}-${file.name}`;
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      uploadingMap.set(fileId, { file, preview, progress: 0 });
    }

    this.uploadingCountertopsFiles.set(uploadingMap);

    try {
      const uploadedUrls: string[] = [];
      
      // Subir archivos uno por uno para mostrar progreso individual
      for (const [fileId, fileData] of uploadingMap.entries()) {
        try {
          const url = await this.s3UploadService.uploadFile(
            fileData.file,
            (progress) => {
              // Actualizar progreso de este archivo específico
              const updatedMap = new Map(this.uploadingCountertopsFiles());
              const existing = updatedMap.get(fileId);
              if (existing) {
                updatedMap.set(fileId, { ...existing, progress: progress.percentage });
                this.uploadingCountertopsFiles.set(updatedMap);
              }
            }
          );
          uploadedUrls.push(url);
          
          // Limpiar preview URL si es imagen
          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }
          
          // Remover de la lista de carga
          const updatedMap = new Map(this.uploadingCountertopsFiles());
          updatedMap.delete(fileId);
          this.uploadingCountertopsFiles.set(updatedMap);
        } catch (error) {
          console.error('Error uploading file:', fileData.file.name, error);
          // Remover de la lista de carga incluso si falla
          const updatedMap = new Map(this.uploadingCountertopsFiles());
          updatedMap.delete(fileId);
          this.uploadingCountertopsFiles.set(updatedMap);
          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }
        }
      }

      // Actualizar formulario con las URLs subidas
      const updatedFiles = [...currentFiles, ...uploadedUrls];
      this.form.controls.countertopsFiles.setValue(updatedFiles);
      
      // Limpiar el input para permitir seleccionar los mismos archivos de nuevo
      input.value = '';
    } catch (error) {
      console.error('Error uploading countertops files:', error);
      this.notificationService.error('Error', 'No se pudieron subir los archivos de countertops');
      
      // Limpiar todos los previews en caso de error
      for (const fileData of uploadingMap.values()) {
        if (fileData.preview) {
          URL.revokeObjectURL(fileData.preview);
        }
      }
      this.uploadingCountertopsFiles.set(new Map());
    }
  }

  /**
   * Maneja la subida de archivos para backsplash
   */
  protected async onBacksplashFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const currentFiles = this.form.controls.backsplashFiles.value ?? [];
    const uploadingMap = new Map<string, { file: File; preview: string; progress: number }>();

    // Crear previews y agregar a la lista de carga
    for (const file of fileArray) {
      const fileId = `${Date.now()}-${Math.random()}-${file.name}`;
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      uploadingMap.set(fileId, { file, preview, progress: 0 });
    }

    this.uploadingBacksplashFiles.set(uploadingMap);

    try {
      const uploadedUrls: string[] = [];
      
      // Subir archivos uno por uno para mostrar progreso individual
      for (const [fileId, fileData] of uploadingMap.entries()) {
        try {
          const url = await this.s3UploadService.uploadFile(
            fileData.file,
            (progress) => {
              // Actualizar progreso de este archivo específico
              const updatedMap = new Map(this.uploadingBacksplashFiles());
              const existing = updatedMap.get(fileId);
              if (existing) {
                updatedMap.set(fileId, { ...existing, progress: progress.percentage });
                this.uploadingBacksplashFiles.set(updatedMap);
              }
            }
          );
          uploadedUrls.push(url);
          
          // Limpiar preview URL si es imagen
          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }
          
          // Remover de la lista de carga
          const updatedMap = new Map(this.uploadingBacksplashFiles());
          updatedMap.delete(fileId);
          this.uploadingBacksplashFiles.set(updatedMap);
        } catch (error) {
          console.error('Error uploading file:', fileData.file.name, error);
          // Remover de la lista de carga incluso si falla
          const updatedMap = new Map(this.uploadingBacksplashFiles());
          updatedMap.delete(fileId);
          this.uploadingBacksplashFiles.set(updatedMap);
          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }
        }
      }

      // Actualizar formulario con las URLs subidas
      const updatedFiles = [...currentFiles, ...uploadedUrls];
      this.form.controls.backsplashFiles.setValue(updatedFiles);
      
      // Limpiar el input para permitir seleccionar los mismos archivos de nuevo
      input.value = '';
    } catch (error) {
      console.error('Error uploading backsplash files:', error);
      this.notificationService.error('Error', 'No se pudieron subir los archivos de backsplash');
      
      // Limpiar todos los previews en caso de error
      for (const fileData of uploadingMap.values()) {
        if (fileData.preview) {
          URL.revokeObjectURL(fileData.preview);
        }
      }
      this.uploadingBacksplashFiles.set(new Map());
    }
  }

  /**
   * Elimina un archivo de countertops
   */
  protected removeCountertopsFile(index: number): void {
    const currentFiles = this.form.controls.countertopsFiles.value ?? [];
    const updatedFiles = currentFiles.filter((_, i) => i !== index);
    this.form.controls.countertopsFiles.setValue(updatedFiles.length > 0 ? updatedFiles : null);
  }

  /**
   * Elimina un archivo de backsplash
   */
  protected removeBacksplashFile(index: number): void {
    const currentFiles = this.form.controls.backsplashFiles.value ?? [];
    const updatedFiles = currentFiles.filter((_, i) => i !== index);
    this.form.controls.backsplashFiles.setValue(updatedFiles.length > 0 ? updatedFiles : null);
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
    return /\.(mp4|mov|avi|mkv|webm)$/i.test(url);
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
    } catch {
      this.notificationService.error('Error', 'Could not start recording. Please check microphone permissions.');
    }
  }

  private async stopRecording(): Promise<void> {
    try {
      const audioFile = await this.audioRecorderService.stopRecording();
      await this.processAudioFile(audioFile);
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.notificationService.error('Error', 'Error stopping recording');
    }
  }

  private async processAudioFile(file: File): Promise<void> {
    this.isUploadingAudio.set(true);
    this.isProcessingAudio.set(true);

    try {
      // 1. Subir a S3
      const url = await this.s3UploadService.uploadFile(file);
      this.isUploadingAudio.set(false);

      // 2. Procesar con API de audio
      this.notificationService.info('Processing', 'Generating audio summary...');
      
      this.audioService.summarizeAudio(file).subscribe({
        next: (response) => {
          if (response.success) {
            this.form.controls.audioNotes.setValue({
              url,
              transcription: response.data.transcription,
              summary: response.data.summary
            });
            this.notificationService.success('Success', 'Audio processed successfully');
          } else {
            // Si falla el resumen, guardamos solo la URL
            this.form.controls.audioNotes.setValue({ url });
            this.notificationService.info('Warning', 'Audio saved, but summary could not be generated');
          }
          this.isProcessingAudio.set(false);
        },
        error: (error) => {
          console.error('Error summarizing audio:', error);
          // Si falla el resumen, guardamos solo la URL
          this.form.controls.audioNotes.setValue({ url });
          this.notificationService.info('Warning', 'Audio saved, but text processing failed');
          this.isProcessingAudio.set(false);
        }
      });
    } catch (error) {
      console.error('Error uploading audio:', error);
      this.notificationService.error('Error', 'Could not upload audio file');
      this.isUploadingAudio.set(false);
      this.isProcessingAudio.set(false);
    }
  }

  protected deleteAudioNote(): void {
    this.form.controls.audioNotes.setValue(null);
  }

  /**
   * Maneja el guardado del dibujo
   */
  protected async onSketchSaved(dataUrl: string): Promise<void> {
    this.showDrawingCanvas.set(false);
    this.isUploadingSketch.set(true);

    try {
      // Convert base64 to File
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `sketch-${Date.now()}.png`, { type: 'image/png' });

      // Upload to S3
      const url = await this.s3UploadService.uploadFile(file);
      this.form.controls.sketchFile.setValue(url);
      this.notificationService.success('Success', 'Sketch saved successfully');
    } catch (error) {
      console.error('Error saving sketch:', error);
      this.notificationService.error('Error', 'Could not save sketch');
    } finally {
      this.isUploadingSketch.set(false);
    }
  }

  protected deleteSketch(): void {
    this.form.controls.sketchFile.setValue(null);
  }
}
