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
   * Comprimir video reduciendo calidad y resolución
   * Usa MediaRecorder API para comprimir videos en el navegador
   */
  async compressVideo(file: File, maxSizeMB = 50, targetBitrate = 2000000): Promise<File> {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    // Si el archivo ya es pequeño, no comprimir
    if (file.size <= maxSizeBytes * 0.8) {
      return this.validateVideoFile(file, maxSizeMB);
    }

    // Validar formato de video
    const validFormats = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    const validExtensions = /\.(mp4|mov|avi|mkv|webm)$/i;
    
    if (!validFormats.includes(file.type) && !file.name.match(validExtensions)) {
      throw new Error('Unsupported video format. Please use MP4, MOV, AVI, MKV, or WebM');
    }

    // En iOS nativo, solo validar (la compresión real requiere librerías nativas)
    if (this.isIOS && this.isNative) {
      return this.validateVideoFile(file, maxSizeMB);
    }

    // En web, intentar comprimir usando MediaRecorder
    try {
      return await this.compressVideoWeb(file, targetBitrate, maxSizeBytes);
    } catch (error) {
      // Si la compresión falla, validar y retornar el original si es aceptable
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn('[IosMediaService] Video compression failed:', errorMsg);
      
      // Si el archivo es demasiado grande incluso después del fallo, lanzar error
      if (file.size > maxSizeBytes) {
        throw new Error(`Video file is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${maxSizeMB}MB. Please choose a smaller video.`);
      }
      
      // Si la compresión falla pero el archivo es aceptable, retornar original
      return file;
    }
  }

  /**
   * Comprimir video en web usando MediaRecorder API
   */
  private async compressVideoWeb(file: File, targetBitrate: number, maxSizeBytes: number): Promise<File> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const stream = canvas.captureStream(30); // 30 FPS
      
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        // Reducir resolución si es muy grande (máximo 1280x720)
        const maxWidth = 1280;
        const maxHeight = 720;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Configurar MediaRecorder con compresión
        const options: MediaRecorderOptions = {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: targetBitrate,
        };

        // Fallback a codecs más compatibles si vp9 no está disponible
        if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
          options.mimeType = 'video/webm;codecs=vp8';
          if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
            options.mimeType = 'video/webm';
          }
        }

        const mediaRecorder = new MediaRecorder(stream, options);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const compressedBlob = new Blob(chunks, { type: options.mimeType || 'video/webm' });
          
          // Verificar si el archivo comprimido es más pequeño
          if (compressedBlob.size >= file.size) {
            // Si la compresión no ayudó, retornar el original
            resolve(file);
            return;
          }

          // Verificar tamaño máximo
          if (compressedBlob.size > maxSizeBytes) {
            reject(new Error(`Compressed video is still too large (${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB`));
            return;
          }

          // Convertir a File
          const fileName = file.name.replace(/\.[^/.]+$/, '') + '.webm';
          const compressedFile = new File([compressedBlob], fileName, { type: compressedBlob.type });
          
          // Limpiar referencias
          video.src = '';
          canvas.width = 0;
          canvas.height = 0;
          stream.getTracks().forEach(track => track.stop());
          
          resolve(compressedFile);
        };

        mediaRecorder.onerror = (event) => {
          reject(new Error('MediaRecorder error during video compression'));
        };

        // Iniciar grabación
        mediaRecorder.start();

        // Reproducir video y dibujar en canvas
        video.onplay = () => {
          const drawFrame = () => {
            if (!video.paused && !video.ended) {
              ctx.drawImage(video, 0, 0, width, height);
              requestAnimationFrame(drawFrame);
            } else if (video.ended) {
              mediaRecorder.stop();
            }
          };
          drawFrame();
        };

        video.play().catch((error) => {
          mediaRecorder.stop();
          reject(new Error(`Could not play video for compression: ${error.message}`));
        });
      };

      video.onerror = () => {
        reject(new Error('Could not load video for compression'));
      };

      video.src = URL.createObjectURL(file);
    });
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
      // Comprimir video si es necesario
      return await this.compressVideo(file);
    }
    
    return file;
  }
}

