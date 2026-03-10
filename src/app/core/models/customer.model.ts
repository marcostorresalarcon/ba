export interface CustomerAddress {
  label?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  isPrimary?: boolean;
}

export interface Customer {
  _id: string;
  name?: string;
  lastName?: string;
  phone?: string;
  date?: string;
  email?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  state?: string;
  addresses?: CustomerAddress[];
  leadSource?: string;
  description?: string;
  companyId?: string;
  userId?: string;
}

export type CustomerPayload = Partial<Omit<Customer, '_id'>>;
