-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED', 'RETIRED', 'DECEASED');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('WEEKLY', 'BI_WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID_PROOF', 'ADDRESS_PROOF', 'PHOTO', 'RESUME', 'OFFER_LETTER', 'CONTRACT', 'DEGREE_CERTIFICATE', 'EXPERIENCE_LETTER', 'LICENSE', 'CERTIFICATION', 'PAN_CARD', 'PASSPORT', 'VISA', 'MEDICAL_CERTIFICATE', 'POLICE_CLEARANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'STARTED', 'COMPLETED', 'MISSED', 'SWAPPED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEK_OFF', 'WORK_FROM_HOME');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PROCESSING', 'PROCESSED', 'APPROVED', 'PAID', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'REIMBURSEMENT');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HousekeepingTaskType" AS ENUM ('ROUTINE_CLEANING', 'DEEP_CLEANING', 'DISCHARGE_CLEANING', 'TERMINAL_CLEANING', 'SPILL_CLEANUP', 'WASTE_DISPOSAL', 'LINEN_CHANGE', 'BATHROOM_CLEANING', 'FLOOR_MOPPING', 'SANITIZATION', 'WINDOW_CLEANING', 'AC_VENT_CLEANING', 'EMERGENCY_CLEANING', 'INFECTION_CONTROL');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CleaningFrequency" AS ENUM ('HOURLY', 'TWICE_DAILY', 'DAILY', 'ALTERNATE_DAYS', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'AS_NEEDED');

