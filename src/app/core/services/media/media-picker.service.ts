import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';

import { LogService } from '../log/log.service';
import { PermissionsService } from '../permissions/permissions.service';

/**
 * Servicio para seleccionar medios (imágenes/videos) usando Capacitor Camera
 * Permite al usuario elegir entre cámara o galería nativamente
 */
@Injectable({
  providedIn: 'root'
})
export class MediaPickerService {
  private readonly isNative = Capacitor.isNativePlatform();
  private readonly platform = Capacitor.getPlatform();
  private readonly logService = inject(LogService);
  private readonly permissionsService = inject(PermissionsService);

  /**
   * Selecciona un medio (imagen, video o archivo) desde la cámara, galería o sistema de archivos
   * @param allowMultiple - Si es true, permite seleccionar múltiples archivos (solo en web)
   * @param imagesOnly - Si es true, solo permite seleccionar imágenes (deprecated, usar pickMediaWeb directamente)
   * @returns Promise<File[]> - Array de archivos seleccionados
   */
  async pickMedia(allowMultiple = false, imagesOnly = false): Promise<File[]> {
    if (!this.isNative) {
      // En web, usar input file como fallback
      return this.pickMediaWeb(allowMultiple, imagesOnly);
    }

    // En iOS, usar FilePicker para permitir videos y archivos
    // En Android, usar Camera para imágenes o FilePicker para videos/archivos
    if (this.platform === 'ios') {
      return this.pickMediaNativeIOS();
    }

    // En Android, usar Camera para imágenes simples
    return this.pickMediaNative();
  }

  /**
   * Selecciona medios en iOS usando FilePicker (permite imágenes, videos y archivos)
   */
  private async pickMediaNativeIOS(): Promise<File[]> {
    try {
      const result = await FilePicker.pickFiles({
        types: ['image/*', 'video/*', 'application/*', 'text/*'],
        readData: true
      });

      if (!result.files || result.files.length === 0) {
        return [];
      }

      const files: File[] = [];
      for (const pickedFile of result.files) {
        if (pickedFile.data) {
          // Convertir base64 a Blob
          const base64Data = pickedFile.data;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: pickedFile.mimeType || 'application/octet-stream' });

          const file = new File([blob], pickedFile.name || `file-${Date.now()}`, {
            type: pickedFile.mimeType || 'application/octet-stream'
          });
          files.push(file);
        } else if (pickedFile.path) {
          // Si no hay data pero hay path, usar fetch
          const fileUri = Capacitor.convertFileSrc(pickedFile.path);
          const response = await fetch(fileUri);
          const blob = await response.blob();
          const file = new File([blob], pickedFile.name || `file-${Date.now()}`, {
            type: pickedFile.mimeType || blob.type || 'application/octet-stream'
          });
          files.push(file);
        }
      }

