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
   * Reducido a 1024px y calidad 0.6 para máxima optimización de memoria
   */
  async compressImage(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.6): Promise<File> {
    // Si no es iOS o no es nativo, retornar el archivo original
    if (!this.isIOS || !this.isNative) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          // Calcular nuevas dimensiones manteniendo aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }
          
          // Crear canvas para redimensionar
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Dibujar imagen redimensionada
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convertir a blob y luego a File
          canvas.toBlob(
            (blob) => {
              // Limpiar referencias para ayudar al GC
              img.src = '';
              canvas.width = 0;
              canvas.height = 0;

              if (!blob) {
                reject(new Error('Could not compress image'));
                return;
              }
              
              const compressedFile = new File(
                [blob],
                file.name,
                { type: file.type || 'image/jpeg' }
              );
              
              resolve(compressedFile);
            },
            file.type || 'image/jpeg',
            quality
          );
        };
        
        img.onerror = () => {
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

    // ADVERTENCIA: No podemos convertir realmente el audio en el frontend sin una librería pesada como ffmpeg.wasm.
    // Cambiar simplemente la extensión o el tipo MIME corrompería el archivo.
    // Lo mejor es devolver el archivo original y dejar que el backend maneje la conversión o acepte m4a.
    // Por lo tanto, devolvemos el archivo original.
    
    return file;
  }

  /**
   * Valida el video sin comprimir. Preserva la calidad original en todas las plataformas.
   * La compresión degrada la calidad; solo validamos tamaño y formato.
   */
  async compressVideo(file: File, maxSizeMB = 50): Promise<File> {
    return this.validateVideoFile(file, maxSizeMB);
  }

  /**
   * Validar archivo de video (tamaño y formato)
   */
  async validateVideoFile(file: File, maxSizeMB = 50): Promise<File> {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      throw new Error(`Video file is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${maxSizeMB}MB. Please choose a smaller video.`);
    }
    
    // Validar formato de video
    const validFormats = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    const validExtensions = /\.(mp4|mov|avi|mkv|webm|heic)$/i;
    
    if (!validFormats.includes(file.type) && !file.name.match(validExtensions)) {
      throw new Error('Unsupported video format. Please use MP4, MOV, AVI, MKV, or WebM');
    }
    
    return file;
  }

  /**
   * Procesar archivo multimedia según la plataforma
   * Aplica compresión/conversión automáticamente para iOS
   */
  async processMediaFile(file: File): Promise<File> {
    if (file.type.startsWith('image/')) {
      const processed = await this.compressImage(file);
      return processed;
    } else if (file.type.startsWith('audio/')) {
      return this.convertAudioFormat(file);
    } else if (file.type.startsWith('video/')) {
      // Solo validar: no comprimir para preservar calidad original
      return await this.compressVideo(file);
    }
    
    return file;
  }
}

