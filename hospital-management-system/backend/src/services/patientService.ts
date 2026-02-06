import prisma from '../config/database';
import { CreatePatientDto, SearchParams } from '../types';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { patientLookupService } from './patientLookupService';

export class PatientService {
  private generateMRN(hospitalCode: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${hospitalCode}-${timestamp}${random}`;
  }

  async create(hospitalId: string, data: CreatePatientDto) {
    // Check for existing patient first
    const existingPatient = await patientLookupService.findExistingPatient(hospitalId, {
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
    });

    if (existingPatient) {
      // Return existing patient with a flag
      return {
        ...existingPatient,
        isExisting: true,
        message: 'Patient already exists in the system'
      };
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    const mrn = this.generateMRN(hospital.code);

    const patient = await prisma.patient.create({
      data: {
        ...data,
        hospitalId,
        mrn,
        dateOfBirth: new Date(data.dateOfBirth),
        bloodGroup: data.bloodGroup as any,
      } as any,
      include: {
        hospital: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Create empty medical history
    await prisma.medicalHistory.create({
      data: {
        patientId: patient.id,
        chronicConditions: [],
        pastSurgeries: [],
        familyHistory: [],
        currentMedications: [],
        immunizations: [],
      },
    });

    return patient;
  }

  async findAll(hospitalId: string, params: SearchParams & { mrn?: string; gender?: string; isActive?: boolean; phone?: string }) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc', mrn, gender, isActive, phone } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { mrn: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Additional filters
    if (mrn) {
      where.mrn = { contains: mrn, mode: 'insensitive' };
    }
    if (gender) {
      where.gender = gender;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (phone) {
      where.phone = { contains: phone, mode: 'insensitive' };
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              appointments: true,
              admissions: true,
            },
          },
          // Include primary insurance for expiry status display
          insurances: {
            where: { isActive: true },
            orderBy: { priority: 'asc' },
            take: 1,
            select: {
              id: true,
              providerName: true,
              expiryDate: true,
              isActive: true,
            },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    return { patients, total };
  }

  async findById(id: string, hospitalId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
      include: {
        medicalHistory: true,
        allergies: true,
        vitals: {
          orderBy: { recordedAt: 'desc' },
          take: 10,
        },
        insurances: {
          where: { isActive: true },
        },
        appointments: {
          orderBy: { appointmentDate: 'desc' },
          take: 10,
          include: {
            doctor: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
                department: true,
              },
            },
          },
        },
        admissions: {
          orderBy: { admissionDate: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            appointments: true,
            admissions: true,
            labOrders: true,
            prescriptions: true,
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    return patient;
  }

  async findByMRN(mrn: string, hospitalId: string) {
    const patient = await prisma.patient.findFirst({
      where: { mrn, hospitalId },
      include: {
        medicalHistory: true,
        allergies: true,
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    return patient;
  }

  async findByEmiratesId(emiratesId: string, hospitalId: string) {
    const patient = await prisma.patient.findFirst({
      where: { emiratesId, hospitalId },
      include: {
        medicalHistory: true,
        allergies: true,
        insurances: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found with this Emirates ID');
    }

    return patient;
  }

  async update(id: string, hospitalId: string, data: Partial<CreatePatientDto>) {
    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const updated = await prisma.patient.update({
      where: { id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        bloodGroup: data.bloodGroup as any,
      } as any,
    });

    return updated;
  }

  async delete(id: string, hospitalId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Soft delete
    await prisma.patient.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async updateMedicalHistory(patientId: string, hospitalId: string, data: any) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const history = await prisma.medicalHistory.upsert({
      where: { patientId },
      update: data,
      create: {
        patientId,
        ...data,
      },
    });

    return history;
  }

  async addAllergy(patientId: string, hospitalId: string, data: {
    allergen: string;
    type: 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
    severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
    reaction?: string;
    notes?: string;
  }) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const allergy = await prisma.allergy.create({
      data: {
        patientId,
        ...data,
      },
    });

    return allergy;
  }

  async removeAllergy(patientId: string, allergyId: string) {
    await prisma.allergy.delete({
      where: { id: allergyId, patientId },
    });
  }

  async recordVitals(patientId: string, hospitalId: string, data: {
    temperature?: number;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
    bloodSugar?: number;
    notes?: string;
    recordedBy: string;
  }) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Calculate BMI if weight and height are provided
    let bmi: number | undefined;
    if (data.weight && data.height) {
      const heightInMeters = data.height / 100;
      bmi = data.weight / (heightInMeters * heightInMeters);
    }

    const vitals = await prisma.vital.create({
      data: {
        patientId,
        ...data,
        bmi,
      },
    });

    return vitals;
  }

  async getVitalsHistory(patientId: string, hospitalId: string, limit = 20) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const vitals = await prisma.vital.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });

    return vitals;
  }

  async addInsurance(patientId: string, hospitalId: string, data: {
    providerId?: string;
    providerName?: string;
    policyNumber: string;
    groupNumber?: string;
    subscriberName: string;
    subscriberId: string;
    relationship: string;
    effectiveDate: Date;
    expiryDate?: Date;
    coverageType: string;
    copay?: number;
    deductible?: number;
    isPrimary?: boolean;
  }) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    let providerName = data.providerName;
    let providerId = data.providerId;

    // If providerId is given, validate and get provider name
    if (providerId) {
      const provider = await prisma.insuranceProvider.findFirst({
        where: { id: providerId, hospitalId, isActive: true },
      });
      if (!provider) {
        throw new NotFoundError('Insurance provider not found or inactive');
      }
      providerName = provider.name;

      // Check for duplicate: same patient + provider + policy
      const existing = await prisma.patientInsurance.findFirst({
        where: {
          patientId,
          providerId,
          policyNumber: data.policyNumber,
          isActive: true,
        },
      });
      if (existing) {
        throw new Error('This insurance policy already exists for this patient');
      }
    }

    if (!providerName) {
      throw new Error('Provider name is required');
    }

    // If this is primary, update other insurances
    if (data.isPrimary) {
      await prisma.patientInsurance.updateMany({
        where: { patientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const insurance = await prisma.patientInsurance.create({
      data: {
        patientId,
        providerId,
        providerName,
        policyNumber: data.policyNumber,
        groupNumber: data.groupNumber,
        subscriberName: data.subscriberName,
        subscriberId: data.subscriberId,
        relationship: data.relationship,
        effectiveDate: data.effectiveDate,
        expiryDate: data.expiryDate,
        coverageType: data.coverageType,
        copay: data.copay,
        deductible: data.deductible,
        isPrimary: data.isPrimary,
      },
    });

    return insurance;
  }

  async getInsurances(patientId: string, hospitalId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const insurances = await prisma.patientInsurance.findMany({
      where: { patientId },
      orderBy: [
        { isPrimary: 'desc' },
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return insurances;
  }

  async deleteInsurance(patientId: string, insuranceId: string, hospitalId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const insurance = await prisma.patientInsurance.findFirst({
      where: { id: insuranceId, patientId },
    });

    if (!insurance) {
      throw new NotFoundError('Insurance not found');
    }

    await prisma.patientInsurance.delete({
      where: { id: insuranceId },
    });

    return true;
  }

  /**
   * Verify or reject a patient's insurance (manual verification)
   */
  async verifyInsurance(
    patientId: string,
    insuranceId: string,
    hospitalId: string,
    verifiedById: string,
    data: {
      status: 'VERIFIED' | 'REJECTED';
      notes?: string;
    }
  ) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const insurance = await prisma.patientInsurance.findFirst({
      where: { id: insuranceId, patientId },
    });

    if (!insurance) {
      throw new NotFoundError('Insurance not found');
    }

    const updated = await prisma.patientInsurance.update({
      where: { id: insuranceId },
      data: {
        verificationStatus: data.status,
        verifiedAt: new Date(),
        verifiedBy: verifiedById,
        verificationNotes: data.notes || null,
        verificationSource: 'MANUAL',
      },
    });

    // Create audit log - get hospitalId from patient
    await prisma.insuranceVerificationAudit.create({
      data: {
        hospitalId: patient.hospitalId,
        patientId,
        action: data.status === 'VERIFIED' ? 'MANUAL_VERIFY' : 'MANUAL_REJECT',
        performedBy: verifiedById,
        reason: data.notes,
        previousData: {
          verificationStatus: insurance.verificationStatus,
          providerName: insurance.providerName,
          policyNumber: insurance.policyNumber,
        },
        newData: {
          verificationStatus: data.status,
          verifiedAt: new Date().toISOString(),
        },
      },
    });

    return updated;
  }

  /**
   * Get all pending insurance verifications for a hospital
   */
  async getPendingVerifications(hospitalId: string) {
    const pendingInsurances = await prisma.patientInsurance.findMany({
      where: {
        verificationStatus: 'PENDING',
        patient: {
          hospitalId,
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            emiratesId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Oldest first
      },
    });

    return pendingInsurances;
  }

  async getPatientTimeline(patientId: string, hospitalId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const [appointments, admissions, labOrders, imagingOrders] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId },
        orderBy: { appointmentDate: 'desc' },
        take: 20,
        include: {
          doctor: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.admission.findMany({
        where: { patientId },
        orderBy: { admissionDate: 'desc' },
        take: 10,
      }),
      prisma.labOrder.findMany({
        where: { patientId },
        orderBy: { orderedAt: 'desc' },
        take: 20,
        include: {
          tests: { include: { labTest: true } },
        },
      }),
      prisma.imagingOrder.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Combine and sort all events by date
    const timeline = [
      ...appointments.map(a => ({
        type: 'APPOINTMENT',
        date: a.appointmentDate,
        data: a,
      })),
      ...admissions.map(a => ({
        type: 'ADMISSION',
        date: a.admissionDate,
        data: a,
      })),
      ...labOrders.map(l => ({
        type: 'LAB_ORDER',
        date: l.orderedAt,
        data: l,
      })),
      ...imagingOrders.map(i => ({
        type: 'IMAGING_ORDER',
        date: i.createdAt,
        data: i,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return timeline;
  }

  /**
   * Find an existing patient or create a new one.
   * Uses the lookup service to check for duplicates before creating.
   */
  async findOrCreate(hospitalId: string, data: CreatePatientDto): Promise<{ patient: any; isNew: boolean }> {
    // Check for existing patient first
    const existingPatient = await patientLookupService.findExistingPatient(hospitalId, {
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
    });

    if (existingPatient) {
      return {
        patient: existingPatient,
        isNew: false,
      };
    }

    // No existing patient found, create a new one
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    const mrn = this.generateMRN(hospital.code);

    const patient = await prisma.patient.create({
      data: {
        ...data,
        hospitalId,
        mrn,
        dateOfBirth: new Date(data.dateOfBirth),
        bloodGroup: data.bloodGroup as any,
      } as any,
      include: {
        hospital: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Create empty medical history
    await prisma.medicalHistory.create({
      data: {
        patientId: patient.id,
        chronicConditions: [],
        pastSurgeries: [],
        familyHistory: [],
        currentMedications: [],
        immunizations: [],
      },
    });

    return {
      patient,
      isNew: true,
    };
  }

  /**
   * Search for potential duplicate patients based on partial matching.
   * Useful for staff to review before creating new patients.
   */
  async searchDuplicates(
    hospitalId: string,
    criteria: {
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
    }
  ) {
    return patientLookupService.findPotentialDuplicates(hospitalId, criteria);
  }
}

export const patientService = new PatientService();
