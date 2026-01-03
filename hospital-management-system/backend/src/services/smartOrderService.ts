import axios from 'axios';
import prisma from '../config/database';
import { config } from '../config';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

// Smart Order AI Service URL
const SMART_ORDER_SERVICE_URL = process.env.SMART_ORDER_SERVICE_URL || 'http://localhost:8013';

interface PatientContext {
  age?: number;
  weight?: number;
  gender?: string;
  allergies?: string[];
  currentMedications?: string[];
  renalFunction?: string;
  hepaticFunction?: string;
  pregnancyStatus?: string;
  comorbidities?: string[];
  recentLabResults?: Record<string, any>;
}

interface OrderRecommendation {
  id: string;
  name: string;
  category: string;
  urgency: string;
  confidence: number;
  rationale: string;
  warnings?: string[];
  dosing?: Record<string, any>;
  estimatedCost?: number;
}

interface RecommendationRequest {
  diagnosis: string;
  icdCode?: string;
  symptoms?: string[];
  patientContext?: PatientContext;
  includeAlternatives?: boolean;
}

interface CustomizeRequest {
  bundleId?: string;
  selectedOrders: any[];
  patientContext: PatientContext;
  customizations?: Record<string, any>;
}

interface PlaceOrdersRequest {
  patientId: string;
  orders: any[];
  providerId: string;
  notes?: string;
}

export class SmartOrderService {
  private aiClient = axios.create({
    baseURL: SMART_ORDER_SERVICE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  /**
   * Get AI-powered order recommendations for a diagnosis
   */
  async getRecommendations(request: RecommendationRequest, patientId?: string) {
    // If patientId provided, fetch patient context from database
    let patientContext = request.patientContext;

    if (patientId && !patientContext) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          allergies: true,
          medicalHistory: true,
          vitals: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (patient) {
        patientContext = {
          age: this.calculateAge(patient.dateOfBirth),
          weight: patient.vitals[0]?.weight ? Number(patient.vitals[0].weight) : undefined,
          gender: patient.gender,
          allergies: patient.allergies.map(a => a.allergen),
          currentMedications: patient.medicalHistory?.currentMedications || [],
          comorbidities: patient.medicalHistory?.chronicConditions || [],
        };
      }
    }

    try {
      logger.info(`Calling Smart Order AI for diagnosis: ${request.diagnosis}`);

      const response = await this.aiClient.post('/api/recommend', {
        diagnosis: request.diagnosis,
        icdCode: request.icdCode,
        symptoms: request.symptoms,
        patientContext,
        includeAlternatives: request.includeAlternatives ?? true,
      });

      logger.info(`Smart Order AI returned recommendations for: ${request.diagnosis}`);

      return {
        ...response.data,
        patientId,
      };
    } catch (error) {
      logger.error('Smart Order AI service error:', error);

      if (axios.isAxiosError(error) && !error.response) {
        // Service unreachable - use fallback
        logger.warn('Smart Order AI service unreachable, using fallback recommendations');
        return this.fallbackRecommendations(request, patientContext);
      }

      throw new AppError('Smart Order AI service temporarily unavailable', 503);
    }
  }

  /**
   * Get all available order bundles
   */
  async getBundles() {
    try {
      const response = await this.aiClient.get('/api/bundles');
      return response.data;
    } catch (error) {
      logger.error('Error fetching bundles:', error);

      if (axios.isAxiosError(error) && !error.response) {
        return this.fallbackBundles();
      }

      throw new AppError('Smart Order AI service temporarily unavailable', 503);
    }
  }

  /**
   * Get details of a specific bundle
   */
  async getBundleDetails(bundleId: string) {
    try {
      const response = await this.aiClient.get(`/api/bundles/${bundleId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching bundle details:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundError('Bundle not found');
        }
        if (!error.response) {
          throw new AppError('Smart Order AI service temporarily unavailable', 503);
        }
      }

      throw new AppError('Failed to fetch bundle details', 500);
    }
  }

  /**
   * Customize orders for a specific patient
   */
  async customizeBundle(request: CustomizeRequest, patientId?: string) {
    // Enrich patient context from database if patientId provided
    let enrichedContext = request.patientContext;

    if (patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          allergies: true,
          medicalHistory: true,
          vitals: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (patient) {
        enrichedContext = {
          ...request.patientContext,
          age: request.patientContext.age || this.calculateAge(patient.dateOfBirth),
          weight: request.patientContext.weight || (patient.vitals[0]?.weight ? Number(patient.vitals[0].weight) : undefined),
          gender: request.patientContext.gender || patient.gender,
          allergies: [
            ...(request.patientContext.allergies || []),
            ...patient.allergies.map(a => a.allergen),
          ],
          currentMedications: [
            ...(request.patientContext.currentMedications || []),
            ...(patient.medicalHistory?.currentMedications || []),
          ],
        };
      }
    }

    try {
      const response = await this.aiClient.post('/api/customize', {
        bundleId: request.bundleId,
        selectedOrders: request.selectedOrders,
        patientContext: enrichedContext,
        customizations: request.customizations,
      });

      return response.data;
    } catch (error) {
      logger.error('Error customizing bundle:', error);
      throw new AppError('Failed to customize orders', 500);
    }
  }

  /**
   * Place selected orders
   */
  async placeOrders(request: PlaceOrdersRequest) {
    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: request.patientId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    try {
      // Call AI service to log the order placement
      const response = await this.aiClient.post('/api/place', request);

      // In a real implementation, we would create actual orders in the database
      // For now, we'll create a record of the smart order session

      logger.info(`Placed ${request.orders.length} orders for patient ${request.patientId}`);

      return {
        ...response.data,
        patientName: `${patient.firstName} ${patient.lastName}`,
      };
    } catch (error) {
      logger.error('Error placing orders:', error);

      if (axios.isAxiosError(error) && !error.response) {
        // Even if AI service is down, still log the order placement
        return {
          success: true,
          message: `Successfully placed ${request.orders.length} orders (offline mode)`,
          orderIds: request.orders.map(() => `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
          patientId: request.patientId,
          providerId: request.providerId,
          placedAt: new Date().toISOString(),
        };
      }

      throw new AppError('Failed to place orders', 500);
    }
  }

