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
  phone?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
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
  cancelReason?: string;
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
  medicationName?: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  refillsRemaining: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DISPENSED';
  prescribedDate: string;
  quantity?: number;
  pharmacy?: string;
  doctorName?: string;
  doctor: {
    firstName: string;
    lastName: string;
    specialization: string;
  };
}

export interface LabResultItem {
  name: string;
  parameter?: string;
  testName?: string;
  value: string;
  unit: string;
  normalRange?: string;
  referenceRange?: string;
  minRange?: number;
  maxRange?: number;
  isAbnormal?: boolean;
  flag?: string;
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
  status: 'PENDING' | 'COMPLETED' | 'VERIFIED' | 'IN_PROGRESS';
  orderedDate?: string;
  doctorName?: string;
  hasAbnormalValues?: boolean;
  results?: LabResultItem[];
  notes?: string;
  reportUrl?: string;
  orderedBy: {
    firstName: string;
    lastName: string;
  };
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  billNumber?: string;
  type?: string;
  description?: string;
  amount: number;
  totalAmount?: number;
  paidAmount: number;
  balanceDue: number;
  balanceAmount?: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'OVERDUE';
  dueDate: string;
  billDate?: string;
  createdAt: string;
  items?: BillItem[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  insuranceCoverage?: number;
  payments?: BillPayment[];
}

export interface BillPayment {
  id: string;
  amount: number;
  method: string;
  date: string;
  reference?: string;
}

export interface BillItem {
  id: string;
  name?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
  total: number;
}

export interface HealthInsightCategory {
  name: string;
  score: number;
  recommendation?: string;
}

export interface HealthInsightVital {
  type: string;
  value: string;
  unit: string;
  isAbnormal?: boolean;
}

export interface HealthInsightRecommendation {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

export interface HealthInsight {
  healthScore: number;
  lastUpdated?: string;
  vitalsTrend: {
    metric: string;
    trend: 'improving' | 'stable' | 'declining';
    value: number;
    previousValue: number;
  }[];
  categories?: HealthInsightCategory[];
  recentVitals?: HealthInsightVital[];
  recommendations: (string | HealthInsightRecommendation)[];
  tips?: string[];
  alerts: {
    type: 'warning' | 'info' | 'critical';
    message: string;
  }[];
}

export interface MedicalRecordAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
}

export interface MedicalRecord {
  id: string;
  type: 'CONSULTATION' | 'LAB_RESULT' | 'IMAGING' | 'PRESCRIPTION' | 'DISCHARGE_SUMMARY' | 'PROCEDURE';
  title: string;
  description?: string;
  date: string;
  createdAt?: string;
  diagnosis?: string;
  doctorName?: string;
  departmentName?: string;
  notes?: string;
  treatment?: string;
  followUp?: string;
  doctor?: {
    firstName: string;
    lastName: string;
    specialization: string;
  };
  department?: {
    name: string;
  };
  attachments?: (string | MedicalRecordAttachment)[];
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
  recommendation?: string;
  recommendations: string[];
  nextSteps?: string[];
  suggestedDepartment?: string;
  suggestedDoctor?: Doctor;
}

// TriageResult extends SymptomCheckerResult for UI purposes
export interface TriageResult extends SymptomCheckerResult {
  recommendation: string;
  nextSteps: string[];
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
  // Health Sync
  HealthSync: undefined;
  DeviceConnection: { provider?: string };
  ManualMetricLog: { metricType?: string };
};

// Fitness Stack
export type FitnessStackParamList = {
  FitnessTracker: undefined;
  LogActivity: { activityType?: string };
  FitnessGoals: undefined;
  FitnessStats: undefined;
};

// Nutrition Stack
export type NutritionStackParamList = {
  Nutrition: undefined;
  LogMeal: { mealType?: string };
  NutritionPlan: undefined;
};

// Wellness Stack
export type WellnessStackParamList = {
  WellnessHub: undefined;
  WellnessAssessment: undefined;
  WellnessGoals: undefined;
  HealthCoach: undefined;
};

// Messages Stack
export type MessagesStackParamList = {
  MessagesList: undefined;
  MessageThread: { threadId: string };
  NewMessage: { recipientId?: string };
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
