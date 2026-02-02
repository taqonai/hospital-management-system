/**
 * DHA Riayati Service
 * Stub service for DHA Riayati eligibility checks
 * 
 * Mode: sandbox (mock data) or production (real API calls)
 * When real DHA API access is available, update the checkEligibility method
 * to make actual HTTP calls instead of returning mock data.
 */

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

class RiayatiService {
  private readonly mode: string;
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.mode = process.env.DHA_RIAYATI_MODE || 'sandbox';
    this.apiUrl = process.env.DHA_RIAYATI_API_URL || 'https://api.dha.gov.ae/riayati';
    this.apiKey = process.env.DHA_RIAYATI_API_KEY || '';
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
   * (Stub for future implementation)
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

    // TODO: Implement real API call
    return {
      covered: false,
      priorAuthRequired: false,
    };
  }
}

export const riayatiService = new RiayatiService();
