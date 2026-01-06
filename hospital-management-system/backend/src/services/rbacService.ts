import prisma from '../config/database';
import { NotFoundError, AppError, ConflictError } from '../middleware/errorHandler';
import { UserRole, Prisma } from '@prisma/client';

// ==================== PERMISSION DEFINITIONS ====================

/**
 * All available permissions in the system.
 * Format: module:resource:action
 */
export const PERMISSIONS = {
  // Patient Management
  PATIENTS_READ: 'patients:read',
  PATIENTS_WRITE: 'patients:write',
  PATIENTS_DELETE: 'patients:delete',
  PATIENTS_MEDICAL_HISTORY: 'patients:medical_history',

  // Appointments
  APPOINTMENTS_READ: 'appointments:read',
  APPOINTMENTS_WRITE: 'appointments:write',
  APPOINTMENTS_DELETE: 'appointments:delete',
  APPOINTMENTS_RESCHEDULE: 'appointments:reschedule',

  // Doctors
  DOCTORS_READ: 'doctors:read',
  DOCTORS_WRITE: 'doctors:write',
  DOCTORS_DELETE: 'doctors:delete',
  DOCTORS_SCHEDULE: 'doctors:schedule',

  // Departments
  DEPARTMENTS_READ: 'departments:read',
  DEPARTMENTS_WRITE: 'departments:write',
  DEPARTMENTS_DELETE: 'departments:delete',

  // Laboratory
  LAB_ORDERS_READ: 'lab:orders:read',
  LAB_ORDERS_WRITE: 'lab:orders:write',
  LAB_ORDERS_DELETE: 'lab:orders:delete',
  LAB_RESULTS_WRITE: 'lab:results:write',
  LAB_RESULTS_VERIFY: 'lab:results:verify',
  LAB_TESTS_MANAGE: 'lab:tests:manage',

  // Radiology / Imaging
  RADIOLOGY_ORDERS_READ: 'radiology:orders:read',
  RADIOLOGY_ORDERS_WRITE: 'radiology:orders:write',
  RADIOLOGY_RESULTS_WRITE: 'radiology:results:write',
  RADIOLOGY_RESULTS_VERIFY: 'radiology:results:verify',

  // Pharmacy
  PHARMACY_READ: 'pharmacy:read',
  PHARMACY_DISPENSE: 'pharmacy:dispense',
  PHARMACY_INVENTORY: 'pharmacy:inventory',
  PHARMACY_DRUGS_MANAGE: 'pharmacy:drugs:manage',
  PHARMACY_PRESCRIPTIONS: 'pharmacy:prescriptions',

  // Billing
  BILLING_READ: 'billing:read',
  BILLING_WRITE: 'billing:write',
  BILLING_DELETE: 'billing:delete',
  BILLING_REFUND: 'billing:refund',
  BILLING_DISCOUNTS: 'billing:discounts',
  BILLING_REPORTS: 'billing:reports',

  // HR
  HR_EMPLOYEES_READ: 'hr:employees:read',
  HR_EMPLOYEES_WRITE: 'hr:employees:write',
  HR_EMPLOYEES_DELETE: 'hr:employees:delete',
  HR_PAYROLL: 'hr:payroll',
  HR_ATTENDANCE: 'hr:attendance',
  HR_LEAVE_MANAGE: 'hr:leave:manage',
  HR_LEAVE_APPROVE: 'hr:leave:approve',
  HR_PERFORMANCE: 'hr:performance',
  HR_TRAINING: 'hr:training',

  // IPD (In-Patient Department)
  IPD_ADMISSIONS_READ: 'ipd:admissions:read',
  IPD_ADMISSIONS_WRITE: 'ipd:admissions:write',
  IPD_DISCHARGE: 'ipd:discharge',
  IPD_BEDS_MANAGE: 'ipd:beds:manage',
  IPD_ROUNDS: 'ipd:rounds',
  IPD_NURSING_NOTES: 'ipd:nursing:notes',

  // OPD (Out-Patient Department)
  OPD_VISITS_READ: 'opd:visits:read',
  OPD_VISITS_WRITE: 'opd:visits:write',
  OPD_CONSULTATIONS: 'opd:consultations',
  OPD_PRESCRIPTIONS: 'opd:prescriptions',

  // Emergency
  EMERGENCY_READ: 'emergency:read',
  EMERGENCY_WRITE: 'emergency:write',
  EMERGENCY_TRIAGE: 'emergency:triage',
  EMERGENCY_CRITICAL: 'emergency:critical',

  // Surgery
  SURGERY_READ: 'surgery:read',
  SURGERY_WRITE: 'surgery:write',
  SURGERY_SCHEDULE: 'surgery:schedule',
  SURGERY_NOTES: 'surgery:notes',
  SURGERY_OT_MANAGE: 'surgery:ot:manage',

  // Blood Bank
  BLOOD_BANK_READ: 'blood_bank:read',
  BLOOD_BANK_WRITE: 'blood_bank:write',
  BLOOD_BANK_DONATIONS: 'blood_bank:donations',
  BLOOD_BANK_REQUESTS: 'blood_bank:requests',
  BLOOD_BANK_INVENTORY: 'blood_bank:inventory',

  // Medical Records
  MEDICAL_RECORDS_READ: 'medical_records:read',
  MEDICAL_RECORDS_WRITE: 'medical_records:write',
  MEDICAL_RECORDS_DELETE: 'medical_records:delete',
  MEDICAL_RECORDS_EXPORT: 'medical_records:export',

  // Telemedicine
  TELEMEDICINE_READ: 'telemedicine:read',
  TELEMEDICINE_WRITE: 'telemedicine:write',
  TELEMEDICINE_HOST: 'telemedicine:host',

  // Queue Management
  QUEUE_READ: 'queue:read',
  QUEUE_WRITE: 'queue:write',
  QUEUE_MANAGE: 'queue:manage',

  // Dietary
  DIETARY_READ: 'dietary:read',
  DIETARY_WRITE: 'dietary:write',
  DIETARY_MEAL_PLANS: 'dietary:meal_plans',

  // Housekeeping
  HOUSEKEEPING_READ: 'housekeeping:read',
  HOUSEKEEPING_WRITE: 'housekeeping:write',
  HOUSEKEEPING_ASSIGN: 'housekeeping:assign',

  // Assets
  ASSETS_READ: 'assets:read',
  ASSETS_WRITE: 'assets:write',
  ASSETS_MAINTENANCE: 'assets:maintenance',

  // Ambulance
  AMBULANCE_READ: 'ambulance:read',
  AMBULANCE_WRITE: 'ambulance:write',
  AMBULANCE_DISPATCH: 'ambulance:dispatch',

  // CSSD (Central Sterile Supply Department)
  CSSD_READ: 'cssd:read',
  CSSD_WRITE: 'cssd:write',
  CSSD_STERILIZATION: 'cssd:sterilization',

  // Mortuary
  MORTUARY_READ: 'mortuary:read',
  MORTUARY_WRITE: 'mortuary:write',
  MORTUARY_RELEASE: 'mortuary:release',

  // Quality
  QUALITY_READ: 'quality:read',
  QUALITY_WRITE: 'quality:write',
  QUALITY_INCIDENTS: 'quality:incidents',
  QUALITY_AUDITS: 'quality:audits',

  // Reports
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',
  REPORTS_FINANCIAL: 'reports:financial',
  REPORTS_CLINICAL: 'reports:clinical',
  REPORTS_ANALYTICS: 'reports:analytics',

  // AI Services
  AI_DIAGNOSTIC: 'ai:diagnostic',
  AI_PREDICTIVE: 'ai:predictive',
  AI_IMAGING: 'ai:imaging',
  AI_SCRIBE: 'ai:scribe',
  AI_SYMPTOM_CHECKER: 'ai:symptom_checker',
  AI_EARLY_WARNING: 'ai:early_warning',
  AI_MED_SAFETY: 'ai:med_safety',
  AI_SMART_ORDERS: 'ai:smart_orders',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  SETTINGS_HOSPITAL: 'settings:hospital',

  // User Management (within hospital)
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',

  // RBAC Management (only for HOSPITAL_ADMIN)
  RBAC_MANAGE: 'rbac:manage',
  RBAC_ROLES_READ: 'rbac:roles:read',
  RBAC_ROLES_WRITE: 'rbac:roles:write',
  RBAC_ASSIGN: 'rbac:assign',
  RBAC_AUDIT: 'rbac:audit',

  // Notifications
  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_MANAGE: 'notifications:manage',

  // Patient Portal
  PATIENT_PORTAL_ACCESS: 'patient_portal:access',
  PATIENT_PORTAL_APPOINTMENTS: 'patient_portal:appointments',
  PATIENT_PORTAL_RECORDS: 'patient_portal:records',
  PATIENT_PORTAL_BILLING: 'patient_portal:billing',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ==================== DEFAULT ROLE PERMISSIONS ====================

/**
 * Default permissions for each base UserRole.
 * These serve as the foundation; custom roles can extend or modify these.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS) as Permission[], // All permissions

  HOSPITAL_ADMIN: [
    // Full access within hospital except SUPER_ADMIN operations
    ...Object.values(PERMISSIONS).filter(p => !p.startsWith('settings:hospital')),
  ] as Permission[],

  DOCTOR: [
    // Patients
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_WRITE,
    PERMISSIONS.PATIENTS_MEDICAL_HISTORY,
    // Appointments
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,
    PERMISSIONS.APPOINTMENTS_RESCHEDULE,
    // Doctors
    PERMISSIONS.DOCTORS_READ,
    PERMISSIONS.DOCTORS_SCHEDULE,
    // Departments
    PERMISSIONS.DEPARTMENTS_READ,
    // Lab
    PERMISSIONS.LAB_ORDERS_READ,
    PERMISSIONS.LAB_ORDERS_WRITE,
    // Radiology
    PERMISSIONS.RADIOLOGY_ORDERS_READ,
    PERMISSIONS.RADIOLOGY_ORDERS_WRITE,
    // Pharmacy
    PERMISSIONS.PHARMACY_READ,
    PERMISSIONS.PHARMACY_PRESCRIPTIONS,
    // IPD
    PERMISSIONS.IPD_ADMISSIONS_READ,
    PERMISSIONS.IPD_ADMISSIONS_WRITE,
    PERMISSIONS.IPD_DISCHARGE,
    PERMISSIONS.IPD_ROUNDS,
    // OPD
    PERMISSIONS.OPD_VISITS_READ,
    PERMISSIONS.OPD_VISITS_WRITE,
    PERMISSIONS.OPD_CONSULTATIONS,
    PERMISSIONS.OPD_PRESCRIPTIONS,
    // Emergency
    PERMISSIONS.EMERGENCY_READ,
    PERMISSIONS.EMERGENCY_WRITE,
    PERMISSIONS.EMERGENCY_TRIAGE,
    PERMISSIONS.EMERGENCY_CRITICAL,
    // Surgery
    PERMISSIONS.SURGERY_READ,
    PERMISSIONS.SURGERY_WRITE,
    PERMISSIONS.SURGERY_SCHEDULE,
    PERMISSIONS.SURGERY_NOTES,
    // Medical Records
    PERMISSIONS.MEDICAL_RECORDS_READ,
    PERMISSIONS.MEDICAL_RECORDS_WRITE,
    // Telemedicine
    PERMISSIONS.TELEMEDICINE_READ,
    PERMISSIONS.TELEMEDICINE_WRITE,
    PERMISSIONS.TELEMEDICINE_HOST,
    // Queue
    PERMISSIONS.QUEUE_READ,
    // Reports
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CLINICAL,
    // AI
    PERMISSIONS.AI_DIAGNOSTIC,
    PERMISSIONS.AI_PREDICTIVE,
    PERMISSIONS.AI_IMAGING,
    PERMISSIONS.AI_SCRIBE,
    PERMISSIONS.AI_SYMPTOM_CHECKER,
    PERMISSIONS.AI_EARLY_WARNING,
    PERMISSIONS.AI_MED_SAFETY,
    PERMISSIONS.AI_SMART_ORDERS,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  NURSE: [
    // Patients
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_WRITE,
    PERMISSIONS.PATIENTS_MEDICAL_HISTORY,
    // Appointments
    PERMISSIONS.APPOINTMENTS_READ,
    // Doctors
    PERMISSIONS.DOCTORS_READ,
    // Departments
    PERMISSIONS.DEPARTMENTS_READ,
    // Lab
    PERMISSIONS.LAB_ORDERS_READ,
    // Radiology
    PERMISSIONS.RADIOLOGY_ORDERS_READ,
    // Pharmacy
    PERMISSIONS.PHARMACY_READ,
    // IPD
    PERMISSIONS.IPD_ADMISSIONS_READ,
    PERMISSIONS.IPD_BEDS_MANAGE,
    PERMISSIONS.IPD_NURSING_NOTES,
    // OPD
    PERMISSIONS.OPD_VISITS_READ,
    // Emergency
    PERMISSIONS.EMERGENCY_READ,
    PERMISSIONS.EMERGENCY_WRITE,
    PERMISSIONS.EMERGENCY_TRIAGE,
    // Blood Bank
    PERMISSIONS.BLOOD_BANK_READ,
    PERMISSIONS.BLOOD_BANK_REQUESTS,
    // Medical Records
    PERMISSIONS.MEDICAL_RECORDS_READ,
    // Queue
    PERMISSIONS.QUEUE_READ,
    PERMISSIONS.QUEUE_WRITE,
    // AI
    PERMISSIONS.AI_EARLY_WARNING,
    PERMISSIONS.AI_MED_SAFETY,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  RECEPTIONIST: [
    // Patients
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_WRITE,
    // Appointments
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_WRITE,
    PERMISSIONS.APPOINTMENTS_RESCHEDULE,
    // Doctors
    PERMISSIONS.DOCTORS_READ,
    // Departments
    PERMISSIONS.DEPARTMENTS_READ,
    // Billing
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_WRITE,
    // IPD
    PERMISSIONS.IPD_ADMISSIONS_READ,
    // OPD
    PERMISSIONS.OPD_VISITS_READ,
    PERMISSIONS.OPD_VISITS_WRITE,
    // Queue
    PERMISSIONS.QUEUE_READ,
    PERMISSIONS.QUEUE_WRITE,
    PERMISSIONS.QUEUE_MANAGE,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  LAB_TECHNICIAN: [
    // Patients
    PERMISSIONS.PATIENTS_READ,
    // Lab
    PERMISSIONS.LAB_ORDERS_READ,
    PERMISSIONS.LAB_ORDERS_WRITE,
    PERMISSIONS.LAB_RESULTS_WRITE,
    PERMISSIONS.LAB_TESTS_MANAGE,
    // Reports
    PERMISSIONS.REPORTS_VIEW,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  PHARMACIST: [
    // Patients
    PERMISSIONS.PATIENTS_READ,
    // Pharmacy
    PERMISSIONS.PHARMACY_READ,
    PERMISSIONS.PHARMACY_DISPENSE,
    PERMISSIONS.PHARMACY_INVENTORY,
    PERMISSIONS.PHARMACY_DRUGS_MANAGE,
    PERMISSIONS.PHARMACY_PRESCRIPTIONS,
    // AI
    PERMISSIONS.AI_MED_SAFETY,
    // Reports
    PERMISSIONS.REPORTS_VIEW,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  RADIOLOGIST: [
    // Patients
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.PATIENTS_MEDICAL_HISTORY,
    // Radiology
    PERMISSIONS.RADIOLOGY_ORDERS_READ,
    PERMISSIONS.RADIOLOGY_ORDERS_WRITE,
    PERMISSIONS.RADIOLOGY_RESULTS_WRITE,
    PERMISSIONS.RADIOLOGY_RESULTS_VERIFY,
    // AI
    PERMISSIONS.AI_IMAGING,
    // Reports
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_CLINICAL,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  ACCOUNTANT: [
    // Billing
    PERMISSIONS.BILLING_READ,
    PERMISSIONS.BILLING_WRITE,
    PERMISSIONS.BILLING_REFUND,
    PERMISSIONS.BILLING_DISCOUNTS,
    PERMISSIONS.BILLING_REPORTS,
    // Reports
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.REPORTS_FINANCIAL,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  PATIENT: [
    // Patient Portal
    PERMISSIONS.PATIENT_PORTAL_ACCESS,
    PERMISSIONS.PATIENT_PORTAL_APPOINTMENTS,
    PERMISSIONS.PATIENT_PORTAL_RECORDS,
    PERMISSIONS.PATIENT_PORTAL_BILLING,
    // Telemedicine
    PERMISSIONS.TELEMEDICINE_READ,
    // Queue
    PERMISSIONS.QUEUE_READ,
    // AI
    PERMISSIONS.AI_SYMPTOM_CHECKER,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  HR_MANAGER: [
    // HR - Full access
    PERMISSIONS.HR_EMPLOYEES_READ,
    PERMISSIONS.HR_EMPLOYEES_WRITE,
    PERMISSIONS.HR_EMPLOYEES_DELETE,
    PERMISSIONS.HR_PAYROLL,
    PERMISSIONS.HR_ATTENDANCE,
    PERMISSIONS.HR_LEAVE_MANAGE,
    PERMISSIONS.HR_LEAVE_APPROVE,
    PERMISSIONS.HR_PERFORMANCE,
    PERMISSIONS.HR_TRAINING,
    // Reports
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    // Users
    PERMISSIONS.USERS_READ,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  HR_STAFF: [
    // HR - Limited
    PERMISSIONS.HR_EMPLOYEES_READ,
    PERMISSIONS.HR_EMPLOYEES_WRITE,
    PERMISSIONS.HR_ATTENDANCE,
    PERMISSIONS.HR_LEAVE_MANAGE,
    PERMISSIONS.HR_TRAINING,
    // Reports
    PERMISSIONS.REPORTS_VIEW,
    // Users
    PERMISSIONS.USERS_READ,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  HOUSEKEEPING_MANAGER: [
    // Housekeeping
    PERMISSIONS.HOUSEKEEPING_READ,
    PERMISSIONS.HOUSEKEEPING_WRITE,
    PERMISSIONS.HOUSEKEEPING_ASSIGN,
    // IPD
    PERMISSIONS.IPD_BEDS_MANAGE,
    // Reports
    PERMISSIONS.REPORTS_VIEW,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  HOUSEKEEPING_STAFF: [
    // Housekeeping
    PERMISSIONS.HOUSEKEEPING_READ,
    PERMISSIONS.HOUSEKEEPING_WRITE,
    // IPD
    PERMISSIONS.IPD_ADMISSIONS_READ,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  MAINTENANCE_STAFF: [
    // Assets
    PERMISSIONS.ASSETS_READ,
    PERMISSIONS.ASSETS_WRITE,
    PERMISSIONS.ASSETS_MAINTENANCE,
    // Housekeeping
    PERMISSIONS.HOUSEKEEPING_READ,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  SECURITY_STAFF: [
    // Patients
    PERMISSIONS.PATIENTS_READ,
    // Emergency
    PERMISSIONS.EMERGENCY_READ,
    // Mortuary
    PERMISSIONS.MORTUARY_READ,
    // Ambulance
    PERMISSIONS.AMBULANCE_READ,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],

  DIETARY_STAFF: [
    // Patients
    PERMISSIONS.PATIENTS_READ,
    // Dietary
    PERMISSIONS.DIETARY_READ,
    PERMISSIONS.DIETARY_WRITE,
    PERMISSIONS.DIETARY_MEAL_PLANS,
    // IPD
    PERMISSIONS.IPD_ADMISSIONS_READ,
    // Notifications
    PERMISSIONS.NOTIFICATIONS_READ,
  ],
};

// ==================== PERMISSION CATEGORIES FOR UI ====================

/**
 * Permission categories for grouping in UI settings pages.
 */
export const PERMISSION_CATEGORIES: Record<string, { permissions: Permission[]; description: string }> = {
  'Patient Management': {
    permissions: [
      PERMISSIONS.PATIENTS_READ,
      PERMISSIONS.PATIENTS_WRITE,
      PERMISSIONS.PATIENTS_DELETE,
      PERMISSIONS.PATIENTS_MEDICAL_HISTORY,
    ],
    description: 'Manage patient records and medical history',
  },
  'Appointments': {
    permissions: [
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.APPOINTMENTS_WRITE,
      PERMISSIONS.APPOINTMENTS_DELETE,
      PERMISSIONS.APPOINTMENTS_RESCHEDULE,
    ],
    description: 'Schedule and manage appointments',
  },
  'Doctors': {
    permissions: [
      PERMISSIONS.DOCTORS_READ,
      PERMISSIONS.DOCTORS_WRITE,
      PERMISSIONS.DOCTORS_DELETE,
      PERMISSIONS.DOCTORS_SCHEDULE,
    ],
    description: 'Manage doctor profiles and schedules',
  },
  'Departments': {
    permissions: [
      PERMISSIONS.DEPARTMENTS_READ,
      PERMISSIONS.DEPARTMENTS_WRITE,
      PERMISSIONS.DEPARTMENTS_DELETE,
    ],
    description: 'Configure hospital departments',
  },
  'Laboratory': {
    permissions: [
      PERMISSIONS.LAB_ORDERS_READ,
      PERMISSIONS.LAB_ORDERS_WRITE,
      PERMISSIONS.LAB_ORDERS_DELETE,
      PERMISSIONS.LAB_RESULTS_WRITE,
      PERMISSIONS.LAB_RESULTS_VERIFY,
      PERMISSIONS.LAB_TESTS_MANAGE,
    ],
    description: 'Manage laboratory orders and results',
  },
  'Radiology': {
    permissions: [
      PERMISSIONS.RADIOLOGY_ORDERS_READ,
      PERMISSIONS.RADIOLOGY_ORDERS_WRITE,
      PERMISSIONS.RADIOLOGY_RESULTS_WRITE,
      PERMISSIONS.RADIOLOGY_RESULTS_VERIFY,
    ],
    description: 'Manage imaging orders and reports',
  },
  'Pharmacy': {
    permissions: [
      PERMISSIONS.PHARMACY_READ,
      PERMISSIONS.PHARMACY_DISPENSE,
      PERMISSIONS.PHARMACY_INVENTORY,
      PERMISSIONS.PHARMACY_DRUGS_MANAGE,
      PERMISSIONS.PHARMACY_PRESCRIPTIONS,
    ],
    description: 'Dispense medications and manage inventory',
  },
  'Billing': {
    permissions: [
      PERMISSIONS.BILLING_READ,
      PERMISSIONS.BILLING_WRITE,
      PERMISSIONS.BILLING_DELETE,
      PERMISSIONS.BILLING_REFUND,
      PERMISSIONS.BILLING_DISCOUNTS,
      PERMISSIONS.BILLING_REPORTS,
    ],
    description: 'Handle billing and payments',
  },
  'Human Resources': {
    permissions: [
      PERMISSIONS.HR_EMPLOYEES_READ,
      PERMISSIONS.HR_EMPLOYEES_WRITE,
      PERMISSIONS.HR_EMPLOYEES_DELETE,
      PERMISSIONS.HR_PAYROLL,
      PERMISSIONS.HR_ATTENDANCE,
      PERMISSIONS.HR_LEAVE_MANAGE,
      PERMISSIONS.HR_LEAVE_APPROVE,
      PERMISSIONS.HR_PERFORMANCE,
      PERMISSIONS.HR_TRAINING,
    ],
    description: 'Manage staff and HR operations',
  },
  'In-Patient Department': {
    permissions: [
      PERMISSIONS.IPD_ADMISSIONS_READ,
      PERMISSIONS.IPD_ADMISSIONS_WRITE,
      PERMISSIONS.IPD_DISCHARGE,
      PERMISSIONS.IPD_BEDS_MANAGE,
      PERMISSIONS.IPD_ROUNDS,
      PERMISSIONS.IPD_NURSING_NOTES,
    ],
    description: 'Manage admissions and in-patient care',
  },
  'Out-Patient Department': {
    permissions: [
      PERMISSIONS.OPD_VISITS_READ,
      PERMISSIONS.OPD_VISITS_WRITE,
      PERMISSIONS.OPD_CONSULTATIONS,
      PERMISSIONS.OPD_PRESCRIPTIONS,
    ],
    description: 'Handle OPD visits and consultations',
  },
  'Emergency': {
    permissions: [
      PERMISSIONS.EMERGENCY_READ,
      PERMISSIONS.EMERGENCY_WRITE,
      PERMISSIONS.EMERGENCY_TRIAGE,
      PERMISSIONS.EMERGENCY_CRITICAL,
    ],
    description: 'Manage emergency cases',
  },
  'Surgery': {
    permissions: [
      PERMISSIONS.SURGERY_READ,
      PERMISSIONS.SURGERY_WRITE,
      PERMISSIONS.SURGERY_SCHEDULE,
      PERMISSIONS.SURGERY_NOTES,
      PERMISSIONS.SURGERY_OT_MANAGE,
    ],
    description: 'Schedule and manage surgeries',
  },
  'Blood Bank': {
    permissions: [
      PERMISSIONS.BLOOD_BANK_READ,
      PERMISSIONS.BLOOD_BANK_WRITE,
      PERMISSIONS.BLOOD_BANK_DONATIONS,
      PERMISSIONS.BLOOD_BANK_REQUESTS,
      PERMISSIONS.BLOOD_BANK_INVENTORY,
    ],
    description: 'Manage blood donations and inventory',
  },
  'Medical Records': {
    permissions: [
      PERMISSIONS.MEDICAL_RECORDS_READ,
      PERMISSIONS.MEDICAL_RECORDS_WRITE,
      PERMISSIONS.MEDICAL_RECORDS_DELETE,
      PERMISSIONS.MEDICAL_RECORDS_EXPORT,
    ],
    description: 'Access and manage medical records',
  },
  'Telemedicine': {
    permissions: [
      PERMISSIONS.TELEMEDICINE_READ,
      PERMISSIONS.TELEMEDICINE_WRITE,
      PERMISSIONS.TELEMEDICINE_HOST,
    ],
    description: 'Conduct and manage video consultations',
  },
  'Queue Management': {
    permissions: [
      PERMISSIONS.QUEUE_READ,
      PERMISSIONS.QUEUE_WRITE,
      PERMISSIONS.QUEUE_MANAGE,
    ],
    description: 'Manage patient queues',
  },
  'Dietary': {
    permissions: [
      PERMISSIONS.DIETARY_READ,
      PERMISSIONS.DIETARY_WRITE,
      PERMISSIONS.DIETARY_MEAL_PLANS,
    ],
    description: 'Manage patient meal plans',
  },
  'Housekeeping': {
    permissions: [
      PERMISSIONS.HOUSEKEEPING_READ,
      PERMISSIONS.HOUSEKEEPING_WRITE,
      PERMISSIONS.HOUSEKEEPING_ASSIGN,
    ],
    description: 'Coordinate housekeeping tasks',
  },
  'Assets': {
    permissions: [
      PERMISSIONS.ASSETS_READ,
      PERMISSIONS.ASSETS_WRITE,
      PERMISSIONS.ASSETS_MAINTENANCE,
    ],
    description: 'Track and maintain hospital assets',
  },
  'Ambulance': {
    permissions: [
      PERMISSIONS.AMBULANCE_READ,
      PERMISSIONS.AMBULANCE_WRITE,
      PERMISSIONS.AMBULANCE_DISPATCH,
    ],
    description: 'Manage ambulance services',
  },
  'CSSD': {
    permissions: [
      PERMISSIONS.CSSD_READ,
      PERMISSIONS.CSSD_WRITE,
      PERMISSIONS.CSSD_STERILIZATION,
    ],
    description: 'Manage sterilization and supplies',
  },
  'Mortuary': {
    permissions: [
      PERMISSIONS.MORTUARY_READ,
      PERMISSIONS.MORTUARY_WRITE,
      PERMISSIONS.MORTUARY_RELEASE,
    ],
    description: 'Manage mortuary operations',
  },
  'Quality': {
    permissions: [
      PERMISSIONS.QUALITY_READ,
      PERMISSIONS.QUALITY_WRITE,
      PERMISSIONS.QUALITY_INCIDENTS,
      PERMISSIONS.QUALITY_AUDITS,
    ],
    description: 'Handle quality assurance and audits',
  },
  'Reports': {
    permissions: [
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.REPORTS_FINANCIAL,
      PERMISSIONS.REPORTS_CLINICAL,
      PERMISSIONS.REPORTS_ANALYTICS,
    ],
    description: 'View and export reports',
  },
  'AI Services': {
    permissions: [
      PERMISSIONS.AI_DIAGNOSTIC,
      PERMISSIONS.AI_PREDICTIVE,
      PERMISSIONS.AI_IMAGING,
      PERMISSIONS.AI_SCRIBE,
      PERMISSIONS.AI_SYMPTOM_CHECKER,
      PERMISSIONS.AI_EARLY_WARNING,
      PERMISSIONS.AI_MED_SAFETY,
      PERMISSIONS.AI_SMART_ORDERS,
    ],
    description: 'Access AI-powered clinical tools',
  },
  'Settings': {
    permissions: [
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_WRITE,
      PERMISSIONS.SETTINGS_HOSPITAL,
    ],
    description: 'Configure system settings',
  },
  'User Management': {
    permissions: [
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_WRITE,
      PERMISSIONS.USERS_DELETE,
    ],
    description: 'Manage user accounts',
  },
  'RBAC Management': {
    permissions: [
      PERMISSIONS.RBAC_MANAGE,
      PERMISSIONS.RBAC_ROLES_READ,
      PERMISSIONS.RBAC_ROLES_WRITE,
      PERMISSIONS.RBAC_ASSIGN,
      PERMISSIONS.RBAC_AUDIT,
    ],
    description: 'Manage roles and permissions',
  },
  'Notifications': {
    permissions: [
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.NOTIFICATIONS_MANAGE,
    ],
    description: 'Manage notifications',
  },
  'Patient Portal': {
    permissions: [
      PERMISSIONS.PATIENT_PORTAL_ACCESS,
      PERMISSIONS.PATIENT_PORTAL_APPOINTMENTS,
      PERMISSIONS.PATIENT_PORTAL_RECORDS,
      PERMISSIONS.PATIENT_PORTAL_BILLING,
    ],
    description: 'Patient self-service portal access',
  },
};

// ==================== PERMISSION DESCRIPTIONS ====================

/**
 * Human-readable descriptions for each permission.
 */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  [PERMISSIONS.PATIENTS_READ]: 'View patient records',
  [PERMISSIONS.PATIENTS_WRITE]: 'Create and edit patient records',
  [PERMISSIONS.PATIENTS_DELETE]: 'Delete patient records',
  [PERMISSIONS.PATIENTS_MEDICAL_HISTORY]: 'Access full medical history',

  [PERMISSIONS.APPOINTMENTS_READ]: 'View appointments',
  [PERMISSIONS.APPOINTMENTS_WRITE]: 'Create and edit appointments',
  [PERMISSIONS.APPOINTMENTS_DELETE]: 'Cancel appointments',
  [PERMISSIONS.APPOINTMENTS_RESCHEDULE]: 'Reschedule appointments',

  [PERMISSIONS.DOCTORS_READ]: 'View doctor profiles',
  [PERMISSIONS.DOCTORS_WRITE]: 'Create and edit doctor profiles',
  [PERMISSIONS.DOCTORS_DELETE]: 'Remove doctors',
  [PERMISSIONS.DOCTORS_SCHEDULE]: 'Manage doctor schedules',

  [PERMISSIONS.DEPARTMENTS_READ]: 'View departments',
  [PERMISSIONS.DEPARTMENTS_WRITE]: 'Create and edit departments',
  [PERMISSIONS.DEPARTMENTS_DELETE]: 'Delete departments',

  [PERMISSIONS.LAB_ORDERS_READ]: 'View lab orders',
  [PERMISSIONS.LAB_ORDERS_WRITE]: 'Create lab orders',
  [PERMISSIONS.LAB_ORDERS_DELETE]: 'Cancel lab orders',
  [PERMISSIONS.LAB_RESULTS_WRITE]: 'Enter lab results',
  [PERMISSIONS.LAB_RESULTS_VERIFY]: 'Verify and approve lab results',
  [PERMISSIONS.LAB_TESTS_MANAGE]: 'Manage available lab tests',

  [PERMISSIONS.RADIOLOGY_ORDERS_READ]: 'View imaging orders',
  [PERMISSIONS.RADIOLOGY_ORDERS_WRITE]: 'Create imaging orders',
  [PERMISSIONS.RADIOLOGY_RESULTS_WRITE]: 'Enter radiology reports',
  [PERMISSIONS.RADIOLOGY_RESULTS_VERIFY]: 'Verify radiology reports',

  [PERMISSIONS.PHARMACY_READ]: 'View pharmacy information',
  [PERMISSIONS.PHARMACY_DISPENSE]: 'Dispense medications',
  [PERMISSIONS.PHARMACY_INVENTORY]: 'Manage pharmacy inventory',
  [PERMISSIONS.PHARMACY_DRUGS_MANAGE]: 'Manage drug catalog',
  [PERMISSIONS.PHARMACY_PRESCRIPTIONS]: 'View and process prescriptions',

  [PERMISSIONS.BILLING_READ]: 'View bills and invoices',
  [PERMISSIONS.BILLING_WRITE]: 'Create and edit bills',
  [PERMISSIONS.BILLING_DELETE]: 'Void bills',
  [PERMISSIONS.BILLING_REFUND]: 'Process refunds',
  [PERMISSIONS.BILLING_DISCOUNTS]: 'Apply discounts',
  [PERMISSIONS.BILLING_REPORTS]: 'Access financial reports',

  [PERMISSIONS.HR_EMPLOYEES_READ]: 'View employee records',
  [PERMISSIONS.HR_EMPLOYEES_WRITE]: 'Create and edit employee records',
  [PERMISSIONS.HR_EMPLOYEES_DELETE]: 'Terminate employees',
  [PERMISSIONS.HR_PAYROLL]: 'Manage payroll',
  [PERMISSIONS.HR_ATTENDANCE]: 'Manage attendance',
  [PERMISSIONS.HR_LEAVE_MANAGE]: 'Manage leave requests',
  [PERMISSIONS.HR_LEAVE_APPROVE]: 'Approve or reject leave',
  [PERMISSIONS.HR_PERFORMANCE]: 'Manage performance reviews',
  [PERMISSIONS.HR_TRAINING]: 'Manage training programs',

  [PERMISSIONS.IPD_ADMISSIONS_READ]: 'View admissions',
  [PERMISSIONS.IPD_ADMISSIONS_WRITE]: 'Create admissions',
  [PERMISSIONS.IPD_DISCHARGE]: 'Process discharges',
  [PERMISSIONS.IPD_BEDS_MANAGE]: 'Manage bed allocation',
  [PERMISSIONS.IPD_ROUNDS]: 'Conduct ward rounds',
  [PERMISSIONS.IPD_NURSING_NOTES]: 'Add nursing notes',

  [PERMISSIONS.OPD_VISITS_READ]: 'View OPD visits',
  [PERMISSIONS.OPD_VISITS_WRITE]: 'Record OPD visits',
  [PERMISSIONS.OPD_CONSULTATIONS]: 'Conduct consultations',
  [PERMISSIONS.OPD_PRESCRIPTIONS]: 'Write prescriptions',

  [PERMISSIONS.EMERGENCY_READ]: 'View emergency cases',
  [PERMISSIONS.EMERGENCY_WRITE]: 'Register emergency cases',
  [PERMISSIONS.EMERGENCY_TRIAGE]: 'Perform triage',
  [PERMISSIONS.EMERGENCY_CRITICAL]: 'Handle critical cases',

  [PERMISSIONS.SURGERY_READ]: 'View surgery schedules',
  [PERMISSIONS.SURGERY_WRITE]: 'Record surgeries',
  [PERMISSIONS.SURGERY_SCHEDULE]: 'Schedule surgeries',
  [PERMISSIONS.SURGERY_NOTES]: 'Write operative notes',
  [PERMISSIONS.SURGERY_OT_MANAGE]: 'Manage operation theaters',

  [PERMISSIONS.BLOOD_BANK_READ]: 'View blood bank inventory',
  [PERMISSIONS.BLOOD_BANK_WRITE]: 'Update blood bank records',
  [PERMISSIONS.BLOOD_BANK_DONATIONS]: 'Record donations',
  [PERMISSIONS.BLOOD_BANK_REQUESTS]: 'Process blood requests',
  [PERMISSIONS.BLOOD_BANK_INVENTORY]: 'Manage blood inventory',

  [PERMISSIONS.MEDICAL_RECORDS_READ]: 'View medical records',
  [PERMISSIONS.MEDICAL_RECORDS_WRITE]: 'Update medical records',
  [PERMISSIONS.MEDICAL_RECORDS_DELETE]: 'Delete medical records',
  [PERMISSIONS.MEDICAL_RECORDS_EXPORT]: 'Export medical records',

  [PERMISSIONS.TELEMEDICINE_READ]: 'View telemedicine sessions',
  [PERMISSIONS.TELEMEDICINE_WRITE]: 'Schedule telemedicine sessions',
  [PERMISSIONS.TELEMEDICINE_HOST]: 'Host video consultations',

  [PERMISSIONS.QUEUE_READ]: 'View patient queues',
  [PERMISSIONS.QUEUE_WRITE]: 'Update queue status',
  [PERMISSIONS.QUEUE_MANAGE]: 'Manage queue settings',

  [PERMISSIONS.DIETARY_READ]: 'View dietary information',
  [PERMISSIONS.DIETARY_WRITE]: 'Update dietary records',
  [PERMISSIONS.DIETARY_MEAL_PLANS]: 'Create meal plans',

  [PERMISSIONS.HOUSEKEEPING_READ]: 'View housekeeping tasks',
  [PERMISSIONS.HOUSEKEEPING_WRITE]: 'Update task status',
  [PERMISSIONS.HOUSEKEEPING_ASSIGN]: 'Assign housekeeping tasks',

  [PERMISSIONS.ASSETS_READ]: 'View assets',
  [PERMISSIONS.ASSETS_WRITE]: 'Manage assets',
  [PERMISSIONS.ASSETS_MAINTENANCE]: 'Schedule maintenance',

  [PERMISSIONS.AMBULANCE_READ]: 'View ambulance status',
  [PERMISSIONS.AMBULANCE_WRITE]: 'Update ambulance records',
  [PERMISSIONS.AMBULANCE_DISPATCH]: 'Dispatch ambulances',

  [PERMISSIONS.CSSD_READ]: 'View CSSD records',
  [PERMISSIONS.CSSD_WRITE]: 'Update CSSD records',
  [PERMISSIONS.CSSD_STERILIZATION]: 'Process sterilization',

  [PERMISSIONS.MORTUARY_READ]: 'View mortuary records',
  [PERMISSIONS.MORTUARY_WRITE]: 'Update mortuary records',
  [PERMISSIONS.MORTUARY_RELEASE]: 'Authorize body release',

  [PERMISSIONS.QUALITY_READ]: 'View quality reports',
  [PERMISSIONS.QUALITY_WRITE]: 'Update quality metrics',
  [PERMISSIONS.QUALITY_INCIDENTS]: 'Report incidents',
  [PERMISSIONS.QUALITY_AUDITS]: 'Conduct audits',

  [PERMISSIONS.REPORTS_VIEW]: 'View reports',
  [PERMISSIONS.REPORTS_EXPORT]: 'Export reports',
  [PERMISSIONS.REPORTS_FINANCIAL]: 'Access financial reports',
  [PERMISSIONS.REPORTS_CLINICAL]: 'Access clinical reports',
  [PERMISSIONS.REPORTS_ANALYTICS]: 'Access analytics dashboard',

  [PERMISSIONS.AI_DIAGNOSTIC]: 'Use AI diagnostic tools',
  [PERMISSIONS.AI_PREDICTIVE]: 'Use predictive analytics',
  [PERMISSIONS.AI_IMAGING]: 'Use AI imaging analysis',
  [PERMISSIONS.AI_SCRIBE]: 'Use AI medical scribe',
  [PERMISSIONS.AI_SYMPTOM_CHECKER]: 'Use symptom checker',
  [PERMISSIONS.AI_EARLY_WARNING]: 'View early warning scores',
  [PERMISSIONS.AI_MED_SAFETY]: 'Use medication safety checks',
  [PERMISSIONS.AI_SMART_ORDERS]: 'Use smart order recommendations',

  [PERMISSIONS.SETTINGS_READ]: 'View settings',
  [PERMISSIONS.SETTINGS_WRITE]: 'Modify settings',
  [PERMISSIONS.SETTINGS_HOSPITAL]: 'Configure hospital settings',

  [PERMISSIONS.USERS_READ]: 'View users',
  [PERMISSIONS.USERS_WRITE]: 'Create and edit users',
  [PERMISSIONS.USERS_DELETE]: 'Delete users',

  [PERMISSIONS.RBAC_MANAGE]: 'Full RBAC management access',
  [PERMISSIONS.RBAC_ROLES_READ]: 'View roles',
  [PERMISSIONS.RBAC_ROLES_WRITE]: 'Create and edit roles',
  [PERMISSIONS.RBAC_ASSIGN]: 'Assign roles to users',
  [PERMISSIONS.RBAC_AUDIT]: 'View RBAC audit logs',

  [PERMISSIONS.NOTIFICATIONS_READ]: 'View notifications',
  [PERMISSIONS.NOTIFICATIONS_MANAGE]: 'Manage notification settings',

  [PERMISSIONS.PATIENT_PORTAL_ACCESS]: 'Access patient portal',
  [PERMISSIONS.PATIENT_PORTAL_APPOINTMENTS]: 'Book appointments via portal',
  [PERMISSIONS.PATIENT_PORTAL_RECORDS]: 'View own medical records',
  [PERMISSIONS.PATIENT_PORTAL_BILLING]: 'View and pay bills online',
};

