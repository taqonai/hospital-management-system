import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * eClaimLink Preparation Service
 *
 * Handles preparation of insurance claims for DHA eClaimLink submission.
 * Note: Actual API integration with eClaimLink is deferred to a future phase.
 * This service focuses on data mapping and XML generation.
 */

interface ClaimHeader {
  claimId: string;
  payerId: string;
  payerName: string;
  memberId: string;
  patientFileNo: string;
  idPayer: string;
  providerLicenseNo: string;
  providerName: string;
  clinicianLicense: string;
  claimType: 'OPD' | 'IPD';
  dateOfService: Date;
  primaryDiagnosis: string;
  secondaryDiagnoses: string[];
  grossAmount: number;
  netAmount: number;
}

interface ClaimActivity {
  activityId: string;
  activityCode: string; // CPT code
  activityType: 'CPT' | 'DRUG' | 'OTHER';
  startDate: Date;
  quantity: number;
  unitPrice: number;
  netAmount: number;
  clinicianLicense: string;
  priorAuthId?: string;
  modifiers?: string[];
}

interface ClaimDiagnosis {
  diagnosisCode: string;
  type: 'Principal' | 'Secondary';
  dxInfoType?: string; // POA indicator
}

interface EClaimData {
  header: ClaimHeader;
  diagnoses: ClaimDiagnosis[];
  activities: ClaimActivity[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class EClaimLinkService {
  /**
   * Generate eClaimLink-compatible XML for a consultation (OPD)
   */
  async generateConsultationClaimXML(consultationId: string): Promise<string> {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        appointment: {
          include: {
            patient: {
              include: {
                insurances: true,
              },
            },
            doctor: true,
            hospital: true,
          },
        },
        consultationDiagnoses: {
          include: {
            icd10Code: true,
          },
          orderBy: { sequenceNumber: 'asc' },
        },
        consultationProcedures: {
          include: {
            cptCode: true,
          },
        },
      },
    });

    if (!consultation) {
      throw new Error(`Consultation not found: ${consultationId}`);
    }

    const claimData = this.mapConsultationToClaimData(consultation);
    const validation = this.validateClaimData(claimData);

    if (!validation.isValid) {
      throw new Error(`Claim validation failed: ${validation.errors.join(', ')}`);
    }

