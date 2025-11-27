import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    computed,
    DestroyRef,
    type OnInit
} from '@angular/core';
import type { FormArray, FormControl, FormGroup } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { S3UploadService } from '../../../../../../core/services/upload/s3-upload.service';
import { NotificationService } from '../../../../../../core/services/notification/notification.service';
import { PermissionsService } from '../../../../../../core/services/permissions/permissions.service';
import { MediaPickerService } from '../../../../../../core/services/media/media-picker.service';
import type { Materials } from '../../../../../../core/models/quote.model';

type MaterialsInputMode = 'file' | 'manual';

@Component({
    selector: 'app-materials-tab',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule
    ],
    templateUrl: './materials-tab.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaterialsTabComponent implements OnInit {
    private readonly fb = inject(FormBuilder);
    private readonly s3UploadService = inject(S3UploadService);
    private readonly notificationService = inject(NotificationService);
    private readonly permissionsService = inject(PermissionsService);
    private readonly mediaPickerService = inject(MediaPickerService);
    private readonly destroyRef = inject(DestroyRef);

    // Callback para actualizar el formulario padre
    private updateParentForm: ((value: Materials | null) => void) | null = null;

    // Formulario para materiales
    protected readonly materialsForm = this.fb.group({
        inputMode: ['manual' as MaterialsInputMode, [Validators.required]],
        fileUrl: [null as string | null],
        materials: this.fb.array<FormGroup<{
            quantity: FormControl<number | null>;
            description: FormControl<string>;
        }>>([])
    });

    // Estado de carga de archivo
    protected readonly isUploadingFile = signal(false);
    protected readonly uploadingFileProgress = signal(0);
    protected readonly uploadedFilePreview = signal<string | null>(null);

    // Computed para saber si hay materiales
    protected readonly hasMaterials = computed(() => {
        const mode = this.materialsForm.controls.inputMode.value;
        if (mode === 'file') {
            return !!this.materialsForm.controls.fileUrl.value;
        }
        return this.materialsArray.length > 0;
    });

    // Getter para el FormArray de materiales
    protected get materialsArray(): FormArray<FormGroup<{
        quantity: FormControl<number | null>;
        description: FormControl<string>;
    }>> {
        return this.materialsForm.controls.materials;
    }

    ngOnInit(): void {
        // Inicializar con un material vacío si no hay ninguno
        if (this.materialsArray.length === 0) {
            this.addMaterial();
        }

        // Sincronizar cambios con el formulario padre
        this.materialsForm.valueChanges
            .pipe(
                debounceTime(300),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                const value = this.getMaterialsValue();
                if (this.updateParentForm) {
                    this.updateParentForm(value);
                }
            });
    }


    /**
     * Establece el callback para actualizar el formulario padre
     */
    setUpdateCallback(callback: (value: Materials | null) => void): void {
        this.updateParentForm = callback;
    }

    /**
     * Cambia el modo de entrada (archivo o manual)
     * NO limpia los datos del otro modo para permitir tener ambos simultáneamente
     */
    protected onInputModeChange(mode: MaterialsInputMode): void {
        this.materialsForm.controls.inputMode.setValue(mode);

        // No limpiar datos del otro modo - permitir tener file e items simultáneamente
        // Solo agregar un material vacío si estamos en modo manual y no hay ninguno
        if (mode === 'manual' && this.materialsArray.length === 0) {
            this.addMaterial();
        }
    }

    /**
     * Agrega un nuevo material al formulario
     */
    protected addMaterial(): void {
        const materialGroup = this.fb.group({
            quantity: [null as number | null, [Validators.required, Validators.min(1)]],
            description: ['', [Validators.required]]
        }) as FormGroup<{
            quantity: FormControl<number | null>;
            description: FormControl<string>;
        }>;
        this.materialsArray.push(materialGroup);
    }

    /**
     * Elimina un material del formulario
     */
    protected removeMaterial(index: number): void {
        this.materialsArray.removeAt(index);
        // Si no quedan materiales, agregar uno vacío
        if (this.materialsArray.length === 0) {
            this.addMaterial();
        }
    }

    /**
     * Maneja la selección de archivo
     */
    protected async onFileSelected(): Promise<void> {
        try {
            // Verificar permisos antes de abrir el selector
            const hasPermission = await this.permissionsService.requestMediaPermissions();
            if (!hasPermission) {
                this.notificationService.error(
                    'Permisos requeridos',
                    'Se necesita acceso a la cámara y galería para seleccionar archivos. Por favor, habilita los permisos en la configuración de tu dispositivo.'
                );
                return;
            }

            // Seleccionar archivo usando el servicio nativo
            // Nota: En nativo solo se puede seleccionar un archivo a la vez
            const files = await this.mediaPickerService.pickMedia(false);
            if (files.length === 0) return;

            const file = files[0];

        // Validar tipo de archivo (imagen o PDF)
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            this.notificationService.error('Error', 'Solo se permiten archivos de imagen o PDF');
            return;
        }

        this.isUploadingFile.set(true);
        this.uploadingFileProgress.set(0);

        try {
            // Crear preview si es imagen
            if (file.type.startsWith('image/')) {
                const preview = URL.createObjectURL(file);
                this.uploadedFilePreview.set(preview);
            }

            // Subir archivo
            const url = await this.s3UploadService.uploadFile(
                file,
                (progress) => {
                    this.uploadingFileProgress.set(progress.percentage);
                }
            );

            // Guardar URL en el formulario
            this.materialsForm.controls.fileUrl.setValue(url);

            // Limpiar preview temporal si existe
            if (this.uploadedFilePreview()) {
                URL.revokeObjectURL(this.uploadedFilePreview()!);
            }

            // Si es imagen, usar la URL como preview
            if (file.type.startsWith('image/')) {
                this.uploadedFilePreview.set(url);
            }

            this.notificationService.success('Éxito', 'Archivo subido correctamente');
        } catch {
            this.notificationService.error('Error', 'No se pudo subir el archivo');

            // Limpiar preview si existe
            if (this.uploadedFilePreview()) {
                URL.revokeObjectURL(this.uploadedFilePreview()!);
                this.uploadedFilePreview.set(null);
            }
        } finally {
            this.isUploadingFile.set(false);
            this.uploadingFileProgress.set(0);
            }
        } catch {
            this.notificationService.error('Error', 'No se pudo seleccionar el archivo');
        }
    }

    /**
     * Elimina el archivo subido
     * NO limpia los items manuales
     */
    protected removeFile(): void {
        this.materialsForm.controls.fileUrl.setValue(null);
        if (this.uploadedFilePreview()) {
            // Solo revocar si es un blob URL (no una URL de S3)
            const preview = this.uploadedFilePreview()!;
            if (preview.startsWith('blob:')) {
                URL.revokeObjectURL(preview);
            }
        }
        this.uploadedFilePreview.set(null);
        // No cambiar el modo - permitir mantener items si existen
    }

    /**
     * Obtiene el valor de los materiales para el formulario principal
     * Retorna objeto Materials con file e items (incluye ambos si existen)
     */
    getMaterialsValue(): Materials | null {
        const result: Materials = {};

        // Siempre incluir file si existe, independientemente del modo
        const fileUrl = this.materialsForm.controls.fileUrl.value;
        if (fileUrl) {
            result.file = fileUrl;
        }

        // Siempre incluir items si existen, independientemente del modo
        const materials = this.materialsArray.value
            .filter((m): m is { quantity: number | null; description: string } =>
                m !== null && m !== undefined &&
                m.quantity !== null && m.quantity !== undefined && m.quantity > 0 &&
                m.description !== null && m.description !== undefined && m.description.trim() !== ''
            )
            .map((m) => ({
                quantity: m.quantity!,
                description: m.description.trim()
            }));

        if (materials.length > 0) {
            result.items = materials;
        }

        // Retornar null si no hay file ni items
        if (!result.file && !result.items) {
            return null;
        }

        return result;
    }

    /**
     * Establece el valor de los materiales (para cargar datos existentes)
     * Permite tener file e items simultáneamente
     */
    setMaterialsValue(value: Materials | null | undefined): void {
        if (!value || (!value.file && !value.items)) {
            this.materialsForm.controls.inputMode.setValue('manual');
            this.materialsArray.clear();
            this.addMaterial();
            this.materialsForm.controls.fileUrl.setValue(null);
            this.uploadedFilePreview.set(null);
            return;
        }

        // Establecer file si existe (no cambiar el modo, solo establecer el valor)
        if (value.file) {
            this.materialsForm.controls.fileUrl.setValue(value.file);

            // Si es imagen, establecer preview
            if (this.isImageUrl(value.file)) {
                this.uploadedFilePreview.set(value.file);
            }
        }

        // Establecer items si existen
        if (value.items && Array.isArray(value.items) && value.items.length > 0) {
            this.materialsArray.clear();

            for (const material of value.items) {
                const materialGroup = this.fb.group({
                    quantity: [material.quantity, [Validators.required, Validators.min(1)]],
                    description: [material.description, [Validators.required]]
                }) as FormGroup<{
                    quantity: FormControl<number | null>;
                    description: FormControl<string>;
                }>;
                this.materialsArray.push(materialGroup);
            }
        } else if (!value.file) {
            // Si no hay file ni items, establecer modo manual con un campo vacío
            this.materialsForm.controls.inputMode.setValue('manual');
            this.materialsArray.clear();
            this.addMaterial();
        }

        // Determinar el modo inicial basado en qué datos existen
        // Si hay file, mostrar modo file; si hay items, mostrar modo manual
        // Si hay ambos, mostrar el modo que tenga más datos o file por defecto
        if (value.file && (!value.items || value.items.length === 0)) {
            this.materialsForm.controls.inputMode.setValue('file');
        } else if (value.items && value.items.length > 0 && !value.file) {
            this.materialsForm.controls.inputMode.setValue('manual');
        } else if (value.file && value.items && value.items.length > 0) {
            // Si hay ambos, mantener el modo actual o usar 'file' por defecto
            // No cambiar el modo para no confundir al usuario
        }
    }

    /**
     * Verifica si una URL es una imagen
     */
    protected isImageUrl(url: string): boolean {
        return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url) || url.startsWith('data:image/');
    }

    /**
     * Verifica si una URL es un PDF
     */
    protected isPdfUrl(url: string): boolean {
        return /\.pdf$/i.test(url);
    }
}

