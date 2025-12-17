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
    if (!this.isNative) {
      // En web, usar la API de permisos del navegador
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Liberar el stream inmediatamente, solo queríamos verificar el permiso
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }

    // En Android, necesitamos manejar permisos de manera diferente
    if (this.platform === 'android') {
      try {
        // En Android, verificar primero si tenemos permisos usando la API de permisos
        // Si no están disponibles, getUserMedia los solicitará automáticamente
        // Intentar usar constraints simples primero para evitar errores de hardware
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true 
        });
        
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }

    // En iOS, los permisos se solicitan automáticamente
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
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
      } catch {
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
    } catch {
      return false;
    }
  }

  /**
   * Verifica y solicita permisos de galería de fotos
   * @returns Promise<boolean> - true si se otorgó el permiso (granted, no limited)
   */
  async requestPhotoLibraryPermission(): Promise<boolean> {
    if (!this.isNative) {
      // En web, no se necesitan permisos especiales para input file
      return true;
    }

    // En iOS y Android, usar el plugin de Camera de Capacitor
    try {
      const permissions = await Camera.checkPermissions();
      
      // En iOS 14+, 'limited' significa acceso limitado (solo fotos seleccionadas)
      // Para FilePicker necesitamos acceso completo ('granted')
      if (permissions.photos === 'granted') {
        return true;
      }

      // Si está en 'limited', necesitamos solicitar acceso completo
      if (permissions.photos === 'limited') {
        // Solicitar permisos nuevamente para obtener acceso completo
        const requestResult = await Camera.requestPermissions({ permissions: ['photos'] });
        // Retornar true solo si es 'granted', no 'limited'
        return requestResult.photos === 'granted';
      }

      // Si no está otorgado, solicitar permisos
      const requestResult = await Camera.requestPermissions({ permissions: ['photos'] });
      return requestResult.photos === 'granted';
    } catch {
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
    } catch {
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
    } catch {
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

