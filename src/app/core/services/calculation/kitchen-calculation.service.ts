import { Injectable, inject } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { KitchenInputsService, type KitchenInput } from '../kitchen-inputs/kitchen-inputs.service';

@Injectable({
  providedIn: 'root'
})
export class KitchenCalculationService {
  private readonly inputsService = inject(KitchenInputsService);

  /**
   * Calcula el precio total del estimado basándose en todos los campos del formulario
   * usando las fórmulas definidas en inputs.json
   */
  calculateEstimateTotal(form: FormGroup, experience: string, kitchenSize: 'small' | 'medium' | 'large' = 'small'): number {
    const inputs = this.inputsService.getInputsByExperience(experience);
    let total = 0;

    for (const input of inputs) {
      const control = form.get(input.name);
      if (!control) continue;

      const value = control.value;
      
      // Manejar arrays (para checkboxes agrupados como locationKitchen, subFloor)
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        
        // Si es un array de strings (checkboxes), calcular cada uno
        for (const item of value) {
          const itemInput = this.inputsService.getInputByName(item);
          if (itemInput) {
            total += this.calculateItemPrice(itemInput, true, kitchenSize, form);
          }
        }
        continue;
      }

      if (value === null || value === undefined || value === '' || value === false) continue;

      const itemTotal = this.calculateItemPrice(input, value, kitchenSize, form);
      total += itemTotal;
    }

    return Math.round(total * 100) / 100; // Redondear a 2 decimales
  }

  /**
   * Calcula el precio de un item individual basado en su fórmula
   */
  private calculateItemPrice(
    input: KitchenInput,
    value: unknown,
    kitchenSize: 'small' | 'medium' | 'large',
    form: FormGroup
  ): number {
    const sizeIndex = kitchenSize === 'small' ? 0 : kitchenSize === 'medium' ? 1 : 2;

    // Obtener el precio base
    let price: number;
    if (Array.isArray(input.price)) {
      if (input.size) {
        // Si tiene size, usar el índice del tamaño
        price = input.price[sizeIndex] ?? input.price[0] ?? 0;
      } else {
        // Si no tiene size pero es array, usar el primer precio
        price = input.price[0] ?? 0;
      }
    } else {
      price = input.price ?? 0;
    }

    // Procesar según el tipo de elemento y fórmula
    switch (input.element) {
      case 'checkbox':
        return this.calculateCheckboxPrice(input, value as boolean, price, sizeIndex);
      
      case 'radioButton':
        return this.calculateRadioButtonPrice(input, value, price, sizeIndex, form, kitchenSize);
      
      case 'numberInput':
        return this.calculateNumberInputPrice(input, value as number, price);
      
      case 'select':
        return this.calculateSelectPrice(input, value as string, price, sizeIndex);
      
      default:
        return 0;
    }
  }

  /**
   * Calcula precio para checkbox
   */
  private calculateCheckboxPrice(
    input: KitchenInput,
    value: boolean,
    price: number,
    sizeIndex: number
  ): number {
    if (!value) return 0;

    // Si tiene size, usar el precio del tamaño correspondiente
    if (input.size && Array.isArray(input.price)) {
      return input.price[sizeIndex] ?? 0;
    }

    return price;
  }

  /**
   * Calcula precio para radioButton
   */
  private calculateRadioButtonPrice(
    input: KitchenInput,
    value: unknown,
    price: number,
    sizeIndex: number,
    form: FormGroup,
    kitchenSize: 'small' | 'medium' | 'large'
  ): number {
    const normalizedValue = typeof value === 'string'
      ? value.toLowerCase()
      : value === true
        ? 'yes'
        : value === false
          ? 'no'
          : '';

    // Si el valor es "no", "none" o vacío, no calcular
    if (!normalizedValue || normalizedValue === 'no' || normalizedValue === 'none') return 0;

    // Si el valor es "custom", verificar si hay un control custom y usar su valor si es necesario
    // Para campos con custom: true pero sin fórmula, el valor custom solo se almacena, no se calcula precio
    if (normalizedValue === 'custom') {
      // Si tiene custom y no tiene fórmula, no hay precio asociado (solo almacenamiento de valor)
      if (input.custom && !input.formula) {
        return 0;
      }
      // Si tiene custom y tiene fórmula, podría necesitar el valor custom para el cálculo
      // Por ahora, retornamos 0 ya que el valor custom se usa principalmente para almacenamiento
      return 0;
    }

    // Si la fórmula es "Y=TRUE", solo retornar el precio si es "Yes" o "yes"
    if (input.formula === 'Y=TRUE' || input.formula === '') {
      if (normalizedValue !== 'yes') return 0;
      
      // Si tiene size, usar el precio del tamaño
      if (input.size && Array.isArray(input.price)) {
        return input.price[sizeIndex] ?? 0;
      }
      
      return price;
    }

    // Si la fórmula es "UNIT * PRICE" o "Selection Price/UNIT * PRICE"
    if (input.formula === 'UNIT * PRICE' || input.formula === 'Selection Price/UNIT * PRICE') {
      // Buscar el campo de cantidad (puede ser el mismo nombre + "Quantity" o un campo relacionado)
      const quantityControl = form.get(`${input.name}Quantity`);
      const quantity = quantityControl?.value as number ?? 0;

      if (quantity <= 0) return 0;

      // Si la fórmula es "Selection Price/UNIT * PRICE", obtener el precio de la selección
      if (input.formula === 'Selection Price/UNIT * PRICE' && Array.isArray(input.price) && input.selections.length > 0) {
        const selectionIndex = input.selections.findIndex(selection => selection.toLowerCase() === normalizedValue);
        if (selectionIndex >= 0 && selectionIndex < input.price.length) {
          const selectionPrice = input.price[selectionIndex];
          return selectionPrice * quantity;
        }
      }

      return price * quantity;
    }

    // Si la fórmula es "Selection Price"
    if (input.formula === 'Selection Price' && Array.isArray(input.price) && input.selections.length > 0) {
      const selectionIndex = input.selections.findIndex(selection => selection.toLowerCase() === normalizedValue);
      if (selectionIndex >= 0 && selectionIndex < input.price.length) {
        return input.price[selectionIndex];
      }
    }

    // Si la fórmula es un número fijo (ej: "350.00", "900.00")
    const fixedPrice = parseFloat(input.formula);
    if (!isNaN(fixedPrice)) {
      return fixedPrice;
    }

    return 0;
  }

  /**
   * Calcula precio para numberInput
   */
  private calculateNumberInputPrice(
    input: KitchenInput,
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

  /**
   * Calcula precio para select
   */
  private calculateSelectPrice(
    input: KitchenInput,
    value: string,
    price: number,
    sizeIndex: number
  ): number {
    if (!value) return 0;

    // Si la fórmula es "Selection Price"
    if (input.formula === 'Selection Price' && Array.isArray(input.price) && input.selections.length > 0) {
      const selectionIndex = input.selections.indexOf(value);
      if (selectionIndex >= 0 && selectionIndex < input.price.length) {
        return input.price[selectionIndex];
      }
    }

    // Si tiene size, usar el precio del tamaño
    if (input.size && Array.isArray(input.price)) {
      return input.price[sizeIndex] ?? 0;
    }

    return price;
  }
}

