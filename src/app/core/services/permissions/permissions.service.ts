import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';

/**
 * Servicio para gestionar permisos de la aplicación
 * - Micrófono (grabación de audio)
 * - Cámara (tomar fotos)
 * - Galería (acceder a fotos/videos)
 */
@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  private readonly isNative = Capacitor.isNativePlatform();
  private readonly platform = Capacitor.getPlatform();

  /**
   * Verifica y solicita permisos de micrófono
   * @returns Promise<boolean> - true si se otorgó el permiso
   */
  async requestMicrophonePermission(): Promise<boolean> {
    alert(`[DEBUG] requestMicrophonePermission - Platform: ${this.platform}, Native: ${this.isNative}`);
    
    if (!this.isNative) {
      // En web, usar la API de permisos del navegador
      try {
        alert('[DEBUG] Web platform - Requesting getUserMedia');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        alert('[DEBUG] Web - Permission granted, stopping tracks');
        // Liberar el stream inmediatamente, solo queríamos verificar el permiso
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        alert(`[DEBUG] Web - Microphone permission denied: ${errorMsg}`);
        console.error('Microphone permission denied:', error);
        return false;
      }
    }

    // En Android, necesitamos manejar permisos de manera diferente
    if (this.platform === 'android') {
      try {
        alert('[DEBUG] Android - Requesting microphone permission');
        
        // En Android, verificar primero si tenemos permisos usando la API de permisos
        // Si no están disponibles, getUserMedia los solicitará automáticamente
        // Pero necesitamos manejar el caso donde el permiso fue denegado previamente
        
        // Intentar acceder al micrófono - esto debería solicitar permisos si no están otorgados
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        alert('[DEBUG] Android - getUserMedia successful, permission granted');
        stream.getTracks().forEach(track => {
          track.stop();
          alert(`[DEBUG] Android - Track stopped: ${track.kind}, state: ${track.readyState}`);
        });
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : 'Unknown';
        alert(`[DEBUG] Android - Microphone permission error: ${errorName} - ${errorMsg}`);
        console.error('Microphone permission denied:', error);
        
        // Si es NotAllowedError, el usuario denegó el permiso
        // En Android, esto puede pasar si el permiso fue denegado previamente
        if (errorName === 'NotAllowedError' || errorMsg.includes('Permission denied') || errorMsg.includes('NotAllowedError')) {
          alert('[DEBUG] Android - Permission was denied. User needs to enable it in app settings.');
          // En Android, si el permiso fue denegado, el usuario debe ir a configuración
          // No podemos solicitar permisos nuevamente si fueron denegados permanentemente
        }
        return false;
      }
    }

    // En iOS, los permisos se solicitan automáticamente
    try {
      alert('[DEBUG] iOS - Requesting getUserMedia');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      alert('[DEBUG] iOS - Permission granted');
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`[DEBUG] iOS - Microphone permission denied: ${errorMsg}`);
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Verifica y solicita permisos de cámara
   * @returns Promise<boolean> - true si se otorgó el permiso
   */
  async requestCameraPermission(): Promise<boolean> {
    if (!this.isNative) {
      // En web, usar la API de permisos del navegador
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error) {
        console.error('Camera permission denied:', error);
        return false;
      }
    }

    // En iOS y Android, usar el plugin de Camera de Capacitor
    // que maneja automáticamente los permisos
    try {
      // Verificar permisos usando el plugin de Camera
      const permissions = await Camera.checkPermissions();
      
      if (permissions.camera === 'granted') {
        return true;
      }

      // Solicitar permisos si no están otorgados
      const requestResult = await Camera.requestPermissions({ permissions: ['camera'] });
      return requestResult.camera === 'granted';
    } catch (error) {
      console.error('Camera permission error:', error);
      return false;
    }
  }

  /**
   * Verifica y solicita permisos de galería de fotos
   * @returns Promise<boolean> - true si se otorgó el permiso
   */
  async requestPhotoLibraryPermission(): Promise<boolean> {
    if (!this.isNative) {
      // En web, no se necesitan permisos especiales para input file
      return true;
    }

    // En iOS y Android, usar el plugin de Camera de Capacitor
    try {
      const permissions = await Camera.checkPermissions();
      
      if (permissions.photos === 'granted') {
        return true;
      }

      // Solicitar permisos si no están otorgados
      const requestResult = await Camera.requestPermissions({ permissions: ['photos'] });
      return requestResult.photos === 'granted';
    } catch (error) {
      console.error('Photo library permission error:', error);
      return false;
    }
  }

  /**
   * Verifica permisos de cámara y galería (común para seleccionar medios)
   * @returns Promise<boolean> - true si se otorgaron los permisos
   */
  async requestMediaPermissions(): Promise<boolean> {
    if (!this.isNative) {
      return true;
    }

    try {
      const permissions = await Camera.checkPermissions();
      
      const cameraGranted = permissions.camera === 'granted';
      const photosGranted = permissions.photos === 'granted';

      // Si ambos están otorgados, retornar true
      if (cameraGranted && photosGranted) {
        return true;
      }

      // Solicitar permisos faltantes
      const requestResult = await Camera.requestPermissions({ 
        permissions: ['camera', 'photos'] 
      });
      
      return requestResult.camera === 'granted' && requestResult.photos === 'granted';
    } catch (error) {
      console.error('Media permissions error:', error);
      return false;
    }
  }

  /**
   * Verifica el estado actual de los permisos sin solicitarlos
   * @returns Promise con el estado de todos los permisos
   */
  async checkAllPermissions(): Promise<{
    microphone: boolean;
    camera: boolean;
    photos: boolean;
  }> {
    if (!this.isNative) {
      // En web, verificar usando la API de permisos
      const [microphone, camera] = await Promise.all([
        this.checkMicrophonePermission(),
        this.checkCameraPermission()
      ]);
      
      return {
        microphone,
        camera,
        photos: true // En web no se necesita permiso para input file
      };
    }

    try {
      const permissions = await Camera.checkPermissions();
      
      // Para micrófono, intentar verificar sin solicitar
      const microphone = await this.checkMicrophonePermission();
      
      return {
        microphone,
        camera: permissions.camera === 'granted',
        photos: permissions.photos === 'granted'
      };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return {
        microphone: false,
        camera: false,
        photos: false
      };
    }
  }

  /**
   * Verifica permiso de micrófono sin solicitarlo
   */
  private async checkMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verifica permiso de cámara sin solicitarlo
   */
  private async checkCameraPermission(): Promise<boolean> {
    if (!this.isNative) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }

    try {
      const permissions = await Camera.checkPermissions();
      return permissions.camera === 'granted';
    } catch {
      return false;
    }
  }
}

