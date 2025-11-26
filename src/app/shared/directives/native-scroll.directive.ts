import { Directive, ElementRef, OnInit, Renderer2, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Directiva para mejorar el comportamiento del scroll nativo en iOS y Android
 * Aplica estilos y configuraciones específicas para un scroll suave y nativo
 */
@Directive({
  selector: '[appNativeScroll]',
  standalone: true
})
export class NativeScrollDirective implements OnInit {
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly isNative = Capacitor.isNativePlatform();

  ngOnInit(): void {
    if (!this.isNative) {
      return;
    }

    const element = this.elementRef.nativeElement as HTMLElement;

    // Aplicar estilos para scroll nativo suave
    this.renderer.setStyle(element, '-webkit-overflow-scrolling', 'touch');
    this.renderer.setStyle(element, 'overflow-scrolling', 'touch');
    this.renderer.setStyle(element, 'overscroll-behavior', 'contain');
    
    // Mejorar rendimiento con aceleración de hardware
    this.renderer.setStyle(element, 'transform', 'translateZ(0)');
    this.renderer.setStyle(element, 'will-change', 'scroll-position');
    
    // Prevenir scroll horizontal no deseado
    this.renderer.setStyle(element, 'overflow-x', 'hidden');
    
    // Asegurar que el elemento tenga altura definida para scroll
    if (!element.style.height && !element.style.maxHeight) {
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.height === 'auto' || computedStyle.height === '0px') {
        // Si no tiene altura, establecer max-height para permitir scroll
        this.renderer.setStyle(element, 'max-height', '100vh');
      }
    }
  }
}

