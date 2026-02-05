/**
 * DHA eClaimLink Integration Service
 * 
 * Implements DHA (Dubai Health Authority) eClaimLink XML API for:
 * - Insurance Eligibility Verification
 * - Claim Submission
 * - Claim Status Inquiry
 * - Remittance Advice Retrieval
 * 
 * Reference: DHA eClaimLink Integration Guide v3.0
 * 
 * Configuration:
 * - Set DHA_ECLAIM_MODE=sandbox for testing
 * - Set DHA_ECLAIM_MODE=production for live
 */

import axios from 'axios';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import prisma from '../config/database';
import logger from '../utils/logger';

// Configuration
const DHA_CONFIG = {
  sandbox: {
    baseUrl: 'https://sandbox.eclaimlink.ae/api/v1',
    eligibilityUrl: 'https://sandbox.eclaimlink.ae/api/v1/eligibility',
    claimUrl: 'https://sandbox.eclaimlink.ae/api/v1/claims',
    statusUrl: 'https://sandbox.eclaimlink.ae/api/v1/claims/status',
    remittanceUrl: 'https://sandbox.eclaimlink.ae/api/v1/remittance',
  },
  production: {
    baseUrl: 'https://eclaimlink.ae/api/v1',
    eligibilityUrl: 'https://eclaimlink.ae/api/v1/eligibility',
    claimUrl: 'https://eclaimlink.ae/api/v1/claims',
    statusUrl: 'https://eclaimlink.ae/api/v1/claims/status',
    remittanceUrl: 'https://eclaimlink.ae/api/v1/remittance',
  },
};

// Types
export interface DHACredentials {
  facilityId: string;
  facilityLicense: string;
  apiKey: string;
  apiSecret?: string;
}

export interface EligibilityRequest {
  emiratesId: string;
  payerId?: string;
  serviceDate?: Date;
}

export interface EligibilityResponse {
  success: boolean;
  memberId?: string;
  memberName?: string;
  payerId?: string;
  payerName?: string;
  policyNumber?: string;
  policyStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'NOT_FOUND';
  effectiveDate?: Date;
  expiryDate?: Date;
  networkStatus: 'IN_NETWORK' | 'OUT_OF_NETWORK' | 'UNKNOWN';
  planType?: string;
  coveragePercentage?: number;
  copayAmount?: number;
  deductible?: {
    annual: number;
    used: number;
    remaining: number;
  };
  benefits?: {
    consultation: { limit: number; used: number; remaining: number };
    laboratory: { limit: number; used: number; remaining: number };
    radiology: { limit: number; used: number; remaining: number };
    pharmacy: { limit: number; used: number; remaining: number };
  };
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: string;
  // GAP 5: Data source indicator for UI banners
  dataSource?: 'DHA_LIVE' | 'DHA_SANDBOX' | 'MOCK_DATA' | 'CACHED_DB' | 'NOT_CONFIGURED';
}

export interface ClaimHeader {
  claimId: string;
  memberId: string;
  memberName: string;
  emiratesId: string;
  payerId: string;
  providerId: string;
  encounterType: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY' | 'DAYCASE';
  encounterStart: Date;
  encounterEnd?: Date;
  primaryDiagnosis: string; // ICD-10 code
  secondaryDiagnoses?: string[];
  claimAmount: number;
  currency: 'AED';
}

export interface ClaimActivity {
  activityId: string;
  activityType: 'CPT' | 'HCPCS' | 'DRG' | 'DRUG' | 'DENTAL';
  activityCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  netAmount: number;
  clinician?: string;
  serviceDate: Date;
  observation?: string;
}

export interface ClaimSubmissionRequest {
  header: ClaimHeader;
  activities: ClaimActivity[];
  preAuthNumber?: string;
}

export interface ClaimSubmissionResponse {
  success: boolean;
  transactionId?: string;
  claimReference?: string;
  receivedDate?: Date;
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'ERROR';
  validationErrors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  errorCode?: string;
  errorMessage?: string;
}

