import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendError } from '../utils/response';

export const validate = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        sendError(res, 'Validation failed', 400, errors);
        return;
      }
      next(error);
    }
  };
};

// Common validation schemas
export const paginationSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    search: z.string().optional(),
  }),
});

export const uuidParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),
});

// Auth schemas
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    phone: z.string().optional(),
    hospitalId: z.string().uuid('Invalid hospital ID'),
    role: z.enum([
      'HOSPITAL_ADMIN',
      'DOCTOR',
      'NURSE',
      'RECEPTIONIST',
      'LAB_TECHNICIAN',
      'PHARMACIST',
      'RADIOLOGIST',
      'ACCOUNTANT',
    ]),
  }),
});

// Patient schemas
export const createPatientSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().datetime().or(z.date()),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    bloodGroup: z.enum([
      'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
      'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'
    ]).optional(),
    phone: z.string().min(1, 'Phone number is required'),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    zipCode: z.string().optional().or(z.literal('')),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    occupation: z.string().optional(),
    maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
    nationality: z.string().optional(),
  }),
});

// Appointment schemas
export const createAppointmentSchema = z.object({
  body: z.object({
    patientId: z.string().uuid('Invalid patient ID'),
    doctorId: z.string().uuid('Invalid doctor ID'),
    appointmentDate: z.string().datetime().or(z.date()),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time format should be HH:MM'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time format should be HH:MM'),
    type: z.enum(['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'TELEMEDICINE', 'PROCEDURE']),
    reason: z.string().optional(),
    notes: z.string().optional(),
    isFollowUp: z.boolean().optional().default(false),
    parentAppointmentId: z.string().uuid().optional(),
  }),
});

export const updateAppointmentStatusSchema = z.object({
  body: z.object({
    status: z.enum(['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], {
      errorMap: () => ({ message: 'Invalid appointment status' })
    }),
  }),
});

// Consultation schemas
export const createConsultationSchema = z.object({
  body: z.object({
    appointmentId: z.string().uuid('Invalid appointment ID'),
    chiefComplaint: z.string().min(1, 'Chief complaint is required'),
    historyOfIllness: z.string().optional(),
    examination: z.string().optional(),
    diagnosis: z.array(z.string()).min(1, 'At least one diagnosis required'),
    icdCodes: z.array(z.string()),
    treatmentPlan: z.string().optional(),
    advice: z.string().optional(),
    followUpDate: z.string().datetime().optional(),
    notes: z.string().optional(),
  }),
});

// Prescription schemas
export const createPrescriptionSchema = z.object({
  body: z.object({
    consultationId: z.string().uuid().optional(),
    patientId: z.string().uuid('Invalid patient ID'),
    admissionId: z.string().uuid().optional(),
    notes: z.string().optional(),
    medications: z.array(z.object({
      drugId: z.string().uuid().optional(),
      drugName: z.string().min(1, 'Drug name is required'),
      dosage: z.string().min(1, 'Dosage is required'),
      frequency: z.string().min(1, 'Frequency is required'),
      duration: z.string().min(1, 'Duration is required'),
      quantity: z.number().int().positive(),
      route: z.string().min(1, 'Route is required'),
      instructions: z.string().optional(),
      beforeAfterFood: z.string().optional(),
    })).min(1, 'At least one medication required'),
  }),
});

// Lab order schemas
export const createLabOrderSchema = z.object({
  body: z.object({
    patientId: z.string().uuid('Invalid patient ID'),
    consultationId: z.string().uuid().optional(),
    priority: z.enum(['STAT', 'URGENT', 'ROUTINE']).optional().default('ROUTINE'),
    clinicalNotes: z.string().optional(),
    specialInstructions: z.string().optional(),
    testIds: z.array(z.string().uuid()).min(1, 'At least one test required'),
  }),
});

// Admission schemas
export const createAdmissionSchema = z.object({
  body: z.object({
    patientId: z.string().uuid('Invalid patient ID'),
    bedId: z.string().uuid('Invalid bed ID'),
    admissionType: z.enum(['EMERGENCY', 'ELECTIVE', 'TRANSFER', 'MATERNITY']),
    admittingDoctorId: z.string().uuid('Invalid doctor ID'),
    chiefComplaint: z.string().min(1, 'Chief complaint is required'),
    diagnosis: z.array(z.string()),
    icdCodes: z.array(z.string()),
    treatmentPlan: z.string().optional(),
    estimatedDays: z.number().int().positive().optional(),
    notes: z.string().optional(),
  }),
});

// Invoice schemas
export const createInvoiceSchema = z.object({
  body: z.object({
    patientId: z.string().uuid('Invalid patient ID'),
    discount: z.number().min(0).optional().default(0),
    notes: z.string().optional(),
    items: z.array(z.object({
      description: z.string().min(1, 'Description is required'),
      category: z.string().min(1, 'Category is required'),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      discount: z.number().min(0).optional().default(0),
    })).min(1, 'At least one item required'),
  }),
});

// AI schemas
export const aiDiagnoseSchema = z.object({
  body: z.object({
    patientId: z.string().uuid('Invalid patient ID'),
    symptoms: z.array(z.string()).min(1, 'At least one symptom required'),
    medicalHistory: z.array(z.string()).optional(),
    currentMedications: z.array(z.string()).optional(),
    vitalSigns: z.object({
      temperature: z.number().optional(),
      bloodPressure: z.string().optional(),
      heartRate: z.number().optional(),
      respiratoryRate: z.number().optional(),
      oxygenSaturation: z.number().optional(),
    }).optional(),
  }),
});

export const aiPredictRiskSchema = z.object({
  body: z.object({
    patientId: z.string().uuid('Invalid patient ID'),
    predictionType: z.enum(['READMISSION', 'LENGTH_OF_STAY', 'MORTALITY', 'DISEASE_PROGRESSION', 'NO_SHOW', 'DETERIORATION']),
    timeframe: z.string().optional(),
  }),
});

export const aiAnalyzeImageSchema = z.object({
  body: z.object({
    imagingOrderId: z.string().uuid('Invalid imaging order ID'),
    imageUrl: z.string().url('Invalid image URL'),
    modalityType: z.enum(['XRAY', 'CT', 'MRI', 'ULTRASOUND', 'MAMMOGRAPHY', 'PET', 'FLUOROSCOPY']),
    bodyPart: z.string().min(1, 'Body part is required'),
  }),
});

// Direct AI test schema (no database lookup required)
export const aiDirectDiagnoseSchema = z.object({
  body: z.object({
    symptoms: z.array(z.string()).min(1, 'At least one symptom required'),
    patientAge: z.number().int().min(0).max(150),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    medicalHistory: z.array(z.string()).optional().default([]),
    currentMedications: z.array(z.string()).optional().default([]),
    allergies: z.array(z.string()).optional().default([]),
    vitalSigns: z.object({
      temperature: z.number().optional(),
      bloodPressure: z.string().optional(),
      heartRate: z.number().optional(),
      respiratoryRate: z.number().optional(),
      oxygenSaturation: z.number().optional(),
    }).optional(),
  }),
});

export const aiDirectPredictRiskSchema = z.object({
  body: z.object({
    predictionType: z.enum(['readmission', 'deterioration', 'mortality', 'length_of_stay', 'no_show']),
    timeframe: z.string().optional().default('30 days'),
    patientData: z.object({
      age: z.number().int().min(0),
      gender: z.string(),
      chronicConditions: z.array(z.string()).optional(),
      medications: z.array(z.string()).optional(),
      recentAdmissions: z.number().optional(),
      lengthOfStay: z.number().optional(),
      vitals: z.record(z.any()).optional(),
      labResults: z.record(z.any()).optional(),
    }),
  }),
});

export const aiDirectAnalyzeImageSchema = z.object({
  body: z.object({
    imageUrl: z.string().min(1, 'Image URL is required'),
    modalityType: z.enum(['XRAY', 'CT', 'MRI', 'ULTRASOUND']),
    bodyPart: z.string().min(1, 'Body part is required'),
    patientAge: z.number().int().min(0).max(150),
    patientGender: z.enum(['male', 'female', 'other']),
    clinicalHistory: z.string().optional(),
  }),
});
