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
  | 'DIETARY_STAFF'
  | 'MARKETING';

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

// =============================================================================
// Dashboard Types
// =============================================================================

// Executive/Admin Dashboard Types
export interface ExecutiveSummary {
  totalPatients: number;
  todayAppointments: number;
  todayRevenue: number;
  bedOccupancy: number;
  trends: {
    patients: number;
    appointments: number;
    revenue: number;
    occupancy: number;
  };
}

export interface RevenueAnalysis {
  totalRevenue: number;
  monthlyTrends: Array<{
    month: string;
    billed: number;
    collected: number;
  }>;
  byCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

export interface DepartmentPerformance {
  departments: Array<{
    id: string;
    name: string;
    appointmentsTotal: number;
    appointmentsCompleted: number;
    completionRate: number;
    avgWaitTime: number;
    revenue: number;
  }>;
}

export interface PatientDemographics {
  ageDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  genderDistribution: Array<{
    gender: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}

export interface BedOccupancy {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  byWard: Array<{
    wardName: string;
    total: number;
    occupied: number;
    available: number;
  }>;
}

// Doctor Dashboard Types
export interface DoctorDashboardStats {
  todayAppointments: number;
  monthlyAppointments: number;
  totalPatients: number;
  pendingConsultations: number;
  completedToday: number;
  avgConsultationTime: number;
  upcomingAppointments: Array<{
    id: string;
    patientName: string;
    time: string;
    type: string;
    status: string;
  }>;
  recentConsultations: Array<{
    id: string;
    patientName: string;
    date: string;
    diagnosis: string;
  }>;
}

// Nurse Dashboard Types
export interface OPDStats {
  totalAppointments: number;
  checkedIn: number;
  completed: number;
  noShow: number;
  waiting: number;
  inProgress: number;
  vitalsDone: number;
  vitalsPerding: number;
}

export interface DeteriorationDashboard {
  summary: {
    totalPatients: number;
    highRisk: number;
    vitalsOverdue: number;
    worsening: number;
    stable: number;
    improving: number;
  };
  patients: PatientRiskData[];
}

export interface PatientRiskData {
  id: string;
  admissionId: string;
  patientName: string;
  mrn: string;
  ward: string;
  bedNumber: string;
  news2Score: number;
  riskLevel: 'LOW' | 'LOW_MEDIUM' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trend: 'improving' | 'stable' | 'worsening';
  lastVitalsTime: string;
  vitalsOverdue: boolean;
}

// Receptionist Dashboard Types
export interface QueueAnalytics {
  avgWaitTime: number;
  avgServiceTime: number;
  peakHour: string;
  completionRate: number;
  noShowRate: number;
  hourlyStats: Array<{
    hour: string;
    waiting: number;
    avgWait: number;
  }>;
}

// Marketing Dashboard Types
export interface CRMLeadStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  bySource: Array<{
    source: string;
    count: number;
    converted: number;
  }>;
  byPriority: Array<{
    priority: string;
    count: number;
  }>;
}

export interface CampaignAnalytics {
  id: string;
  name: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  responded: number;
  openRate: number;
  clickRate: number;
}

// Lab Dashboard Types
export interface LabStats {
  totalOrders: number;
  pendingOrders: number;
  completedToday: number;
  criticalResults: number;
  samplesPending: number;
  avgTurnaroundTime: number;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
}

// Pharmacy Dashboard Types
export interface PharmacyStats {
  pendingPrescriptions: number;
  dispensedToday: number;
  lowStockCount: number;
  expiringCount: number;
  totalDrugs: number;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
}

// Radiology Dashboard Types
export interface RadiologyStats {
  totalOrders: number;
  pendingOrders: number;
  completedToday: number;
  pendingReports: number;
  aiAnalyzed: number;
  byModality: Array<{
    modality: string;
    count: number;
    pending: number;
  }>;
}

// HR Dashboard Types
export interface HRDashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  todayPresent: number;
  todayAbsent: number;
  pendingLeaves: number;
  attendanceRate: number;
  departmentWise: Array<{
    department: string;
    count: number;
  }>;
  typeDistribution: Array<{
    type: string;
    count: number;
  }>;
}

// Billing/Accountant Dashboard Types
export interface BillingStats {
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  pendingPayments: number;
  overdueAmount: number;
  claimsSubmitted: number;
  claimsDenied: number;
  collectionRate: number;
  byPaymentStatus: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
}
