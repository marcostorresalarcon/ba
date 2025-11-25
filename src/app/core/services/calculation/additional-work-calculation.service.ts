import { Injectable, inject } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { AdditionalWorkInputsService, type AdditionalWorkInput } from '../additional-work-inputs/additional-work-inputs.service';

@Injectable({
  providedIn: 'root'
})
export class AdditionalWorkCalculationService {
  private readonly inputsService = inject(AdditionalWorkInputsService);

  /**
   * Calcula el precio total del estimado basándose en todos los campos del formulario
   * usando las fórmulas definidas en inputs_additional_work.json
   */
  calculateEstimateTotal(form: FormGroup): number {
    const inputs = this.inputsService.getAllInputs();
    let total = 0;

    for (const input of inputs) {
      const control = form.get(input.name);
      if (!control) continue;

      const value = control.value;
      
      if (value === null || value === undefined || value === '' || value === false) continue;

      const itemTotal = this.calculateItemPrice(input, value, form);
      total += itemTotal;
    }

    return Math.round(total * 100) / 100; // Redondear a 2 decimales
  }

  /**
   * Calcula el precio de un item individual basado en su fórmula
   */
  private calculateItemPrice(
    input: AdditionalWorkInput,
    value: unknown,
    form: FormGroup
  ): number {
    // Obtener el precio base
    let price: number;
    if (Array.isArray(input.price)) {
      price = input.price[0] ?? 0;
    } else {
      price = input.price ?? 0;
    }

    // Procesar según el tipo de elemento y fórmula
    switch (input.element) {
      case 'radioButton':
        return this.calculateRadioButtonPrice(input, value, price, form);
      
      case 'selectCustomInputText':
        return this.calculateSelectCustomInputTextPrice(input, value, price, form);
      
      case 'numberInput':
        return this.calculateNumberInputPrice(input, value as number, price);
      
      default:
        return 0;
    }
  }

  /**
   * Calcula precio para radioButton
   */
  private calculateRadioButtonPrice(
    input: AdditionalWorkInput,
    value: unknown,
    price: number,
    form: FormGroup
  ): number {
    const normalizedValue = typeof value === 'string'
      ? value.toLowerCase()
      : value === true
        ? 'yes'
        : value === false
          ? 'no'
          : '';

    // Si el valor es "no" o vacío, no calcular
    if (!normalizedValue || normalizedValue === 'no') return 0;

    // Si la fórmula es "Y=TRUE", solo retornar el precio si es "Yes" o "yes"
    if (input.formula === 'Y=TRUE' || input.formula === '') {
      if (normalizedValue !== 'yes' && normalizedValue !== 'Yes') return 0;
      return price;
    }

    // Si la fórmula es "UNIT * PRICE"
    if (input.formula === 'UNIT * PRICE') {
      // Buscar el campo de cantidad (puede ser el mismo nombre + "Quantity" o un campo relacionado)
      const quantityControl = form.get(`${input.name}Quantity`);
      const quantity = quantityControl?.value as number ?? 0;

      if (quantity <= 0) return 0;
      return price * quantity;
    }

    return 0;
  }

  /**
   * Calcula precio para selectCustomInputText
   */
  private calculateSelectCustomInputTextPrice(
    input: AdditionalWorkInput,
    value: unknown,
    price: number,
    form: FormGroup
  ): number {
    if (!value || typeof value !== 'string') return 0;

    // Si la fórmula es "UNIT * PRICE"
    if (input.formula === 'UNIT * PRICE') {
      // Obtener el precio según la selección
      let selectionPrice = price;
      if (Array.isArray(input.price) && input.selections.length > 0) {
        const selectionIndex = input.selections.findIndex(selection => 
          selection.toLowerCase() === value.toLowerCase()
        );
        if (selectionIndex >= 0 && selectionIndex < input.price.length) {
          selectionPrice = input.price[selectionIndex];
        }
      }

      // Buscar el campo de cantidad
      const quantityControl = form.get(`${input.name}Quantity`);
      const quantity = quantityControl?.value as number ?? 0;

      if (quantity <= 0) return 0;
      return selectionPrice * quantity;
    }

    return 0;
  }

  /**
   * Calcula precio para numberInput
   */
  private calculateNumberInputPrice(
    input: AdditionalWorkInput,
    value: number,
    price: number
  ): number {
    if (!value || value <= 0) return 0;

    // Si la fórmula es "UNIT * PRICE"
    if (input.formula === 'UNIT * PRICE') {
      return value * price;
    }

    return 0;
  }
}
