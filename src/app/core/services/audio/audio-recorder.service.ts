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
    if (this.isRecording()) return;

    // Verificar y solicitar permisos de micrófono
    const hasPermission = await this.permissionsService.requestMicrophonePermission();
    if (!hasPermission) {
      throw new Error('Microphone permission denied. Please enable microphone access in your device settings.');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // En iOS, usar formato compatible. MediaRecorder en iOS suele usar 'audio/mp4' o 'audio/aac'
      // Intentar usar un formato compatible, si no está disponible, usar el predeterminado
      let mimeType = 'audio/webm'; // Formato predeterminado para web
      
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
        // Para web, intentar webm primero
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }
      
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });

      this.mediaRecorder.start();
      this.isRecording.set(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw new Error('Could not access microphone. Please verify permissions.');
    }
  }

  async stopRecording(): Promise<File> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording()) {
        reject(new Error('No active recording'));
        return;
      }

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
          }
          
          let audioFile = new File([audioBlob], `voice-note-${Date.now()}.${extension}`, { type: mimeType });
          
          // Convertir formato si es iOS y el formato no es compatible
          if (this.isIOS) {
            audioFile = await this.iosMediaService.convertAudioFormat(audioFile);
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
      });

      this.mediaRecorder.stop();
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



