export interface Company {
  _id: string;
  name: string;
  description?: string;
  configuration?: Record<string, unknown>;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  logoUrl?: string;
}


