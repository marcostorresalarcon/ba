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

export interface Quote {
  _id: string;
  customerId: QuoteCustomer | string; // Puede ser el ID o el objeto poblado
  companyId: string | { _id: string; name: string; [key: string]: unknown }; // Puede ser ID o objeto poblado
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
  createdAt?: string;
  updatedAt?: string;
}

// Helper para verificar si customerId es un objeto poblado
export function isQuoteCustomer(customer: QuoteCustomer | string | undefined): customer is QuoteCustomer {
  return typeof customer === 'object' && customer !== null && 'name' in customer;
}

// QuotePayload usa customerId (string) siempre para creación
export type QuotePayload = Omit<Quote, '_id' | 'versionNumber' | 'parentQuoteId' | 'createdAt' | 'updatedAt' | 'customerId' | 'companyId'> & {
  customerId: string;
  companyId: string;
};

