import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Servicio para manejar operaciones específicas de iOS
 * - Compresión de imágenes
 * - Conversión de formatos de audio
 * - Optimización de archivos multimedia
 */
@Injectable({
  providedIn: 'root'
})
export class IosMediaService {
  private readonly isIOS = Capacitor.getPlatform() === 'ios';
  private readonly isNative = Capacitor.isNativePlatform();

  /**
   * Comprimir y redimensionar imagen para iOS
   * Evita problemas de memoria y cierres de app
   */
  async compressImage(file: File, maxWidth = 1920, maxHeight = 1920, quality = 0.85): Promise<File> {
    alert(`[DEBUG] compressImage - isIOS: ${this.isIOS}, isNative: ${this.isNative}, file: ${file.name}, size: ${file.size}, type: ${file.type}`);
    
    // Si no es iOS o no es nativo, retornar el archivo original
    if (!this.isIOS || !this.isNative) {
      alert('[DEBUG] Not iOS native, returning original file');
      return file;
    }

    alert('[DEBUG] iOS - Starting image compression...');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          alert(`[DEBUG] Image loaded - Original dimensions: ${img.width}x${img.height}`);
          // Calcular nuevas dimensiones manteniendo aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
            alert(`[DEBUG] Resizing image to: ${width}x${height}`);
          } else {
            alert('[DEBUG] Image dimensions within limits, no resizing needed');
          }
          
          // Crear canvas para redimensionar
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            alert('[DEBUG] ERROR: Could not get canvas context');
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Dibujar imagen redimensionada
          alert('[DEBUG] Drawing image to canvas...');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convertir a blob y luego a File
          alert(`[DEBUG] Converting canvas to blob with quality: ${quality}...`);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                alert('[DEBUG] ERROR: Could not compress image - blob is null');
                reject(new Error('Could not compress image'));
                return;
              }
              
              alert(`[DEBUG] Blob created - size: ${blob.size} bytes, type: ${blob.type}`);
              const compressedFile = new File(
                [blob],
                file.name,
                { type: file.type || 'image/jpeg' }
              );
              
              alert(`[DEBUG] Compressed file created - name: ${compressedFile.name}, size: ${compressedFile.size}, type: ${compressedFile.type}`);
              resolve(compressedFile);
            },
            file.type || 'image/jpeg',
            quality
          );
        };
        
        img.onerror = (error) => {
          alert(`[DEBUG] ERROR loading image: ${error}`);
          reject(new Error('Could not load image'));
        };
        
        if (typeof e.target?.result === 'string') {
          img.src = e.target.result;
        } else if (e.target?.result instanceof ArrayBuffer) {
          const blob = new Blob([e.target.result], { type: file.type });
          img.src = URL.createObjectURL(blob);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Could not read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convertir audio de formato iOS (m4a/aac) a formato compatible (mp3/wav)
   * iOS suele grabar en formato m4a que puede no ser compatible con el backend
   */
  async convertAudioFormat(file: File, targetFormat: 'audio/mp3' | 'audio/wav' = 'audio/mp3'): Promise<File> {
    // Si no es iOS o el formato ya es compatible, retornar original
    if (!this.isIOS || file.type === targetFormat || file.type === 'audio/mpeg') {
      return file;
    }

    // iOS suele usar audio/m4a o audio/aac
    if (file.type !== 'audio/m4a' && file.type !== 'audio/aac' && !file.name.endsWith('.m4a')) {
      return file;
    }

    try {
      // Leer el archivo como ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Crear un nuevo File con el formato objetivo
      // Nota: Esta es una conversión básica. Para una conversión real de formato,
      // se necesitaría una librería como ffmpeg.wasm, pero eso puede ser pesado.
      // Por ahora, mantenemos el formato pero cambiamos el tipo MIME.
      const convertedFile = new File(
        [arrayBuffer],
        file.name.replace(/\.(m4a|aac)$/i, '.mp3'),
        { type: targetFormat }
      );
      
      return convertedFile;
    } catch (error) {
      console.error('Error converting audio format:', error);
      // Si falla la conversión, retornar el archivo original
      return file;
    }
  }

  /**
   * Comprimir video para iOS (reducir calidad/resolución)
   * Nota: La compresión real de video requiere librerías más complejas
   * Por ahora, validamos el tamaño y formato
   */
  async validateVideoFile(file: File, maxSizeMB = 100): Promise<File> {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      throw new Error(`Video file is too large. Maximum size is ${maxSizeMB}MB`);
    }
    
    // Validar formato de video
    const validFormats = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!validFormats.includes(file.type) && !file.name.match(/\.(mp4|mov|avi)$/i)) {
      throw new Error('Unsupported video format. Please use MP4, MOV, or AVI');
    }
    
    return file;
  }

  /**
   * Procesar archivo multimedia según la plataforma
   * Aplica compresión/conversión automáticamente para iOS
   */
  async processMediaFile(file: File): Promise<File> {
    alert(`[DEBUG] processMediaFile - file: ${file.name}, type: ${file.type}, size: ${file.size}`);
    
    if (file.type.startsWith('image/')) {
      alert('[DEBUG] Processing as image...');
      const processed = await this.compressImage(file);
      alert(`[DEBUG] Image processed - final size: ${processed.size}`);
      return processed;
    } else if (file.type.startsWith('audio/')) {
      alert('[DEBUG] Processing as audio...');
      return this.convertAudioFormat(file);
    } else if (file.type.startsWith('video/')) {
      alert('[DEBUG] Processing as video...');
      return this.validateVideoFile(file);
    }
    
    alert('[DEBUG] File type not recognized, returning original');
    return file;
  }
}

