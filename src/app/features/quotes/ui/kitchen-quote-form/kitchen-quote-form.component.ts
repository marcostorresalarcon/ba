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
  type AfterViewInit,
} from '@angular/core';
import type { FormControl, FormGroup } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { Project } from '../../../../core/models/project.model';
import type { Customer } from '../../../../core/models/customer.model';
import type { Quote, QuotePayload, Materials } from '../../../../core/models/quote.model';
import { QuoteService } from '../../../../core/services/quote/quote.service';
import { HttpErrorService } from '../../../../core/services/error/http-error.service';
import { NotificationService } from '../../../../core/services/notification/notification.service';
import { KitchenCalculationService } from '../../../../core/services/calculation/kitchen-calculation.service';
import {
  KitchenInputsService,
  type KitchenInput,
} from '../../../../core/services/kitchen-inputs/kitchen-inputs.service';
import { S3UploadService } from '../../../../core/services/upload/s3-upload.service';
import { AudioRecorderService } from '../../../../core/services/audio/audio-recorder.service';
import { AudioService } from '../../../../core/services/audio/audio.service';
import { IosMediaService } from '../../../../core/services/ios/ios-media.service';
import { PermissionsService } from '../../../../core/services/permissions/permissions.service';
import { MediaPickerService } from '../../../../core/services/media/media-picker.service';
import { DrawingCanvasService } from '../../../../core/services/drawing-canvas/drawing-canvas.service';
import { LogService } from '../../../../core/services/log/log.service';
import { DynamicFormFieldComponent } from './dynamic-form-field/dynamic-form-field.component';
import { MaterialsTabComponent } from './tabs/materials-tab/materials-tab.component';
import { MediaPreviewModalComponent } from '../../../../shared/ui/media-preview-modal/media-preview-modal.component';
import type { KitchenQuoteFormValue, KitchenQuoteFormGroup } from './kitchen-quote-form.types';

