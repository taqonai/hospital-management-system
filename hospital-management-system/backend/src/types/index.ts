import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  hospitalId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  search?: string;
  filters?: Record<string, any>;
}

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
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
  occupation?: string;
  maritalStatus?: string;
  nationality?: string;
}

export interface CreateDoctorDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  departmentId: string;
  specialization: string;
  qualification: string;
  experience: number;
  licenseNumber: string;
  consultationFee: number;
  bio?: string;
  availableDays: string[];
  slotDuration?: number;
  maxPatientsPerDay?: number;
}

export interface CreateAppointmentDto {
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  type: 'CONSULTATION' | 'FOLLOW_UP' | 'EMERGENCY' | 'TELEMEDICINE' | 'PROCEDURE';
  reason?: string;
  notes?: string;
  isFollowUp?: boolean;
  parentAppointmentId?: string;
}

export interface CreateConsultationDto {
  appointmentId: string;
  chiefComplaint: string;
  historyOfIllness?: string;
  examination?: string;
  diagnosis: string[];
  icdCodes: string[];
  treatmentPlan?: string;
  advice?: string;
  followUpDate?: Date;
  notes?: string;
}

export interface CreatePrescriptionDto {
  consultationId?: string;
  patientId: string;
  admissionId?: string;
  notes?: string;
  medications: PrescriptionMedicationDto[];
}

export interface PrescriptionMedicationDto {
  drugId?: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  route: string;
  instructions?: string;
  beforeAfterFood?: string;
}

export interface CreateAdmissionDto {
  patientId: string;
  bedId: string;
  admissionType: 'EMERGENCY' | 'ELECTIVE' | 'TRANSFER' | 'MATERNITY';
  admittingDoctorId: string;
  chiefComplaint: string;
  diagnosis: string[];
  icdCodes: string[];
  treatmentPlan?: string;
  estimatedDays?: number;
  notes?: string;
}

export interface CreateLabOrderDto {
  patientId: string;
  consultationId?: string;
  priority?: 'STAT' | 'URGENT' | 'ROUTINE';
  clinicalNotes?: string;
  specialInstructions?: string;
  testIds: string[];
}

export interface CreateImagingOrderDto {
  patientId: string;
  consultationId?: string;
  modalityType: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'MAMMOGRAPHY' | 'PET' | 'FLUOROSCOPY';
  bodyPart: string;
  priority?: 'STAT' | 'URGENT' | 'ROUTINE';
  clinicalHistory?: string;
  scheduledDate?: Date;
  notes?: string;
}

export interface CreateInvoiceDto {
  patientId: string;
  items: InvoiceItemDto[];
  discount?: number;
  notes?: string;
}

export interface InvoiceItemDto {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface AISymptomAnalysisRequest {
  patientId: string;
  symptoms: string[];
  medicalHistory?: string[];
  currentMedications?: string[];
  vitalSigns?: {
    temperature?: number;
    bloodPressure?: string;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
}

export interface AIRiskPredictionRequest {
  patientId: string;
  predictionType: 'READMISSION' | 'LENGTH_OF_STAY' | 'MORTALITY' | 'DISEASE_PROGRESSION' | 'NO_SHOW' | 'DETERIORATION';
  timeframe?: string;
}

export interface AIImageAnalysisRequest {
  imagingOrderId: string;
  imageUrl: string;
  modalityType: string;
  bodyPart: string;
}

// AI Response Types (matching Python ML services)
export interface AIDiagnosis {
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

export interface AIDiagnosisResponse {
  diagnoses: AIDiagnosis[];
  recommendedTests: string[];
  treatmentSuggestions: string[];
  drugInteractions: AIDrugInteraction[];
  riskFactors: AIRiskFactor[];
  confidence: number;
  modelVersion: string;
}

export interface AIRiskPredictionResponse {
  riskScore: number;
  riskLevel: string;
  factors: string[];
  recommendations: string[];
  modelVersion: string;
}

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

export interface AIImageAnalysisResponse {
  findings: AIImageFinding[];
  impression: string;
  recommendations: string[];
  heatmapUrl: string | null;
  abnormalityDetected: boolean;
  confidence: number;
  urgency: string;
  studyInfo: AIStudyInfo;
  modelVersion: string;
}
