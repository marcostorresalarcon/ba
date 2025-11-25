import { Component, input, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormNumberInputComponent } from '../form-number-input/form-number-input.component';
import { FormRadioComponent } from '../form-radio/form-radio.component';

/**
 * Componente reutilizable para el patrón Yes/No con cantidad
 * Común en el formulario de Kitchen Estimate
 */
@Component({
  selector: 'app-form-yes-no-quantity',
  standalone: true,
  imports: [CommonModule, FormsModule, FormNumberInputComponent, FormRadioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 w-full">
      @if (label()) {
        <label class="text-tertiary font-bold">
          {{ label() }}
          @if (required()) {
            <span class="text-red-500">*</span>
          }
        </label>
      }
      
      <!-- Yes/No Radio Buttons -->
      <div class="flex gap-4 items-center mb-2">
        <app-form-radio
          [id]="id() + '-yes'"
          [name]="id()"
          value="yes"
          label="Yes"
          [checked]="yesNoValue() === 'yes'"
          (valueChange)="handleYesNoChange($event)"
          [disabled]="disabled()"
        />
        <app-form-radio
          [id]="id() + '-no'"
          [name]="id()"
          value=""
          label="No"
          [checked]="yesNoValue() !== 'yes'"
          (valueChange)="handleYesNoChange($event)"
          [disabled]="disabled()"
        />
      </div>
      
      <!-- Quantity Input (solo si Yes está seleccionado) -->
      @if (showQuantityInput()) {
        <app-form-number-input
          [id]="id() + '-quantity'"
          [value]="quantityValue()"
          [unit]="unit()"
          [min]="min()"
          [max]="max()"
          [step]="step()"
          [placeholder]="quantityPlaceholder()"
          [disabled]="!isYesSelected() || disabled()"
          [required]="required() && isYesSelected()"
          [errorMessage]="quantityErrorMessage()"
          (valueChange)="handleQuantityChange($event)"
          (onBlur)="quantityBlur.emit()"
        />
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
  `]
})
export class FormYesNoQuantityComponent {
  // Inputs
  id = input.required<string>();
  label = input<string>('');
  yesNoValue = input<string>(''); // '' o 'yes'
  quantityValue = input<number | null>(null);
  unit = input<string>('EA'); // EA, LF, SF, INCH, etc.
  min = input<number>(0);
  max = input<number | undefined>(undefined);
  step = input<number>(1);
  quantityPlaceholder = input<string>('##');
  disabled = input<boolean>(false);
  required = input<boolean>(false);
  helpText = input<string>('');
  quantityErrorMessage = input<string>('');
  showQuantityInput = input<boolean>(true); // Permite ocultar el input de cantidad

  // Signals computados
  isYesSelected = computed(() => this.yesNoValue() === 'yes');
  showError = signal<boolean>(false);

  // Outputs
  yesNoChange = output<string>();
  quantityChange = output<number | null>();
  quantityBlur = output<void>();

  handleYesNoChange(value: string | number | boolean): void {
    const strValue = value === 'yes' ? 'yes' : '';
    this.yesNoChange.emit(strValue);
    
    // Si se selecciona No, limpiar la cantidad
    if (strValue !== 'yes') {
      this.quantityChange.emit(null);
    }
  }

  handleQuantityChange(value: number | null): void {
    this.quantityChange.emit(value);
  }
}

