/**
 * UAE ICP (Insurance Coordination Platform) Service
 * Real-time eligibility verification using Emirates ID
 * 
 * The ICP provides centralized access to patient insurance information
 * across multiple payers in the UAE.
 * 
 * Mode: sandbox (mock data) or production (real API calls)
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

interface ICPEligibilityResponse {
  success: boolean;
  emiratesId: string;
  patient?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'M' | 'F';
    nationality: string;
    phoneNumber?: string;
    email?: string;
  };
  insuranceStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'SUSPENDED';
  activePolicies: Array<{
    policyNumber: string;
    payerId: string;
    payerName: string;
    planName: string;
    planType: 'BASIC' | 'ENHANCED' | 'PREMIUM';
    effectiveDate: string;
    expiryDate: string;
    isPrimary: boolean;
    networkType: 'IN_NETWORK' | 'OUT_OF_NETWORK';
    benefits: {
      copayPercentage?: number;
      copayAmount?: number;
      annualLimit?: number;
      deductible?: number;
      coverageLevel: number; // percentage
    };
  }>;
  error?: string;
  errorCode?: string;
}

class ICPService {
  private readonly mode: string;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private apiClient: AxiosInstance;

  constructor() {
    this.mode = process.env.ICP_MODE || 'sandbox';
    this.apiUrl = process.env.ICP_API_URL || 'https://api.icp.ae/v1';
    this.apiKey = process.env.ICP_API_KEY || '';

    this.apiClient = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });
  }

  /**
   * Verify patient eligibility using Emirates ID
   * Returns patient demographics, insurance status, and active policies
   */
  async verifyEligibility(emiratesId: string): Promise<ICPEligibilityResponse> {
    if (this.mode === 'sandbox') {
      return this.mockEligibilityCheck(emiratesId);
    }

    try {
      const response = await this.apiClient.post('/eligibility/verify', {
        emiratesId,
        requestTimestamp: new Date().toISOString(),
      });

      const data = response.data;
      
      logger.info('[ICP] Eligibility verified:', emiratesId, data.insuranceStatus);

      return {
        success: true,
        emiratesId,
        patient: data.patient,
        insuranceStatus: data.insuranceStatus,
        activePolicies: data.policies || [],
      };
    } catch (error: any) {
      logger.error('[ICP] Eligibility verification error:', error);
      
      return {
        success: false,
        emiratesId,
        insuranceStatus: 'INACTIVE',
        activePolicies: [],
        error: error.response?.data?.message || 'Failed to verify eligibility with ICP',
        errorCode: error.response?.data?.code || 'API_ERROR',
      };
    }
  }

  /**
   * Mock eligibility check for sandbox mode
   * Generates realistic test data based on Emirates ID pattern
   */
  private mockEligibilityCheck(emiratesId: string): ICPEligibilityResponse {
    logger.info('[ICP] Sandbox: Eligibility check', emiratesId);

    // Validate Emirates ID format (15 digits starting with 784)
    if (!emiratesId.match(/^784\d{12}$/)) {
      return {
        success: false,
        emiratesId,
        insuranceStatus: 'INACTIVE',
        activePolicies: [],
        error: 'Invalid Emirates ID format',
        errorCode: 'INVALID_ID',
      };
    }

    // Generate mock data based on last digit
    const lastDigit = parseInt(emiratesId.slice(-1), 10);
    const hasInsurance = lastDigit < 8; // 80% have insurance

    if (!hasInsurance) {
      return {
        success: true,
        emiratesId,
        patient: {
          firstName: 'Test',
          lastName: 'Patient',
          dateOfBirth: '1990-01-01',
          gender: lastDigit % 2 === 0 ? 'M' : 'F',
          nationality: 'UAE',
        },
        insuranceStatus: 'INACTIVE',
        activePolicies: [],
      };
    }

    // Mock active insurance
    const payers = [
      { id: 'DAMAN', name: 'Daman National Health Insurance', plans: ['Basic', 'Enhanced', 'Premium'] },
      { id: 'THIQA', name: 'Thiqa Insurance', plans: ['Abu Dhabi Government', 'Basic'] },
      { id: 'NGI', name: 'National General Insurance', plans: ['Standard', 'Gold', 'Platinum'] },
      { id: 'ADNIC', name: 'Abu Dhabi National Insurance', plans: ['Essential', 'Classic', 'Premier'] },
    ];

    const selectedPayer = payers[lastDigit % payers.length];
    const selectedPlan = selectedPayer.plans[lastDigit % selectedPayer.plans.length];
    
    const planTypes: Array<'BASIC' | 'ENHANCED' | 'PREMIUM'> = ['BASIC', 'ENHANCED', 'PREMIUM'];
    const planType = planTypes[lastDigit % 3];

    const copayPercentages = [10, 15, 20, 25];
    const copayPercentage = copayPercentages[lastDigit % copayPercentages.length];

    return {
      success: true,
      emiratesId,
      patient: {
        firstName: 'Ahmed',
        lastName: 'Al Mansoori',
        dateOfBirth: '1988-05-15',
        gender: lastDigit % 2 === 0 ? 'M' : 'F',
        nationality: 'UAE',
        phoneNumber: `+971501234${lastDigit}${lastDigit}${lastDigit}`,
        email: `patient${lastDigit}@example.ae`,
      },
      insuranceStatus: 'ACTIVE',
      activePolicies: [
        {
          policyNumber: `${selectedPayer.id}-${emiratesId.slice(-8)}`,
          payerId: selectedPayer.id,
          payerName: selectedPayer.name,
          planName: selectedPlan,
          planType,
          effectiveDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          expiryDate: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000).toISOString(),
          isPrimary: true,
          networkType: lastDigit < 6 ? 'IN_NETWORK' : 'OUT_OF_NETWORK',
          benefits: {
            copayPercentage,
            annualLimit: planType === 'BASIC' ? 150000 : planType === 'ENHANCED' ? 300000 : 500000,
            deductible: planType === 'BASIC' ? 500 : planType === 'ENHANCED' ? 300 : 0,
            coverageLevel: 100 - copayPercentage,
          },
        },
      ],
    };
  }

  /**
   * Verify eligibility for a specific service/procedure
   */
  async verifyServiceEligibility(
    emiratesId: string,
    serviceCode: string,
    estimatedCost: number
  ): Promise<{
    eligible: boolean;
    requiresPreAuth: boolean;
    estimatedCoverage: number;
    estimatedPatientCost: number;
    message?: string;
  }> {
    const eligibility = await this.verifyEligibility(emiratesId);

    if (!eligibility.success || eligibility.activePolicies.length === 0) {
      return {
        eligible: false,
        requiresPreAuth: false,
        estimatedCoverage: 0,
        estimatedPatientCost: estimatedCost,
        message: 'No active insurance coverage found',
      };
    }

    // Use primary policy for calculation
    const primaryPolicy = eligibility.activePolicies.find(p => p.isPrimary) || eligibility.activePolicies[0];
    
    const copayPercentage = primaryPolicy.benefits.copayPercentage || 20;
    const estimatedPatientCost = (estimatedCost * copayPercentage) / 100;
    const estimatedCoverage = estimatedCost - estimatedPatientCost;

    // High-cost services typically require pre-auth
    const requiresPreAuth = estimatedCost > 5000;

    return {
      eligible: true,
      requiresPreAuth,
      estimatedCoverage,
      estimatedPatientCost,
      message: `Coverage: ${100 - copayPercentage}% (${primaryPolicy.payerName})`,
    };
  }
}

export const icpService = new ICPService();