// ==================== INTERFACES ====================

interface CreateRoleData {
  name: string;
  description?: string;
  permissions: string[];
  createdBy: string;
}

interface UpdateRoleData {
  name?: string;
  description?: string;
  permissions?: string[];
  isActive?: boolean;
}

interface GetRolesParams {
  includeSystem?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

interface GetAuditLogsParams {
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

interface PermissionInfo {
  permission: string;
  category: string;
  description: string;
}

// ==================== CUSTOM ROLE INTERFACE (for JSON storage) ====================

interface CustomRole {
  id: string;
  hospitalId: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserCustomRole {
  id: string;
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
}

interface RbacAuditLog {
  id: string;
  hospitalId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  performedBy: string;
  performedAt: Date;
}

// ==================== RBAC SERVICE CLASS ====================

/**
 * Role-Based Access Control Service
 *
 * Handles:
 * - Custom role management
 * - User role assignment
 * - Permission checking (combining base role, custom roles, and direct permissions)
 * - Direct permission grants/revocations
 * - RBAC audit logging
 *
 * Note: This service stores custom roles in the hospital's settings JSON field
 * and user custom role assignments in a separate table pattern using UserPermission.
 * For production use, consider adding dedicated tables: CustomRole, UserCustomRole, RbacAuditLog
 */
export class RBACService {
  // ==================== ROLE MANAGEMENT ====================