-- CreateEnum
CREATE TYPE "HousekeepingItemCategory" AS ENUM ('CLEANING_CHEMICAL', 'DISINFECTANT', 'SANITIZER', 'DETERGENT', 'FLOOR_CLEANER', 'GLASS_CLEANER', 'TOILET_CLEANER', 'AIR_FRESHENER', 'TRASH_BAG', 'MOP', 'BROOM', 'BUCKET', 'GLOVES', 'MASK', 'PPE', 'LINEN', 'TOWEL', 'TISSUE', 'SOAP', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('ROUTINE', 'RANDOM', 'COMPLAINT_BASED', 'POST_INCIDENT', 'INFECTION_CONTROL', 'ACCREDITATION');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'REQUIRES_ACTION', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RhFactor" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('WHOLE_BLOOD', 'PLASMA', 'PLATELETS', 'DOUBLE_RED_CELLS', 'AUTOLOGOUS');

-- CreateEnum
CREATE TYPE "BloodTestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TestResult" AS ENUM ('NEGATIVE', 'POSITIVE', 'INDETERMINATE', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('WHOLE_BLOOD', 'PACKED_RED_CELLS', 'FRESH_FROZEN_PLASMA', 'PLATELET_CONCENTRATE', 'CRYOPRECIPITATE', 'LEUKOCYTE_POOR_RBC', 'WASHED_RBC', 'IRRADIATED_RBC');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ISSUED', 'TRANSFUSED', 'EXPIRED', 'DISCARDED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "BloodPriority" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY', 'MASSIVE_TRANSFUSION');

-- CreateEnum
CREATE TYPE "CrossMatchStatus" AS ENUM ('PENDING', 'COMPATIBLE', 'INCOMPATIBLE', 'MINOR_INCOMPATIBLE');

-- CreateEnum
CREATE TYPE "BloodRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransfusionReaction" AS ENUM ('FEBRILE', 'ALLERGIC', 'HEMOLYTIC_ACUTE', 'HEMOLYTIC_DELAYED', 'TRANSFUSION_RELATED_LUNG_INJURY', 'CIRCULATORY_OVERLOAD', 'BACTERIAL_CONTAMINATION', 'ANAPHYLACTIC', 'OTHER');

-- CreateEnum
CREATE TYPE "ReactionSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING');

-- CreateEnum
CREATE TYPE "TransfusionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'STOPPED', 'REACTION_OCCURRED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('CONSENT_FORM', 'DISCHARGE_SUMMARY', 'OPERATIVE_REPORT', 'LAB_REPORT', 'IMAGING_REPORT', 'PRESCRIPTION', 'REFERRAL_LETTER', 'MEDICAL_CERTIFICATE', 'INSURANCE_FORM', 'DEATH_CERTIFICATE', 'BIRTH_CERTIFICATE', 'VACCINATION_RECORD', 'ALLERGY_CARD', 'BLOOD_REPORT', 'PATHOLOGY_REPORT', 'ECG_REPORT', 'XRAY_IMAGE', 'CT_SCAN', 'MRI_SCAN', 'ULTRASOUND', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('UPLOAD', 'SCAN', 'SYSTEM_GENERATED', 'EXTERNAL', 'FAX', 'EMAIL');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('PUBLIC', 'NORMAL', 'RESTRICTED', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('GENERAL_TREATMENT', 'SURGICAL_PROCEDURE', 'ANESTHESIA', 'BLOOD_TRANSFUSION', 'HIV_TESTING', 'RESEARCH_PARTICIPATION', 'PHOTOGRAPHY', 'DATA_SHARING', 'LEAVE_AGAINST_ADVICE', 'DNR', 'ORGAN_DONATION');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'SIGNED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "InstrumentCategory" AS ENUM ('SURGICAL_INSTRUMENT', 'SURGICAL_SET', 'ENDOSCOPE', 'LAPAROSCOPIC', 'ORTHOPEDIC', 'DENTAL', 'OPHTHALMIC', 'ENT', 'CARDIAC', 'NEURO', 'LINEN', 'CONTAINER', 'OTHER');

-- CreateEnum
CREATE TYPE "SterilizationMethod" AS ENUM ('STEAM_AUTOCLAVE', 'ETO_GAS', 'PLASMA', 'DRY_HEAT', 'CHEMICAL', 'RADIATION');

-- CreateEnum
CREATE TYPE "ItemSterilizationStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'DIRTY', 'IN_WASHING', 'IN_STERILIZATION', 'STERILE', 'EXPIRED', 'MAINTENANCE', 'CONDEMNED');

-- CreateEnum
CREATE TYPE "ChemicalIndicatorResult" AS ENUM ('PASS', 'FAIL', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "BiologicalIndicatorResult" AS ENUM ('PASS', 'FAIL', 'PENDING', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('LOADING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MannerOfDeath" AS ENUM ('NATURAL', 'ACCIDENT', 'SUICIDE', 'HOMICIDE', 'UNDETERMINED', 'PENDING_INVESTIGATION');

-- CreateEnum
CREATE TYPE "AutopsyStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'WAIVED');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('NOT_RELEASED', 'PENDING_DOCUMENTS', 'PENDING_NOC', 'APPROVED', 'RELEASED');

-- CreateEnum
CREATE TYPE "DietCategory" AS ENUM ('REGULAR', 'SOFT', 'LIQUID', 'CLEAR_LIQUID', 'NPO', 'DIABETIC', 'LOW_SODIUM', 'LOW_FAT', 'HIGH_PROTEIN', 'RENAL', 'CARDIAC', 'PEDIATRIC', 'GERIATRIC', 'VEGETARIAN', 'VEGAN', 'HALAL', 'KOSHER', 'GLUTEN_FREE', 'LACTOSE_FREE');

-- CreateEnum
CREATE TYPE "FeedingMethod" AS ENUM ('ORAL', 'NASOGASTRIC', 'PEG_TUBE', 'PARENTERAL', 'ASSISTED');

-- CreateEnum
CREATE TYPE "DietStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'SPECIAL');

-- CreateEnum
CREATE TYPE "MealOrderStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CONSUMED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeleSessionType" AS ENUM ('VIDEO_CALL', 'AUDIO_CALL', 'CHAT', 'FOLLOW_UP', 'SECOND_OPINION', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ConnectionQuality" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "TeleSessionStatus" AS ENUM ('SCHEDULED', 'WAITING', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'TECHNICAL_ISSUE');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('MEDICAL_EQUIPMENT', 'DIAGNOSTIC_EQUIPMENT', 'SURGICAL_EQUIPMENT', 'MONITORING_EQUIPMENT', 'LIFE_SUPPORT', 'LABORATORY_EQUIPMENT', 'IMAGING_EQUIPMENT', 'FURNITURE', 'IT_EQUIPMENT', 'VEHICLE', 'BUILDING', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'DISPOSED', 'TRANSFERRED', 'LOST');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CONDEMNED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'CALIBRATION', 'INSPECTION', 'EMERGENCY', 'AMC_SERVICE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "AmbulanceType" AS ENUM ('BASIC_LIFE_SUPPORT', 'ADVANCED_LIFE_SUPPORT', 'PATIENT_TRANSPORT', 'NEONATAL', 'BARIATRIC', 'AIR_AMBULANCE');

-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('AVAILABLE', 'ON_CALL', 'EN_ROUTE_TO_SCENE', 'AT_SCENE', 'EN_ROUTE_TO_HOSPITAL', 'AT_HOSPITAL', 'OUT_OF_SERVICE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "TripRequestType" AS ENUM ('EMERGENCY_PICKUP', 'INTER_HOSPITAL_TRANSFER', 'SCHEDULED_TRANSPORT', 'DISCHARGE_TRANSPORT', 'DIALYSIS_TRANSPORT', 'OUTPATIENT_TRANSPORT');

-- CreateEnum
CREATE TYPE "TripPriority" AS ENUM ('EMERGENCY', 'URGENT', 'ROUTINE', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('REQUESTED', 'DISPATCHED', 'EN_ROUTE_TO_PICKUP', 'AT_PICKUP', 'EN_ROUTE_TO_DESTINATION', 'AT_DESTINATION', 'COMPLETED', 'CANCELLED', 'NO_PATIENT');

-- CreateEnum
CREATE TYPE "QICategory" AS ENUM ('PATIENT_SAFETY', 'CLINICAL_OUTCOMES', 'INFECTION_CONTROL', 'MEDICATION_SAFETY', 'SURGICAL_SAFETY', 'EMERGENCY_CARE', 'ICU_CARE', 'NURSING_CARE', 'DIAGNOSTIC_SERVICES', 'PATIENT_EXPERIENCE', 'ACCESS_TIMELINESS', 'OPERATIONAL_EFFICIENCY');

-- CreateEnum
CREATE TYPE "QIFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "QIStatus" AS ENUM ('ACHIEVED', 'NOT_ACHIEVED', 'BELOW_THRESHOLD', 'NEEDS_IMPROVEMENT');

-- CreateEnum
CREATE TYPE "QITrend" AS ENUM ('IMPROVING', 'STABLE', 'DECLINING');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('MEDICATION_ERROR', 'FALL', 'PRESSURE_ULCER', 'SURGICAL_COMPLICATION', 'HOSPITAL_ACQUIRED_INFECTION', 'NEEDLE_STICK', 'BLOOD_TRANSFUSION_REACTION', 'DIAGNOSTIC_ERROR', 'EQUIPMENT_FAILURE', 'SECURITY_BREACH', 'PATIENT_COMPLAINT', 'ADVERSE_DRUG_REACTION', 'NEAR_MISS', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('NEAR_MISS', 'MINOR', 'MODERATE', 'MAJOR', 'CATASTROPHIC');

-- CreateEnum
CREATE TYPE "PatientHarmLevel" AS ENUM ('NO_HARM', 'MILD', 'MODERATE', 'SEVERE', 'DEATH');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'UNDER_INVESTIGATION', 'ACTION_REQUIRED', 'ACTIONS_IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "CounterType" AS ENUM ('REGISTRATION', 'CONSULTATION', 'BILLING', 'PHARMACY', 'LABORATORY', 'RADIOLOGY', 'VACCINATION', 'BLOOD_COLLECTION', 'REPORT_COLLECTION', 'GENERAL');

-- CreateEnum
CREATE TYPE "QueuePriority" AS ENUM ('EMERGENCY', 'HIGH', 'NORMAL', 'LOW', 'VIP', 'SENIOR_CITIZEN', 'PREGNANT', 'DISABLED', 'CHILD');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CALLED', 'SERVING', 'ON_HOLD', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'TRANSFERRED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DisplayBoardType" AS ENUM ('MAIN_LOBBY', 'DEPARTMENT', 'COUNTER', 'PHARMACY', 'LAB', 'BILLING');

-- CreateEnum
CREATE TYPE "SmartOrderStatus" AS ENUM ('PENDING', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SmartOrderItemType" AS ENUM ('LAB', 'IMAGING', 'MEDICATION', 'PROCEDURE', 'NURSING', 'CONSULT', 'REFERRAL');

-- CreateEnum
CREATE TYPE "SmartOrderItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'HR_MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'HR_STAFF';
ALTER TYPE "UserRole" ADD VALUE 'HOUSEKEEPING_MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'HOUSEKEEPING_STAFF';
ALTER TYPE "UserRole" ADD VALUE 'MAINTENANCE_STAFF';
ALTER TYPE "UserRole" ADD VALUE 'SECURITY_STAFF';
ALTER TYPE "UserRole" ADD VALUE 'DIETARY_STAFF';

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "oderId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "photo" TEXT,
    "departmentId" TEXT,
    "designation" TEXT NOT NULL,
    "employeeType" "EmployeeType" NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "confirmationDate" TIMESTAMP(3),
    "resignationDate" TIMESTAMP(3),
    "lastWorkingDate" TIMESTAMP(3),
    "reportingTo" TEXT,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payFrequency" "PayFrequency" NOT NULL DEFAULT 'MONTHLY',
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "panNumber" TEXT,
    "pfNumber" TEXT,
    "esiNumber" TEXT,
    "qualification" TEXT,
    "specialization" TEXT,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "shiftId" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentName" TEXT NOT NULL,
    "documentNumber" TEXT,
    "fileUrl" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "workingHours" DECIMAL(4,2) NOT NULL,
    "isNightShift" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_schedules" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "checkInLocation" TEXT,
    "checkOutLocation" TEXT,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "workingHours" DECIMAL(4,2),
    "overtime" DECIMAL(4,2),
    "lateMinutes" INTEGER,
    "earlyLeaveMinutes" INTEGER,
    "remarks" TEXT,
    "approvedBy" TEXT,
    "biometricId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "defaultDays" INTEGER NOT NULL DEFAULT 0,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryForward" INTEGER,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "minNoticeDays" INTEGER NOT NULL DEFAULT 0,
    "maxConsecutiveDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitled" DECIMAL(5,2) NOT NULL,
    "taken" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pending" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(5,2) NOT NULL,
    "carryForwarded" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(5,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "attachmentUrl" TEXT,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "contactNumber" TEXT,
    "handoverTo" TEXT,
    "handoverNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conveyance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medicalAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "specialAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossEarnings" DECIMAL(12,2) NOT NULL,
    "pfEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pfEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "esi" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "professionalTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loanDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "totalWorkingDays" INTEGER NOT NULL,
    "daysWorked" INTEGER NOT NULL,
    "leavesTaken" INTEGER NOT NULL DEFAULT 0,
    "lopDays" INTEGER NOT NULL DEFAULT 0,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "processedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentMode" TEXT,
    "transactionId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_components" (
    "id" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PayrollComponentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewPeriodStart" TIMESTAMP(3) NOT NULL,
    "reviewPeriodEnd" TIMESTAMP(3) NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "workQuality" INTEGER,
    "productivity" INTEGER,
    "attendance" INTEGER,
    "teamwork" INTEGER,
    "communication" INTEGER,
    "initiative" INTEGER,
    "leadership" INTEGER,
    "technicalSkills" INTEGER,
    "overallRating" DECIMAL(3,2) NOT NULL,
    "strengths" TEXT[],
    "improvements" TEXT[],
    "goals" TEXT[],
    "employeeComments" TEXT,
    "reviewerComments" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_trainings" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "trainingName" TEXT NOT NULL,
    "trainingType" TEXT NOT NULL,
    "provider" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "duration" INTEGER,
    "status" "TrainingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "score" DECIMAL(5,2),
    "certificateUrl" TEXT,
    "expiryDate" TIMESTAMP(3),
    "cost" DECIMAL(10,2),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_zones" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "building" TEXT,
    "description" TEXT,
    "roomCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "housekeeping_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_tasks" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "roomNumber" TEXT,
    "bedId" TEXT,
    "taskType" "HousekeepingTaskType" NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "HousekeepingStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "assignedAt" TIMESTAMP(3),
    "supervisorId" TEXT,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 30,
    "description" TEXT,
    "specialInstructions" TEXT,
    "infectionControl" BOOLEAN NOT NULL DEFAULT false,
    "checklistCompleted" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" INTEGER,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isDischargeClean" BOOLEAN NOT NULL DEFAULT false,
    "patientId" TEXT,
    "notes" TEXT,
    "photosBefore" TEXT[],
    "photosAfter" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_schedules" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "roomNumber" TEXT,
    "taskType" "HousekeepingTaskType" NOT NULL,
    "frequency" "CleaningFrequency" NOT NULL,
    "dayOfWeek" "DayOfWeek",
    "dayOfMonth" INTEGER,
    "scheduledTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "assignedTeam" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastExecuted" TIMESTAMP(3),
    "nextScheduled" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleaning_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklist_items" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "task_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_checklists" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taskType" "HousekeepingTaskType" NOT NULL,
    "items" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cleaning_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_inventory" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "HousekeepingItemCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 10,
    "maxStock" INTEGER,
    "reorderLevel" INTEGER NOT NULL DEFAULT 20,
    "lastRestocked" TIMESTAMP(3),
    "costPerUnit" DECIMAL(10,2) NOT NULL,
    "supplierId" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "housekeeping_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_usage" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "usedBy" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "taskId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "inventory_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_audits" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "zoneId" TEXT,
    "roomNumber" TEXT,
    "auditType" "AuditType" NOT NULL,
    "auditorId" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "cleanlinessScore" INTEGER NOT NULL,
    "sanitizationScore" INTEGER NOT NULL,
    "organizationScore" INTEGER NOT NULL,
    "safetyScore" INTEGER NOT NULL,
    "overallScore" DECIMAL(4,2) NOT NULL,
    "findings" TEXT[],
    "recommendations" TEXT[],
    "photosUrl" TEXT[],
    "status" "AuditStatus" NOT NULL DEFAULT 'COMPLETED',
    "followUpDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_shift_recommendations" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recommendations" JSONB NOT NULL,
    "factors" JSONB NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedBy" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_shift_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_cleaning_priorities" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "priorities" JSONB NOT NULL,
    "factors" JSONB NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_cleaning_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_donors" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "rhFactor" "RhFactor" NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "hemoglobin" DECIMAL(4,1),
    "lastDonationDate" TIMESTAMP(3),
    "totalDonations" INTEGER NOT NULL DEFAULT 0,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "deferralReason" TEXT,
    "deferralUntil" TIMESTAMP(3),
    "hasTattoo" BOOLEAN NOT NULL DEFAULT false,
    "hasRecentSurgery" BOOLEAN NOT NULL DEFAULT false,
    "hasChronicDisease" BOOLEAN NOT NULL DEFAULT false,
    "isSmoker" BOOLEAN NOT NULL DEFAULT false,
    "isAlcoholic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_donors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_donations" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "donationNumber" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "donationDate" TIMESTAMP(3) NOT NULL,
    "donationType" "DonationType" NOT NULL,
    "bagNumber" TEXT NOT NULL,
    "volumeCollected" INTEGER NOT NULL,
    "collectedBy" TEXT NOT NULL,
    "hemoglobinLevel" DECIMAL(4,1) NOT NULL,
    "bloodPressureSys" INTEGER NOT NULL,
    "bloodPressureDia" INTEGER NOT NULL,
    "pulseRate" INTEGER NOT NULL,
    "temperature" DECIMAL(4,1) NOT NULL,
    "testingStatus" "BloodTestStatus" NOT NULL DEFAULT 'PENDING',
    "hivTest" "TestResult",
    "hbvTest" "TestResult",
    "hcvTest" "TestResult",
    "syphilisTest" "TestResult",
    "malariaTest" "TestResult",
    "testedAt" TIMESTAMP(3),
    "testedBy" TEXT,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "hasReaction" BOOLEAN NOT NULL DEFAULT false,
    "reactionDetails" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_components" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "componentType" "ComponentType" NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "rhFactor" "RhFactor" NOT NULL,
    "volume" INTEGER NOT NULL,
    "bagNumber" TEXT NOT NULL,
    "storageLocation" TEXT NOT NULL,
    "storageTemp" DECIMAL(4,1) NOT NULL,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "ComponentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "qualityChecked" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" INTEGER,
    "reservedFor" TEXT,
    "reservedAt" TIMESTAMP(3),
    "issuedTo" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedBy" TEXT,
    "discardReason" TEXT,
    "discardedAt" TIMESTAMP(3),
    "discardedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_requests" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientBloodGroup" "BloodGroup" NOT NULL,
    "patientRhFactor" "RhFactor" NOT NULL,
    "componentType" "ComponentType" NOT NULL,
    "unitsRequired" INTEGER NOT NULL,
    "priority" "BloodPriority" NOT NULL,
    "indication" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department" TEXT NOT NULL,
    "crossMatchStatus" "CrossMatchStatus" NOT NULL DEFAULT 'PENDING',
    "crossMatchedBy" TEXT,
    "crossMatchedAt" TIMESTAMP(3),
    "crossMatchNotes" TEXT,
    "status" "BloodRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "unitsFulfilled" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_transfusions" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "transfusionNumber" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "volumeTransfused" INTEGER,
    "preBPSys" INTEGER,
    "preBPDia" INTEGER,
    "prePulse" INTEGER,
    "preTemp" DECIMAL(4,1),
    "postBPSys" INTEGER,
    "postBPDia" INTEGER,
    "postPulse" INTEGER,
    "postTemp" DECIMAL(4,1),
    "administeredBy" TEXT NOT NULL,
    "supervisedBy" TEXT,
    "hasReaction" BOOLEAN NOT NULL DEFAULT false,
    "reactionType" "TransfusionReaction",
    "reactionSeverity" "ReactionSeverity",
    "reactionDetails" TEXT,
    "reactionTime" TIMESTAMP(3),
    "actionTaken" TEXT,
    "status" "TransfusionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_transfusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_documents" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "documentType" "DocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" "DocumentSource" NOT NULL,
    "encounterId" TEXT,
    "departmentId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'NORMAL',
    "aiExtractedText" TEXT,
    "aiSummary" TEXT,
    "aiTags" TEXT[],
    "tags" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_forms" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "consentNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "procedureName" TEXT,
    "consentText" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "patientSignature" TEXT,
    "patientSignedAt" TIMESTAMP(3),
    "witnessName" TEXT,
    "witnessSignature" TEXT,
    "witnessSignedAt" TIMESTAMP(3),
    "doctorId" TEXT,
    "doctorSignature" TEXT,
    "doctorSignedAt" TIMESTAMP(3),
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "expiryDate" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sterilization_items" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InstrumentCategory" NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "sterilizationMethod" "SterilizationMethod" NOT NULL,
    "sterilizationTemp" INTEGER,
    "sterilizationTime" INTEGER,
    "currentLocation" TEXT NOT NULL,
    "currentStatus" "ItemSterilizationStatus" NOT NULL DEFAULT 'AVAILABLE',
    "lastSterilizedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "totalUseCount" INTEGER NOT NULL DEFAULT 0,
    "maxUseCount" INTEGER,
    "nextMaintenanceDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sterilization_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sterilization_cycles" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "cycleNumber" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "machineName" TEXT NOT NULL,
    "method" "SterilizationMethod" NOT NULL,
    "temperature" DECIMAL(5,1) NOT NULL,
    "pressure" DECIMAL(5,2),
    "duration" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "loadDescription" TEXT,
    "itemCount" INTEGER NOT NULL,
    "chemicalIndicator" "ChemicalIndicatorResult",
    "biologicalIndicator" "BiologicalIndicatorResult",
    "operatorId" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "status" "CycleStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "failureReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sterilization_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sterilization_cycle_items" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "postCycleStatus" "ItemSterilizationStatus" NOT NULL DEFAULT 'STERILE',
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sterilization_cycle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortuary_records" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "patientId" TEXT,
    "deceasedName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "dateOfDeath" TIMESTAMP(3) NOT NULL,
    "timeOfDeath" TIMESTAMP(3) NOT NULL,
    "age" INTEGER,
    "gender" "Gender" NOT NULL,
    "placeOfDeath" TEXT NOT NULL,
    "causeOfDeath" TEXT NOT NULL,
    "mannerOfDeath" "MannerOfDeath" NOT NULL,
    "certifyingDoctor" TEXT NOT NULL,
    "certifiedAt" TIMESTAMP(3),
    "deathCertificateNumber" TEXT,
    "deathCertificateUrl" TEXT,
    "autopsyRequired" BOOLEAN NOT NULL DEFAULT false,
    "autopsyStatus" "AutopsyStatus",
    "autopsyFindings" TEXT,
    "autopsyDoctor" TEXT,
    "autopsyDate" TIMESTAMP(3),
    "compartmentNumber" TEXT,
    "storageLocation" TEXT,
    "bodyReceivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "bodyCondition" TEXT,
    "identificationMarks" TEXT,
    "belongings" TEXT[],
    "belongingsReceivedBy" TEXT,
    "nokName" TEXT NOT NULL,
    "nokRelationship" TEXT NOT NULL,
    "nokPhone" TEXT NOT NULL,
    "nokAddress" TEXT,
    "nokIdProof" TEXT,
    "releaseStatus" "ReleaseStatus" NOT NULL DEFAULT 'NOT_RELEASED',
    "releasedTo" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseAuthorizedBy" TEXT,
    "policeNocNumber" TEXT,
    "undertakerName" TEXT,
    "undertakerLicense" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mortuary_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_plans" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "DietCategory" NOT NULL,
    "calories" INTEGER,
    "protein" DECIMAL(6,2),
    "carbohydrates" DECIMAL(6,2),
    "fat" DECIMAL(6,2),
    "fiber" DECIMAL(6,2),
    "sodium" DECIMAL(6,2),
    "restrictions" TEXT[],
    "allergens" TEXT[],
    "breakfastItems" TEXT[],
    "lunchItems" TEXT[],
    "dinnerItems" TEXT[],
    "snackItems" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diet_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_diets" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionId" TEXT,
    "dietPlanId" TEXT NOT NULL,
    "specialInstructions" TEXT,
    "allergies" TEXT[],
    "preferences" TEXT[],
    "avoidItems" TEXT[],
    "feedingMethod" "FeedingMethod" NOT NULL DEFAULT 'ORAL',
    "assistanceRequired" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "prescribedBy" TEXT NOT NULL,
    "prescribedAt" TIMESTAMP(3) NOT NULL,
    "status" "DietStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_diets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_orders" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "patientDietId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "bedNumber" TEXT NOT NULL,
    "wardName" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "mealDate" TIMESTAMP(3) NOT NULL,
    "items" JSONB NOT NULL,
    "specialRequest" TEXT,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "preparedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "preparedBy" TEXT,
    "deliveredBy" TEXT,
    "status" "MealOrderStatus" NOT NULL DEFAULT 'PENDING',
    "consumptionPercent" INTEGER,
    "consumptionNotes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teleconsultation_sessions" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "sessionType" "TeleSessionType" NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'internal',
    "meetingUrl" TEXT,
    "meetingId" TEXT,
    "patientDeviceInfo" JSONB,
    "doctorDeviceInfo" JSONB,
    "connectionQuality" "ConnectionQuality",
    "chiefComplaint" TEXT,
    "symptoms" TEXT[],
    "diagnosis" TEXT,
    "prescription" TEXT,
    "followUpDate" TIMESTAMP(3),
    "doctorNotes" TEXT,
    "patientFeedback" TEXT,
    "rating" INTEGER,
    "isRecorded" BOOLEAN NOT NULL DEFAULT false,
    "recordingUrl" TEXT,
    "aiSymptomAnalysis" JSONB,
    "aiTriageSuggestion" TEXT,
    "aiTranscript" TEXT,
    "status" "TeleSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teleconsultation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "subCategory" TEXT,
    "description" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "barcode" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(12,2),
    "vendor" TEXT,
    "warrantyExpiry" TIMESTAMP(3),
    "department" TEXT,
    "building" TEXT,
    "floor" TEXT,
    "room" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "usefulLife" INTEGER,
    "depreciationRate" DECIMAL(5,2),
    "currentValue" DECIMAL(12,2),
    "hasAMC" BOOLEAN NOT NULL DEFAULT false,
    "amcVendor" TEXT,
    "amcStartDate" TIMESTAMP(3),
    "amcEndDate" TIMESTAMP(3),
    "amcCost" DECIMAL(10,2),
    "requiresCalibration" BOOLEAN NOT NULL DEFAULT false,
    "lastCalibrationDate" TIMESTAMP(3),
    "nextCalibrationDate" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "totalUsageHours" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "maintenanceNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "maintenanceType" "MaintenanceType" NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "scheduledDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "findings" TEXT,
    "actionTaken" TEXT,
    "partsReplaced" TEXT[],
    "laborCost" DECIMAL(10,2),
    "partsCost" DECIMAL(10,2),
    "totalCost" DECIMAL(10,2),
    "performedBy" TEXT,
    "vendorName" TEXT,
    "vendorContact" TEXT,
    "nextMaintenanceDate" TIMESTAMP(3),
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "aiPredictedFailure" TIMESTAMP(3),
    "aiRecommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulances" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" "AmbulanceType" NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "equipmentList" TEXT[],
    "hasVentilator" BOOLEAN NOT NULL DEFAULT false,
    "hasDefibrillator" BOOLEAN NOT NULL DEFAULT false,
    "hasOxygenSupply" BOOLEAN NOT NULL DEFAULT true,
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentLocation" TEXT,
    "lastLatitude" DECIMAL(10,8),
    "lastLongitude" DECIMAL(11,8),
    "lastLocationUpdate" TIMESTAMP(3),
    "driverId" TEXT,
    "paramedicId" TEXT,
    "lastServiceDate" TIMESTAMP(3),
    "nextServiceDate" TIMESTAMP(3),
    "mileage" INTEGER,
    "fuelLevel" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_trips" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "tripNumber" TEXT NOT NULL,
    "ambulanceId" TEXT NOT NULL,
    "requestType" "TripRequestType" NOT NULL,
    "priority" "TripPriority" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "patientName" TEXT,
    "patientAge" INTEGER,
    "patientGender" "Gender",
    "patientCondition" TEXT,
    "pickupAddress" TEXT NOT NULL,
    "pickupLatitude" DECIMAL(10,8),
    "pickupLongitude" DECIMAL(11,8),
    "pickupContact" TEXT,
    "destinationAddress" TEXT NOT NULL,
    "destinationLatitude" DECIMAL(10,8),
    "destinationLongitude" DECIMAL(11,8),
    "dispatchedAt" TIMESTAMP(3),
    "arrivedAtScene" TIMESTAMP(3),
    "departedScene" TIMESTAMP(3),
    "arrivedAtDestination" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "distanceKm" DECIMAL(8,2),
    "durationMinutes" INTEGER,
    "driverId" TEXT,
    "paramedicIds" TEXT[],
    "treatmentProvided" TEXT,
    "medicationsGiven" TEXT[],
    "vitalsRecorded" JSONB,
    "aiOptimalRoute" JSONB,
    "aiEstimatedTime" INTEGER,
    "status" "TripStatus" NOT NULL DEFAULT 'REQUESTED',
    "cancellationReason" TEXT,
    "chargeAmount" DECIMAL(10,2),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulance_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_indicators" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "QICategory" NOT NULL,
    "description" TEXT NOT NULL,
    "numeratorDef" TEXT NOT NULL,
    "denominatorDef" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "targetValue" DECIMAL(8,4) NOT NULL,
    "thresholdGreen" DECIMAL(8,4) NOT NULL,
    "thresholdYellow" DECIMAL(8,4) NOT NULL,
    "thresholdRed" DECIMAL(8,4) NOT NULL,
    "frequency" "QIFrequency" NOT NULL,
    "nationalBenchmark" DECIMAL(8,4),
    "internalBenchmark" DECIMAL(8,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qi_measurements" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "numerator" INTEGER NOT NULL,
    "denominator" INTEGER NOT NULL,
    "value" DECIMAL(8,4) NOT NULL,
    "status" "QIStatus" NOT NULL,
    "trend" "QITrend",
    "rootCause" TEXT,
    "actionPlan" TEXT,
    "aiAnalysis" TEXT,
    "aiRecommendations" TEXT[],
    "recordedBy" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qi_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_reports" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "incidentType" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "incidentTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "department" TEXT,
    "description" TEXT NOT NULL,
    "patientId" TEXT,
    "patientName" TEXT,
    "staffInvolved" TEXT[],
    "witnessNames" TEXT[],
    "immediateAction" TEXT,
    "patientHarm" "PatientHarmLevel",
    "investigatorId" TEXT,
    "investigationStarted" TIMESTAMP(3),
    "investigationFindings" TEXT,
    "rootCause" TEXT,
    "contributingFactors" TEXT[],
    "correctiveActions" JSONB,
    "preventiveActions" JSONB,
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "reportedBy" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "aiClassification" TEXT,
    "aiSeverityScore" INTEGER,
    "aiSimilarIncidents" TEXT[],
    "aiRecommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_counters" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "departmentId" TEXT,
    "counterNumber" INTEGER NOT NULL,
    "counterName" TEXT NOT NULL,
    "counterType" "CounterType" NOT NULL,
    "location" TEXT,
    "floor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentTicketId" TEXT,
    "currentStaffId" TEXT,
    "avgServiceTime" INTEGER NOT NULL DEFAULT 10,
    "servicesOffered" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_tickets" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "tokenDisplay" TEXT NOT NULL,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT,
    "appointmentId" TEXT,
    "departmentId" TEXT,
    "serviceType" TEXT NOT NULL,
    "counterId" TEXT,
    "priority" "QueuePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "noShowAt" TIMESTAMP(3),
    "estimatedWaitTime" INTEGER,
    "actualWaitTime" INTEGER,
    "serviceTime" INTEGER,
    "queuePosition" INTEGER NOT NULL DEFAULT 0,
    "initialPosition" INTEGER NOT NULL DEFAULT 0,
    "aiPriorityScore" DOUBLE PRECISION,
    "aiRecommendedCounter" TEXT,
    "urgencyLevel" TEXT,
    "smsNotified" BOOLEAN NOT NULL DEFAULT false,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "lastCalledAt" TIMESTAMP(3),
    "notes" TEXT,
    "cancellationReason" TEXT,
    "servedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_configs" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "departmentId" TEXT,
    "serviceType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "dailyReset" BOOLEAN NOT NULL DEFAULT true,
    "maxDailyTickets" INTEGER NOT NULL DEFAULT 999,
    "operatingHoursStart" TEXT NOT NULL DEFAULT '08:00',
    "operatingHoursEnd" TEXT NOT NULL DEFAULT '20:00',
    "priorityEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emergencyMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "vipMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "seniorMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "avgServiceTime" INTEGER NOT NULL DEFAULT 10,
    "maxWaitTime" INTEGER NOT NULL DEFAULT 60,
    "smsAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertBeforePosition" INTEGER NOT NULL DEFAULT 3,
    "noShowTimeout" INTEGER NOT NULL DEFAULT 5,
    "recallLimit" INTEGER NOT NULL DEFAULT 3,
    "displayMessage" TEXT,
    "announcementEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_display_boards" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "boardName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "boardType" "DisplayBoardType" NOT NULL DEFAULT 'DEPARTMENT',
    "departmentIds" TEXT[],
    "counterIds" TEXT[],
    "displayMode" TEXT NOT NULL DEFAULT 'list',
    "ticketsToShow" INTEGER NOT NULL DEFAULT 10,
    "refreshInterval" INTEGER NOT NULL DEFAULT 5,
    "showEstimatedTime" BOOLEAN NOT NULL DEFAULT true,
    "showCounter" BOOLEAN NOT NULL DEFAULT true,
    "customMessage" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_display_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_analytics" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "departmentId" TEXT,
    "serviceType" TEXT,
    "date" DATE NOT NULL,
    "hour" INTEGER,
    "totalTickets" INTEGER NOT NULL DEFAULT 0,
    "servedTickets" INTEGER NOT NULL DEFAULT 0,
    "noShowTickets" INTEGER NOT NULL DEFAULT 0,
    "cancelledTickets" INTEGER NOT NULL DEFAULT 0,
    "avgWaitTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minWaitTime" INTEGER NOT NULL DEFAULT 0,
    "maxWaitTime" INTEGER NOT NULL DEFAULT 0,
    "avgServiceTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minServiceTime" INTEGER NOT NULL DEFAULT 0,
    "maxServiceTime" INTEGER NOT NULL DEFAULT 0,
    "peakHour" INTEGER,
    "peakWaitTime" INTEGER,
    "staffPerformance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_announcements" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "counterNumber" INTEGER NOT NULL,
    "counterName" TEXT NOT NULL,
    "patientName" TEXT,
    "announcementText" TEXT NOT NULL,
    "audioUrl" TEXT,
    "playedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartOrder" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderedById" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "icdCode" TEXT,
    "symptoms" TEXT[],
    "aiRecommended" BOOLEAN NOT NULL DEFAULT false,
    "bundleId" TEXT,
    "bundleName" TEXT,
    "status" "SmartOrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'ROUTINE',
    "totalEstimatedCost" DOUBLE PRECISION,
    "notes" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartOrderItem" (
    "id" TEXT NOT NULL,
    "smartOrderId" TEXT NOT NULL,
    "orderType" "SmartOrderItemType" NOT NULL,
    "orderCode" TEXT,
    "orderName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'ROUTINE',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "aiRecommended" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "rationale" TEXT,
    "dosing" JSONB,
    "warnings" TEXT[],
    "alternatives" JSONB,
    "status" "SmartOrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedCost" DOUBLE PRECISION,
    "executedAt" TIMESTAMP(3),
    "executedById" TEXT,
    "resultNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_oderId_key" ON "employees"("oderId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_hospitalId_employeeCode_key" ON "employees"("hospitalId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_hospitalId_code_key" ON "shifts"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employeeId_date_key" ON "attendance"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_hospitalId_code_key" ON "leave_types"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employeeId_leaveTypeId_year_key" ON "leave_balances"("employeeId", "leaveTypeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_employeeId_month_year_key" ON "payrolls"("employeeId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "housekeeping_zones_hospitalId_code_key" ON "housekeeping_zones"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "housekeeping_inventory_hospitalId_code_key" ON "housekeeping_inventory"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "blood_donors_donorId_key" ON "blood_donors"("donorId");

-- CreateIndex
CREATE UNIQUE INDEX "blood_donations_donationNumber_key" ON "blood_donations"("donationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "blood_donations_bagNumber_key" ON "blood_donations"("bagNumber");

-- CreateIndex
CREATE UNIQUE INDEX "blood_components_componentId_key" ON "blood_components"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "blood_requests_requestNumber_key" ON "blood_requests"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "blood_transfusions_transfusionNumber_key" ON "blood_transfusions"("transfusionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "medical_documents_documentNumber_key" ON "medical_documents"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "consent_forms_consentNumber_key" ON "consent_forms"("consentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sterilization_items_itemCode_key" ON "sterilization_items"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "sterilization_cycles_cycleNumber_key" ON "sterilization_cycles"("cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "mortuary_records_recordNumber_key" ON "mortuary_records"("recordNumber");

-- CreateIndex
CREATE UNIQUE INDEX "diet_plans_planCode_key" ON "diet_plans"("planCode");

-- CreateIndex
CREATE UNIQUE INDEX "meal_orders_orderNumber_key" ON "meal_orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "teleconsultation_sessions_sessionId_key" ON "teleconsultation_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetCode_key" ON "assets"("assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "asset_maintenance_maintenanceNumber_key" ON "asset_maintenance"("maintenanceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ambulances_vehicleNumber_key" ON "ambulances"("vehicleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ambulance_trips_tripNumber_key" ON "ambulance_trips"("tripNumber");

-- CreateIndex
CREATE UNIQUE INDEX "quality_indicators_hospitalId_code_key" ON "quality_indicators"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "incident_reports_reportNumber_key" ON "incident_reports"("reportNumber");

-- CreateIndex
CREATE UNIQUE INDEX "queue_counters_hospitalId_counterNumber_key" ON "queue_counters"("hospitalId", "counterNumber");

-- CreateIndex
CREATE INDEX "queue_tickets_hospitalId_status_issuedAt_idx" ON "queue_tickets"("hospitalId", "status", "issuedAt");

-- CreateIndex
CREATE INDEX "queue_tickets_hospitalId_departmentId_status_idx" ON "queue_tickets"("hospitalId", "departmentId", "status");

-- CreateIndex
CREATE INDEX "queue_tickets_hospitalId_serviceType_status_idx" ON "queue_tickets"("hospitalId", "serviceType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "queue_tickets_hospitalId_ticketNumber_issuedAt_key" ON "queue_tickets"("hospitalId", "ticketNumber", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "queue_configs_serviceType_key" ON "queue_configs"("serviceType");

-- CreateIndex
CREATE INDEX "queue_analytics_hospitalId_date_idx" ON "queue_analytics"("hospitalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "queue_analytics_hospitalId_departmentId_serviceType_date_ho_key" ON "queue_analytics"("hospitalId", "departmentId", "serviceType", "date", "hour");

-- CreateIndex
CREATE INDEX "queue_announcements_hospitalId_status_idx" ON "queue_announcements"("hospitalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SmartOrder_orderNumber_key" ON "SmartOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "SmartOrder_hospitalId_patientId_idx" ON "SmartOrder"("hospitalId", "patientId");

-- CreateIndex
CREATE INDEX "SmartOrder_hospitalId_status_idx" ON "SmartOrder"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "SmartOrder_orderedById_idx" ON "SmartOrder"("orderedById");

-- CreateIndex
CREATE INDEX "SmartOrder_orderNumber_idx" ON "SmartOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "SmartOrderItem_smartOrderId_idx" ON "SmartOrderItem"("smartOrderId");

-- CreateIndex
CREATE INDEX "SmartOrderItem_orderType_idx" ON "SmartOrderItem"("orderType");

-- CreateIndex
CREATE INDEX "SmartOrderItem_status_idx" ON "SmartOrderItem"("status");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_oderId_fkey" FOREIGN KEY ("oderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_components" ADD CONSTRAINT "payroll_components_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "payrolls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_trainings" ADD CONSTRAINT "employee_trainings_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "housekeeping_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_schedules" ADD CONSTRAINT "cleaning_schedules_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "housekeeping_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "housekeeping_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_usage" ADD CONSTRAINT "inventory_usage_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "housekeeping_inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_audits" ADD CONSTRAINT "quality_audits_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_donations" ADD CONSTRAINT "blood_donations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "blood_donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_components" ADD CONSTRAINT "blood_components_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "blood_donations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_transfusions" ADD CONSTRAINT "blood_transfusions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "blood_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_transfusions" ADD CONSTRAINT "blood_transfusions_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "blood_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sterilization_cycle_items" ADD CONSTRAINT "sterilization_cycle_items_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "sterilization_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sterilization_cycle_items" ADD CONSTRAINT "sterilization_cycle_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "sterilization_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_diets" ADD CONSTRAINT "patient_diets_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "diet_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_orders" ADD CONSTRAINT "meal_orders_patientDietId_fkey" FOREIGN KEY ("patientDietId") REFERENCES "patient_diets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_trips" ADD CONSTRAINT "ambulance_trips_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qi_measurements" ADD CONSTRAINT "qi_measurements_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "quality_indicators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "queue_counters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartOrder" ADD CONSTRAINT "SmartOrder_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartOrder" ADD CONSTRAINT "SmartOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartOrder" ADD CONSTRAINT "SmartOrder_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartOrderItem" ADD CONSTRAINT "SmartOrderItem_smartOrderId_fkey" FOREIGN KEY ("smartOrderId") REFERENCES "SmartOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartOrderItem" ADD CONSTRAINT "SmartOrderItem_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
