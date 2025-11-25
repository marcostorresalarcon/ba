import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Componente reutilizable para radio buttons con estilo consistente
 * Sigue las reglas de Angular 20: standalone, signals, @if/@for
 */
@Component({
  selector: 'app-form-radio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2">
      <input
        type="radio"
        [id]="id()"
        [name]="name()"
        [value]="value()"
        [checked]="checked()"
        (change)="handleChange()"
        [disabled]="disabled()"
        class="w-4 h-4 text-secondary bg-gray-100 border-gray-300 focus:ring-secondary focus:ring-2 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
      <label
        [for]="id()"
        class="text-tertiary cursor-pointer select-none transition-colors hover:text-secondary"
        [class.opacity-50]="disabled()"
        [class.cursor-not-allowed]="disabled()"
      >
        {{ label() }}
      </label>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class FormRadioComponent {
  // Inputs con signals
  id = input.required<string>();
  name = input.required<string>();
  value = input.required<string | number | boolean>();
  label = input.required<string>();
  checked = input<boolean>(false);
  disabled = input<boolean>(false);

  // Output para cambios
  valueChange = output<string | number | boolean>();

  handleChange(): void {
    this.valueChange.emit(this.value());
  }
}

