import { Injectable, signal } from '@angular/core';

export interface CanvasPosition {
  top: number;
  left: number;
}

type SaveCallback = (dataUrl: string) => void | Promise<void>;

@Injectable({
  providedIn: 'root'
})
export class DrawingCanvasService {
  private readonly showCanvasSignal = signal(false);
  private readonly canvasPositionSignal = signal<CanvasPosition | null>(null);
  private saveCallback: SaveCallback | null = null;

  readonly showCanvas = this.showCanvasSignal.asReadonly();
  readonly canvasPosition = this.canvasPositionSignal.asReadonly();

  openCanvas(position: CanvasPosition, saveCallback?: SaveCallback): void {
    this.canvasPositionSignal.set(position);
    this.saveCallback = saveCallback ?? null;
    this.showCanvasSignal.set(true);
  }

  closeCanvas(): void {
    this.showCanvasSignal.set(false);
    this.canvasPositionSignal.set(null);
    this.saveCallback = null;
  }

  async handleSave(dataUrl: string): Promise<void> {
    if (this.saveCallback) {
      await this.saveCallback(dataUrl);
    }
    this.closeCanvas();
  }
}
