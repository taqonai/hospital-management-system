// Types matching the web frontend

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

export interface PatientUser {
  id: string;
  patientId: string;
  email: string;
  mobile: string;
  firstName: string;
  lastName: string;
  hospitalId: string;
  avatar?: string;
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

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  floor?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
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
  lifestyle?: {
    smoking?: string;
    alcohol?: string;
    exercise?: string;
    diet?: string;
  };
  notes?: string;
}

export interface Allergy {
  id: string;
  allergen: string;
  type: 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
  reaction?: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  refillsRemaining: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  prescribedDate: string;
  doctor: {
    firstName: string;
    lastName: string;
    specialization: string;
  };
}

export interface LabResult {
  id: string;
  testName: string;
  value: string;
  unit: string;
  normalRange: string;
  isAbnormal: boolean;
  isCritical: boolean;
  resultDate: string;
  status: 'PENDING' | 'COMPLETED' | 'VERIFIED';
  orderedBy: {
    firstName: string;
    lastName: string;
  };
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  balanceDue: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  dueDate: string;
  createdAt: string;
  items: BillItem[];
}

export interface BillItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface HealthInsight {
  healthScore: number;
  vitalsTrend: {
    metric: string;
    trend: 'improving' | 'stable' | 'declining';
    value: number;
    previousValue: number;
  }[];
  recommendations: string[];
  alerts: {
    type: 'warning' | 'info' | 'critical';
    message: string;
  }[];
}

export interface MedicalRecord {
  id: string;
  type: 'CONSULTATION' | 'LAB_RESULT' | 'IMAGING' | 'PRESCRIPTION' | 'DISCHARGE_SUMMARY';
  title: string;
  description?: string;
  date: string;
  doctor?: {
    firstName: string;
    lastName: string;
    specialization: string;
  };
  department?: {
    name: string;
  };
  attachments?: string[];
}

// API Response types
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
  errors?: Array<{ field: string; message: string }>;
  pagination?: PaginationInfo;
}

// Dashboard Summary
export interface DashboardSummary {
  upcomingAppointments: Appointment[];
  recentPrescriptions: Prescription[];
  pendingLabResults: LabResult[];
  pendingBills: Bill[];
  healthScore?: number;
  reminders: Reminder[];
  quickStats: {
    totalAppointments: number;
    activePrescriptions: number;
    pendingLabs: number;
    unreadMessages: number;
  };
}

export interface Reminder {
  id: string;
  type: 'APPOINTMENT' | 'MEDICATION' | 'LAB_RESULT' | 'FOLLOW_UP';
  title: string;
  description: string;
  dueDate: string;
  isRead: boolean;
}

// Symptom Checker types
export interface SymptomCheckerSession {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  symptoms: string[];
  questions: SymptomQuestion[];
  result?: SymptomCheckerResult;
}

export interface SymptomQuestion {
  id: string;
  question: string;
  type: 'YES_NO' | 'MULTIPLE_CHOICE' | 'SCALE' | 'TEXT';
  options?: string[];
}

export interface SymptomCheckerResult {
  possibleConditions: {
    name: string;
    probability: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
  }[];
  urgency: 'SELF_CARE' | 'SCHEDULE_APPOINTMENT' | 'URGENT_CARE' | 'EMERGENCY';
  recommendations: string[];
  suggestedDepartment?: string;
  suggestedDoctor?: Doctor;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OTPVerification: { phone: string; method: 'sms' | 'whatsapp' };
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Appointments: undefined;
  Health: undefined;
  Settings: undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  Notifications: undefined;
};

export type AppointmentsStackParamList = {
  AppointmentsList: undefined;
  BookAppointment: { doctorId?: string; departmentId?: string } | undefined;
  AppointmentDetail: { appointmentId: string };
  SelectDoctor: { departmentId: string };
  SelectSlot: { doctorId: string; date: string };
};

export type HealthStackParamList = {
  HealthHub: undefined;
  HealthInsights: undefined;
  SymptomChecker: undefined;
  HealthAssistant: undefined;
  MedicalRecords: undefined;
  RecordDetail: { recordId: string };
  Prescriptions: undefined;
  PrescriptionDetail: { prescriptionId: string };
  LabResults: undefined;
  LabResultDetail: { resultId: string };
  MedicalHistory: undefined;
  Allergies: undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Profile: undefined;
  NotificationSettings: undefined;
  CommunicationSettings: undefined;
  ChangePassword: undefined;
  Billing: undefined;
  BillDetail: { billId: string };
  About: undefined;
};
