import prisma from '../config/database';
import logger from '../utils/logger';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import axios from 'axios';
import { dhaEClaimService } from './dhaEClaimService';
import type { EligibilityResponse as DHAEligibilityResponse } from './dhaEClaimService';

/**
 * Insurance Eligibility Service
 * Handles real-time eligibility verification with UAE insurance payers
 * Integrates with DHA eClaimLink for eligibility checks
 * 
 * CROSS-VERIFICATION SCENARIOS:
 * A: Insurance Mismatch Alert (DB has insurance, DHA says NO/DIFFERENT)
 * B: Policy Expired + Auto-Renewal (DB expired, DHA active → auto-update)
 * C: Force EID Verification (Name/MRN check-in → prompt for EID verification)
 * D: Coverage Change Warning (coverage terms changed since last visit)
 */

// ==================== Type Definitions ====================

export interface EligibilityCheckRequest {
  patientId?: string;
  emiratesId?: string;
  memberId?: string;
  payerCode?: string;
  serviceDate?: Date;
}

// Alert types for cross-verification scenarios
export type VerificationAlertType = 
  | 'MISMATCH_DB_VS_DHA'      // Scenario A: DB has insurance, DHA says different/none
  | 'POLICY_RENEWED'          // Scenario B: DB expired, DHA says active
  | 'POLICY_CHANGED'          // Scenario D: Coverage terms changed
  | 'EID_VERIFICATION_NEEDED' // Scenario C: Should verify via Emirates ID
  | 'PROVIDER_CHANGED'        // Provider changed from last visit
  | 'COVERAGE_REDUCED'        // Coverage percentage reduced
  | 'COPAY_INCREASED';        // Copay amount increased

export interface VerificationAlert {
  type: VerificationAlertType;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  details?: {
    dbValue?: string | number;
    dhaValue?: string | number;
    field?: string;
  };
  actions?: Array<{
    label: string;
    action: 'USE_DB_DATA' | 'USE_DHA_DATA' | 'TREAT_AS_SELFPAY' | 'UPDATE_INSURANCE' | 'VERIFY_EID';
  }>;
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
  
  // NEW: Cross-Verification Alerts (Scenarios A, B, C, D)
  alerts?: VerificationAlert[];
  
  // NEW: Flags for UI handling
  requiresEidVerification?: boolean;  // Scenario C
  policyWasRenewed?: boolean;         // Scenario B
  coverageChanged?: boolean;          // Scenario D
  hasMismatch?: boolean;              // Scenario A
  
  // NEW: Previous values for comparison
  previousCoverage?: {
    provider?: string;
    coveragePercentage?: number;
    copayPercentage?: number;
    copayAmount?: number;
  };
  
  // Verification Details
  verifiedAt?: Date;
  verificationSource: 'CACHED' | 'DHA_ECLAIM' | 'PAYER_API' | 'MANUAL';
  transactionId?: string;