export interface ClaimStatusResponse {
  success: boolean;
  claimReference: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'PAID';
  submissionDate?: Date;
  processedDate?: Date;
  approvedAmount?: number;
  rejectedAmount?: number;
  denialReasons?: Array<{
    activityId: string;
    code: string;
    reason: string;
  }>;
  remittanceAdviceId?: string;
}

export interface RemittanceAdvice {
  remittanceId: string;
  paymentDate: Date;
  paymentMethod: string;
  paymentReference: string;
  totalPaid: number;
  claims: Array<{
    claimReference: string;
    approvedAmount: number;
    paidAmount: number;
    adjustments: Array<{
      code: string;
      amount: number;
      reason: string;
    }>;
  }>;
}

class DHAEClaimService {
  private xmlBuilder: XMLBuilder;
  private xmlParser: XMLParser;

  constructor() {
    // Initialize XML builder/parser with DHA-specific options
    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
    });
    
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * Get DHA config from hospital settings (credentials + mode)
   * All settings come from Admin UI - no hardcoded values
   */
  private async getConfig(hospitalId: string): Promise<{ credentials: DHACredentials; mode: 'sandbox' | 'production' } | null> {
    const settings = await prisma.hospitalSettings.findFirst({
      where: {
        hospitalId,
      },
    });

    if (!settings?.dhaSettings) {
      return null;
    }

    try {
      const config = typeof settings.dhaSettings === 'string'
        ? JSON.parse(settings.dhaSettings)
        : settings.dhaSettings as any;
      
      if (config.enabled && config.facilityId && config.facilityLicense && config.apiKey) {
        return {
          credentials: {
            facilityId: config.facilityId,
            facilityLicense: config.facilityLicense,
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
          },
          mode: config.mode === 'production' ? 'production' : 'sandbox',
        };
      }
    } catch (error) {
      logger.error('[DHA] Failed to parse config:', error);
    }

    return null;
  }

  /**
   * Get API URLs based on mode from settings
   */
  private getUrls(mode: 'sandbox' | 'production') {
    return DHA_CONFIG[mode];
  }

  /**
   * Build XML request envelope with authentication
   */
  private buildRequestEnvelope(credentials: DHACredentials, body: any): string {
    const envelope = {
      'soap:Envelope': {
        '@_xmlns:soap': 'http://www.w3.org/2003/05/soap-envelope',
        '@_xmlns:dha': 'http://www.haad.ae/eClaimLink',
        'soap:Header': {
          'dha:AuthHeader': {
            'dha:FacilityID': credentials.facilityId,
            'dha:FacilityLicense': credentials.facilityLicense,
            'dha:APIKey': credentials.apiKey,
            'dha:Timestamp': new Date().toISOString(),
          },
        },
        'soap:Body': body,
      },
    };

    return this.xmlBuilder.build(envelope);
  }

  /**
   * Send request to DHA API
   */
  private async sendRequest(url: string, xmlBody: string): Promise<any> {
    try {
      const response = await axios.post(url, xmlBody, {
        headers: {
          'Content-Type': 'application/xml',
          'Accept': 'application/xml',
        },
        timeout: 30000, // 30 second timeout
      });

      return this.xmlParser.parse(response.data);
    } catch (error: any) {
      logger.error('[DHA] API request failed:', error.message);
      
      if (error.response?.data) {
        try {
          return this.xmlParser.parse(error.response.data);
        } catch {
          // Response is not XML
        }
      }

      throw error;
    }
  }

  /**
   * Verify insurance eligibility via DHA eClaimLink
   */
  async verifyEligibility(
    hospitalId: string,
    request: EligibilityRequest
  ): Promise<EligibilityResponse> {
    const config = await this.getConfig(hospitalId);

    // If no config, return mock/cached data
    if (!config) {
      // GAP 5: In production, do NOT return mock data — force manual verification
      if (process.env.NODE_ENV === 'production') {
        logger.warn('[DHA] No credentials configured in production, returning NOT_CONFIGURED');
        return {
          success: false,
          policyStatus: 'NOT_FOUND',
          networkStatus: 'UNKNOWN',
          dataSource: 'NOT_CONFIGURED',
          errorCode: 'DHA_NOT_CONFIGURED',
          errorMessage: 'DHA eClaimLink is not configured for this hospital. Manual verification or self-pay required.',
        };
      }
      logger.warn('[DHA] No credentials configured, using mock response');
      const mockResponse = this.getMockEligibilityResponse(request);
      mockResponse.dataSource = 'MOCK_DATA';
      return mockResponse;
    }

    const { credentials, mode } = config;

    // In sandbox mode, return mock data instead of calling the real DHA endpoint
    // (real endpoint would fail with placeholder credentials)
    if (mode === 'sandbox') {
      logger.info('[DHA-SANDBOX] Returning mock eligibility for configured sandbox mode:', request.emiratesId);
      const mockResponse = this.getMockEligibilityResponse(request);
      mockResponse.dataSource = 'DHA_SANDBOX';
      return mockResponse;
    }

    const urls = this.getUrls(mode);

    const body = {
      'dha:EligibilityRequest': {
        'dha:EmiratesID': request.emiratesId,
        'dha:PayerID': request.payerId || '',
        'dha:ServiceDate': (request.serviceDate || new Date()).toISOString().split('T')[0],
      },
    };

    const xmlRequest = this.buildRequestEnvelope(credentials, body);

    try {
      const response = await this.sendRequest(urls.eligibilityUrl, xmlRequest);
      const parsed = this.parseEligibilityResponse(response);
      // GAP 5: Tag with data source based on configured mode
      parsed.dataSource = 'DHA_LIVE';
      return parsed;
    } catch (error: any) {
      logger.error('[DHA] Eligibility check failed:', error.message);
      return {
        success: false,
        policyStatus: 'NOT_FOUND',
        networkStatus: 'UNKNOWN',
        dataSource: 'DHA_LIVE',
        errorCode: 'CONNECTION_ERROR',
        errorMessage: error.message,
      };
    }
  }

  /**
   * Parse eligibility response from DHA XML
   */
  private parseEligibilityResponse(xmlResponse: any): EligibilityResponse {
    try {
      const envelope = xmlResponse['soap:Envelope'] || xmlResponse;
      const body = envelope['soap:Body'] || envelope;
      const eligibility = body['dha:EligibilityResponse'] || body;

      if (eligibility['dha:ErrorCode']) {
        return {
          success: false,
          policyStatus: 'NOT_FOUND',
          networkStatus: 'UNKNOWN',
          errorCode: eligibility['dha:ErrorCode'],
          errorMessage: eligibility['dha:ErrorMessage'],
        };
      }

      return {
        success: true,
        memberId: eligibility['dha:MemberID'],
        memberName: eligibility['dha:MemberName'],
        payerId: eligibility['dha:PayerID'],
        payerName: eligibility['dha:PayerName'],
        policyNumber: eligibility['dha:PolicyNumber'],
        policyStatus: this.mapPolicyStatus(eligibility['dha:Status']),
        effectiveDate: eligibility['dha:EffectiveDate'] ? new Date(eligibility['dha:EffectiveDate']) : undefined,
        expiryDate: eligibility['dha:ExpiryDate'] ? new Date(eligibility['dha:ExpiryDate']) : undefined,
        networkStatus: eligibility['dha:NetworkStatus'] === 'IN' ? 'IN_NETWORK' : 'OUT_OF_NETWORK',
        planType: eligibility['dha:PlanType'],
        coveragePercentage: Number(eligibility['dha:CoveragePercentage']) || 80,
        copayAmount: Number(eligibility['dha:CopayAmount']) || 0,
        deductible: {
          annual: Number(eligibility['dha:AnnualDeductible']) || 0,
          used: Number(eligibility['dha:UsedDeductible']) || 0,
          remaining: Number(eligibility['dha:RemainingDeductible']) || 0,
        },
      };
    } catch (error) {
      logger.error('[DHA] Failed to parse eligibility response:', error);
      return {
        success: false,
        policyStatus: 'NOT_FOUND',
        networkStatus: 'UNKNOWN',
        errorCode: 'PARSE_ERROR',
        errorMessage: 'Failed to parse DHA response',
        rawResponse: JSON.stringify(xmlResponse),
      };
    }
  }

  /**
   * Map DHA status codes to internal status
   */
  private mapPolicyStatus(dhaStatus: string): EligibilityResponse['policyStatus'] {
    const statusMap: Record<string, EligibilityResponse['policyStatus']> = {
      'A': 'ACTIVE',
      'ACTIVE': 'ACTIVE',
      'I': 'INACTIVE',
      'INACTIVE': 'INACTIVE',
      'E': 'EXPIRED',
      'EXPIRED': 'EXPIRED',
      'S': 'SUSPENDED',
      'SUSPENDED': 'SUSPENDED',
    };
    return statusMap[dhaStatus?.toUpperCase()] || 'NOT_FOUND';
  }

  /**
   * Submit a claim to DHA
   */
  async submitClaim(
    hospitalId: string,
    claim: ClaimSubmissionRequest
  ): Promise<ClaimSubmissionResponse> {
    const config = await this.getConfig(hospitalId);

    if (!config) {
      logger.warn('[DHA] No credentials configured, using mock submission');
      return this.getMockClaimSubmissionResponse(claim);
    }

    const { credentials, mode } = config;
    const urls = this.getUrls(mode);

    // Build activities XML
    const activities = claim.activities.map(act => ({
      'dha:Activity': {
        'dha:ID': act.activityId,
        'dha:Type': act.activityType,
        'dha:Code': act.activityCode,
        'dha:Description': act.description,
        'dha:Quantity': act.quantity,
        'dha:Net': act.netAmount,
        'dha:Clinician': act.clinician || '',
        'dha:Start': act.serviceDate.toISOString().split('T')[0],
        'dha:Observation': act.observation || '',
      },
    }));

    const body = {
      'dha:Claim': {
        'dha:Header': {
          'dha:ID': claim.header.claimId,
          'dha:MemberID': claim.header.memberId,
          'dha:EmiratesID': claim.header.emiratesId,
          'dha:PayerID': claim.header.payerId,
          'dha:ProviderID': claim.header.providerId,
          'dha:EncounterType': claim.header.encounterType,
          'dha:EncounterStart': claim.header.encounterStart.toISOString(),
          'dha:EncounterEnd': claim.header.encounterEnd?.toISOString() || '',
          'dha:PrimaryDiagnosis': claim.header.primaryDiagnosis,
          'dha:SecondaryDiagnosis': claim.header.secondaryDiagnoses?.join(',') || '',
          'dha:Gross': claim.header.claimAmount,
          'dha:Net': claim.header.claimAmount,
          'dha:PreAuthNumber': claim.preAuthNumber || '',
        },
        'dha:Activities': activities,
      },
    };

    const xmlRequest = this.buildRequestEnvelope(credentials, body);

    try {
      const response = await this.sendRequest(urls.claimUrl, xmlRequest);
      return this.parseClaimSubmissionResponse(response, claim.header.claimId);
    } catch (error: any) {
      logger.error('[DHA] Claim submission failed:', error.message);
      return {
        success: false,
        status: 'ERROR',
        errorCode: 'CONNECTION_ERROR',
        errorMessage: error.message,
      };
    }
  }

  /**
   * Parse claim submission response
   */
  private parseClaimSubmissionResponse(xmlResponse: any, claimId: string): ClaimSubmissionResponse {
    try {
      const envelope = xmlResponse['soap:Envelope'] || xmlResponse;
      const body = envelope['soap:Body'] || envelope;
      const result = body['dha:ClaimResponse'] || body;

      if (result['dha:ErrorCode']) {
        return {
          success: false,
          status: 'REJECTED',
          errorCode: result['dha:ErrorCode'],
          errorMessage: result['dha:ErrorMessage'],
          validationErrors: this.parseValidationErrors(result['dha:ValidationErrors']),
        };
      }

      return {
        success: true,
        transactionId: result['dha:TransactionID'],
        claimReference: result['dha:ClaimReference'] || claimId,
        receivedDate: new Date(),
        status: result['dha:Status'] === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING',
      };
    } catch (error) {
      logger.error('[DHA] Failed to parse claim response:', error);
      return {
        success: false,
        status: 'ERROR',
        errorCode: 'PARSE_ERROR',
        errorMessage: 'Failed to parse DHA response',
      };
    }
  }

  /**
   * Parse validation errors from DHA response
   */
  private parseValidationErrors(errors: any): ClaimSubmissionResponse['validationErrors'] {
    if (!errors) return undefined;

    const errorArray = Array.isArray(errors['dha:Error']) 
      ? errors['dha:Error'] 
      : [errors['dha:Error']].filter(Boolean);

    return errorArray.map((err: any) => ({
      code: err['dha:Code'] || 'UNKNOWN',
      message: err['dha:Message'] || 'Unknown error',
      field: err['dha:Field'],
    }));
  }

  /**
   * Check claim status
   */
  async getClaimStatus(
    hospitalId: string,
    claimReference: string
  ): Promise<ClaimStatusResponse> {
    const config = await this.getConfig(hospitalId);

    if (!config) {
      return this.getMockClaimStatusResponse(claimReference);
    }

    const { credentials, mode } = config;
    const urls = this.getUrls(mode);

    const body = {
      'dha:ClaimStatusRequest': {
        'dha:ClaimReference': claimReference,
      },
    };

    const xmlRequest = this.buildRequestEnvelope(credentials, body);

    try {
      const response = await this.sendRequest(urls.statusUrl, xmlRequest);
      return this.parseClaimStatusResponse(response, claimReference);
    } catch (error: any) {
      logger.error('[DHA] Claim status check failed:', error.message);
      return {
        success: false,
        claimReference,
        status: 'PENDING',
      };
    }
  }

  /**
   * Parse claim status response
   */
  private parseClaimStatusResponse(xmlResponse: any, claimReference: string): ClaimStatusResponse {
    try {
      const envelope = xmlResponse['soap:Envelope'] || xmlResponse;
      const body = envelope['soap:Body'] || envelope;
      const result = body['dha:ClaimStatusResponse'] || body;

      const statusMap: Record<string, ClaimStatusResponse['status']> = {
        'PENDING': 'PENDING',
        'IN_REVIEW': 'IN_REVIEW',
        'APPROVED': 'APPROVED',
        'PARTIALLY_APPROVED': 'PARTIALLY_APPROVED',
        'REJECTED': 'REJECTED',
        'PAID': 'PAID',
      };

      return {
        success: true,
        claimReference,
        status: statusMap[result['dha:Status']] || 'PENDING',
        submissionDate: result['dha:SubmissionDate'] ? new Date(result['dha:SubmissionDate']) : undefined,
        processedDate: result['dha:ProcessedDate'] ? new Date(result['dha:ProcessedDate']) : undefined,
        approvedAmount: Number(result['dha:ApprovedAmount']) || undefined,
        rejectedAmount: Number(result['dha:RejectedAmount']) || undefined,
        remittanceAdviceId: result['dha:RemittanceID'],
      };
    } catch (error) {
      logger.error('[DHA] Failed to parse status response:', error);
      return {
        success: false,
        claimReference,
        status: 'PENDING',
      };
    }
  }

  /**
   * Get remittance advice
   */
  async getRemittanceAdvice(
    hospitalId: string,
    remittanceId: string
  ): Promise<RemittanceAdvice | null> {
    const config = await this.getConfig(hospitalId);

    if (!config) {
      return this.getMockRemittanceAdvice(remittanceId);
    }

    const { credentials, mode } = config;
    const urls = this.getUrls(mode);

    const body = {
      'dha:RemittanceRequest': {
        'dha:RemittanceID': remittanceId,
      },
    };

    const xmlRequest = this.buildRequestEnvelope(credentials, body);

    try {
      const response = await this.sendRequest(urls.remittanceUrl, xmlRequest);
      return this.parseRemittanceResponse(response, remittanceId);
    } catch (error: any) {
      logger.error('[DHA] Remittance retrieval failed:', error.message);
      return null;
    }
  }

  /**
   * Parse remittance response
   */
  private parseRemittanceResponse(xmlResponse: any, remittanceId: string): RemittanceAdvice | null {
    try {
      const envelope = xmlResponse['soap:Envelope'] || xmlResponse;
      const body = envelope['soap:Body'] || envelope;
      const result = body['dha:RemittanceResponse'] || body;

      if (!result || result['dha:ErrorCode']) {
        return null;
      }

      const claims = Array.isArray(result['dha:Claims']?.['dha:Claim'])
        ? result['dha:Claims']['dha:Claim']
        : [result['dha:Claims']?.['dha:Claim']].filter(Boolean);

      return {
        remittanceId,
        paymentDate: new Date(result['dha:PaymentDate']),
        paymentMethod: result['dha:PaymentMethod'],
        paymentReference: result['dha:PaymentReference'],
        totalPaid: Number(result['dha:TotalPaid']) || 0,
        claims: claims.map((c: any) => ({
          claimReference: c['dha:ClaimReference'],
          approvedAmount: Number(c['dha:ApprovedAmount']) || 0,
          paidAmount: Number(c['dha:PaidAmount']) || 0,
          adjustments: [],
        })),
      };
    } catch (error) {
      logger.error('[DHA] Failed to parse remittance response:', error);
      return null;
    }
  }

  // ==================== MOCK RESPONSES (Sandbox Mode) ====================

  /**
   * Mock eligibility response for sandbox/testing
   */
  private getMockEligibilityResponse(request: EligibilityRequest): EligibilityResponse {
    logger.info('[DHA-MOCK] Returning mock eligibility for:', request.emiratesId);

    // Simulate different scenarios based on Emirates ID
    const lastDigit = request.emiratesId.slice(-1);

    // Test cases:
    // - Ends in 0: No insurance found
    // - Ends in 1: Expired policy
    // - Ends in 2: Out of network
    // - Others: Active in-network policy

    if (lastDigit === '0') {
      return {
        success: false,
        policyStatus: 'NOT_FOUND',
        networkStatus: 'UNKNOWN',
        errorCode: 'MEMBER_NOT_FOUND',
        errorMessage: 'No active insurance policy found for this Emirates ID',
      };
    }

    if (lastDigit === '1') {
      return {
        success: true,
        memberId: `MEM${request.emiratesId.slice(-6)}`,
        memberName: 'Test Member (Expired)',
        payerId: 'DAMAN',
        payerName: 'Daman National Health Insurance',
        policyNumber: `POL${Date.now()}`,
        policyStatus: 'EXPIRED',
        effectiveDate: new Date('2023-01-01'),
        expiryDate: new Date('2024-12-31'),
        networkStatus: 'IN_NETWORK',
        coveragePercentage: 80,
      };
    }

    if (lastDigit === '2') {
      return {
        success: true,
        memberId: `MEM${request.emiratesId.slice(-6)}`,
        memberName: 'Test Member (OON)',
        payerId: 'ADNIC',
        payerName: 'Abu Dhabi National Insurance Company',
        policyNumber: `POL${Date.now()}`,
        policyStatus: 'ACTIVE',
        effectiveDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-12-31'),
        networkStatus: 'OUT_OF_NETWORK',
        coveragePercentage: 50,
        copayAmount: 50,
      };
    }

    // Default: Active in-network
    return {
      success: true,
      memberId: `MEM${request.emiratesId.slice(-6)}`,
      memberName: 'Test Member',
      payerId: 'DAMAN',
      payerName: 'Daman National Health Insurance',
      policyNumber: `POL${Date.now()}`,
      policyStatus: 'ACTIVE',
      effectiveDate: new Date('2024-01-01'),
      expiryDate: new Date('2025-12-31'),
      networkStatus: 'IN_NETWORK',
      planType: 'Enhanced',
      coveragePercentage: 80,
      copayAmount: 20,
      deductible: {
        annual: 500,
        used: 200,
        remaining: 300,
      },
      benefits: {
        consultation: { limit: 5000, used: 500, remaining: 4500 },
        laboratory: { limit: 10000, used: 1000, remaining: 9000 },
        radiology: { limit: 15000, used: 0, remaining: 15000 },
        pharmacy: { limit: 8000, used: 2000, remaining: 6000 },
      },
    };
  }

  /**
   * Mock claim submission response
   */
  private getMockClaimSubmissionResponse(claim: ClaimSubmissionRequest): ClaimSubmissionResponse {
    logger.info('[DHA-MOCK] Returning mock claim submission for:', claim.header.claimId);

    return {
      success: true,
      transactionId: `TXN${Date.now()}`,
      claimReference: `DHA${Date.now().toString(36).toUpperCase()}`,
      receivedDate: new Date(),
      status: 'ACCEPTED',
    };
  }

  /**
   * Mock claim status response
   */
  private getMockClaimStatusResponse(claimReference: string): ClaimStatusResponse {
    logger.info('[DHA-MOCK] Returning mock claim status for:', claimReference);

    // Simulate random status
    const statuses: ClaimStatusResponse['status'][] = ['PENDING', 'IN_REVIEW', 'APPROVED'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      success: true,
      claimReference,
      status: randomStatus,
      submissionDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      processedDate: randomStatus !== 'PENDING' ? new Date() : undefined,
      approvedAmount: randomStatus === 'APPROVED' ? 500 : undefined,
    };
  }

  /**
   * Mock remittance advice
   */
  private getMockRemittanceAdvice(remittanceId: string): RemittanceAdvice {
    logger.info('[DHA-MOCK] Returning mock remittance for:', remittanceId);

    return {
      remittanceId,
      paymentDate: new Date(),
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: `PAY${Date.now()}`,
      totalPaid: 5000,
      claims: [
        {
          claimReference: `DHA${Date.now().toString(36).toUpperCase()}`,
          approvedAmount: 5000,
          paidAmount: 5000,
          adjustments: [],
        },
      ],
    };
  }

  /**
   * Check if DHA integration is configured for a hospital
   */
  async isConfigured(hospitalId: string): Promise<boolean> {
    const config = await this.getConfig(hospitalId);
    return config !== null;
  }

  /**
   * Get current mode (sandbox/production) from hospital settings
   */
  async getMode(hospitalId: string): Promise<'sandbox' | 'production'> {
    const config = await this.getConfig(hospitalId);
    return config?.mode || 'sandbox';
  }

  /**
   * Submit pre-authorization request to DHA eClaimLink
   */
  async submitPreAuth(
    hospitalId: string,
    preAuthId: string,
    data: {
      patientId: string;
      procedureCPTCode: string;
      diagnosisICDCode?: string;
      urgency?: string;
    }
  ): Promise<{
    approved: boolean;
    pending: boolean;
    authorizationNumber?: string;
    denialReason?: string;
    transactionId?: string;
  }> {
    const config = await this.getConfig(hospitalId);
    if (!config) {
      throw new Error('DHA eClaimLink is not configured for this hospital');
    }

    // In sandbox mode, simulate a response
    if (config.mode === 'sandbox') {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate approval for most cases, denial for some CPT codes
      const denialCodes = ['99999', '00000'];
      const isApproved = !denialCodes.includes(data.procedureCPTCode);
      
      return {
        approved: isApproved,
        pending: false,
        authorizationNumber: isApproved ? `DHA-PRE-${Date.now()}` : undefined,
        denialReason: isApproved ? undefined : 'Procedure not covered under current plan (sandbox test)',
        transactionId: `TXN-${Date.now()}`,
      };
    }

    // Production mode - call actual DHA API
    // TODO: Implement actual DHA eClaimLink pre-auth API call
    // For now, return as pending for manual follow-up
    return {
      approved: false,
      pending: true,
      transactionId: `TXN-${Date.now()}`,
    };
  }
}

export const dhaEClaimService = new DHAEClaimService();