  /**
   * Create a custom role for a hospital.
   * Custom roles are stored in the hospital settings JSON field.
   */
  async createRole(hospitalId: string, data: CreateRoleData): Promise<CustomRole> {
    // Validate permissions
    const validPermissions = Object.values(PERMISSIONS) as string[];
    const invalidPermissions = data.permissions.filter(p => !validPermissions.includes(p));

    if (invalidPermissions.length > 0) {
      throw new AppError(`Invalid permissions: ${invalidPermissions.join(', ')}`, 400);
    }

    // Get hospital and current settings
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    const settings = (hospital.settings as any) || {};
    const customRoles: CustomRole[] = settings.customRoles || [];

    // Check for duplicate role name
    if (customRoles.some(r => r.name.toLowerCase() === data.name.toLowerCase() && r.isActive)) {
      throw new ConflictError(`Role "${data.name}" already exists`);
    }

    // Create new role
    const newRole: CustomRole = {
      id: this.generateId(),
      hospitalId,
      name: data.name,
      description: data.description,
      permissions: data.permissions,
      isSystem: false,
      isActive: true,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    customRoles.push(newRole);

    // Update hospital settings
    await prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        settings: {
          ...settings,
          customRoles,
        },
      },
    });

    // Log action
    await this.logAction(hospitalId, 'CREATE_ROLE', 'role', newRole.id, {
      roleName: newRole.name,
      permissions: newRole.permissions,
    }, data.createdBy);

