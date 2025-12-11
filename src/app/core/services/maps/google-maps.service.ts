import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';

declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

@Injectable({
  providedIn: 'root'
})
export class GoogleMapsService {
  private readonly apiKey = environment.apiKeyMaps;
  private loadPromise: Promise<void> | null = null;
  private isLoaded = false;

  /**
   * Carga el script base de Google Maps API
   */
  private loadGoogleMapsScript(): Promise<void> {
    if (this.isLoaded && window.google) {
      return Promise.resolve();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise((resolve, reject) => {
      // Verificar si ya está cargado
      if (window.google) {
        this.isLoaded = true;
        resolve();
        return;
      }

      // Verificar si el script ya está en el DOM
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        // Esperar a que se cargue
        const checkInterval = setInterval(() => {
          if (window.google) {
            this.isLoaded = true;
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        // Timeout después de 10 segundos
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!this.isLoaded) {
            reject(new Error('Google Maps API failed to load'));
          }
        }, 10000);
        return;
      }

      // Crear el script
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&loading=async&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;

      // Callback global
      window.initGoogleMaps = () => {
        this.isLoaded = true;
        resolve();
      };

      script.onerror = () => {
        reject(new Error('Failed to load Google Maps API'));
      };

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  /**
   * Asegura que Google Maps API esté cargada y lista para usar importLibrary
   */
  async ensureGoogleMapsLoaded(): Promise<void> {
    await this.loadGoogleMapsScript();

    if (!window.google?.maps?.importLibrary) {
      throw new Error('Google Maps importLibrary is not available. Make sure the API key is valid and the script loaded correctly.');
    }
  }

  /**
   * Verifica si la API está cargada
   */
  isApiLoaded(): boolean {
    return this.isLoaded && !!window.google;
  }
}

