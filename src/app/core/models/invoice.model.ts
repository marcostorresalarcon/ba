export type InvoiceStatus = 'draft' | 'sent' | 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface InvoicePaymentPlan {
  name: string; // e.g., "Advance 50%", "Final 50%"
  percentage: number;
  amount: number;
  status: PaymentStatus;
  paymentDate?: string; // Date when it was paid
  paymentIntentId?: string; // Stripe PaymentIntent ID
}

export interface Invoice {
  _id: string;
  quoteId: string; // Associated Quote
  projectId: string; // Associated Project
  customerId: string | { _id: string; name: string; email?: string };
  companyId: string;
  
  number: string; // Invoice number (e.g., INV-001)
  issueDate: string;
  dueDate?: string;
  
  items: InvoiceItem[];
  
  subtotal: number;
  tax?: number;
  totalAmount: number;
  
  // Payment Management
  paymentPlan: InvoicePaymentPlan[];
  
  status: InvoiceStatus;
  notes?: string;
  
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface CreateInvoicePayload {
  quoteId: string;
  paymentPlan: {
    name: string;
    percentage: number;
  }[];
  dueDate?: string;
}

export interface CreatePaymentIntentPayload {
  invoiceId: string;
  amount: number;
  installmentIndex: number; // Index in the paymentPlan array
}

export interface ConfirmPaymentPayload {
  paymentIntentId: string;
  invoiceId: string;
  installmentIndex: number;
}