    return newRole;
  }

  /**
   * Get all roles for a hospital (including system roles based on UserRole enum).
   */
  async getRoles(hospitalId: string, params: GetRolesParams = {}): Promise<{
    roles: Array<CustomRole | { id: string; name: string; description: string; permissions: string[]; isSystem: boolean; isActive: boolean }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { includeSystem = true, page = 1, limit = 50, search } = params;

    // Get hospital settings for custom roles
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    const settings = (hospital.settings as any) || {};
    let customRoles: CustomRole[] = settings.customRoles || [];

    // Build system roles from UserRole enum
    let systemRoles: Array<{ id: string; name: string; description: string; permissions: string[]; isSystem: boolean; isActive: boolean }> = [];

    if (includeSystem) {
      systemRoles = Object.values(UserRole).map(role => ({
        id: `system_${role}`,
        name: this.formatRoleName(role),
        description: `System role: ${this.formatRoleName(role)}`,
        permissions: DEFAULT_ROLE_PERMISSIONS[role] || [],
        isSystem: true,
        isActive: true,
      }));
    }

    // Combine and filter
    let allRoles = [...systemRoles, ...customRoles.filter(r => r.isActive)];

    if (search) {
      const searchLower = search.toLowerCase();
      allRoles = allRoles.filter(r =>
        r.name.toLowerCase().includes(searchLower) ||
        (r.description && r.description.toLowerCase().includes(searchLower))
      );
    }

    // Paginate
    const total = allRoles.length;
    const startIndex = (page - 1) * limit;
    const paginatedRoles = allRoles.slice(startIndex, startIndex + limit);

    return {
      roles: paginatedRoles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a specific role by ID.
   */
  async getRoleById(hospitalId: string, roleId: string): Promise<CustomRole | { id: string; name: string; description: string; permissions: string[]; isSystem: boolean; isActive: boolean }> {
    // Check if it's a system role
    if (roleId.startsWith('system_')) {
      const roleName = roleId.replace('system_', '') as UserRole;
      if (!Object.values(UserRole).includes(roleName)) {
        throw new NotFoundError('Role not found');
      }

      return {
        id: roleId,
        name: this.formatRoleName(roleName),
        description: `System role: ${this.formatRoleName(roleName)}`,
        permissions: DEFAULT_ROLE_PERMISSIONS[roleName] || [],
        isSystem: true,
        isActive: true,
      };
    }

    // Get custom role
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    const settings = (hospital.settings as any) || {};
    const customRoles: CustomRole[] = settings.customRoles || [];
    const role = customRoles.find(r => r.id === roleId);

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    return role;
  }

  /**
   * Update a custom role.
   * System roles cannot be modified.
   */
  async updateRole(hospitalId: string, roleId: string, data: UpdateRoleData, updatedBy: string): Promise<CustomRole> {
    // System roles cannot be modified
    if (roleId.startsWith('system_')) {
      throw new AppError('System roles cannot be modified', 400);
    }

    // Validate permissions if provided
    if (data.permissions) {
      const validPermissions = Object.values(PERMISSIONS) as string[];
      const invalidPermissions = data.permissions.filter(p => !validPermissions.includes(p));

      if (invalidPermissions.length > 0) {
        throw new AppError(`Invalid permissions: ${invalidPermissions.join(', ')}`, 400);
      }
    }

    // Get hospital and settings
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    const settings = (hospital.settings as any) || {};
    const customRoles: CustomRole[] = settings.customRoles || [];
    const roleIndex = customRoles.findIndex(r => r.id === roleId);

    if (roleIndex === -1) {
      throw new NotFoundError('Role not found');
    }

    const oldRole = { ...customRoles[roleIndex] };

    // Check for duplicate name
    if (data.name && data.name !== oldRole.name) {
      if (customRoles.some(r => r.name.toLowerCase() === data.name.toLowerCase() && r.id !== roleId && r.isActive)) {
        throw new ConflictError(`Role "${data.name}" already exists`);
      }
    }

    // Update role
    customRoles[roleIndex] = {
      ...customRoles[roleIndex],
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.permissions !== undefined && { permissions: data.permissions }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: new Date(),
    };

    // Save to database
    await prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        settings: {
          ...settings,
          customRoles,
        },
      },
    });

