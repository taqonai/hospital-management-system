export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  hospitalId: string;
  avatar?: string;
}

export type UserRole =
  | 'SUPER_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'RECEPTIONIST'
  | 'LAB_TECHNICIAN'
  | 'PHARMACIST'
  | 'RADIOLOGIST'
  | 'ACCOUNTANT'
  | 'PATIENT'
  | 'HR_MANAGER'
  | 'HR_STAFF'
  | 'HOUSEKEEPING_MANAGER'
  | 'HOUSEKEEPING_STAFF'
  | 'MAINTENANCE_STAFF'
  | 'SECURITY_STAFF'
  | 'DIETARY_STAFF';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup?: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  departmentId: string;
  specialization: string;
  qualification: string;
  experience: number;
  licenseNumber: string;
  consultationFee: number;
  bio?: string;
  availableDays: string[];
  slotDuration: number;
  maxPatientsPerDay: number;
  isAvailable: boolean;
  rating: number;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  department: {
    id: string;
    name: string;
  };
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  type: AppointmentType;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  tokenNumber?: number;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    mrn: string;
  };
  doctor: Doctor;
}

export type AppointmentType =
  | 'CONSULTATION'
  | 'FOLLOW_UP'
  | 'EMERGENCY'
  | 'TELEMEDICINE'
  | 'PROCEDURE';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface Vital {
  id: string;
  temperature?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  bloodSugar?: number;
  recordedAt: string;
}

export interface MedicalHistory {
  chronicConditions: string[];
  pastSurgeries: string[];
  familyHistory: string[];
  currentMedications: string[];
  immunizations: string[];
  lifestyle?: any;
  notes?: string;
}

export interface Allergy {
  id: string;
  allergen: string;
  type: 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
  reaction?: string;
}

// AI Diagnosis Types (ML-powered)
export interface AIDiagnosisItem {
  icd10: string;
  name: string;
  confidence: number;
  category?: string;
  severity?: string;
}

export interface AIDrugInteraction {
  drug1: string;
  drug2: string;
  severity: string;
  warning: string;
}

export interface AIRiskFactor {
  factor: string;
  relevance: string;
}

export interface AIDiagnosis {
  id?: string;
  symptoms: string[];
  suggestedDiagnoses: AIDiagnosisItem[];
  recommendedTests: string[];
  treatmentSuggestions: string[];
  drugInteractionWarnings: AIDrugInteraction[] | string[];
  riskFactors: AIRiskFactor[] | string[];
  confidence: number;
  modelVersion?: string;
  disclaimer?: string;
  createdAt?: string;
}

export interface AIDiagnosisResponse {
  diagnoses: AIDiagnosisItem[];
  recommendedTests: string[];
  treatmentSuggestions: string[];
  drugInteractions: AIDrugInteraction[];
  riskFactors: AIRiskFactor[];
  confidence: number;
  modelVersion: string;
  disclaimer?: string;
}

export interface AIPrediction {
  id?: string;
  predictionType: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  factors: string[];
  recommendations: string[];
  timeframe: string;
  modelVersion?: string;
  createdAt?: string;
}

// AI Image Analysis Types (ML-powered)
export interface AIImageFinding {
  region: string;
  finding: string;
  abnormal: boolean;
  confidence: number;
  severity?: string;
  pathology?: string;
}

export interface AIStudyInfo {
  modality: string;
  bodyPart: string;
  patientAge: number;
  patientGender: string;
}

export interface AIImageAnalysis {
  id?: string;
  findings: AIImageFinding[];
  impression: string;
  recommendations: string[];
  heatmapUrl: string | null;
  abnormalityDetected: boolean;
  confidence: number;
  urgency: 'routine' | 'urgent' | 'emergent' | 'critical';
  studyInfo: AIStudyInfo;
  modelVersion: string;
  disclaimer?: string;
}

export interface AIHealthStatus {
  status: 'connected' | 'disconnected';
  aiService?: {
    status: string;
    services: {
      diagnostic: string;
      predictive: string;
      imaging: string;
    };
  };
  serviceUrl: string;
  error?: string;
}

export interface DashboardStats {
  today: {
    total: number;
    completed: number;
    pending: number;
    noShow: number;
  };
  weeklyTotal: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
  pagination?: PaginationInfo;
}
