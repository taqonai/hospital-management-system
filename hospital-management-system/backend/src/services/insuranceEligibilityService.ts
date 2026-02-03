import prisma from '../config/database';
import logger from '../utils/logger';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import axios from 'axios';

/**
 * Insurance Eligibility Service
 * Handles real-time eligibility verification with UAE insurance payers
 * Integrates with DHA eClaimLink for eligibility checks
 */

// ==================== Type Definitions ====================

export interface EligibilityCheckRequest {
  patientId?: string;
  emiratesId?: string;
  memberId?: string;
  payerCode?: string;
  serviceDate?: Date;
}

export interface EligibilityResponse {
  eligible: boolean;
  emiratesId?: string;
  memberId?: string;
  patientName?: string;
  
  // Insurance Details
  insuranceProvider?: string;
  policyNumber?: string;
  policyStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'NOT_FOUND';
  policyStartDate?: Date;
  policyEndDate?: Date;
  networkStatus: 'IN_NETWORK' | 'OUT_OF_NETWORK' | 'UNKNOWN';
  planType?: string;
  
  // Coverage Details
  coveragePercentage?: number;
  copayPercentage?: number;
  copayAmount?: number;
  
  // Benefits & Limits
  remainingBenefits?: {
    consultation?: number;
    pharmacy?: number;
    laboratory?: number;
    imaging?: number;
    total?: number;
  };
  
  // Deductible Tracking
  deductible?: {
    annual: number;
    used: number;
    remaining: number;
  };
  
  // Annual Copay Cap
  annualCopay?: {
    max: number;
    used: number;
    remaining: number;
  };
  
  // Validation Messages
  message?: string;
  warnings?: string[];
  
  // Verification Details
  verifiedAt?: Date;
  verificationSource: 'CACHED' | 'DHA_ECLAIM' | 'PAYER_API' | 'MANUAL';
  transactionId?: string;
}

export interface DHAEClaimLinkConfig {
  baseUrl: string;
  facilityId: string;
  licenseNumber: string;
  apiKey: string;
  enabled: boolean;
}

// ==================== Service Implementation ====================

class InsuranceEligibilityService {
  private dhaConfig: DHAEClaimLinkConfig | null = null;
  
  /**
   * Initialize DHA eClaimLink configuration
   * In production, this would be loaded from environment or database
   */
  private async getDHAConfig(hospitalId: string): Promise<DHAEClaimLinkConfig | null> {
    // For now, return mock config - in production, load from hospital settings
    // TODO: Load from hospitalSettings table or environment variables
    return {
      baseUrl: process.env.DHA_ECLAIM_URL || 'https://eclaimlink.dha.gov.ae/api/v1',
      facilityId: process.env.DHA_FACILITY_ID || '',
      licenseNumber: process.env.DHA_LICENSE_NUMBER || '',
      apiKey: process.env.DHA_API_KEY || '',
      enabled: process.env.DHA_ECLAIM_ENABLED === 'true',
    };
  }

