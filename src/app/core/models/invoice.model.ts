export type InvoiceStatus = 'draft' | 'sent' | 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface InvoicePaymentPlan {
  name: string;
  percentage: number;
  amount: number;
  status: PaymentStatus;
  dueDate?: string;
  paymentDate?: string;
  paymentIntentId?: string;
}

export interface Invoice {
  _id: string;
  quoteId: string;
  projectId: string;
  customerId: string | { _id: string; name: string; lastName?: string; email?: string };
  companyId: string;

  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  status: InvoiceStatus;
  paymentPlan: InvoicePaymentPlan[];
  notes?: string;
  createdBy?: string;

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

