import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { EstimateStateService } from '../../../../services/estimate-state.service';
import { IBreadcrumb } from '../../../../interfaces/breadcrumb.interface';
import { ICountertopsFile, IMediaItem, IDrawing, IEstimate, IKitchenInformation } from '../../interfaces/estimate.interface';
import { AudioProcessingService } from '../../../../services/audio-processing.service';
import { QuoteService } from '../../../../services/quote.service';
import { ConfirmationService } from '../../../../services/confirmation.service';
import { UploadService } from '../../../../services/upload.service';
import { NotificationService } from '../../../../services/notification.service';
import { LoaderService } from '../../../../services/loader.service';
import { UserStateService } from '../../../../services/user-state.service';
import { CompanyStateService } from '../../../../services/company-state.service';
import { finalize } from 'rxjs/operators';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { VoiceRecorder, RecordingData } from 'capacitor-voice-recorder';
import { CalculationService } from './services/calculation.service';
import { RadioComponent } from '../../../../components/radio/radio.component';
import { DrawingCanvasComponent } from '../../../../components/drawing-canvas/drawing-canvas.component';
import { DrawingControlsComponent } from '../../../../components/drawing-controls/drawing-controls.component';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputNumberModule } from 'primeng/inputnumber';

type PdfFile = { name: string; size: string; url?: string };

