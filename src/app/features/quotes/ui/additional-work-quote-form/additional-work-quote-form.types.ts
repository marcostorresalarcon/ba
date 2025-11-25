import type { FormControl, FormGroup } from '@angular/forms';
import type { Materials } from '../../../../core/models/quote.model';

/**
 * Interface para los valores del formulario de Additional Work Quote
 * Los campos dinámicos se generan desde inputs_additional_work.json
 */
export interface AdditionalWorkQuoteFormValue {
  // Campos base del formulario
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  projectName: string;
  status: string;
  category: 'additional-work';
  source?: string | null;
  address?: string | null;
  notes?: string | null;

  // Materiales (objeto con file e items)
  materials?: Materials | null;
  
  // Campos dinámicos generados desde inputs_additional_work.json
  // Estos se añaden dinámicamente según inputs_additional_work.json
  [key: string]: unknown;
}

/**
 * Tipo base para los controles del formulario
 */
type AdditionalWorkQuoteFormControls = {
  customer: FormGroup<{
    name: FormControl<string>;
    email: FormControl<string | null>;
    phone: FormControl<string | null>;
  }>;
  projectName: FormControl<string>;
  status: FormControl<string>;
  category: FormControl<'additional-work'>;
  source: FormControl<string | null>;
  address: FormControl<string | null>;
  notes: FormControl<string | null>;
  materials: FormControl<Materials | null>;
} & Record<string, FormControl<unknown> | FormGroup<Record<string, FormControl<unknown>>>>;

/**
 * Tipo para el FormGroup de Additional Work Quote
 * Fuertemente tipado con campos base y campos dinámicos
 */
export type AdditionalWorkQuoteFormGroup = FormGroup<AdditionalWorkQuoteFormControls>;
