import type { ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Component, ViewChild, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Object as FabricObject } from 'fabric';
import { Canvas, PencilBrush, Rect, Circle, Line, Polyline, Polygon, Point } from 'fabric';

@Component({
  selector: 'app-drawing-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-screen bg-white flex flex-col overflow-hidden min-h-0">
      <!-- Toolbar -->
      <div class="flex flex-col border-b border-fog/60 bg-white shadow-sm">
        <!-- Top Bar: Actions -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-fog/20">
          <button (click)="cancel.emit()" class="text-slate hover:text-charcoal font-medium">Cancel</button>
          
          <div class="flex items-center gap-2">
            <button 
              (click)="undo()" 
              [disabled]="historyIndex <= 0"
              class="p-2 rounded-lg hover:bg-fog/20 transition disabled:opacity-50 disabled:cursor-not-allowed text-charcoal"
              title="Undo"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>

            <button 
              (click)="deleteSelected()" 
              class="p-2 rounded-lg hover:bg-fog/20 transition text-red-500"
              title="Delete Selected"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <button 
            (click)="saveDrawing()" 
            class="px-6 py-2 bg-pine text-white rounded-full font-semibold shadow-raised hover:bg-pine-dark transition"
          >
            Done
          </button>
        </div>

        <!-- Tools Bar -->
        <div class="flex items-center justify-between px-4 py-3 overflow-x-auto hide-scrollbar gap-4">
          <!-- Drawing Tools -->
          <div class="flex items-center gap-2 p-1 bg-fog/10 rounded-xl">
            <button 
              (click)="setTool('select')" 
              [class.bg-white]="currentTool === 'select'"
              [class.text-pine]="currentTool === 'select'"
              [class.shadow-sm]="currentTool === 'select'"
              class="p-2 rounded-lg hover:bg-white/50 transition text-slate"
              title="Select & Move"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </button>
            
            <button 
              (click)="setTool('pencil')" 
              [class.bg-white]="currentTool === 'pencil'"
              [class.text-pine]="currentTool === 'pencil'"
              [class.shadow-sm]="currentTool === 'pencil'"
              class="p-2 rounded-lg hover:bg-white/50 transition text-slate"
              title="Pencil"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            
            <button 
              (click)="setTool('line')" 
              [class.bg-white]="currentTool === 'line'"
              [class.text-pine]="currentTool === 'line'"
              [class.shadow-sm]="currentTool === 'line'"
              class="p-2 rounded-lg hover:bg-white/50 transition text-slate"
              title="Line"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
              </svg>
            </button>

            <button 
              (click)="setTool('polyline')" 
              [class.bg-white]="currentTool === 'polyline'"
              [class.text-pine]="currentTool === 'polyline'"
              [class.shadow-sm]="currentTool === 'polyline'"
              class="p-2 rounded-lg hover:bg-white/50 transition text-slate"
              title="Polygon / Polyline"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>

            <button 
              (click)="setTool('rect')" 
              [class.bg-white]="currentTool === 'rect'"
              [class.text-pine]="currentTool === 'rect'"
              [class.shadow-sm]="currentTool === 'rect'"
              class="p-2 rounded-lg hover:bg-white/50 transition text-slate"
              title="Rectangle"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
              </svg>
            </button>

            <button 
              (click)="setTool('circle')" 
              [class.bg-white]="currentTool === 'circle'"
              [class.text-pine]="currentTool === 'circle'"
              [class.shadow-sm]="currentTool === 'circle'"
              class="p-2 rounded-lg hover:bg-white/50 transition text-slate"
              title="Circle"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="9" stroke-width="2"/>
              </svg>
            </button>
          </div>

          <div class="h-8 w-px bg-fog/60"></div>

          <!-- Properties -->
          <div class="flex items-center gap-4">
            <!-- Color Picker -->
            <div class="flex items-center gap-2">
              @for (color of colors; track color) {
                <button
                  (click)="setColor(color)"
                  [style.backgroundColor]="color"
                  [class.ring-2]="currentColor === color"
                  class="w-8 h-8 rounded-full border border-fog/40 ring-offset-2 ring-pine transition-all hover:scale-110"
                ></button>
              }
              <div class="relative">
                <input 
                  type="color" 
                  [value]="currentColor" 
                  (input)="onColorChange($event)"
                  class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                >
                <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 border border-fog/40 flex items-center justify-center">
                  <svg class="w-4 h-4 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="h-8 w-px bg-fog/60"></div>

            <!-- Stroke Width -->
            <div class="flex items-center gap-2">
              <button 
                (click)="setStrokeWidth(2)" 
                [class.bg-pine/10]="currentWidth === 2"
                [class.text-pine]="currentWidth === 2"
                class="p-2 rounded-lg hover:bg-fog/20 transition"
              >
                <div class="w-1.5 h-1.5 rounded-full bg-current"></div>
              </button>
              <button 
                (click)="setStrokeWidth(5)" 
                [class.bg-pine/10]="currentWidth === 5"
                [class.text-pine]="currentWidth === 5"
                class="p-2 rounded-lg hover:bg-fog/20 transition"
              >
                <div class="w-2.5 h-2.5 rounded-full bg-current"></div>
              </button>
              <button 
                (click)="setStrokeWidth(10)" 
                [class.bg-pine/10]="currentWidth === 10"
                [class.text-pine]="currentWidth === 10"
                class="p-2 rounded-lg hover:bg-fog/20 transition"
              >
                <div class="w-4 h-4 rounded-full bg-current"></div>
              </button>
            </div>

            <div class="h-8 w-px bg-fog/60"></div>

            <!-- Line Style (Dashed) -->
            <button 
              (click)="toggleDashed()" 
              [class.bg-pine/10]="isDashed"
              [class.text-pine]="isDashed"
              class="p-2 rounded-lg hover:bg-fog/20 transition text-slate"
              title="Dashed Line"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" stroke-dasharray="4 4" d="M20 12H4" />
              </svg>
            </button>
          </div>
        </div>
        
        @if (currentTool === 'polyline' && isDrawingPolyline) {
          <div class="bg-pine/10 px-4 py-2 flex items-center justify-center gap-4 text-sm text-pine font-medium">
            <span>Tap to add points. Click start point to close.</span>
            <button (click)="finishPolyline(false)" class="underline font-bold">Finish Open</button>
            <button (click)="finishPolyline(true)" class="underline font-bold">Close Shape</button>
          </div>
        }
      </div>

      <!-- Canvas Area -->
      <div class="flex-1 relative bg-fog/5 overflow-hidden touch-none h-screen">
        <canvas #canvas class="w-full h-full"></canvas>
      </div>
    </div>
  `
})
export class DrawingCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasEl!: ElementRef<HTMLCanvasElement>;
  @Output() save = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  private canvas!: Canvas;
  currentTool: 'pencil' | 'rect' | 'circle' | 'line' | 'polyline' | 'select' = 'pencil';
  currentColor = '#332F28';
  currentWidth = 3;
  isDashed = false;

  colors = ['#332F28', '#3A7344', '#E74C3C', '#3498DB', '#F1C40F'];

  private history: string[] = [];
  historyIndex = -1;
  private isHistoryProcessing = false;

  // Shape creation state
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private activeShape: FabricObject | null = null;

  // Polyline specific state
  isDrawingPolyline = false;
  private polylinePoints: { x: number, y: number }[] = [];
  private activePolyline: Polyline | null = null;
  private activeLine: Line | null = null; // Elastic line
  private snapIndicator: Circle | null = null; // Visual indicator for snapping

  ngAfterViewInit() {
    // Pequeño delay para asegurar que el DOM esté completamente renderizado
    setTimeout(() => {
      this.initCanvas();
      this.setupResize();
    }, 0);
  }

  ngOnDestroy() {
    this.canvas.dispose();
  }

  private initCanvas() {
    const element = this.canvasEl.nativeElement;
    const parent = element.parentElement;

    if (!parent) return;

    this.canvas = new Canvas(element, {
      isDrawingMode: true,
      width: parent.clientWidth,
      height: parent.clientHeight,
      backgroundColor: '#ffffff',
      selection: false
    });

    this.setupPencilBrush();
    this.saveHistory();

    this.canvas.on('path:created', () => {
      // Deshabilitar selección en los paths creados para evitar selección accidental
      const activeObject = this.canvas.getActiveObject();
      if (activeObject) {
        activeObject.selectable = false;
        activeObject.evented = false;
      }
      this.saveHistory();
    });

    // Handle shape creation interactions
    this.canvas.on('mouse:down', (opt) => this.onMouseDown(opt));
    this.canvas.on('mouse:move', (opt) => this.onMouseMove(opt));
    this.canvas.on('mouse:up', (opt) => this.onMouseUp(opt));
    this.canvas.on('mouse:dblclick', () => {
      if (this.isDrawingPolyline) this.finishPolyline(false);
    });
  }

  private setupPencilBrush() {
    this.canvas.isDrawingMode = true;
    const brush = new PencilBrush(this.canvas);
    brush.width = this.currentWidth;
    brush.color = this.currentColor;
    brush.decimate = 2;
    this.canvas.freeDrawingBrush = brush;
  }

  private setupResize() {
    const resizeObserver = new ResizeObserver(() => {
      const parent = this.canvasEl.nativeElement.parentElement;
      if (parent && this.canvas) {
        this.canvas.setDimensions({
          width: parent.clientWidth,
          height: parent.clientHeight
        });
        this.canvas.renderAll();
      }
    });

    const parent = this.canvasEl.nativeElement.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    }

    // También escuchar resize de ventana como fallback
    window.addEventListener('resize', () => {
      const parent = this.canvasEl.nativeElement.parentElement;
      if (parent && this.canvas) {
        this.canvas.setDimensions({
          width: parent.clientWidth,
          height: parent.clientHeight
        });
        this.canvas.renderAll();
      }
    });
  }

  setTool(tool: 'pencil' | 'rect' | 'circle' | 'line' | 'polyline' | 'select') {
    if (this.isDrawingPolyline) {
      this.finishPolyline(false);
    }

    this.currentTool = tool;

    if (tool === 'select') {
      // Modo de selección: permitir seleccionar, mover, transformar y redimensionar
      this.canvas.isDrawingMode = false;
      this.canvas.selection = true;
      // Habilitar todas las interacciones de selección
      this.canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
      });
      // Deseleccionar cualquier objeto activo para limpiar el estado
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    } else if (tool === 'pencil') {
      // Modo de dibujo: deshabilitar selección
      this.canvas.isDrawingMode = true;
      this.canvas.selection = false;
      // Deshabilitar selección en todos los objetos mientras se dibuja
      this.canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      this.canvas.discardActiveObject();
      this.setupPencilBrush();
    } else {
      // Modo de creación de formas: deshabilitar selección
      this.canvas.isDrawingMode = false;
      this.canvas.selection = false;
      // Deshabilitar selección en todos los objetos mientras se crean formas
      this.canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
      this.canvas.discardActiveObject();
    }
  }

  toggleDashed() {
    this.isDashed = !this.isDashed;

    const activeObject = this.canvas.getActiveObject();
    if (activeObject && !(activeObject instanceof PencilBrush)) {
      activeObject.set('strokeDashArray', this.isDashed ? [10, 5] : undefined);
      this.canvas.requestRenderAll();
      this.saveHistory();
    }
  }

  private onMouseDown(opt: any) {
    // No interferir con el modo de selección o dibujo
    if (this.currentTool === 'pencil' || this.currentTool === 'select') return;

    const pointer = this.canvas.getPointer(opt.e);

    if (this.currentTool === 'polyline') {
      this.handlePolylineClick(pointer);
      return;
    }

    // Logic for Drag-to-create shapes (rect, circle, line)
    this.isDrawing = true;
    this.startX = pointer.x;
    this.startY = pointer.y;

    const commonProps = {
      left: this.startX,
      top: this.startY,
      stroke: this.currentColor,
      strokeWidth: this.currentWidth,
      fill: 'transparent',
      strokeDashArray: this.isDashed ? [10, 5] : undefined,
      selectable: false,
      evented: false
    };

    if (this.currentTool === 'rect') {
      this.activeShape = new Rect({
        ...commonProps,
        width: 0,
        height: 0
      });
    } else if (this.currentTool === 'circle') {
      this.activeShape = new Circle({
        ...commonProps,
        radius: 0,
        originX: 'center',
        originY: 'center',
        left: this.startX,
        top: this.startY
      });
    } else if (this.currentTool === 'line') {
      this.activeShape = new Line([this.startX, this.startY, this.startX, this.startY], {
        ...commonProps,
        strokeLineCap: 'round'
      });
    }

    if (this.activeShape) {
      this.canvas.add(this.activeShape);
    }
  }

  private handlePolylineClick(pointer: { x: number, y: number }) {
    // Snapping to start point to close shape
    if (this.isDrawingPolyline && this.polylinePoints.length > 2) {
      const startPoint = this.polylinePoints[0];
      const dist = Math.sqrt(Math.pow(pointer.x - startPoint.x, 2) + Math.pow(pointer.y - startPoint.y, 2));
      if (dist < 20) {
        this.finishPolyline(true); // Close the shape
        return;
      }
    }

    // Orthogonal snapping (simple version)
    if (this.isDrawingPolyline && this.polylinePoints.length > 0) {
      const lastPoint = this.polylinePoints[this.polylinePoints.length - 1];
      const dx = Math.abs(pointer.x - lastPoint.x);
      const dy = Math.abs(pointer.y - lastPoint.y);

      // If very close to horizontal or vertical, snap it
      if (dx < 15) pointer.x = lastPoint.x; // Vertical snap
      if (dy < 15) pointer.y = lastPoint.y; // Horizontal snap
    }

    if (!this.isDrawingPolyline) {
      // Start new polyline
      this.isDrawingPolyline = true;
      this.polylinePoints = [{ x: pointer.x, y: pointer.y }];

      this.activePolyline = new Polyline(this.polylinePoints, {
        stroke: this.currentColor,
        strokeWidth: this.currentWidth,
        fill: 'transparent',
        strokeDashArray: this.isDashed ? [10, 5] : undefined,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: false,
        evented: false,
        objectCaching: false
      });

      this.canvas.add(this.activePolyline);
    } else {
      // Add point
      this.polylinePoints.push({ x: pointer.x, y: pointer.y });
      this.activePolyline?.set({ points: [...this.polylinePoints] });
      this.canvas.requestRenderAll();
    }
  }

  private onMouseMove(opt: any) {
    let pointer = this.canvas.getPointer(opt.e);

    if (this.currentTool === 'polyline' && this.isDrawingPolyline && this.activePolyline) {
      // 1. Auto-snap to start point indicator
      if (this.polylinePoints.length > 2) {
        const startPoint = this.polylinePoints[0];
        const dist = Math.sqrt(Math.pow(pointer.x - startPoint.x, 2) + Math.pow(pointer.y - startPoint.y, 2));

        if (dist < 20) {
          // Show snap indicator
          if (!this.snapIndicator) {
            this.snapIndicator = new Circle({
              radius: 5,
              fill: 'transparent',
              stroke: '#2ecc71', // Green indicator
              strokeWidth: 2,
              left: startPoint.x,
              top: startPoint.y,
              originX: 'center',
              originY: 'center',
              selectable: false,
              evented: false
            });
            this.canvas.add(this.snapIndicator);
          }
          // Snap pointer to start
          pointer = new Point(startPoint.x, startPoint.y);
        } else {
          if (this.snapIndicator) {
            this.canvas.remove(this.snapIndicator);
            this.snapIndicator = null;
          }
        }
      }

      // 2. Orthogonal Snapping help (Architectural feel)
      if (!this.snapIndicator && this.polylinePoints.length > 0) {
        const lastPoint = this.polylinePoints[this.polylinePoints.length - 1];
        const dx = Math.abs(pointer.x - lastPoint.x);
        const dy = Math.abs(pointer.y - lastPoint.y);

        if (dx < 15) pointer.x = lastPoint.x;
        if (dy < 15) pointer.y = lastPoint.y;
      }

      // Elastic line
      if (this.activeLine) {
        this.canvas.remove(this.activeLine);
      }

      const lastPoint = this.polylinePoints[this.polylinePoints.length - 1];
      this.activeLine = new Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
        stroke: this.currentColor,
        strokeWidth: this.currentWidth,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false
      });

      this.canvas.add(this.activeLine);
      this.canvas.requestRenderAll();
      return;
    }

    if (!this.isDrawing || !this.activeShape) return;

    if (this.currentTool === 'rect') {
      const rect = this.activeShape as Rect;
      const width = Math.abs(pointer.x - this.startX);
      const height = Math.abs(pointer.y - this.startY);

      rect.set({
        width: width,
        height: height,
        left: Math.min(pointer.x, this.startX),
        top: Math.min(pointer.y, this.startY)
      });
    } else if (this.currentTool === 'circle') {
      const circle = this.activeShape as Circle;
      const radius = Math.sqrt(
        Math.pow(pointer.x - this.startX, 2) + Math.pow(pointer.y - this.startY, 2)
      );
      circle.set({ radius: radius });
    } else if (this.currentTool === 'line') {
      const line = this.activeShape as Line;
      line.set({
        x2: pointer.x,
        y2: pointer.y
      });
    }

    this.canvas.requestRenderAll();
  }

  private onMouseUp(opt: any) {
    if (this.currentTool === 'polyline') return;

    if (!this.isDrawing) return;

    this.isDrawing = false;
    if (this.activeShape) {
      // Mantener selectable y evented en false para evitar selección accidental
      // Solo se habilitarán cuando se use el tool 'select'
      this.activeShape.set({
        selectable: false,
        evented: false
      });
      this.activeShape.setCoords();
      // No seleccionar automáticamente el objeto
      this.canvas.discardActiveObject();
      this.activeShape = null;
      this.saveHistory();
    }
  }

  finishPolyline(close = false) {
    if (!this.isDrawingPolyline || !this.activePolyline) return;

    this.isDrawingPolyline = false;

    if (this.activeLine) {
      this.canvas.remove(this.activeLine);
      this.activeLine = null;
    }

    if (this.snapIndicator) {
      this.canvas.remove(this.snapIndicator);
      this.snapIndicator = null;
    }

    // Remove the temporary polyline
    this.canvas.remove(this.activePolyline);

    let finalShape: FabricObject;

    if (close && this.polylinePoints.length > 2) {
      // Create a closed Polygon
      finalShape = new Polygon(this.polylinePoints, {
        stroke: this.currentColor,
        strokeWidth: this.currentWidth,
        fill: 'transparent',
        strokeDashArray: this.isDashed ? [10, 5] : undefined,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        objectCaching: false
      });
    } else {
      // Keep as Polyline
      finalShape = new Polyline(this.polylinePoints, {
        stroke: this.currentColor,
        strokeWidth: this.currentWidth,
        fill: 'transparent',
        strokeDashArray: this.isDashed ? [10, 5] : undefined,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        objectCaching: false
      });
    }

    // Establecer propiedades para evitar selección accidental
    finalShape.set({
      selectable: false,
      evented: false
    });
    this.canvas.add(finalShape);
    // No seleccionar automáticamente el objeto
    this.canvas.discardActiveObject();

    this.activePolyline = null;
    this.polylinePoints = [];

    this.saveHistory();
    this.canvas.requestRenderAll();
  }

  setColor(color: string) {
    this.currentColor = color;
    this.updateBrush();

    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      activeObject.set('stroke', color);
      this.canvas.requestRenderAll();
      this.saveHistory();
    }
  }

  onColorChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.setColor(input.value);
  }

  setStrokeWidth(width: number) {
    this.currentWidth = width;
    this.updateBrush();

    const activeObject = this.canvas.getActiveObject();
    if (activeObject) {
      activeObject.set('strokeWidth', width);
      this.canvas.requestRenderAll();
      this.saveHistory();
    }
  }

  private updateBrush() {
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = this.currentColor;
      this.canvas.freeDrawingBrush.width = this.currentWidth;
    }
  }

  deleteSelected() {
    const activeObjects = this.canvas.getActiveObjects();

    if (activeObjects.length > 0) {
      // Eliminar todos los objetos seleccionados
      activeObjects.forEach((obj) => {
        this.canvas.remove(obj);
      });
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      this.saveHistory();
    }
  }

  clear() {
    this.canvas.clear();
    this.canvas.backgroundColor = '#ffffff';
    this.canvas.renderAll();
    this.saveHistory();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.isHistoryProcessing = true;
      this.historyIndex--;
      this.canvas.loadFromJSON(JSON.parse(this.history[this.historyIndex])).then(() => {
        this.canvas.renderAll();
        this.isHistoryProcessing = false;
        this.updateBrush();
      });
    }
  }

  private saveHistory() {
    if (this.isHistoryProcessing) return;

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    const json = JSON.stringify(this.canvas.toJSON());
    this.history.push(json);
    this.historyIndex++;
  }

  saveDrawing() {
    const dataUrl = this.canvas.toDataURL({
      format: 'png',
      quality: 0.8,
      multiplier: 2
    });
    this.save.emit(dataUrl);
  }
}
