import type { FormControl, FormGroup } from '@angular/forms';
import type { Materials } from '../../../../core/models/quote.model';

/**
 * Interface para los valores del formulario de Kitchen Quote
 * Los campos dinámicos se generan desde inputs.json
 */
export interface KitchenQuoteFormValue {
  // Campos base del formulario
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  projectName: string;
  status: string;
  category: 'kitchen';
  source?: string | null;
  address?: string | null;
  experience: string; // basic/premium/luxury
  notes?: string | null;
  type?: string | null; // small/medium/large - tamaño de la cocina

  // Campos de archivos
  countertopsFiles?: string[] | null;
  backsplashFiles?: string[] | null;
  
  // Notas de audio
  audioNotes?: {
    url: string;
    transcription?: string;
    summary?: string;
  } | null;
  
  // Archivo de dibujo
  sketchFile?: string | null;
  
  // Materiales (objeto con file e items)
  materials?: Materials | null;
  
  // Campos dinámicos generados desde inputs.json
  // Estos se añaden dinámicamente según inputs.json
  [key: string]: unknown;
}

/**
 * Tipo base para los controles del formulario
 */
type KitchenQuoteFormControls = {
  customer: FormGroup<{
    name: FormControl<string>;
    email: FormControl<string | null>;
    phone: FormControl<string | null>;
  }>;
  projectName: FormControl<string>;
  status: FormControl<string>;
  category: FormControl<'kitchen'>;
  source: FormControl<string | null>;
  address: FormControl<string | null>;
  experience: FormControl<string>;
  notes: FormControl<string | null>;
  type: FormControl<string | null>;
  countertopsFiles: FormControl<string[] | null>;
  backsplashFiles: FormControl<string[] | null>;
  audioNotes: FormControl<{
    url: string;
    transcription?: string;
    summary?: string;
  } | null>;
  sketchFile: FormControl<string | null>;
  materials: FormControl<Materials | null>;
} & Record<string, FormControl<unknown> | FormGroup<Record<string, FormControl<unknown>>>>;

/**
 * Tipo para el FormGroup de Kitchen Quote
 * Fuertemente tipado con campos base y campos dinámicos
 */
export type KitchenQuoteFormGroup = FormGroup<KitchenQuoteFormControls>;
