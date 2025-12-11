import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';

import { LogService } from '../log/log.service';

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
      if (imagesOnly) {
        input.accept = 'image/*,image/heic,image/heif';
      } else {
        // Permitir imágenes, videos y archivos comunes
        input.accept = 'image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,image/heic,image/heif';
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
    let fileUri: string;
    let mimeType: string;
    let fileName: string;

    // Determinar la URI a usar
    if (photo.path) {
      // En nativo, convertir el path usando Capacitor
      fileUri = Capacitor.convertFileSrc(photo.path);

      // Determinar tipo MIME y nombre de archivo desde el path
      const extension = photo.path.split('.').pop()?.toLowerCase() || 'jpg';
      mimeType = this.getMimeTypeFromExtension(extension);
      fileName = `media-${Date.now()}.${extension}`;
    } else if (photo.webPath) {
      // En web, usar webPath directamente
      fileUri = photo.webPath;
      fileName = `media-${Date.now()}.jpg`;
      mimeType = 'image/jpeg';
    } else {
      throw new Error('No valid path or webPath in photo');
    }

    // Obtener el archivo usando fetch
    try {
      const response = await fetch(fileUri);

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error('File is empty');
      }

      // Validación de seguridad para evitar crashes por memoria en dispositivos móviles
      // 50MB es un límite seguro para manejar en memoria (blob)
      if (this.isNative && blob.size > 50 * 1024 * 1024) {
        throw new Error('File is too large for mobile upload. Please choose a smaller file or shorter video (max 50MB).');
      }

      // Usar el tipo MIME del blob si está disponible, sino usar el detectado
      const finalMimeType = blob.type || mimeType;

      // Ajustar extensión si el tipo MIME es diferente
      if (blob.type && blob.type !== mimeType) {
        const correctExtension = this.getExtensionFromMimeType(blob.type);
        fileName = `media-${Date.now()}.${correctExtension}`;
      }

      const file = new File([blob], fileName, { type: finalMimeType });
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
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
    };
    return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Obtiene la extensión desde el tipo MIME
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'video/x-matroska': 'mkv',
      'video/webm': 'webm',
    };
    return extensions[mimeType.toLowerCase()] || 'jpg';
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
      return this.pickImagesNativeIOS(allowMultiple);
    }

    // Android
    return this.pickImagesNativeAndroid(allowMultiple);
  }

  /**
   * Selecciona solo videos (nativo en iOS usando FilePicker)
   * @param allowMultiple - Si es true, permite seleccionar múltiples videos
   * @returns Promise<File[]> - Array de archivos de video seleccionados
   */
  async pickVideos(allowMultiple = false): Promise<File[]> {
    if (!this.isNative) {
      return this.pickVideosWeb(allowMultiple);
    }

    // En iOS y Android, usar FilePicker para videos
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
   * Selecciona imágenes en iOS nativo usando Camera (permite Photo Library y Camera)
   */
  private async pickImagesNativeIOS(allowMultiple: boolean): Promise<File[]> {
    try {
      if (allowMultiple) {
        // Para múltiples imágenes en iOS, usar FilePicker
        const result = await FilePicker.pickFiles({
          types: ['image/*'],
          readData: true
        });

        if (!result.files || result.files.length === 0) {
          return [];
        }

        return await this.convertPickedFilesToFiles(result.files);
      } else {
        // Para una sola imagen, usar Camera que abre nativamente Photo Library o Camera
        const photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos, // Abre Photo Library nativamente
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
   * Selecciona videos nativo usando FilePicker
   */
  private async pickVideosNative(allowMultiple: boolean): Promise<File[]> {
    try {
      const result = await FilePicker.pickFiles({
        types: ['video/*'],
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
   */
  private pickVideosWeb(allowMultiple: boolean): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = allowMultiple;
      input.accept = 'video/*';

      input.onchange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
          const fileArray = Array.from(files);
          const invalidFiles = fileArray.filter(file => !file.type.startsWith('video/'));
          if (invalidFiles.length > 0) {
            reject(new Error('Only video files are allowed'));
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
   */
  private async convertPickedFilesToFiles(pickedFiles: any[]): Promise<File[]> {
    const files: File[] = [];
    for (const pickedFile of pickedFiles) {
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

