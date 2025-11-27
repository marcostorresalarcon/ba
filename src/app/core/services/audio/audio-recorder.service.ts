import { inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { IosMediaService } from '../ios/ios-media.service';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable({
  providedIn: 'root'
})
export class AudioRecorderService {
  private readonly iosMediaService = inject(IosMediaService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly isIOS = Capacitor.getPlatform() === 'ios';
  
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  
  readonly isRecording = signal<boolean>(false);
  
  async startRecording(): Promise<void> {
    if (this.isRecording()) {
      return;
    }

    // Verificar y solicitar permisos de micrófono
    const hasPermission = await this.permissionsService.requestMicrophonePermission();
    if (!hasPermission) {
      throw new Error('Microphone permission denied. Please enable microphone access in your device settings.');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // En iOS, usar formato compatible. MediaRecorder en iOS suele usar 'audio/mp4' o 'audio/aac'
      // Intentar usar un formato compatible, si no está disponible, usar el predeterminado
      let mimeType = ''; 
      
      if (this.isIOS) {
        // iOS suele soportar estos formatos
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
          mimeType = 'audio/mpeg';
        }
      } else {
        // Para web/Android, intentar webm primero
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }
      
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      this.mediaRecorder = new MediaRecorder(stream, options);
      this.audioChunks = [];

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });

      this.mediaRecorder.addEventListener('error', () => {
        // Error silencioso - el usuario será notificado por el componente
      });

      // En iOS, necesitamos usar timeslice para asegurar que se capturen los datos
      // timeslice: número de milisegundos para grabar antes de disparar dataavailable
      const timeslice = this.isIOS ? 1000 : undefined; // En iOS, capturar cada segundo
      
      if (timeslice) {
        this.mediaRecorder.start(timeslice);
      } else {
        this.mediaRecorder.start();
      }
      
      this.isRecording.set(true);
    } catch (error) {
      throw new Error('Could not access microphone. Please verify permissions.');
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
          this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
          this.mediaRecorder = null;
          this.isRecording.set(false);
          
          resolve(audioFile);
        } catch (error) {
          // Stop tracks even on error
          this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
          this.mediaRecorder = null;
          this.isRecording.set(false);
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
                this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
                this.mediaRecorder = null;
                this.isRecording.set(false);
                resolve(converted);
              }).catch(() => {
                this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
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
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
      this.isRecording.set(false);
      this.audioChunks = [];
    }
  }
}



