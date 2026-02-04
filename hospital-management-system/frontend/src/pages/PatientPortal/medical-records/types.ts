// Shared types for the unified Medical Records page

// === Visit History (from MedicalRecords.tsx) ===

export interface Diagnosis {
  id: string;
  code: string;
  description: string;
  type: 'PRIMARY' | 'SECONDARY' | 'ADMITTING';
  notes?: string;
}

export interface Procedure {
  id: string;
  code: string;
  name: string;
  date?: string;
  notes?: string;
}

export interface VitalSigns {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
}

export interface MedicalRecord {
  id: string;
  visitDate: string;
  visitType: 'OPD' | 'IPD' | 'EMERGENCY' | 'TELEMEDICINE' | 'HOME_VISIT';
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  allergies?: string[];
  medications?: string[];
  physicalExamination?: string;
  vitalSigns?: VitalSigns;
  diagnoses: Diagnosis[];
  procedures?: Procedure[];
  treatmentPlan?: string;
  instructions?: string;
  followUpDate?: string;
  notes?: string;
  doctor: {
    id: string;
    specialization: string;
    user?: {
      firstName: string;
      lastName: string;
    };
  };
  department?: {
    id: string;
    name: string;
  };
  attachments?: {
    id: string;
    name: string;
    type: string;
    url: string;
  }[];
  createdAt: string;
  updatedAt?: string;
}

// === Medical History (from MedicalHistory.tsx) ===

export interface MedicalHistory {
  id: string;
  patientId: string;
  chronicConditions: string[];
  pastSurgeries: string[];
  familyHistory: string[];
  currentMedications: string[];
  immunizations: string[];
  lifestyle: {
    smoking?: string;
    alcohol?: string;
    exercise?: string;
    diet?: string;
  } | null;
  notes: string | null;
  currentTreatment?: string | null;
  isPregnant?: boolean | null;
  expectedDueDate?: string | null;
}

export interface Allergy {
  id: string;
  allergen: string;
  type: 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
  reaction?: string;
  notes?: string;
  createdAt: string;
}

export interface ImmunizationRecord {
  id: string;
  vaccineName: string;
  vaccineType?: string | null;
  doseNumber?: number | null;
  dateAdministered: string;
  administeredBy?: string | null;
  lotNumber?: string | null;
  nextDueDate?: string | null;
  notes?: string | null;
  verificationStatus?: string;
}

export interface PastSurgeryRecord {
  id: string;
  surgeryName: string;
  surgeryDate: string;
  hospitalName: string;
  hospitalLocation?: string | null;
  surgeonName?: string | null;
  indication?: string | null;
  complications?: string | null;
  outcome?: string | null;
  notes?: string | null;
  verificationStatus?: string;
}

export interface AIAnalysis {
  summary: {
    totalConditions: number;
    totalAllergies: number;
    riskLevel: string;
  };
  recommendations: Array<{
    title: string;
    description: string;
    priority: string;
  }>;
  riskFactors: Array<{
    factor: string;
    level: string;
  }>;
  preventiveCare: Array<{
    test: string;
    frequency: string;
    importance: string;
  }>;
  lastAnalyzed: string;
}
