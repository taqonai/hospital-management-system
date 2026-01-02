import prisma from '../config/database';
import { CreatePatientDto, SearchParams } from '../types';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export class PatientService {
  private generateMRN(hospitalCode: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${hospitalCode}-${timestamp}${random}`;
  }

  async create(hospitalId: string, data: CreatePatientDto) {
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
      },
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

  async findAll(hospitalId: string, params: SearchParams) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
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
      },
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
    providerName: string;
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
        ...data,
      },
    });

    return insurance;
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
}

export const patientService = new PatientService();
