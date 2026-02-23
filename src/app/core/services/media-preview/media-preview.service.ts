import { Injectable, signal, computed } from '@angular/core';

export type MediaType = 'image' | 'video' | 'auto';

/**
 * Servicio para abrir la previsualización de medios en pantalla completa.
 * Patrón nativo iOS: navegar a una pantalla dedicada en lugar de modales.
 */
@Injectable({
  providedIn: 'root'
})
export class MediaPreviewService {
  private readonly _url = signal<string | null>(null);
  private readonly _type = signal<MediaType>('auto');

  readonly url = this._url.asReadonly();
  readonly type = this._type.asReadonly();
  readonly hasMedia = computed(() => this._url() !== null);

  /**
   * Configura la URL y tipo para la pantalla de previsualización.
   * Llamar antes de navegar a /media-preview.
   */
  setPreview(url: string, type: MediaType = 'auto'): void {
    this._url.set(url);
    this._type.set(type);
  }

  /** Limpia el estado al salir de la pantalla. */
  clear(): void {
    this._url.set(null);
    this._type.set('auto');
  }
}
