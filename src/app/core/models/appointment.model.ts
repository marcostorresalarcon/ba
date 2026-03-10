export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled';

export type AppointmentType =
  | 'measurement'
  | 'installation'
  | 'inspection'
  | 'consultation'
  | 'other';

export interface Appointment {
  _id: string;
  projectId: string;
  date: string;
  type: AppointmentType;
  notes?: string;
  status: AppointmentStatus;
  createdAt?: string;
  updatedAt?: string;
}