@Component({
  selector: 'app-form',
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DrawingCanvasComponent,
    DrawingControlsComponent,
    ButtonModule,
    ProgressSpinnerModule,
    InputNumberModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export default class FormComponent implements OnInit, OnDestroy {
  @ViewChild('drawingCanvas') drawingCanvasComponent!: DrawingCanvasComponent;

  public estimateState = inject(EstimateStateService);

  // Subject para debounce de saveEstimate
  private readonly saveEstimateSubject = new Subject<void>();
  private readonly destroy$ = new Subject<void>();
  private saveEstimateTimeoutId: number | null = null;
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly formBuilder = inject(FormBuilder);
  private readonly audioProcessingService = inject(AudioProcessingService);
  private readonly quoteService = inject(QuoteService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly uploadService = inject(UploadService);
  private readonly notificationService = inject(NotificationService);
  public loaderService = inject(LoaderService);
  public loading$ = this.loaderService.loading$;
  private readonly userStateService = inject(UserStateService);
  private readonly companyStateService = inject(CompanyStateService);
  private readonly calculationService = inject(CalculationService);
  typeKitchenService = signal<string>('small');

  // Opciones para botones de tipo de cocina
  kitchenTypeOptions: Array<{ label: string; value: 'small' | 'medium' | 'large' }> = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
  ];

  // Control de loader para subidas
  private activeUploads = 0;
  private beginUpload(): void {
    if (this.activeUploads === 0) {
      this.loaderService.show();
    }
    this.activeUploads++;
  }
  private endUpload(): void {
    this.activeUploads = Math.max(0, this.activeUploads - 1);
    if (this.activeUploads === 0) {
      this.loaderService.hide();
    }
  }

  // Voice recording properties
  isRecording = signal<boolean>(false);
  isVoiceSupported = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  summaryText = signal<string>('');

  // Audio playback properties
  public audioPlayer: HTMLAudioElement | null = null;
  public currentRecording: Blob | null = null;
  public recordingDuration = signal<number>(0);
  public recordingSize = signal<number>(0);
  public recordingProgress = signal<number>(0);
  public playbackSpeed = signal<number>(1);
  public transcriptionText = signal<string>('');
  public isTranscribing = signal<boolean>(false);
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
  public hasRecording = signal<boolean>(false);
  private audioObjectUrl: string | null = null;
  private readonly onAudioTimeUpdate = () => {
    if (!this.audioPlayer || !Number.isFinite(this.audioPlayer.duration)) { return; }
    const percent =
      (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
    this.recordingProgress.set(Math.max(0, Math.min(100, percent)));
  };
  private readonly onAudioEnded = () => {
    this.recordingProgress.set(100);
  };

  public pdfFiles = signal<PdfFile[]>([
    { name: 'Document 1', size: '2.5 MB' },
    { name: 'Document 2', size: '1.8 MB' },
    { name: 'Document 3', size: '3.2 MB' },
  ]);

  public estimateResult = signal<string>('');
  public showEstimate = signal<boolean>(false);

  // Drawing properties
  public isDrawingMode = signal<boolean>(false);
  public drawingCanvas: HTMLCanvasElement | null = null;
  public drawingContext: CanvasRenderingContext2D | null = null;
  public currentTool = signal<string>('pen');
  public brushSize = signal<number>(2);
  public brushColor = signal<string>('#000000');
  public isDrawing = signal<boolean>(false);
  public lastX = 0;
  public lastY = 0;
  public drawingHistory: ImageData[] = [];
  public currentHistoryIndex = -1;

  // Apple Pencil specific properties
  public applePencilSupported = signal<boolean>(false);
  public currentPressure = signal<number>(1);
  public currentTilt = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  public isApplePencilConnected = signal<boolean>(false);
  public isUploadingDrawing = signal<boolean>(false);

  // Advanced Drawing Component properties
  public showAdvancedDrawing = signal<boolean>(false);
  public advancedDrawingData = signal<string>('');

  // Drawing viewer modal properties
  public showDrawingViewer = signal<boolean>(false);
  public selectedDrawing = signal<IDrawing | null>(null);

  breadcrumb = signal<IBreadcrumb[]>([
    { name: 'Admin', link: '/admin' },
    { name: 'Estimates', link: '/admin/estimates' },
    { name: 'Form', link: '/admin/estimates/form' },
  ]);

  locationKitchenOptions = [
    { value: 'mainFloor', label: 'Main Floor' },
    { value: 'upstairs', label: 'Upstairs' },
    { value: 'basement', label: 'Basement' },
  ];

  subFloorOptions = [
    { value: 'basementFinished', label: 'Basement FINISHED' },
    { value: 'basementUnfinished', label: 'Basement UNFINISHED' },
  ];

  demolitionOptions = [
    { value: 'kitchenSmall', label: 'Kitchen Small' },
    { value: 'kitchenMedium', label: 'Kitchen Medium' },
    { value: 'kitchenLarge', label: 'Kitchen Large' },
    {
      value: 'eliminateDrywallPantryLoadBearing',
      label: 'Eliminate drywall pantry (load bearing)',
    },
    {
      value: 'eliminateDrywallPantryNonLoadBearing',
      label: 'Eliminate drywall pantry (non load bearing)',
    },
  ];

  form!: FormGroup;
  estimate!: IEstimate;

  // Countertops files management
  private readonly countertopsFiles: ICountertopsFile[] = [];
  selectedFiles: File[] = [];
  private uploadPreviewUrl: string | null = null;

  constructor() {
    this.initForm();
  }

  ngOnInit() {
    this.initEstimate();
    this.getEstimate(); // Get estimate after initialization
    void this.checkVoiceSupport();
    this.checkApplePencilSupport();
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    // Guardar el formulario ante cualquier interacción del usuario con debounce
    this.form.valueChanges
      .pipe(
        debounceTime(300), // Esperar 300ms después del último cambio
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.debouncedSaveEstimate();
      });

    // Setup debounce para saveEstimate directo
    this.saveEstimateSubject
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.performSaveEstimate();
      });

    // Verificar permisos periódicamente
    this.setupPermissionMonitoring();

    // Sincronizar estado de cantidad de can lights según selección
    this.form.get('canLightSize')?.valueChanges.subscribe(() => {
      this.updateCanLightQuantityState();
    });
    this.updateCanLightQuantityState();

    // Sincronizar estado de widePocketDoorsQuantity según selección
    this.form.get('widePocketDoors')?.valueChanges.subscribe(() => {
      this.updateWidePocketDoorsQuantityState();
    });
    this.updateWidePocketDoorsQuantityState();

    // Selección por defecto de demolition según type al iniciar
    const startType = this.getSelectedKitchenType();
    this.form.get('demolition')?.setValue(this.mapTypeToDemolition(startType));
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    this.selectCountertopTemplateFee(this.mapTypeToCountertopTemplateFee(startType));
    this.selectStoneBacksplashTemplateFee(this.mapTypeToStoneBacksplashTemplateFee(startType));

    // Selección automática de Installation y Trim Work según type
    this.updateInstallationAndTrimWork(startType);

    // Configurar deshabilitación dinámica de campos Yes/No
    this.setupYesNoFieldDisabling();

    // Sincronizar controles custom de altura con sus controles principales
    this.setupCustomHeightSync();
  }

  /**
   * Obtiene la estimación actual desde el estado y la asigna si existe.
   * Si no existe, lanza un error controlado para mantener la integridad del estado.
   */
  getEstimate(): void {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    const estimate = this.estimateState.getEstimate();
    if (!estimate) {
      // Manejo de error centralizado o feedback visual para el usuario
      // Aquí podrías lanzar un error, mostrar un mensaje o redirigir
      throw new Error(
        'No se encontró la estimación actual. Por favor, verifique el estado.'
      );
    }
    // Loading estimate data into form
    this.form.patchValue(estimate);
    this.estimate = estimate;
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    // Actualizar estados de controles custom después de cargar los datos
    this.updateCustomHeightStates();

    // Actualizar estados de controles condicionales después de cargar los datos
    this.updateWidePocketDoorsQuantityState();
  }

  // ... existing code ...

  private checkApplePencilSupport(): void {
    // Verificar si el dispositivo soporta Pointer Events y características del Apple Pencil
    if ('PointerEvent' in window) {
      // Verificar si es un dispositivo iOS/iPadOS
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS) {
        // Detectar todas las capacidades disponibles
        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
        const capabilities = this.detectDeviceCapabilities();

        // Device capabilities detected

        // Verificar soporte de características avanzadas del Apple Pencil
        const hasAdvancedFeatures =
          capabilities.supportsPressure ||
          capabilities.supportsTilt ||
          capabilities.supportsTwist ||
          capabilities.supportsTangentialPressure;

        if (hasAdvancedFeatures) {
          this.applePencilSupported.set(true);
          // Apple Pencil support detected with capabilities
        } else {
          // Apple Pencil detected but no advanced features supported
        }
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      } else {
        // Verificar soporte en otros dispositivos
        const hasPressureSupport =
          'pressure' in new PointerEvent('pointerdown');
        const hasTiltSupport = 'tiltX' in new PointerEvent('pointerdown');

        /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
        if (hasPressureSupport || hasTiltSupport) {
          this.applePencilSupported.set(true);
          // Pressure/tilt support detected on non-iOS device
        }
      }
    } else {
      // Pointer Events not supported
    }
  }

  activateApplePencil(): void {
    try {
      if (!this.applePencilSupported()) {
        this.showUnsupportedDeviceMessage();
        return;
      }

      // Verificar si el dispositivo está listo para dibujar
      const deviceCapabilities = this.detectDeviceCapabilities();

      if (
        !deviceCapabilities.supportsTouch &&
        !deviceCapabilities.supportsPressure
      ) {
        this.showErrorMessage('This device does not support drawing input');
        return;
      }

      // Inicializar modo de dibujo
      this.initializeDrawingMode();
    } catch (error) {
      console.error('Error activating drawing mode:', error);
      this.showErrorMessage(
        'Failed to activate drawing mode. Please try again.'
      );
    }
  }

  private initializeDrawingMode(): void {
    this.isDrawingMode.set(true);
    this.createDrawingCanvas();
    this.setupEnhancedPointerEvents();
    this.showDrawingInterface();
  }

  private createDrawingCanvas(): void {
    // Crear canvas si no existe
    if (!this.drawingCanvas) {
      this.drawingCanvas = document.createElement('canvas');

      // Configurar tamaño del canvas (responsive)
      const containerWidth = Math.min(800, window.innerWidth - 40);
      const containerHeight = Math.min(600, window.innerHeight - 200);

      this.drawingCanvas.width = containerWidth;
      this.drawingCanvas.height = containerHeight;
      this.drawingCanvas.className = 'drawing-canvas';

      this.drawingContext = this.drawingCanvas.getContext('2d');

      if (this.drawingContext) {
        // Configuración inicial del contexto
        this.drawingContext.strokeStyle = this.brushColor();
        this.drawingContext.lineWidth = this.brushSize();
        this.drawingContext.lineCap = 'round';
        this.drawingContext.lineJoin = 'round';
        this.drawingContext.imageSmoothingEnabled = true;
        this.drawingContext.imageSmoothingQuality = 'high';

        // Configurar fondo bl
        this.drawingContext.fillStyle = 'white';
        this.drawingContext.fillRect(0, 0, containerWidth, containerHeight);
      }
    }

    // Configurar el canvas para mejor rendimiento y prevenir scroll
    if (this.drawingCanvas) {
      this.drawingCanvas.style.touchAction = 'none';
      this.drawingCanvas.style.userSelect = 'none';
      this.drawingCanvas.style.webkitUserSelect = 'none';
      this.drawingCanvas.style.cursor = 'crosshair';

      // Prevenir scroll en iOS
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      (this.drawingCanvas.style as any).webkitOverflowScrolling = 'touch';
      this.drawingCanvas.style.overscrollBehavior = 'none';

      // Agregar atributos para iOS
      this.drawingCanvas.setAttribute('data-ios-scroll', 'false');

      // Asegurar que el canvas tenga el tamaño correcto en CSS
      this.drawingCanvas.style.width = '100%';
      this.drawingCanvas.style.height = 'auto';
      this.drawingCanvas.style.maxWidth = '800px';
      this.drawingCanvas.style.maxHeight = '600px';
    }
  }

  private setupEnhancedPointerEvents(): void {
    if (!this.drawingCanvas) {
      return;
    }

    // Configurar eventos de puntero mejorados con prevención de scroll
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
    this.drawingCanvas.addEventListener(
      'pointerdown',
      this.handleEnhancedPointerDown,
      { passive: false }
    );
    this.drawingCanvas.addEventListener(
      'pointermove',
      this.handleEnhancedPointerMove,
      { passive: false }
    );
    this.drawingCanvas.addEventListener(
      'pointerup',
      this.handleEnhancedPointerUp,
      { passive: false }
    );
    this.drawingCanvas.addEventListener(
      'pointercancel',
      this.handleEnhancedPointerCancel,
      { passive: false }
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */

    // Eventos específicos del Apple Pencil
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method
    this.drawingCanvas.addEventListener(
      'pointerenter',
      this.handlePointerEnter,
      { passive: false }
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method
    this.drawingCanvas.addEventListener(
      'pointerleave',
      this.handlePointerLeave,
      { passive: false }
    );

    // Prevenir scroll en dispositivos táctiles
    this.drawingCanvas.addEventListener(
      'touchstart',
      (e) => e.preventDefault(),
      { passive: false }
    );
    this.drawingCanvas.addEventListener(
      'touchmove',
      (e) => e.preventDefault(),
      { passive: false }
    );
    this.drawingCanvas.addEventListener('touchend', (e) => e.preventDefault(), {
      passive: false,
    });
  }

  private readonly handleEnhancedPointerDown = (event: PointerEvent): void => {
    event.preventDefault();

    if (event.pointerType === 'pen') {
      // Es un Apple Pencil o stylus
      this.handleApplePencilDown(event);
    } else if (event.pointerType === 'touch') {
      // Es un toque normal
      this.handleTouchDown(event);
    } else if (event.pointerType === 'mouse') {
      // Es un mouse
      this.handleMouseDown(event);
    }
  };

  private handleApplePencilDown(event: PointerEvent): void {
    this.isDrawing.set(true);

    // Obtener coordenadas relativas al canvas
    if (!this.drawingCanvas) {
      return;
    }
    const rect = this.drawingCanvas.getBoundingClientRect();
    this.lastX = event.clientX - rect.left;
    this.lastY = event.clientY - rect.top;

    // Aplicar presión del Apple Pencil (0.0 a 1.0)
    if (event.pressure !== undefined) {
      this.currentPressure.set(event.pressure);
      this.applyPressure(event.pressure);
    }

    // Aplicar tilt si está disponible (-90 a 90 grados)
    if ('tiltX' in event && 'tiltY' in event) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const pointerEvent = event as any;
      this.currentTilt.set({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        x: pointerEvent.tiltX || 0,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        y: pointerEvent.tiltY || 0,
      });
    }

    // Aplicar twist si está disponible (0 a 359 grados)
    if ('twist' in event) {
      // Twist detected - available for advanced stylus features
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const pointerEvent = event as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (pointerEvent.twist !== undefined) {
        // Handle twist if needed
      }
    }

    // Aplicar tangential pressure si está disponible (-1.0 a 1.0)
    if ('tangentialPressure' in event) {
      // Tangential pressure detected - available for advanced stylus features
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const pointerEvent = event as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (pointerEvent.tangentialPressure !== undefined) {
        // Handle tangential pressure if needed
      }
    }

    // Guardar en historial
    this.saveToHistory();
  }

  private handleTouchDown(event: PointerEvent): void {
    // Manejo básico para toques (sin presión)
    this.isDrawing.set(true);

    // Obtener coordenadas relativas al canvas
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rect = this.drawingCanvas!.getBoundingClientRect();
    this.lastX = event.clientX - rect.left;
    this.lastY = event.clientY - rect.top;

    this.currentPressure.set(1); // Presión constante para toques
    this.saveToHistory();
  }

  private handleMouseDown(event: PointerEvent): void {
    // Manejo para mouse
    this.isDrawing.set(true);

    // Obtener coordenadas relativas al canvas
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rect = this.drawingCanvas!.getBoundingClientRect();
    this.lastX = event.clientX - rect.left;
    this.lastY = event.clientY - rect.top;

    this.currentPressure.set(1);
    this.saveToHistory();
  }

  private readonly handleEnhancedPointerMove = (event: PointerEvent): void => {
    event.preventDefault();

    if (!this.isDrawing()) {
      return;
    }

    if (event.pointerType === 'pen') {
      this.handleApplePencilMove(event);
    } else if (event.pointerType === 'touch') {
      this.handleTouchMove(event);
    } else if (event.pointerType === 'mouse') {
      this.handleMouseMove(event);
    }
  };

  private handleApplePencilMove(event: PointerEvent): void {
    if (!this.drawingContext || !this.drawingCanvas) {
      return;
    }

    // Obtener coordenadas relativas al canvas
    const rect = this.drawingCanvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    // Aplicar presión en tiempo real
    if (event.pressure !== undefined) {
      this.currentPressure.set(event.pressure);
      this.applyPressure(event.pressure);
    }

    // Aplicar tilt en tiempo real
    if ('tiltX' in event && 'tiltY' in event) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const pointerEvent = event as any;
      this.currentTilt.set({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        x: pointerEvent.tiltX || 0,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        y: pointerEvent.tiltY || 0,
      });
    }

    // Dibujar línea con presión y coordenadas correctas
    this.drawLine(this.lastX, this.lastY, currentX, currentY);

    this.lastX = currentX;
    this.lastY = currentY;
  }

  private handleTouchMove(event: PointerEvent): void {
    if (!this.drawingContext || !this.drawingCanvas) {
      return;
    }

    // Obtener coordenadas relativas al canvas
    const rect = this.drawingCanvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    // Dibujar línea simple para toques
    this.drawLine(this.lastX, this.lastY, currentX, currentY);

    this.lastX = currentX;
    this.lastY = currentY;
  }

  private handleMouseMove(event: PointerEvent): void {
    if (!this.drawingContext || !this.drawingCanvas) {
      return;
    }

    // Obtener coordenadas relativas al canvas
    const rect = this.drawingCanvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    // Dibujar línea simple para mouse
    this.drawLine(this.lastX, this.lastY, currentX, currentY);

    this.lastX = currentX;
    this.lastY = currentY;
  }

  private readonly handleEnhancedPointerUp = (_event: PointerEvent): void => {
    _event.preventDefault();
    this.isDrawing.set(false);

    if (_event.pointerType === 'pen') {
      this.handleApplePencilUp(_event);
    }
  };

  private handleApplePencilUp(_event: PointerEvent): void {
    // Finalizar trazo del Apple Pencil
    this.isDrawing.set(false);

    // Resetear presión
    this.currentPressure.set(1);

    // Guardar en historio
    this.saveToHistory();
  }

  private readonly handleEnhancedPointerCancel = (_event: PointerEvent): void => {
    _event.preventDefault();
    this.isDrawing.set(false);
  };

  private readonly handlePointerEnter = (event: PointerEvent): void => {
    // Cambiar cursor según el tipo de puntero
    if (!this.drawingCanvas) {
      return;
    }
    if (event.pointerType === 'pen') {
      this.drawingCanvas.style.cursor = 'crosshair';
    } else if (event.pointerType === 'touch') {
      this.drawingCanvas.style.cursor = 'pointer';
    } else if (event.pointerType === 'mouse') {
      this.drawingCanvas.style.cursor = 'crosshair';
    }
  };

  private readonly handlePointerLeave = (_event: PointerEvent): void => {
    // Resetear cursor
    if (!this.drawingCanvas) {
      return;
    }
    this.drawingCanvas.style.cursor = 'default';
    this.isDrawing.set(false);
  };

  private applyPressure(pressure: number): void {
    if (!this.drawingContext) {
      return;
    }

    // Aplicar presión al grosor del pincel (0.0 a 1.0)
    const baseSize = this.brushSize();

    // Presión más sensible: 0.3x a 2x del tamaño base
    const pressureMultiplier = 0.3 + pressure * 1.7;
    const adjustedSize = baseSize * pressureMultiplier;

    this.drawingContext.lineWidth = adjustedSize;

    // Aplicar presión a la opacidad
    const baseAlpha = 0.6;
    const pressureAlpha = baseAlpha + pressure * 0.4; // 0.6 a 1.0
    this.drawingContext.globalAlpha = pressureAlpha;

    // Pressure, width and alpha applied
  }

  private drawLine(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): void {
    if (!this.drawingContext) { return; }

    // Configurar el estilo de línea para mejor calidad
    this.drawingContext.lineCap = 'round';
    this.drawingContext.lineJoin = 'round';
    this.drawingContext.imageSmoothingEnabled = true;
    this.drawingContext.imageSmoothingQuality = 'high';

    // Dibujar la línea
    this.drawingContext.beginPath();
    this.drawingContext.moveTo(fromX, fromY);
    this.drawingContext.lineTo(toX, toY);
    this.drawingContext.stroke();

    // Drawing line coordinates applied
  }

  private saveToHistory(): void {
    if (!this.drawingCanvas || !this.drawingContext) { return; }

    try {
      const imageData = this.drawingContext.getImageData(
        0,
        0,
        this.drawingCanvas.width,
        this.drawingCanvas.height
      );

      // Eliminar historial futuro si estamos en medio
      if (this.currentHistoryIndex < this.drawingHistory.length - 1) {
        this.drawingHistory = this.drawingHistory.slice(
          0,
          this.currentHistoryIndex + 1
        );
      }

      this.drawingHistory.push(imageData);
      this.currentHistoryIndex = this.drawingHistory.length - 1;

      // Limitar el historial a 50 estados
      if (this.drawingHistory.length > 50) {
        this.drawingHistory.shift();
        this.currentHistoryIndex--;
      }
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  }

  private showDrawingInterface(): void {
    // Crear contenedor para la interfaz de dibujo amigable para iOS
    const drawingContainer = document.createElement('div');
    drawingContainer.className = 'drawing-interface';
    drawingContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    `;

    // Crear header con controles
    const header = document.createElement('div');
    header.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10000;
    `;

    // Botón de cerrar estilo iOS
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      background: rgba(239, 68, 68, 0.9);
      color: white;
      border: none;
      border-radius: 50%;
      width: 44px;
      height: 44px;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all 0.2s ease;
    `;
    closeBtn.onclick = () => this.closeDrawingInterface();

    // Efectos hover para iOS
    closeBtn.onmouseenter = () => {
      closeBtn.style.transform = 'scale(1.1)';
      closeBtn.style.background = 'rgba(239, 68, 68, 1)';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.transform = 'scale(1)';
      closeBtn.style.background = 'rgba(239, 68, 68, 0.9)';
    };

    // Finish button
    const finishBtn = document.createElement('button');
    finishBtn.innerHTML = 'Finish';
    finishBtn.style.cssText = `
      background: rgba(34, 197, 94, 0.95);
      color: white;
      border: none;
      border-radius: 9999px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);
      transition: all 0.2s ease;
    `;
    finishBtn.onmouseenter = () => {
      finishBtn.style.transform = 'translateY(-1px)';
      finishBtn.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.4)';
    };
    finishBtn.onmouseleave = () => {
      finishBtn.style.transform = 'translateY(0)';
      finishBtn.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.35)';
    };
    finishBtn.onclick = () => this.finishDrawing();

    // Controles de herramientas
    const toolsContainer = document.createElement('div');
    toolsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      align-items: center;
    `;

    // Selector de color estilo iOS
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = this.brushColor();
    colorPicker.style.cssText = `
      width: 44px;
      height: 44px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      cursor: pointer;
      background: transparent;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
    `;
    colorPicker.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      this.brushColor.set(target.value);
      if (this.drawingContext) {
        this.drawingContext.strokeStyle = target.value;
      }
    };

    // Efectos para iOS
    colorPicker.onfocus = () => {
      colorPicker.style.transform = 'scale(1.05)';
      colorPicker.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
    };
    colorPicker.onblur = () => {
      colorPicker.style.transform = 'scale(1)';
      colorPicker.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    };

    // Selector de tamaño estilo iOS
    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '1';
    sizeSlider.max = '20';
    sizeSlider.value = this.brushSize().toString();
    sizeSlider.style.cssText = `
      width: 120px;
      height: 8px;
      background: rgba(55, 65, 81, 0.3);
      border-radius: 4px;
      outline: none;
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
    `;

    // Estilos personalizados para iOS
    sizeSlider.style.setProperty(
      '--webkit-slider-thumb',
      `
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #4a90e2;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `
    );
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    sizeSlider.oninput = (e) => {
      const target = e.target as HTMLInputElement;
      const size = parseInt(target.value, 10);
      this.brushSize.set(size);
      if (this.drawingContext) {
        this.drawingContext.lineWidth = size;
      }
    };
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

    // Botones de acción
    const undoBtn = document.createElement('button');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    undoBtn.innerHTML = '↶';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    undoBtn.style.cssText = `
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 16px;
    `;
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable */
    undoBtn.onclick = () => this.undo();
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable */

    const clearBtn = document.createElement('button');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    clearBtn.innerHTML = '🗑';
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    clearBtn.style.cssText = `
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 16px;
    `;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    clearBtn.onclick = () => this.clearCanvas();

    // Agregar controles al header
    toolsContainer.appendChild(colorPicker);
    toolsContainer.appendChild(sizeSlider);
    toolsContainer.appendChild(undoBtn);
    toolsContainer.appendChild(clearBtn);

    header.appendChild(closeBtn);
    header.appendChild(toolsContainer);
    header.appendChild(finishBtn);

    // Agregar canvas al contenedor
    if (this.drawingCanvas) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      this.drawingCanvas.style.cssText = `
        max-width: 90vw;
        max-height: 80vh;
        border: 2px solid #4a90e2;
        border-radius: 12px;
        background: white;
      `;
      drawingContainer.appendChild(this.drawingCanvas);
    }

    // Agregar header
    drawingContainer.appendChild(header);

    // Agregar al DOM
    document.body.appendChild(drawingContainer);

    // Agregar indicadores de presión y tilt
    this.addPressureIndicators(drawingContainer);
  }

  private addPressureIndicators(container: HTMLElement): void {
    // Indicador de presión
    const pressureIndicator = document.createElement('div');
    pressureIndicator.className = 'pressure-indicator';
    pressureIndicator.style.cssText = `
      position: absolute;
      top: 80px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-family: monospace;
      z-index: 10000;
    `;

    const pressureLabel = document.createElement('div');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    pressureLabel.textContent = 'Pressure';

    const pressureBar = document.createElement('div');
    pressureBar.style.cssText = `
      width: 100px;
      height: 8px;
      background: #374151;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 4px;
    `;

    const pressureFill = document.createElement('div');
    pressureFill.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, #ef4444, #f59e0b, #10b981);
      transition: width 0.1s ease;
      width: 0%;
    `;

    pressureBar.appendChild(pressureFill);
    pressureIndicator.appendChild(pressureLabel);
    pressureIndicator.appendChild(pressureBar);
    container.appendChild(pressureIndicator);

    // Indicador de tilt
    const tiltIndicator = document.createElement('div');
    tiltIndicator.className = 'tilt-indicator';
    tiltIndicator.style.cssText = `
      position: absolute;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-family: monospace;
      z-index: 10000;
    `;

    const tiltLabel = document.createElement('div');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    tiltLabel.textContent = 'Tilt';

    const tiltValues = document.createElement('div');
    tiltValues.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 4px;
    `;

    const tiltX = document.createElement('div');
    tiltX.style.cssText = 'text-align: center;';
    tiltX.innerHTML =
      '<div class="tilt-label">X</div><div class="tilt-number">0°</div>';

    const tiltY = document.createElement('div');
    tiltY.style.cssText = 'text-align: center;';
    tiltY.innerHTML =
      '<div class="tilt-label">Y</div><div class="tilt-number">0°</div>';

    tiltValues.appendChild(tiltX);
    tiltValues.appendChild(tiltY);
    tiltIndicator.appendChild(tiltLabel);
    tiltIndicator.appendChild(tiltValues);
    container.appendChild(tiltIndicator);

    // Actualizar indicadores en tiempo real
    this.updateIndicators(pressureFill, tiltX, tiltY);
  }

  private updateIndicators(
    pressureFill: HTMLElement,
    tiltX: HTMLElement,
    tiltY: HTMLElement
  ): void {
    const updateInterval = setInterval(() => {
      if (!this.isDrawingMode()) {
        clearInterval(updateInterval);
        return;
      }

      // Actualizar presión
      const pressurePercent = this.currentPressure() * 100;
      pressureFill.style.width = `${pressurePercent}%`;

      // Actualizar tilt
      const tiltXElement = tiltX.querySelector('.tilt-number');
      const tiltYElement = tiltY.querySelector('.tilt-number');

      if (tiltXElement) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tiltXElement.textContent = `${Math.round(this.currentTilt().x)}°`;
      }
      if (tiltYElement) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tiltYElement.textContent = `${Math.round(this.currentTilt().y)}°`;
      }
    }, 50);
  }

  private closeDrawingInterface(): void {
    this.isDrawingMode.set(false);

    // Remover interfaz del DOM
    const drawingInterface = document.querySelector('.drawing-interface');
    if (drawingInterface) {
      document.body.removeChild(drawingInterface);
    }

    // Limpiar canvas
    if (this.drawingCanvas && this.drawingContext) {
      this.drawingContext.clearRect(
        0,
        0,
        this.drawingCanvas.width,
        this.drawingCanvas.height
      );
    }
  }

  private undo(): void {
    if (this.currentHistoryIndex > 0) {
      this.currentHistoryIndex--;
      const imageData = this.drawingHistory[this.currentHistoryIndex];

      if (this.drawingContext && imageData) {
        this.drawingContext.putImageData(imageData, 0, 0);
      }
    }
  }

  private clearCanvas(): void {
    if (this.drawingCanvas && this.drawingContext) {
      this.drawingContext.clearRect(
        0,
        0,
        this.drawingCanvas.width,
        this.drawingCanvas.height
      );

      // Guardar estado limpio en historial
      this.saveToHistory();
    }
  }

  private saveDrawing(): void {
    if (this.drawingCanvas) {
      try {
        const dataURL = this.drawingCanvas.toDataURL('image/png');
        this.form.patchValue({ drawingData: dataURL });

        // Crear enlace de descarga
        const link = document.createElement('a');
        link.download = `drawing-${Date.now()}.png`;
        link.href = dataURL;
        link.click();

        // Drawing saved successfully
      } catch (error) {
        console.error('Error saving drawing:', error);
      }
    }
  }

  private finishDrawing(): void {
    if (!this.drawingCanvas) {
      this.showErrorMessage('No drawing to save.');
      return;
    }

    this.isUploadingDrawing.set(true);

    this.drawingCanvas.toBlob(
      (blob) => {
        if (!blob) {
          this.isUploadingDrawing.set(false);
          this.showErrorMessage('Could not export drawing as an image.');
          return;
        }

        const fileName = `drawing-${Date.now()}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        this.beginUpload();
        this.uploadService.upload(file, 'image').pipe(finalize(() => this.endUpload())).subscribe({
          next: (response: unknown) => {
            const url = this.extractUrlFromUploadResponse(response);
            if (!url) {
              console.warn('Upload response without URL shape:', response);
              this.showErrorMessage(
                'Upload completed but no URL was returned.'
              );
              this.isUploadingDrawing.set(false);
              return;
            }

            // Agregar el dibujo a la lista múltiple
            const drawingData = this.drawingCanvas?.toDataURL('image/png') || '';
            this.addDrawingToMultiple(drawingData, url);

            // Mantener compatibilidad con el dibujo único
            this.form.get('drawingUrl')?.setValue(url);
            this.saveEstimate();
            this.closeDrawingInterface();
            this.isUploadingDrawing.set(false);
          },
          error: (err: unknown) => {
            console.error('Error uploading drawing:', err);
            this.showErrorMessage('Error uploading drawing. Please try again.');
            this.isUploadingDrawing.set(false);
          },
        });
      },
      'image/png',
      0.92
    );
  }

  private extractUrlFromUploadResponse(response: unknown): string | null {
    if (!response) {
      return null;
    }
    try {
      const anyResp = response as Record<string, unknown>;
      const urlDirect = anyResp['url'];
      const urlData = (
        anyResp['data'] as Record<string, unknown> | undefined
      )?.['url'];
      const secureUrl = anyResp['secure_url'];
      const location = anyResp['Location'];
      const candidate = [urlDirect, urlData, secureUrl, location].find(
        (v) => typeof v === 'string'
      );
      return candidate ?? null;
    } catch {
      return null;
    }
  }

  private detectDeviceCapabilities(): {
    supportsTouch: boolean;
    supportsPressure: boolean;
    supportsTilt: boolean;
    supportsTwist: boolean;
    supportsTangentialPressure: boolean;
    maxTouchPoints: number;
    pointerTypes: string[];
  } {
    // Crear un evento de prueba para detectar capacidades
    const testEvent = new PointerEvent('pointerdown');

    return {
      supportsTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      supportsPressure: 'pressure' in testEvent,
      supportsTilt: 'tiltX' in testEvent && 'tiltY' in testEvent,
      supportsTwist: 'twist' in testEvent,
      supportsTangentialPressure: 'tangentialPressure' in testEvent,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      pointerTypes: ['mouse', 'pen', 'touch'].filter(
        (type) => navigator.maxTouchPoints > 0 || type === 'mouse'
      ),
    };
  }

  private showUnsupportedDeviceMessage(): void {
    alert(
      'This device does not support Apple Pencil or pressure-sensitive drawing. Please use a compatible device.'
    );
  }

  private showErrorMessage(_message: string): void {
    alert(_message);
  }

  // Advanced Drawing Component methods
  toggleAdvancedDrawing(): void {
    this.showAdvancedDrawing.set(!this.showAdvancedDrawing());
  }

  onAdvancedDrawingSaved(drawingData: string): void {
    // Si no hay datos de dibujo, intentar obtenerlos del canvas
    if (!drawingData) {
      // Aquí podrías implementar la lógica para obtener el dibujo del canvas
      // Por ahora, usamos un placeholder
      drawingData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    }

    this.advancedDrawingData.set(drawingData);
    this.addDrawingToMultiple(drawingData);
    this.showAdvancedDrawing.set(false);
    // this.notificationService.showSuccess('Drawing saved successfully!');
    // Drawing saved successfully
  }

  onAdvancedDrawingCancelled(): void {
    this.showAdvancedDrawing.set(false);
  }

  finishAdvancedDrawing(): void {
    // Obtener el dibujo directamente del canvas
    const drawingData = this.drawingCanvasComponent?.exportDrawing() || this.advancedDrawingData() || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    this.advancedDrawingData.set(drawingData);

    // Convertir base64 a File y subir
    this.uploadDrawingImage(drawingData);

    this.showAdvancedDrawing.set(false);
  }

  private uploadDrawingImage(drawingData: string): void {
    // Convertir base64 a File
    const base64Data = drawingData.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    const file = new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' });

    // Subir el archivo
    this.beginUpload();
    this.uploadService.upload(file, 'image').pipe(finalize(() => this.endUpload())).subscribe({
      next: (response) => {
        if (response && response.url) {
          // Agregar el dibujo con la URL del servidor
          this.addDrawingToMultiple(drawingData, response.url);
          // Drawing uploaded successfully
        } else {
          // Si no hay URL, agregar solo con data
          this.addDrawingToMultiple(drawingData);
          // Drawing saved locally (no upload URL)
        }
      },
      error: (error) => {
        console.error('Error uploading drawing:', error);
        // En caso de error, guardar localmente
        this.addDrawingToMultiple(drawingData);
        // Drawing saved locally due to upload error
      }
    });
  }

  // Drawing viewer methods
  viewDrawing(drawing: IDrawing): void {
    this.selectedDrawing.set(drawing);
    this.showDrawingViewer.set(true);
  }

  closeDrawingViewer(): void {
    this.showDrawingViewer.set(false);
    this.selectedDrawing.set(null);
  }

  // Handle drawing data changes from canvas
  onDrawingDataChanged(imageData: string): void {
    this.advancedDrawingData.set(imageData);
  }

  private showRecordingFeedback(_message: string): void {
    // Crear un toast temporal para mostrar feedback
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      transition: all 0.3s ease;
    `;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    toast.textContent = _message;
    document.body.appendChild(toast);

    // Remover después de 3 segundos
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  private setupPermissionMonitoring(): void {
    // Verificar permisos cada vez que la app vuelva a estar activa
    if (typeof window !== 'undefined' && 'Capacitor' in window) {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // La app volvió a estar activa, verificar permisos
          setTimeout(() => {
            void this.checkVoiceSupport();
          }, 1000);
        }
      });
    }
  }

  // Funciones existentes que necesitan ser implementadas
  private initForm(): void {
    // Implementar inicialización del formulario con todos los controles necesarios
    this.form = this.formBuilder.group({
      // Controles básicos del formulario
      type: ['small'],
      cellingHeight: [8],
      cellingHeightCustom: [{ value: null, disabled: true }],
      wallCabinetHeight: [30],
      wallCabinetHeightCustom: [{ value: null, disabled: true }],
      stackers: [12],
      stackersCustom: [{ value: null, disabled: true }],

      // Controles de dimensiones de cocina
      kitchenSquareFootage: [''],
      kitchenLength: [''],
      kitchenWidth: [''],
      isCabinetsToCelling: [false],

      // Controles de ubicación y estructura (hasta 2 selecciones)
      locationKitchen: [[]],
      subFloor: [[]],
      demolition: [''],
      eliminateDrywall: [''],
      dumpsterOnSite: [false],

      // Controles de demolición y estructura
      removeNonLoadWall: [false],
      removeLVLWall: [false],
      removeMetalWall: [false],
      recessedBeam: [false],
      supportBasement: [false],
      supportSlab: [false],
      engineeringReport: [false],
      beamWrapCedar: [''],

      // Controles de electricidad
      demoElectricWiring: [false],
      frameNewWall: [''],
      buildNewWall: [null],
      relocateWall: [''],
      relocateWallQuantity: [null],
      plugMold: [false],
      plugMoldSmall: [false],
      plugMoldMedium: [false],
      plugMoldLarge: [false],
      ledLighting: [false],
      ledLightingSmall: [false],
      ledLightingMedium: [false],
      ledLightingLarge: [false],
      puckLights: [false],
      puckLightsSmall: [false],
      puckLightsMedium: [false],
      puckLightsLarge: [false],
      canLightFour: [false],
      fourLight: [false],
      canLightSix: [false],
      sixLight: [false],
      pendantLights: [''],

      // Controles de relocalización de electrodomésticos
      relocateRange220: [''],
      relocateRange120: [''],
      relocateCooktop220: [''],
      relocateCooktop120: [''],
      relocateDoubleOven220: [''],
      relocateFridge120: [''],
      relocateDishwasher120: [''],
      relocateHoodInsert120: [''],
      relocateMicrowave120: [''],
      relocateIsland120: [''],

      // Controles de energía eléctrica
      runPowerRange220: [''],
      runPowerRange120: [''],
      runPowerCooktop220: [''],
      runPowerCooktop120: [''],
      runPowerDoubleOven220: [''],
      runPowerHoodInsert120: [''],
      runPowerMicrowave120: [''],
      runPowerIsland110: [''],

      // Controles de tomas y paneles
      addingOutletsExisting: [''],
      addingOutletsRunPower: [''],
      addBreaker: [''],
      installAirSwitch: [false],

      // Controles de interruptores
      reuseSwitch: [''],
      reuseSwitchQuantity: [null],
      addNewSwitch: [''],
      addNewSwitchQuantity: [null],
      addNewDimmer: [''],
      addNewDimmerQuantity: [null],
      keepSwitchOnWall: [false],

      // Controles de paneles
      addSubpanel50: [false],
      addSubpanel100: [false],
      upgradePanel: [''],

      // Controles de relocalización
      relocateSwitchesOutlets: [false],

      // Controles de plomería
      dishwasherWiring: [''],
      dishwasherWiringQuantity: [null],
      disposalWiring: [false],
      runNewDrainSupply: [false],
      relocateSinkPlumbing: [''],
      relocateFridgeWaterLine: [''],
      installNewFridgeWaterBox: [false],
      relocateDishwasher: [false],
      installNewWaterLineDishwasher: [''],
      runNewGasLine: [''],
      relocateGasLine: [''],
      reworkSinkPlumbing: [false],
      runWaterlinePotFiller: [false],

      // Controles de instalación
      installFaucet: [''],
      installFaucetQuantity: [null],
      concreteCutPatch: [''],
      concreteCutPatchQuantity: [null],
      installNewInsulationR13: [''],
      installNewInsulationR13Quantity: [null],

      // Controles de iluminación
      afterCanLight4: [false],
      afterCanLight6: [false],

      // Controles de gabinetes básicos
      basic36UpperCabinets: [false],
      basic36UpperCabinetsQuantity: [''],
      basic42UpperCabinets: [false],
      basic42UpperCabinetsQuantity: [''],
      basicBaseCabinet: [false],
      basicBaseCabinetQuantity: [''],
      basicTallCabinets: [false],
      basicTallCabinetsQuantity: [''],

      // Controles de gabinetes premium
      premium30UpperCabinet: [false],
      premium30UpperCabinetQuantity: [''],
      premium36UpperCabinets: [false],
      premium36UpperCabinetsQuantity: [''],
      premium42UpperCabinets: [false],
      premium42UpperCabinetsQuantity: [''],
      premiumBaseCabinet: [false],
      premiumBaseCabinetQuantity: [''],
      premiumTallCabinets: [false],
      premiumTallCabinetsQuantity: [''],

      // Controles de gabinetes de lujo
      luxury30UpperCabinet: [false],
      luxury30UpperCabinetQuantity: [''],
      luxury36UpperCabinets: [false],
      luxury36UpperCabinetsQuantity: [''],
      luxury42UpperCabinets: [false],
      luxury42UpperCabinetsQuantity: [''],
      luxuryBaseCabinet: [false],
      luxuryBaseCabinetQuantity: [''],
      luxuryTallCabinets: [false],
      luxuryTallCabinetsQuantity: [''],

      // Controles de stackers
      stackersWithGlass12: [''],
      stackersWithGlass12Quantity: [null],
      stackersWithGlass15: [''],
      stackersWithGlass15Quantity: [null],
      stackersWithGlass18: [''],
      stackersWithGlass18Quantity: [null],
      stackersWithoutGlass12: [''],
      stackersWithoutGlass12Quantity: [null],
      stackersWithoutGlass15: [''],
      stackersWithoutGlass15Quantity: [null],
      stackersWithoutGlass18: [''],
      stackersWithoutGlass18Quantity: [null],
      widePocketDoors: [false],
      widePocketDoorsQuantity: [{ value: '', disabled: true }],

      // Controles de materiales
      woodHoodVent: [''],
      woodHoodVent30: [false],
      woodHoodVent36: [false],
      woodHoodVent48: [false],
      woodHoodVent60: [false],
      woodHoodVentSize: [''],

      plaster: [false],
      plasterSmoothCeilings: [false],
      plasterPopcorn: [false],
      plasterStomped: [false],
      plasterOrangePeel: [false],

      ventilationHood: [''],
      ventilationHoodExteriorWall: [false],
      ventilationHoodAtticRoof: [false],
      ventilationHoodGarage: [false],
      ventilationHoodRecirculating: [false],

      countertops: [''],
      countertopsQuartz: [''],
      countertopsQuartzite: [''],
      countertopsGranite: [''],
      countertopsMarble: [''],
      countertopsComments: [''],

      // Campos de cantidad para Countertops (SF)
      countertopsQuartzQuantity: [null],
      countertopsQuartziteQuantity: [null],
      countertopsGraniteQuantity: [null],
      countertopsMarbleQuantity: [null],

      countertopTemplateFee: [''],
      countertopTemplateFeeSmall: [false],
      countertopTemplateFeeMedium: [false],
      countertopTemplateFeeLarge: [false],

      // Controles de ventanas
      newWindowDoubleHung: [''],
      newWindowDoubleHungQuantity: [null],
      newWindowPictureWindow: [''],
      newWindowPictureWindowQuantity: [null],
      newWindowCasement: [''],
      newWindowCasementQuantity: [null],
      windowRemoval: [''],
      windowRemovalQuantity: [null],
      relocateWindow: [''],
      relocateWindowQuantity: [null],

      // Controles de presupuesto y cliente
      customerBudget: [''],
      customerNotes: [''],

      // Controles de grabación de voz
      voiceRecording: [''],
      transcription: [''],

      // Controles de archivos PDF
      pdfFiles: [[]],

      // Controles de resultado
      estimateResult: [''],
      roughQuote: [''],

      // Controles de bordes y acabados
      edgingEasedPolishedQuantity: [null],
      edgingBevelQuantity: [null],
      edgingBullnoseQuantity: [null],
      edgingHalfBullnoseQuantity: [null],
      edgingOgeeQuantity: [null],
      edgingMiteredEdgeQuantity: [null],

      // Controles de trim
      trimQuarterRoundQuantity: [''],

      // Controles de pintura
      paintCeilingQuantity: [''],
      paintWallsQuantity: [''],
      paintTrimQuantity: [''],

      // Controles de instalación y acabados
      basicInstallation: [false],
      premiumInstallation: [false],
      basicTrimWork: [false],
      premiumTrimWork: [false],
      luxuryInstallation: [false],
      luxuryTrimWork: [false],

      // Controles de puertas de vidrio
      glassDoors: [false],

      // Controles de instalación de hardware
      hardwareInstallation: ['small'],

      // Controles de pintura de gabinetes
      paintingCabinetsPaintColor: [''],
      paintingCabinetsStainColor: [''],

      // Controles de hardware adicionales
      hardwareInstallationExistingHoles: [false],
      hardwareInstallationPuttyDrill: [false],

      // Controles de estantes
      glassShelvesHalf: [''],
      floatingShelvesMatch: [''],
      floatingShelvesCustom: [''],

      // Controles de encimeras
      countertopsOther: [false],

      // Controles de bordes
      edgingEasedPolished: [''],
      edgingBevel: [''],
      edgingBullnose: [''],
      edgingHalfBullnose: [''],
      edgingOgee: [''],
      edgingMiteredEdge: [''],

      // Controles de cortes
      cutoutsSinkFaucet: [false],
      cutoutsCooktop: [false],
      cutoutsAdditional: [false],

      // Controles de fregaderos (selección múltiple hasta 2)
      sinkSelection: [],

      // Controles de backsplash
      backsplashPrep: [false],
      backsplashTile: [''],
      backsplashQuartz: [''],
      backsplashQuartzite: [''],
      backsplashGranite: [''],
      backsplashMarble: [''],
      backsplashOther: [''],

      // Cantidades de backsplash
      backsplashTileQuantity: [null],
      backsplashQuartzQuantity: [null],
      backsplashQuartziteQuantity: [null],
      backsplashGraniteQuantity: [null],
      backsplashMarbleQuantity: [null],

      // Controles de tarifas de backsplash
      stoneBacksplashTemplateFeeSmall: [false],
      stoneBacksplashTemplateFeeMedium: [false],
      stoneBacksplashTemplateFeeLarge: [false],

      // Controles de drywall (Yes/No strings)
      drywallSmoothCeilings: [''],
      drywallSmoothCeilingsPopcorn: [''],
      drywallSmoothCeilingsStomped: [''],
      drywallSmoothCeilingsOrangePeel: [''],
      drywallRemoveWallpaper: [''],
      drywallRepairsCeilingWalls: [''],

      // Cantidades drywall
      drywallSmoothCeilingsPopcornQuantity: [null],
      drywallSmoothCeilingsStompedQuantity: [null],
      drywallSmoothCeilingsOrangePeelQuantity: [null],
      drywallRemoveWallpaperQuantity: [null],

      // Controles de electrodomésticos
      applianceFreestandingRange: [''],
      // Fridge sizes (Yes/No + quantity)
      applianceFridge36: [''],
      applianceFridge36Quantity: [null],
      applianceFridge42: [''],
      applianceFridge42Quantity: [null],
      // Free standing Range (Yes/No + quantity per size)
      applianceFreestandingRange30: [''],
      applianceFreestandingRange30Quantity: [null],
      applianceFreestandingRange36: [''],
      applianceFreestandingRange36Quantity: [null],
      applianceFreestandingRange48: [''],
      applianceFreestandingRange48Quantity: [null],
      applianceCooktop: [false],
      applianceDoubleOven: [false],
      applianceHoodInsert: [false],
      applianceMicrowave: [''],
      applianceFridge: [''],
      applianceBeverageFridge: [false],
      applianceIceMaker: [''],
      applianceWashDryer: [false],
      applianceDishwasher: [false],
      applianceDisposal: [false],

      // Controles de trim
      trimQuarterRound: [''],
      trimBaseboards: [''],
      // Baseboards subsecciones
      trimBaseboards35: [''],
      trimBaseboards35Quantity: [null],
      trimBaseboards525: [''],
      trimBaseboards525Quantity: [null],
      trimBaseboards725: [''],
      trimBaseboards725Quantity: [null],
      trimCrown: [''],
      // Crown subsecciones
      trimCrown4: [''],
      trimCrown4Quantity: [null],
      trimCrown6: [''],
      trimCrown6Quantity: [null],
      trimCrown8: [''],
      trimCrown8Quantity: [null],
      trimDoorCasing: [''],
      // Door casing subsecciones
      trimDoorCasing225: [''],
      trimDoorCasing225Quantity: [null],
      trimDoorCasing35: [''],
      trimDoorCasing35Quantity: [null],

      // Controles de pintura - Yes/No logic
      paintPrimeCeilingWalls: [''],
      paintPrimeCeilingWallsQuantity: [null],
      paintTrimCrownBaseCasing: [''],
      paintTrimCrownBaseCasingQuantity: [null],
      paintWindow: [''],
      paintWindowQuantity: [null],
      paintExteriorDoorStainSeal: [''],
      paintExteriorDoorStainSealQuantity: [null],
      paintCeilingWalls: [''],
      paintCeilingWallsQuantity: [null],
      paintDoor: [''],
      paintDoorQuantity: [null],
      paintExteriorDoor: [''],
      paintExteriorDoorQuantity: [null],

      // Controles de tiempo
      timeFrame: [''],

      // Controles de Apple Pencil - Multiple drawings
      drawingData: [''],
      drawingUrl: [''],
      pressureData: [''],
      tiltData: [''],
      multipleDrawings: [[]], // Array para almacenar múltiples dibujos

      // Controles de Backsplash
      backsplashComments: [''],

      // Controles de Drywall
      drywallServices: [''],

      // Controles de Can Lights
      canLightSize: [''],
      canLightQuantity: [null],
    });

    // Deshabilitar campos select que deben estar siempre deshabilitados
    this.disableSelectFields();
  }

  /**
   * Deshabilita los campos select que deben estar siempre deshabilitados
   */
  private disableSelectFields(): void {
    // Campos de Installation y Trim Work (se seleccionan automáticamente según el tipo)
    this.form.get('basicInstallation')?.disable();
    this.form.get('premiumInstallation')?.disable();
    this.form.get('luxuryInstallation')?.disable();
    this.form.get('basicTrimWork')?.disable();
    this.form.get('premiumTrimWork')?.disable();
    this.form.get('luxuryTrimWork')?.disable();

    // Campos de Hardware Installation
    this.form.get('hardwareInstallation')?.disable();

    // Campo de Drywall Services
    this.form.get('drywallServices')?.disable();
  }

  /**
   * Configura la deshabilitación dinámica de campos basada en la lógica Yes/No
   */
  private setupYesNoFieldDisabling(): void {
    // Configurar listeners para campos Yes/No que afectan otros campos

    // Framing section
    this.form.get('frameNewWall')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('buildNewWall')?.enable();
      } else {
        this.form.get('buildNewWall')?.disable();
      }
    });

    this.form.get('relocateWall')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('relocateWallQuantity')?.enable();
      } else {
        this.form.get('relocateWallQuantity')?.disable();
      }
    });

    // Electrical section
    this.form.get('reuseSwitch')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('reuseSwitchQuantity')?.enable();
      } else {
        this.form.get('reuseSwitchQuantity')?.disable();
      }
    });

    this.form.get('addNewSwitch')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('addNewSwitchQuantity')?.enable();
      } else {
        this.form.get('addNewSwitchQuantity')?.disable();
      }
    });

    this.form.get('addNewDimmer')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('addNewDimmerQuantity')?.enable();
      } else {
        this.form.get('addNewDimmerQuantity')?.disable();
      }
    });

    // Dishwasher wiring
    this.form.get('dishwasherWiring')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('dishwasherWiringQuantity')?.enable();
      } else {
        this.form.get('dishwasherWiringQuantity')?.disable();
      }
    });

    // Backsplash Yes/No dependencies
    this.form.get('backsplashTile')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('backsplashTileQuantity')?.enable();
      } else {
        this.form.get('backsplashTileQuantity')?.disable();
      }
    });

    this.form.get('backsplashQuartz')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('backsplashQuartzQuantity')?.enable();
      } else {
        this.form.get('backsplashQuartzQuantity')?.disable();
      }
    });

    this.form.get('backsplashQuartzite')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('backsplashQuartziteQuantity')?.enable();
      } else {
        this.form.get('backsplashQuartziteQuantity')?.disable();
      }
    });

    this.form.get('backsplashGranite')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('backsplashGraniteQuantity')?.enable();
      } else {
        this.form.get('backsplashGraniteQuantity')?.disable();
      }
    });

    this.form.get('backsplashMarble')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('backsplashMarbleQuantity')?.enable();
      } else {
        this.form.get('backsplashMarbleQuantity')?.disable();
      }
    });

    // Backsplash Other toggles media UI enablement
    this.form.get('backsplashOther')?.valueChanges.subscribe(value => {
      const isEnabled = value === 'yes';
      // No form control quantities; media UI visibility will use this directly
      if (!isEnabled) {
        // When disabling, clear selected files preview (keep uploaded list)
        this.backsplashSelectedFiles = [];
        if (this.backsplashUploadPreviewUrl) {
          URL.revokeObjectURL(this.backsplashUploadPreviewUrl);
          this.backsplashUploadPreviewUrl = null;
        }
      }
    });

    // Drywall section
    this.form.get('drywallSmoothCeilings')?.valueChanges.subscribe(value => {
      const enableSuboptions = value === 'yes';
      // Enable/disable only the suboption radios
      ['drywallSmoothCeilingsPopcorn', 'drywallSmoothCeilingsStomped', 'drywallSmoothCeilingsOrangePeel']
        .forEach(ctrl => enableSuboptions ? this.form.get(ctrl)?.enable() : this.form.get(ctrl)?.disable());
      if (!enableSuboptions) {
        // Reset values and ensure quantities disabled
        ['drywallSmoothCeilingsPopcorn', 'drywallSmoothCeilingsStomped', 'drywallSmoothCeilingsOrangePeel'].forEach(ctrl => this.form.get(ctrl)?.setValue(''));
        ['drywallSmoothCeilingsPopcornQuantity', 'drywallSmoothCeilingsStompedQuantity', 'drywallSmoothCeilingsOrangePeelQuantity']
          .forEach(ctrl => this.form.get(ctrl)?.disable());
      }
    });

    this.form.get('drywallSmoothCeilingsPopcorn')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('drywallSmoothCeilingsPopcornQuantity')?.enable();
      } else {
        this.form.get('drywallSmoothCeilingsPopcornQuantity')?.disable();
      }
    });

    this.form.get('drywallSmoothCeilingsStomped')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('drywallSmoothCeilingsStompedQuantity')?.enable();
      } else {
        this.form.get('drywallSmoothCeilingsStompedQuantity')?.disable();
      }
    });

    this.form.get('drywallSmoothCeilingsOrangePeel')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('drywallSmoothCeilingsOrangePeelQuantity')?.enable();
      } else {
        this.form.get('drywallSmoothCeilingsOrangePeelQuantity')?.disable();
      }
    });

    this.form.get('drywallRemoveWallpaper')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('drywallRemoveWallpaperQuantity')?.enable();
      } else {
        this.form.get('drywallRemoveWallpaperQuantity')?.disable();
      }
    });

    // Appliance: Free standing Range Yes/No enables quantities
    this.form.get('applianceFreestandingRange30')?.valueChanges.subscribe(v => {
      if (v === 'yes') {
        this.form.get('applianceFreestandingRange30Quantity')?.enable();
      } else {
        this.form.get('applianceFreestandingRange30Quantity')?.disable();
      }
    });
    this.form.get('applianceFreestandingRange36')?.valueChanges.subscribe(v => {
      if (v === 'yes') {
        this.form.get('applianceFreestandingRange36Quantity')?.enable();
      } else {
        this.form.get('applianceFreestandingRange36Quantity')?.disable();
      }
    });
    this.form.get('applianceFreestandingRange48')?.valueChanges.subscribe(v => {
      if (v === 'yes') {
        this.form.get('applianceFreestandingRange48Quantity')?.enable();
      } else {
        this.form.get('applianceFreestandingRange48Quantity')?.disable();
      }
    });

    // Fridge Yes/No enables quantities
    this.form.get('applianceFridge36')?.valueChanges.subscribe(v => {
      if (v === 'yes') {
        this.form.get('applianceFridge36Quantity')?.enable();
      } else {
        this.form.get('applianceFridge36Quantity')?.disable();
      }
    });
    this.form.get('applianceFridge42')?.valueChanges.subscribe(v => {
      if (v === 'yes') {
        this.form.get('applianceFridge42Quantity')?.enable();
      } else {
        this.form.get('applianceFridge42Quantity')?.disable();
      }
    });

    // Plumbing section
    this.form.get('installFaucet')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('installFaucetQuantity')?.enable();
      } else {
        this.form.get('installFaucetQuantity')?.disable();
      }
    });

    this.form.get('concreteCutPatch')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('concreteCutPatchQuantity')?.enable();
      } else {
        this.form.get('concreteCutPatchQuantity')?.disable();
      }
    });

    this.form.get('installNewInsulationR13')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('installNewInsulationR13Quantity')?.enable();
      } else {
        this.form.get('installNewInsulationR13Quantity')?.disable();
      }
    });

    // Windows section
    this.form.get('newWindowDoubleHung')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('newWindowDoubleHungQuantity')?.enable();
      } else {
        this.form.get('newWindowDoubleHungQuantity')?.disable();
      }
    });

    this.form.get('newWindowPictureWindow')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('newWindowPictureWindowQuantity')?.enable();
      } else {
        this.form.get('newWindowPictureWindowQuantity')?.disable();
      }
    });

    this.form.get('newWindowCasement')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('newWindowCasementQuantity')?.enable();
      } else {
        this.form.get('newWindowCasementQuantity')?.disable();
      }
    });

    this.form.get('windowRemoval')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('windowRemovalQuantity')?.enable();
      } else {
        this.form.get('windowRemovalQuantity')?.disable();
      }
    });

    this.form.get('relocateWindow')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('relocateWindowQuantity')?.enable();
      } else {
        this.form.get('relocateWindowQuantity')?.disable();
      }
    });

    // Stackers with glass
    this.form.get('stackersWithGlass12')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('stackersWithGlass12Quantity')?.enable();
      } else {
        this.form.get('stackersWithGlass12Quantity')?.disable();
      }
    });

    this.form.get('stackersWithGlass15')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('stackersWithGlass15Quantity')?.enable();
      } else {
        this.form.get('stackersWithGlass15Quantity')?.disable();
      }
    });

    this.form.get('stackersWithGlass18')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('stackersWithGlass18Quantity')?.enable();
      } else {
        this.form.get('stackersWithGlass18Quantity')?.disable();
      }
    });

    // Stackers without glass
    this.form.get('stackersWithoutGlass12')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('stackersWithoutGlass12Quantity')?.enable();
      } else {
        this.form.get('stackersWithoutGlass12Quantity')?.disable();
      }
    });

    this.form.get('stackersWithoutGlass15')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('stackersWithoutGlass15Quantity')?.enable();
      } else {
        this.form.get('stackersWithoutGlass15Quantity')?.disable();
      }
    });

    this.form.get('stackersWithoutGlass18')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('stackersWithoutGlass18Quantity')?.enable();
      } else {
        this.form.get('stackersWithoutGlass18Quantity')?.disable();
      }
    });

    // Countertops section
    this.form.get('countertopsQuartz')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('countertopsQuartzQuantity')?.enable();
      } else {
        this.form.get('countertopsQuartzQuantity')?.disable();
      }
    });

    this.form.get('countertopsQuartzite')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('countertopsQuartziteQuantity')?.enable();
      } else {
        this.form.get('countertopsQuartziteQuantity')?.disable();
      }
    });

    this.form.get('countertopsGranite')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('countertopsGraniteQuantity')?.enable();
      } else {
        this.form.get('countertopsGraniteQuantity')?.disable();
      }
    });

    this.form.get('countertopsMarble')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('countertopsMarbleQuantity')?.enable();
      } else {
        this.form.get('countertopsMarbleQuantity')?.disable();
      }
    });

    // Edging section
    this.form.get('edgingEasedPolished')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('edgingEasedPolishedQuantity')?.enable();
      } else {
        this.form.get('edgingEasedPolishedQuantity')?.disable();
      }
    });

    this.form.get('edgingBevel')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('edgingBevelQuantity')?.enable();
      } else {
        this.form.get('edgingBevelQuantity')?.disable();
      }
    });

    this.form.get('edgingBullnose')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('edgingBullnoseQuantity')?.enable();
      } else {
        this.form.get('edgingBullnoseQuantity')?.disable();
      }
    });

    this.form.get('edgingHalfBullnose')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('edgingHalfBullnoseQuantity')?.enable();
      } else {
        this.form.get('edgingHalfBullnoseQuantity')?.disable();
      }
    });

    this.form.get('edgingOgee')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('edgingOgeeQuantity')?.enable();
      } else {
        this.form.get('edgingOgeeQuantity')?.disable();
      }
    });

    this.form.get('edgingMiteredEdge')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('edgingMiteredEdgeQuantity')?.enable();
      } else {
        this.form.get('edgingMiteredEdgeQuantity')?.disable();
      }
    });

    // Trim section - Yes/No enables subsecciones
    this.form.get('trimBaseboards')?.valueChanges.subscribe(value => {
      const enableSuboptions = value === 'yes';
      // Enable/disable suboption radios
      ['trimBaseboards35', 'trimBaseboards525', 'trimBaseboards725']
        .forEach(ctrl => enableSuboptions ? this.form.get(ctrl)?.enable() : this.form.get(ctrl)?.disable());
      if (!enableSuboptions) {
        // Reset values and ensure quantities disabled
        ['trimBaseboards35', 'trimBaseboards525', 'trimBaseboards725'].forEach(ctrl => this.form.get(ctrl)?.setValue(''));
        ['trimBaseboards35Quantity', 'trimBaseboards525Quantity', 'trimBaseboards725Quantity']
          .forEach(ctrl => this.form.get(ctrl)?.disable());
      }
    });

    this.form.get('trimCrown')?.valueChanges.subscribe(value => {
      const enableSuboptions = value === 'yes';
      // Enable/disable suboption radios
      ['trimCrown4', 'trimCrown6', 'trimCrown8']
        .forEach(ctrl => enableSuboptions ? this.form.get(ctrl)?.enable() : this.form.get(ctrl)?.disable());
      if (!enableSuboptions) {
        // Reset values and ensure quantities disabled
        ['trimCrown4', 'trimCrown6', 'trimCrown8'].forEach(ctrl => this.form.get(ctrl)?.setValue(''));
        ['trimCrown4Quantity', 'trimCrown6Quantity', 'trimCrown8Quantity']
          .forEach(ctrl => this.form.get(ctrl)?.disable());
      }
    });

    this.form.get('trimDoorCasing')?.valueChanges.subscribe(value => {
      const enableSuboptions = value === 'yes';
      // Enable/disable suboption radios
      ['trimDoorCasing225', 'trimDoorCasing35']
        .forEach(ctrl => enableSuboptions ? this.form.get(ctrl)?.enable() : this.form.get(ctrl)?.disable());
      if (!enableSuboptions) {
        // Reset values and ensure quantities disabled
        ['trimDoorCasing225', 'trimDoorCasing35'].forEach(ctrl => this.form.get(ctrl)?.setValue(''));
        ['trimDoorCasing225Quantity', 'trimDoorCasing35Quantity']
          .forEach(ctrl => this.form.get(ctrl)?.disable());
      }
    });

    // Baseboards subsecciones - Yes/No enables quantities
    this.form.get('trimBaseboards35')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('trimBaseboards35Quantity')?.enable();
      } else {
        this.form.get('trimBaseboards35Quantity')?.disable();
      }
    });
    this.form.get('trimBaseboards525')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('trimBaseboards525Quantity')?.enable();
      } else {
        this.form.get('trimBaseboards525Quantity')?.disable();
      }
    });
    this.form.get('trimBaseboards725')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('trimBaseboards725Quantity')?.enable();
      } else {
        this.form.get('trimBaseboards725Quantity')?.disable();
      }
    });

    // Crown subsecciones - Yes/No enables quantities
    this.form.get('trimCrown4')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('trimCrown4Quantity')?.enable();
      } else {
        this.form.get('trimCrown4Quantity')?.disable();
      }
    });
    this.form.get('trimCrown6')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('trimCrown6Quantity')?.enable();
      } else {
        this.form.get('trimCrown6Quantity')?.disable();
      }
    });
    this.form.get('trimCrown8')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('trimCrown8Quantity')?.enable();
      } else {
        this.form.get('trimCrown8Quantity')?.disable();
      }
    });

    // Door casing subsecciones - Yes/No enables quantities
    this.form.get('trimDoorCasing225')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('trimDoorCasing225Quantity')?.enable();
      } else {
        this.form.get('trimDoorCasing225Quantity')?.disable();
      }
    });
    this.form.get('trimDoorCasing35')?.valueChanges.subscribe(value => {
      if (value === 'yes') {
        this.form.get('trimDoorCasing35Quantity')?.enable();
      } else {
        this.form.get('trimDoorCasing35Quantity')?.disable();
      }
    });

    // Painting section - Yes/No enables quantities
    this.form.get('paintPrimeCeilingWalls')?.valueChanges.subscribe(value => {
      if (value === 'yes') { this.form.get('paintPrimeCeilingWallsQuantity')?.enable(); }
      else { this.form.get('paintPrimeCeilingWallsQuantity')?.disable(); }
    });
    this.form.get('paintTrimCrownBaseCasing')?.valueChanges.subscribe(value => {
      if (value === 'yes') { this.form.get('paintTrimCrownBaseCasingQuantity')?.enable(); }
      else { this.form.get('paintTrimCrownBaseCasingQuantity')?.disable(); }
    });
    this.form.get('paintWindow')?.valueChanges.subscribe(value => {
      if (value === 'yes') { this.form.get('paintWindowQuantity')?.enable(); }
      else { this.form.get('paintWindowQuantity')?.disable(); }
    });
    this.form.get('paintExteriorDoorStainSeal')?.valueChanges.subscribe(value => {
      if (value === 'yes') { this.form.get('paintExteriorDoorStainSealQuantity')?.enable(); }
      else { this.form.get('paintExteriorDoorStainSealQuantity')?.disable(); }
    });
    this.form.get('paintCeilingWalls')?.valueChanges.subscribe(value => {
      if (value === 'yes') { this.form.get('paintCeilingWallsQuantity')?.enable(); }
      else { this.form.get('paintCeilingWallsQuantity')?.disable(); }
    });
    this.form.get('paintDoor')?.valueChanges.subscribe(value => {
      if (value === 'yes') { this.form.get('paintDoorQuantity')?.enable(); }
      else { this.form.get('paintDoorQuantity')?.disable(); }
    });
    this.form.get('paintExteriorDoor')?.valueChanges.subscribe(value => {
      if (value === 'yes') { this.form.get('paintExteriorDoorQuantity')?.enable(); }
      else { this.form.get('paintExteriorDoorQuantity')?.disable(); }
    });

    // Aplicar estado inicial (deshabilitar todos los campos de cantidad por defecto)
    this.applyInitialDisabledState();
  }

  /**
   * Aplica el estado inicial de deshabilitación para todos los campos de cantidad
   */
  private applyInitialDisabledState(): void {
    // Framing
    this.form.get('buildNewWall')?.disable();
    this.form.get('relocateWallQuantity')?.disable();

    // Electrical
    this.form.get('reuseSwitchQuantity')?.disable();
    this.form.get('addNewSwitchQuantity')?.disable();
    this.form.get('addNewDimmerQuantity')?.disable();

    // Dishwasher wiring
    this.form.get('dishwasherWiringQuantity')?.disable();

    // Plumbing
    this.form.get('installFaucetQuantity')?.disable();
    this.form.get('concreteCutPatchQuantity')?.disable();
    this.form.get('installNewInsulationR13Quantity')?.disable();

    // Windows
    this.form.get('newWindowDoubleHungQuantity')?.disable();
    this.form.get('newWindowPictureWindowQuantity')?.disable();
    this.form.get('newWindowCasementQuantity')?.disable();
    this.form.get('windowRemovalQuantity')?.disable();
    this.form.get('relocateWindowQuantity')?.disable();

    // Stackers with glass
    this.form.get('stackersWithGlass12Quantity')?.disable();
    this.form.get('stackersWithGlass15Quantity')?.disable();
    this.form.get('stackersWithGlass18Quantity')?.disable();

    // Stackers without glass
    this.form.get('stackersWithoutGlass12Quantity')?.disable();
    this.form.get('stackersWithoutGlass15Quantity')?.disable();
    this.form.get('stackersWithoutGlass18Quantity')?.disable();

    // Countertops
    this.form.get('countertopsQuartzQuantity')?.disable();
    this.form.get('countertopsQuartziteQuantity')?.disable();
    this.form.get('countertopsGraniteQuantity')?.disable();
    this.form.get('countertopsMarbleQuantity')?.disable();

    // Appliance
    this.form.get('applianceFreestandingRange30Quantity')?.disable();
    this.form.get('applianceFreestandingRange36Quantity')?.disable();
    this.form.get('applianceFreestandingRange48Quantity')?.disable();
    this.form.get('applianceFridge36Quantity')?.disable();
    this.form.get('applianceFridge42Quantity')?.disable();

    // Backsplash
    this.form.get('backsplashTileQuantity')?.disable();
    this.form.get('backsplashQuartzQuantity')?.disable();
    this.form.get('backsplashQuartziteQuantity')?.disable();
    this.form.get('backsplashGraniteQuantity')?.disable();
    this.form.get('backsplashMarbleQuantity')?.disable();

    // Edging
    this.form.get('edgingEasedPolishedQuantity')?.disable();
    this.form.get('edgingBevelQuantity')?.disable();
    this.form.get('edgingBullnoseQuantity')?.disable();
    this.form.get('edgingHalfBullnoseQuantity')?.disable();
    this.form.get('edgingOgeeQuantity')?.disable();
    this.form.get('edgingMiteredEdgeQuantity')?.disable();

    // Drywall
    this.form.get('drywallSmoothCeilingsPopcornQuantity')?.disable();
    this.form.get('drywallSmoothCeilingsStompedQuantity')?.disable();
    this.form.get('drywallSmoothCeilingsOrangePeelQuantity')?.disable();
    this.form.get('drywallRemoveWallpaperQuantity')?.disable();

    // Trim - disable subsecciones and quantities
    this.form.get('trimBaseboards35')?.disable();
    this.form.get('trimBaseboards525')?.disable();
    this.form.get('trimBaseboards725')?.disable();
    this.form.get('trimBaseboards35Quantity')?.disable();
    this.form.get('trimBaseboards525Quantity')?.disable();
    this.form.get('trimBaseboards725Quantity')?.disable();

    this.form.get('trimCrown4')?.disable();
    this.form.get('trimCrown6')?.disable();
    this.form.get('trimCrown8')?.disable();
    this.form.get('trimCrown4Quantity')?.disable();
    this.form.get('trimCrown6Quantity')?.disable();
    this.form.get('trimCrown8Quantity')?.disable();

    this.form.get('trimDoorCasing225')?.disable();
    this.form.get('trimDoorCasing35')?.disable();
    this.form.get('trimDoorCasing225Quantity')?.disable();
    this.form.get('trimDoorCasing35Quantity')?.disable();

    // Painting - disable quantities
    this.form.get('paintPrimeCeilingWallsQuantity')?.disable();
    this.form.get('paintTrimCrownBaseCasingQuantity')?.disable();
    this.form.get('paintWindowQuantity')?.disable();
    this.form.get('paintExteriorDoorStainSealQuantity')?.disable();
    this.form.get('paintCeilingWallsQuantity')?.disable();
    this.form.get('paintDoorQuantity')?.disable();
    this.form.get('paintExteriorDoorQuantity')?.disable();
  }

  // Media handlers
  trackByUrl(index: number, url: string): string { return url; }

  // Backsplash Other media state
  private backsplashFiles: ICountertopsFile[] = [];
  public backsplashSelectedFiles: File[] = [];
  private backsplashUploadPreviewUrl: string | null = null;

  getBacksplashUploadPreviewUrl(): string | null {
    return this.backsplashUploadPreviewUrl;
  }

  onBacksplashFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const files = Array.from(input.files);
    this.backsplashSelectedFiles = files;
    const first = files[0];
    if (this.backsplashUploadPreviewUrl) {
      URL.revokeObjectURL(this.backsplashUploadPreviewUrl);
    }
    this.backsplashUploadPreviewUrl = URL.createObjectURL(first);
  }

  addBacksplashFilesWithComment(comment: string): void {
    if (!this.backsplashSelectedFiles.length) {
      return;
    }
    for (const file of this.backsplashSelectedFiles) {
      const fileType = file.type.startsWith('image') ? 'image' : 'video';

      // Upload file using UploadService
      this.beginUpload();
      this.uploadService.upload(file, fileType).pipe(finalize(() => this.endUpload())).subscribe({
        next: (response: unknown) => {
          const uploadedUrl = this.extractUrlFromUploadResponse(response);
          if (!uploadedUrl) {
            console.warn('Upload response without URL shape:', response);
            this.showErrorMessage('Upload completed but no URL was returned.');
            return;
          }

          const item: ICountertopsFile = {
            id: this.generateFileId(),
            name: file.name,
            url: uploadedUrl, // Use uploaded URL instead of object URL
            type: fileType,
            comment,
            file,
          };
          this.backsplashFiles.push(item);
          this.saveEstimate(); // Save to form
        },
        error: (err: unknown) => {
          console.error('Error uploading file:', err);
          this.showErrorMessage('Error uploading file. Please try again.');
        }
      });
    }
    this.backsplashSelectedFiles = [];
    if (this.backsplashUploadPreviewUrl) {
      URL.revokeObjectURL(this.backsplashUploadPreviewUrl);
      this.backsplashUploadPreviewUrl = null;
    }
  }

  getBacksplashFiles(): ICountertopsFile[] {
    return [...this.backsplashFiles].sort((a, b) => a.name.localeCompare(b.name));
  }

  updateBacksplashFileComment(fileId: string, comment: string): void {
    const idx = this.backsplashFiles.findIndex(f => f.id === fileId);
    if (idx >= 0) {
      this.backsplashFiles[idx] = { ...this.backsplashFiles[idx], comment };
    }
  }

  updateBacksplashFileCommentFromEvent(fileId: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.updateBacksplashFileComment(fileId, target.value);
  }

  removeBacksplashFile(fileId: string): void {
    const idx = this.backsplashFiles.findIndex(f => f.id === fileId);
    if (idx >= 0) {
      const [removed] = this.backsplashFiles.splice(idx, 1);
      if (removed?.url) {
        URL.revokeObjectURL(removed.url);
      }
    }
  }

  trackByBacksplashFile(index: number, file: ICountertopsFile): string {
    return file.id;
  }

  // Backsplash Comments media state
  private backsplashCommentsFiles: ICountertopsFile[] = [];
  public backsplashCommentsSelectedFiles: File[] = [];
  private backsplashCommentsUploadPreviewUrl: string | null = null;

  getBacksplashCommentsUploadPreviewUrl(): string | null {
    return this.backsplashCommentsUploadPreviewUrl;
  }

  onBacksplashCommentsFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const files = Array.from(input.files);
    this.backsplashCommentsSelectedFiles = files;
    const first = files[0];
    if (this.backsplashCommentsUploadPreviewUrl) {
      URL.revokeObjectURL(this.backsplashCommentsUploadPreviewUrl);
    }
    this.backsplashCommentsUploadPreviewUrl = URL.createObjectURL(first);
  }

  addBacksplashCommentsFilesWithComment(comment: string): void {
    if (!this.backsplashCommentsSelectedFiles.length) {
      return;
    }
    for (const file of this.backsplashCommentsSelectedFiles) {
      const fileType = file.type.startsWith('image') ? 'image' : 'video';

      // Upload file using UploadService
      this.beginUpload();
      this.uploadService.upload(file, fileType).pipe(finalize(() => this.endUpload())).subscribe({
        next: (response: unknown) => {
          const uploadedUrl = this.extractUrlFromUploadResponse(response);
          if (!uploadedUrl) {
            console.warn('Upload response without URL shape:', response);
            this.showErrorMessage('Upload completed but no URL was returned.');
            return;
          }

          const item: ICountertopsFile = {
            id: this.generateFileId(),
            name: file.name,
            url: uploadedUrl, // Use uploaded URL instead of object URL
            type: fileType,
            comment,
            file,
          };
          this.backsplashCommentsFiles.push(item);
          this.saveEstimate(); // Save to form
        },
        error: (err: unknown) => {
          console.error('Error uploading file:', err);
          this.showErrorMessage('Error uploading file. Please try again.');
        }
      });
    }
    this.backsplashCommentsSelectedFiles = [];
    if (this.backsplashCommentsUploadPreviewUrl) {
      URL.revokeObjectURL(this.backsplashCommentsUploadPreviewUrl);
      this.backsplashCommentsUploadPreviewUrl = null;
    }
  }

  getBacksplashCommentsFiles(): ICountertopsFile[] {
    return [...this.backsplashCommentsFiles].sort((a, b) => a.name.localeCompare(b.name));
  }

  updateBacksplashCommentsFileComment(fileId: string, comment: string): void {
    const idx = this.backsplashCommentsFiles.findIndex(f => f.id === fileId);
    if (idx >= 0) {
      this.backsplashCommentsFiles[idx] = { ...this.backsplashCommentsFiles[idx], comment };
    }
  }

  updateBacksplashCommentsFileCommentFromEvent(fileId: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.updateBacksplashCommentsFileComment(fileId, target.value);
  }

  removeBacksplashCommentsFile(fileId: string): void {
    const idx = this.backsplashCommentsFiles.findIndex(f => f.id === fileId);
    if (idx >= 0) {
      const [removed] = this.backsplashCommentsFiles.splice(idx, 1);
      if (removed?.url) {
        URL.revokeObjectURL(removed.url);
      }
    }
  }

  trackByBacksplashCommentsFile(index: number, file: ICountertopsFile): string {
    return file.id;
  }

  // Media section - Photo/Video Upload with comments
  private mediaFiles: ICountertopsFile[] = [];
  public mediaSelectedFiles: File[] = [];
  private mediaUploadPreviewUrl: string | null = null;

  getMediaUploadPreviewUrl(): string | null {
    return this.mediaUploadPreviewUrl;
  }

  onMediaFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const files = Array.from(input.files);
    this.mediaSelectedFiles = files;
    const first = files[0];
    if (this.mediaUploadPreviewUrl) {
      URL.revokeObjectURL(this.mediaUploadPreviewUrl);
    }
    this.mediaUploadPreviewUrl = URL.createObjectURL(first);
  }

  addMediaFilesWithComment(comment: string): void {
    if (!this.mediaSelectedFiles.length) {
      return;
    }
    for (const file of this.mediaSelectedFiles) {
      const fileType = file.type.startsWith('image/') ? 'image' : 'video';

      // Upload file using UploadService
      this.beginUpload();
      this.uploadService.upload(file, fileType).pipe(finalize(() => this.endUpload())).subscribe({
        next: (response: unknown) => {
          const uploadedUrl = this.extractUrlFromUploadResponse(response);
          if (!uploadedUrl) {
            console.warn('Upload response without URL shape:', response);
            this.showErrorMessage('Upload completed but no URL was returned.');
            return;
          }

          const item: ICountertopsFile = {
            id: this.generateFileId(),
            name: file.name,
            url: uploadedUrl, // Use uploaded URL instead of object URL
            type: fileType,
            comment,
            file
          };
          this.mediaFiles.push(item);
          this.saveEstimate(); // Save to form
        },
        error: (err: unknown) => {
          console.error('Error uploading file:', err);
          this.showErrorMessage('Error uploading file. Please try again.');
        }
      });
    }
    this.mediaSelectedFiles = [];
    if (this.mediaUploadPreviewUrl) {
      URL.revokeObjectURL(this.mediaUploadPreviewUrl);
      this.mediaUploadPreviewUrl = null;
    }
  }

  getMediaFiles(): ICountertopsFile[] {
    return [...this.mediaFiles].sort((a, b) => a.name.localeCompare(b.name));
  }

  updateMediaFileComment(fileId: string, comment: string): void {
    const idx = this.mediaFiles.findIndex(f => f.id === fileId);
    if (idx >= 0) {
      this.mediaFiles[idx] = { ...this.mediaFiles[idx], comment };
    }
  }

  updateMediaFileCommentFromEvent(fileId: string, event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.updateMediaFileComment(fileId, target.value);
  }

  removeMediaFile(fileId: string): void {
    const idx = this.mediaFiles.findIndex(f => f.id === fileId);
    if (idx >= 0) {
      const [removed] = this.mediaFiles.splice(idx, 1);
      if (removed?.url) {
        URL.revokeObjectURL(removed.url);
      }
    }
  }

  trackByMediaFile(index: number, file: ICountertopsFile): string {
    return file.id;
  }

  // Multiple drawings functionality
  private readonly multipleDrawingsList: IDrawing[] = [];

  getMultipleDrawings(): IDrawing[] {
    return [...this.multipleDrawingsList].sort((a, b) => b.timestamp - a.timestamp);
  }

  addDrawingToMultiple(drawingData: string, drawingUrl?: string): void {
    const drawing: IDrawing = {
      id: this.generateFileId(),
      data: drawingUrl ? '' : drawingData, // Solo guardar base64 si no hay URL
      url: drawingUrl || '',
      timestamp: Date.now(),
      name: `Drawing ${this.multipleDrawingsList.length + 1}`,
      comment: ''
    };
    this.multipleDrawingsList.push(drawing);

    // Actualizar el control del formulario
    this.form.get('multipleDrawings')?.setValue([...this.multipleDrawingsList]);
  }

  removeDrawingFromMultiple(drawingId: string): void {
    const idx = this.multipleDrawingsList.findIndex(d => d.id === drawingId);
    if (idx >= 0) {
      this.multipleDrawingsList.splice(idx, 1);
      this.form.get('multipleDrawings')?.setValue([...this.multipleDrawingsList]);
    }
  }

  trackByDrawing(index: number, drawing: IDrawing): string {
    return drawing.id;
  }

  // Countertops file management methods
  onCountertopsFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) { return; }

    this.selectedFiles = Array.from(input.files);

    // Generate preview for the first file
    if (this.selectedFiles.length > 0) {
      const firstFile = this.selectedFiles[0];
      if (firstFile.type.startsWith('image/') || firstFile.type.startsWith('video/')) {
        this.uploadPreviewUrl = URL.createObjectURL(firstFile);
      }
    }
  }

  addCountertopsFilesWithComment(comment: string): void {
    if (this.selectedFiles.length === 0) {
      return;
    }

    this.selectedFiles.forEach(file => {
      const fileType = file.type.startsWith('image/') ? 'image' : 'video';

      // Upload file using UploadService
      this.beginUpload();
      this.uploadService.upload(file, fileType).pipe(finalize(() => this.endUpload())).subscribe({
        next: (response: unknown) => {
          const uploadedUrl = this.extractUrlFromUploadResponse(response);
          if (!uploadedUrl) {
            console.warn('Upload response without URL shape:', response);
            this.showErrorMessage('Upload completed but no URL was returned.');
            return;
          }

          const countertopsFile: ICountertopsFile = {
            id: this.generateFileId(),
            name: file.name,
            url: uploadedUrl, // Use uploaded URL instead of object URL
            type: fileType,
            comment: comment || '',
            file: file
          };

          this.countertopsFiles.push(countertopsFile);
          this.saveEstimate(); // Save to form
        },
        error: (err: unknown) => {
          console.error('Error uploading file:', err);
          this.showErrorMessage('Error uploading file. Please try again.');
        }
      });
    });

    this.selectedFiles = [];
    // Clear the preview after adding files
    if (this.uploadPreviewUrl) {
      URL.revokeObjectURL(this.uploadPreviewUrl);
      this.uploadPreviewUrl = null;
    }
  }

  getCountertopsFiles(): ICountertopsFile[] {
    return this.countertopsFiles.sort((a, b) => a.name.localeCompare(b.name));
  }

  getUploadPreviewUrl(): string | null {
    return this.uploadPreviewUrl;
  }

  updateCountertopsFileComment(fileId: string, comment: string): void {
    const file = this.countertopsFiles.find(f => f.id === fileId);
    if (file) {
      file.comment = comment;
      this.saveEstimate();
    }
  }

  updateCountertopsFileCommentFromEvent(fileId: string, event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.updateCountertopsFileComment(fileId, target.value);
  }

  removeCountertopsFile(fileId: string): void {
    const fileIndex = this.countertopsFiles.findIndex(f => f.id === fileId);
    if (fileIndex !== -1) {
      // Revoke the object URL to free memory
      const file = this.countertopsFiles[fileIndex];
      if (file?.url) {
        URL.revokeObjectURL(file.url);
      }
      this.countertopsFiles.splice(fileIndex, 1);
      this.saveEstimate();
    }
  }

  trackByCountertopsFile(index: number, file: ICountertopsFile): string {
    return file.id;
  }

  private generateFileId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private initEstimate(): void {
    // Load data from EstimateStateService into the form
    this.loadEstimateDataIntoForm();
  }

  private loadEstimateDataIntoForm(): void {
    const estimate = this.estimateState.getEstimate();
    if (!estimate) {
      // No estimate found in state, using default values
      return;
    }

    // Loading estimate data into form

    // Load kitchen information if available
    if (estimate.kitchenInformation) {
      // Loading kitchen information
      this.form.patchValue(estimate.kitchenInformation);
    }

    // Load form data if available (alternative field)
    if (estimate.formData) {
      // Loading form data
      this.form.patchValue(estimate.formData);
    }

    // Update kitchen type signal
    if (estimate.kitchenInformation?.type) {
      this.typeKitchenService.set(estimate.kitchenInformation.type);
    }
  }

  private async checkVoiceSupport(): Promise<void> {
    try {
      // Verificar si estamos en un entorno web o nativo
      if (typeof window !== 'undefined' && 'Capacitor' in window) {
        // Verificar si Capacitor Voice Recorder está disponible
        const hasRecordingPermission =
          await VoiceRecorder.hasAudioRecordingPermission();
        this.isVoiceSupported.set(hasRecordingPermission.value);
        // Voice recording support detected
      } else {
        // En entorno web, verificar si MediaRecorder está disponible
        const isWebSupported =
          typeof MediaRecorder !== 'undefined' &&
          navigator.mediaDevices &&
          typeof navigator.mediaDevices.getUserMedia === 'function';
        this.isVoiceSupported.set(isWebSupported);
        // Web voice recording support detected
      }
    } catch (error) {
      console.error('Error verificando soporte de voz:', error);
      this.isVoiceSupported.set(false);
    }
  }

  // Funciones básicas para el HTML
  saveEstimate(): void {
    // Usar debounce para evitar múltiples llamadas costosas
    this.saveEstimateSubject.next();
  }

  /**
   * Excluye campos auxiliares custom del formData antes de guardar/enviar
   * Estos campos son solo para manejo interno y no deben enviarse al backend
   */
  private excludeCustomFields<T extends Record<string, any>>(formData: T): Omit<T, 'cellingHeightCustom' | 'wallCabinetHeightCustom' | 'stackersCustom'> {
    const { cellingHeightCustom, wallCabinetHeightCustom, stackersCustom, ...cleanData } = formData;
    return cleanData;
  }

  /**
   * Valida que un string sea un MongoDB ID válido
   * MongoDB IDs tienen 24 caracteres hexadecimales
   */
  private isValidMongoId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    // MongoDB ID debe tener exactamente 24 caracteres y ser hexadecimal
    const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
    return mongoIdRegex.test(id);
  }

  // Método debounced que se ejecuta después del delay
  private debouncedSaveEstimate(): void {
    this.saveEstimateSubject.next();
  }

  // Método que realiza el guardado real (optimizado)
  private performSaveEstimate(): void {
    // Usar requestAnimationFrame para evitar forced reflow
    if (this.saveEstimateTimeoutId !== null) {
      cancelAnimationFrame(this.saveEstimateTimeoutId);
    }

    this.saveEstimateTimeoutId = requestAnimationFrame(() => {
      this.saveEstimateTimeoutId = null;

      const current = this.estimateState.getEstimate();
      if (!current) {
        // No hay estimate base aún; evitar sobreescritura inválida
        return;
      }

      // Optimizar: obtener valores una sola vez y reutilizarlos
      const form = this.form;
      const type = form.get('type')?.value as string;
      const kitchenSquareFootage = Number(form.get('kitchenSquareFootage')?.value ?? 0);
      const kitchenLength = Number(form.get('kitchenLength')?.value ?? 0);
      const kitchenWidth = Number(form.get('kitchenWidth')?.value ?? 0);
      const cellingHeight = Number(form.get('cellingHeight')?.value ?? 0);
      const wallCabinetHeight = Number(form.get('wallCabinetHeight')?.value ?? 0);
      const stackers = Number(form.get('stackers')?.value ?? 0);
      const isCabinetsToCelling = Boolean(form.get('isCabinetsToCelling')?.value ?? false);

      // Usar setTimeout para operaciones costosas fuera del frame principal
      setTimeout(() => {
        const rawFormData = form.getRawValue() as IKitchenInformation;

        // Excluir campos auxiliares custom que no deben enviarse al backend
        const formData = this.excludeCustomFields(rawFormData);

        const updatedEstimate = {
          ...current,
          kitchenInformation: {
            ...(current.kitchenInformation ?? {}),
            type,
            kitchenSquareFootage,
            kitchenLength,
            kitchenWidth,
            cellingHeight,
            wallCabinetHeight,
            stackers,
            isCabinetsToCelling,
            price: current.kitchenInformation?.price ?? 0,
          },
          formData,
        } as const;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        this.estimateState.setEstimate(updatedEstimate as any);
      }, 0);
    });
  }

  ngOnDestroy(): void {
    // Cleanup de subscriptions y timeouts
    this.destroy$.next();
    this.destroy$.complete();

    if (this.saveEstimateTimeoutId !== null) {
      cancelAnimationFrame(this.saveEstimateTimeoutId);
      this.saveEstimateTimeoutId = null;
    }
  }

  toggleVoiceRecording() {
    // Toggle voice recording called

    if (this.isRecording()) {
      // Deteniendo grabación
      void this.stopRecording();
    } else {
      // Iniciando grabación
      void this.startRecording();
    }
  }

  private async startRecording() {
    // Iniciando proceso de grabación

    const hasPermission = await VoiceRecorder.requestAudioRecordingPermission();
    // Permiso de grabación verificado

    if (hasPermission.value) {
      await VoiceRecorder.startRecording();
      this.isRecording.set(true);
      this.recordingDuration.set(0);
      this.recordingSize.set(0);
      this.recordingProgress.set(0);

      // Recording started
      this.showRecordingFeedback('Recording started');
    } else {
      // Sin permisos de grabación
      this.showRecordingFeedback('Permisos de grabación denegados');
    }
  }

  private async stopRecording() {
    // Deteniendo grabación

    const recordingData: RecordingData = await VoiceRecorder.stopRecording();
    this.isRecording.set(false);

    // Datos de grabación recibidos

    if (recordingData.value.recordDataBase64) {
      const audioBlob = this.base64ToBlob(
        recordingData.value.recordDataBase64,
        'audio/wav'
      );
      // Upload audio file and persist only the URL (never base64)
      try {
        const audioFile = new File(
          [audioBlob],
          `recording-${Date.now()}.wav`,
          { type: 'audio/wav' }
        );
        this.uploadService.upload(audioFile, 'audio').subscribe({
          next: (resp) => {
            if (resp && resp.url) {
              this.form.patchValue({ voiceRecording: resp.url });
            }
          },
          error: () => {
            // Keep working without URL, but do not send base64
          }
        });
      } catch { }
      this.currentRecording = audioBlob;
      this.hasRecording.set(true);
      this.recordingSize.set(audioBlob.size);

      // Audio guardado

      // Prepare audio player and duration metadata
      this.initAudioPlayerFromBlob(audioBlob);

      this.uploadAudio(audioBlob);
      // Mensaje de finalización de grabación removido para evitar duplicidad
    } else {
      // No audio data received
      this.showRecordingFeedback('Error: No audio recorded');
    }
  }

  private initAudioPlayerFromBlob(audioBlob: Blob): void {
    try {
      // Cleanup previous
      if (this.audioPlayer) {
        this.audioPlayer.pause();
        this.audioPlayer.removeEventListener(
          'timeupdate',
          this.onAudioTimeUpdate
        );
        this.audioPlayer.removeEventListener('ended', this.onAudioEnded);
      }
      if (this.audioObjectUrl) {
        URL.revokeObjectURL(this.audioObjectUrl);
        this.audioObjectUrl = null;
      }

      const url = URL.createObjectURL(audioBlob);
      this.audioObjectUrl = url;

      const player = new Audio();
      player.src = url;
      player.playbackRate = this.playbackSpeed();
      player.addEventListener('timeupdate', this.onAudioTimeUpdate);
      player.addEventListener('ended', this.onAudioEnded);
      player.onloadedmetadata = () => {
        if (Number.isFinite(player.duration)) {
          this.recordingDuration.set(player.duration);
        }
      };
      this.audioPlayer = player;
      // Reset progress for new audio
      this.recordingProgress.set(0);
    } catch (e) {
      console.error('Error initializing audio player', e);
    }
  }

  /**
   * Convierte una cadena base64 en un Blob
   * @param base64 - Cadena base64 del audio
   * @param mimeType - Tipo MIME del audio
   * @returns Blob del audio
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mimeType });
  }

  /**
   * Envía el audio al backend para obtener el resumen
   * @param audioBlob - Blob del audio grabado
   */
  private uploadAudio(audioBlob: Blob): void {
    this.isLoading.set(true);
    this.isTranscribing.set(true);
    this.summaryText.set(''); // Limpiar resumen anterior

    // Mostrar extensión antes de enviar al backend
    // const extension = this.guessAudioExtension(audioBlob.type);
    // alert(`Audio extension to upload: ${extension || 'unknown'} (mime: ${audioBlob.type || 'n/a'})`);

    this.audioProcessingService.uploadAudioForSummary(audioBlob).subscribe({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: (response: any) => {
        // Respuesta completa del backend recibida

        // Manejar diferentes formatos de respuesta
        let summary = '';
        if (typeof response === 'string') {
          summary = response;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } else if (response && response.summary) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          summary = response.summary;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } else if (response && response.data && response.data.summary) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          summary = response.data.summary;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } else if (response && response.message) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          summary = response.message;
        } else {
          summary = 'Could not generate summary. Unexpected server response.';
        }

        this.summaryText.set(summary);
        // Persist summary into the form transcription field for submit
        try {
          this.form.patchValue({ transcription: summary });
        } catch { }
        this.isLoading.set(false);
        this.isTranscribing.set(false);
        // Summary processed
        this.showRecordingFeedback('Summary generated successfully');
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (error: any) => {
        console.error('❌ Error processing audio:', error);
        this.isLoading.set(false);
        this.isTranscribing.set(false);
        this.summaryText.set('Error processing audio. Please try again.');
        this.showErrorMessage(
          'Error processing audio. Check your connection and try again.'
        );
      },
    });
  }

  // private guessAudioExtension(mimeType: string): string | null {
  //   const mime = (mimeType || '').toLowerCase();
  //   const mapping: Record<string, string> = {
  //     'audio/wav': 'wav',
  //     'audio/x-wav': 'wav',
  //     'audio/mp4': 'm4a',
  //     'audio/mpeg': 'mp3',
  //     'audio/mpga': 'mpga',
  //     'audio/aac': 'aac',
  //     'audio/ogg': 'ogg',
  //     'audio/oga': 'oga',
  //     'audio/webm': 'webm',
  //     'audio/flac': 'flac',
  //     'audio/x-flac': 'flac',
  //     'audio/mpeg3': 'mp3',
  //     'audio/mp3': 'mp3',
  //   };
  //   return mapping[mime] || null;
  // }



  playRecording(): void {
    try {
      if (!this.hasRecording()) { return; }
      if (!this.audioPlayer && this.currentRecording) {
        this.initAudioPlayerFromBlob(this.currentRecording);
      }
      if (!this.audioPlayer) { return; }

      this.audioPlayer.playbackRate = this.playbackSpeed();
      if (this.audioPlayer.paused) {
        void this.audioPlayer.play();
      } else {
        this.audioPlayer.pause();
      }
    } catch (e) {
      console.error('Error during playback', e);
    }
  }

  togglePlaybackSpeed(): void {
    const currentSpeed = this.playbackSpeed();
    const speeds = [0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(currentSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    this.playbackSpeed.set(speeds[nextIndex]);
    if (this.audioPlayer) {
      this.audioPlayer.playbackRate = speeds[nextIndex];
    }
  }

  deleteRecording(): void {
    this.confirmationService.show(
      'Are you sure you want to delete the recording?',
      () => {
        try {
          if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer.removeEventListener(
              'timeupdate',
              this.onAudioTimeUpdate
            );
            this.audioPlayer.removeEventListener('ended', this.onAudioEnded);
            this.audioPlayer = null;
          }
          if (this.audioObjectUrl) {
            URL.revokeObjectURL(this.audioObjectUrl);
            this.audioObjectUrl = null;
          }
        } catch { }
        this.currentRecording = null;
        this.hasRecording.set(false);
        this.recordingDuration.set(0);
        this.recordingSize.set(0);
        this.recordingProgress.set(0);
        this.transcriptionText.set('');
        this.summaryText.set('');
      }
    );
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) { return '0 Bytes'; }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  clickToview(): void {
    const rawFormValue = this.form.getRawValue() as IKitchenInformation;
    const formValue = this.excludeCustomFields(rawFormValue);
    const total = this.calculateEstimateTotal(formValue);

    // Mostrar resultado en UI (mismo lugar)
    this.estimateResult.set(`$${total.toFixed(2)}`);

    // Persistir total en estimateState
    const current = this.estimateState.getEstimate();
    if (current) {
      const updated = {
        ...current,
        totalPrice: total,
        kitchenInformation: {
          ...(current.kitchenInformation ?? {}),
          price: total,
        },
        formData: formValue,
      } as const;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      this.estimateState.setEstimate(updated as any);
    }

    // Hacer scroll hacia la sección de resultado
    try {
      const el = document.querySelector('.result-display-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch { }

    this.showEstimate.set(!this.showEstimate());
  }

  onSubmit(): void {
    // 1) Persistir form en estimateState (mantiene consistencia/side-effects)
    this.saveEstimate();

    // 2) Tomar el estimate actual y enviar el objeto completo con el form dentro de kitchenInformation
    const current = this.estimateState.getEstimate();
    if (!current) {
      console.error('No estimate found in state at submit time');
      return;
    }

    const rawFormValue = this.form.getRawValue() as IKitchenInformation;
    const formValue = this.excludeCustomFields(rawFormValue);

    // Mapear colecciones de medios internos (con File) a objetos de envío (URL + comentario)
    const mapToMediaItems = (items: ICountertopsFile[]): IMediaItem[] =>
      items.map((f) => ({ id: f.id, name: f.name, url: f.url, type: f.type, comment: f.comment }));

    const payloadMedia = {
      countertopsMedia: mapToMediaItems(this.countertopsFiles),
      backsplashMedia: mapToMediaItems(this.backsplashFiles),
      backsplashCommentsMedia: mapToMediaItems(this.backsplashCommentsFiles),
      media: mapToMediaItems(this.mediaFiles),
      multipleDrawings: this.getMultipleDrawings().map((d) => ({
        id: d.id,
        data: d.data,
        url: d.url,
        timestamp: d.timestamp,
        name: d.name,
        comment: d.comment ?? '',
      })) as IDrawing[],
    } as const;

    // Inyectar estas colecciones en el formValue que viaja en el payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    (formValue as any).countertopsMedia = payloadMedia.countertopsMedia;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    (formValue as any).backsplashMedia = payloadMedia.backsplashMedia;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    (formValue as any).backsplashCommentsMedia = payloadMedia.backsplashCommentsMedia;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    (formValue as any).media = payloadMedia.media;
    // Force drawings to avoid base64: clear data field before send
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    (formValue as any).multipleDrawings = payloadMedia.multipleDrawings.map(d => ({
      ...d,
      data: ''
    }));
    // Persist audio summary into payload if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    (formValue as any).transcription = this.transcriptionText() || (formValue as { transcription?: string }).transcription || '';
    // Never send base64/object URLs for audio; only URL set earlier by upload
    // Obtener el userId del usuario logueado y validar que sea un MongoDB ID válido
    const user = this.userStateService.getUser();

    console.log('?user', user);
    if (!user) {
      this.notificationService.show('User must be logged in to save estimate', 'error');
      console.error('No user found in UserStateService');
      return;
    }

    const userId = user?.user?.id || '';

    // Obtener companyId de la compañía seleccionada
    const selectedCompany = this.companyStateService.getCompany();
    const companyId = selectedCompany?._id || current.company?._id;

    if (!companyId) {
      this.notificationService.show('Company ID is missing. Please select a company.', 'error');
      console.error('Company ID is missing');
      return;
    }

    if (!this.isValidMongoId(companyId)) {
      this.notificationService.show(`Invalid Company ID: ${companyId}`, 'error');
      console.error('Invalid Company ID:', companyId);
      return;
    }

    // Validar que existe un projectId
    const projectId = current.projectId;
    if (!projectId) {
      this.notificationService.show('Project ID is missing. Please create a project first.', 'error');
      console.error('Project ID is missing in estimate state');
      return;
    }

    if (!this.isValidMongoId(projectId)) {
      this.notificationService.show(`Invalid Project ID: ${projectId}`, 'error');
      console.error('Invalid Project ID:', projectId);
      return;
    }

    // Validar customer._id si existe
    if (current.customer?._id && !this.isValidMongoId(current.customer._id)) {
      this.notificationService.show(`Invalid Customer ID: ${current.customer._id}`, 'error');
      console.error('Invalid Customer ID:', current.customer._id);
      return;
    }

    // Crear payload asegurando que userId, companyId, projectId y category estén presentes y sean válidos
    // Excluir 'company' del payload ya que el backend solo acepta 'companyId' (string)
    const { company: _company, ...currentWithoutCompany } = current;
    const payload = {
      ...currentWithoutCompany,
      customer: current.customer || {},
      companyId, // Requerido por la API (solo el ID, no el objeto company)
      projectId, // Requerido por la API - debe existir antes de crear la cotización
      category: 'kitchen' as const, // Requerido por la API
      kitchenInformation: formValue,
      formData: formValue,
      experience: current.experience || this.getCurrentExperience(), // Requerido por la API
      userId, // Establecer explícitamente el userId válido al final
    };

    // Verificación final: asegurar que userId esté presente y sea válido en el payload
    if (!payload.userId) {
      this.notificationService.show('User ID is missing in payload', 'error');
      console.error('Payload userId is missing:', payload);
      return;
    }

    if (!this.isValidMongoId(payload.userId)) {
      this.notificationService.show(`Invalid User ID in payload: ${payload.userId}`, 'error');
      console.error('Payload userId is invalid:', payload.userId, 'Length:', payload.userId?.length);
      return;
    }

    console.log('Payload with required fields:', {
      ...payload,
      userId: payload.userId,
      companyId: payload.companyId,
      projectId: payload.projectId,
      category: payload.category
    });

    this.quoteService.createKitchenQuote(payload as unknown).subscribe({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      next: (_resp: any) => {
        const customerId = current.customer?._id;
        if (customerId) {
          this.notificationService.show('Estimate saved', 'success');
          void this.router.navigate([`/admin/create-estimate`]);
        } else {
          this.notificationService.show('Customer id not found', 'error');
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (err: any) => {
        console.error('Error calling /quote:', err);
        this.notificationService.show('Error saving estimate', 'error');
      },
    });
  }

  // Toggle functions para elementos del formulario
  toggleAddNewDimmer(): void {
    // Toggle add new dimmer');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('addNewDimmer')?.value;
    this.form.get('addNewDimmer')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleUpgradePanel(): void {
    // Toggle upgrade panel');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('upgradePanel')?.value;
    this.form.get('upgradePanel')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleInstallFaucet(): void {
    // Toggle install faucet');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('installFaucet')?.value;
    this.form.get('installFaucet')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleConcreteCutPatch(): void {
    // Toggle concrete cut patch');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('concreteCutPatch')?.value;
    this.form.get('concreteCutPatch')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleInstallNewInsulationR13(): void {
    // Toggle install new insulation R13');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('installNewInsulationR13')?.value;
    this.form.get('installNewInsulationR13')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleNewWindowDoubleHung(): void {
    // Toggle new window double hung');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('newWindowDoubleHung')?.value;
    this.form.get('newWindowDoubleHung')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleNewWindowPictureWindow(): void {
    // Toggle new window picture window');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('newWindowPictureWindow')?.value;
    this.form.get('newWindowPictureWindow')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleNewWindowCasement(): void {
    // Toggle new window casement');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('newWindowCasement')?.value;
    this.form.get('newWindowCasement')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleWindowRemoval(): void {
    // Toggle window removal');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('windowRemoval')?.value;
    this.form.get('windowRemoval')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleRelocateWindow(): void {
    // Toggle relocate window');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('relocateWindow')?.value;
    this.form.get('relocateWindow')?.setValue(!currentValue);
    this.saveEstimate();
  }

  // Toggle functions para gabinetes básicos
  toggleBasic36UpperCabinets(): void {
    // Toggle basic 36 upper cabinets');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('basic36UpperCabinets')?.value;
    this.form.get('basic36UpperCabinets')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleBasic42UpperCabinets(): void {
    // Toggle basic 42 upper cabinets');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('basic42UpperCabinets')?.value;
    this.form.get('basic42UpperCabinets')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleBasicBaseCabinet(): void {
    // Toggle basic base cabinet');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('basicBaseCabinet')?.value;
    this.form.get('basicBaseCabinet')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleBasicTallCabinets(): void {
    // Toggle basic tall cabinets');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('basicTallCabinets')?.value;
    this.form.get('basicTallCabinets')?.setValue(!currentValue);
    this.saveEstimate();
  }

  // Toggle functions para gabinetes premium
  togglePremium30UpperCabinet(): void {
    // Toggle premium 30 upper cabinet');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('premium30UpperCabinet')?.value;
    this.form.get('premium30UpperCabinet')?.setValue(!currentValue);
    this.saveEstimate();
  }

  togglePremium36UpperCabinets(): void {
    // Toggle premium 36 upper cabinets');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('premium36UpperCabinets')?.value;
    this.form.get('premium36UpperCabinets')?.setValue(!currentValue);
    this.saveEstimate();
  }

  togglePremium42UpperCabinets(): void {
    // Toggle premium 42 upper cabinets');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('premium42UpperCabinets')?.value;
    this.form.get('premium42UpperCabinets')?.setValue(!currentValue);
    this.saveEstimate();
  }

  togglePremiumBaseCabinet(): void {
    // Toggle premium base cabinet');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('premiumBaseCabinet')?.value;
    this.form.get('premiumBaseCabinet')?.setValue(!currentValue);
    this.saveEstimate();
  }

  togglePremiumTallCabinets(): void {
    // Toggle premium tall cabinets');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('premiumTallCabinets')?.value;
    this.form.get('premiumTallCabinets')?.setValue(!currentValue);
    this.saveEstimate();
  }

  // Toggle functions para gabinetes de lujo
  toggleLuxury30UpperCabinet(): void {
    // Toggle luxury 30 upper cabinet');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('luxury30UpperCabinet')?.value;
    this.form.get('luxury30UpperCabinet')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleLuxury36UpperCabinets(): void {
    // Toggle luxury 36 upper cabinets');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('luxury36UpperCabinets')?.value;
    this.form.get('luxury36UpperCabinets')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleLuxury42UpperCabinets(): void {
    // Toggle luxury 42 upper cabinets');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('luxury42UpperCabinets')?.value;
    this.form.get('luxury42UpperCabinets')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleLuxuryBaseCabinet(): void {
    // Toggle luxury base cabinet');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('luxuryBaseCabinet')?.value;
    this.form.get('luxuryBaseCabinet')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleLuxuryTallCabinets(): void {
    // Toggle luxury tall cabinets');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('luxuryTallCabinets')?.value;
    this.form.get('luxuryTallCabinets')?.setValue(!currentValue);
    this.saveEstimate();
  }

  toggleWidePocketDoors(): void {
    // Toggle wide pocket doors');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('widePocketDoors')?.value;
    this.form.get('widePocketDoors')?.setValue(!currentValue);
    this.saveEstimate();
  }

  // Select functions para diferentes opciones
  selectWoodHoodVent(
    option:
      | 'woodHoodVent30'
      | 'woodHoodVent36'
      | 'woodHoodVent48'
      | 'woodHoodVent60'
  ): void {
    const keys: Array<
      'woodHoodVent30' | 'woodHoodVent36' | 'woodHoodVent48' | 'woodHoodVent60'
    > = [
        'woodHoodVent30',
        'woodHoodVent36',
        'woodHoodVent48',
        'woodHoodVent60',
      ];
    keys.forEach((k) => this.form.get(k)?.setValue(k === option));
    this.saveEstimate();
  }

  selectPlaster(
    option:
      | 'plasterSmoothCeilings'
      | 'plasterPopcorn'
      | 'plasterStomped'
      | 'plasterOrangePeel'
  ): void {
    const keys: Array<
      | 'plasterSmoothCeilings'
      | 'plasterPopcorn'
      | 'plasterStomped'
      | 'plasterOrangePeel'
    > = [
        'plasterSmoothCeilings',
        'plasterPopcorn',
        'plasterStomped',
        'plasterOrangePeel',
      ];
    keys.forEach((k) => this.form.get(k)?.setValue(k === option));
    this.saveEstimate();
  }

  selectVentilationHood(
    option:
      | 'ventilationHoodExteriorWall'
      | 'ventilationHoodAtticRoof'
      | 'ventilationHoodGarage'
      | 'ventilationHoodRecirculating'
  ): void {
    const keys: Array<
      | 'ventilationHoodExteriorWall'
      | 'ventilationHoodAtticRoof'
      | 'ventilationHoodGarage'
      | 'ventilationHoodRecirculating'
    > = [
        'ventilationHoodExteriorWall',
        'ventilationHoodAtticRoof',
        'ventilationHoodGarage',
        'ventilationHoodRecirculating',
      ];
    keys.forEach((k) => this.form.get(k)?.setValue(k === option));
    this.saveEstimate();
  }

  selectCountertops(option: string): void {
    // Agrupar por material y seleccionar solo una opción por grupo
    const groups: Record<string, string[]> = {
      quartz: [
        'countertopsQuartzBasic',
        'countertopsQuartzPremium',
        'countertopsQuartzLuxury',
      ],
      quartzite: [
        'countertopsQuartziteBasic',
        'countertopsQuartzitePremium',
        'countertopsQuartziteLuxury',
      ],
      granite: [
        'countertopsGraniteBasic',
        'countertopsGranitePremium',
        'countertopsGraniteLuxury',
      ],
      marble: [
        'countertopsMarbleBasic',
        'countertopsMarblePremium',
        'countertopsMarbleLuxury',
      ],
    };
    const groupKey = Object.keys(groups).find((g) =>
      groups[g].includes(option)
    );
    if (groupKey) {
      groups[groupKey].forEach((k) => this.form.get(k)?.setValue(k === option));
      this.saveEstimate();
    }
  }

  selectCountertopTemplateFee(
    option:
      | 'countertopTemplateFeeSmall'
      | 'countertopTemplateFeeMedium'
      | 'countertopTemplateFeeLarge'
  ): void {
    const keys: Array<
      | 'countertopTemplateFeeSmall'
      | 'countertopTemplateFeeMedium'
      | 'countertopTemplateFeeLarge'
    > = [
        'countertopTemplateFeeSmall',
        'countertopTemplateFeeMedium',
        'countertopTemplateFeeLarge',
      ];
    keys.forEach((k) => this.form.get(k)?.setValue(k === option));
    this.saveEstimate();
  }

  selectStoneBacksplashTemplateFee(
    option:
      | 'stoneBacksplashTemplateFeeSmall'
      | 'stoneBacksplashTemplateFeeMedium'
      | 'stoneBacksplashTemplateFeeLarge'
  ): void {
    const keys: Array<
      | 'stoneBacksplashTemplateFeeSmall'
      | 'stoneBacksplashTemplateFeeMedium'
      | 'stoneBacksplashTemplateFeeLarge'
    > = [
        'stoneBacksplashTemplateFeeSmall',
        'stoneBacksplashTemplateFeeMedium',
        'stoneBacksplashTemplateFeeLarge',
      ];
    keys.forEach((k) => this.form.get(k)?.setValue(k === option));
    this.saveEstimate();
  }

  private mapTypeToStoneBacksplashTemplateFee(
    type: 'small' | 'medium' | 'large'
  ):
    | 'stoneBacksplashTemplateFeeSmall'
    | 'stoneBacksplashTemplateFeeMedium'
    | 'stoneBacksplashTemplateFeeLarge' {
    if (type === 'small') { return 'stoneBacksplashTemplateFeeSmall'; }
    if (type === 'medium') { return 'stoneBacksplashTemplateFeeMedium'; }
    return 'stoneBacksplashTemplateFeeLarge';
  }

  // Funciones adicionales que faltan
  goBack(): void {
    this.location.back();
  }

  // Experience management methods
  getCurrentExperience(): string {
    const estimate = this.estimateState.getEstimate();
    return estimate?.experience || 'basic';
  }

  onExperienceChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const newExperience = target.value;

    const estimate = this.estimateState.getEstimate();
    if (estimate) {
      estimate.experience = newExperience;
      this.estimateState.setEstimate(estimate);
      // Experience updated
    }
  }

  changeType(type: 'small' | 'medium' | 'large'): void {
    this.form.get('type')?.setValue(type);
    this.typeKitchenService.set(type);
    this.form.get('hardwareInstallation')?.setValue(type);
    // Mantener demolition sincronizado con type y bloquear edición manual
    this.form.get('demolition')?.setValue(this.mapTypeToDemolition(type));
    this.selectCountertopTemplateFee(this.mapTypeToCountertopTemplateFee(type));
    this.selectStoneBacksplashTemplateFee(this.mapTypeToStoneBacksplashTemplateFee(type));
    // Actualizar Installation y Trim Work según el nuevo tipo
    this.updateInstallationAndTrimWork(type);
    this.saveEstimate();
  }

  getSelectedKitchenTypeValue(): string {
    return this.form.get('type')?.value || 'small';
  }

  handleKitchenTypeChange(type: 'small' | 'medium' | 'large'): void {
    this.changeType(type);
  }

  // Helpers para lógica condicional por tamaño de cocina
  private getSelectedKitchenType(): 'small' | 'medium' | 'large' {
    const value = this.form?.get('type')?.value as unknown;
    if (value === 'small' || value === 'medium' || value === 'large') {
      return value;
    }
    return 'small';
  }

  public isSmallTypeSelected(): boolean {
    return this.getSelectedKitchenType() === 'small';
  }

  public isMediumTypeSelected(): boolean {
    return this.getSelectedKitchenType() === 'medium';
  }

  public isLargeTypeSelected(): boolean {
    return this.getSelectedKitchenType() === 'large';
  }

  private mapTypeToDemolition(
    type: 'small' | 'medium' | 'large'
  ): 'kitchenSmall' | 'kitchenMedium' | 'kitchenLarge' {
    if (type === 'small') { return 'kitchenSmall'; }
    if (type === 'medium') { return 'kitchenMedium'; }
    return 'kitchenLarge';
  }

  private mapTypeToCountertopTemplateFee(
    type: 'small' | 'medium' | 'large'
  ): 'countertopTemplateFeeSmall' | 'countertopTemplateFeeMedium' | 'countertopTemplateFeeLarge' {
    if (type === 'small') { return 'countertopTemplateFeeSmall'; }
    if (type === 'medium') { return 'countertopTemplateFeeMedium'; }
    return 'countertopTemplateFeeLarge';
  }

  public isCanLightSelected(): boolean {
    const size = this.form.get('canLightSize')?.value as unknown;
    return size === '4' || size === '6';
  }

  public isFrameNewWallSelected(): boolean {
    return this.form.get('frameNewWall')?.value === 'yes';
  }

  public isRelocateWallSelected(): boolean {
    return this.form.get('relocateWall')?.value === 'yes';
  }

  private updateInstallationAndTrimWork(type: 'small' | 'medium' | 'large'): void {
    // Actualizar Installation según el tipo (usar emitEvent: false para campos deshabilitados)
    this.form.get('basicInstallation')?.setValue(type, { emitEvent: false });
    this.form.get('premiumInstallation')?.setValue(type, { emitEvent: false });
    this.form.get('luxuryInstallation')?.setValue(type, { emitEvent: false });

    // Actualizar Trim Work según el tipo (usar emitEvent: false para campos deshabilitados)
    this.form.get('basicTrimWork')?.setValue(type, { emitEvent: false });
    this.form.get('premiumTrimWork')?.setValue(type, { emitEvent: false });
    this.form.get('luxuryTrimWork')?.setValue(type, { emitEvent: false });
  }

  public onCanLightSizeChange(): void {
    this.updateCanLightQuantityState();
    this.saveEstimate();
  }

  private updateCanLightQuantityState(): void {
    const enabled = this.isCanLightSelected();
    const qtyCtrl = this.form.get('canLightQuantity');
    if (!qtyCtrl) { return; }
    if (enabled) {
      qtyCtrl.enable({ emitEvent: false });
    } else {
      qtyCtrl.disable({ emitEvent: false });
      qtyCtrl.setValue('', { emitEvent: false });
    }
  }

  private updateWidePocketDoorsQuantityState(): void {
    const enabled = this.form.get('widePocketDoors')?.value === true;
    const qtyCtrl = this.form.get('widePocketDoorsQuantity');
    if (!qtyCtrl) { return; }
    if (enabled) {
      qtyCtrl.enable({ emitEvent: false });
    } else {
      qtyCtrl.disable({ emitEvent: false });
      qtyCtrl.setValue('', { emitEvent: false });
    }
  }

  // Getter para el estado disabled de elementos de backsplash (no son FormControls)
  isBacksplashOtherEnabled(): boolean {
    return this.form.get('backsplashOther')?.value === 'yes';
  }

  select(field: string, value: unknown): void {
    if (this.form.get(field)) {
      this.form.get(field)?.setValue(value);
    }
  }

  handleBooleanRadioChange(fieldName: string, value: boolean): void {
    const control = this.form.get(fieldName);
    if (control) {
      control.setValue(value);
      this.saveEstimate();
    }
  }

  // Helpers para campos con opciones + input personalizado
  handleHeightSelection(fieldName: string, value: string | number | null): void {
    const control = this.form.get(fieldName);
    const customControlName = `${fieldName}Custom`;
    const customControl = this.form.get(customControlName);

    if (control) {
      if (value === 'custom') {
        // Si selecciona custom, habilitar el input custom
        if (customControl) {
          customControl.enable({ emitEvent: false });
          // Si hay un valor custom previo, mantenerlo
          const currentValue = control.value;
          const predefinedOptions = ['8 INCH', '9 INCH', '10 INCH', '30 INCH', '36 INCH', '42 INCH', '12 INCH', '15 INCH'];
          if (!predefinedOptions.includes(String(currentValue)) && currentValue !== null && currentValue !== undefined) {
            customControl.setValue(currentValue, { emitEvent: false });
          }
        }
      } else {
        // Si selecciona una opción predefinida, deshabilitar y limpiar el input custom
        if (customControl) {
          customControl.disable({ emitEvent: false });
          customControl.setValue(null, { emitEvent: false });
        }
        control.setValue(value);
      }
      this.saveEstimate();
    }
  }

  handleCustomHeightInput(fieldName: string, value: number | null): void {
    const mainControl = this.form.get(fieldName);
    const customControlName = `${fieldName}Custom`;
    const customControl = this.form.get(customControlName);

    if (mainControl && customControl) {
      if (value !== null && value !== undefined && value !== 0) {
        // Sincronizar el valor con el control principal
        mainControl.setValue(value, { emitEvent: false });
        customControl.setValue(value, { emitEvent: false });
      } else {
        // Si el valor es null o 0, limpiar ambos controles
        mainControl.setValue(null, { emitEvent: false });
        customControl.setValue(null, { emitEvent: false });
      }
      this.saveEstimate();
    }
  }

  setupCustomHeightSync(): void {
    // Sincronizar cellingHeightCustom con cellingHeight
    const cellingHeightCustom = this.form.get('cellingHeightCustom');
    if (cellingHeightCustom) {
      cellingHeightCustom.valueChanges.subscribe((value) => {
        if (value !== null && value !== undefined && value !== 0) {
          this.form.get('cellingHeight')?.setValue(value, { emitEvent: false });
        }
      });
    }

    // Sincronizar wallCabinetHeightCustom con wallCabinetHeight
    const wallCabinetHeightCustom = this.form.get('wallCabinetHeightCustom');
    if (wallCabinetHeightCustom) {
      wallCabinetHeightCustom.valueChanges.subscribe((value) => {
        if (value !== null && value !== undefined && value !== 0) {
          this.form.get('wallCabinetHeight')?.setValue(value, { emitEvent: false });
        }
      });
    }

    // Sincronizar stackersCustom con stackers
    const stackersCustom = this.form.get('stackersCustom');
    if (stackersCustom) {
      stackersCustom.valueChanges.subscribe((value) => {
        if (value !== null && value !== undefined && value !== 0) {
          this.form.get('stackers')?.setValue(value, { emitEvent: false });
        }
      });
    }

    // Actualizar estados iniciales de los controles custom
    this.updateCustomHeightStates();
  }

  updateCustomHeightStates(): void {
    // Actualizar estado de cellingHeightCustom
    const cellingHeight = this.form.get('cellingHeight')?.value;
    const cellingHeightCustom = this.form.get('cellingHeightCustom');
    if (cellingHeightCustom) {
      const predefinedOptions = ['8 INCH', '9 INCH', '10 INCH'];
      const isCustom = cellingHeight && !predefinedOptions.includes(String(cellingHeight));
      if (isCustom) {
        cellingHeightCustom.enable({ emitEvent: false });
        if (typeof cellingHeight === 'number') {
          cellingHeightCustom.setValue(cellingHeight, { emitEvent: false });
        }
      } else {
        cellingHeightCustom.disable({ emitEvent: false });
      }
    }

    // Actualizar estado de wallCabinetHeightCustom
    const wallCabinetHeight = this.form.get('wallCabinetHeight')?.value;
    const wallCabinetHeightCustom = this.form.get('wallCabinetHeightCustom');
    if (wallCabinetHeightCustom) {
      const predefinedOptions = ['30 INCH', '36 INCH', '42 INCH'];
      const isCustom = wallCabinetHeight && !predefinedOptions.includes(String(wallCabinetHeight));
      if (isCustom) {
        wallCabinetHeightCustom.enable({ emitEvent: false });
        if (typeof wallCabinetHeight === 'number') {
          wallCabinetHeightCustom.setValue(wallCabinetHeight, { emitEvent: false });
        }
      } else {
        wallCabinetHeightCustom.disable({ emitEvent: false });
      }
    }

    // Actualizar estado de stackersCustom
    const stackers = this.form.get('stackers')?.value;
    const stackersCustom = this.form.get('stackersCustom');
    if (stackersCustom) {
      const predefinedOptions = ['12 INCH', '15 INCH'];
      const isCustom = stackers && !predefinedOptions.includes(String(stackers));
      if (isCustom) {
        stackersCustom.enable({ emitEvent: false });
        if (typeof stackers === 'number') {
          stackersCustom.setValue(stackers, { emitEvent: false });
        }
      } else {
        stackersCustom.disable({ emitEvent: false });
      }
    }
  }

  isCustomHeightSelected(fieldName: string): boolean {
    const value = this.form.get(fieldName)?.value;
    if (!value && value !== 0) return false;
    const predefinedOptions = ['8 INCH', '9 INCH', '10 INCH', '30 INCH', '36 INCH', '42 INCH', '12 INCH', '15 INCH'];
    return !predefinedOptions.includes(String(value));
  }

  getCustomHeightValue(fieldName: string): number | null {
    const value = this.form.get(fieldName)?.value;
    if (!value && value !== 0) return null;
    const predefinedOptions = ['8 INCH', '9 INCH', '10 INCH', '30 INCH', '36 INCH', '42 INCH', '12 INCH', '15 INCH'];
    if (predefinedOptions.includes(String(value))) return null;
    return typeof value === 'number' ? value : parseFloat(String(value)) || null;
  }

  selectSink(sink: string): void {
    const control = this.form.get('sinkSelection');
    const current = (control?.value as string[]) ?? [];
    const exists = current.includes(sink);
    let next: string[];
    if (exists) {
      next = current.filter((x) => x !== sink);
    } else {
      next = current.length >= 2 ? [current[0], sink] : [...current, sink];
    }
    control?.setValue(next);
    this.saveEstimate();
  }

  isSinkSelected(key: string): boolean {
    const selected = (this.form.get('sinkSelection')?.value as string[]) || [];
    return Array.isArray(selected) && selected.includes(key);
  }

  selectLocationKitchen(location: string): void {
    // Select location kitchen
    const control = this.form.get('locationKitchen');
    const current = (control?.value as string[]) ?? [];
    const exists = current.includes(location);
    let next: string[];
    if (exists) {
      next = current.filter((x) => x !== location);
    } else {
      next = current.length >= 2 ? [current[0], location] : [...current, location];
    }
    control?.setValue(next);
    this.saveEstimate();
  }

  selectSubFloor(subFloor: string): void {
    // Select sub floor
    const control = this.form.get('subFloor');
    const current = (control?.value as string[]) ?? [];

    // Regla: o (basementFinished/basementUnfinished) o 'crawspace'
    if (subFloor === 'crawspace') {
      // Toggle exclusivo de crawspace
      const isOn = current.length === 1 && current[0] === 'crawspace';
      const next = isOn ? [] : ['crawspace'];
      control?.setValue(next);
      this.saveEstimate();
      return;
    }

    // Al seleccionar cualquier basement*, eliminamos 'crawspace'
    let next = current.filter((x) => x !== 'crawspace');
    if (next.includes(subFloor)) {
      // Toggle off si se vuelve a cliquear la misma opción
      next = [];
    } else {
      // Basement FINISHED y Basement UNFINISHED son mutuamente excluyentes
      next = [subFloor];
    }
    control?.setValue(next);
    this.saveEstimate();
  }

  selectDemolition(demolition: string): void {
    // Select demolition
    const control = this.form.get('demolition');
    const current = control?.value as string | null | undefined;
    const next = current === demolition ? '' : demolition;
    control?.setValue(next);
    this.saveEstimate();
  }

  selectEliminateDrywall(option: 'eliminateDrywallPantryLoadBearing' | 'eliminateDrywallPantryNonLoadBearing'): void {
    const control = this.form.get('eliminateDrywall');
    const current = control?.value as string | null | undefined;
    control?.setValue(current === option ? '' : option);
    this.saveEstimate();
  }

  toggleDumpsterOnSite(): void {
    // Toggle dumpster on site');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentValue = this.form.get('dumpsterOnSite')?.value;
    this.form.get('dumpsterOnSite')?.setValue(!currentValue);
    this.saveEstimate();
  }

  enabledAfterCanLight(count: number): void {
    // Habilitar/deshabilitar y limpiar cantidad según selección 4" o 6"
    if (count === 4) {
      const on = Boolean(this.form.get('canLightFour')?.value);
      if (!on) { this.form.get('fourLight')?.setValue(''); }
    } else if (count === 6) {
      const on = Boolean(this.form.get('canLightSix')?.value);
      if (!on) { this.form.get('sixLight')?.setValue(''); }
    }
    this.saveEstimate();
  }

  toggleReuseSwitch(): void {
    const cur = Boolean(this.form.get('reuseSwitch')?.value);
    this.form.get('reuseSwitch')?.setValue(!cur);
    if (!cur === false) {
      this.form.get('reuseSwitchQuantity')?.setValue('');
    }
    this.saveEstimate();
  }

  toggleAddNewSwitch(): void {
    const cur = Boolean(this.form.get('addNewSwitch')?.value);
    this.form.get('addNewSwitch')?.setValue(!cur);
    if (!cur === false) {
      this.form.get('addNewSwitchQuantity')?.setValue('');
    }
    this.saveEstimate();
  }

  // TrackBy function para ngFor
  trackByPdfFile(index: number, item: { name?: string }): string | number {
    return item.name ?? index;
  }

  // ======================
  // Cálculo del presupuesto
  // ======================

  getLocationKitchenPrice(locationKitchen: string | string[]): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    return this.calculationService.getLocationKitchenPrice(locationKitchen as any);
  }

  getSubFloorPrice(subFloor: string | string[]): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    return this.calculationService.getSubFloorPrice(subFloor as any);
  }

  getDemolitionPrice(demolition: string): number {
    return this.calculationService.getDemolitionPrice(demolition);
  }

  getEliminateDrywallPrice(option: string): number {
    return this.calculationService.getEliminateDrywallPrice(option);
  }

  // Wall Demo (data.json -> Wall Demo)
  getWallDemoPrice(): number {
    return this.calculationService.getWallDemoPrice(this.form);
  }

  // Framing (data.json -> Framing)
  getFramingPrice(): number {
    return this.calculationService.getFramingPrice(this.form);
  }

  // Windows (data.json -> Windows)
  getWindowsPrice(): number { return this.calculationService.getWindowsPrice(this.form); }

  // Painting (data.json -> Painting)
  getPaintingPrice(): number { return this.calculationService.getPaintingPrice(this.form); }

  // Cálculo de precios de gabinetes basado en data.json
  getCabinetPrice(): number { return this.calculationService.getCabinetPrice(this.form, this.getCurrentExperience()); }

  getCountertopPrice(): number { return this.calculationService.getCountertopPrice(this.form); }

  // Countertop Template fee (data.json -> Countertop Template fee)
  getCountertopTemplateFeePrice(): number { return this.calculationService.getCountertopTemplateFeePrice(this.form); }

  // Edging (data.json -> Edging)
  getEdgingPrice(): number { return this.calculationService.getEdgingPrice(this.form); }

  // Cutouts (data.json -> Cutouts)
  getCutoutsPrice(): number { return this.calculationService.getCutoutsPrice(this.form); }

  // Sink Selection (data.json -> Sink Selection)
  getSinkSelectionPrice(): number { return this.calculationService.getSinkSelectionPrice(this.form); }

  // Backsplash (data.json -> Backsplash)
  getBacksplashPrice(): number { return this.calculationService.getBacksplashPrice(this.form); }

  // Stone Backsplash Template fee (data.json -> Stone Backsplash Template fee)
  getStoneBacksplashTemplateFeePrice(): number { return this.calculationService.getStoneBacksplashTemplateFeePrice(this.form); }

  // Appliance Installation (data.json -> Appliance Installation)
  getApplianceInstallationPrice(): number { return this.calculationService.getApplianceInstallationPrice(this.form); }

  // Trim (data.json -> Trim)
  getTrimPrice(): number { return this.calculationService.getTrimPrice(this.form); }

  // Shelving (data.json -> Shelving)
  getShelvingPrice(): number { return this.calculationService.getShelvingPrice(this.form); }

  // Wood Hood Vent (data.json -> Wood Hood Vent)
  getWoodHoodVentPrice(): number { return this.calculationService.getWoodHoodVentPrice(this.form); }

  // Ventilation Hood (data.json -> Ventilation Hood)
  getVentilationHoodPrice(): number { return this.calculationService.getVentilationHoodPrice(this.form); }

  getElectricalPrice(): number { return this.calculationService.getElectricalPrice(this.form); }

  getPlumbingPrice(): number { return this.calculationService.getPlumbingPrice(this.form); }

  private calculateEstimateTotal(_form: IKitchenInformation): number {
    return this.calculationService.calculateEstimateTotal(this.form, this.getCurrentExperience());
  }
}