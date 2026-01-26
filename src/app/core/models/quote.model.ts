export type QuoteCategory = 'kitchen' | 'bathroom' | 'basement' | 'additional-work';
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'in_progress' | 'completed';

export interface QuoteCustomer {
  name: string;
  email?: string;
  phone?: string;
}

export interface MaterialItem {
  quantity: number;
  description: string;
}

export interface Materials {
  file?: string;
  items?: MaterialItem[];
  _id?: string; // ID adicional que puede venir del backend
}

export interface RejectionComments {
  comment: string; // Requerido si status es rejected
  rejectedBy?: string; // MongoDB ObjectId del usuario que rechaza
  rejectedAt?: string; // Fecha de rechazo (ISO 8601)
  mediaFiles?: string[]; // Array de URLs de archivos adjuntos
}

export interface Quote {
  _id: string;
  customerId: QuoteCustomer | string; // Puede ser el ID o el objeto poblado
  companyId: string | { _id: string; name: string;[key: string]: unknown }; // Puede ser ID o objeto poblado
  projectId: string;
  category: QuoteCategory;
  versionNumber: number;
  parentQuoteId?: string;
  kitchenInformation?: Record<string, unknown>;
  bathroomInformation?: Record<string, unknown>;
  basementInformation?: Record<string, unknown>;
  additionalWorkInformation?: Record<string, unknown>;
  // materials es un objeto con file (string) e items (array de MaterialItem)
  materials?: Materials | null;
  experience: string;
  totalPrice?: number;
  formData?: Record<string, unknown>;
  userId: string;
  status: QuoteStatus;
  notes?: string;
  // Comentarios de rechazo (requerido si status es rejected)
  rejectionComments?: RejectionComments | null;
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
  createdAt?: string;
  updatedAt?: string;
}

// Helper para verificar si customerId es un objeto poblado
export function isQuoteCustomer(customer: QuoteCustomer | string | undefined): customer is QuoteCustomer {
  return typeof customer === 'object' && customer !== null && 'name' in customer;
}

// QuotePayload usa customerId (string) siempre para creación
// versionNumber es opcional - si no se proporciona, el backend lo calcula automáticamente por projectId + category
export type QuotePayload = Omit<Quote, '_id' | 'versionNumber' | 'parentQuoteId' | 'createdAt' | 'updatedAt' | 'customerId' | 'companyId'> & {
  customerId: string;
  companyId: string;
  versionNumber?: number; // Opcional - el backend lo calcula automáticamente si no se proporciona
};