  // GAP 5: Data source indicator for UI banners
  dataSource?: 'DHA_LIVE' | 'DHA_SANDBOX' | 'MOCK_DATA' | 'CACHED_DB' | 'NOT_CONFIGURED';
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
   */
  private async getDHAConfig(hospitalId: string): Promise<DHAEClaimLinkConfig | null> {
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
   * Implements cross-verification scenarios A, B, D
   */
  async verifyEligibilityByEmiratesId(
    hospitalId: string,
    emiratesId: string,
    serviceDate?: Date
  ): Promise<EligibilityResponse> {
    logger.info(`[Eligibility] Verifying by Emirates ID: ${emiratesId.substring(0, 5)}****`);
    
    const normalizedEid = emiratesId.replace(/[-\s]/g, '').toUpperCase();
    const alerts: VerificationAlert[] = [];
    
    // First, check if patient exists in our system with this Emirates ID
    // Search for both normalized (no dashes) and original format (with dashes)
    const patient = await prisma.patient.findFirst({
      where: {
        hospitalId,
        isActive: true,
        OR: [
          { emiratesId: normalizedEid },
          { emiratesId: emiratesId },
          { emiratesId: emiratesId.toUpperCase() },
        ],
      },
      include: {
        insurances: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    const dbInsurance = patient?.insurances?.[0] || null;

    // Try DHA verification via dhaEClaimService (config from hospital_settings DB)
    const dhaConfigured = await dhaEClaimService.isConfigured(hospitalId);
    if (dhaConfigured) {
      try {
        const rawDha = await dhaEClaimService.verifyEligibility(hospitalId, {
          emiratesId: normalizedEid,
          serviceDate,
        });

        // Map dhaEClaimService response to our EligibilityResponse format
        const dhaResponse = this.mapDHAResponse(rawDha, normalizedEid);

        // CROSS-VERIFICATION: Compare DHA vs DB
        if (patient && dbInsurance) {
          const crossVerification = await this.crossVerifyInsurance(
            patient.id,
            dbInsurance,
            dhaResponse,
            alerts
          );

          // Return cross-verified response with alerts
          return {
            ...crossVerification,
            alerts: alerts.length > 0 ? alerts : undefined,
          };
        }

        // No DB record - just return DHA response
        if (dhaResponse.eligible && patient) {
          await this.syncInsuranceFromDHA(patient.id, dhaResponse);
        }

        return dhaResponse;
      } catch (error) {
        logger.error('[Eligibility] DHA API call failed, falling back to cached data', { error });
        // Fall back to cached data with warning
        alerts.push({
          type: 'EID_VERIFICATION_NEEDED',
          severity: 'WARNING',
          title: 'DHA Verification Unavailable',
          message: 'Could not verify with DHA. Using cached insurance data.',
          actions: [
            { label: 'Use Cached Data', action: 'USE_DB_DATA' },
            { label: 'Retry Verification', action: 'VERIFY_EID' },
          ],
        });
      }
    }
    
    // Fall back to cached insurance data from database
    const cachedResponse = await this.getEligibilityFromCache(hospitalId, patient, normalizedEid);
    return {
      ...cachedResponse,
      alerts: alerts.length > 0 ? alerts : undefined,
    };
  }

  /**
   * CROSS-VERIFICATION: Compare DB insurance with DHA response
   * Implements Scenarios A, B, D
   */
  private async crossVerifyInsurance(
    patientId: string,
    dbInsurance: any,
    dhaResponse: EligibilityResponse,
    alerts: VerificationAlert[]
  ): Promise<EligibilityResponse> {
    const now = new Date();
    const dbExpired = dbInsurance.expiryDate && new Date(dbInsurance.expiryDate) < now;
    
    // Store previous values for comparison
    const previousCoverage = {
      provider: dbInsurance.providerName,
      coveragePercentage: 100 - Number(dbInsurance.copayPercentage || 20),
      copayPercentage: Number(dbInsurance.copayPercentage || 20),
      copayAmount: Number(dbInsurance.copay || 0),
    };

    // ==================== SCENARIO A: Insurance Mismatch ====================
    // DB has insurance but DHA says NOT eligible or NOT FOUND
    if (!dhaResponse.eligible && dbInsurance) {
      alerts.push({
        type: 'MISMATCH_DB_VS_DHA',
        severity: 'ERROR',
        title: 'Insurance Verification Failed',
        message: `Our records show ${dbInsurance.providerName} (${dbInsurance.policyNumber}), but DHA could not verify this coverage.`,
        details: {
          dbValue: `${dbInsurance.providerName} - ${dbInsurance.policyNumber}`,
          dhaValue: 'Not Found / Not Eligible',
          field: 'insurance',
        },
        actions: [
          { label: 'Use Cached Data', action: 'USE_DB_DATA' },
          { label: 'Treat as Self-Pay', action: 'TREAT_AS_SELFPAY' },
          { label: 'Update Insurance', action: 'UPDATE_INSURANCE' },
        ],
      });

      return {
        eligible: false,
        emiratesId: dhaResponse.emiratesId,
        patientName: dhaResponse.patientName,
        insuranceProvider: dbInsurance.providerName,
        policyNumber: dbInsurance.policyNumber,
        policyStatus: 'INACTIVE',
        networkStatus: dbInsurance.networkTier || 'UNKNOWN',
        planType: dbInsurance.coverageType,
        coveragePercentage: previousCoverage.coveragePercentage,
        copayPercentage: previousCoverage.copayPercentage,
        message: 'Insurance mismatch detected. DHA cannot verify the policy on file.',
        hasMismatch: true,
        previousCoverage,
        verificationSource: 'DHA_ECLAIM',
        verifiedAt: new Date(),
      };
    }

    // ==================== SCENARIO B: Policy Renewed ====================
    // DB shows expired but DHA says ACTIVE
    if (dbExpired && dhaResponse.eligible) {
      logger.info(`[Eligibility] Policy renewed detected for patient ${patientId}`);
      
      // Auto-update the insurance in DB
      await this.syncInsuranceFromDHA(patientId, dhaResponse);
      
      alerts.push({
        type: 'POLICY_RENEWED',
        severity: 'INFO',
        title: 'Insurance Policy Renewed!',
        message: `Good news! The insurance policy has been renewed. Updated from DHA records.`,
        details: {
          dbValue: `Expired: ${new Date(dbInsurance.expiryDate).toLocaleDateString()}`,
          dhaValue: `Active until: ${dhaResponse.policyEndDate ? new Date(dhaResponse.policyEndDate).toLocaleDateString() : 'Unknown'}`,
          field: 'expiryDate',
        },
      });

      return {
        ...dhaResponse,
        policyWasRenewed: true,
        previousCoverage,
        message: 'Insurance policy has been renewed and records updated.',
      };
    }

    // ==================== SCENARIO D: Coverage Changed ====================
    if (dhaResponse.eligible) {
      // Check for provider change
      if (dhaResponse.insuranceProvider && 
          dbInsurance.providerName && 
          dhaResponse.insuranceProvider.toLowerCase() !== dbInsurance.providerName.toLowerCase()) {
        alerts.push({
          type: 'PROVIDER_CHANGED',
          severity: 'WARNING',
          title: 'Insurance Provider Changed',
          message: `Insurance provider has changed from ${dbInsurance.providerName} to ${dhaResponse.insuranceProvider}.`,
          details: {
            dbValue: dbInsurance.providerName,
            dhaValue: dhaResponse.insuranceProvider,
            field: 'provider',
          },
        });
      }

      // Check for coverage reduction
      const dbCoverage = 100 - Number(dbInsurance.copayPercentage || 20);
      const dhaCoverage = dhaResponse.coveragePercentage || 80;
      if (dhaCoverage < dbCoverage - 5) { // More than 5% reduction
        alerts.push({
          type: 'COVERAGE_REDUCED',
          severity: 'WARNING',
          title: 'Coverage Reduced',
          message: `Insurance coverage has been reduced from ${dbCoverage}% to ${dhaCoverage}%.`,
          details: {
            dbValue: dbCoverage,
            dhaValue: dhaCoverage,
            field: 'coveragePercentage',
          },
        });
      }

      // Check for copay increase
      const dbCopay = Number(dbInsurance.copay || 0);
      const dhaCopay = dhaResponse.copayAmount || 0;
      if (dhaCopay > dbCopay + 10) { // More than AED 10 increase
        alerts.push({
          type: 'COPAY_INCREASED',
          severity: 'WARNING',
          title: 'Copay Amount Increased',
          message: `Copay has increased from AED ${dbCopay} to AED ${dhaCopay}.`,
          details: {
            dbValue: dbCopay,
            dhaValue: dhaCopay,
            field: 'copayAmount',
          },
        });
      }

      // Update DB with new values
      await this.syncInsuranceFromDHA(patientId, dhaResponse);

      const hasChanges = alerts.some(a => 
        ['PROVIDER_CHANGED', 'COVERAGE_REDUCED', 'COPAY_INCREASED', 'POLICY_CHANGED'].includes(a.type)
      );

      return {
        ...dhaResponse,
        coverageChanged: hasChanges,
        previousCoverage: hasChanges ? previousCoverage : undefined,
        message: hasChanges 
          ? 'Insurance verified. Some coverage terms have changed since last visit.' 
          : 'Insurance verified successfully via DHA.',
      };
    }

    // Default: Return DHA response
    return dhaResponse;
  }

  /**
   * Verify eligibility by patient ID (uses stored insurance data)
   * Implements Scenario C: Flag for EID verification if not verified via EID
   */
  async verifyEligibilityByPatientId(
    patientId: string,
    hospitalId: string,
    skipEidVerification: boolean = false
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

    const alerts: VerificationAlert[] = [];

    // SCENARIO C: If patient has Emirates ID but we're not verifying via EID
    if (patient.emiratesId && !skipEidVerification) {
      // Full verification via Emirates ID
      return this.verifyEligibilityByEmiratesId(hospitalId, patient.emiratesId);
    }

    // Patient selected via Name/MRN without Emirates ID verification
    // Add alert to prompt EID verification
    if (patient.emiratesId) {
      alerts.push({
        type: 'EID_VERIFICATION_NEEDED',
        severity: 'INFO',
        title: 'Emirates ID Verification Recommended',
        message: 'For accurate coverage information, verify insurance using Emirates ID.',
        actions: [
          { label: 'Verify Now', action: 'VERIFY_EID' },
          { label: 'Use Cached Data', action: 'USE_DB_DATA' },
        ],
      });
    } else {
      // No Emirates ID on file
      alerts.push({
        type: 'EID_VERIFICATION_NEEDED',
        severity: 'WARNING',
        title: 'Emirates ID Not on File',
        message: 'This patient does not have an Emirates ID registered. Insurance cannot be verified with DHA.',
        actions: [
          { label: 'Update Patient Info', action: 'UPDATE_INSURANCE' },
          { label: 'Continue with Cached Data', action: 'USE_DB_DATA' },
        ],
      });
    }

    // Use cached insurance data
    const cachedResponse = await this.getEligibilityFromCache(hospitalId, patient);
    return {
      ...cachedResponse,
      requiresEidVerification: true,
      alerts: alerts.length > 0 ? alerts : undefined,
    };
  }

  /**
   * Get eligibility from cached database records
   */
  private async getEligibilityFromCache(
    hospitalId: string,
    patient: any,
    emiratesId?: string
  ): Promise<EligibilityResponse> {
    const noInsuranceResponse: EligibilityResponse = {
      eligible: false,
      emiratesId,
      policyStatus: 'NOT_FOUND',
      networkStatus: 'UNKNOWN',
      verificationSource: 'CACHED',
      dataSource: 'CACHED_DB',
      message: 'No active insurance found. Patient will be treated as self-pay.',
      verifiedAt: new Date(),
    };

    if (!patient) {
      return {
        ...noInsuranceResponse,
        message: 'Patient not found in system. Please register the patient first.',
      };
    }

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
        coveragePercentage: 100 - Number(primaryInsurance.copayPercentage || 20),
        copayPercentage: Number(primaryInsurance.copayPercentage || 20),
        verificationSource: 'CACHED',
        dataSource: 'CACHED_DB',
        message: 'Insurance policy has expired. Please update insurance or treat as self-pay.',
        alerts: [{
          type: 'EID_VERIFICATION_NEEDED',
          severity: 'WARNING',
          title: 'Insurance Expired - Verify for Renewal',
          message: 'Policy appears expired. Verify with Emirates ID to check if it was renewed.',
          actions: [
            { label: 'Verify with Emirates ID', action: 'VERIFY_EID' },
            { label: 'Treat as Self-Pay', action: 'TREAT_AS_SELFPAY' },
            { label: 'Update Insurance', action: 'UPDATE_INSURANCE' },
          ],
        }],
        verifiedAt: new Date(),
      };
    }

    // Calculate remaining benefits
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
      dataSource: 'CACHED_DB',
      message: 'Insurance verified from cached records. For real-time verification, use Emirates ID lookup.',
      verifiedAt: new Date(),
    };
  }

  /**
   * Map dhaEClaimService response to our EligibilityResponse format
   */
  private mapDHAResponse(raw: DHAEligibilityResponse, emiratesId: string): EligibilityResponse {
    const eligible = raw.success && raw.policyStatus === 'ACTIVE';
    return {
      eligible,
      emiratesId,
      memberId: raw.memberId,
      patientName: raw.memberName,
      insuranceProvider: raw.payerName,
      policyNumber: raw.policyNumber,
      policyStatus: raw.policyStatus || 'NOT_FOUND',
      policyStartDate: raw.effectiveDate,
      policyEndDate: raw.expiryDate,
      networkStatus: raw.networkStatus || 'UNKNOWN',
      planType: raw.planType,
      coveragePercentage: raw.coveragePercentage,
      copayPercentage: raw.coveragePercentage ? (100 - raw.coveragePercentage) : undefined,
      copayAmount: raw.copayAmount,
      deductible: raw.deductible,
      remainingBenefits: raw.benefits ? {
        consultation: raw.benefits.consultation?.remaining,
        laboratory: raw.benefits.laboratory?.remaining,
        imaging: raw.benefits.radiology?.remaining,
        pharmacy: raw.benefits.pharmacy?.remaining,
      } : undefined,
      verificationSource: 'DHA_ECLAIM',
      verifiedAt: new Date(),
      dataSource: raw.dataSource,
      message: raw.errorMessage,
    };
  }

  /**
   * Call DHA eClaimLink API for real-time eligibility check
   */
  private async callDHAEligibilityAPI(
    config: DHAEClaimLinkConfig,
    emiratesId: string,
    serviceDate?: Date
  ): Promise<EligibilityResponse> {
    logger.info('[Eligibility] Calling DHA eClaimLink API...');
    
    const serviceDateStr = (serviceDate || new Date()).toISOString().split('T')[0];
    
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
          timeout: 30000,
        }
      );

