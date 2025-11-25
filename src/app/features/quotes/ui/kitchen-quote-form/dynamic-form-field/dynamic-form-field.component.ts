import { CommonModule } from '@angular/common';
import type {
  OnInit
} from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
  computed,
  inject,
  DestroyRef
} from '@angular/core';
import type { FormControl} from '@angular/forms';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { FormGroup } from '@angular/forms';
import type { KitchenInput } from '../../../../../core/services/kitchen-inputs/kitchen-inputs.service';
import type { AdditionalWorkInput } from '../../../../../core/services/additional-work-inputs/additional-work-inputs.service';

// Tipo base común para inputs
type FormInput = KitchenInput | AdditionalWorkInput;

@Component({
  selector: 'app-dynamic-form-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  templateUrl: './dynamic-form-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DynamicFormFieldComponent implements OnInit {
  @Input({ required: true }) input!: FormInput;
  @Input({ required: true }) form!: FormGroup;
  @Input() kitchenSize: 'small' | 'medium' | 'large' = 'small';

  private readonly destroyRef = inject(DestroyRef);
  protected readonly showQuantityInput = signal<boolean>(false);
  private readonly controlValueSignal = signal<unknown>(null);

  protected readonly control = computed(() => {
    return this.form.get(this.input.name) as FormControl<unknown> | null;
  });

  ngOnInit(): void {
    const ctrl = this.control();
    if (ctrl) {
      // Establecer el valor inicial
      const initialValue = ctrl.value;
      this.controlValueSignal.set(initialValue);
      
      // Si el valor inicial es "yes" y necesita cantidad, mostrar el input
      if (this.input.element === 'radioButton' && 
          (this.input.formula === 'UNIT * PRICE' || this.input.formula === 'Selection Price/UNIT * PRICE') &&
          typeof initialValue === 'string' && initialValue.toLowerCase() === 'yes') {
        this.showQuantityInput.set(true);
      }
      
      // Suscribirse a los cambios del control para actualizar el signal
      ctrl.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(value => {
          this.controlValueSignal.set(value);
        });
    }
  }

  protected readonly quantityControl = computed(() => {
    const quantityFieldName = `${this.input.name}Quantity`;
    return this.form.get(quantityFieldName) as FormControl<number | null> | null;
  });

  protected readonly customControl = computed(() => {
    const customFieldName = `${this.input.name}Custom`;
    return this.form.get(customFieldName) as FormControl<number | null> | null;
  });

  protected readonly hasCustomOption = computed(() => {
    return this.input.custom === true;
  });

  protected readonly needsQuantityInput = computed(() => {
    if (this.input.element !== 'radioButton') return false;
    
    const formula = this.input.formula;
    if (formula === 'UNIT * PRICE' || formula === 'Selection Price/UNIT * PRICE') {
      // Usar controlValueSignal para que reaccione a los cambios
      const value = this.controlValueSignal();
      if (typeof value === 'string') {
        return value.toLowerCase() === 'yes';
      }
      return false;
    }
    
    return false;
  });

  protected readonly showCustomInput = computed(() => {
    if (!this.hasCustomOption()) return false;
    
    const value = this.controlValueSignal();
    // Verificar si el valor es "custom" (case insensitive)
    return typeof value === 'string' && value.toLowerCase() === 'custom';
  });

  protected onRadioChange(value: string): void {
    const control = this.control();
    if (!control) return;

    control.setValue(value);
    // Actualizar el signal inmediatamente para que el computed se actualice
    this.controlValueSignal.set(value);

    // Manejar input custom: si se selecciona "custom", asegurar que el control custom existe
    // Si se selecciona otra opción (no custom), limpiar el valor custom
    if (this.hasCustomOption()) {
      const customCtrl = this.customControl();
      if (value.toLowerCase() === 'custom') {
        // Cuando se selecciona custom, asegurar que el control existe y está listo
        if (customCtrl && customCtrl.value === null) {
          // Opcional: inicializar con 0 o dejar null
        }
      } else {
        // Si se selecciona una opción que NO es custom, limpiar el valor custom
        if (customCtrl) {
          customCtrl.setValue(null);
        }
      }
    }

    // Si es "yes" y necesita cantidad, mostrar el input de cantidad
    if (this.needsQuantityInput() && value.toLowerCase() === 'yes') {
      this.showQuantityInput.set(true);
      const quantityControl = this.quantityControl();
      if (quantityControl && !quantityControl.value) {
        quantityControl.setValue(1);
      }
    } else {
      this.showQuantityInput.set(false);
    }

    // Si es "no", limpiar cantidad
    if (value.toLowerCase() === 'no') {
      const quantityControl = this.quantityControl();
      if (quantityControl) {
        quantityControl.setValue(null);
      }
    }
  }

  protected onCheckboxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const control = this.control();
    if (!control) return;
    control.setValue(target.checked);
  }

  protected onNumberChange(value: number | null): void {
    const control = this.control();
    if (!control) return;
    control.setValue(value);
  }

  protected getNumberValue(value: unknown): number | null {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  protected onSelectChange(event: Event): void {
    const control = this.control();
    if (!control) return;
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    control.setValue(value);
    this.controlValueSignal.set(value);

    // Manejar input custom para selectCustomInputText
    if (this.input.element === 'selectCustomInputText' && this.hasCustomOption()) {
      const customCtrl = this.customControl();
      if (value.toLowerCase() === 'custom') {
        // Cuando se selecciona custom, asegurar que el control existe
        if (customCtrl && customCtrl.value === null) {
          // Opcional: inicializar con 0 o dejar null
        }
      } else {
        // Si se selecciona una opción que NO es custom, limpiar el valor custom
        if (customCtrl) {
          customCtrl.setValue(null);
        }
      }
    }
  }

  protected getPriceForSelection(selection: string): number {
    if (!Array.isArray(this.input.price) || !this.input.selections.length) {
      return Array.isArray(this.input.price) ? this.input.price[0] ?? 0 : (this.input.price ?? 0);
    }

    const index = this.input.selections.indexOf(selection);
    if (index >= 0 && index < this.input.price.length) {
      return this.input.price[index];
    }

    return 0;
  }

  protected getPriceForSize(): number {
    // Verificar si el input tiene la propiedad size (solo KitchenInput la tiene)
    const hasSize = 'size' in this.input && this.input.size;
    if (!hasSize || !Array.isArray(this.input.price)) {
      return Array.isArray(this.input.price) ? this.input.price[0] ?? 0 : (this.input.price ?? 0);
    }

    const sizeIndex = this.kitchenSize === 'small' ? 0 : this.kitchenSize === 'medium' ? 1 : 2;
    return this.input.price[sizeIndex] ?? this.input.price[0] ?? 0;
  }
}

