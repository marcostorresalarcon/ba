import { inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { IosMediaService } from '../ios/ios-media.service';
import { PermissionsService } from '../permissions/permissions.service';
import { LogService } from '../log/log.service';

@Injectable({
  providedIn: 'root'
})
export class AudioRecorderService {
  private readonly iosMediaService = inject(IosMediaService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly logService = inject(LogService);
  private readonly platform = Capacitor.getPlatform();
  private readonly isNative = Capacitor.isNativePlatform();
  private readonly isIOS = this.platform === 'ios';
  private readonly isMac = this.platform === 'ios' && typeof navigator !== 'undefined' && 
    (navigator.userAgent.includes('Macintosh') || navigator.userAgent.includes('Mac OS'));
  
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioStream: MediaStream | null = null;
  
  readonly isRecording = signal<boolean>(false);
  
  async startRecording(): Promise<void> {
    if (this.isRecording()) {
      return;
    }

    // Verificar que MediaRecorder esté disponible
    if (typeof MediaRecorder === 'undefined') {
      const errorMsg = 'MediaRecorder API is not supported in this browser. Please use a modern browser.';
      void this.logService.logError('MediaRecorder not available', new Error(errorMsg), {
        severity: 'high',
        description: 'MediaRecorder API not available',
        source: 'audio-recorder-service',
        metadata: {
          service: 'AudioRecorderService',
          method: 'startRecording',
          platform: this.platform,
          isNative: this.isNative,
          isMac: this.isMac
        }
      });
      throw new Error(errorMsg);
    }

    // Verificar y solicitar permisos de micrófono
    const hasPermission = await this.permissionsService.requestMicrophonePermission();
    if (!hasPermission) {
      const errorMsg = 'Microphone permission denied. Please enable microphone access in your device settings.';
      void this.logService.logError('Microphone permission denied', new Error(errorMsg), {
        severity: 'medium',
        description: 'User denied microphone permission',
        source: 'audio-recorder-service',
        metadata: {
          service: 'AudioRecorderService',
          method: 'startRecording',
          platform: this.platform
        }
      });
      throw new Error(errorMsg);
    }

    try {
      // Obtener stream de audio con configuración optimizada para iOS/Mac
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // En iOS/Mac, especificar sampleRate puede ayudar
        ...(this.isIOS || this.isMac ? { sampleRate: 44100 } : {})
      };

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints 
      });
      
      this.audioStream = stream;
      
      // En iOS/iPad/Mac, usar formato compatible. MediaRecorder en iOS suele usar 'audio/mp4' o 'audio/aac'
      // Intentar usar un formato compatible, si no está disponible, usar el predeterminado
      let mimeType = ''; 
      
      if (this.isIOS || this.isMac) {
        // iOS/iPad/Mac suelen soportar estos formatos en orden de preferencia
        const supportedTypes = [
          'audio/mp4',
          'audio/aac',
          'audio/mpeg',
          'audio/m4a',
          'audio/x-m4a'
        ];
        
        for (const type of supportedTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
      } else {
        // Para web/Android, intentar webm primero
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }
      
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      this.mediaRecorder = new MediaRecorder(stream, options);
      this.audioChunks = [];

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });

      this.mediaRecorder.addEventListener('error', (event) => {
        const error = event instanceof ErrorEvent ? event.error : new Error('MediaRecorder error');
        void this.logService.logError('MediaRecorder error during recording', error, {
          severity: 'medium',
          description: 'Error occurred during audio recording',
          source: 'audio-recorder-service',
          metadata: {
            service: 'AudioRecorderService',
            method: 'startRecording',
            platform: this.platform,
            mimeType: this.mediaRecorder?.mimeType || 'unknown'
          }
        });
      });

      // En iOS/iPad/Mac, necesitamos usar timeslice para asegurar que se capturen los datos
      // timeslice: número de milisegundos para grabar antes de disparar dataavailable
      // Usar un intervalo más corto en iOS para mejor captura
      const timeslice = (this.isIOS || this.isMac) ? 500 : undefined;
      
      if (timeslice) {
        this.mediaRecorder.start(timeslice);
      } else {
        this.mediaRecorder.start();
      }
      
      this.isRecording.set(true);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      void this.logService.logError('Error starting audio recording', error, {
        severity: 'high',
        description: `Failed to start audio recording: ${errorMsg}`,
        source: 'audio-recorder-service',
        metadata: {
          service: 'AudioRecorderService',
          method: 'startRecording',
          platform: this.platform,
          isNative: this.isNative,
          isMac: this.isMac
        }
      });
      
      // Limpiar stream si se creó pero falló
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }
      
      throw new Error(`Could not access microphone: ${errorMsg}. Please verify permissions.`);
    }
  }

  async stopRecording(): Promise<File> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording()) {
        reject(new Error('No active recording'));
        return;
      }
      
      // Configurar el listener ANTES de llamar a stop()
      this.mediaRecorder.addEventListener('stop', async () => {
        try {
          // Determinar el tipo MIME basado en lo que grabamos
          const mimeType = this.mediaRecorder?.mimeType || 'audio/mp4';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          
          // Determinar extensión basada en el tipo MIME
          let extension = 'mp3';
          if (mimeType.includes('webm')) {
            extension = 'webm';
          } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
            extension = 'm4a';
          } else if (mimeType.includes('aac')) {
            extension = 'aac';
          } else if (mimeType.includes('ogg')) {
            extension = 'ogg';
          } else if (mimeType.includes('wav')) {
            extension = 'wav';
          }
          
          let audioFile = new File([audioBlob], `voice-note-${Date.now()}.${extension}`, { type: mimeType });
          
          // Intentar procesar con servicio iOS (principalmente para validación, ya no convierte falsamente)
          if (this.isIOS) {
            try {
              audioFile = await this.iosMediaService.convertAudioFormat(audioFile);
            } catch {
              // Continuar con el archivo original si falla
            }
          }
          
          // Stop all tracks to release microphone
          if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
          }
          if (this.mediaRecorder?.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
          }
          this.mediaRecorder = null;
          this.isRecording.set(false);
          
          resolve(audioFile);
        } catch (error) {
          // Stop tracks even on error
          if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
          }
          if (this.mediaRecorder?.stream) {
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
          }
          this.mediaRecorder = null;
          this.isRecording.set(false);
          
          void this.logService.logError('Error processing audio after stop', error, {
            severity: 'medium',
            description: 'Error occurred while processing audio file after stopping recording',
            source: 'audio-recorder-service',
            metadata: {
              service: 'AudioRecorderService',
              method: 'stopRecording',
              platform: this.platform
            }
          });
          
          reject(error);
        }
      }, { once: true }); // Usar { once: true } para que el listener solo se ejecute una vez
      
      try {
        // En iOS, a veces necesitamos solicitar los datos finales antes de detener
        if (this.isIOS && this.mediaRecorder.state === 'recording') {
          // Solicitar los datos finales
          this.mediaRecorder.requestData();
        }
        
        this.mediaRecorder.stop();
        
        // En iOS, a veces el evento 'stop' no se dispara inmediatamente
        // Agregar un timeout como fallback
        if (this.isIOS) {
          setTimeout(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'inactive' && this.audioChunks.length > 0) {
              // Procesar manualmente si el evento no se disparó
              const mimeType = this.mediaRecorder.mimeType || 'audio/mp4';
              const audioBlob = new Blob(this.audioChunks, { type: mimeType });
              let extension = 'm4a';
              if (mimeType.includes('webm')) {
                extension = 'webm';
              } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
                extension = 'm4a';
              } else if (mimeType.includes('aac')) {
                extension = 'aac';
              }
              
              const audioFile = new File([audioBlob], `voice-note-${Date.now()}.${extension}`, { type: mimeType });
              
              this.iosMediaService.convertAudioFormat(audioFile).then(converted => {
                if (this.audioStream) {
                  this.audioStream.getTracks().forEach(track => track.stop());
                  this.audioStream = null;
                }
                if (this.mediaRecorder?.stream) {
                  this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
                this.mediaRecorder = null;
                this.isRecording.set(false);
                resolve(converted);
              }).catch(() => {
                if (this.audioStream) {
                  this.audioStream.getTracks().forEach(track => track.stop());
                  this.audioStream = null;
                }
                if (this.mediaRecorder?.stream) {
                  this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
                this.mediaRecorder = null;
                this.isRecording.set(false);
                resolve(audioFile);
              });
            }
          }, 500); // Esperar 500ms antes del fallback
        }
      } catch (stopError) {
        reject(stopError);
      }
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording()) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {
        // Ignorar errores al detener
      }
      
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }
      
      if (this.mediaRecorder?.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      
      this.mediaRecorder = null;
      this.isRecording.set(false);
      this.audioChunks = [];
    }
  }
}



