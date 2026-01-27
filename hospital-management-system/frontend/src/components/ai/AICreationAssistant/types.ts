export type EntityType = 'patient' | 'doctor' | 'appointment' | null;

export interface ExtractedPatientData {
  firstName?: string;
  lastName?: string;
  gender?: 'MALE' | 'FEMALE';
  dateOfBirth?: string;
  phone?: string;
  email?: string;
  bloodGroup?: string;
  address?: string;
}

export interface ExtractedDoctorData {
  firstName?: string;
  lastName?: string;
  email?: string;
  specialization?: string;
  department?: string;
  licenseNumber?: string;
  experience?: number;
  consultationFee?: number;
}

export interface ExtractedAppointmentData {
  patientName?: string;
  doctorName?: string;
  date?: string;
  time?: string;
  reason?: string;
  appointmentType?: string;
}

export interface ParseIntentResponse {
  intent: string;
  entityType: EntityType;
  extractedData: Record<string, any>;
  confidence: number;
  modelVersion: string;
}

export interface ExtractDataResponse {
  success: boolean;
  data: Record<string, any>;
  confidence: number;
  missingFields: string[];
  modelVersion: string;
}

export interface CreationStep {
  id: string;
  type: 'input' | 'processing' | 'review' | 'success' | 'error';
  message: string;
  timestamp: Date;
  data?: Record<string, any>;
}