  /**
   * Verify insurance eligibility by Emirates ID
   * Primary method for UAE HMS - uses Emirates ID to look up coverage
   */
  async verifyEligibilityByEmiratesId(
    hospitalId: string,
    emiratesId: string,
    serviceDate?: Date
  ): Promise<EligibilityResponse> {
    logger.info(`[Eligibility] Verifying by Emirates ID: ${emiratesId.substring(0, 5)}****`);
    
    // Normalize Emirates ID (remove dashes/spaces)
    const normalizedEid = emiratesId.replace(/[-\s]/g, '').toUpperCase();
    
    // First, check if patient exists in our system with this Emirates ID
    const patient = await prisma.patient.findFirst({
      where: {
        hospitalId,
        emiratesId: normalizedEid,
        isActive: true,
      },
      include: {
        insurances: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    // Check if DHA integration is enabled
    const dhaConfig = await this.getDHAConfig(hospitalId);
    
    if (dhaConfig?.enabled) {
      // In production: Call DHA eClaimLink API
      try {
        const dhaResponse = await this.callDHAEligibilityAPI(dhaConfig, normalizedEid, serviceDate);
        
        // If patient exists, update their insurance info from DHA response
        if (patient && dhaResponse.eligible) {
          await this.syncInsuranceFromDHA(patient.id, dhaResponse);
        }
        
        return dhaResponse;
      } catch (error) {
        logger.error('[Eligibility] DHA API call failed, falling back to cached data', { error });
        // Fall back to cached data
      }
    }
    
    // Fall back to cached insurance data from database
    return this.getEligibilityFromCache(hospitalId, patient, normalizedEid);
  }

  /**
   * Verify eligibility by patient ID (uses stored insurance data)
   */
  async verifyEligibilityByPatientId(
    patientId: string,
    hospitalId: string
  ): Promise<EligibilityResponse> {
    logger.info(`[Eligibility] Verifying by Patient ID: ${patientId}`);
    
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId,
        isActive: true,
      },
      include: {
        insurances: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // If patient has Emirates ID, try real-time verification
    if (patient.emiratesId) {
      return this.verifyEligibilityByEmiratesId(hospitalId, patient.emiratesId);
    }

    // Otherwise, use cached insurance data
    return this.getEligibilityFromCache(hospitalId, patient);
  }

  /**
   * Get eligibility from cached database records
   */
  private async getEligibilityFromCache(
    hospitalId: string,
    patient: any,
    emiratesId?: string
  ): Promise<EligibilityResponse> {
    // Base response for no insurance
    const noInsuranceResponse: EligibilityResponse = {
      eligible: false,
      emiratesId,
      policyStatus: 'NOT_FOUND',
      networkStatus: 'UNKNOWN',
      verificationSource: 'CACHED',
      message: 'No active insurance found. Patient will be treated as self-pay.',
      verifiedAt: new Date(),
    };

    if (!patient) {
      return {
        ...noInsuranceResponse,
        message: 'Patient not found in system. Please register the patient first.',
      };
    }

    // Get primary insurance
    const primaryInsurance = patient.insurances?.[0];
    
    if (!primaryInsurance) {
      return {
        ...noInsuranceResponse,
        patientName: `${patient.firstName} ${patient.lastName}`,
      };
    }

    // Check if insurance is expired
    const now = new Date();
    const expiryDate = primaryInsurance.expiryDate ? new Date(primaryInsurance.expiryDate) : null;
    
    if (expiryDate && expiryDate < now) {
      return {
        eligible: false,
        emiratesId: patient.emiratesId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        insuranceProvider: primaryInsurance.providerName,
        policyNumber: primaryInsurance.policyNumber,
        policyStatus: 'EXPIRED',
        policyStartDate: primaryInsurance.effectiveDate,
        policyEndDate: expiryDate,
        networkStatus: (primaryInsurance.networkTier as any) || 'IN_NETWORK',
        verificationSource: 'CACHED',
        message: 'Insurance policy has expired. Please update insurance or treat as self-pay.',
        verifiedAt: new Date(),
      };
    }

    // Calculate remaining benefits (from copay payments this year)
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    
    const copayPayments = await prisma.copayPayment.aggregate({
      where: {
        patientId: patient.id,
        paymentDate: { gte: yearStart },
      },
      _sum: { amount: true },
    });
    
    const annualCopayUsed = Number(copayPayments._sum.amount || 0);
    const annualCopayMax = Number(primaryInsurance.annualCopayMax || 0);
    const annualDeductible = Number(primaryInsurance.annualDeductible || 0);

    // Return active insurance details
    return {
      eligible: true,
      emiratesId: patient.emiratesId,
      memberId: primaryInsurance.subscriberId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      
      insuranceProvider: primaryInsurance.providerName,
      policyNumber: primaryInsurance.policyNumber,
      policyStatus: 'ACTIVE',
      policyStartDate: primaryInsurance.effectiveDate,
      policyEndDate: primaryInsurance.expiryDate,
      networkStatus: (primaryInsurance.networkTier as any) || 'IN_NETWORK',
      planType: primaryInsurance.coverageType,
      
      coveragePercentage: 100 - Number(primaryInsurance.copayPercentage || 20),
      copayPercentage: Number(primaryInsurance.copayPercentage || 20),
      copayAmount: Number(primaryInsurance.copay || 0),
      
      deductible: {
        annual: annualDeductible,
        used: Math.min(annualCopayUsed, annualDeductible),
        remaining: Math.max(0, annualDeductible - annualCopayUsed),
      },
      
      annualCopay: annualCopayMax > 0 ? {
        max: annualCopayMax,
        used: annualCopayUsed,
        remaining: Math.max(0, annualCopayMax - annualCopayUsed),
      } : undefined,
      
      verificationSource: 'CACHED',
      message: 'Insurance verified from cached records. For real-time verification, enable DHA eClaimLink integration.',
      verifiedAt: new Date(),
    };
  }

  /**
   * Call DHA eClaimLink API for real-time eligibility check
   * Implements actual DHA API integration using XML SOAP protocol
   */
  private async callDHAEligibilityAPI(
    config: DHAEClaimLinkConfig,
    emiratesId: string,
    serviceDate?: Date
  ): Promise<EligibilityResponse> {
    logger.info('[Eligibility] Calling DHA eClaimLink API...');
    
    const serviceDateStr = (serviceDate || new Date()).toISOString().split('T')[0];
    
    // Build SOAP XML request for eligibility check
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ecl="http://dha.gov.ae/eclaimlink">
  <soap:Header>
    <ecl:Authentication>
      <ecl:FacilityID>${config.facilityId}</ecl:FacilityID>
      <ecl:LicenseNumber>${config.licenseNumber}</ecl:LicenseNumber>
      <ecl:APIKey>${config.apiKey}</ecl:APIKey>
    </ecl:Authentication>
  </soap:Header>
  <soap:Body>
    <ecl:EligibilityRequest>
      <ecl:EmiratesID>${emiratesId}</ecl:EmiratesID>
      <ecl:ServiceDate>${serviceDateStr}</ecl:ServiceDate>
      <ecl:ServiceType>OPD</ecl:ServiceType>
    </ecl:EligibilityRequest>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await axios.post(
        `${config.baseUrl}/eligibility/check`,
        soapRequest,
        {
          headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      // Parse XML response
      const xmlResponse = response.data;
      return this.parseDHAEligibilityResponse(xmlResponse, emiratesId);
    } catch (error: any) {
      logger.error('[Eligibility] DHA API call failed', { 
        error: error.message,
        status: error.response?.status,
        data: error.response?.data 
      });
      
      // If DHA API is down or unreachable, throw to fall back to cached data
      throw new Error(`DHA eClaimLink API error: ${error.message}`);
    }
  }

  /**
   * Parse DHA eClaimLink XML response into EligibilityResponse
   */
  private parseDHAEligibilityResponse(xmlResponse: string, emiratesId: string): EligibilityResponse {
    try {
      // Simple XML parsing - in production, use a proper XML parser like xml2js or fast-xml-parser
      // This handles the most common response format
      
      const getTagValue = (xml: string, tag: string): string | undefined => {
        const regex = new RegExp(`<[^:]*:?${tag}[^>]*>([^<]*)<\/[^:]*:?${tag}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1].trim() : undefined;
      };

      const statusCode = getTagValue(xmlResponse, 'StatusCode');
      const statusMessage = getTagValue(xmlResponse, 'StatusMessage');
      
      // Check for error response
      if (statusCode === 'ERROR' || statusCode === 'INVALID') {
        return {
          eligible: false,
          emiratesId,
          policyStatus: 'NOT_FOUND',
          networkStatus: 'UNKNOWN',
          verificationSource: 'DHA_ECLAIM',
          message: statusMessage || 'Unable to verify eligibility with DHA',
          verifiedAt: new Date(),
        };
      }

      // Parse successful response
      const policyStatus = getTagValue(xmlResponse, 'PolicyStatus') as any || 'ACTIVE';
      const isEligible = policyStatus === 'ACTIVE' || policyStatus === 'VALID';

      return {
        eligible: isEligible,
        emiratesId,
        memberId: getTagValue(xmlResponse, 'MemberID'),
        patientName: getTagValue(xmlResponse, 'PatientName'),
        insuranceProvider: getTagValue(xmlResponse, 'PayerName') || getTagValue(xmlResponse, 'InsuranceProvider'),
        policyNumber: getTagValue(xmlResponse, 'PolicyNumber'),
        policyStatus: policyStatus,
        policyStartDate: getTagValue(xmlResponse, 'EffectiveDate') ? new Date(getTagValue(xmlResponse, 'EffectiveDate')!) : undefined,
        policyEndDate: getTagValue(xmlResponse, 'ExpiryDate') ? new Date(getTagValue(xmlResponse, 'ExpiryDate')!) : undefined,
        networkStatus: (getTagValue(xmlResponse, 'NetworkStatus') as any) || 'IN_NETWORK',
        planType: getTagValue(xmlResponse, 'PlanType') || getTagValue(xmlResponse, 'CoverageType'),
        coveragePercentage: getTagValue(xmlResponse, 'CoveragePercent') ? Number(getTagValue(xmlResponse, 'CoveragePercent')) : undefined,
        copayPercentage: getTagValue(xmlResponse, 'CopayPercent') ? Number(getTagValue(xmlResponse, 'CopayPercent')) : undefined,
        copayAmount: getTagValue(xmlResponse, 'CopayAmount') ? Number(getTagValue(xmlResponse, 'CopayAmount')) : undefined,
        deductible: getTagValue(xmlResponse, 'AnnualDeductible') ? {
          annual: Number(getTagValue(xmlResponse, 'AnnualDeductible')),
          used: Number(getTagValue(xmlResponse, 'DeductibleUsed') || 0),
          remaining: Number(getTagValue(xmlResponse, 'DeductibleRemaining') || getTagValue(xmlResponse, 'AnnualDeductible')),
        } : undefined,
        annualCopay: getTagValue(xmlResponse, 'AnnualCopayMax') ? {
          max: Number(getTagValue(xmlResponse, 'AnnualCopayMax')),
          used: Number(getTagValue(xmlResponse, 'CopayUsed') || 0),
          remaining: Number(getTagValue(xmlResponse, 'CopayRemaining') || getTagValue(xmlResponse, 'AnnualCopayMax')),
        } : undefined,
        verificationSource: 'DHA_ECLAIM',
        transactionId: getTagValue(xmlResponse, 'TransactionID'),
        message: isEligible ? 'Insurance verified via DHA eClaimLink' : statusMessage,
        verifiedAt: new Date(),
      };
    } catch (error: any) {
      logger.error('[Eligibility] Failed to parse DHA response', { error: error.message, xmlResponse: xmlResponse.substring(0, 500) });
      throw new Error('Failed to parse DHA eligibility response');
    }
  }

  /**
   * Sync insurance information from DHA response to patient record
   */
  private async syncInsuranceFromDHA(patientId: string, dhaResponse: EligibilityResponse): Promise<void> {
    if (!dhaResponse.eligible || !dhaResponse.insuranceProvider) {
      return;
    }

    logger.info(`[Eligibility] Syncing insurance from DHA for patient ${patientId}`);
    
    // Check if insurance already exists
    const existingInsurance = await prisma.patientInsurance.findFirst({
      where: {
        patientId,
        policyNumber: dhaResponse.policyNumber,
        isActive: true,
      },
    });

    if (existingInsurance) {
      // Update existing insurance with DHA data
      await prisma.patientInsurance.update({
        where: { id: existingInsurance.id },
        data: {
          providerName: dhaResponse.insuranceProvider,
          coverageType: dhaResponse.planType || existingInsurance.coverageType,
          networkTier: dhaResponse.networkStatus,
          effectiveDate: dhaResponse.policyStartDate || existingInsurance.effectiveDate,
          expiryDate: dhaResponse.policyEndDate,
          copayPercentage: dhaResponse.copayPercentage,
          copay: dhaResponse.copayAmount,
          annualCopayMax: dhaResponse.annualCopay?.max,
          annualDeductible: dhaResponse.deductible?.annual,
        },
      });
    } else {
      // Create new insurance record from DHA data
      await prisma.patientInsurance.create({
        data: {
          patientId,
          providerName: dhaResponse.insuranceProvider!,
          policyNumber: dhaResponse.policyNumber || 'DHA-AUTO',
          subscriberName: dhaResponse.patientName || '',
          subscriberId: dhaResponse.memberId || '',
          relationship: 'Self',
          coverageType: dhaResponse.planType || 'Basic',
          networkTier: dhaResponse.networkStatus,
          effectiveDate: dhaResponse.policyStartDate || new Date(),
          expiryDate: dhaResponse.policyEndDate,
          copayPercentage: dhaResponse.copayPercentage,
          copay: dhaResponse.copayAmount,
          annualCopayMax: dhaResponse.annualCopay?.max,
          annualDeductible: dhaResponse.deductible?.annual,
          isPrimary: true,
          isActive: true,
        },
      });
    }
  }

  /**
   * Search for patient by Emirates ID and return eligibility
   * Main entry point for OPD check-in flow
   */
  async lookupByEmiratesId(
    hospitalId: string,
    emiratesId: string
  ): Promise<{
    patient: any | null;
    eligibility: EligibilityResponse;
  }> {
    const normalizedEid = emiratesId.replace(/[-\s]/g, '').toUpperCase();
    
    // Find patient by Emirates ID
    const patient = await prisma.patient.findFirst({
      where: {
        hospitalId,
        emiratesId: normalizedEid,
        isActive: true,
      },
      include: {
        insurances: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    // Get eligibility
    const eligibility = await this.verifyEligibilityByEmiratesId(hospitalId, normalizedEid);

    return {
      patient: patient ? {
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        emiratesId: patient.emiratesId,
        hasInsurance: patient.insurances.length > 0,
        primaryInsurance: patient.insurances[0] || null,
      } : null,
      eligibility,
    };
  }
}

// Export singleton instance
export const insuranceEligibilityService = new InsuranceEligibilityService();
