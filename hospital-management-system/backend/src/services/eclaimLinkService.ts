import prisma from '../config/database';
import logger from '../utils/logger';
import axios, { AxiosInstance } from 'axios';

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
  private apiClient: AxiosInstance;
  private readonly mode: 'sandbox' | 'production';
  private readonly baseURL: string;
  private readonly username: string;
  private readonly password: string;
  private readonly facilityCode: string;

  constructor() {
    // Configuration from environment variables
    this.mode = (process.env.DHA_ECLAIM_MODE as 'sandbox' | 'production') || 'sandbox';
    
    if (this.mode === 'sandbox') {
      this.baseURL = process.env.DHA_ECLAIM_SANDBOX_URL || 'https://sandbox.eclaimlink.ae/api/v1';
    } else {
      this.baseURL = process.env.DHA_ECLAIM_API_URL || 'https://eclaimlink.ae/api/v1';
    }

    this.username = process.env.DHA_ECLAIM_USERNAME || '';
    this.password = process.env.DHA_ECLAIM_PASSWORD || '';
    this.facilityCode = process.env.DHA_ECLAIM_FACILITY_CODE || '';

    // Initialize axios client
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: parseInt(process.env.DHA_ECLAIM_TIMEOUT_MS || '30000'),
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.apiClient.interceptors.request.use((config) => {
      // TODO: Implement actual DHA authentication mechanism
      // This might be Basic Auth, API key, or OAuth depending on DHA requirements
      if (this.username && this.password) {
        const authToken = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        config.headers.Authorization = `Basic ${authToken}`;
      }
      return config;
    });

    // Add response interceptor for logging
    this.apiClient.interceptors.response.use(
      (response) => {
        logger.info('[DHA eClaimLink] API Response:', {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error) => {
        logger.error('[DHA eClaimLink] API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );

    logger.info(`[DHA eClaimLink] Initialized in ${this.mode} mode`, {
      baseURL: this.baseURL,
    });
  }

  /**
   * Submit claim to DHA eClaimLink API
   * TODO: Update endpoint path and request format based on actual DHA API documentation
   */
  private async submitClaimToAPI(claimXML: string, claimNumber: string): Promise<{
    success: boolean;
    claimId?: string;
    response?: any;
    error?: string;
  }> {
    if (this.mode === 'sandbox') {
      // Mock response for sandbox mode
      logger.info('[DHA eClaimLink SANDBOX] Mock submission:', { claimNumber });
      return {
        success: true,
        claimId: `MOCK-${claimNumber}-${Date.now()}`,
        response: {
          status: 'ACCEPTED',
          message: 'Claim accepted (sandbox mode)',
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      // TODO: Update endpoint path when actual DHA documentation is available
      // Example endpoint: '/claims/submit' or '/v1/submit-claim'
      const response = await this.apiClient.post('/claims/submit', claimXML);

      return {
        success: response.data.success || response.status === 200,
        claimId: response.data.claimId || response.data.transactionId,
        response: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        response: error.response?.data,
      };
    }
  }

  /**
   * Check claim status from DHA eClaimLink API
   * TODO: Update endpoint path and response format based on actual DHA API documentation
   */
  private async checkClaimStatusFromAPI(dhaClaimId: string): Promise<{
    status: string;
    approvedAmount?: number;
    rejectionReason?: string;
    response?: any;
  }> {
    if (this.mode === 'sandbox') {
      // Mock response for sandbox mode
      logger.info('[DHA eClaimLink SANDBOX] Mock status check:', { dhaClaimId });
      return {
        status: 'APPROVED',
        approvedAmount: 1000.00,
        response: {
          status: 'APPROVED',
          message: 'Claim approved (sandbox mode)',
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      // TODO: Update endpoint path when actual DHA documentation is available
      // Example endpoint: '/claims/status/{claimId}' or '/v1/check-status'
      const response = await this.apiClient.get(`/claims/status/${dhaClaimId}`);

      return {
        status: response.data.status || 'UNKNOWN',
        approvedAmount: response.data.approvedAmount,
        rejectionReason: response.data.rejectionReason,
        response: response.data,
      };
    } catch (error: any) {
      logger.error('[DHA eClaimLink] Status check failed:', error);
      return {
        status: 'ERROR',
        response: error.response?.data,
      };
    }
  }

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
   * Generate DHA eClaimLink-compatible XML (full 837 professional/institutional format)
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

    // Generate Diagnosis XML (HL7/X12 837 format)
    const diagnosesXml = diagnoses
      .map(
        (d, index) => `
      <Diagnosis>
        <Sequence>${index + 1}</Sequence>
        <Type>${d.type}</Type>
        <Code>${escapeXml(d.diagnosisCode)}</Code>
        <CodeType>ICD10</CodeType>
        ${d.dxInfoType ? `<DxInfoType>${escapeXml(d.dxInfoType)}</DxInfoType>` : ''}
      </Diagnosis>`
      )
      .join('');

    // Generate Activity XML (procedures/services)
    const activitiesXml = activities
      .map(
        (a) => `
      <Activity>
        <ID>${escapeXml(a.activityId)}</ID>
        <Start>${formatDateTime(a.startDate)}</Start>
        <Type>${a.activityType}</Type>
        <Code>${escapeXml(a.activityCode)}</Code>
        <CodeType>CPT</CodeType>
        ${a.modifiers?.length ? `<Modifier>${a.modifiers.join(',')}</Modifier>` : ''}
        <Quantity>${a.quantity}</Quantity>
        <UnitPrice>${a.unitPrice.toFixed(2)}</UnitPrice>
        <Net>${a.netAmount.toFixed(2)}</Net>
        <Clinician>
          <LicenseNo>${escapeXml(a.clinicianLicense)}</LicenseNo>
        </Clinician>
        ${a.priorAuthId ? `<PriorAuthorizationID>${escapeXml(a.priorAuthId)}</PriorAuthorizationID>` : ''}
      </Activity>`
      )
      .join('');

    // Generate Observations XML (vitals, lab results, etc.)
    const observationsXml = `
      <Observation>
        <ObservationType>CHIEF_COMPLAINT</ObservationType>
        <Value>As documented in consultation</Value>
      </Observation>`;

    // Full DHA eClaimLink XML structure (based on HL7/X12 837)
    return `<?xml version="1.0" encoding="UTF-8"?>
<Claim.Submission xmlns="http://dha.gov.ae/schema/eclaimlink" version="2.0">
  <Claim.Header>
    <SenderID>${escapeXml(header.providerLicenseNo)}</SenderID>
    <ReceiverID>${escapeXml(header.payerId)}</ReceiverID>
    <TransactionDate>${formatDateTime(new Date())}</TransactionDate>
    <TransactionID>${escapeXml(header.claimId)}</TransactionID>
    <TradingPartnerServiceID>${escapeXml(this.facilityCode)}</TradingPartnerServiceID>
  </Claim.Header>
  <Claim>
    <ClaimInfo>
      <ClaimID>${escapeXml(header.claimId)}</ClaimID>
      <ClaimType>${header.claimType}</ClaimType>
      <FilingIndicatorCode>MC</FilingIndicatorCode>
      <SubmissionDate>${formatDate(new Date())}</SubmissionDate>
    </ClaimInfo>
    <Payer>
      <PayerID>${escapeXml(header.payerId)}</PayerID>
      <PayerName>${escapeXml(header.payerName)}</PayerName>
    </Payer>
    <Provider>
      <ProviderID>${escapeXml(header.providerLicenseNo)}</ProviderID>
      <ProviderName>${escapeXml(header.providerName)}</ProviderName>
      <TaxID>${escapeXml(this.facilityCode)}</TaxID>
    </Provider>
    <Subscriber>
      <MemberID>${escapeXml(header.memberId)}</MemberID>
      <PolicyNumber>${escapeXml(header.idPayer)}</PolicyNumber>
    </Subscriber>
    <Patient>
      <PatientFileNo>${escapeXml(header.patientFileNo)}</PatientFileNo>
      <EmiratesIDNumber></EmiratesIDNumber>
      <Relationship>SELF</Relationship>
    </Patient>
    <ClaimCharges>
      <GrossAmount>${header.grossAmount.toFixed(2)}</GrossAmount>
      <PatientShare>0.00</PatientShare>
      <NetAmount>${header.netAmount.toFixed(2)}</NetAmount>
      <Currency>AED</Currency>
    </ClaimCharges>
    <Encounter>
      <FacilityID>${escapeXml(header.providerLicenseNo)}</FacilityID>
      <EncounterType>${header.claimType === 'IPD' ? '2' : '1'}</EncounterType>
      <EncounterTypeDescription>${header.claimType === 'IPD' ? 'INPATIENT' : 'OUTPATIENT'}</EncounterTypeDescription>
      <PatientAccountNo>${escapeXml(header.patientFileNo)}</PatientAccountNo>
      <AdmissionDate>${formatDateTime(header.dateOfService)}</AdmissionDate>
      <DischargeDate>${formatDateTime(header.dateOfService)}</DischargeDate>
      <AdmissionType>1</AdmissionType>
      <DischargeStatus>1</DischargeStatus>
    </Encounter>
    <Diagnosis.List>${diagnosesXml}
    </Diagnosis.List>
    <Activity.List>${activitiesXml}
    </Activity.List>
    <Observation.List>${observationsXml}
    </Observation.List>
  </Claim>
</Claim.Submission>`;
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
  /**
   * Submit insurance claim to DHA eClaimLink API
   * Feature-flagged - only runs if ENABLE_ECLAIM_API_SUBMISSION is true
   */
  async submitClaimToDHA(
    claimId: string,
    hospitalId: string
  ): Promise<{
    success: boolean;
    dhaClaimId?: string;
    submittedAt?: Date;
    errorMessage?: string;
    errorCode?: string;
  }> {
    // Check feature flag
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { settings: true },
    });

    const settings = (hospital?.settings as any) || {};
    const features = settings.features || {};

    if (!features.ENABLE_ECLAIM_API_SUBMISSION) {
      logger.info(`eClaimLink API submission disabled for hospital ${hospitalId}`);
      return {
        success: false,
        errorMessage: 'eClaimLink API submission is not enabled for this hospital',
        errorCode: 'FEATURE_DISABLED',
      };
    }

    // Get claim details
    const claim = await prisma.insuranceClaim.findFirst({
      where: { id: claimId },
      include: {
        invoice: {
          include: {
            patient: {
              include: {
                insurances: {
                  where: { isPrimary: true, isActive: true },
                },
              },
            },
          },
        },
        insurancePayer: true,
      },
    });

    if (!claim) {
      throw new Error(`Claim not found: ${claimId}`);
    }

    // Only submit to DHA if payer uses eClaimLink
    if (claim.insurancePayer?.claimPlatform !== 'eClaimLink') {
      logger.warn(`Payer ${claim.insurancePayer?.name} does not use eClaimLink`);
      return {
        success: false,
        errorMessage: 'Payer does not use eClaimLink platform',
        errorCode: 'PLATFORM_MISMATCH',
      };
    }

    try {
      // Generate eClaimLink XML
      const xmlPayload = await this.buildClaimXML(claim);

      // Submit to DHA eClaimLink API
      const apiResult = await this.submitClaimToAPI(xmlPayload, claim.claimNumber);

      if (!apiResult.success) {
        await prisma.insuranceClaim.update({
          where: { id: claimId },
          data: {
            eclaimLinkStatus: 'REJECTED',
            eclaimLinkResponse: apiResult.response || { error: apiResult.error },
          },
        });

        logger.error(`Claim ${claim.claimNumber} submission failed: ${apiResult.error}`);
        return {
          success: false,
          errorMessage: apiResult.error,
        };
      }

      // Success - update claim with DHA claim ID
      const dhaClaimId = apiResult.claimId!;
      await prisma.insuranceClaim.update({
        where: { id: claimId },
        data: {
          eclaimLinkId: dhaClaimId,
          eclaimLinkStatus: 'SUBMITTED',
          eclaimLinkResponse: apiResult.response,
          submittedAt: new Date(),
        },
      });

      logger.info(`Claim ${claim.claimNumber} submitted successfully to DHA eClaimLink: ${dhaClaimId}`);
      return {
        success: true,
        dhaClaimId,
        submittedAt: new Date(),
      };
    } catch (error: any) {
      logger.error(`Error submitting claim to DHA eClaimLink: ${error.message}`, {
        claimId,
        error: error.response?.data || error.message,
      });

      // Update claim with error
      await prisma.insuranceClaim.update({
        where: { id: claimId },
        data: {
          eclaimLinkStatus: 'ERROR',
          eclaimLinkResponse: {
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return {
        success: false,
        errorMessage: error.message,
        errorCode: error.response?.status?.toString() || 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Build simple XML payload for claim submission
   * (Simplified version - production would need full eClaimLink schema)
   */
  private async buildClaimXML(claim: any): Promise<string> {
    const patient = claim.invoice.patient;
    const insurance = patient.insurances?.[0];

    // TODO: Update XML structure based on actual DHA eClaimLink schema
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Claim xmlns="http://eclaimlink.ae/schema/v1">
  <ClaimHeader>
    <ClaimNumber>${claim.claimNumber}</ClaimNumber>
    <FacilityCode>${this.facilityCode}</FacilityCode>
    <PayerCode>${claim.insurancePayer?.code || 'UNKNOWN'}</PayerCode>
    <MemberID>${insurance?.subscriberId || ''}</MemberID>
    <PolicyNumber>${claim.policyNumber}</PolicyNumber>
    <PatientFileNo>${patient.mrn}</PatientFileNo>
    <ServiceDate>${claim.createdAt.toISOString().split('T')[0]}</ServiceDate>
    <ClaimAmount>${claim.claimAmount.toString()}</ClaimAmount>
  </ClaimHeader>
  <PatientInfo>
    <FirstName>${patient.firstName}</FirstName>
    <LastName>${patient.lastName}</LastName>
    <DateOfBirth>${patient.dateOfBirth ? patient.dateOfBirth.toISOString().split('T')[0] : ''}</DateOfBirth>
    <Gender>${patient.gender || ''}</Gender>
  </PatientInfo>
</Claim>`;

    return xml;
  }

  /**
   * Refresh claim status from DHA eClaimLink
   */
  async refreshClaimStatus(claimId: string): Promise<{
    updated: boolean;
    status?: string;
    errorMessage?: string;
  }> {
    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      select: { eclaimLinkId: true, eclaimLinkStatus: true },
    });

    if (!claim || !claim.eclaimLinkId) {
      return {
        updated: false,
        errorMessage: 'Claim not found or not submitted to eClaimLink',
      };
    }

    try {
      const statusResult = await this.checkClaimStatusFromAPI(claim.eclaimLinkId);

      // Update claim based on status
      await prisma.insuranceClaim.update({
        where: { id: claimId },
        data: {
          eclaimLinkStatus: statusResult.status,
          eclaimLinkResponse: statusResult.response,
          ...(statusResult.approvedAmount && { approvedAmount: statusResult.approvedAmount }),
          ...(statusResult.rejectionReason && { denialReasonCode: statusResult.rejectionReason }),
        },
      });

      return {
        updated: true,
        status: statusResult.status,
      };
    } catch (error: any) {
      logger.error('[DHA eClaimLink] Failed to refresh claim status:', error);
      return {
        updated: false,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Get Claim Reconciliation Advice (CRA) - DHA's ERA/835 equivalent
   */
  async getCRA(dhaClaimId: string): Promise<{
    claimId: string;
    status: string;
    approvedAmount?: number;
    deniedAmount?: number;
    adjustmentReason?: string;
    remittanceDate?: Date;
    response?: any;
  }> {
    if (this.mode === 'sandbox') {
      // Mock CRA response for sandbox mode
      logger.info('[DHA eClaimLink SANDBOX] Mock CRA fetch:', { dhaClaimId });
      return {
        claimId: dhaClaimId,
        status: 'APPROVED',
        approvedAmount: 950.00,
        deniedAmount: 50.00,
        adjustmentReason: 'Procedure not covered',
        remittanceDate: new Date(),
        response: {
          status: 'APPROVED',
          message: 'Claim approved (sandbox mode)',
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      // TODO: Update endpoint path when actual DHA documentation is available
      const response = await this.apiClient.get(`/claims/cra/${dhaClaimId}`);

      return {
        claimId: dhaClaimId,
        status: response.data.status || 'UNKNOWN',
        approvedAmount: response.data.approvedAmount,
        deniedAmount: response.data.deniedAmount,
        adjustmentReason: response.data.adjustmentReason,
        remittanceDate: response.data.remittanceDate ? new Date(response.data.remittanceDate) : undefined,
        response: response.data,
      };
    } catch (error: any) {
      logger.error('[DHA eClaimLink] CRA fetch failed:', error);
      throw new Error(`Failed to fetch CRA: ${error.message}`);
    }
  }

  /**
   * Parse ERA XML response from DHA eClaimLink
   * Converts XML remittance advice to structured data
   */
  async parseERAResponse(xmlResponse: string): Promise<{
    dhaClaimId: string;
    claimNumber: string;
    status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
    approvedAmount?: number;
    deniedAmount?: number;
    adjustmentReason?: string;
    remittanceDate: Date;
    rawResponse: any;
  }> {
    try {
      // This is a simplified parser - production would use xml2js or similar
      // For now, we'll parse basic fields using regex (not recommended for production)
      
      const statusMatch = xmlResponse.match(/<ClaimStatus>(.*?)<\/ClaimStatus>/);
      const approvedAmountMatch = xmlResponse.match(/<ApprovedAmount>(.*?)<\/ApprovedAmount>/);
      const deniedAmountMatch = xmlResponse.match(/<DeniedAmount>(.*?)<\/DeniedAmount>/);
      const adjustmentReasonMatch = xmlResponse.match(/<AdjustmentReason>(.*?)<\/AdjustmentReason>/);
      const dhaClaimIdMatch = xmlResponse.match(/<DhaClaimId>(.*?)<\/DhaClaimId>/);
      const claimNumberMatch = xmlResponse.match(/<ClaimNumber>(.*?)<\/ClaimNumber>/);
      const remittanceDateMatch = xmlResponse.match(/<RemittanceDate>(.*?)<\/RemittanceDate>/);

      let status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' = 'REJECTED';
      const statusStr = statusMatch ? statusMatch[1] : 'REJECTED';
      
      if (statusStr === 'APPROVED' || statusStr === 'PAID') {
        status = 'APPROVED';
      } else if (statusStr === 'PARTIALLY_APPROVED' || statusStr === 'PARTIAL') {
        status = 'PARTIALLY_APPROVED';
      }

      const approvedAmount = approvedAmountMatch ? parseFloat(approvedAmountMatch[1]) : undefined;
      const deniedAmount = deniedAmountMatch ? parseFloat(deniedAmountMatch[1]) : undefined;

      return {
        dhaClaimId: dhaClaimIdMatch ? dhaClaimIdMatch[1] : '',
        claimNumber: claimNumberMatch ? claimNumberMatch[1] : '',
        status,
        approvedAmount,
        deniedAmount,
        adjustmentReason: adjustmentReasonMatch ? adjustmentReasonMatch[1] : undefined,
        remittanceDate: remittanceDateMatch ? new Date(remittanceDateMatch[1]) : new Date(),
        rawResponse: { xml: xmlResponse },
      };
    } catch (error: any) {
      logger.error('[DHA eClaimLink] ERA parsing failed:', error);
      throw new Error(`Failed to parse ERA response: ${error.message}`);
    }
  }

  /**
   * Fetch and process remittance for a claim
   */
  async fetchAndProcessRemittance(claimId: string): Promise<{
    success: boolean;
    message?: string;
    errorMessage?: string;
  }> {
    try {
      const claim = await prisma.insuranceClaim.findUnique({
        where: { id: claimId },
        select: { eclaimLinkId: true, claimNumber: true },
      });

      if (!claim || !claim.eclaimLinkId) {
        throw new Error('Claim not found or not submitted to eClaimLink');
      }

      // Fetch CRA from DHA
      const cra = await this.getCRA(claim.eclaimLinkId);

      // Process remittance
      const result = await this.processRemittance({
        dhaClaimId: claim.eclaimLinkId,
        claimNumber: claim.claimNumber,
        status: cra.status as 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED',
        approvedAmount: cra.approvedAmount,
        deniedAmount: cra.deniedAmount,
        adjustmentReason: cra.adjustmentReason,
        remittanceDate: cra.remittanceDate || new Date(),
        rawResponse: cra.response,
      });

      if (result.success) {
        return {
          success: true,
          message: `Remittance processed successfully for claim ${claim.claimNumber}`,
        };
      } else {
        return {
          success: false,
          errorMessage: result.errorMessage || 'Unknown error processing remittance',
        };
      }
    } catch (error: any) {
      logger.error('[DHA eClaimLink] Fetch and process remittance failed:', error);
      return {
        success: false,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Process Electronic Remittance Advice (ERA/835)
   * Called when DHA sends remittance for approved claims
   */
  async processRemittance(remittanceData: {
    dhaClaimId: string;
    claimNumber: string;
    status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
    approvedAmount?: number;
    deniedAmount?: number;
    adjustmentReason?: string;
    remittanceDate: Date;
    rawResponse: any;
  }): Promise<{
    success: boolean;
    claimUpdated?: boolean;
    paymentCreated?: boolean;
    appealCreated?: boolean;
    secondaryClaimCreated?: boolean;
    glEntriesPosted?: boolean;
    errorMessage?: string;
  }> {
    logger.info('[DHA eClaimLink] Processing remittance for claim:', remittanceData.claimNumber);

    try {
      // Find the insurance claim by DHA claim ID or claim number
      const claim = await prisma.insuranceClaim.findFirst({
        where: {
          OR: [
            { eclaimLinkId: remittanceData.dhaClaimId },
            { claimNumber: remittanceData.claimNumber },
          ],
        },
        include: {
          invoice: {
            include: {
              patient: {
                include: {
                  insurances: {
                    where: { isActive: true },
                    orderBy: [
                      { isPrimary: 'desc' },
                      { createdAt: 'desc' },
                    ],
                  },
                },
              },
              hospital: true,
            },
          },
        },
      });

      if (!claim) {
        throw new Error(`Claim not found: ${remittanceData.claimNumber}`);
      }

      let paymentCreated = false;
      let appealCreated = false;
      let secondaryClaimCreated = false;
      let glEntriesPosted = false;

      // Update claim status and response
      await prisma.insuranceClaim.update({
        where: { id: claim.id },
        data: {
          eclaimLinkStatus: remittanceData.status,
          eclaimLinkResponse: remittanceData.rawResponse,
          status: remittanceData.status === 'APPROVED' ? 'PAID' : 
                  remittanceData.status === 'PARTIALLY_APPROVED' ? 'PARTIALLY_APPROVED' : 'REJECTED',
          approvedAmount: remittanceData.approvedAmount,
          denialReasonCode: remittanceData.adjustmentReason,
          processedAt: remittanceData.remittanceDate,
        },
      });

      // APPROVED: Create payment + GL entries
      if (remittanceData.status === 'APPROVED' && remittanceData.approvedAmount) {
        await prisma.payment.create({
          data: {
            invoiceId: claim.invoiceId,
            amount: remittanceData.approvedAmount,
            paymentMethod: 'INSURANCE',
            referenceNumber: `ERA-${remittanceData.dhaClaimId}`,
            notes: `Insurance payment from DHA eClaimLink - Claim ${remittanceData.claimNumber}`,
            createdBy: 'system',
          },
        });

        // Update invoice
        const invoice = claim.invoice;
        const newPaidAmount = Number(invoice.paidAmount) + remittanceData.approvedAmount;
        const newBalance = Number(invoice.totalAmount) - newPaidAmount;

        await prisma.invoice.update({
          where: { id: claim.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: newBalance > 0 ? newBalance : 0,
            status: newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID',
            updatedBy: 'system',
          },
        });

        // Post GL entries
        glEntriesPosted = await this.postInsurancePaymentGL(
          claim,
          remittanceData.approvedAmount,
          remittanceData.remittanceDate
        );

        paymentCreated = true;
        logger.info(`[DHA eClaimLink] Payment created for claim ${remittanceData.claimNumber}: ${remittanceData.approvedAmount}`);
      }

      // PARTIALLY_APPROVED: Create payment + check for COB (secondary claim)
      if (remittanceData.status === 'PARTIALLY_APPROVED' && remittanceData.approvedAmount) {
        // Create payment for approved portion
        await prisma.payment.create({
          data: {
            invoiceId: claim.invoiceId,
            amount: remittanceData.approvedAmount,
            paymentMethod: 'INSURANCE',
            referenceNumber: `ERA-${remittanceData.dhaClaimId}`,
            notes: `Partial insurance payment from DHA eClaimLink - Claim ${remittanceData.claimNumber}`,
            createdBy: 'system',
          },
        });

        // Update invoice
        const invoice = claim.invoice;
        const newPaidAmount = Number(invoice.paidAmount) + remittanceData.approvedAmount;
        const newBalance = Number(invoice.totalAmount) - newPaidAmount;

        await prisma.invoice.update({
          where: { id: claim.invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: newBalance > 0 ? newBalance : 0,
            status: newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID',
            updatedBy: 'system',
          },
        });

        // Post GL entries for partial payment
        glEntriesPosted = await this.postInsurancePaymentGL(
          claim,
          remittanceData.approvedAmount,
          remittanceData.remittanceDate
        );

        paymentCreated = true;

        // COB: Check if patient has secondary insurance
        if (claim.isPrimary && newBalance > 0) {
          const secondaryInsurance = invoice.patient.insurances.find(
            (ins: any) => !ins.isPrimary && ins.isActive
          );

          if (secondaryInsurance) {
            // Create secondary claim
            const secondaryClaimNumber = this.generateClaimNumber();
            await prisma.insuranceClaim.create({
              data: {
                invoiceId: claim.invoiceId,
                claimNumber: secondaryClaimNumber,
                insuranceProvider: secondaryInsurance.providerName,
                insurancePayerId: secondaryInsurance.id,
                policyNumber: secondaryInsurance.policyNumber,
                claimAmount: newBalance,
                isPrimary: false,
                linkedClaimId: claim.id,
                notes: `Secondary claim - Primary claim ${remittanceData.claimNumber} partially approved for ${remittanceData.approvedAmount}`,
                createdBy: 'system',
                submittedBy: 'system',
              },
            });

            secondaryClaimCreated = true;
            logger.info(`[DHA eClaimLink] Secondary claim created for remaining balance: ${newBalance}`);
          }
        }
      }

      // REJECTED: Create appeal (optional)
      if (remittanceData.status === 'REJECTED') {
        // For now, just log - actual appeal creation can be manual or automated based on business rules
        logger.warn(`[DHA eClaimLink] Claim ${remittanceData.claimNumber} rejected: ${remittanceData.adjustmentReason}`);
        appealCreated = false; // Set to true when implemented
      }

      return {
        success: true,
        claimUpdated: true,
        paymentCreated,
        appealCreated,
        secondaryClaimCreated,
        glEntriesPosted,
      };
    } catch (error: any) {
      logger.error('[DHA eClaimLink] Remittance processing failed:', error);
      return {
        success: false,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Post GL entries for insurance payment
   */
  private async postInsurancePaymentGL(
    claim: any,
    approvedAmount: number,
    remittanceDate: Date
  ): Promise<boolean> {
    try {
      const hospitalId = claim.invoice.hospitalId;

      // Get GL accounts for insurance receivable and cash
      const insuranceReceivableAccount = await prisma.gLAccount.findFirst({
        where: { hospitalId, accountCode: '1200' }, // Insurance Receivable
      });

      const cashAccount = await prisma.gLAccount.findFirst({
        where: { hospitalId, accountCode: '1000' }, // Cash/Bank
      });

      if (!insuranceReceivableAccount || !cashAccount) {
        logger.warn('[DHA eClaimLink] GL accounts not found. Skipping GL posting.');
        return false;
      }

      // Import accountingService dynamically to avoid circular dependency
      const { accountingService } = await import('./accountingService');

      // Create journal entry
      await accountingService.createJournalEntry({
        hospitalId,
        transactionDate: remittanceDate,
        referenceType: 'PAYMENT',
        referenceId: claim.id,
        description: `Insurance payment for claim ${claim.claimNumber} - ${claim.insuranceProvider}`,
        lines: [
          {
            glAccountId: cashAccount.id,
            debitAmount: approvedAmount,
            creditAmount: 0,
            description: `Insurance payment received - Claim ${claim.claimNumber}`,
          },
          {
            glAccountId: insuranceReceivableAccount.id,
            debitAmount: 0,
            creditAmount: approvedAmount,
            description: `Clear insurance receivable - Claim ${claim.claimNumber}`,
          },
        ],
        createdBy: 'system',
      });

      logger.info(`[DHA eClaimLink] GL entries posted for claim ${claim.claimNumber}`);
      return true;
    } catch (error: any) {
      logger.error('[DHA eClaimLink] Failed to post GL entries:', error);
      return false;
    }
  }

  /**
   * Helper: Generate claim number
   */
  private generateClaimNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `CLM-${timestamp}${random}`;
  }

  /**
   * Check submission status for a claim
   */
  async checkClaimStatus(claimId: string): Promise<{
    eclaimLinkId?: string;
    status?: string;
    lastUpdated?: Date;
    response?: any;
  }> {
    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: claimId },
      select: {
        eclaimLinkId: true,
        eclaimLinkStatus: true,
        eclaimLinkResponse: true,
        updatedAt: true,
      },
    });

    if (!claim) {
      throw new Error('Claim not found');
    }

    return {
      eclaimLinkId: claim.eclaimLinkId || undefined,
      status: claim.eclaimLinkStatus || undefined,
      lastUpdated: claim.updatedAt,
      response: claim.eclaimLinkResponse,
    };
  }
}

export const eclaimLinkService = new EClaimLinkService();
