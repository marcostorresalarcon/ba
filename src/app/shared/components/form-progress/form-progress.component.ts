import { Component, input, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FormSection {
  id: string;
  title: string;
  completed: boolean;
  required: boolean;
}

/**
 * Componente de progreso para mostrar el avance en el formulario
 * Muestra secciones completadas y pendientes
 */
@Component({
  selector: 'app-form-progress',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div class="px-6 py-4">
        <!-- Título y progreso general -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-tertiary">Form Progress</h3>
          <span class="text-sm font-medium text-secondary">
            {{ completedCount() }} / {{ totalSections() }} sections completed
          </span>
        </div>
        
        <!-- Barra de progreso -->
        <div class="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div 
            class="bg-secondary h-2.5 rounded-full transition-all duration-500 ease-out"
            [style.width.%]="progressPercentage()"
          ></div>
        </div>
        
        <!-- Lista de secciones (colapsable en móvil) -->
        <div class="hidden md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          @for (section of sections(); track section.id) {
            <button
              type="button"
              (click)="scrollToSection(section.id)"
              class="px-3 py-2 rounded-md text-xs font-medium transition-all duration-200
                     border-2 hover:shadow-md hover:scale-105"
              [class]="getSectionClasses(section)"
              [attr.aria-label]="'Navigate to ' + section.title"
            >
              <div class="flex items-center gap-1.5">
                @if (section.completed) {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                } @else if (section.required) {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                }
                <span class="truncate">{{ section.title }}</span>
              </div>
            </button>
          }
        </div>
        
        <!-- Botón colapsable para móvil -->
        <div class="md:hidden">
          <button
            type="button"
            (click)="toggleSectionsList()"
            class="w-full px-4 py-2 bg-gray-100 rounded-md text-sm font-medium text-tertiary
                   hover:bg-gray-200 transition-colors flex items-center justify-between"
          >
            <span>{{ showSectionsList() ? 'Hide' : 'Show' }} Sections</span>
            <svg 
              class="w-5 h-5 transition-transform duration-200"
              [class.rotate-180]="showSectionsList()"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          @if (showSectionsList()) {
            <div class="mt-2 grid grid-cols-2 gap-2 animate-fadeIn">
              @for (section of sections(); track section.id) {
                <button
                  type="button"
                  (click)="scrollToSection(section.id); toggleSectionsList()"
                  class="px-3 py-2 rounded-md text-xs font-medium transition-all
                         border-2"
                  [class]="getSectionClasses(section)"
                >
                  <div class="flex items-center gap-1.5">
                    @if (section.completed) {
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    }
                    <span class="truncate">{{ section.title }}</span>
                  </div>
                </button>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out;
    }
  `]
})
export class FormProgressComponent {
  sections = input.required<FormSection[]>();
  
  // Signal para mostrar/ocultar lista en móvil
  showSectionsList = signal<boolean>(false);
  
  // Computed signals
  totalSections = computed(() => this.sections().length);
  completedCount = computed(() => 
    this.sections().filter(s => s.completed).length
  );
  progressPercentage = computed(() => {
    const total = this.totalSections();
    if (total === 0) return 0;
    return (this.completedCount() / total) * 100;
  });

  toggleSectionsList(): void {
    this.showSectionsList.update(v => !v);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -100; // Offset para el sticky header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  getSectionClasses(section: FormSection): string {
    if (section.completed) {
      return 'bg-green-50 border-green-500 text-green-700 hover:bg-green-100';
    }
    if (section.required) {
      return 'bg-yellow-50 border-yellow-500 text-yellow-700 hover:bg-yellow-100';
    }
    return 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100';
  }
}

