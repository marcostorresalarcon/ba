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
    alert(`[DEBUG] startRecording - isRecording: ${this.isRecording()}, isIOS: ${this.isIOS}`);
    
    if (this.isRecording()) {
      alert('[DEBUG] Already recording, returning');
      return;
    }

    // Verificar y solicitar permisos de micrófono
    alert('[DEBUG] Requesting microphone permission...');
    const hasPermission = await this.permissionsService.requestMicrophonePermission();
    if (!hasPermission) {
      alert('[DEBUG] Microphone permission denied');
      throw new Error('Microphone permission denied. Please enable microphone access in your device settings.');
    }

    alert('[DEBUG] Permission granted, accessing getUserMedia...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      alert('[DEBUG] getUserMedia successful, setting up MediaRecorder...');
      
      // En iOS, usar formato compatible. MediaRecorder en iOS suele usar 'audio/mp4' o 'audio/aac'
      // Intentar usar un formato compatible, si no está disponible, usar el predeterminado
      let mimeType = 'audio/webm'; // Formato predeterminado para web
      
      if (this.isIOS) {
        alert('[DEBUG] iOS - Checking supported MIME types...');
        // iOS suele soportar estos formatos
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
          alert('[DEBUG] iOS - Using audio/mp4');
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
          alert('[DEBUG] iOS - Using audio/aac');
        } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
          mimeType = 'audio/mpeg';
          alert('[DEBUG] iOS - Using audio/mpeg');
        } else {
          alert('[DEBUG] iOS - Using default mimeType');
        }
      } else {
        // Para web/Android, intentar webm primero
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
          alert('[DEBUG] Android/Web - Using audio/webm');
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
          alert('[DEBUG] Android/Web - Using audio/mp4');
        }
      }
      
      alert(`[DEBUG] Creating MediaRecorder with mimeType: ${mimeType}`);
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        alert(`[DEBUG] dataavailable event - size: ${event.data.size}, type: ${event.data.type}`);
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          alert(`[DEBUG] Chunk added. Total chunks: ${this.audioChunks.length}, Total size: ${this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0)} bytes`);
        } else {
          alert('[DEBUG] dataavailable event with size 0, skipping');
        }
      });

      this.mediaRecorder.addEventListener('error', (event) => {
        alert(`[DEBUG] MediaRecorder error event: ${JSON.stringify(event)}`);
        console.error('MediaRecorder error:', event);
      });

      // Agregar listener para el evento 'start' para confirmar que comenzó
      this.mediaRecorder.addEventListener('start', () => {
        alert('[DEBUG] MediaRecorder start event fired');
      });

      alert('[DEBUG] Starting MediaRecorder...');
      
      // En iOS, necesitamos usar timeslice para asegurar que se capturen los datos
      // timeslice: número de milisegundos para grabar antes de disparar dataavailable
      const timeslice = this.isIOS ? 1000 : undefined; // En iOS, capturar cada segundo
      
      if (timeslice) {
        alert(`[DEBUG] Starting MediaRecorder with timeslice: ${timeslice}ms (iOS)`);
        this.mediaRecorder.start(timeslice);
      } else {
        alert('[DEBUG] Starting MediaRecorder without timeslice');
        this.mediaRecorder.start();
      }
      
      this.isRecording.set(true);
      alert('[DEBUG] Recording started successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`[DEBUG] Error accessing microphone: ${errorMsg}`);
      console.error('Error accessing microphone:', error);
      throw new Error('Could not access microphone. Please verify permissions.');
    }
  }

  async stopRecording(): Promise<File> {
    alert('[DEBUG] stopRecording called');
    
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording()) {
        alert('[DEBUG] No active recording to stop');
        reject(new Error('No active recording'));
        return;
      }

      alert('[DEBUG] Setting up stop event listener...');
      
      // Verificar el estado del MediaRecorder antes de detener
      alert(`[DEBUG] MediaRecorder state before stop: ${this.mediaRecorder.state}`);
      
      // Configurar el listener ANTES de llamar a stop()
      this.mediaRecorder.addEventListener('stop', async () => {
        alert('[DEBUG] MediaRecorder stop event fired');
        try {
          alert(`[DEBUG] Audio chunks count: ${this.audioChunks.length}`);
          alert(`[DEBUG] Total chunks size: ${this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0)} bytes`);
          
          // Determinar el tipo MIME basado en lo que grabamos
          const mimeType = this.mediaRecorder?.mimeType || 'audio/mp4';
          alert(`[DEBUG] Creating blob with mimeType: ${mimeType}`);
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          alert(`[DEBUG] Blob created - size: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
          
          // Determinar extensión basada en el tipo MIME
          let extension = 'mp3';
          if (mimeType.includes('webm')) {
            extension = 'webm';
          } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
            extension = 'm4a';
          } else if (mimeType.includes('aac')) {
            extension = 'aac';
          }
          
          alert(`[DEBUG] Creating File with extension: ${extension}`);
          let audioFile = new File([audioBlob], `voice-note-${Date.now()}.${extension}`, { type: mimeType });
          alert(`[DEBUG] File created - name: ${audioFile.name}, size: ${audioFile.size}, type: ${audioFile.type}`);
          
          // Convertir formato si es iOS y el formato no es compatible
          if (this.isIOS) {
            alert('[DEBUG] iOS - Converting audio format...');
            try {
              audioFile = await this.iosMediaService.convertAudioFormat(audioFile);
              alert(`[DEBUG] iOS - Audio converted - name: ${audioFile.name}, size: ${audioFile.size}, type: ${audioFile.type}`);
            } catch (convertError) {
              alert(`[DEBUG] iOS - Audio conversion error: ${convertError}`);
              console.error('Audio conversion error:', convertError);
              // Continuar con el archivo original si la conversión falla
            }
          }
          
          // Stop all tracks to release microphone
          alert('[DEBUG] Stopping all tracks...');
          this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
          this.mediaRecorder = null;
          this.isRecording.set(false);
          
          alert(`[DEBUG] Recording stopped successfully - File ready: ${audioFile.name}`);
          resolve(audioFile);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          alert(`[DEBUG] Error in stop event handler: ${errorMsg}`);
          // Stop tracks even on error
          this.mediaRecorder?.stream.getTracks().forEach(track => track.stop());
          this.mediaRecorder = null;
          this.isRecording.set(false);
          reject(error);
        }
      }, { once: true }); // Usar { once: true } para que el listener solo se ejecute una vez

      alert('[DEBUG] Calling mediaRecorder.stop()...');
      alert(`[DEBUG] MediaRecorder state before stop: ${this.mediaRecorder.state}`);
      alert(`[DEBUG] Current audio chunks before stop: ${this.audioChunks.length}`);
      
      try {
        // En iOS, a veces necesitamos solicitar los datos finales antes de detener
        if (this.isIOS && this.mediaRecorder.state === 'recording') {
          alert('[DEBUG] iOS - Requesting final data before stop...');
          // Solicitar los datos finales
          this.mediaRecorder.requestData();
        }
        
        this.mediaRecorder.stop();
        alert(`[DEBUG] mediaRecorder.stop() called successfully. State after stop: ${this.mediaRecorder.state}`);
        
        // En iOS, a veces el evento 'stop' no se dispara inmediatamente
        // Agregar un timeout como fallback
        if (this.isIOS) {
          setTimeout(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'inactive' && this.audioChunks.length > 0) {
              alert('[DEBUG] iOS - Timeout fallback: Processing audio chunks manually');
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
        const errorMsg = stopError instanceof Error ? stopError.message : String(stopError);
        alert(`[DEBUG] Error calling stop(): ${errorMsg}`);
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



