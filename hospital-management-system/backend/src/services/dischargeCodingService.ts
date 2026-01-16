import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { DiagnosisType, DischargeCodingStatus, Prisma } from '@prisma/client';
import logger from '../utils/logger';

export interface DischargeDiagnosisInput {
  icd10CodeId: string;
  sequenceNumber?: number;
  isPrimary?: boolean;
  isAdmitting?: boolean;
  diagnosisType?: DiagnosisType;
  presentOnAdmission?: string; // Y, N, U, W
  notes?: string;
  aiSuggested?: boolean;
  aiConfidence?: number;
}

export interface DischargeProcedureInput {
  cptCodeId: string;
  modifiers?: string[];
  units?: number;
  serviceDate: Date;
  price: number;
  performedBy?: string;
  notes?: string;
  aiSuggested?: boolean;
  aiConfidence?: number;
}

export class DischargeCodingService {
  /**
   * Get or create discharge coding for an admission
   */
  async getOrCreateDischargeCoding(admissionId: string) {
    // Check if admission exists
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
        },
      },
    });

    if (!admission) {
      throw new NotFoundError('Admission not found');
    }

    // Check for existing discharge coding
    let coding = await prisma.dischargeCoding.findUnique({
      where: { admissionId },
      include: {
        diagnoses: {
          include: {
            icd10Code: {
              select: {
                id: true,
                code: true,
                description: true,
                category: true,
                specificityLevel: true,
                dhaApproved: true,
              },
            },
          },
          orderBy: { sequenceNumber: 'asc' },
        },
        procedures: {
          include: {
            cptCode: {
              select: {
                id: true,
                code: true,
                description: true,
                category: true,
                basePrice: true,
                dhaPrice: true,
                requiresPreAuth: true,
              },
            },
          },
          orderBy: { serviceDate: 'asc' },
        },
      },
    });

    // Create if not exists
    if (!coding) {
      coding = await prisma.dischargeCoding.create({
        data: {
          admissionId,
          status: 'DRAFT',
        },
        include: {
          diagnoses: {
            include: {
              icd10Code: {
                select: {
                  id: true,
                  code: true,
                  description: true,
                  category: true,
                  specificityLevel: true,
                  dhaApproved: true,
                },
              },
            },
            orderBy: { sequenceNumber: 'asc' },
          },
          procedures: {
            include: {
              cptCode: {
                select: {
                  id: true,
                  code: true,
                  description: true,
                  category: true,
                  basePrice: true,
                  dhaPrice: true,
                  requiresPreAuth: true,
                },
              },
            },
            orderBy: { serviceDate: 'asc' },
          },
        },
      });
    }

    // Calculate total charges
    const totalCharges = coding.procedures.reduce(
      (sum, proc) => sum + Number(proc.price) * proc.units,
      0
    );

    return {
      ...coding,
      admission,
      totalCharges,
      diagnosisCount: coding.diagnoses.length,
      procedureCount: coding.procedures.length,
    };
  }

  /**
   * Get discharge coding by ID
   */
  async getDischargeCodingById(id: string) {
    const coding = await prisma.dischargeCoding.findUnique({
      where: { id },
      include: {
        admission: {
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                gender: true,
              },
            },
          },
        },
        diagnoses: {
          include: {
            icd10Code: {
              select: {
                id: true,
                code: true,
                description: true,
                category: true,
                specificityLevel: true,
                dhaApproved: true,
              },
            },
          },
          orderBy: { sequenceNumber: 'asc' },
        },
        procedures: {
          include: {
            cptCode: {
              select: {
                id: true,
                code: true,
                description: true,
                category: true,
                basePrice: true,
                dhaPrice: true,
                requiresPreAuth: true,
              },
            },
          },
          orderBy: { serviceDate: 'asc' },
        },
      },
    });

    if (!coding) {
      throw new NotFoundError('Discharge coding not found');
    }

    const totalCharges = coding.procedures.reduce(
      (sum, proc) => sum + Number(proc.price) * proc.units,
      0
    );

    return {
      ...coding,
      totalCharges,
      diagnosisCount: coding.diagnoses.length,
      procedureCount: coding.procedures.length,
    };
  }

  /**
   * Add a diagnosis to discharge coding
   */
  async addDiagnosis(dischargeCodingId: string, data: DischargeDiagnosisInput, createdBy?: string) {
    const coding = await prisma.dischargeCoding.findUnique({
      where: { id: dischargeCodingId },
    });

    if (!coding) {
      throw new NotFoundError('Discharge coding not found');
    }

    if (coding.status === 'FINALIZED' || coding.status === 'SUBMITTED') {
      throw new AppError('Cannot modify finalized or submitted coding', 400);
    }

    // Verify ICD code exists
    const icdCode = await prisma.iCD10Code.findUnique({
      where: { id: data.icd10CodeId },
    });
    if (!icdCode) {
      throw new NotFoundError('ICD-10 code not found');
    }

    // If marking as primary, unset any existing primary
    if (data.isPrimary) {
      await prisma.dischargeDiagnosis.updateMany({
        where: { dischargeCodingId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Determine sequence number if not provided
    let sequenceNumber = data.sequenceNumber;
    if (!sequenceNumber) {
      const lastDiagnosis = await prisma.dischargeDiagnosis.findFirst({
        where: { dischargeCodingId },
        orderBy: { sequenceNumber: 'desc' },
      });
      sequenceNumber = (lastDiagnosis?.sequenceNumber || 0) + 1;
    }

    const diagnosis = await prisma.dischargeDiagnosis.create({
      data: {
        dischargeCodingId,
        icd10CodeId: data.icd10CodeId,
        sequenceNumber,
        isPrimary: data.isPrimary ?? false,
        isAdmitting: data.isAdmitting ?? false,
        diagnosisType: data.diagnosisType ?? 'FINAL',
        presentOnAdmission: data.presentOnAdmission,
        notes: data.notes,
        aiSuggested: data.aiSuggested ?? false,
        aiConfidence: data.aiConfidence,
        createdBy,
      },
      include: {
        icd10Code: {
          select: {
            id: true,
            code: true,
            description: true,
            category: true,
          },
        },
      },
    });

    return diagnosis;
  }

  /**
   * Add multiple diagnoses to discharge coding
   */
  async addDiagnoses(dischargeCodingId: string, diagnoses: DischargeDiagnosisInput[], createdBy?: string) {
    const results = [];

    for (const diag of diagnoses) {
      try {
        const result = await this.addDiagnosis(dischargeCodingId, diag, createdBy);
        results.push({ success: true, diagnosis: result });
      } catch (error: any) {
        results.push({ success: false, error: error.message, input: diag });
      }
    }

    return results;
  }

  /**
   * Update a diagnosis
   */
  async updateDiagnosis(diagnosisId: string, data: Partial<DischargeDiagnosisInput>) {
    const existing = await prisma.dischargeDiagnosis.findUnique({
      where: { id: diagnosisId },
      include: {
        dischargeCoding: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Diagnosis not found');
    }

    if (existing.dischargeCoding.status === 'FINALIZED' || existing.dischargeCoding.status === 'SUBMITTED') {
      throw new AppError('Cannot modify finalized or submitted coding', 400);
    }

    // If marking as primary, unset any existing primary
    if (data.isPrimary) {
      await prisma.dischargeDiagnosis.updateMany({
        where: { dischargeCodingId: existing.dischargeCodingId, isPrimary: true, id: { not: diagnosisId } },
        data: { isPrimary: false },
      });
    }

    const diagnosis = await prisma.dischargeDiagnosis.update({
      where: { id: diagnosisId },
      data: {
        sequenceNumber: data.sequenceNumber,
        isPrimary: data.isPrimary,
        isAdmitting: data.isAdmitting,
        diagnosisType: data.diagnosisType,
        presentOnAdmission: data.presentOnAdmission,
        notes: data.notes,
      },
      include: {
        icd10Code: {
          select: {
            id: true,
            code: true,
            description: true,
          },
        },
      },
    });

    return diagnosis;
  }

  /**
   * Remove a diagnosis from discharge coding
   */
  async removeDiagnosis(diagnosisId: string) {
    const existing = await prisma.dischargeDiagnosis.findUnique({
      where: { id: diagnosisId },
      include: {
        dischargeCoding: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Diagnosis not found');
    }

    if (existing.dischargeCoding.status === 'FINALIZED' || existing.dischargeCoding.status === 'SUBMITTED') {
      throw new AppError('Cannot modify finalized or submitted coding', 400);
    }

    await prisma.dischargeDiagnosis.delete({
      where: { id: diagnosisId },
    });

    return { deleted: true };
  }

  /**
   * Add a procedure to discharge coding
   */
  async addProcedure(dischargeCodingId: string, data: DischargeProcedureInput, createdBy?: string) {
    const coding = await prisma.dischargeCoding.findUnique({
      where: { id: dischargeCodingId },
    });

    if (!coding) {
      throw new NotFoundError('Discharge coding not found');
    }

    if (coding.status === 'FINALIZED' || coding.status === 'SUBMITTED') {
      throw new AppError('Cannot modify finalized or submitted coding', 400);
    }

    // Verify CPT code exists
    const cptCode = await prisma.cPTCode.findUnique({
      where: { id: data.cptCodeId },
    });
    if (!cptCode) {
      throw new NotFoundError('CPT code not found');
    }

    const procedure = await prisma.dischargeProcedure.create({
      data: {
        dischargeCodingId,
        cptCodeId: data.cptCodeId,
        modifiers: data.modifiers ?? [],
        units: data.units ?? 1,
        serviceDate: data.serviceDate,
        price: data.price,
        performedBy: data.performedBy,
        notes: data.notes,
        aiSuggested: data.aiSuggested ?? false,
        aiConfidence: data.aiConfidence,
        createdBy,
      },
      include: {
        cptCode: {
          select: {
            id: true,
            code: true,
            description: true,
            category: true,
            basePrice: true,
          },
        },
      },
    });

    // Update total charges
    await this.updateTotalCharges(dischargeCodingId);

    return procedure;
  }

  /**
   * Add multiple procedures to discharge coding
   */
  async addProcedures(dischargeCodingId: string, procedures: DischargeProcedureInput[], createdBy?: string) {
    const results = [];

    for (const proc of procedures) {
      try {
        const result = await this.addProcedure(dischargeCodingId, proc, createdBy);
        results.push({ success: true, procedure: result });
      } catch (error: any) {
        results.push({ success: false, error: error.message, input: proc });
      }
    }

    return results;
  }

  /**
   * Update a procedure
   */
  async updateProcedure(procedureId: string, data: Partial<DischargeProcedureInput>) {
    const existing = await prisma.dischargeProcedure.findUnique({
      where: { id: procedureId },
      include: {
        dischargeCoding: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Procedure not found');
    }

    if (existing.dischargeCoding.status === 'FINALIZED' || existing.dischargeCoding.status === 'SUBMITTED') {
      throw new AppError('Cannot modify finalized or submitted coding', 400);
    }

    const procedure = await prisma.dischargeProcedure.update({
      where: { id: procedureId },
      data: {
        modifiers: data.modifiers,
        units: data.units,
        serviceDate: data.serviceDate,
        price: data.price,
        performedBy: data.performedBy,
        notes: data.notes,
      },
      include: {
        cptCode: {
          select: {
            id: true,
            code: true,
            description: true,
          },
        },
      },
    });

    // Update total charges
    await this.updateTotalCharges(existing.dischargeCodingId);

    return procedure;
  }

  /**
   * Remove a procedure from discharge coding
   */
  async removeProcedure(procedureId: string) {
    const existing = await prisma.dischargeProcedure.findUnique({
      where: { id: procedureId },
      include: {
        dischargeCoding: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Procedure not found');
    }

    if (existing.dischargeCoding.status === 'FINALIZED' || existing.dischargeCoding.status === 'SUBMITTED') {
      throw new AppError('Cannot modify finalized or submitted coding', 400);
    }

    await prisma.dischargeProcedure.delete({
      where: { id: procedureId },
    });

    // Update total charges
    await this.updateTotalCharges(existing.dischargeCodingId);

    return { deleted: true };
  }

  /**
   * Update discharge coding status
   */
  async updateStatus(dischargeCodingId: string, status: DischargeCodingStatus, userId?: string) {
    const coding = await prisma.dischargeCoding.findUnique({
      where: { id: dischargeCodingId },
    });

    if (!coding) {
      throw new NotFoundError('Discharge coding not found');
    }

    // Validate status transitions
    const validTransitions: Record<DischargeCodingStatus, DischargeCodingStatus[]> = {
      DRAFT: ['PENDING_REVIEW'],
      PENDING_REVIEW: ['DRAFT', 'REVIEWED'],
      REVIEWED: ['PENDING_REVIEW', 'FINALIZED'],
      FINALIZED: ['SUBMITTED'],
      SUBMITTED: [],
    };

    if (!validTransitions[coding.status].includes(status)) {
      throw new AppError(`Cannot transition from ${coding.status} to ${status}`, 400);
    }

    const updateData: Prisma.DischargeCodingUpdateInput = { status };

    if (status === 'FINALIZED') {
      updateData.codingCompleteAt = new Date();
      updateData.codedBy = userId;
    }

    if (status === 'REVIEWED') {
      updateData.reviewedAt = new Date();
      updateData.reviewedBy = userId;
    }

    const updated = await prisma.dischargeCoding.update({
      where: { id: dischargeCodingId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Finalize discharge coding
   */
  async finalizeCoding(dischargeCodingId: string, userId?: string) {
    const coding = await this.getDischargeCodingById(dischargeCodingId);

    // Validate we have at least one primary diagnosis
    const hasPrimaryDiagnosis = coding.diagnoses.some((d: any) => d.isPrimary);
    if (!hasPrimaryDiagnosis && coding.diagnoses.length > 0) {
      throw new AppError('A primary diagnosis must be designated', 400);
    }

    // Update status to finalized
    await this.updateStatus(dischargeCodingId, 'FINALIZED', userId);

    return {
      finalized: true,
      dischargeCodingId,
      diagnosisCount: coding.diagnosisCount,
      procedureCount: coding.procedureCount,
      totalCharges: coding.totalCharges,
    };
  }

  /**
   * Generate claim from discharge coding
   */
  async generateClaim(dischargeCodingId: string) {
    const coding = await this.getDischargeCodingById(dischargeCodingId);

    if (coding.status !== 'FINALIZED') {
      throw new AppError('Coding must be finalized before generating claim', 400);
    }

    // TODO: Implement actual claim generation
    // This would generate the claim in the format required by the payer

    logger.info(`Claim generation requested for discharge coding ${dischargeCodingId}`);

    return {
      claimGenerated: true,
      dischargeCodingId,
      totalCharges: coding.totalCharges,
      diagnosisCount: coding.diagnosisCount,
      procedureCount: coding.procedureCount,
    };
  }

  /**
   * Get coding summary statistics for discharge
   */
  async getCodingSummary(dischargeCodingId: string) {
    const coding = await this.getDischargeCodingById(dischargeCodingId);

    const primaryDiagnosis = coding.diagnoses.find((d: any) => d.isPrimary);
    const admittingDiagnosis = coding.diagnoses.find((d: any) => d.isAdmitting);
    const aiSuggestedCount = [...coding.diagnoses, ...coding.procedures].filter(
      (item: any) => item.aiSuggested
    ).length;

    return {
      status: coding.status,
      diagnoses: {
        total: coding.diagnoses.length,
        primary: primaryDiagnosis
          ? {
              code: (primaryDiagnosis as any).icd10Code.code,
              description: (primaryDiagnosis as any).icd10Code.description,
            }
          : null,
        admitting: admittingDiagnosis
          ? {
              code: (admittingDiagnosis as any).icd10Code.code,
              description: (admittingDiagnosis as any).icd10Code.description,
            }
          : null,
        secondary: coding.diagnoses.filter((d: any) => !d.isPrimary && !d.isAdmitting).length,
      },
      procedures: {
        total: coding.procedures.length,
        totalCharges: coding.totalCharges,
        items: coding.procedures.map((p: any) => ({
          code: p.cptCode.code,
          description: p.cptCode.description,
          units: p.units,
          price: Number(p.price),
          lineTotal: Number(p.price) * p.units,
          serviceDate: p.serviceDate,
        })),
      },
      aiAssisted: {
        suggestedCount: aiSuggestedCount,
        percentage:
          coding.diagnoses.length + coding.procedures.length > 0
            ? (aiSuggestedCount / (coding.diagnoses.length + coding.procedures.length)) * 100
            : 0,
      },
      acceptancePrediction: coding.acceptancePrediction
        ? Number(coding.acceptancePrediction)
        : null,
    };
  }

  /**
   * Update total charges for discharge coding
   */
  private async updateTotalCharges(dischargeCodingId: string) {
    const procedures = await prisma.dischargeProcedure.findMany({
      where: { dischargeCodingId },
    });

    const totalCharges = procedures.reduce(
      (sum, proc) => sum + Number(proc.price) * proc.units,
      0
    );

    await prisma.dischargeCoding.update({
      where: { id: dischargeCodingId },
      data: { totalCharges },
    });
  }

  /**
   * Update acceptance prediction
   */
  async updateAcceptancePrediction(dischargeCodingId: string, prediction: number) {
    await prisma.dischargeCoding.update({
      where: { id: dischargeCodingId },
      data: { acceptancePrediction: prediction },
    });
  }

  /**
   * Get discharge codings for a hospital with filters
   */
  async getDischargeCodingsForHospital(
    hospitalId: string,
    params?: {
      status?: DischargeCodingStatus;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: Prisma.DischargeCodingWhereInput = {
      admission: {
        hospitalId,
      },
    };

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.fromDate || params?.toDate) {
      where.createdAt = {};
      if (params.fromDate) where.createdAt.gte = params.fromDate;
      if (params.toDate) where.createdAt.lte = params.toDate;
    }

    const [codings, total] = await Promise.all([
      prisma.dischargeCoding.findMany({
        where,
        include: {
          admission: {
            include: {
              patient: {
                select: {
                  firstName: true,
                  lastName: true,
                  mrn: true,
                },
              },
            },
          },
          _count: {
            select: {
              diagnoses: true,
              procedures: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: params?.limit ?? 50,
        skip: params?.offset ?? 0,
      }),
      prisma.dischargeCoding.count({ where }),
    ]);

    return {
      data: codings,
      total,
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
    };
  }
}

export const dischargeCodingService = new DischargeCodingService();
