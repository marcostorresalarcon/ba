import type { FormControl, FormGroup } from '@angular/forms';
import type { Materials, QuoteCategory } from '../../../../core/models/quote.model';

/**
 * Interface para los valores del formulario genérico de Quote
 * Los campos dinámicos se generan desde inputs_additional_work.json
 * Soporta: additional-work, bathroom, basement
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
  category: QuoteCategory; // Genérico para soportar todas las categorías
  source?: string | null;
  address?: string | null;
  notes?: string | null;

  // Materiales (objeto con file e items)
  materials?: Materials | null;
  
  // Notas de audio (múltiples)
  audioNotes?: {
    url: string;
    transcription?: string;
    summary?: string;
  }[] | null;

  // Archivos de dibujo (múltiples)
  sketchFiles?: string[] | null;

  // Sección de comentarios adicionales con fotos/videos
  additionalComments?: {
    comment?: string | null;
    mediaFiles?: string[] | null;
  } | null;

  // Campos de presupuesto
  roughQuote?: number | null;
  clientBudget?: number | null;
  
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
  category: FormControl<QuoteCategory>; // Genérico para soportar todas las categorías
  source: FormControl<string | null>;
  address: FormControl<string | null>;
  notes: FormControl<string | null>;
  materials: FormControl<Materials | null>;
  audioNotes: FormControl<{
    url: string;
    transcription?: string;
    summary?: string;
  }[] | null>;
  sketchFiles: FormControl<string[] | null>;
  additionalComments: FormGroup<{
    comment: FormControl<string | null>;
    mediaFiles: FormControl<string[] | null>;
  }>;
  roughQuote: FormControl<number | null>;
  clientBudget: FormControl<number | null>;
} & Record<string, FormControl<unknown> | FormGroup<Record<string, FormControl<unknown>>>>;

/**
 * Tipo para el FormGroup de Additional Work Quote
 * Fuertemente tipado con campos base y campos dinámicos
 */
export type AdditionalWorkQuoteFormGroup = FormGroup<AdditionalWorkQuoteFormControls>;
