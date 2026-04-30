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
  forcePasswordChange?: boolean;
  customerId?: string;
  customerInfo?: {
    _id: string;
    name: string;
    lastName: string;
    email?: string;
    companyId: string;
  };
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
  estimatorId?: string;
  companyId?: string;
}

export interface RegisterRequestResponse {
  message: string;
}

export interface RequestPasswordResetPayload {
  email: string;
}

export interface ConfirmPasswordResetPayload {
  email: string;
  code: string;
  newPassword: string;
}
