export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'estimator' | 'administrator' | 'admin' | string;
  customerId?: string; // ID del cliente asociado (puede variar por compañía)
  customerInfo?: {
    _id: string;
    name: string;
    lastName: string;
    email?: string;
    companyId: string;
  }; // Información completa del customer guardada en localStorage
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

export interface RegisterRequestPayload {
  email: string;
  name: string;
  password: string;
}

export interface RegisterConfirmPayload {
  email: string;
  code: string;
}

export interface RegisterRequestResponse {
  message: string;
}

