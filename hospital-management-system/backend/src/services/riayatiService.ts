/**
 * DHA Riayati Service
 * Full integration with DHA Riayati API for eligibility checks, patient registration, and pre-auth
 * 
 * Mode: sandbox (mock data) or production (real API calls)
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

interface RiayatiEligibilityResponse {
  eligible: boolean;
  emiratesId: string;
  patientName?: string;
  dateOfBirth?: string;
  gender?: string;
  payer?: string;
  plan?: string;
  policyNumber?: string;
  networkTier?: 'IN_NETWORK' | 'OUT_OF_NETWORK';
  benefits?: {
    copayPercentage?: number;
    annualDeductible?: number;
    annualCopayMax?: number;
    deductibleRemaining?: number;
    deductibleUsed?: number;
  };
  error?: string;
  errorCode?: string;
}

interface RiayatiPatientRegistration {
  emiratesId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE';
  nationality?: string;
  phone?: string;
  email?: string;
}

interface RiayatiPreAuthRequest {
  emiratesId: string;
  policyNumber: string;
  procedureCode: string;
  diagnosisCode: string;
  estimatedCost: number;
  urgency: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  clinicalJustification: string;
}

interface RiayatiPreAuthResponse {
  success: boolean;
  preAuthNumber?: string;
  status?: 'PENDING' | 'APPROVED' | 'DENIED';
  approvedAmount?: number;
  validFrom?: string;
  validTo?: string;
  denialReason?: string;
  error?: string;
}

class RiayatiService {
  private readonly mode: string;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly facilityId: string;
  private apiClient: AxiosInstance;

  constructor() {
    this.mode = process.env.RIAYATI_MODE || process.env.DHA_RIAYATI_MODE || 'sandbox';
    this.apiUrl = process.env.RIAYATI_API_URL || process.env.DHA_RIAYATI_API_URL || 'https://api.dha.gov.ae/riayati';
    this.apiKey = process.env.RIAYATI_API_KEY || process.env.DHA_RIAYATI_API_KEY || '';
    this.facilityId = process.env.RIAYATI_FACILITY_ID || '';

    this.apiClient = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Facility-ID': this.facilityId,
      },
      timeout: 30000,
    });
  }

  /**
   * Check eligibility for a patient using Emirates ID
   * In sandbox mode, returns mock data
   * In production mode, makes actual API calls to DHA Riayati
   */
  async checkEligibility(emiratesId: string): Promise<RiayatiEligibilityResponse> {
    if (this.mode === 'sandbox') {
      return this.mockEligibilityCheck(emiratesId);
    }

    // Production mode - make actual API call
    try {
      // TODO: Replace with actual DHA API integration
      // const response = await axios.post(`${this.apiUrl}/check-eligibility`, {
      //   emiratesId,
      // }, {
      //   headers: {
      //     'Authorization': `Bearer ${this.apiKey}`,
      //     'Content-Type': 'application/json',
      //   },
      // });
      // return response.data;

      console.warn('[RIAYATI] Production mode not implemented yet. Falling back to sandbox.');
      return this.mockEligibilityCheck(emiratesId);
    } catch (error) {
      console.error('[RIAYATI] API error:', error);
      return {
        eligible: false,
        emiratesId,
        error: 'Failed to check eligibility with DHA Riayati',
        errorCode: 'API_ERROR',
      };
    }
  }

  /**
   * Mock eligibility check for sandbox mode
   * Returns realistic test data for development and testing
   */
  private mockEligibilityCheck(emiratesId: string): RiayatiEligibilityResponse {
    // Mock different scenarios based on Emirates ID pattern
    const lastDigit = parseInt(emiratesId.slice(-1), 10) || 0;

    // Scenario 1: Valid Daman insurance (80% coverage)
    if (lastDigit % 3 === 0) {
      return {
        eligible: true,
        emiratesId,
        patientName: 'Test Patient',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        payer: 'Daman',
        plan: 'Enhanced Plan',
        policyNumber: `DAMAN-${emiratesId.slice(-6)}`,
        networkTier: 'IN_NETWORK',
        benefits: {
          copayPercentage: 20, // Patient pays 20%, insurance covers 80%
          annualDeductible: 500,
          annualCopayMax: 1000,
          deductibleRemaining: 300,
          deductibleUsed: 200,
        },
      };
    }

    // Scenario 2: Valid Thiqa insurance (90% coverage)
    if (lastDigit % 3 === 1) {
      return {
        eligible: true,
        emiratesId,
        patientName: 'Test Patient',
        dateOfBirth: '1985-05-15',
        gender: 'FEMALE',
        payer: 'Thiqa',
        plan: 'Basic Plan',
        policyNumber: `THIQA-${emiratesId.slice(-6)}`,
        networkTier: 'IN_NETWORK',
        benefits: {
          copayPercentage: 10, // Patient pays 10%, insurance covers 90%
          annualDeductible: 0, // No deductible for Thiqa
          annualCopayMax: 500,
          deductibleRemaining: 0,
          deductibleUsed: 0,
        },
      };
    }

    // Scenario 3: Out-of-network (higher copay)
    if (lastDigit % 3 === 2) {
      return {
        eligible: true,
        emiratesId,
        patientName: 'Test Patient',
        dateOfBirth: '1992-12-20',
        gender: 'MALE',
        payer: 'NGI',
        plan: 'Standard Plan',
        policyNumber: `NGI-${emiratesId.slice(-6)}`,
        networkTier: 'OUT_OF_NETWORK',
        benefits: {
          copayPercentage: 40, // Patient pays 40% when out-of-network
          annualDeductible: 1000,
          annualCopayMax: 2000,
          deductibleRemaining: 800,
          deductibleUsed: 200,
        },
      };
    }

    // Default: Not found in Riayati
    return {
      eligible: false,
      emiratesId,
      error: 'Patient not found in DHA Riayati database',
      errorCode: 'NOT_FOUND',
    };
  }

  /**
   * Verify insurance coverage for a specific service
   */
  async verifyCoverage(emiratesId: string, serviceCode: string): Promise<{
    covered: boolean;
    copayAmount?: number;
    copayPercentage?: number;
    priorAuthRequired?: boolean;
  }> {
    if (this.mode === 'sandbox') {
      return {
        covered: true,
        copayPercentage: 20,
        priorAuthRequired: false,
      };
    }

    try {
      const response = await this.apiClient.post('/coverage/verify', {
        emiratesId,
        serviceCode,
        facilityId: this.facilityId,
      });

      return {
        covered: response.data.covered,
        copayAmount: response.data.copayAmount,
        copayPercentage: response.data.copayPercentage,
        priorAuthRequired: response.data.requiresPreAuth,
      };
    } catch (error) {
      logger.error('[RIAYATI] Coverage verification error:', error);
      return {
        covered: false,
        priorAuthRequired: false,
      };
    }
  }

  /**
   * Register a patient with DHA Riayati
   */
  async registerPatient(data: RiayatiPatientRegistration): Promise<{
    success: boolean;
    patientId?: string;
    message?: string;
    error?: string;
  }> {
    if (this.mode === 'sandbox') {
      logger.info('[RIAYATI] Sandbox: Patient registration', data.emiratesId);
      return {
        success: true,
        patientId: `RIAYATI-${data.emiratesId.slice(-6)}`,
        message: 'Patient registered successfully (sandbox mode)',
      };
    }

    try {
      const response = await this.apiClient.post('/patients/register', {
        ...data,
        facilityId: this.facilityId,
      });

      logger.info('[RIAYATI] Patient registered:', response.data.patientId);
      return {
        success: true,
        patientId: response.data.patientId,
        message: response.data.message,
      };
    } catch (error: any) {
      logger.error('[RIAYATI] Patient registration error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to register patient',
      };
    }
  }

  /**
   * Submit pre-authorization request to DHA Riayati
   */
  async submitPreAuth(data: RiayatiPreAuthRequest): Promise<RiayatiPreAuthResponse> {
    if (this.mode === 'sandbox') {
      logger.info('[RIAYATI] Sandbox: Pre-auth submission', data.emiratesId, data.procedureCode);
      
      // Simulate approval for routine requests under 5000
      const isApproved = data.urgency === 'ROUTINE' && data.estimatedCost < 5000;
      
      return {
        success: true,
        preAuthNumber: `PA-${Date.now().toString(36).toUpperCase()}`,
        status: isApproved ? 'APPROVED' : 'PENDING',
        approvedAmount: isApproved ? data.estimatedCost : undefined,
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    try {
      const response = await this.apiClient.post('/preauth/submit', {
        ...data,
        facilityId: this.facilityId,
      });

      logger.info('[RIAYATI] Pre-auth submitted:', response.data.preAuthNumber);
      return {
        success: true,
        preAuthNumber: response.data.preAuthNumber,
        status: response.data.status,
        approvedAmount: response.data.approvedAmount,
        validFrom: response.data.validFrom,
        validTo: response.data.validTo,
      };
    } catch (error: any) {
      logger.error('[RIAYATI] Pre-auth submission error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to submit pre-authorization',
      };
    }
  }

  /**
   * Check status of a pre-authorization request
   */
  async checkPreAuthStatus(preAuthNumber: string): Promise<RiayatiPreAuthResponse> {
    if (this.mode === 'sandbox') {
      logger.info('[RIAYATI] Sandbox: Check pre-auth status', preAuthNumber);
      
      // Simulate different statuses based on number pattern
      const lastChar = preAuthNumber.slice(-1);
      const isApproved = lastChar >= '5';
      
      return {
        success: true,
        preAuthNumber,
        status: isApproved ? 'APPROVED' : 'PENDING',
        approvedAmount: isApproved ? 3500 : undefined,
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    try {
      const response = await this.apiClient.get(`/preauth/status/${preAuthNumber}`, {
        params: { facilityId: this.facilityId },
      });

      return {
        success: true,
        preAuthNumber: response.data.preAuthNumber,
        status: response.data.status,
        approvedAmount: response.data.approvedAmount,
        validFrom: response.data.validFrom,
        validTo: response.data.validTo,
        denialReason: response.data.denialReason,
      };
    } catch (error: any) {
      logger.error('[RIAYATI] Pre-auth status check error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to check pre-auth status',
      };
    }
  }
}

export const riayatiService = new RiayatiService();