      return this.parseDHAEligibilityResponse(response.data, emiratesId);
    } catch (error: any) {
      logger.error('[Eligibility] DHA API call failed', { 
        error: error.message,
        status: error.response?.status,
      });
      throw new Error(`DHA eClaimLink API error: ${error.message}`);
    }
  }

  /**
   * Parse DHA eClaimLink XML response
   */
  private parseDHAEligibilityResponse(xmlResponse: string, emiratesId: string): EligibilityResponse {
    try {
      const getTagValue = (xml: string, tag: string): string | undefined => {
        const regex = new RegExp(`<[^:]*:?${tag}[^>]*>([^<]*)<\/[^:]*:?${tag}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1].trim() : undefined;
      };

      const statusCode = getTagValue(xmlResponse, 'StatusCode');
      const statusMessage = getTagValue(xmlResponse, 'StatusMessage');
      
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

      const policyStatus = getTagValue(xmlResponse, 'PolicyStatus') as any || 'ACTIVE';
      const isEligible = policyStatus === 'ACTIVE' || policyStatus === 'VALID';

      return {
        eligible: isEligible,
        emiratesId,
        memberId: getTagValue(xmlResponse, 'MemberID'),
        patientName: getTagValue(xmlResponse, 'PatientName'),
        insuranceProvider: getTagValue(xmlResponse, 'PayerName') || getTagValue(xmlResponse, 'InsuranceProvider'),
        policyNumber: getTagValue(xmlResponse, 'PolicyNumber'),
        policyStatus,
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
      logger.error('[Eligibility] Failed to parse DHA response', { error: error.message });
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
    
    const existingInsurance = await prisma.patientInsurance.findFirst({
      where: {
        patientId,
        policyNumber: dhaResponse.policyNumber,
        isActive: true,
      },
    });

    const insuranceData = {
      providerName: dhaResponse.insuranceProvider,
      coverageType: dhaResponse.planType || 'Basic',
      networkTier: dhaResponse.networkStatus,
      effectiveDate: dhaResponse.policyStartDate || new Date(),
      expiryDate: dhaResponse.policyEndDate,
      copayPercentage: dhaResponse.copayPercentage,
      copay: dhaResponse.copayAmount,
      annualCopayMax: dhaResponse.annualCopay?.max,
      annualDeductible: dhaResponse.deductible?.annual,
      verificationSource: 'DHA_ECLAIM',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
    };

    if (existingInsurance) {
      await prisma.patientInsurance.update({
        where: { id: existingInsurance.id },
        data: insuranceData,
      });
    } else {
      // Deactivate other primary insurances
      await prisma.patientInsurance.updateMany({
        where: { patientId, isPrimary: true, isActive: true },
        data: { isPrimary: false },
      });
      
      await prisma.patientInsurance.create({
        data: {
          patientId,
          ...insuranceData,
          policyNumber: dhaResponse.policyNumber || 'DHA-AUTO',
          subscriberName: dhaResponse.patientName || '',
          subscriberId: dhaResponse.memberId || '',
          relationship: 'Self',
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

export const insuranceEligibilityService = new InsuranceEligibilityService();
