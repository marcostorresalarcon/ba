import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Componente reutilizable para inputs numéricos con unidad
 * Incluye validación y formato consistente
 */
@Component({
  selector: 'app-form-number-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 w-full">
      @if (label()) {
        <label [for]="id()" class="text-tertiary font-bold">
          {{ label() }}
          @if (required()) {
            <span class="text-red-500">*</span>
          }
        </label>
      }
      
      <div class="relative">
        <input
          type="number"
          [id]="id()"
          [value]="value()"
          [min]="min()"
          [max]="max()"
          [step]="step()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          (input)="handleInput($event)"
          (blur)="handleBlur()"
          inputmode="numeric"
          pattern="[0-9]*"
          class="w-full border border-gray-300 rounded-md py-3 px-3 bg-white pr-12 
                 focus:ring-2 focus:ring-secondary focus:border-secondary 
                 transition-all outline-none
                 disabled:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          [class.border-red-500]="showError()"
        />
        
        @if (unit()) {
          <span class="absolute right-3 top-1/2 transform -translate-y-1/2 font-bold text-tertiary">
            {{ unit() }}
          </span>
        }
      </div>
      
      @if (showError() && errorMessage()) {
        <span class="text-red-500 text-sm">{{ errorMessage() }}</span>
      }
      
      @if (helpText() && !showError()) {
        <span class="text-gray-500 text-sm">{{ helpText() }}</span>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    
    /* Remover flechas de number input en Chrome, Safari, Edge */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    
    /* Remover flechas de number input en Firefox */
    input[type="number"] {
      -moz-appearance: textfield;
    }
  `]
})
export class FormNumberInputComponent {
  // Inputs
  id = input.required<string>();
  label = input<string>('');
  value = input<number | null>(null);
  min = input<number>(0);
  max = input<number | undefined>(undefined);
  step = input<number>(1);
  unit = input<string>(''); // LF, SF, EA, INCH, etc.
  placeholder = input<string>('##');
  disabled = input<boolean>(false);
  required = input<boolean>(false);
  helpText = input<string>('');
  errorMessage = input<string>('');

  // Signals internos
  showError = signal<boolean>(false);

  // Outputs
  valueChange = output<number | null>();
  onBlur = output<void>();

  handleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value === '' ? null : parseFloat(input.value);
    
    // Validación de rango
    if (value !== null) {
      const min = this.min();
      const max = this.max();
      
      if (min !== undefined && value < min) {
        this.showError.set(true);
        return;
      }
      
      if (max !== undefined && value > max) {
        this.showError.set(true);
        return;
      }
    }
    
    // Validación de required
    if (this.required() && value === null) {
      this.showError.set(true);
      return;
    }
    
    this.showError.set(false);
    this.valueChange.emit(value);
  }

  handleBlur(): void {
    // Validar en blur para mostrar errores si el campo es required
    if (this.required() && this.value() === null) {
      this.showError.set(true);
    }
    this.onBlur.emit();
  }
}