    // Log action
    await this.logAction(hospitalId, 'UPDATE_ROLE', 'role', roleId, {
      oldValues: oldRole,
      newValues: customRoles[roleIndex],
    }, updatedBy);

    return customRoles[roleIndex];
  }

  /**
   * Delete (deactivate) a custom role.
   */
  async deleteRole(hospitalId: string, roleId: string, deletedBy: string): Promise<void> {
    // System roles cannot be deleted
    if (roleId.startsWith('system_')) {
      throw new AppError('System roles cannot be deleted', 400);
    }

    // Get hospital and settings
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    const settings = (hospital.settings as any) || {};
    const customRoles: CustomRole[] = settings.customRoles || [];
    const roleIndex = customRoles.findIndex(r => r.id === roleId);

    if (roleIndex === -1) {
      throw new NotFoundError('Role not found');
    }

    const roleName = customRoles[roleIndex].name;

    // Soft delete - set isActive to false
    customRoles[roleIndex].isActive = false;
    customRoles[roleIndex].updatedAt = new Date();

    // Save to database
    await prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        settings: {
          ...settings,
          customRoles,
        },
      },
    });

    // Remove role from all users
    await this.removeRoleFromAllUsers(hospitalId, roleId, deletedBy);

    // Log action
    await this.logAction(hospitalId, 'DELETE_ROLE', 'role', roleId, {
      roleName,
    }, deletedBy);
  }

  // ==================== USER ROLE ASSIGNMENT ====================

  /**
   * Assign a custom role to a user.
   * Uses UserPermission table with a special prefix for role assignments.
   */
  async assignRoleToUser(userId: string, roleId: string, assignedBy: string): Promise<void> {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { hospital: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify role exists (skip for system roles)
    if (!roleId.startsWith('system_')) {
      await this.getRoleById(user.hospitalId, roleId);
    }

    // Check if already assigned
    const existingAssignment = await prisma.userPermission.findFirst({
      where: {
        userId,
        permission: `role:${roleId}`,
      },
    });

    if (existingAssignment) {
      throw new ConflictError('Role already assigned to user');
    }

    // Create assignment
    await prisma.userPermission.create({
      data: {
        userId,
        permission: `role:${roleId}`,
      },
    });

    // Log action
    await this.logAction(user.hospitalId, 'ASSIGN_ROLE', 'user_role', userId, {
      roleId,
      userId,
    }, assignedBy);
  }

  /**
   * Remove a custom role from a user.
   */
  async removeRoleFromUser(userId: string, roleId: string, removedBy: string): Promise<void> {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Delete assignment
    const result = await prisma.userPermission.deleteMany({
      where: {
        userId,
        permission: `role:${roleId}`,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError('Role assignment not found');
    }

    // Log action
    await this.logAction(user.hospitalId, 'REMOVE_ROLE', 'user_role', userId, {
      roleId,
      userId,
    }, removedBy);
  }

  /**
   * Remove a role from all users (used when deleting a role).
   */
  private async removeRoleFromAllUsers(hospitalId: string, roleId: string, removedBy: string): Promise<void> {
    // Get all users with this role
    const usersWithRole = await prisma.userPermission.findMany({
      where: {
        permission: `role:${roleId}`,
        user: { hospitalId },
      },
      include: { user: true },
    });

    // Delete all assignments
    await prisma.userPermission.deleteMany({
      where: {
        permission: `role:${roleId}`,
        user: { hospitalId },
      },
    });

    // Log for each user
    for (const assignment of usersWithRole) {
      await this.logAction(hospitalId, 'REMOVE_ROLE', 'user_role', assignment.userId, {
        roleId,
        reason: 'Role deleted',
      }, removedBy);
    }
  }

  /**
   * Get all custom roles assigned to a user.
   */
  async getUserRoles(userId: string): Promise<Array<CustomRole | { id: string; name: string; permissions: string[]; isSystem: boolean }>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get role assignments from permissions
    const roleAssignments = user.permissions.filter(p => p.permission.startsWith('role:'));
    const roleIds = roleAssignments.map(p => p.permission.replace('role:', ''));

    const roles: Array<CustomRole | { id: string; name: string; permissions: string[]; isSystem: boolean }> = [];

    // Get each role
    for (const roleId of roleIds) {
      try {
        const role = await this.getRoleById(user.hospitalId, roleId);
        roles.push(role);
      } catch (error) {
        // Role may have been deleted, skip it
        continue;
      }
    }

    return roles;
  }

  /**
   * Get all users who have a specific role assigned.
   */
  async getUsersByRole(hospitalId: string, roleId: string): Promise<Array<{ id: string; email: string; firstName: string; lastName: string; role: UserRole }>> {
    // For system roles, get users with that base role
    if (roleId.startsWith('system_')) {
      const baseRole = roleId.replace('system_', '') as UserRole;

      const users = await prisma.user.findMany({
        where: {
          hospitalId,
          role: baseRole,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      return users;
    }

    // For custom roles, find users with the role permission
    const permissions = await prisma.userPermission.findMany({
      where: {
        permission: `role:${roleId}`,
        user: {
          hospitalId,
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return permissions.map(p => p.user);
  }

  // ==================== PERMISSION CHECKING ====================

  /**
   * Check if a user has a specific permission.
   * Combines base role permissions, custom role permissions, and direct permissions.
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return userPermissions.includes(permission);
  }

  /**
   * Check if a user has ANY of the given permissions.
   */
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some(p => userPermissions.includes(p));
  }

  /**
   * Check if a user has ALL of the given permissions.
   */
  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every(p => userPermissions.includes(p));
  }

  /**
   * Get all permissions for a user.
   * Combines:
   * 1. Base role permissions (from UserRole enum)
   * 2. Custom role permissions (from assigned custom roles)
   * 3. Direct permissions (granted directly to user)
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: true,
        hospital: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const allPermissions = new Set<string>();

    // 1. Add base role permissions
    const basePermissions = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
    basePermissions.forEach(p => allPermissions.add(p));

    // 2. Add custom role permissions
    const roleAssignments = user.permissions.filter(p => p.permission.startsWith('role:'));
    for (const assignment of roleAssignments) {
      const roleId = assignment.permission.replace('role:', '');
      try {
        const role = await this.getRoleById(user.hospitalId, roleId);
        role.permissions.forEach(p => allPermissions.add(p));
      } catch (error) {
        // Role may have been deleted, skip
        continue;
      }
    }

    // 3. Add direct permissions (those that don't start with 'role:')
    const directPermissions = user.permissions.filter(p => !p.permission.startsWith('role:'));
    directPermissions.forEach(p => allPermissions.add(p.permission));

    return Array.from(allPermissions);
  }

  /**
   * Get permissions breakdown for a user (showing source of each permission).
   */
  async getUserPermissionsBreakdown(userId: string): Promise<{
    baseRole: { role: UserRole; permissions: string[] };
    customRoles: Array<{ roleId: string; roleName: string; permissions: string[] }>;
    directPermissions: string[];
    effectivePermissions: string[];
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: true,
        hospital: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const basePermissions = DEFAULT_ROLE_PERMISSIONS[user.role] || [];

    const customRoles: Array<{ roleId: string; roleName: string; permissions: string[] }> = [];
    const roleAssignments = user.permissions.filter(p => p.permission.startsWith('role:'));

    for (const assignment of roleAssignments) {
      const roleId = assignment.permission.replace('role:', '');
      try {
        const role = await this.getRoleById(user.hospitalId, roleId);
        customRoles.push({
          roleId: role.id,
          roleName: role.name,
          permissions: role.permissions,
        });
      } catch (error) {
        continue;
      }
    }

    const directPermissions = user.permissions
      .filter(p => !p.permission.startsWith('role:'))
      .map(p => p.permission);

    const effectivePermissions = await this.getUserPermissions(userId);

    return {
      baseRole: {
        role: user.role,
        permissions: basePermissions,
      },
      customRoles,
      directPermissions,
      effectivePermissions,
    };
  }

  // ==================== DIRECT USER PERMISSIONS ====================

  /**
   * Grant a permission directly to a user.
   */
  async grantPermission(userId: string, permission: string, grantedBy: string): Promise<void> {
    // Validate permission
    const validPermissions = Object.values(PERMISSIONS) as string[];
    if (!validPermissions.includes(permission)) {
      throw new AppError(`Invalid permission: ${permission}`, 400);
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if already granted
    const existing = await prisma.userPermission.findFirst({
      where: {
        userId,
        permission,
      },
    });

    if (existing) {
      throw new ConflictError('Permission already granted to user');
    }

    // Grant permission
    await prisma.userPermission.create({
      data: {
        userId,
        permission,
      },
    });

    // Log action
    await this.logAction(user.hospitalId, 'GRANT_PERMISSION', 'user_permission', userId, {
      permission,
    }, grantedBy);
  }

  /**
   * Revoke a permission from a user.
   */
  async revokePermission(userId: string, permission: string, revokedBy: string): Promise<void> {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Delete permission
    const result = await prisma.userPermission.deleteMany({
      where: {
        userId,
        permission,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError('Permission not found for user');
    }

    // Log action
    await this.logAction(user.hospitalId, 'REVOKE_PERMISSION', 'user_permission', userId, {
      permission,
    }, revokedBy);
  }

  /**
   * Get all direct permissions for a user (excluding role-based permissions).
   */
  async getDirectPermissions(userId: string): Promise<string[]> {
    const permissions = await prisma.userPermission.findMany({
      where: {
        userId,
        NOT: {
          permission: {
            startsWith: 'role:',
          },
        },
      },
    });

    return permissions.map(p => p.permission);
  }

  // ==================== AUDIT ====================

  /**
   * Log an RBAC action for audit purposes.
   * Uses the existing AuditLog table.
   */
  async logAction(
    hospitalId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: any,
    performedBy: string
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        hospitalId,
        userId: performedBy,
        action: `RBAC_${action}`,
        entityType,
        entityId,
        newValues: details,
      },
    });
  }

  /**
   * Get RBAC audit logs for a hospital.
   */
  async getAuditLogs(hospitalId: string, params: GetAuditLogsParams = {}): Promise<{
    logs: Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      details: any;
      performedBy: { id: string; email: string; firstName: string; lastName: string } | null;
      createdAt: Date;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { action, entityType, userId, startDate, endDate, page = 1, limit = 50 } = params;

    const where: Prisma.AuditLogWhereInput = {
      hospitalId,
      action: {
        startsWith: 'RBAC_',
      },
      ...(action && { action: `RBAC_${action}` }),
      ...(entityType && { entityType }),
      ...(userId && { userId }),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs: logs.map(log => ({
        id: log.id,
        action: log.action.replace('RBAC_', ''),
        entityType: log.entityType,
        entityId: log.entityId,
        details: log.newValues,
        performedBy: log.user,
        createdAt: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== UTILITIES ====================

  /**
   * Get all available permissions with their categories and descriptions.
   */
  getAvailablePermissions(): PermissionInfo[] {
    const result: PermissionInfo[] = [];

    for (const [category, data] of Object.entries(PERMISSION_CATEGORIES)) {
      for (const permission of data.permissions) {
        result.push({
          permission,
          category,
          description: PERMISSION_DESCRIPTIONS[permission] || permission,
        });
      }
    }

    return result;
  }

  /**
   * Get permissions grouped by category.
   */
  getPermissionsByCategory(): Record<string, { description: string; permissions: Array<{ permission: string; description: string }> }> {
    const result: Record<string, { description: string; permissions: Array<{ permission: string; description: string }> }> = {};

    for (const [category, data] of Object.entries(PERMISSION_CATEGORIES)) {
      result[category] = {
        description: data.description,
        permissions: data.permissions.map(permission => ({
          permission,
          description: PERMISSION_DESCRIPTIONS[permission] || permission,
        })),
      };
    }

    return result;
  }

  /**
   * Get default permissions for a specific UserRole.
   */
  getDefaultPermissionsForRole(role: UserRole): string[] {
    return DEFAULT_ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Seed default system roles for a hospital.
   * This creates custom roles based on common hospital configurations.
   */
  async seedDefaultRoles(hospitalId: string, createdBy: string): Promise<CustomRole[]> {
    const defaultCustomRoles = [
      {
        name: 'Senior Doctor',
        description: 'Senior doctor with additional administrative permissions',
        permissions: [
          ...DEFAULT_ROLE_PERMISSIONS.DOCTOR,
          PERMISSIONS.LAB_RESULTS_VERIFY,
          PERMISSIONS.RADIOLOGY_RESULTS_VERIFY,
          PERMISSIONS.REPORTS_EXPORT,
        ],
      },
      {
        name: 'Head Nurse',
        description: 'Head nurse with staff management permissions',
        permissions: [
          ...DEFAULT_ROLE_PERMISSIONS.NURSE,
          PERMISSIONS.HR_EMPLOYEES_READ,
          PERMISSIONS.HR_ATTENDANCE,
          PERMISSIONS.HR_LEAVE_MANAGE,
          PERMISSIONS.HOUSEKEEPING_ASSIGN,
        ],
      },
      {
        name: 'Lab Supervisor',
        description: 'Lab supervisor with verification and management permissions',
        permissions: [
          ...DEFAULT_ROLE_PERMISSIONS.LAB_TECHNICIAN,
          PERMISSIONS.LAB_RESULTS_VERIFY,
          PERMISSIONS.REPORTS_EXPORT,
          PERMISSIONS.QUALITY_INCIDENTS,
        ],
      },
      {
        name: 'Billing Manager',
        description: 'Billing manager with full financial access',
        permissions: [
          ...DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT,
          PERMISSIONS.BILLING_DELETE,
          PERMISSIONS.REPORTS_ANALYTICS,
          PERMISSIONS.USERS_READ,
        ],
      },
      {
        name: 'Front Desk Supervisor',
        description: 'Front desk supervisor with queue management',
        permissions: [
          ...DEFAULT_ROLE_PERMISSIONS.RECEPTIONIST,
          PERMISSIONS.QUEUE_MANAGE,
          PERMISSIONS.USERS_READ,
          PERMISSIONS.REPORTS_VIEW,
        ],
      },
    ];

    const createdRoles: CustomRole[] = [];

    for (const roleData of defaultCustomRoles) {
      try {
        const role = await this.createRole(hospitalId, {
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions as string[],
          createdBy,
        });
        createdRoles.push(role);
      } catch (error) {
        // Skip if role already exists
        if (error instanceof ConflictError) {
          continue;
        }
        throw error;
      }
    }

    return createdRoles;
  }

  /**
   * Validate a list of permissions.
   */
  validatePermissions(permissions: string[]): { valid: string[]; invalid: string[] } {
    const validPermissions = Object.values(PERMISSIONS) as string[];
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const permission of permissions) {
      if (validPermissions.includes(permission)) {
        valid.push(permission);
      } else {
        invalid.push(permission);
      }
    }

    return { valid, invalid };
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Generate a unique ID for custom roles.
   */
  private generateId(): string {
    return `role_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Format a UserRole enum value to a human-readable name.
   */
  private formatRoleName(role: UserRole): string {
    return role
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}

// ==================== EXPORT SINGLETON ====================

export const rbacService = new RBACService();
