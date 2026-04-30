export interface Role {
  _id: string;
  name: string;
  userId: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserRole {
  name: string;
  active: boolean;
}

export interface User {
  _id: string;
  id?: string;
  email: string;
  name: string;
  roles: UserRole[];
  role?: string; // Computed: primer rol activo o primer rol
  active?: boolean; // Computed: si tiene algún rol activo
  createdAt?: string;
  updatedAt?: string;
}

export interface UserPayload {
  name: string;
  userId: string;
  active?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  roles?: UserRole[];
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: string;
}

export interface CreateUserResponse {
  _id: string;
  email: string;
  name: string;
  tempPassword: string;
}