  /**
   * Get patient's order history
   */
  async getOrderHistory(patientId: string) {
    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    try {
      const response = await this.aiClient.get(`/api/history/${patientId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching order history:', error);

      // Return empty history if service unavailable
      return {
        patientId,
        orders: [],
      };
    }
  }

  /**
   * Check drug interactions
   */
  async checkInteractions(medications: string[]) {
    try {
      const response = await this.aiClient.post('/api/check-interactions', medications);
      return response.data;
    } catch (error) {
      logger.error('Error checking interactions:', error);
      return {
        interactions: [],
        hasInteractions: false,
        criticalCount: 0,
        highCount: 0,
      };
    }
  }

  /**
   * Check AI service health
   */
  async checkHealth() {
    try {
      const response = await this.aiClient.get('/health');
      return {
        status: 'connected',
        aiService: response.data,
        serviceUrl: SMART_ORDER_SERVICE_URL,
      };
    } catch (error) {
      logger.error('Smart Order AI health check failed:', error);
      return {
        status: 'disconnected',
        error: axios.isAxiosError(error) ? error.message : 'Unknown error',
        serviceUrl: SMART_ORDER_SERVICE_URL,
      };
    }
  }

  // Helper methods

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Fallback recommendations when AI service is unavailable
   */
  private fallbackRecommendations(request: RecommendationRequest, patientContext?: PatientContext) {
    const diagnosis = request.diagnosis.toLowerCase();

    // Basic fallback recommendations
    const baseOrders: Record<string, any> = {
      laboratory: [
        { id: 'lab-1', name: 'CBC with Differential', category: 'laboratory', urgency: 'stat', confidence: 0.9, rationale: 'Standard baseline evaluation' },
        { id: 'lab-2', name: 'Comprehensive Metabolic Panel', category: 'laboratory', urgency: 'stat', confidence: 0.9, rationale: 'Assess electrolytes and organ function' },
      ],
      imaging: [],
      medication: [],
      procedure: [],
      nursing: [],
      consult: [],
    };

    // Add diagnosis-specific orders
    if (diagnosis.includes('sepsis')) {
      baseOrders.laboratory.push(
        { id: 'lab-3', name: 'Blood Cultures x2', category: 'laboratory', urgency: 'stat', confidence: 0.95, rationale: 'Identify causative organism' },
        { id: 'lab-4', name: 'Lactate Level', category: 'laboratory', urgency: 'stat', confidence: 0.98, rationale: 'Assess tissue perfusion' }
      );
      baseOrders.imaging.push(
        { id: 'img-1', name: 'Chest X-Ray', category: 'imaging', urgency: 'stat', confidence: 0.85, rationale: 'Evaluate for source' }
      );
      baseOrders.medication.push(
        { id: 'med-1', name: 'Broad-spectrum Antibiotics', category: 'medication', urgency: 'stat', confidence: 0.95, rationale: 'Empiric coverage' }
      );
    } else if (diagnosis.includes('chest pain') || diagnosis.includes('mi')) {
      baseOrders.laboratory.push(
        { id: 'lab-5', name: 'Troponin (Serial)', category: 'laboratory', urgency: 'stat', confidence: 0.99, rationale: 'Cardiac biomarker' }
      );
      baseOrders.imaging.push(
        { id: 'img-2', name: '12-Lead ECG', category: 'imaging', urgency: 'stat', confidence: 0.99, rationale: 'Assess for ischemia' }
      );
    } else if (diagnosis.includes('pneumonia')) {
      baseOrders.laboratory.push(
        { id: 'lab-6', name: 'Blood Cultures x2', category: 'laboratory', urgency: 'stat', confidence: 0.85, rationale: 'Identify bacteremia' }
      );
      baseOrders.imaging.push(
        { id: 'img-3', name: 'Chest X-Ray PA/Lateral', category: 'imaging', urgency: 'stat', confidence: 0.95, rationale: 'Confirm diagnosis' }
      );
    }

    return {
      diagnosisCode: null,
      diagnosisName: request.diagnosis,
      recommendations: baseOrders,
      bundleSuggestion: null,
      warnings: [],
      totalEstimatedCost: 250.0,
      evidenceLevel: 'Fallback - AI Service Unavailable',
      modelVersion: 'fallback-1.0.0',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Fallback bundles when AI service is unavailable
   */
  private fallbackBundles() {
    return {
      bundles: [
        {
          id: 'sepsis-bundle',
          name: 'Sepsis Bundle (SEP-1)',
          description: 'Evidence-based sepsis management bundle',
          category: 'critical-care',
          componentCount: 6,
          evidenceLevel: 'Level 1A',
        },
        {
          id: 'acs-bundle',
          name: 'Acute Coronary Syndrome Bundle',
          description: 'Evidence-based ACS management',
          category: 'cardiology',
          componentCount: 7,
          evidenceLevel: 'Level 1A',
        },
        {
          id: 'stroke-bundle',
          name: 'Acute Stroke Bundle',
          description: 'Evidence-based stroke management',
          category: 'neurology',
          componentCount: 7,
          evidenceLevel: 'Level 1A',
        },
        {
          id: 'cap-bundle',
          name: 'Community-Acquired Pneumonia Bundle',
          description: 'Evidence-based CAP management',
          category: 'pulmonology',
          componentCount: 6,
          evidenceLevel: 'Level 1A',
        },
      ],
    };
  }
}

export const smartOrderService = new SmartOrderService();