      return files;
    } catch (error) {
      // Si el usuario cancela, retornar array vacío
      if (error && typeof error === 'object' && 'message' in error &&
        (error.message === 'User cancelled' || error.message === 'User canceled')) {
        return [];
      }

      // Registrar error en logs
      void this.logService.logError(
        'Error al seleccionar medio en iOS',
        error,
        {
          severity: 'medium',
          description: 'Error al seleccionar medio usando FilePicker en iOS',
          source: 'media-picker-service',
          metadata: {
            service: 'MediaPickerService',
            method: 'pickMediaNativeIOS',
            platform: 'ios'
          }
        }
      );

      throw error;
    }
  }

  /**
   * Selecciona medios en Android usando Camera (para imágenes) o FilePicker (para videos/archivos)
   */
  private async pickMediaNative(): Promise<File[]> {
    try {
      // Intentar primero con Camera para imágenes
      const photo = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        width: 1280,
        correctOrientation: true
      });

      // Convertir Photo a File
      const file = await this.photoToFile(photo);
      return [file];
    } catch (error) {
      // Si el usuario cancela o es un error de Camera, intentar con FilePicker
      if (error && typeof error === 'object' && 'message' in error &&
        (error.message === 'User cancelled photos app' || error.message === 'User cancelled')) {
        // Intentar con FilePicker como fallback
        try {
          return await this.pickMediaNativeWithFilePicker();
        } catch (filePickerError) {
          return [];
        }
      }

      // Si es otro error, intentar con FilePicker
      try {
        return await this.pickMediaNativeWithFilePicker();
      } catch (filePickerError) {
        // Registrar error en logs
        void this.logService.logError(
          'Error al seleccionar medio en Android',
          error,
          {
            severity: 'medium',
            description: 'Error al seleccionar medio usando Camera o FilePicker en Android',
            source: 'media-picker-service',
            metadata: {
              service: 'MediaPickerService',
              method: 'pickMediaNative',
              platform: 'android'
            }
          }
        );
        throw error;
      }
    }
  }

  /**
   * Selecciona medios usando FilePicker (para videos y archivos)
   */
  private async pickMediaNativeWithFilePicker(): Promise<File[]> {
    try {
      const result = await FilePicker.pickFiles({
        types: ['image/*', 'video/*', 'application/*', 'text/*'],
        readData: true
      });

      if (!result.files || result.files.length === 0) {
        return [];
      }

      const files: File[] = [];
      for (const pickedFile of result.files) {
        if (pickedFile.data) {
          const base64Data = pickedFile.data;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: pickedFile.mimeType || 'application/octet-stream' });

          const file = new File([blob], pickedFile.name || `file-${Date.now()}`, {
            type: pickedFile.mimeType || 'application/octet-stream'
          });
          files.push(file);
        } else if (pickedFile.path) {
          const fileUri = Capacitor.convertFileSrc(pickedFile.path);
          const response = await fetch(fileUri);
          const blob = await response.blob();
          const file = new File([blob], pickedFile.name || `file-${Date.now()}`, {
            type: pickedFile.mimeType || blob.type || 'application/octet-stream'
          });
          files.push(file);
        }
      }

      return files;
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error &&
        (error.message === 'User cancelled' || error.message === 'User canceled')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Selecciona medios en web usando input file
   * @param allowMultiple - Si es true, permite seleccionar múltiples archivos
   * @param imagesOnly - Si es true, solo permite seleccionar imágenes
   */
  private pickMediaWeb(allowMultiple: boolean, imagesOnly = false): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = allowMultiple;

      // Configurar accept para permitir imágenes, videos y archivos
      // IMPORTANTE: iOS requiere tipos específicos explícitos para videos
      if (imagesOnly) {
        input.accept = 'image/*,image/heic,image/heif';
      } else {
        // Permitir imágenes, videos (con tipos específicos para iOS) y archivos comunes
        input.accept = 'image/*,video/mp4,video/x-m4v,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,image/heic,image/heif';
      }

      input.onchange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          const fileArray = Array.from(files);

          // Validar que solo sean imágenes si imagesOnly es true
          if (imagesOnly) {
            const invalidFiles = fileArray.filter(file => !file.type.startsWith('image/'));
            if (invalidFiles.length > 0) {
              reject(new Error('Solo se permiten imágenes. Por favor, selecciona solo archivos de imagen.'));
              return;
            }
          }

          resolve(fileArray);
        } else {
          resolve([]);
        }
      };

      input.oncancel = () => {
        resolve([]);
      };

      input.onerror = (error) => {
        // Registrar error en logs
        void this.logService.logError(
          'Error al seleccionar medio en web',
          error,
          {
            severity: 'medium',
            description: 'Error al seleccionar medio usando input file en web',
            source: 'media-picker-service',
            metadata: {
              service: 'MediaPickerService',
              method: 'pickMediaWeb',
              platform: 'web',
              allowMultiple
            }
          }
        );

        reject(error);
      };

      // Disparar el click
      input.click();
    });
  }

  /**
   * Convierte un Photo de Capacitor a File
   */
  private async photoToFile(photo: Photo): Promise<File> {
    console.log('[MediaPickerService] photoToFile: Iniciando conversión', {
      hasPath: !!photo.path,
      hasWebPath: !!photo.webPath,
      format: photo.format,
      path: photo.path,
      webPath: photo.webPath
    });

    let fileUri: string;
    let mimeType: string;
    let fileName: string;

    // Determinar la URI a usar
    if (photo.path) {
      // En nativo, convertir el path usando Capacitor
      fileUri = Capacitor.convertFileSrc(photo.path);
      console.log('[MediaPickerService] photoToFile: Usando path nativo', {
        originalPath: photo.path,
        convertedUri: fileUri
      });

      // Determinar tipo MIME y nombre de archivo desde el path
      const extension = photo.path.split('.').pop()?.toLowerCase() || 'jpg';
      mimeType = this.getMimeTypeFromExtension(extension);
      fileName = `media-${Date.now()}.${extension}`;
      console.log('[MediaPickerService] photoToFile: Detectado desde path', {
        extension,
        mimeType,
        fileName
      });
    } else if (photo.webPath) {
      // En web, usar webPath directamente
      fileUri = photo.webPath;
      fileName = `media-${Date.now()}.jpg`;
      mimeType = 'image/jpeg';
      console.log('[MediaPickerService] photoToFile: Usando webPath', {
        webPath: photo.webPath,
        mimeType,
        fileName
      });
    } else {
      console.error('[MediaPickerService] photoToFile: No hay path ni webPath válido');
      throw new Error('No valid path or webPath in photo');
    }

    // Obtener el archivo usando fetch
    try {
      console.log('[MediaPickerService] photoToFile: Fetching file desde URI:', fileUri);
      const response = await fetch(fileUri);

      if (!response.ok) {
        console.error('[MediaPickerService] photoToFile: Error en fetch', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }

      console.log('[MediaPickerService] photoToFile: Response headers:', {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });

      const blob = await response.blob();
      console.log('[MediaPickerService] photoToFile: Blob obtenido', {
        type: blob.type,
        size: blob.size,
        mimeTypeDetected: mimeType
      });

      if (!blob || blob.size === 0) {
        console.error('[MediaPickerService] photoToFile: Blob vacío');
        throw new Error('File is empty');
      }

      // Validación de seguridad para evitar crashes por memoria en dispositivos móviles
      // 50MB es un límite seguro para manejar en memoria (blob)
      if (this.isNative && blob.size > 50 * 1024 * 1024) {
        console.error('[MediaPickerService] photoToFile: Archivo muy grande', {
          size: blob.size,
          maxSize: 50 * 1024 * 1024
        });
        throw new Error('File is too large for mobile upload. Please choose a smaller file or shorter video (max 50MB).');
      }

      // Usar el tipo MIME del blob si está disponible, sino usar el detectado
      const finalMimeType = blob.type || mimeType;
      console.log('[MediaPickerService] photoToFile: Tipo MIME final', {
        blobType: blob.type,
        detectedMimeType: mimeType,
        finalMimeType
      });

      // Ajustar extensión si el tipo MIME es diferente
      if (blob.type && blob.type !== mimeType) {
        const correctExtension = this.getExtensionFromMimeType(blob.type);
        fileName = `media-${Date.now()}.${correctExtension}`;
        console.log('[MediaPickerService] photoToFile: Ajustando extensión', {
          oldExtension: fileName.split('.').pop(),
          newExtension: correctExtension,
          newFileName: fileName
        });
      }

      const file = new File([blob], fileName, { type: finalMimeType });
      console.log('[MediaPickerService] photoToFile: File creado exitosamente', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      return file;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Registrar error en logs
      void this.logService.logError(
        'Error al convertir Photo a File',
        error,
        {
          severity: errorMsg.includes('too large') ? 'high' : 'medium',
          description: `Error al convertir Photo de Capacitor a File: ${errorMsg}`,
          source: 'media-picker-service',
          metadata: {
            service: 'MediaPickerService',
            method: 'photoToFile',
            platform: this.isNative ? 'native' : 'web',
            photoPath: photo.path,
            photoWebPath: photo.webPath
          }
        }
      );

      if (errorMsg.includes('too large')) {
        throw error; // Re-lanzar error de tamaño específico
      }
      throw new Error(`Failed to load file. It might be too large or format is unsupported: ${errorMsg}`);
    }
  }

  /**
   * Obtiene el tipo MIME desde la extensión
   */
  /**
   * Obtiene el tipo MIME desde la extensión - SIN RESTRICCIONES, acepta cualquier formato
   */
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      // Imágenes comunes
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      svg: 'image/svg+xml',
      // Videos comunes y extendidos (sin restricciones)
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
      m4v: 'video/x-m4v',
      '3gp': 'video/3gpp',
      '3g2': 'video/3gpp2',
      flv: 'video/x-flv',
      wmv: 'video/x-ms-wmv',
      asf: 'video/x-ms-asf',
      rm: 'video/vnd.rn-realvideo',
      rmvb: 'video/vnd.rn-realvideo',
      vob: 'video/dvd',
      ogv: 'video/ogg',
      mts: 'video/mp2t',
      m2ts: 'video/mp2t',
      ts: 'video/mp2t',
      divx: 'video/divx',
      xvid: 'video/xvid',
      f4v: 'video/x-f4v',
      mxf: 'application/mxf',
      mpg: 'video/mpeg',
      mpeg: 'video/mpeg',
      mpv: 'video/mpv',
      qt: 'video/quicktime',
    };
    const ext = extension.toLowerCase();
    // Si conocemos el tipo, usarlo; si no, retornar genérico según extensión
    if (mimeTypes[ext]) {
      return mimeTypes[ext];
    }
    // Si parece video, retornar video genérico
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp', '3g2', 'flv', 'wmv', 'asf', 'rm', 'rmvb', 'vob', 'ogv', 'mts', 'm2ts', 'ts', 'divx', 'xvid', 'f4v', 'mxf', 'mpg', 'mpeg', 'mpv', 'qt'].includes(ext)) {
      return 'video/*';
    }
    // Si parece imagen, retornar image genérico
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'tif', 'svg'].includes(ext)) {
      return 'image/*';
    }
    // Por defecto, retornar application/octet-stream para aceptar cualquier cosa
    return 'application/octet-stream';
  }

  /**
   * Obtiene la extensión desde el tipo MIME - SIN RESTRICCIONES
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      // Imágenes
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff',
      'image/svg+xml': 'svg',
      // Videos (lista ampliada sin restricciones)
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'video/x-matroska': 'mkv',
      'video/webm': 'webm',
      'video/x-m4v': 'm4v',
      'video/3gpp': '3gp',
      'video/3gpp2': '3g2',
      'video/x-flv': 'flv',
      'video/x-ms-wmv': 'wmv',
      'video/x-ms-asf': 'asf',
      'video/vnd.rn-realvideo': 'rm',
      'video/dvd': 'vob',
      'video/ogg': 'ogv',
      'video/mp2t': 'ts',
      'video/divx': 'divx',
      'video/xvid': 'xvid',
      'video/x-f4v': 'f4v',
      'application/mxf': 'mxf',
      'video/mpeg': 'mpg',
      'video/mpv': 'mpv',
    };
    const mime = mimeType.toLowerCase();
    // Si conocemos la extensión, usarla
    if (extensions[mime]) {
      return extensions[mime];
    }
    // Si es video/* genérico, usar mp4 por defecto
    if (mime.startsWith('video/')) {
      return 'mp4';
    }
    // Si es image/* genérico, usar jpg por defecto
    if (mime.startsWith('image/')) {
      return 'jpg';
    }
    // Por defecto, usar extensión genérica
    return 'bin';
  }

  /**
   * Selecciona solo imágenes (nativo en iOS usando Camera/Photo Library)
   * @param allowMultiple - Si es true, permite seleccionar múltiples imágenes
   * @returns Promise<File[]> - Array de archivos de imagen seleccionados
   */
  async pickImages(allowMultiple = false): Promise<File[]> {
    if (!this.isNative) {
      return this.pickMediaWeb(allowMultiple, true);
    }

    if (this.platform === 'ios') {
      // iOS: usar picker nativo (Photos/Camera). iOS no permite selección múltiple nativa.
      return this.pickImagesNativeIOS(allowMultiple);
    }

    // Android
    return this.pickImagesNativeAndroid(allowMultiple);
  }

  /**
   * Selecciona solo videos (nativo en iOS usando Camera para experiencia "igual a imágenes")
   * @param allowMultiple - Si es true, permite seleccionar múltiples videos
   * @returns Promise<File[]> - Array de archivos de video seleccionados
   */
  async pickVideos(allowMultiple = false): Promise<File[]> {
    if (!this.isNative) {
      return this.pickVideosWeb(allowMultiple);
    }

    /**
     * IMPORTANTE (iOS):
     * - Usamos Camera.getPhoto igual que para imágenes, que muestra TODA la galería (imágenes y videos)
     * - Luego validamos que el archivo seleccionado sea un video
     * - Esto garantiza la experiencia nativa "igual a imágenes"
     */
    if (this.platform === 'ios') {
      return this.pickVideosNativeIOS(allowMultiple);
    }

    // Android: usar FilePicker para videos
    return this.pickVideosNative(allowMultiple);
  }

  /**
   * Selecciona solo archivos/documentos (nativo en iOS usando FilePicker)
   * @param allowMultiple - Si es true, permite seleccionar múltiples archivos
   * @returns Promise<File[]> - Array de archivos seleccionados
   */
  async pickFiles(allowMultiple = false): Promise<File[]> {
    if (!this.isNative) {
      return this.pickFilesWeb(allowMultiple);
    }

    // En iOS y Android, usar FilePicker para archivos
    return this.pickFilesNative(allowMultiple);
  }

  /**
   * Captura una imagen directamente desde la cámara
   * @returns Promise<File[]> - Array con un solo archivo de imagen capturado
   */
  async captureImageFromCamera(): Promise<File[]> {
    if (!this.isNative) {
      // En web, usar input con capture="camera"
      return this.captureImageFromCameraWeb();
    }

    try {
      // Solicitar permisos de cámara
      const hasPermission = await this.permissionsService.requestCameraPermission();
      if (!hasPermission) {
        throw new Error('Camera permission denied');
      }

      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        width: 1920,
        correctOrientation: true
      });

      const file = await this.photoToFile(photo);
      return [file];
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error &&
        (error.message === 'User cancelled' || error.message === 'User canceled' ||
          error.message === 'Camera permission denied')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Captura un video directamente desde la cámara
   * @returns Promise<File[]> - Array con un solo archivo de video capturado
   * 
   * NOTA: Capacitor Camera API solo soporta fotos, no videos.
   * Para iOS nativo, FilePicker mostrará el selector nativo que incluye la opción
   * de "Tomar foto o video" que permite capturar directamente desde la cámara.
   */
  async captureVideoFromCamera(): Promise<File[]> {
    if (!this.isNative) {
      // En web, usar input con capture="camera" que funciona nativamente en iOS Safari
      return this.captureVideoFromCameraWeb();
    }

    try {
      // Solicitar permisos de cámara
      const hasPermission = await this.permissionsService.requestCameraPermission();
      if (!hasPermission) {
        throw new Error('Camera permission denied');
      }

      if (this.platform === 'ios') {
        /**
         * iOS nativo (Capacitor):
         * La API de Camera de Capacitor no soporta video directamente.
         * Sin embargo, dentro del WebView sí funciona un `<input type="file" accept="video/*" capture="environment">`,
         * que abre la cámara nativa de iOS en modo video.
         *
         * Para garantizar la experiencia \"igual a Take Photo\", reutilizamos el flujo web
         * que abre directamente la cámara en lugar del FilePicker.
         */
        return this.captureVideoFromCameraWeb();
      }

      // Android: usar FilePicker que puede abrir la cámara
      const result = await FilePicker.pickFiles({
        types: ['video/mp4', 'video/*'],
        readData: true
      });

      if (!result.files || result.files.length === 0) {
        return [];
      }

      return await this.convertPickedFilesToFiles(result.files.slice(0, 1), true);
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error &&
        (error.message === 'User cancelled' || error.message === 'User canceled' ||
          error.message === 'Camera permission denied')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Captura imagen desde la cámara en web usando input con capture
   */
  private captureImageFromCameraWeb(): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // Usar cámara trasera en móviles

      input.onchange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          resolve(Array.from(files));
        } else {
          resolve([]);
        }
      };

      input.oncancel = () => {
        resolve([]);
      };

      input.onerror = (error) => {
        reject(error);
      };

      input.click();
    });
  }

  /**
   * Captura video desde la cámara en web usando input con capture
   */
  private captureVideoFromCameraWeb(): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      input.capture = 'environment'; // Usar cámara trasera en móviles

      input.onchange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          resolve(Array.from(files));
        } else {
          resolve([]);
        }
      };

      input.oncancel = () => {
        resolve([]);
      };

      input.onerror = (error) => {
        reject(error);
      };

      input.click();
    });
  }

  /**
   * Selecciona imágenes en iOS nativo usando Camera (permite Photo Library y Camera)
   */
  private async pickImagesNativeIOS(allowMultiple: boolean): Promise<File[]> {
    try {
      // Solicitar permisos de galería antes de acceder
      const hasPermission = await this.permissionsService.requestPhotoLibraryPermission();
      if (!hasPermission) {
        throw new Error('Photo library permission denied');
      }

      // iOS: Camera con Photos (nativo). No hay múltiple selección nativa; devolvemos solo uno.
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        width: 1920,
        correctOrientation: true
      });

      const file = await this.photoToFile(photo);
      return [file];
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error &&
        (error.message === 'User cancelled' || error.message === 'User canceled' ||
          error.message === 'User cancelled photos app' || error.message === 'Photo library permission denied')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Selecciona imágenes en Android nativo usando Camera
   */
  private async pickImagesNativeAndroid(allowMultiple: boolean): Promise<File[]> {
    try {
      if (allowMultiple) {
        // Para múltiples imágenes en Android, usar FilePicker
        const result = await FilePicker.pickFiles({
          types: ['image/*'],
          readData: true
        });

        if (!result.files || result.files.length === 0) {
          return [];
        }

        return await this.convertPickedFilesToFiles(result.files);
      } else {
        // Para una sola imagen, usar Camera
        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt, // Permite elegir entre Camera o Gallery
          width: 1920,
          correctOrientation: true
        });

        const file = await this.photoToFile(photo);
        return [file];
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error &&
        (error.message === 'User cancelled' || error.message === 'User canceled' ||
          error.message === 'User cancelled photos app')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Selecciona videos nativo usando FilePicker (Android)
   */
  private async pickVideosNative(allowMultiple: boolean): Promise<File[]> {
    try {
      // Solicitar permisos de galería antes de acceder
      const hasPermission = await this.permissionsService.requestPhotoLibraryPermission();
      if (!hasPermission) {
        throw new Error('Photo library permission denied');
      }

      // Usar tipos específicos de video para mejor compatibilidad con iOS y Android
      const result = await FilePicker.pickFiles({
        types: [
          'public.movie',
          'public.video',
          'public.mpeg-4',
          'com.apple.quicktime-movie',
          'video/mp4',
          'video/x-m4v',
          'video/quicktime',
          'video/*',
        ],
        readData: true
      });

      if (!result.files || result.files.length === 0) {
        return [];
      }

      // Validar que todos los archivos sean videos
      const videoFiles = result.files.filter(file => {
        const mimeType = file.mimeType || '';
        return mimeType.startsWith('video/');
      });

      if (videoFiles.length === 0) {
        return [];
      }

      // FilePicker permite múltiples archivos por defecto, limitar si es necesario
      const filesToProcess = allowMultiple ? videoFiles : videoFiles.slice(0, 1);
      return await this.convertPickedFilesToFiles(filesToProcess, true); // Validar que sean videos
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error &&
        (error.message === 'User cancelled' || error.message === 'User canceled' ||
          error.message === 'Photo library permission denied')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Selecciona videos en iOS usando FilePicker.pickVideos()
   * Este método usa PHPickerViewController nativo de iOS que abre la galería de fotos mostrando videos
   * SIN restricciones de formato - acepta cualquier tipo de video
   */
  private async pickVideosNativeIOS(allowMultiple: boolean): Promise<File[]> {
    try {
      console.log('[MediaPickerService] pickVideosNativeIOS: Usando FilePicker.pickVideos() para galería nativa');

      // 1. Solicitar permisos
      const hasPermission = await this.permissionsService.requestPhotoLibraryPermission();
      if (!hasPermission) {
        console.error('[MediaPickerService] Permiso de galería denegado');
        void this.logService.logError(
          'Photo library permission denied for videos',
          new Error('Photo library permission not granted'),
          {
            severity: 'medium',
            description: 'User denied photo library access or only granted limited access',
            source: 'media-picker-service',
            metadata: {
              service: 'MediaPickerService',
              method: 'pickVideosNativeIOS',
              platform: 'ios',
              allowMultiple,
              hasPermission
            }
          }
        );
        throw new Error('Photo library permission denied. Please grant full access to all photos in Settings.');
      }

      // 2. Usar FilePicker.pickVideos() - Este método específico abre la galería nativa usando PHPickerViewController
      // En iOS, esto abre la galería de fotos nativa mostrando videos (no el selector de archivos)
      // IMPORTANTE: habilitar skipTranscoding para evitar que iOS recodifique y reduzca la calidad del video.
      const result = await FilePicker.pickVideos({
        limit: allowMultiple ? 10 : 1, // Número máximo de videos a seleccionar
        readData: true,
        skipTranscoding: true
      });

      console.log('[MediaPickerService] FilePicker.pickVideos() completado. Archivos seleccionados:', result.files?.length || 0);

      if (!result.files || result.files.length === 0) {
        console.log('[MediaPickerService] No se seleccionaron videos');
        return [];
      }

      // 3. Procesar archivos - ACEPTAR CUALQUIER ARCHIVO (sin restricciones de formato)
      // pickVideos() ya filtra por videos, pero procesamos todos sin restricciones adicionales
      const allFiles = await this.convertPickedFilesToFiles(result.files, false);

      // Aceptar todos los archivos retornados por pickVideos() sin filtros adicionales
      const files: File[] = [];

      for (const file of allFiles) {
        const mimeType = file.type || '';
        const fileName = file.name || '';

        // pickVideos() ya debería retornar solo videos, pero aceptamos todo sin restricciones
        console.log('[MediaPickerService] ✅ Video aceptado:', {
          name: fileName,
          type: mimeType,
          size: file.size
        });
        files.push(file);
      }

      // Limitar cantidad si es necesario
      const finalFiles = allowMultiple ? files : files.slice(0, 1);

      if (finalFiles.length === 0) {
        console.log('[MediaPickerService] No se encontraron videos válidos');
        return [];
      }

      console.log('[MediaPickerService] ✅ Selección completada:', {
        videosSeleccionados: finalFiles.length,
        totalArchivos: result.files.length
      });

      return finalFiles;

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (msg.includes('cancelled') || msg.includes('canceled')) {
        return [];
      }

      console.error('[MediaPickerService] Error en pickVideosNativeIOS:', error);

      void this.logService.logError(
        'Error selecting videos in iOS',
        error,
        {
          severity: 'medium',
          description: `Error selecting videos using FilePicker.pickVideos(): ${msg}`,
          source: 'media-picker-service',
          metadata: { method: 'pickVideosNativeIOS', platform: 'ios', allowMultiple }
        }
      );

      throw error;
    }
  }

  /**
   * Fallback: Usa FilePicker para seleccionar videos en iOS
   * FilePicker puede abrir el selector de archivos, pero permite seleccionar videos específicamente
   */
  private async pickVideosNativeIOSWithFilePicker(allowMultiple: boolean): Promise<File[]> {
    try {
      console.log('[MediaPickerService] pickVideosNativeIOSWithFilePicker: Usando FilePicker para videos');

      // Usar UTIs específicos de iOS para videos que deberían abrir la galería de fotos
      const result = await FilePicker.pickFiles({
        types: [
          'public.movie',           // UTI para videos en general
          'public.video',           // UTI alternativo para videos
          'public.mpeg-4',          // MP4
          'com.apple.quicktime-movie', // MOV (QuickTime)
          'video/mp4',
          'video/x-m4v',
          'video/quicktime',
          'video/*'
        ],
        readData: true
      });

      if (!result.files || result.files.length === 0) {
        console.log('[MediaPickerService] No se seleccionaron archivos con FilePicker');
        return [];
      }

      // Validar que todos sean videos
      const videoFiles = result.files.filter(file => {
        const mimeType = file.mimeType || '';
        const isVideo = mimeType.startsWith('video/') ||
          file.name?.toLowerCase().match(/\.(mp4|mov|m4v|avi|mkv|webm)$/);
        return isVideo;
      });

      if (videoFiles.length === 0) {
        console.warn('[MediaPickerService] FilePicker no retornó videos válidos');
        return [];
      }

      const filesToProcess = allowMultiple ? videoFiles : videoFiles.slice(0, 1);
      return await this.convertPickedFilesToFiles(filesToProcess, true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes('cancelled') || errorMsg.includes('canceled')) {
        return [];
      }

      console.error('[MediaPickerService] Error en pickVideosNativeIOSWithFilePicker:', error);
      throw error;
    }
  }

  /**
   * Selecciona archivos/documentos nativo usando FilePicker
   */
  private async pickFilesNative(allowMultiple: boolean): Promise<File[]> {
    try {
      const result = await FilePicker.pickFiles({
        types: ['application/*', 'text/*'],
        readData: true
      });

      if (!result.files || result.files.length === 0) {
        return [];
      }

      // FilePicker permite múltiples archivos por defecto, limitar si es necesario
      const filesToProcess = allowMultiple ? result.files : result.files.slice(0, 1);
      return await this.convertPickedFilesToFiles(filesToProcess);
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error &&
        (error.message === 'User cancelled' || error.message === 'User canceled')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Selecciona videos en web
   * IMPORTANTE: iOS requiere un atributo accept más específico para mostrar videos correctamente
   */
  private pickVideosWeb(allowMultiple: boolean): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = allowMultiple;
      // SIN RESTRICCIONES: aceptar cualquier formato de video
      // Lista ampliada de tipos para iOS y otros navegadores
      input.accept = 'video/*,video/mp4,video/quicktime,video/x-m4v,video/x-msvideo,video/x-matroska,video/webm,video/3gpp,video/3gpp2,video/x-flv,video/x-ms-wmv,video/ogg,video/mpeg';

      input.onchange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          const fileArray = Array.from(files);
          // SIN RESTRICCIONES: aceptar cualquier archivo seleccionado
          // Solo excluir si es claramente una imagen
          const validFiles = fileArray.filter(file => {
            const isImage = file.type.startsWith('image/');
            // Si es imagen, verificar extensión para estar seguro
            if (isImage && !file.name.toLowerCase().match(/\.(mp4|mov|m4v|avi|mkv|webm|3gp|3g2|flv|wmv|asf|rm|rmvb|vob|ogv|mts|m2ts|ts|divx|xvid|f4v|mxf|mpg|mpeg|mpv|qt)$/i)) {
              return false; // Es imagen, excluir
            }
            return true; // Aceptar todo lo demás sin restricciones
          });
          resolve(validFiles);
        } else {
          resolve([]);
        }
      };

      input.oncancel = () => resolve([]);
      input.onerror = (error) => reject(error);
      input.click();
    });
  }

  /**
   * Selecciona archivos/documentos en web
   */
  private pickFilesWeb(allowMultiple: boolean): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = allowMultiple;
      input.accept = 'application/*,text/*,.pdf,.doc,.docx,.txt';

      input.onchange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          const fileArray = Array.from(files);
          const invalidFiles = fileArray.filter(file =>
            !file.type.startsWith('application/') &&
            !file.type.startsWith('text/') &&
            file.type !== ''
          );
          if (invalidFiles.length > 0) {
            reject(new Error('Only document files are allowed'));
            return;
          }
          resolve(fileArray);
        } else {
          resolve([]);
        }
      };

      input.oncancel = () => resolve([]);
      input.onerror = (error) => reject(error);
      input.click();
    });
  }

  /**
   * Convierte archivos seleccionados por FilePicker a File[]
   * @param pickedFiles - Array de archivos seleccionados por FilePicker
   * @param validateVideoType - Si es true, valida que todos los archivos sean videos
   */
  private async convertPickedFilesToFiles(pickedFiles: any[], validateVideoType = false): Promise<File[]> {
    const files: File[] = [];
    for (const pickedFile of pickedFiles) {
      let mimeType = pickedFile.mimeType || 'application/octet-stream';
      let blob: Blob;

      if (pickedFile.data) {
        const base64Data = pickedFile.data;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mimeType });
      } else if (pickedFile.path) {
        // Si no hay data pero hay path, usar fetch
        const fileUri = Capacitor.convertFileSrc(pickedFile.path);
        const response = await fetch(fileUri);
        blob = await response.blob();
        // Usar el tipo MIME del blob si está disponible
        mimeType = blob.type || mimeType;
      } else {
        continue; // Saltar archivos sin data ni path
      }

      // Validar que sea video si se requiere
      if (validateVideoType && !mimeType.startsWith('video/')) {
        continue; // Saltar archivos que no sean videos
      }

      const file = new File([blob], pickedFile.name || `file-${Date.now()}`, {
        type: mimeType
      });
      files.push(file);
    }
    return files;
  }

  /**
   * Selecciona múltiples medios (imágenes, videos y archivos)
   * @param maxFiles - Número máximo de archivos a seleccionar
   * @param imagesOnly - Deprecated: ya no se usa, se permiten todos los tipos
   * @returns Promise<File[]> - Array de archivos seleccionados
   */
  async pickMultipleMedia(maxFiles = 10, imagesOnly = false): Promise<File[]> {
    if (!this.isNative) {
      return this.pickMediaWeb(true, false); // Siempre permitir todos los tipos en web
    }

    // En iOS, usar FilePicker que permite múltiples archivos
    if (this.platform === 'ios') {
      try {
        const result = await FilePicker.pickFiles({
          types: ['image/*', 'video/*', 'application/*', 'text/*'],
          readData: true
        });

        if (!result.files || result.files.length === 0) {
          return [];
        }

        // Limitar al máximo de archivos
        const filesToProcess = result.files.slice(0, maxFiles);
        const files: File[] = [];

        for (const pickedFile of filesToProcess) {
          if (pickedFile.data) {
            const base64Data = pickedFile.data;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: pickedFile.mimeType || 'application/octet-stream' });

            const file = new File([blob], pickedFile.name || `file-${Date.now()}`, {
              type: pickedFile.mimeType || 'application/octet-stream'
            });
            files.push(file);
          } else if (pickedFile.path) {
            const fileUri = Capacitor.convertFileSrc(pickedFile.path);
            const response = await fetch(fileUri);
            const blob = await response.blob();
            const file = new File([blob], pickedFile.name || `file-${Date.now()}`, {
              type: pickedFile.mimeType || blob.type || 'application/octet-stream'
            });
            files.push(file);
          }
        }

        return files;
      } catch (error) {
        if (error && typeof error === 'object' && 'message' in error &&
          (error.message === 'User cancelled' || error.message === 'User canceled')) {
          return [];
        }
        throw error;
      }
    }

    // En Android, permitir seleccionar uno a la vez
    const files: File[] = [];
    let continueSelecting = true;
    let count = 0;

    while (continueSelecting && count < maxFiles) {
      try {
        const selected = await this.pickMediaNative();
        if (selected.length > 0) {
          files.push(...selected);
          count++;
          continueSelecting = false; // Por ahora solo uno
        } else {
          continueSelecting = false;
        }
      } catch (error) {
        continueSelecting = false;
      }
    }

    return files;
  }
}
