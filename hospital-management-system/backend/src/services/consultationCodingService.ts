import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { DiagnosisType, Prisma } from '@prisma/client';
import logger from '../utils/logger';

export interface ConsultationDiagnosisInput {
  icd10CodeId: string;
  sequenceNumber?: number;
  isPrimary?: boolean;
  isAdmitting?: boolean;
  diagnosisType?: DiagnosisType;
  presentOnAdmission?: string;
  notes?: string;
  aiSuggested?: boolean;
  aiConfidence?: number;
}

export interface ConsultationProcedureInput {
  cptCodeId: string;
  modifiers?: string[];
  units?: number;
  serviceDate?: Date;
  price: number;
  notes?: string;
  aiSuggested?: boolean;
  aiConfidence?: number;
}

export class ConsultationCodingService {
  /**
   * Get all diagnoses for a consultation
   */
  async getDiagnoses(consultationId: string) {
    const diagnoses = await prisma.consultationDiagnosis.findMany({
      where: { consultationId },
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
    });

    return diagnoses;
  }

  /**
   * Get all procedures for a consultation
   */
  async getProcedures(consultationId: string) {
    const procedures = await prisma.consultationProcedure.findMany({
      where: { consultationId },
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
    });

    return procedures;
  }

  /**
   * Get full coding details for a consultation
   */
  async getCodingDetails(consultationId: string) {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
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
        doctor: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            specialization: true,
          },
        },
        appointment: {
          select: {
            id: true,
            appointmentDate: true,
            type: true,
          },
        },
        consultationDiagnoses: {
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
        consultationProcedures: {
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

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // Calculate total charges
    const totalCharges = consultation.consultationProcedures.reduce(
      (sum, proc) => sum + Number(proc.price) * proc.units,
      0
    );

    return {
      ...consultation,
      totalCharges,
      diagnosisCount: consultation.consultationDiagnoses.length,
      procedureCount: consultation.consultationProcedures.length,
    };
  }

  /**
   * Add a diagnosis to a consultation
   */
  async addDiagnosis(consultationId: string, data: ConsultationDiagnosisInput, createdBy?: string) {
    // Verify consultation exists
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    if (!consultation) {
      throw new NotFoundError('Consultation not found');
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
      await prisma.consultationDiagnosis.updateMany({
        where: { consultationId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Determine sequence number if not provided
    let sequenceNumber = data.sequenceNumber;
    if (!sequenceNumber) {
      const lastDiagnosis = await prisma.consultationDiagnosis.findFirst({
        where: { consultationId },
        orderBy: { sequenceNumber: 'desc' },
      });
      sequenceNumber = (lastDiagnosis?.sequenceNumber || 0) + 1;
    }

    const diagnosis = await prisma.consultationDiagnosis.create({
      data: {
        consultationId,
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

    // Also update the consultation's icdCodes array for backwards compatibility
    await this.syncLegacyIcdCodes(consultationId);

    return diagnosis;
  }

  /**
   * Add multiple diagnoses to a consultation
   */
  async addDiagnoses(consultationId: string, diagnoses: ConsultationDiagnosisInput[], createdBy?: string) {
    const results = [];

    for (const diag of diagnoses) {
      try {
        const result = await this.addDiagnosis(consultationId, diag, createdBy);
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
  async updateDiagnosis(diagnosisId: string, data: Partial<ConsultationDiagnosisInput>) {
    const existing = await prisma.consultationDiagnosis.findUnique({
      where: { id: diagnosisId },
    });

    if (!existing) {
      throw new NotFoundError('Diagnosis not found');
    }

    // If marking as primary, unset any existing primary
    if (data.isPrimary) {
      await prisma.consultationDiagnosis.updateMany({
        where: { consultationId: existing.consultationId, isPrimary: true, id: { not: diagnosisId } },
        data: { isPrimary: false },
      });
    }

    const diagnosis = await prisma.consultationDiagnosis.update({
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

    // Sync legacy codes
    await this.syncLegacyIcdCodes(existing.consultationId);

    return diagnosis;
  }

  /**
   * Remove a diagnosis from a consultation
   */
  async removeDiagnosis(diagnosisId: string) {
    const existing = await prisma.consultationDiagnosis.findUnique({
      where: { id: diagnosisId },
    });

    if (!existing) {
      throw new NotFoundError('Diagnosis not found');
    }

    await prisma.consultationDiagnosis.delete({
      where: { id: diagnosisId },
    });

    // Sync legacy codes
    await this.syncLegacyIcdCodes(existing.consultationId);

    return { deleted: true };
  }

  /**
   * Add a procedure to a consultation
   */
  async addProcedure(consultationId: string, data: ConsultationProcedureInput, createdBy?: string) {
    // Verify consultation exists
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // Verify CPT code exists
    const cptCode = await prisma.cPTCode.findUnique({
      where: { id: data.cptCodeId },
    });
    if (!cptCode) {
      throw new NotFoundError('CPT code not found');
    }

    const procedure = await prisma.consultationProcedure.create({
      data: {
        consultationId,
        cptCodeId: data.cptCodeId,
        modifiers: data.modifiers ?? [],
        units: data.units ?? 1,
        serviceDate: data.serviceDate ?? new Date(),
        price: data.price,
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

    return procedure;
  }

  /**
   * Add multiple procedures to a consultation
   */
  async addProcedures(consultationId: string, procedures: ConsultationProcedureInput[], createdBy?: string) {
    const results = [];

    for (const proc of procedures) {
      try {
        const result = await this.addProcedure(consultationId, proc, createdBy);
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
  async updateProcedure(procedureId: string, data: Partial<ConsultationProcedureInput>) {
    const existing = await prisma.consultationProcedure.findUnique({
      where: { id: procedureId },
    });

    if (!existing) {
      throw new NotFoundError('Procedure not found');
    }

    const procedure = await prisma.consultationProcedure.update({
      where: { id: procedureId },
      data: {
        modifiers: data.modifiers,
        units: data.units,
        serviceDate: data.serviceDate,
        price: data.price,
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

    return procedure;
  }

  /**
   * Remove a procedure from a consultation
   */
  async removeProcedure(procedureId: string) {
    const existing = await prisma.consultationProcedure.findUnique({
      where: { id: procedureId },
    });

    if (!existing) {
      throw new NotFoundError('Procedure not found');
    }

    await prisma.consultationProcedure.delete({
      where: { id: procedureId },
    });

    return { deleted: true };
  }

  /**
   * Finalize coding for a consultation and optionally generate invoice
   */
  async finalizeCoding(consultationId: string, options?: { generateInvoice?: boolean }) {
    const coding = await this.getCodingDetails(consultationId);

    // Validate we have at least one primary diagnosis
    const hasPrimaryDiagnosis = coding.consultationDiagnoses.some((d: any) => d.isPrimary);
    if (!hasPrimaryDiagnosis && coding.consultationDiagnoses.length > 0) {
      // Auto-set first diagnosis as primary if none set
      await prisma.consultationDiagnosis.update({
        where: { id: coding.consultationDiagnoses[0].id },
        data: { isPrimary: true },
      });
    }

    // Sync legacy codes
    await this.syncLegacyIcdCodes(consultationId);

    // TODO: Generate invoice if requested
    if (options?.generateInvoice) {
      logger.info(`Invoice generation requested for consultation ${consultationId}`);
      // Invoice generation logic would go here
    }

    return {
      finalized: true,
      consultationId,
      diagnosisCount: coding.diagnosisCount,
      procedureCount: coding.procedureCount,
      totalCharges: coding.totalCharges,
    };
  }

  /**
   * Get coding summary statistics for a consultation
   */
  async getCodingSummary(consultationId: string) {
    const [diagnoses, procedures] = await Promise.all([
      prisma.consultationDiagnosis.findMany({
        where: { consultationId },
        include: {
          icd10Code: {
            select: { code: true, description: true },
          },
        },
      }),
      prisma.consultationProcedure.findMany({
        where: { consultationId },
        include: {
          cptCode: {
            select: { code: true, description: true, basePrice: true },
          },
        },
      }),
    ]);

    const primaryDiagnosis = diagnoses.find((d) => d.isPrimary);
    const totalCharges = procedures.reduce(
      (sum, p) => sum + Number(p.price) * p.units,
      0
    );
    const aiSuggestedCount = [...diagnoses, ...procedures].filter((item) => item.aiSuggested).length;

    return {
      diagnoses: {
        total: diagnoses.length,
        primary: primaryDiagnosis
          ? {
              code: primaryDiagnosis.icd10Code.code,
              description: primaryDiagnosis.icd10Code.description,
            }
          : null,
        secondary: diagnoses.filter((d) => !d.isPrimary).length,
      },
      procedures: {
        total: procedures.length,
        totalCharges,
        items: procedures.map((p) => ({
          code: p.cptCode.code,
          description: p.cptCode.description,
          units: p.units,
          price: Number(p.price),
          lineTotal: Number(p.price) * p.units,
        })),
      },
      aiAssisted: {
        suggestedCount: aiSuggestedCount,
        percentage: diagnoses.length + procedures.length > 0
          ? (aiSuggestedCount / (diagnoses.length + procedures.length)) * 100
          : 0,
      },
    };
  }

  /**
   * Sync consultation's legacy icdCodes array from consultationDiagnoses
   */
  private async syncLegacyIcdCodes(consultationId: string) {
    const diagnoses = await prisma.consultationDiagnosis.findMany({
      where: { consultationId },
      include: {
        icd10Code: {
          select: { code: true },
        },
      },
      orderBy: { sequenceNumber: 'asc' },
    });

    const icdCodes = diagnoses.map((d) => d.icd10Code.code);

    await prisma.consultation.update({
      where: { id: consultationId },
      data: { icdCodes },
    });
  }
}

export const consultationCodingService = new ConsultationCodingService();
