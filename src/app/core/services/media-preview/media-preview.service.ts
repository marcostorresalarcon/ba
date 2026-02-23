import { Injectable, signal, computed } from '@angular/core';

export type MediaType = 'image' | 'video' | 'auto';

/**
 * Servicio para abrir la previsualización de medios como un modal overlay
 * sobre el formulario actual, sin cambiar de ruta ni resetear el scroll.
 */
@Injectable({
  providedIn: 'root'
})
export class MediaPreviewService {
  private readonly _url = signal<string | null>(null);
  private readonly _type = signal<MediaType>('auto');
  private readonly _isOpen = signal<boolean>(false);

  readonly url = this._url.asReadonly();
  readonly type = this._type.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();
  readonly hasMedia = computed(() => this._url() !== null);

  /**
   * Abre el modal de previsualización sin modificar la posición de scroll.
   */
  open(url: string, type: MediaType = 'auto'): void {
    this._url.set(url);
    this._type.set(type);
    this._isOpen.set(true);
  }

  /**
   * Cierra el modal de previsualización y limpia el estado.
   */
  close(): void {
    this._isOpen.set(false);
    this.clear();
  }

  /** Limpia el estado al salir de la pantalla. */
  clear(): void {
    this._url.set(null);
    this._type.set('auto');
  }
}