    return this.generateXML(claimData);
  }

  /**
   * Generate eClaimLink-compatible XML for a discharge coding (IPD)
   */
  async generateDischargeCodingClaimXML(dischargeCodingId: string): Promise<string> {
    const dischargeCoding = await prisma.dischargeCoding.findUnique({
      where: { id: dischargeCodingId },
      include: {
        admission: {
          include: {
            patient: {
              include: {
                insurances: true,
              },
            },
            hospital: true,
          },
        },
        diagnoses: {
          include: {
            icd10Code: true,
          },
          orderBy: { sequenceNumber: 'asc' },
        },
        procedures: {
          include: {
            cptCode: true,
          },
        },
      },
    });

    if (!dischargeCoding) {
      throw new Error(`Discharge coding not found: ${dischargeCodingId}`);
    }

    const claimData = this.mapDischargeCodingToClaimData(dischargeCoding);
    const validation = this.validateClaimData(claimData);

    if (!validation.isValid) {
      throw new Error(`Claim validation failed: ${validation.errors.join(', ')}`);
    }

    return this.generateXML(claimData);
  }

  /**
   * Generate claim XML from an invoice
   */
  async generateInvoiceClaimXML(invoiceId: string): Promise<string> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        patient: {
          include: {
            insurances: true,
          },
        },
        hospital: true,
        items: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // Try to get consultation data if available
    const consultation = await prisma.consultation.findFirst({
      where: {
        appointment: {
          patientId: invoice.patientId,
        },
      },
      include: {
        appointment: {
          include: {
            doctor: true,
          },
        },
        consultationDiagnoses: {
          include: {
            icd10Code: true,
          },
        },
        consultationProcedures: {
          include: {
            cptCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const claimData = this.mapInvoiceToClaimData(invoice, consultation);
    const validation = this.validateClaimData(claimData);

    if (!validation.isValid) {
      throw new Error(`Claim validation failed: ${validation.errors.join(', ')}`);
    }

    return this.generateXML(claimData);
  }

  /**
   * Map consultation data to eClaimLink format
   */
  private mapConsultationToClaimData(consultation: any): EClaimData {
    const patient = consultation.appointment.patient;
    const doctor = consultation.appointment.doctor;
    const hospital = consultation.appointment.hospital;
    const insurance = patient.insurances?.[0];

    const primaryDiagnosis = consultation.consultationDiagnoses.find((d: any) => d.isPrimary);
    const secondaryDiagnoses = consultation.consultationDiagnoses.filter((d: any) => !d.isPrimary);

    const totalAmount = consultation.consultationProcedures.reduce(
      (sum: number, proc: any) => sum + Number(proc.price) * proc.units,
      0
    );

    return {
      header: {
        claimId: `OPD-${consultation.id.slice(0, 8).toUpperCase()}`,
        payerId: insurance?.insuranceProvider || 'UNKNOWN',
        payerName: insurance?.insuranceProvider || 'Unknown Payer',
        memberId: insurance?.policyNumber || 'UNKNOWN',
        patientFileNo: patient.mrn || patient.id,
        idPayer: insurance?.insuranceProvider || 'UNKNOWN',
        providerLicenseNo: hospital.id,
        providerName: hospital.name,
        clinicianLicense: doctor.licenseNumber || doctor.id,
        claimType: 'OPD',
        dateOfService: new Date(consultation.createdAt),
        primaryDiagnosis: primaryDiagnosis?.icd10Code.code || 'Z00.00',
        secondaryDiagnoses: secondaryDiagnoses.map((d: any) => d.icd10Code.code),
        grossAmount: totalAmount,
        netAmount: totalAmount,
      },
      diagnoses: consultation.consultationDiagnoses.map((d: any) => ({
        diagnosisCode: d.icd10Code.code,
        type: d.isPrimary ? 'Principal' : 'Secondary',
        dxInfoType: d.presentOnAdmission,
      })),
      activities: consultation.consultationProcedures.map((proc: any, idx: number) => ({
        activityId: `ACT-${idx + 1}`,
        activityCode: proc.cptCode.code,
        activityType: 'CPT' as const,
        startDate: new Date(proc.serviceDate),
        quantity: proc.units,
        unitPrice: Number(proc.price),
        netAmount: Number(proc.price) * proc.units,
        clinicianLicense: doctor.licenseNumber || doctor.id,
        modifiers: proc.modifiers,
      })),
    };
  }

  /**
   * Map discharge coding data to eClaimLink format
   */
  private mapDischargeCodingToClaimData(dischargeCoding: any): EClaimData {
    const admission = dischargeCoding.admission;
    const patient = admission.patient;
    const hospital = admission.hospital;
    const insurance = patient.insurances?.[0];
    // Use admittingDoctorId as clinician license since there's no direct relation
    const clinicianLicense = admission.admittingDoctorId || 'UNKNOWN';

    const primaryDiagnosis = dischargeCoding.diagnoses.find((d: any) => d.isPrimary);
    const secondaryDiagnoses = dischargeCoding.diagnoses.filter((d: any) => !d.isPrimary);

    return {
      header: {
        claimId: `IPD-${dischargeCoding.id.slice(0, 8).toUpperCase()}`,
        payerId: insurance?.insuranceProvider || 'UNKNOWN',
        payerName: insurance?.insuranceProvider || 'Unknown Payer',
        memberId: insurance?.policyNumber || 'UNKNOWN',
        patientFileNo: patient.mrn || patient.id,
        idPayer: insurance?.insuranceProvider || 'UNKNOWN',
        providerLicenseNo: hospital.id,
        providerName: hospital.name,
        clinicianLicense,
        claimType: 'IPD',
        dateOfService: new Date(admission.admissionDate),
        primaryDiagnosis: primaryDiagnosis?.icd10Code.code || 'Z00.00',
        secondaryDiagnoses: secondaryDiagnoses.map((d: any) => d.icd10Code.code),
        grossAmount: Number(dischargeCoding.totalCharges || 0),
        netAmount: Number(dischargeCoding.totalCharges || 0),
      },
      diagnoses: dischargeCoding.diagnoses.map((d: any) => ({
        diagnosisCode: d.icd10Code.code,
        type: d.isPrimary ? 'Principal' : 'Secondary',
        dxInfoType: d.presentOnAdmission,
      })),
      activities: dischargeCoding.procedures.map((proc: any, idx: number) => ({
        activityId: `ACT-${idx + 1}`,
        activityCode: proc.cptCode.code,
        activityType: 'CPT' as const,
        startDate: new Date(proc.procedureDate || admission.admissionDate),
        quantity: proc.units,
        unitPrice: Number(proc.price),
        netAmount: Number(proc.price) * proc.units,
        clinicianLicense,
        modifiers: proc.modifiers,
      })),
    };
  }

  /**
   * Map invoice data to eClaimLink format
   */
  private mapInvoiceToClaimData(invoice: any, consultation: any = null): EClaimData {
    const patient = invoice.patient;
    const hospital = invoice.hospital;
    const insurance = patient.insurances?.[0];
    const doctor = consultation?.appointment?.doctor;

    const diagnoses = consultation?.consultationDiagnoses || [];
    const procedures = consultation?.consultationProcedures || [];

    const primaryDiagnosis = diagnoses.find((d: any) => d.isPrimary);
    const secondaryDiagnoses = diagnoses.filter((d: any) => !d.isPrimary);

    return {
      header: {
        claimId: `INV-${invoice.invoiceNumber}`,
        payerId: insurance?.insuranceProvider || 'UNKNOWN',
        payerName: insurance?.insuranceProvider || 'Unknown Payer',
        memberId: insurance?.policyNumber || 'UNKNOWN',
        patientFileNo: patient.mrn || patient.id,
        idPayer: insurance?.insuranceProvider || 'UNKNOWN',
        providerLicenseNo: hospital.id,
        providerName: hospital.name,
        clinicianLicense: doctor?.licenseNumber || doctor?.id || 'UNKNOWN',
        claimType: 'OPD',
        dateOfService: new Date(invoice.invoiceDate),
        primaryDiagnosis: primaryDiagnosis?.icd10Code?.code || 'Z00.00',
        secondaryDiagnoses: secondaryDiagnoses.map((d: any) => d.icd10Code?.code),
        grossAmount: Number(invoice.totalAmount),
        netAmount: Number(invoice.totalAmount) - Number(invoice.discount),
      },
      diagnoses: diagnoses.map((d: any) => ({
        diagnosisCode: d.icd10Code?.code || 'Z00.00',
        type: d.isPrimary ? 'Principal' : 'Secondary',
      })),
      activities: procedures.length > 0
        ? procedures.map((proc: any, idx: number) => ({
            activityId: `ACT-${idx + 1}`,
            activityCode: proc.cptCode?.code || '99213',
            activityType: 'CPT' as const,
            startDate: new Date(proc.serviceDate || invoice.invoiceDate),
            quantity: proc.units || 1,
            unitPrice: Number(proc.price || 0),
            netAmount: Number(proc.price || 0) * (proc.units || 1),
            clinicianLicense: doctor?.licenseNumber || doctor?.id || 'UNKNOWN',
            modifiers: proc.modifiers,
          }))
        : invoice.items.map((item: any, idx: number) => ({
            activityId: `ACT-${idx + 1}`,
            activityCode: '99213', // Default E&M code if no CPT
            activityType: 'OTHER' as const,
            startDate: new Date(invoice.invoiceDate),
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            netAmount: Number(item.totalPrice),
            clinicianLicense: 'UNKNOWN',
          })),
    };
  }

  /**
   * Validate claim data before XML generation
   */
  validateClaimData(claimData: EClaimData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required header fields
    if (!claimData.header.claimId) errors.push('Claim ID is required');
    if (!claimData.header.payerId || claimData.header.payerId === 'UNKNOWN') {
      errors.push('Payer ID is required');
    }
    if (!claimData.header.memberId || claimData.header.memberId === 'UNKNOWN') {
      errors.push('Member ID (policy number) is required');
    }
    if (!claimData.header.primaryDiagnosis) errors.push('Primary diagnosis is required');
    if (claimData.header.primaryDiagnosis === 'Z00.00') {
      warnings.push('Using default diagnosis code Z00.00 - please specify actual diagnosis');
    }

    // Activities validation
    if (claimData.activities.length === 0) {
      errors.push('At least one activity (procedure) is required');
    }

    claimData.activities.forEach((activity, idx) => {
      if (!activity.activityCode) {
        errors.push(`Activity ${idx + 1}: CPT code is required`);
      }
      if (activity.quantity <= 0) {
        errors.push(`Activity ${idx + 1}: Quantity must be positive`);
      }
      if (activity.unitPrice <= 0) {
        warnings.push(`Activity ${idx + 1}: Unit price is zero or negative`);
      }
    });

    // Diagnoses validation
    const hasPrincipal = claimData.diagnoses.some((d) => d.type === 'Principal');
    if (!hasPrincipal) {
      errors.push('At least one principal diagnosis is required');
    }

    // Amount validation
    if (claimData.header.netAmount <= 0) {
      errors.push('Net claim amount must be positive');
    }

    // Provider validation
    if (!claimData.header.providerLicenseNo) {
      warnings.push('Provider license number is missing');
    }
    if (!claimData.header.clinicianLicense || claimData.header.clinicianLicense === 'UNKNOWN') {
      warnings.push('Clinician license number is missing');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate DHA eClaimLink-compatible XML
   */
  private generateXML(claimData: EClaimData): string {
    const { header, diagnoses, activities } = claimData;

    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    const formatDateTime = (date: Date) => {
      return date.toISOString().replace('T', ' ').slice(0, 19);
    };

    const escapeXml = (str: string) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const diagnosesXml = diagnoses
      .map(
        (d) => `
      <Diagnosis>
        <Type>${d.type}</Type>
        <Code>${escapeXml(d.diagnosisCode)}</Code>
        ${d.dxInfoType ? `<DxInfoType>${escapeXml(d.dxInfoType)}</DxInfoType>` : ''}
      </Diagnosis>`
      )
      .join('');

    const activitiesXml = activities
      .map(
        (a) => `
      <Activity>
        <ID>${escapeXml(a.activityId)}</ID>
        <Start>${formatDateTime(a.startDate)}</Start>
        <Type>${a.activityType}</Type>
        <Code>${escapeXml(a.activityCode)}</Code>
        ${a.modifiers?.length ? `<Modifier>${a.modifiers.join(',')}</Modifier>` : ''}
        <Quantity>${a.quantity}</Quantity>
        <Net>${a.netAmount.toFixed(2)}</Net>
        <Clinician>${escapeXml(a.clinicianLicense)}</Clinician>
        ${a.priorAuthId ? `<PriorAuthorizationID>${escapeXml(a.priorAuthId)}</PriorAuthorizationID>` : ''}
      </Activity>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Claim xmlns="http://dha.gov.ae/schema/eclaimlink" version="1.0">
  <Header>
    <SenderID>${escapeXml(header.providerLicenseNo)}</SenderID>
    <ReceiverID>${escapeXml(header.payerId)}</ReceiverID>
    <TransactionDate>${formatDateTime(new Date())}</TransactionDate>
  </Header>
  <Claim>
    <ID>${escapeXml(header.claimId)}</ID>
    <MemberID>${escapeXml(header.memberId)}</MemberID>
    <PayerID>${escapeXml(header.payerId)}</PayerID>
    <ProviderID>${escapeXml(header.providerLicenseNo)}</ProviderID>
    <EmiratesIDNumber></EmiratesIDNumber>
    <Gross>${header.grossAmount.toFixed(2)}</Gross>
    <PatientShare>0.00</PatientShare>
    <Net>${header.netAmount.toFixed(2)}</Net>
    <Encounter>
      <FacilityID>${escapeXml(header.providerLicenseNo)}</FacilityID>
      <Type>${header.claimType === 'IPD' ? '2' : '1'}</Type>
      <PatientID>${escapeXml(header.patientFileNo)}</PatientID>
      <Start>${formatDateTime(header.dateOfService)}</Start>
      <End>${formatDateTime(header.dateOfService)}</End>
      <StartType>1</StartType>
      <EndType>1</EndType>
    </Encounter>
    <Diagnosis>${diagnosesXml}
    </Diagnosis>
    <Activity>${activitiesXml}
    </Activity>
  </Claim>
</Claim>`;
  }

  /**
   * Validate and preview claim without generating full XML
   */
  async previewClaim(
    type: 'consultation' | 'discharge' | 'invoice',
    id: string
  ): Promise<{ claimData: EClaimData; validation: ValidationResult }> {
    let claimData: EClaimData;

    switch (type) {
      case 'consultation': {
        const consultation = await prisma.consultation.findUnique({
          where: { id },
          include: {
            appointment: {
              include: {
                patient: { include: { insurances: true } },
                doctor: true,
                hospital: true,
              },
            },
            consultationDiagnoses: { include: { icd10Code: true } },
            consultationProcedures: { include: { cptCode: true } },
          },
        });
        if (!consultation) throw new Error(`Consultation not found: ${id}`);
        claimData = this.mapConsultationToClaimData(consultation);
        break;
      }
      case 'discharge': {
        const dischargeCoding = await prisma.dischargeCoding.findUnique({
          where: { id },
          include: {
            admission: {
              include: {
                patient: { include: { insurances: true } },
                hospital: true,
              },
            },
            diagnoses: { include: { icd10Code: true } },
            procedures: { include: { cptCode: true } },
          },
        });
        if (!dischargeCoding) throw new Error(`Discharge coding not found: ${id}`);
        claimData = this.mapDischargeCodingToClaimData(dischargeCoding);
        break;
      }
      case 'invoice': {
        const invoice = await prisma.invoice.findUnique({
          where: { id },
          include: {
            patient: { include: { insurances: true } },
            hospital: true,
            items: true,
          },
        });
        if (!invoice) throw new Error(`Invoice not found: ${id}`);
        claimData = this.mapInvoiceToClaimData(invoice);
        break;
      }
      default:
        throw new Error(`Unknown claim type: ${type}`);
    }

    const validation = this.validateClaimData(claimData);
    return { claimData, validation };
  }

  /**
   * Batch generate claims for multiple consultations
   */
  async batchGenerateConsultationClaims(consultationIds: string[]): Promise<Array<{
    consultationId: string;
    success: boolean;
    xml?: string;
    error?: string;
  }>> {
    const results = [];

    for (const id of consultationIds) {
      try {
        const xml = await this.generateConsultationClaimXML(id);
        results.push({ consultationId: id, success: true, xml });
      } catch (error: any) {
        logger.error(`Failed to generate claim for consultation ${id}:`, error);
        results.push({ consultationId: id, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get pending consultations that need claims generated
   */
  async getPendingConsultationsForClaims(hospitalId: string, options: {
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  } = {}): Promise<any[]> {
    const where: any = {
      appointment: {
        hospitalId,
        patient: {
          insurances: {
            some: {},
          },
        },
      },
      consultationDiagnoses: {
        some: {},
      },
      consultationProcedures: {
        some: {},
      },
    };

    if (options.fromDate) {
      where.createdAt = { ...where.createdAt, gte: options.fromDate };
    }
    if (options.toDate) {
      where.createdAt = { ...where.createdAt, lte: options.toDate };
    }

    return prisma.consultation.findMany({
      where,
      include: {
        appointment: {
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                mrn: true,
              },
            },
            doctor: {
              select: {
                id: true,
                licenseNumber: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        consultationDiagnoses: {
          include: { icd10Code: true },
          take: 3,
        },
        consultationProcedures: {
          include: { cptCode: true },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
    });
  }
}

export const eclaimLinkService = new EClaimLinkService();
