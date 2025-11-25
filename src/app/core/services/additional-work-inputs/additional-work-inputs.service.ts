import { Injectable, signal } from '@angular/core';
import { ADDITIONAL_WORK_INPUTS } from '../../constants/additional-work-inputs.data';

export interface AdditionalWorkInput {
  name: string;
  label: string;
  category: string;
  element: 'numberInput' | 'radioButton' | 'checkbox' | 'select' | 'selectCustomInputText';
  selections: string[];
  unit: string;
  price: number | number[];
  formula: string;
  custom?: boolean;
  subcategory?: string;
}

export interface SubcategoryGroup {
  id: string;
  title: string;
  inputs: AdditionalWorkInput[];
}

export interface CategoryGroup {
  id: string;
  title: string;
  subcategories: SubcategoryGroup[];
}

@Injectable({
  providedIn: 'root'
})
export class AdditionalWorkInputsService {
  private readonly inputsSignal = signal<AdditionalWorkInput[]>(ADDITIONAL_WORK_INPUTS);
  readonly inputs = this.inputsSignal.asReadonly();

  /**
   * Obtiene todos los inputs
   */
  getAllInputs(): AdditionalWorkInput[] {
    return this.inputsSignal();
  }

  /**
   * Obtiene inputs agrupados y ordenados preservando el orden del array original.
   */
  getOrderedGroupedInputs(): CategoryGroup[] {
    const inputs = this.inputsSignal();
    const categories: CategoryGroup[] = [];
    
    const categoryMap = new Map<string, CategoryGroup>();
    const subcategoryMap = new Map<string, SubcategoryGroup>();

    for (const input of inputs) {
      const categoryKey = input.category;
      
      let category = categoryMap.get(categoryKey);
      if (!category) {
        category = {
          id: categoryKey,
          title: this.formatTitle(categoryKey),
          subcategories: []
        };
        categories.push(category);
        categoryMap.set(categoryKey, category);
      }

      const subcategoryKey = input.subcategory || 'default';
      const uniqueSubKey = `${categoryKey}-${subcategoryKey}`;
      
      let subcategory = subcategoryMap.get(uniqueSubKey);
      
      if (!subcategory) {
        subcategory = {
          id: subcategoryKey,
          title: subcategoryKey === 'default' ? '' : this.formatTitle(subcategoryKey),
          inputs: []
        };
        category.subcategories.push(subcategory);
        subcategoryMap.set(uniqueSubKey, subcategory);
      }

      subcategory.inputs.push(input);
    }

    return categories;
  }

  /**
   * Obtiene un input por nombre
   */
  getInputByName(name: string): AdditionalWorkInput | undefined {
    return this.inputsSignal().find(input => input.name === name);
  }

  private formatTitle(text: string): string {
    return text
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}