@Component({
  selector: 'app-kitchen-quote-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DynamicFormFieldComponent,
    MaterialsTabComponent,
    MediaPreviewModalComponent,
  ],
  templateUrl: './kitchen-quote-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KitchenQuoteFormComponent implements OnInit, AfterViewInit {
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
  private readonly iosMediaService = inject(IosMediaService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly mediaPickerService = inject(MediaPickerService);
  private readonly drawingCanvasService = inject(DrawingCanvasService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

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
  @ViewChild(MaterialsTabComponent, { static: false })
  protected materialsTabComponent: MaterialsTabComponent | null = null;
  protected readonly selectedKitchenTypeValue = signal<string>('basic');
  protected readonly kitchenSize = signal<'small' | 'medium' | 'large'>('small');
  protected readonly showCostCounter = signal<boolean>(false);

  // Estados de carga de archivos
  protected readonly uploadingCountertopsFiles = signal<
    Map<string, { file: File; preview: string; progress: number }>
  >(new Map());
  protected readonly uploadingBacksplashFiles = signal<
    Map<string, { file: File; preview: string; progress: number }>
  >(new Map());

  // Estado de grabación de audio
  protected readonly isRecording = this.audioRecorderService.isRecording;
  protected readonly isUploadingAudio = signal(false);
  protected readonly isProcessingAudio = signal(false);

  // Estado de dibujo
  protected readonly isUploadingSketch = signal(false);
  protected readonly uploadingAdditionalMedia = signal<
    Map<string, { file: File; preview: string; progress: number }>
  >(new Map());

  // Estado de previsualización de media
  protected readonly previewMediaUrl = signal<string | null>(null);

  // Quote original para obtener versionNumber
  private originalQuote: Quote | null = null;

  // Flag para controlar si ya se cargaron los datos guardados
  private hasLoadedSavedData = false;

  // Estados para la sección de estimación
  protected readonly showBudgetDetails = signal<boolean>(false);
  protected readonly showSummary = signal<boolean>(false);

  // Estados para la vista de destinatarios y pantalla de confirmación
  protected readonly showRecipientsView = signal<boolean>(false);
  protected readonly showConfirmationScreen = signal<boolean>(false);
  protected readonly selectedRecipients = signal<string[]>([]);
  protected readonly submittedQuote = signal<Quote | null>(null);

  // Verificar que el formulario esté listo
  protected get isFormReady(): boolean {
    return !!(this.form && this.form.controls.roughQuote && this.form.controls.clientBudget);
  }

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

  protected readonly statusOptions = [
    'draft',
    'sent',
    'approved',
    'rejected',
    'in_progress',
    'completed',
  ];
  protected readonly sourceOptions = [
    'website',
    'referral',
    'social_media',
    'advertisement',
    'other',
  ];

  protected readonly form: KitchenQuoteFormGroup = this.fb.group({
    customer: this.fb.group({
      name: ['', [Validators.required]],
      email: [null as string | null],
      phone: [null as string | null],
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
    audioNotes: [null as { url: string; transcription?: string; summary?: string }[] | null],
    sketchFiles: [null as string[] | null],
    additionalComments: this.fb.group({
      comment: [null as string | null],
      mediaFiles: [null as string[] | null],
    }) as FormGroup<{
      comment: FormControl<string | null>;
      mediaFiles: FormControl<string[] | null>;
    }>,
    materials: [null as Materials | null],
    roughQuote: [null as number | null],
    clientBudget: [null as number | null],
  }) as unknown as KitchenQuoteFormGroup;

  constructor() {
    // Efecto para generar campos dinámicos cuando se carguen los inputs
    effect(() => {
      const inputs = this.inputsService.inputs();
      if (inputs.length > 0) {
        this.generateDynamicFormFields(inputs);

        // Cargar datos guardados después de generar los campos dinámicos
        // Cargar siempre desde localStorage primero para preservar sketches nuevos
        if (!this.hasLoadedSavedData) {
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
    // Inicializar experiencia si se proporciona (viene del paso previo)
    const experience = this.initialExperience ?? 'basic';
    // Inicializar size por defecto como 'small'
    const size = 'small';

    this.form.patchValue({
      customer: {
        name: `${this.customer.name} ${this.customer.lastName}`,
        email: this.customer.email ?? null,
        phone: this.customer.phone ?? null,
      },
      projectName: this.project.name,
      address: this.customer.address ?? null,
      experience,
      type: size,
    });

    // Establecer el tamaño en el signal
    this.kitchenSize.set(size);

    // Nota: Los datos guardados se cargan en el effect() después de generar los campos dinámicos
    // para asegurar que todos los campos estén disponibles antes de restaurar valores

    // Si hay un quoteId, cargar los datos del quote para crear una nueva versión
    // Esperar a que los datos guardados se hayan cargado primero (en el effect)
    if (this.quoteId) {
      // Usar setTimeout para asegurar que loadSavedFormData se ejecute primero
      setTimeout(() => {
        if (this.quoteId) {
          this.loadQuoteForEdit(this.quoteId);
        }
      }, 100);
    }

    // Suscribirse a los cambios del formulario para recalcular el costo en tiempo real y guardar
    this.form.valueChanges
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formChangeTrigger.update((val) => val + 1);
        // Guardar automáticamente en localStorage
        this.saveFormData();
      });

    // También escuchar cambios en statusChanges
    this.form.statusChanges
      .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formChangeTrigger.update((val) => val + 1);
      });

    // Forzar un cálculo inicial
    this.formChangeTrigger.update((val) => val + 1);

    // Escuchar eventos de navegación para procesar resultados del canvas cuando se regresa
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        const navEnd = event as NavigationEnd;
        console.log('[KitchenQuote] NavigationEnd - URL:', navEnd.url);
        console.log('[KitchenQuote] NavigationEnd - Verificando resultado pendiente');

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
    console.log('[KitchenQuote] processPendingCanvasResult - Verificando resultado pendiente');
    const hasPending = this.drawingCanvasService.hasPendingResult();
    console.log('[KitchenQuote] processPendingCanvasResult - hasPendingResult:', hasPending);

    if (hasPending) {
      const resultStr = sessionStorage.getItem('drawingCanvasResult');
      console.log('[KitchenQuote] processPendingCanvasResult - resultStr existe:', !!resultStr);

      if (resultStr) {
        const result = JSON.parse(resultStr);
        console.log('[KitchenQuote] processPendingCanvasResult - result.action:', result.action);
        console.log('[KitchenQuote] processPendingCanvasResult - result.dataUrl existe:', !!result.dataUrl);

        if (result.action === 'save' && result.dataUrl) {
          // Limpiar el resultado ANTES de procesarlo para evitar procesamiento duplicado
          console.log('[KitchenQuote] processPendingCanvasResult - Limpiando sessionStorage antes de procesar');
          sessionStorage.removeItem('drawingCanvasResult');
          sessionStorage.removeItem('drawingCanvasCallback');

          // Si hay un resultado de guardado, procesarlo directamente
          console.log('[KitchenQuote] processPendingCanvasResult - Llamando a onSketchSaved');
          void this.onSketchSaved(result.dataUrl).then(() => {
            // Restaurar scroll después de procesar el sketch
            this.restoreScrollPosition();
          });
        } else {
          // Para otros casos, usar el servicio
          console.log('[KitchenQuote] processPendingCanvasResult - Usando servicio processResult');
          void this.drawingCanvasService.processResult();
        }
      } else {
        console.log('[KitchenQuote] processPendingCanvasResult - No hay resultStr, usando servicio');
        void this.drawingCanvasService.processResult();
      }
    } else {
      console.log('[KitchenQuote] processPendingCanvasResult - No hay resultado pendiente');
      // Aún así restaurar scroll si no hay resultado pendiente
      this.restoreScrollPosition();
    }
  }

  /**
   * Restaura la posición de scroll guardada
   */
  private restoreScrollPosition(): void {
    const scrollYStr = sessionStorage.getItem('drawingCanvasScrollY');
    console.log('[KitchenQuote] restoreScrollPosition - scrollYStr:', scrollYStr);

    if (!scrollYStr) {
      console.log('[KitchenQuote] restoreScrollPosition - No hay scrollY guardado');
      return;
    }

    const scrollY = parseInt(scrollYStr, 10);
    console.log('[KitchenQuote] restoreScrollPosition - scrollY parseado:', scrollY);
    console.log('[KitchenQuote] restoreScrollPosition - scrollY actual de window:', window.scrollY);

    // Esperar a que el DOM esté completamente renderizado antes de restaurar el scroll
    setTimeout(() => {
      console.log('[KitchenQuote] restoreScrollPosition - Intentando restaurar scroll a:', scrollY);
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'smooth' });
        console.log('[KitchenQuote] restoreScrollPosition - Primer scrollTo ejecutado, scrollY actual:', window.scrollY);

        // Segundo intento después de un pequeño delay para asegurar que funcione
        setTimeout(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: scrollY, behavior: 'smooth' });
            console.log('[KitchenQuote] restoreScrollPosition - Segundo scrollTo ejecutado, scrollY actual:', window.scrollY);
            // Limpiar el scrollY solo después de restaurarlo exitosamente
            sessionStorage.removeItem('drawingCanvasScrollY');
            console.log('[KitchenQuote] restoreScrollPosition - scrollY eliminado de sessionStorage');
          });
        }, 200);
      });
    }, 500);
  }

  ngAfterViewInit(): void {
    // Configurar callback para sincronizar materiales con el formulario
    // Usar setTimeout para asegurar que el ViewChild esté disponible
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
        // Para installCanLight, upgradePanel y smoothCeilings, inicializar con "none" por defecto
        if (input.name === 'installCanLight' || input.name === 'upgradePanel' || input.name === 'smoothCeilings') {
          defaultValue = 'none';
        } else {
          defaultValue = null;
        }
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
          // Crear el control deshabilitado por defecto (se habilitará cuando sea "yes" o "4\""/"6\"")
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
    this.showCostCounter.update((val) => !val);
  }

  private loadQuoteForEdit(quoteId: string): void {
    this.quoteService.getQuote(quoteId).subscribe({
      next: (quote) => {
        // Guardar el quote original
        this.originalQuote = quote;

        // Asegurar que los campos dinámicos estén generados ANTES de asignar valores
        const inputs = this.inputsService.inputs();
        if (inputs.length > 0) {
          this.generateDynamicFormFields(inputs);
        }

        // Crear mapa de inputs para acceso rápido
        const inputsMap = new Map(inputs.map((inp) => [inp.name, inp]));

        // Cargar kitchenInformation
        if (quote.kitchenInformation) {
          const kitchenInfo = quote.kitchenInformation as Record<string, unknown>;

          // Cargar cada campo dinámico
          Object.keys(kitchenInfo).forEach((key) => {
            // Excluir campos especiales que se manejan por separado
            // ceilingHeight, wallCabinetHeight y stackers se manejan específicamente después
            const excludedFields = [
              'countertopsFiles',
              'backsplashFiles',
              'audioNotes',
              'sketchFiles',
              'sketchFile',
              'additionalComments',
              'type',
              'source',
              'address',
              'wallCabinetHeight',
              'stackers',
            ];
            if (
              excludedFields.includes(key) ||
              key.endsWith('Custom') ||
              key.endsWith('Quantity')
            ) {
              return;
            }

            const control = this.form.get(key);
            if (!control) {
              return;
            }

            const input = inputsMap.get(key);
            const value = kitchenInfo[key];

            // Convertir valores según el tipo de campo
            if (input) {
              if (input.element === 'checkbox') {
                // Checkboxes: convertir a boolean
                control.setValue(Boolean(value), { emitEvent: true });
              } else if (input.element === 'radioButton') {
                // Radio buttons: convertir según el tipo
                if (typeof value === 'boolean') {
                  control.setValue(value ? 'Yes' : 'No', { emitEvent: false });
                } else if (typeof value === 'number') {
                  // Convertir número a string para que coincida con las selecciones
                  const stringValue = String(value);

                  // Primero buscar coincidencia exacta
                  let matchingSelection = input.selections.find((sel) => sel === stringValue);

                  // Si no hay coincidencia exacta, buscar por número extraído (para casos como "8 INCH" vs 8)
                  if (!matchingSelection) {
                    matchingSelection = input.selections.find((sel) => {
                      // Extraer el número de la selección (puede ser "8" o "8 INCH", etc.)
                      const selNum = sel.replace(/\D/g, '');
                      return selNum === stringValue;
                    });
                  }

                  if (matchingSelection) {
                    // Establecer el valor - usar emitEvent: true para que los componentes se actualicen
                    control.setValue(matchingSelection, { emitEvent: true });
                  } else if (input.custom) {
                    // Si no está en las selecciones y tiene custom, puede ser un valor custom
                    const customValue = kitchenInfo[`${key}Custom`] as number | undefined;
                    if (customValue !== undefined) {
                      control.setValue('custom', { emitEvent: true });
                      const customControl = this.form.get(`${key}Custom`);
                      if (customControl) {
                        customControl.setValue(customValue, { emitEvent: true });
                      }
                    } else {
                      // Si no hay custom, usar el valor como string de todas formas
                      // Esto maneja casos como stackers que puede tener valores adicionales como "none" o "18"
                      control.setValue(stringValue, { emitEvent: true });
                    }
                  } else {
                    // Si no tiene custom y no coincide, usar el valor como string
                    control.setValue(stringValue, { emitEvent: true });
                  }
                } else {
                  // Strings y otros tipos: usar directamente
                  // Esto incluye valores como "none" para stackers
                  control.setValue(value, { emitEvent: true });
                }
              } else {
                // Otros tipos (numberInput, select, etc.): usar el valor directamente
                control.setValue(value, { emitEvent: true });
              }
            } else {
              // Si no hay input definido, usar el valor directamente
              control.setValue(value, { emitEvent: true });
            }
          });

          // Manejo específico para ceilingHeight, wallCabinetHeight y stackers
          // Estos campos se manejan en kitchen-details-tab con radio buttons personalizados
          // Ahora que los radio buttons tienen el name correcto, podemos asignar directamente por el nombre del campo
          const heightFields = ['ceilingHeight', 'wallCabinetHeight', 'stackers'] as const;
          heightFields.forEach((field) => {
            const fieldValue = kitchenInfo[field];
            const control = this.form.get(field);

            if (control && fieldValue !== undefined && fieldValue !== null) {
              if (typeof fieldValue === 'number') {
                // Convertir número a string y asignar directamente
                const stringValue = String(fieldValue);
                control.setValue(stringValue, { emitEvent: true });

                // Si hay valor custom, también cargarlo
                const customValue = kitchenInfo[`${field}Custom`] as number | undefined;
                if (customValue !== undefined) {
                  const customControl = this.form.get(`${field}Custom`);
                  if (customControl) {
                    customControl.setValue(customValue, { emitEvent: true });
                  }
                  // Si hay customValue, el valor principal debería ser 'custom'
                  control.setValue('custom', { emitEvent: true });
                }
              } else if (typeof fieldValue === 'string') {
                // Si ya es string, usar directamente
                control.setValue(fieldValue, { emitEvent: true });

                // Si es 'custom', cargar el valor custom si existe
                if (fieldValue === 'custom' || fieldValue === 'Custom') {
                  const customValue = kitchenInfo[`${field}Custom`] as number | undefined;
                  if (customValue !== undefined) {
                    const customControl = this.form.get(`${field}Custom`);
                    if (customControl) {
                      customControl.setValue(customValue, { emitEvent: true });
                    }
                  }
                }
              }
            }
          });

          // Cargar campos de archivos
          const countertopsFiles = kitchenInfo['countertopsFiles'] as string[] | undefined;
          const backsplashFiles = kitchenInfo['backsplashFiles'] as string[] | undefined;
          const audioNotes = kitchenInfo['audioNotes'] as
            | { url: string; transcription?: string; summary?: string }[]
            | { url: string; transcription?: string; summary?: string }
            | undefined;
          const sketchFiles = kitchenInfo['sketchFiles'] as string[] | undefined;
          const sketchFile = kitchenInfo['sketchFile'] as string | undefined;
          const additionalComments = kitchenInfo['additionalComments'] as
            | { comment?: string | null; mediaFiles?: string[] | null }
            | undefined;

          if (countertopsFiles) {
            this.form.controls.countertopsFiles.setValue(countertopsFiles, { emitEvent: true });
          }
          if (backsplashFiles) {
            this.form.controls.backsplashFiles.setValue(backsplashFiles, { emitEvent: true });
          }
          if (audioNotes) {
            // Convertir a array si viene como objeto único (compatibilidad hacia atrás)
            const audioArray = Array.isArray(audioNotes)
              ? audioNotes
              : [audioNotes];
            // Ordenar de más reciente a más antiguo manteniendo el orden original del backend
            this.form.controls.audioNotes.setValue([...audioArray].reverse(), { emitEvent: true });
          }
          // Hacer merge de sketchFiles: combinar los existentes con los del quote (sin duplicados)
          const existingSketches = this.form.controls.sketchFiles.value ?? [];
          let quoteSketches: string[] = [];

          if (sketchFiles && sketchFiles.length > 0) {
            quoteSketches = sketchFiles;
          } else if (sketchFile) {
            quoteSketches = [sketchFile];
          }

          // Combinar ambos arrays sin duplicados
          const mergedSketches = [...new Set([...existingSketches, ...quoteSketches])];
          console.log('[KitchenQuote] loadQuoteForEdit - Merging sketches');
          console.log('[KitchenQuote] loadQuoteForEdit - Existing sketches:', existingSketches);
          console.log('[KitchenQuote] loadQuoteForEdit - Quote sketches:', quoteSketches);
          console.log('[KitchenQuote] loadQuoteForEdit - Merged sketches:', mergedSketches);

          if (mergedSketches.length > 0) {
            this.form.controls.sketchFiles.setValue(mergedSketches, { emitEvent: true });
          }
          if (additionalComments) {
            this.form.controls.additionalComments.patchValue(additionalComments, {
              emitEvent: true,
            });
          } else {
            this.form.controls.additionalComments.patchValue(
              { comment: null, mediaFiles: null },
              { emitEvent: true }
            );
          }

          // Cargar tipo (size)
          const type = kitchenInfo['type'] as string | undefined;
          if (type && ['small', 'medium', 'large'].includes(type)) {
            this.kitchenSize.set(type as 'small' | 'medium' | 'large');
            this.form.controls.type.setValue(type, { emitEvent: true });
          }
        }

        // Cargar materials
        if (quote.materials) {
          const materialsValue = quote.materials as Materials;
          this.form.controls.materials.setValue(materialsValue, { emitEvent: true });
          if (this.materialsTabComponent) {
            this.materialsTabComponent.setMaterialsValue(materialsValue);
          }
        }

        // Cargar campos base
        if (quote.experience) {
          this.form.controls.experience.setValue(quote.experience, { emitEvent: true });
          this.form.controls.experience.disable({ emitEvent: false });
        }
        if (quote.status) {
          this.form.controls.status.setValue(quote.status, { emitEvent: true });
        }
        if (quote.notes !== undefined) {
          this.form.controls.notes.setValue(quote.notes ?? null, { emitEvent: true });
        }
        const source = quote.kitchenInformation?.['source'] as string | undefined;
        if (source) {
          this.form.controls.source.setValue(source, { emitEvent: true });
        }
        const address = quote.kitchenInformation?.['address'] as string | undefined;
        if (address) {
          this.form.controls.address.setValue(address, { emitEvent: true });
        }

        // Cargar campos de budget
        const roughQuote = quote.kitchenInformation?.['roughQuote'] as number | undefined;
        if (roughQuote !== undefined) {
          this.form.controls.roughQuote.setValue(roughQuote, { emitEvent: true });
        }
        const clientBudget = quote.kitchenInformation?.['clientBudget'] as number | undefined;
        if (clientBudget !== undefined) {
          this.form.controls.clientBudget.setValue(clientBudget, { emitEvent: true });
        }

        // Actualizar formulario y calcular total
        // Usar setTimeout para asegurar que todos los cambios se hayan propagado
        setTimeout(() => {
          this.form.updateValueAndValidity({ emitEvent: false });
          this.formChangeTrigger.update((val) => val + 1);
          this.showCostCounter.set(true);
        }, 0);
      },
      error: (error) => {
        const message = this.errorService.handle(error);
        this.notificationService.error('Error', `Could not load estimate: ${message}`);
      },
    });
  }

  protected setActiveTab(tab: string): void {
    this.activeTab.set(tab);
  }

  protected handleKitchenSizeChange(size: 'small' | 'medium' | 'large'): void {
    this.kitchenSize.set(size);
    this.form.controls.type.setValue(size);
    this.formChangeTrigger.update((val) => val + 1);
  }

  protected readonly window = window;

  protected getObjectKeys(obj: Record<string, unknown>): string[] {
    return Object.keys(obj);
  }

  /**
   * Verifica si se debe mostrar el título de la subcategoría
   * No se muestra si todos los inputs tienen el mismo label que el título de la subcategoría
   */
  protected shouldShowSubcategoryTitle(subcategoryGroup: {
    title: string;
    inputs: { label: string }[];
  }): boolean {
    if (!subcategoryGroup.title || subcategoryGroup.inputs.length === 0) {
      return false;
    }

    // Normalizar el título (case insensitive, sin espacios extra)
    const normalizedTitle = subcategoryGroup.title.trim().toLowerCase();

    // Verificar si todos los inputs tienen el mismo label que el título
    const allLabelsMatch = subcategoryGroup.inputs.every((input) => {
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
  protected shouldShowCategoryTitle(categoryGroup: {
    title: string;
    subcategories: { inputs: { label: string }[] }[];
  }): boolean {
    if (!categoryGroup.title || categoryGroup.subcategories.length === 0) {
      return true; // Siempre mostrar si no hay subcategorías
    }

    // Normalizar el título de la categoría
    const normalizedCategoryTitle = categoryGroup.title.trim().toLowerCase();

    // Obtener todos los inputs de todas las subcategorías
    const allInputs = categoryGroup.subcategories.flatMap((sub) => sub.inputs);

    if (allInputs.length === 0) {
      return true;
    }

    // Verificar si todos los inputs tienen el mismo label que el título de la categoría
    const allLabelsMatch = allInputs.every((input) => {
      const normalizedLabel = input.label.trim().toLowerCase();
      return normalizedLabel === normalizedCategoryTitle;
    });

    // Si todos los labels coinciden con el título de la categoría, no mostrar el título
    return !allLabelsMatch;
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
      { label: 'Large', size: 'large' },
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

    // Mostrar resumen antes de enviar
    if (!this.showSummary()) {
      this.showSummary.set(true);
      return;
    }

    // Si ya se mostró el resumen, llamar al método real de envío
    this.actuallySubmit();
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

    // Calcular versionNumber
    // Si hay originalQuote, crear una nueva versión (versionNumber + 1)
    // Si no hay, es un nuevo quote (versionNumber = 1)
    let versionNumber = 1;
    if (this.originalQuote && this.originalQuote.versionNumber) {
      versionNumber = this.originalQuote.versionNumber + 1;
    }

    const quotePayload: QuotePayload = {
      customerId: this.customer._id,
      companyId: this.companyId,
      projectId: this.project._id,
      category: 'kitchen',
      status: formValue.status as QuotePayload['status'],
      experience: experience || 'basic',
      totalPrice: this.totalCost(),
      notes: formValue.notes ?? undefined,
      userId,
      versionNumber,
      kitchenInformation,
    };

    // Agregar materials solo si tiene valor
    if (materials !== null && materials !== undefined) {
      quotePayload.materials = materials;
    }

    // Nota: Los destinatarios se manejarán en una petición separada o en el backend
    // después de crear el quote. Por ahora, no se envían en el payload del quote.

    // Siempre usar createQuote, incluso para nuevas versiones
    this.quoteService.createQuote(quotePayload).subscribe({
      next: (quote) => {
        // Limpiar datos guardados después de enviar exitosamente
        this.clearSavedFormData();

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
        // Volver a la vista de recipients en caso de error (no al resumen)
        this.showRecipientsView.set(true);
      },
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
      .replace(/^./, (str) => str.toUpperCase())
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
      'materials', // materials va en el nivel raíz del payload, no en kitchenInformation
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

    if (formValue['sketchFiles'] && formValue['sketchFiles']?.length > 0) {
      kitchenInfo['sketchFiles'] = formValue['sketchFiles'];
    }

    if (formValue['additionalComments']) {
      kitchenInfo['additionalComments'] = formValue['additionalComments'];
    }

    // Agregar campos de budget
    if (formValue['roughQuote'] !== null && formValue['roughQuote'] !== undefined) {
      kitchenInfo['roughQuote'] = formValue['roughQuote'];
    }
    if (formValue['clientBudget'] !== null && formValue['clientBudget'] !== undefined) {
      kitchenInfo['clientBudget'] = formValue['clientBudget'];
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
          const input = inputs.find((inp) => inp.name === key);
          if (input && input.element === 'radioButton' && input.selections.length === 2) {
            const selections = input.selections.map((s) => s.toLowerCase());
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

        // 5. Si es un campo Quantity, verificar que el campo principal no sea "none"
        if (key.endsWith('Quantity')) {
          const baseFieldName = key.replace('Quantity', '');
          const baseFieldValue = formValue[baseFieldName];
          // Si el campo base es "none", no incluir la cantidad
          if (typeof baseFieldValue === 'string' && baseFieldValue.toLowerCase() === 'none') {
            continue;
          }
          // Si tiene valor numérico, incluirlo
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

        // 6. Si es un campo custom (termina en "Custom"), debe ser número
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

        // 7. Si el campo tiene custom: true y el valor es "custom", usar el valor custom en su lugar
        const input = inputs.find((inp) => inp.name === key);
        if (
          input?.custom &&
          typeof processedValue === 'string' &&
          processedValue.toLowerCase() === 'custom'
        ) {
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

        // 8. Para campos radioButton con valores numéricos como strings ("8", "9", "10"),
        // convertirlos a números si el backend los espera como números
        // Esto es para campos como ceilingHeight que vienen del backend como números
        if (input?.element === 'radioButton' && typeof processedValue === 'string') {
          // Si el valor es un número puro (ej: "8", "9", "10"), convertirlo a número
          const numValue = parseFloat(processedValue);
          if (
            !isNaN(numValue) &&
            processedValue.trim() === numValue.toString() &&
            !input.selections.some((s) => s.toLowerCase() === 'yes' || s.toLowerCase() === 'no')
          ) {
            // Solo convertir si no es Yes/No y es un número puro
            kitchenInfo[key] = numValue;
            continue;
          }
        }

        // 9. Si es un string que representa un número puro (sin letras), convertirlo a número
        if (typeof processedValue === 'string') {
          // Verificar si es un número válido (puede tener decimales)
          const numValue = parseFloat(processedValue);
          if (
            !isNaN(numValue) &&
            isFinite(numValue) &&
            processedValue.trim() === numValue.toString()
          ) {
            kitchenInfo[key] = numValue;
            continue;
          }
        }

        // 10. Si pasa todas las reglas, incluir el valor procesado
        kitchenInfo[key] = processedValue;
      }
    }

    return kitchenInfo;
  }

  /**
   * Handles selection and upload of images for countertops
   */
  protected async onCountertopsImagesSelected(): Promise<void> {
    try {
      const hasPermission = await this.permissionsService.requestMediaPermissions();
      if (!hasPermission) {
        this.notificationService.error(
          'Permissions Required',
          'Camera and photo library access is needed to select images. Please enable permissions in your device settings.'
        );
        return;
      }

      const files = await this.mediaPickerService.pickImages(true);
      if (files.length === 0) return;

      void this.processCountertopsFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not select images');
      await this.logService.logError('Error selecting countertops images', error, {
        severity: 'medium',
        description: 'Error selecting countertops images in kitchen form',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'onCountertopsImagesSelected',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles selection and upload of videos for countertops
   */
  protected async onCountertopsVideosSelected(): Promise<void> {
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

      void this.processCountertopsFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not select videos');
      await this.logService.logError('Error selecting countertops videos', error, {
        severity: 'medium',
        description: 'Error selecting countertops videos in kitchen form',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'onCountertopsVideosSelected',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles selection and upload of files for countertops
   */
  protected async onCountertopsFilesSelected(): Promise<void> {
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

      void this.processCountertopsFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not select files');
      await this.logService.logError('Error selecting countertops files', error, {
        severity: 'medium',
        description: 'Error selecting countertops files in kitchen form',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'onCountertopsFilesSelected',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Procesa los archivos seleccionados para countertops
   */
  private async processCountertopsFiles(fileArray: File[]): Promise<void> {
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
          // Procesar archivo para iOS (comprimir imágenes, convertir formatos)
          const processedFile = await this.iosMediaService.processMediaFile(fileData.file);

          const url = await this.s3UploadService.uploadFile(processedFile, (progress) => {
            // Actualizar progreso de este archivo específico
            const updatedMap = new Map(this.uploadingCountertopsFiles());
            const existing = updatedMap.get(fileId);
            if (existing) {
              updatedMap.set(fileId, { ...existing, progress: progress.percentage });
              this.uploadingCountertopsFiles.set(updatedMap);
            }
          });
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
          // Remover de la lista de carga incluso si falla
          const updatedMap = new Map(this.uploadingCountertopsFiles());
          updatedMap.delete(fileId);
          this.uploadingCountertopsFiles.set(updatedMap);
          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }

          // Registrar error en logs
          await this.logService.logError('Error al subir archivo de countertops', error, {
            severity: 'high',
            description: `Error al subir archivo de countertops: ${fileData.file.name}`,
            source: 'kitchen-quote-form',
            metadata: {
              component: 'KitchenQuoteFormComponent',
              action: 'processCountertopsFiles',
              fileName: fileData.file.name,
              fileSize: fileData.file.size,
              fileType: fileData.file.type,
              projectId: this.project._id,
              customerId: this.customer._id,
            },
          });
        }
      }

      // Actualizar formulario con las URLs subidas
      const updatedFiles = [...currentFiles, ...uploadedUrls];
      this.form.controls.countertopsFiles.setValue(updatedFiles);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.notificationService.error(
        'Error',
        `No se pudieron subir los archivos de countertops: ${errorMsg}`
      );

      // Limpiar todos los previews en caso de error
      for (const fileData of uploadingMap.values()) {
        if (fileData.preview) {
          URL.revokeObjectURL(fileData.preview);
        }
      }
      this.uploadingCountertopsFiles.set(new Map());

      // Registrar error en logs
      await this.logService.logError('Error general al procesar archivos de countertops', error, {
        severity: 'high',
        description: 'Error general al procesar y subir archivos de countertops',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'processCountertopsFiles',
          filesCount: fileArray.length,
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles selection and upload of images for backsplash
   */
  protected async onBacksplashImagesSelected(): Promise<void> {
    try {
      const hasPermission = await this.permissionsService.requestMediaPermissions();
      if (!hasPermission) {
        this.notificationService.error(
          'Permissions Required',
          'Camera and photo library access is needed to select images. Please enable permissions in your device settings.'
        );
        return;
      }

      const files = await this.mediaPickerService.pickImages(true);
      if (files.length === 0) return;

      void this.processBacksplashFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not select images');
      await this.logService.logError('Error selecting backsplash images', error, {
        severity: 'medium',
        description: 'Error selecting backsplash images in kitchen form',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'onBacksplashImagesSelected',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles selection and upload of videos for backsplash
   */
  protected async onBacksplashVideosSelected(): Promise<void> {
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

      void this.processBacksplashFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not select videos');
      await this.logService.logError('Error selecting backsplash videos', error, {
        severity: 'medium',
        description: 'Error selecting backsplash videos in kitchen form',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'onBacksplashVideosSelected',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles selection and upload of files for backsplash
   */
  protected async onBacksplashFilesSelected(): Promise<void> {
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

      void this.processBacksplashFiles(files);
    } catch (error) {
      this.notificationService.error('Error', 'Could not select files');
      await this.logService.logError('Error selecting backsplash files', error, {
        severity: 'medium',
        description: 'Error selecting backsplash files in kitchen form',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'onBacksplashFilesSelected',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Procesa los archivos seleccionados para backsplash
   */
  private async processBacksplashFiles(fileArray: File[]): Promise<void> {
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
          // Procesar archivo para iOS (comprimir imágenes, convertir formatos)
          const processedFile = await this.iosMediaService.processMediaFile(fileData.file);

          const url = await this.s3UploadService.uploadFile(processedFile, (progress) => {
            // Actualizar progreso de este archivo específico
            const updatedMap = new Map(this.uploadingBacksplashFiles());
            const existing = updatedMap.get(fileId);
            if (existing) {
              updatedMap.set(fileId, { ...existing, progress: progress.percentage });
              this.uploadingBacksplashFiles.set(updatedMap);
            }
          });
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
          // Remover de la lista de carga incluso si falla
          const updatedMap = new Map(this.uploadingBacksplashFiles());
          updatedMap.delete(fileId);
          this.uploadingBacksplashFiles.set(updatedMap);
          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }

          // Registrar error en logs
          await this.logService.logError('Error al subir archivo de backsplash', error, {
            severity: 'high',
            description: `Error al subir archivo de backsplash: ${fileData.file.name}`,
            source: 'kitchen-quote-form',
            metadata: {
              component: 'KitchenQuoteFormComponent',
              action: 'processBacksplashFiles',
              fileName: fileData.file.name,
              fileSize: fileData.file.size,
              fileType: fileData.file.type,
              projectId: this.project._id,
              customerId: this.customer._id,
            },
          });
        }
      }

      // Actualizar formulario con las URLs subidas
      const updatedFiles = [...currentFiles, ...uploadedUrls];
      this.form.controls.backsplashFiles.setValue(updatedFiles);
    } catch (error) {
      this.notificationService.error('Error', 'No se pudieron subir los archivos de backsplash');

      // Registrar error en logs
      await this.logService.logError('Error general al procesar archivos de backsplash', error, {
        severity: 'high',
        description: 'Error general al procesar y subir archivos de backsplash',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'processBacksplashFiles',
          filesCount: fileArray.length,
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });

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
    return /\.(mp4|mov|avi|mkv|webm|heic)$/i.test(url);
  }

  /**
   * Crea un thumbnail de un video para mostrar como preview
   * Si falla, retorna string vacío para mostrar el icono de video por defecto
   */
  private async createVideoThumbnail(file: File): Promise<string> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const videoUrl = URL.createObjectURL(file);

      if (!ctx) {
        URL.revokeObjectURL(videoUrl);
        resolve(''); // Retornar string vacío para mostrar icono por defecto
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
        resolve(''); // Timeout: retornar string vacío
      }, 5000); // Timeout de 5 segundos

      video.onloadedmetadata = () => {
        try {
          // Configurar canvas con dimensiones del video (máximo 320x240 para thumbnails)
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

          // Capturar frame en el primer segundo o a la mitad si es muy corto
          const seekTime = video.duration > 1 ? 1 : video.duration / 2;
          video.currentTime = Math.max(0.1, seekTime);
        } catch (error) {
          clearTimeout(timeout);
          cleanup();
          resolve(''); // Retornar string vacío en caso de error
        }
      };

      video.onseeked = () => {
        try {
          clearTimeout(timeout);

          // Dibujar frame en canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Convertir a blob y crear URL
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const thumbnailUrl = URL.createObjectURL(blob);
                cleanup();
                resolve(thumbnailUrl);
              } else {
                cleanup();
                resolve(''); // Retornar string vacío si no se puede crear el blob
              }
            },
            'image/jpeg',
            0.8
          );
        } catch (error) {
          clearTimeout(timeout);
          cleanup();
          resolve(''); // Retornar string vacío en caso de error
        }
      };

      video.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        resolve(''); // Retornar string vacío si hay error al cargar el video
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.notificationService.error(
        'Error',
        'Could not start recording. Please check microphone permissions.'
      );

      // Registrar error en logs
      await this.logService.logError('Error al iniciar grabación de audio', error, {
        severity: 'medium',
        description: 'Error al intentar iniciar la grabación de audio en el formulario de kitchen',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
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

      // Registrar error en logs
      await this.logService.logError('Error al detener grabación de audio', error, {
        severity: 'medium',
        description: 'Error al intentar detener la grabación de audio en el formulario de kitchen',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
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
      // 1. Subir a S3
      const url = await this.s3UploadService.uploadFile(file);
      this.isUploadingAudio.set(false);

      // 2. Procesar con API de audio
      this.notificationService.info('Processing', 'Generating audio summary...');

      this.audioService.summarizeAudio(file).subscribe({
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

            // Registrar advertencia en logs
            void this.logService.logNotification('Audio guardado pero resumen no generado', {
              description: 'El audio se subió correctamente pero no se pudo generar el resumen',
              source: 'kitchen-quote-form',
              metadata: {
                component: 'KitchenQuoteFormComponent',
                action: 'processAudioFile',
                audioUrl: url,
                projectId: this.project._id,
                customerId: this.customer._id,
              },
            });
          }
          this.isProcessingAudio.set(false);
        },
        error: (error) => {
          // Si falla el resumen, guardamos solo la URL (más reciente primero)
          const currentAudios = this.form.controls.audioNotes.value || [];
          this.form.controls.audioNotes.setValue([{ url }, ...currentAudios], { emitEvent: true });
          this.notificationService.info('Warning', 'Audio saved, but text processing failed');
          this.isProcessingAudio.set(false);

          // Registrar error en logs
          void this.logService.logError('Error al procesar audio con API', error, {
            severity: 'medium',
            description:
              'Error al procesar el audio con la API de resumen, pero el archivo se guardó correctamente',
            source: 'kitchen-quote-form',
            metadata: {
              component: 'KitchenQuoteFormComponent',
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

      // Registrar error en logs
      await this.logService.logError('Error al subir archivo de audio', error, {
        severity: 'high',
        description: 'Error al subir el archivo de audio a S3',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
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
   * Abre el modal de dibujo
   */
  protected openDrawingCanvas(event?: Event): void {
    console.log('[KitchenQuote] openDrawingCanvas - Iniciando');
    const currentSketches = this.form.controls.sketchFiles.value ?? [];
    console.log('[KitchenQuote] openDrawingCanvas - Sketches actuales:', currentSketches.length, currentSketches);

    // Obtener la URL actual para regresar después
    const currentUrl = this.router.url;
    console.log('[KitchenQuote] openDrawingCanvas - URL actual:', currentUrl);

    // Abrir el canvas navegando a la nueva página
    this.drawingCanvasService.openCanvas(currentUrl, (dataUrl) => this.onSketchSaved(dataUrl));
  }

  /**
   * Maneja el guardado del dibujo (múltiples dibujos)
   */
  protected async onSketchSaved(dataUrl: string): Promise<void> {
    console.log('[KitchenQuote] onSketchSaved - Iniciando guardado de sketch');
    console.log('[KitchenQuote] onSketchSaved - dataUrl recibido:', dataUrl.substring(0, 50) + '...');

    this.isUploadingSketch.set(true);

    try {
      // Convert base64 to File
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      let file = new File([blob], `sketch-${Date.now()}.png`, { type: 'image/png' });
      console.log('[KitchenQuote] onSketchSaved - Archivo creado:', file.name, file.size, 'bytes');

      // Procesar para iOS si es necesario
      file = await this.iosMediaService.processMediaFile(file);
      console.log('[KitchenQuote] onSketchSaved - Archivo procesado:', file.name, file.size, 'bytes');

      // Upload to S3
      console.log('[KitchenQuote] onSketchSaved - Subiendo a S3...');
      const url = await this.s3UploadService.uploadFile(file);
      console.log('[KitchenQuote] onSketchSaved - URL obtenida de S3:', url);

      // Agregar a la lista de dibujos (múltiples)
      // Asegurarse de que no se duplique si ya existe
      const currentSketches = this.form.controls.sketchFiles.value ?? [];
      console.log('[KitchenQuote] onSketchSaved - Sketches actuales ANTES de agregar:', currentSketches.length, currentSketches);
      console.log('[KitchenQuote] onSketchSaved - URL ya existe?', currentSketches.includes(url));

      if (!currentSketches.includes(url)) {
        const newSketches = [...currentSketches, url];
        console.log('[KitchenQuote] onSketchSaved - Nuevos sketches:', newSketches.length, newSketches);
        this.form.controls.sketchFiles.setValue(newSketches, { emitEvent: true });

        // Verificar inmediatamente después de setValue
        const afterSetValue = this.form.controls.sketchFiles.value ?? [];
        console.log('[KitchenQuote] onSketchSaved - Sketches DESPUÉS de setValue:', afterSetValue.length, afterSetValue);

        // Forzar detección de cambios para mostrar el sketch inmediatamente
        this.cdr.markForCheck();

        // Guardar el estado del formulario después de agregar el sketch
        // Usar setTimeout para asegurar que el cambio se haya propagado completamente
        setTimeout(() => {
          const beforeSave = this.form.controls.sketchFiles.value ?? [];
          console.log('[KitchenQuote] onSketchSaved - Sketches ANTES de saveFormData:', beforeSave.length, beforeSave);
          this.saveFormData();

          // Verificar después de guardar
          const afterSave = this.form.controls.sketchFiles.value ?? [];
          console.log('[KitchenQuote] onSketchSaved - Sketches DESPUÉS de saveFormData:', afterSave.length, afterSave);

          // Forzar otra vez la detección de cambios después de guardar
          this.cdr.markForCheck();
        }, 100);
      } else {
        console.warn('[KitchenQuote] onSketchSaved - URL ya existe, no se agregará:', url);
      }

      this.notificationService.success('Success', 'Sketch saved successfully');
    } catch (error) {
      this.notificationService.error('Error', 'Could not save sketch');

      // Registrar error en logs
      await this.logService.logError('Error al guardar sketch', error, {
        severity: 'high',
        description: 'Error al subir el sketch (dibujo) a S3',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'onSketchSaved',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    } finally {
      this.isUploadingSketch.set(false);
    }
  }

  protected deleteSketch(index: number): void {
    const currentSketches = this.form.controls.sketchFiles.value ?? [];
    const updatedSketches = currentSketches.filter((_, i) => i !== index);
    this.form.controls.sketchFiles.setValue(updatedSketches.length > 0 ? updatedSketches : null);
  }

  /**
   * Handles selection and upload of images for additional comments
   */
  protected async onAdditionalImagesSelected(): Promise<void> {
    try {
      const hasPermission = await this.permissionsService.requestMediaPermissions();
      if (!hasPermission) {
        this.notificationService.error(
          'Permissions Required',
          'Camera and photo library access is needed to select images. Please enable permissions in your device settings.'
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
        description: 'Error selecting additional images in kitchen form',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'onAdditionalImagesSelected',
          projectId: this.project._id,
          customerId: this.customer._id,
        },
      });
    }
  }

  /**
   * Handles selection and upload of videos for additional comments
   */
  protected async onAdditionalVideosSelected(): Promise<void> {
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
        description: 'Error selecting additional videos in kitchen form',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
          action: 'onAdditionalVideosSelected',
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
        description: 'Error selecting additional files in kitchen form',
        source: 'kitchen-quote-form',
        metadata: {
          component: 'KitchenQuoteFormComponent',
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

    // Crear previews y agregar a la lista de carga
    for (const file of fileArray) {
      const fileId = `${Date.now()}-${Math.random()}-${file.name}`;
      // Crear preview para imágenes y videos
      let preview = '';
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        // Para videos, crear un thumbnail usando un elemento video
        preview = await this.createVideoThumbnail(file);
      }
      uploadingMap.set(fileId, { file, preview, progress: 0 });
    }

    this.uploadingAdditionalMedia.set(uploadingMap);

    try {
      const uploadedUrls: string[] = [];

      // Subir archivos uno por uno para mostrar progreso individual
      for (const [fileId, fileData] of uploadingMap.entries()) {
        try {
          // Procesar archivo para iOS (comprimir imágenes, comprimir videos, convertir formatos)
          let processedFile: File;
          try {
            processedFile = await this.iosMediaService.processMediaFile(fileData.file);
          } catch (compressionError) {
            const errorMsg =
              compressionError instanceof Error
                ? compressionError.message
                : String(compressionError);

            // Si es un error de formato o tamaño, mostrar mensaje claro al usuario
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

            // Registrar error en logs
            await this.logService.logError(
              'Error al procesar archivo multimedia',
              compressionError,
              {
                severity: 'medium',
                description: `Error al procesar archivo: ${fileData.file.name}`,
                source: 'kitchen-quote-form',
                metadata: {
                  component: 'KitchenQuoteFormComponent',
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

            // Continuar con el siguiente archivo
            continue;
          }

          const url = await this.s3UploadService.uploadFile(processedFile, (progress) => {
            // Actualizar progreso de este archivo específico
            const updatedMap = new Map(this.uploadingAdditionalMedia());
            const existing = updatedMap.get(fileId);
            if (existing) {
              updatedMap.set(fileId, { ...existing, progress: progress.percentage });
              this.uploadingAdditionalMedia.set(updatedMap);
            }
          });
          uploadedUrls.push(url);

          // Limpiar preview URL
          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }

          // Remover de la lista de carga
          const updatedMap = new Map(this.uploadingAdditionalMedia());
          updatedMap.delete(fileId);
          this.uploadingAdditionalMedia.set(updatedMap);
        } catch (error) {
          // Remover de la lista de carga incluso si falla
          const updatedMap = new Map(this.uploadingAdditionalMedia());
          updatedMap.delete(fileId);
          this.uploadingAdditionalMedia.set(updatedMap);
          if (fileData.preview) {
            URL.revokeObjectURL(fileData.preview);
          }

          // Mostrar mensaje de error claro al usuario
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

          // Registrar error en logs
          await this.logService.logError('Error al subir archivo de medios adicionales', error, {
            severity: 'high',
            description: `Error al subir archivo de medios adicionales: ${fileData.file.name}`,
            source: 'kitchen-quote-form',
            metadata: {
              component: 'KitchenQuoteFormComponent',
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

      // Actualizar formulario con las URLs subidas
      const updatedFiles = [...currentFiles, ...uploadedUrls];
      const currentComment = currentComments?.comment ?? null;
      this.form.controls.additionalComments.setValue({
        comment: currentComment,
        mediaFiles: updatedFiles,
      });

      // Limpiar el input para permitir seleccionar los mismos archivos de nuevo
    } catch (error) {
      this.notificationService.error('Error', 'No se pudieron subir los archivos');

      // Registrar error en logs
      await this.logService.logError(
        'Error general al procesar archivos de medios adicionales',
        error,
        {
          severity: 'high',
          description: 'Error general al procesar y subir archivos de medios adicionales',
          source: 'kitchen-quote-form',
          metadata: {
            component: 'KitchenQuoteFormComponent',
            action: 'processAdditionalMediaFiles',
            filesCount: fileArray.length,
            projectId: this.project._id,
            customerId: this.customer._id,
          },
        }
      );

      // Limpiar todos los previews en caso de error
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
   * Abre el modal de previsualización de media
   */
  protected openMediaPreview(url: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.previewMediaUrl.set(url);
  }

  /**
   * Cierra el modal de previsualización
   */
  protected closeMediaPreview(): void {
    this.previewMediaUrl.set(null);
  }

  /**
   * Toggle para mostrar/ocultar detalles del budget
   */
  protected toggleBudgetDetails(): void {
    this.showBudgetDetails.update((val) => !val);
  }

  /**
   * Cierra el resumen y permite editar
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
    const countertops = this.form.controls.countertopsFiles.value?.length ?? 0;
    const backsplash = this.form.controls.backsplashFiles.value?.length ?? 0;
    const additional = this.form.controls.additionalComments.value?.mediaFiles?.length ?? 0;
    return countertops > 0 || backsplash > 0 || additional > 0;
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

  /**
   * Convierte un valor a número para usar en el pipe number
   */
  protected toNumber(value: number | null | undefined): number {
    return value ?? 0;
  }

  /**
   * Obtiene las opciones de locationKitchen desde inputs.json
   */
  protected getLocationKitchenOptions(): { value: string; label: string }[] {
    const inputs = this.inputsService.inputs();
    const locationInputs = inputs.filter((input) => input.category === 'locationKitchen');

    return locationInputs.map((input) => ({
      value: input.name,
      label: input.label,
    }));
  }

  /**
   * Selecciona/deselecciona una opción de locationKitchen
   */
  protected selectLocationKitchen(location: string): void {
    const control = this.form.get(location) as FormControl<boolean | null>;
    if (control) {
      control.setValue(!control.value);
    }
  }

  /**
   * Genera una clave única para guardar el estado del formulario
   */
  private getFormStorageKey(): string {
    const parts = [
      'kitchen-quote-form',
      this.project._id,
      this.customer._id,
      this.companyId,
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
      console.log('[KitchenQuote] saveFormData - Guardando formulario');
      console.log('[KitchenQuote] saveFormData - sketchFiles en formValue:', sketchFiles.length, sketchFiles);
      console.log('[KitchenQuote] saveFormData - storageKey:', storageKey);

      localStorage.setItem(storageKey, JSON.stringify(formValue));

      // Verificar que se guardó correctamente
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedValue = JSON.parse(saved);
        const savedSketches = savedValue.sketchFiles ?? [];
        console.log('[KitchenQuote] saveFormData - Verificación: sketchFiles guardados:', savedSketches.length, savedSketches);
      } else {
        console.error('[KitchenQuote] saveFormData - ERROR: No se pudo guardar en localStorage');
      }
    } catch (error) {
      console.error('[KitchenQuote] saveFormData - Error saving form data:', error);
    }
  }

  /**
   * Carga el estado del formulario desde localStorage
   */
  private loadSavedFormData(): void {
    try {
      const storageKey = this.getFormStorageKey();
      console.log('[KitchenQuote] loadSavedFormData - storageKey:', storageKey);
      const savedData = localStorage.getItem(storageKey);
      console.log('[KitchenQuote] loadSavedFormData - savedData existe:', !!savedData);

      if (savedData) {
        const formValue = JSON.parse(savedData);
        const savedSketches = formValue.sketchFiles ?? [];
        console.log('[KitchenQuote] loadSavedFormData - sketchFiles en datos guardados:', savedSketches.length, savedSketches);

        // Restaurar valores del formulario, pero mantener los valores iniciales si no hay guardados
        this.form.patchValue(formValue, { emitEvent: false });

        // Verificar después de patchValue
        const afterPatch = this.form.controls.sketchFiles.value ?? [];
        console.log('[KitchenQuote] loadSavedFormData - sketchFiles DESPUÉS de patchValue:', afterPatch.length, afterPatch);

        // Restaurar signals si es necesario
        if (formValue.type) {
          this.kitchenSize.set(formValue.type as 'small' | 'medium' | 'large');
        }
        if (formValue.experience) {
          this.selectedKitchenTypeValue.set(formValue.experience);
        }

        // Actualizar trigger para recalcular el costo total
        this.formChangeTrigger.update((val) => val + 1);

        // Forzar detección de cambios para actualizar la UI
        this.cdr.markForCheck();
      } else {
        console.log('[KitchenQuote] loadSavedFormData - No hay datos guardados');
      }
    } catch (error) {
      console.error('[KitchenQuote] loadSavedFormData - Error loading saved form data:', error);
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
   * Verifica si una opción de locationKitchen está seleccionada
   */
  protected isLocationKitchenSelected(location: string): boolean {
    const control = this.form.get(location) as FormControl<boolean | null>;
    return control?.value === true;
  }
}
