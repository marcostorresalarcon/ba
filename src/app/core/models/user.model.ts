export interface Role {
  _id: string;
  name: string;
  userId: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  id: string;
  email: string;
  name: string;
  role?: string;
  roleId?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPayload {
  name: string;
  userId: string;
  active?: boolean;
}

