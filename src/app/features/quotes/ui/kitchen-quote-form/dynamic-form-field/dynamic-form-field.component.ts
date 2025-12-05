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
      
      // Manejar estado inicial del input de cantidad
      const quantityControl = this.quantityControl();
      if (quantityControl && this.input.element === 'radioButton' && 
          (this.input.formula === 'UNIT * PRICE' || this.input.formula === 'Selection Price/UNIT * PRICE')) {
        if (typeof initialValue === 'string') {
          const lowerValue = initialValue.toLowerCase();
          // Para installCanLight, habilitar cuando sea "4\"" o "6\""
          if (this.input.name === 'installCanLight') {
            if (lowerValue === '4"' || lowerValue === '6"') {
              this.showQuantityInput.set(true);
              quantityControl.enable();
            } else {
              // Si es "none" u otro valor, deshabilitar
              this.showQuantityInput.set(false);
              quantityControl.disable();
              quantityControl.setValue(null);
            }
          } else if (this.input.name === 'smoothCeilings') {
            // Para smoothCeilings, habilitar cuando NO sea "none"
            if (lowerValue !== 'none') {
              this.showQuantityInput.set(true);
              quantityControl.enable();
            } else {
              // Si es "none", deshabilitar
              this.showQuantityInput.set(false);
              quantityControl.disable();
              quantityControl.setValue(null);
            }
          } else if (this.input.name === 'gasPipes') {
            // Para gasPipes, habilitar cuando se seleccione cualquier opción
            if (initialValue && initialValue.trim() !== '') {
              this.showQuantityInput.set(true);
              quantityControl.enable();
            } else {
              this.showQuantityInput.set(false);
              quantityControl.disable();
              quantityControl.setValue(null);
            }
          } else if (this.input.name === 'fireblockingIERockwool') {
            // Para fireblockingIERockwool, habilitar cuando se seleccione cualquier opción
            if (initialValue && initialValue.trim() !== '') {
              this.showQuantityInput.set(true);
              quantityControl.enable();
            } else {
              this.showQuantityInput.set(false);
              quantityControl.disable();
              quantityControl.setValue(null);
            }
          } else if (this.input.name === 'droppedCeilingTiles') {
            // Para droppedCeilingTiles, habilitar cuando se seleccione cualquier opción
            if (initialValue && initialValue.trim() !== '') {
              this.showQuantityInput.set(true);
              quantityControl.enable();
            } else {
              this.showQuantityInput.set(false);
              quantityControl.disable();
              quantityControl.setValue(null);
            }
          } else if (this.input.name === 'primed42InchBaluster5060' || this.input.name === 'metalBaluster42Inch') {
            // Para primed42InchBaluster5060 y metalBaluster42Inch, habilitar cuando se seleccione cualquier opción
            if (initialValue && initialValue.trim() !== '') {
              this.showQuantityInput.set(true);
              quantityControl.enable();
            } else {
              this.showQuantityInput.set(false);
              quantityControl.disable();
              quantityControl.setValue(null);
            }
          } else if (lowerValue === 'yes') {
            // Para otros campos, habilitar cuando sea "yes"
            this.showQuantityInput.set(true);
            quantityControl.enable();
          } else {
            // Si es "no" u otro valor, deshabilitar
            this.showQuantityInput.set(false);
            quantityControl.disable();
            quantityControl.setValue(null);
          }
        } else {
          // Si no hay valor inicial, deshabilitar
          this.showQuantityInput.set(false);
          quantityControl.disable();
        }
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
        const lowerValue = value.toLowerCase();
        // Para installCanLight, mostrar input cuando sea "4\"" o "6\"", no "none"
        if (this.input.name === 'installCanLight') {
          return lowerValue === '4"' || lowerValue === '6"';
        }
        // Para smoothCeilings, mostrar input cuando NO sea "none"
        if (this.input.name === 'smoothCeilings') {
          return lowerValue !== 'none';
        }
        // Para gasPipes, mostrar input cuando se seleccione cualquier opción
        if (this.input.name === 'gasPipes') {
          return value.trim() !== '';
        }
        // Para fireblockingIERockwool, mostrar input cuando se seleccione cualquier opción
        if (this.input.name === 'fireblockingIERockwool') {
          return value.trim() !== '';
        }
        // Para droppedCeilingTiles, mostrar input cuando se seleccione cualquier opción
        if (this.input.name === 'droppedCeilingTiles') {
          return value.trim() !== '';
        }
        // Para primed42InchBaluster5060 y metalBaluster42Inch, mostrar input cuando se seleccione cualquier opción
        if (this.input.name === 'primed42InchBaluster5060' || this.input.name === 'metalBaluster42Inch') {
          return value.trim() !== '';
        }
        // Para otros campos, mostrar cuando sea "yes"
        return lowerValue === 'yes';
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

    // Manejar input de cantidad: habilitar/deshabilitar según la selección
    const quantityControl = this.quantityControl();
    if (quantityControl) {
      const lowerValue = value.toLowerCase();
      
      // Si necesita cantidad (yes, 4", 6", smoothCeilings opciones, gasPipes, fireblockingIERockwool, droppedCeilingTiles, primed42InchBaluster5060, metalBaluster42Inch, etc.), habilitar el control
      if (this.needsQuantityInput()) {
        this.showQuantityInput.set(true);
        quantityControl.enable();
        if (!quantityControl.value) {
          quantityControl.setValue(1);
        }
      } else {
        // Si es "no" o "none", deshabilitar y limpiar cantidad
        this.showQuantityInput.set(false);
        quantityControl.disable();
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

  /**
   * Capitaliza la primera letra de un string
   */
  protected capitalizeFirstLetter(text: string | null | undefined): string {
    if (!text || text.length === 0) {
      return '';
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

