import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera';

/**
 * Servicio para seleccionar medios (imágenes/videos) usando Capacitor Camera
 * Permite al usuario elegir entre cámara o galería nativamente
 */
@Injectable({
  providedIn: 'root'
})
export class MediaPickerService {
  private readonly isNative = Capacitor.isNativePlatform();

  /**
   * Selecciona un medio (imagen o video) desde la cámara o galería
   * @param allowMultiple - Si es true, permite seleccionar múltiples archivos (solo en web)
   * @returns Promise<File[]> - Array de archivos seleccionados
   */
  async pickMedia(allowMultiple = false): Promise<File[]> {
    if (!this.isNative) {
      // En web, usar input file como fallback
      return this.pickMediaWeb(allowMultiple);
    }

    // En nativo, usar Capacitor Camera
    return this.pickMediaNative();
  }

  /**
   * Selecciona medios en plataforma nativa (iOS/Android)
   * Nota: Camera.getPhoto solo permite un archivo a la vez
   */
  private async pickMediaNative(): Promise<File[]> {
    alert('[DEBUG] pickMediaNative - Starting media selection');
    try {
      alert('[DEBUG] Calling Camera.getPhoto...');
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt, // Permite elegir entre cámara o galería
        // No especificamos mediaType para permitir cualquier tipo (imagen o video)
      });

      alert(`[DEBUG] Camera.getPhoto successful - path: ${photo.path}, webPath: ${photo.webPath}`);
      
      // Convertir Photo a File
      alert('[DEBUG] Converting photo to file...');
      const file = await this.photoToFile(photo);
      alert(`[DEBUG] Photo converted to file - name: ${file.name}, size: ${file.size}, type: ${file.type}`);
      return [file];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      alert(`[DEBUG] Error picking media: ${errorName} - ${errorMsg}`);
      
      // Si el usuario cancela, retornar array vacío
      if (error && typeof error === 'object' && 'message' in error && error.message === 'User cancelled photos app') {
        alert('[DEBUG] User cancelled media selection');
        return [];
      }
      console.error('Error picking media:', error);
      throw error;
    }
  }

  /**
   * Selecciona medios en web usando input file
   */
  private pickMediaWeb(allowMultiple: boolean): Promise<File[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = allowMultiple;
      input.accept = 'image/*,video/*';

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

      // Disparar el click
      input.click();
    });
  }

  /**
   * Convierte un Photo de Capacitor a File
   */
  private async photoToFile(photo: Photo): Promise<File> {
    alert('[DEBUG] photoToFile - Starting conversion');
    let fileUri: string;
    let mimeType: string;
    let fileName: string;

    // Determinar la URI a usar
    if (photo.path) {
      alert(`[DEBUG] Using photo.path: ${photo.path}`);
      // En nativo, convertir el path usando Capacitor
      fileUri = Capacitor.convertFileSrc(photo.path);
      alert(`[DEBUG] Converted fileUri: ${fileUri}`);
      
      // Determinar tipo MIME y nombre de archivo desde el path
      const extension = photo.path.split('.').pop()?.toLowerCase() || 'jpg';
      mimeType = this.getMimeTypeFromExtension(extension);
      fileName = `media-${Date.now()}.${extension}`;
      alert(`[DEBUG] Detected extension: ${extension}, mimeType: ${mimeType}, fileName: ${fileName}`);
    } else if (photo.webPath) {
      alert(`[DEBUG] Using photo.webPath: ${photo.webPath}`);
      // En web, usar webPath directamente
      fileUri = photo.webPath;
      fileName = `media-${Date.now()}.jpg`;
      mimeType = 'image/jpeg';
    } else {
      alert('[DEBUG] ERROR: No valid path or webPath in photo');
      throw new Error('No valid path or webPath in photo');
    }

    // Obtener el archivo usando fetch
    try {
      alert(`[DEBUG] Fetching file from URI: ${fileUri}`);
      const response = await fetch(fileUri);
      alert(`[DEBUG] Fetch response status: ${response.status}, ok: ${response.ok}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      alert(`[DEBUG] Blob created - size: ${blob.size}, type: ${blob.type}`);
      
      // Usar el tipo MIME del blob si está disponible, sino usar el detectado
      const finalMimeType = blob.type || mimeType;
      alert(`[DEBUG] Final mimeType: ${finalMimeType}`);
      
      // Ajustar extensión si el tipo MIME es diferente
      if (blob.type && blob.type !== mimeType) {
        const correctExtension = this.getExtensionFromMimeType(blob.type);
        fileName = `media-${Date.now()}.${correctExtension}`;
        alert(`[DEBUG] Adjusted fileName to: ${fileName}`);
      }
      
      const file = new File([blob], fileName, { type: finalMimeType });
      alert(`[DEBUG] File created successfully - name: ${file.name}, size: ${file.size}, type: ${file.type}`);
      return file;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`[DEBUG] ERROR converting photo to file: ${errorMsg}`);
      console.error('Error converting photo to file:', error);
      throw new Error(`Failed to convert photo to file: ${errorMsg}`);
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
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'video/x-matroska': 'mkv',
      'video/webm': 'webm',
    };
    return extensions[mimeType.toLowerCase()] || 'jpg';
  }

  /**
   * Selecciona múltiples medios (solo funciona en web, en nativo selecciona uno a la vez)
   * @param maxFiles - Número máximo de archivos a seleccionar
   * @returns Promise<File[]> - Array de archivos seleccionados
   */
  async pickMultipleMedia(maxFiles = 10): Promise<File[]> {
    if (!this.isNative) {
      return this.pickMediaWeb(true);
    }

    // En nativo, permitir seleccionar uno a la vez
    const files: File[] = [];
    let continueSelecting = true;
    let count = 0;

    while (continueSelecting && count < maxFiles) {
      try {
        const selected = await this.pickMediaNative();
        if (selected.length > 0) {
          files.push(...selected);
          count++;
          // En una implementación real, podrías mostrar un diálogo preguntando si quiere agregar más
          // Por ahora, solo seleccionamos uno
          continueSelecting = false;
        } else {
          continueSelecting = false;
        }
      } catch (error) {
        console.error('Error selecting media:', error);
        continueSelecting = false;
      }
    }

    return files;
  }
}

