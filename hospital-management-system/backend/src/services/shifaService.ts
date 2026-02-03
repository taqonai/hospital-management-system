/**
 * SHIFA Payer Platform Service
 * Integration with HAAD SHIFA claim submission system
 * 
 * SHIFA uses XML format for claim submission (similar to eClaimLink but for HAAD)
 * Mode: sandbox (mock responses) or production (real API calls)
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

interface ShifaClaimData {
  claimNumber: string;
  patientEmiratesId: string;
  patientName: string;
  dateOfBirth: string;
  gender: 'M' | 'F';
  policyNumber: string;
  payerId: string;
  facilityId: string;
  dateOfService: string;
  diagnosisCodes: string[];
  procedures: Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
}

interface ShifaClaimResponse {
  success: boolean;
  claimId?: string;
  referenceNumber?: string;
  status?: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  message?: string;
  errors?: string[];
}

interface ShifaClaimStatusResponse {
  success: boolean;
  claimId: string;
  status: 'SUBMITTED' | 'PENDING' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'PAID';
  submittedDate?: string;
  processedDate?: string;
  approvedAmount?: number;
  paidAmount?: number;
  denialReason?: string;
  denialCode?: string;
  message?: string;
}

interface ShifaRemittanceResponse {
  success: boolean;
  remittanceId?: string;
  paymentDate?: string;
  totalAmount?: number;
  claims: Array<{
    claimId: string;
    claimNumber: string;
    approvedAmount: number;
    paidAmount: number;
    adjustments?: Array<{
      code: string;
      reason: string;
      amount: number;
    }>;
  }>;
  message?: string;
}

class ShifaService {
  private readonly mode: string;
  private readonly apiUrl: string;
  private readonly username: string;
  private readonly password: string;
  private apiClient: AxiosInstance;

  constructor() {
    this.mode = process.env.SHIFA_MODE || 'sandbox';
    this.apiUrl = process.env.SHIFA_API_URL || 'https://api.haad.ae/shifa';
    this.username = process.env.SHIFA_USERNAME || '';
    this.password = process.env.SHIFA_PASSWORD || '';

    this.apiClient = axios.create({
      baseURL: this.apiUrl,
      auth: {
        username: this.username,
        password: this.password,
      },
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
      timeout: 60000,
    });
  }

  /**
   * Build SHIFA XML claim submission
   * Simple string-based XML builder (no external dependencies)
   */
  private buildClaimXML(data: ShifaClaimData): string {
    const diagnosisCodes = data.diagnosisCodes
      .map((code) => `      <Diagnosis><Code>${this.escapeXml(code)}</Code></Diagnosis>`)
      .join('\n');

    const procedures = data.procedures
      .map((proc) => `
      <Procedure>
        <Code>${this.escapeXml(proc.code)}</Code>
        <Description>${this.escapeXml(proc.description)}</Description>
        <Quantity>${proc.quantity}</Quantity>
        <UnitPrice>${proc.unitPrice.toFixed(2)}</UnitPrice>
        <TotalPrice>${proc.totalPrice.toFixed(2)}</TotalPrice>
      </Procedure>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ClaimSubmission version="2.0">
  <Header>
    <SubmissionDate>${new Date().toISOString()}</SubmissionDate>
    <FacilityID>${this.escapeXml(data.facilityId)}</FacilityID>
    <PayerID>${this.escapeXml(data.payerId)}</PayerID>
  </Header>
  <Claim>
    <ClaimNumber>${this.escapeXml(data.claimNumber)}</ClaimNumber>
    <Patient>
      <EmiratesID>${this.escapeXml(data.patientEmiratesId)}</EmiratesID>
      <Name>${this.escapeXml(data.patientName)}</Name>
      <DateOfBirth>${this.escapeXml(data.dateOfBirth)}</DateOfBirth>
      <Gender>${data.gender}</Gender>
    </Patient>
    <Insurance>
      <PolicyNumber>${this.escapeXml(data.policyNumber)}</PolicyNumber>
      <PayerID>${this.escapeXml(data.payerId)}</PayerID>
    </Insurance>
    <ServiceDetails>
      <DateOfService>${this.escapeXml(data.dateOfService)}</DateOfService>
      <DiagnosisCodes>
${diagnosisCodes}
      </DiagnosisCodes>
      <Procedures>
${procedures}
      </Procedures>
      <TotalAmount>${data.totalAmount.toFixed(2)}</TotalAmount>
    </ServiceDetails>
  </Claim>
</ClaimSubmission>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Submit claim to SHIFA
   */
  async submitClaim(data: ShifaClaimData): Promise<ShifaClaimResponse> {
    if (this.mode === 'sandbox') {
      logger.info('[SHIFA] Sandbox: Claim submission', data.claimNumber);
      
      // Simulate acceptance for valid claims
      const isValid = data.totalAmount > 0 && data.procedures.length > 0;
      
      return {
        success: isValid,
        claimId: `SHIFA-${Date.now()}`,
        referenceNumber: `REF-${data.claimNumber}`,
        status: isValid ? 'ACCEPTED' : 'REJECTED',
        message: isValid ? 'Claim accepted for processing' : 'Invalid claim data',
        errors: isValid ? undefined : ['Missing required procedure information'],
      };
    }

    try {
      const xmlPayload = this.buildClaimXML(data);
      logger.debug('[SHIFA] Submitting claim XML:', xmlPayload);

      const response = await this.apiClient.post('/claims/submit', xmlPayload);

      // Parse XML response
      const result = this.parseSubmissionResponse(response.data);
      logger.info('[SHIFA] Claim submitted:', result.claimId);

      return result;
    } catch (error: any) {
      logger.error('[SHIFA] Claim submission error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to submit claim to SHIFA',
        errors: [error.message],
      };
    }
  }

  /**
   * Check claim status
   */
  async checkClaimStatus(claimId: string): Promise<ShifaClaimStatusResponse> {
    if (this.mode === 'sandbox') {
      logger.info('[SHIFA] Sandbox: Check claim status', claimId);
      
      // Simulate different statuses based on ID pattern
      const statusIndex = parseInt(claimId.slice(-1), 10) % 5;
      const statuses: ShifaClaimStatusResponse['status'][] = [
        'SUBMITTED',
        'PENDING',
        'APPROVED',
        'PARTIALLY_APPROVED',
        'REJECTED',
      ];
      
      const status = statuses[statusIndex] || 'PENDING';
      
      return {
        success: true,
        claimId,
        status,
        submittedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        processedDate: status !== 'SUBMITTED' && status !== 'PENDING' 
          ? new Date().toISOString() 
          : undefined,
        approvedAmount: status === 'APPROVED' || status === 'PARTIALLY_APPROVED' 
          ? 2500 
          : undefined,
        paidAmount: status === 'PAID' ? 2500 : undefined,
        denialReason: status === 'REJECTED' ? 'Service not covered under policy' : undefined,
        denialCode: status === 'REJECTED' ? 'NC001' : undefined,
        message: `Claim ${status.toLowerCase()}`,
      };
    }

    try {
      const response = await this.apiClient.get(`/claims/status/${claimId}`);
      const result = this.parseStatusResponse(response.data);

      logger.info('[SHIFA] Claim status:', claimId, result.status);
      return result;
    } catch (error: any) {
      logger.error('[SHIFA] Claim status check error:', error);
      return {
        success: false,
        claimId,
        status: 'SUBMITTED',
        message: error.response?.data?.message || 'Failed to check claim status',
      };
    }
  }

  /**
   * Get remittance advice (payment details)
   */
  async getRemittance(remittanceId: string): Promise<ShifaRemittanceResponse> {
    if (this.mode === 'sandbox') {
      logger.info('[SHIFA] Sandbox: Get remittance', remittanceId);
      
      return {
        success: true,
        remittanceId,
        paymentDate: new Date().toISOString(),
        totalAmount: 5000,
        claims: [
          {
            claimId: 'SHIFA-001',
            claimNumber: 'CLM-2024-001',
            approvedAmount: 3000,
            paidAmount: 3000,
          },
          {
            claimId: 'SHIFA-002',
            claimNumber: 'CLM-2024-002',
            approvedAmount: 2000,
            paidAmount: 2000,
            adjustments: [
              {
                code: 'ADJ01',
                reason: 'Policy copay deduction',
                amount: -200,
              },
            ],
          },
        ],
        message: 'Remittance retrieved successfully',
      };
    }

    try {
      const response = await this.apiClient.get(`/remittance/${remittanceId}`);
      const result = this.parseRemittanceResponse(response.data);

      logger.info('[SHIFA] Remittance retrieved:', remittanceId, result.totalAmount);
      return result;
    } catch (error: any) {
      logger.error('[SHIFA] Remittance retrieval error:', error);
      return {
        success: false,
        remittanceId,
        claims: [],
        message: error.response?.data?.message || 'Failed to retrieve remittance',
      };
    }
  }

  /**
   * Parse XML submission response
   */
  private parseSubmissionResponse(xmlData: string): ShifaClaimResponse {
    // Simplified parser - in production, use proper XML parser
    // For now, return mock structure
    return {
      success: true,
      claimId: `SHIFA-${Date.now()}`,
      referenceNumber: `REF-${Date.now()}`,
      status: 'ACCEPTED',
      message: 'Claim accepted',
    };
  }

  /**
   * Parse XML status response
   */
  private parseStatusResponse(xmlData: string): ShifaClaimStatusResponse {
    // Simplified parser - in production, use proper XML parser
    return {
      success: true,
      claimId: `SHIFA-${Date.now()}`,
      status: 'PENDING',
      message: 'Claim pending review',
    };
  }

  /**
   * Parse XML remittance response
   */
  private parseRemittanceResponse(xmlData: string): ShifaRemittanceResponse {
    // Simplified parser - in production, use proper XML parser
    return {
      success: true,
      remittanceId: `REM-${Date.now()}`,
      paymentDate: new Date().toISOString(),
      totalAmount: 0,
      claims: [],
      message: 'Remittance retrieved',
    };
  }
}

export const shifaService = new ShifaService();
