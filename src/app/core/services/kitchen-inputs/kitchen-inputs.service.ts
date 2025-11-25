import { Injectable, signal } from '@angular/core';
import { KITCHEN_INPUTS } from '../../constants/kitchen-inputs.data';

export interface KitchenInput {
  name: string;
  label: string;
  category: string;
  element: 'numberInput' | 'radioButton' | 'checkbox' | 'select' | 'inputFileTextArea';
  selections: string[];
  unit: string;
  price: number | number[];
  formula: string;
  custom?: boolean;
  size?: boolean;
  subcategory?: string;
  experience?: 'basic' | 'premium' | 'luxury';
}

export interface SubcategoryGroup {
  id: string;
  title: string;
  inputs: KitchenInput[];
}

export interface CategoryGroup {
  id: string;
  title: string;
  subcategories: SubcategoryGroup[];
}

@Injectable({
  providedIn: 'root'
})
export class KitchenInputsService {
  private readonly inputsSignal = signal<KitchenInput[]>(KITCHEN_INPUTS);
  readonly inputs = this.inputsSignal.asReadonly();

  /**
   * Obtiene todos los inputs filtrados por experiencia
   */
  getInputsByExperience(experience: string): KitchenInput[] {
    const inputs = this.inputsSignal();
    return inputs.filter(input => !input.experience || input.experience === experience);
  }

  /**
   * Obtiene inputs agrupados y ordenados preservando el orden del array original.
   * Estructura optimizada para iteración en plantilla sin perder orden.
   */
  getOrderedGroupedInputs(experience: string): CategoryGroup[] {
    const inputs = this.getInputsByExperience(experience);
    const categories: CategoryGroup[] = [];
    
    // Mapa para acceso rápido a referencias, pero usamos el array 'categories' para el orden
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
      // Clave compuesta para el mapa de subcategorías para evitar colisiones entre categorías
      const uniqueSubKey = `${categoryKey}-${subcategoryKey}`;
      
      let subcategory = subcategoryMap.get(uniqueSubKey);
      
      // Verificamos si la subcategoría ya existe EN ESTA categoría
      // (aunque el mapa usa clave única, verificamos que esté en el array de subcategorías de la categoría actual)
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
  getInputByName(name: string): KitchenInput | undefined {
    return this.inputsSignal().find(input => input.name === name);
  }

  private formatTitle(text: string): string {
    return text
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * @deprecated Usar getOrderedGroupedInputs para garantizar orden visual
   */
  getInputsGrouped(experience: string): Record<string, Record<string, KitchenInput[]>> {
    const inputs = this.getInputsByExperience(experience);
    const grouped: Record<string, Record<string, KitchenInput[]>> = {};

    for (const input of inputs) {
      const category = input.category;
      const subcategory = input.subcategory || 'default';

      if (!grouped[category]) {
        grouped[category] = {};
      }
      if (!grouped[category][subcategory]) {
        grouped[category][subcategory] = [];
      }
      grouped[category][subcategory].push(input);
    }

    return grouped;
  }
}
