export interface Customer {
  _id: string;
  name: string;
  lastName: string;
  phone?: string;
  date?: string;
  email?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  state?: string;
  leadSource?: string;
  description?: string;
  companyId: string;
  userId?: string; // ID del usuario asociado
  createdAt?: string;
  updatedAt?: string;
}

export type CustomerPayload = Omit<Customer, '_id' | 'createdAt' | 'updatedAt'>;


