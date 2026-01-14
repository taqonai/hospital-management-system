import axios from 'axios';
import prisma from '../config/database';
import { config } from '../config';
import {
  AISymptomAnalysisRequest,
  AIRiskPredictionRequest,
  AIImageAnalysisRequest,
  AIDiagnosisResponse,
  AIRiskPredictionResponse,
  AIImageAnalysisResponse,
} from '../types';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

// Interface for hospital AI provider configuration
interface HospitalAIConfig {
  provider: 'openai' | 'ollama';
  ollamaEndpoint?: string;
  ollamaModels?: {
    complex?: string;
    simple?: string;
  };
}

export class AIService {
  private aiClient = axios.create({
    baseURL: config.ai.serviceUrl,
    timeout: 300000, // 5 minutes for Ollama AI operations
    headers: {
      'Authorization': `Bearer ${config.ai.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  /**
   * Fetch AI provider configuration for a hospital.
   * Returns the configured provider (OpenAI or Ollama) settings.
   */
  private async getHospitalAIConfig(hospitalId: string): Promise<HospitalAIConfig | null> {
    try {
      const hospital = await prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { settings: true },
      });

      if (!hospital?.settings) {
        return null;
      }

      const settings = hospital.settings as Record<string, any>;
      const aiProvider = settings.aiProvider;

      if (!aiProvider) {
        return null;
      }

      return {
        provider: aiProvider.provider || 'openai',
        ollamaEndpoint: aiProvider.ollamaEndpoint,
        ollamaModels: aiProvider.ollamaModels,
      };
    } catch (error) {
      logger.warn('Failed to fetch hospital AI config, using default OpenAI:', error);
      return null;
    }
  }

  async analyzeSymptomsForDiagnosis(data: AISymptomAnalysisRequest) {
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      include: {
        medicalHistory: true,
        allergies: true,
        vitals: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    try {
      logger.info(`Calling AI diagnosis service for patient ${data.patientId}`);

      // Fetch hospital AI provider configuration
      const hospitalAIConfig = await this.getHospitalAIConfig(patient.hospitalId);
      if (hospitalAIConfig) {
        logger.info(`Using AI provider: ${hospitalAIConfig.provider} for hospital ${patient.hospitalId}`);
      }

      // Call AI microservice with hospital config
      const response = await this.aiClient.post<AIDiagnosisResponse>('/api/diagnose', {
        symptoms: data.symptoms,
        patientAge: this.calculateAge(patient.dateOfBirth),
        gender: patient.gender,
        medicalHistory: patient.medicalHistory?.chronicConditions || [],
        currentMedications: data.currentMedications || patient.medicalHistory?.currentMedications || [],
        allergies: patient.allergies.map(a => a.allergen),
        vitalSigns: data.vitalSigns || (patient.vitals[0] ? {
          temperature: patient.vitals[0].temperature,
          bloodPressure: `${patient.vitals[0].bloodPressureSys}/${patient.vitals[0].bloodPressureDia}`,
          heartRate: patient.vitals[0].heartRate,
          respiratoryRate: patient.vitals[0].respiratoryRate,
          oxygenSaturation: patient.vitals[0].oxygenSaturation,
        } : undefined),
        // Include hospital AI provider config for provider selection
        hospitalConfig: hospitalAIConfig,
      });

      const aiResult = response.data;

      logger.info(`AI diagnosis returned ${aiResult.diagnoses.length} diagnoses with model ${aiResult.modelVersion}`);

      // Store the diagnosis
      const diagnosis = await prisma.aIDiagnosis.create({
        data: {
          patientId: data.patientId,
          symptoms: data.symptoms,
          suggestedDiagnoses: JSON.parse(JSON.stringify(aiResult.diagnoses)),
          recommendedTests: aiResult.recommendedTests || [],
          treatmentSuggestions: aiResult.treatmentSuggestions || [],
          drugInteractionWarnings: (aiResult.drugInteractions || []).map((d: any) => d.message || String(d)),
          riskFactors: (aiResult.riskFactors || []).map((r: any) => r.factor || String(r)),
          confidence: aiResult.confidence || 0.75,
          modelVersion: aiResult.modelVersion || '2.0.0-ml',
        },
      });

      return {
        id: diagnosis.id,
        diagnoses: aiResult.diagnoses,
        recommendedTests: aiResult.recommendedTests,
        treatmentSuggestions: aiResult.treatmentSuggestions,
        drugInteractions: aiResult.drugInteractions,
        riskFactors: aiResult.riskFactors,
        confidence: aiResult.confidence,
        modelVersion: aiResult.modelVersion,
        disclaimer: 'This is an AI-generated suggestion. Please verify with clinical judgment.',
      };
    } catch (error) {
      logger.error('AI diagnosis service error:', error);
      // If AI service is unavailable, use fallback logic
      if (axios.isAxiosError(error) && !error.response) {
        logger.warn('AI service unreachable, using fallback diagnosis');
        return this.fallbackDiagnosisAnalysis(data, patient);
      }
      throw new AppError('AI diagnosis service temporarily unavailable', 503);
    }
  }

  private fallbackDiagnosisAnalysis(data: AISymptomAnalysisRequest, patient: any) {
    // Basic symptom-based suggestions (simplified medical logic)
    const symptomMap: Record<string, { icd: string; name: string; tests: string[] }[]> = {
      'fever': [
        { icd: 'R50.9', name: 'Fever, unspecified', tests: ['CBC', 'Blood Culture'] },
      ],
      'cough': [
        { icd: 'R05', name: 'Cough', tests: ['Chest X-ray', 'Sputum Culture'] },
      ],
      'headache': [
        { icd: 'R51', name: 'Headache', tests: ['CT Head', 'Eye Exam'] },
      ],
      'chest pain': [
        { icd: 'R07.9', name: 'Chest pain, unspecified', tests: ['ECG', 'Troponin', 'Chest X-ray'] },
      ],
      'abdominal pain': [
        { icd: 'R10.9', name: 'Abdominal pain, unspecified', tests: ['Abdominal Ultrasound', 'CBC', 'LFT'] },
      ],
      'fatigue': [
        { icd: 'R53.83', name: 'Fatigue', tests: ['CBC', 'Thyroid Panel', 'Vitamin B12'] },
      ],
      'shortness of breath': [
        { icd: 'R06.02', name: 'Shortness of breath', tests: ['Chest X-ray', 'Pulmonary Function Test', 'ECG'] },
      ],
    };

    const diagnoses: any[] = [];
    const tests = new Set<string>();

    data.symptoms.forEach(symptom => {
      const lowerSymptom = symptom.toLowerCase();
      Object.entries(symptomMap).forEach(([key, values]) => {
        if (lowerSymptom.includes(key)) {
          values.forEach(v => {
            diagnoses.push({
              icd10: v.icd,
              name: v.name,
              confidence: 0.6,
            });
            v.tests.forEach(t => tests.add(t));
          });
        }
      });
    });

    return {
      id: null,
      diagnoses: diagnoses.slice(0, 5),
      recommendedTests: Array.from(tests).slice(0, 5),
      treatmentSuggestions: ['Further evaluation recommended'],
      drugInteractionWarnings: [],
      riskFactors: [],
      confidence: 0.5,
      disclaimer: 'AI service unavailable. Basic analysis provided. Please consult physician.',
    };
  }

  async predictRisk(data: AIRiskPredictionRequest) {
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      include: {
        medicalHistory: true,
        vitals: {
          orderBy: { recordedAt: 'desc' },
          take: 10,
        },
        admissions: {
          orderBy: { admissionDate: 'desc' },
          take: 5,
        },
        consultations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    try {
      logger.info(`Calling AI risk prediction for patient ${data.patientId}, type: ${data.predictionType}`);

      const response = await this.aiClient.post<AIRiskPredictionResponse>('/api/predict-risk', {
        patientId: data.patientId,
        predictionType: data.predictionType,
        timeframe: data.timeframe || '30 days',
        patientData: {
          age: this.calculateAge(patient.dateOfBirth),
          gender: patient.gender,
          medicalHistory: patient.medicalHistory,
          vitalsHistory: patient.vitals,
          admissionHistory: patient.admissions,
          consultationHistory: patient.consultations,
        },
      });

      const aiResult = response.data;

      logger.info(`AI risk prediction: score=${aiResult.riskScore}, level=${aiResult.riskLevel}, model=${aiResult.modelVersion}`);

      const prediction = await prisma.aIPrediction.create({
        data: {
          patientId: data.patientId,
          predictionType: data.predictionType,
          riskScore: aiResult.riskScore,
          riskLevel: aiResult.riskLevel.toUpperCase() as 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL',
          factors: aiResult.factors,
          recommendations: aiResult.recommendations || [],
          timeframe: data.timeframe || '30 days',
          modelVersion: aiResult.modelVersion || '2.0.0-ml',
        },
      });

      return {
        id: prediction.id,
        riskScore: aiResult.riskScore,
        riskLevel: aiResult.riskLevel,
        factors: aiResult.factors,
        recommendations: aiResult.recommendations,
        timeframe: prediction.timeframe,
        modelVersion: aiResult.modelVersion,
      };
    } catch (error) {
      logger.error('AI risk prediction error:', error);
      // Fallback risk calculation
      logger.warn('Using fallback risk prediction');
      return this.fallbackRiskPrediction(data, patient);
    }
  }

  private fallbackRiskPrediction(data: AIRiskPredictionRequest, patient: any) {
    let riskScore = 0.3; // Base risk
    const factors: string[] = [];

    // Age factor
    const age = this.calculateAge(patient.dateOfBirth);
    if (age > 65) {
      riskScore += 0.15;
      factors.push('Age over 65');
    } else if (age > 50) {
      riskScore += 0.1;
      factors.push('Age over 50');
    }

    // Medical history factors
    const chronicConditions = patient.medicalHistory?.chronicConditions || [];
    if (chronicConditions.length > 0) {
      riskScore += 0.1 * Math.min(chronicConditions.length, 3);
      factors.push(`${chronicConditions.length} chronic condition(s)`);
    }

    // Previous admissions
    if (patient.admissions.length > 2) {
      riskScore += 0.2;
      factors.push('Multiple previous admissions');
    }

    // Recent vitals
    if (patient.vitals.length > 0) {
      const latestVitals = patient.vitals[0];
      if (latestVitals.bloodPressureSys > 140 || latestVitals.bloodPressureDia > 90) {
        riskScore += 0.1;
        factors.push('Elevated blood pressure');
      }
    }

    riskScore = Math.min(riskScore, 0.95);

    return {
      id: null,
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      factors,
      recommendations: [
        'Regular follow-up recommended',
        'Monitor vital signs',
        'Review medications',
      ],
      timeframe: data.timeframe || '30 days',
    };
  }

  async analyzeImage(data: AIImageAnalysisRequest) {
    const imagingOrder = await prisma.imagingOrder.findUnique({
      where: { id: data.imagingOrderId },
      include: {
        patient: true,
        study: true,
      },
    });

    if (!imagingOrder) {
      throw new NotFoundError('Imaging order not found');
    }

    try {
      logger.info(`Calling AI image analysis for order ${data.imagingOrderId}, modality: ${data.modalityType}`);

      const response = await this.aiClient.post<AIImageAnalysisResponse>('/api/analyze-image', {
        imageUrl: data.imageUrl,
        modalityType: data.modalityType,
        bodyPart: data.bodyPart,
        patientAge: this.calculateAge(imagingOrder.patient.dateOfBirth),
        patientGender: imagingOrder.patient.gender,
        clinicalHistory: imagingOrder.clinicalHistory,
      });

      const aiResult = response.data;

      logger.info(`AI image analysis: abnormality=${aiResult.abnormalityDetected}, urgency=${aiResult.urgency}, model=${aiResult.modelVersion}`);

      const analysis = await prisma.aIImageAnalysis.create({
        data: {
          imagingOrderId: data.imagingOrderId,
          findings: JSON.parse(JSON.stringify(aiResult.findings)),
          impression: aiResult.impression,
          heatmapUrl: aiResult.heatmapUrl,
          abnormalityDetected: aiResult.abnormalityDetected,
          confidence: aiResult.confidence,
          modelVersion: aiResult.modelVersion || '2.0.0-ml',
        },
      });

      return {
        id: analysis.id,
        findings: aiResult.findings,
        impression: aiResult.impression,
        recommendations: aiResult.recommendations,
        heatmapUrl: aiResult.heatmapUrl,
        abnormalityDetected: aiResult.abnormalityDetected,
        confidence: aiResult.confidence,
        urgency: aiResult.urgency,
        studyInfo: aiResult.studyInfo,
        modelVersion: aiResult.modelVersion,
        disclaimer: 'AI-assisted analysis. Final interpretation by radiologist required.',
      };
    } catch (error) {
      logger.error('AI image analysis error:', error);
      throw new AppError('AI image analysis service temporarily unavailable', 503);
    }
  }

  async getPatientAIInsights(patientId: string) {
    const [diagnoses, predictions, imageAnalyses] = await Promise.all([
      prisma.aIDiagnosis.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.aIPrediction.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.aIImageAnalysis.findMany({
        where: {
          imagingOrder: { patientId },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          imagingOrder: {
            select: { modalityType: true, bodyPart: true },
          },
        },
      }),
    ]);

    return {
      diagnoses,
      predictions,
      imageAnalyses,
    };
  }

  async provideFeedback(type: 'diagnosis' | 'prediction' | 'image', id: string, feedback: {
    isAccepted?: boolean;
    feedback?: string;
  }) {
    switch (type) {
      case 'diagnosis':
        return prisma.aIDiagnosis.update({
          where: { id },
          data: feedback,
        });
      case 'image':
        return prisma.aIImageAnalysis.update({
          where: { id },
          data: {
            isReviewed: true,
            feedback: feedback.feedback,
            reviewedAt: new Date(),
          },
        });
      default:
        throw new AppError('Invalid feedback type');
    }
  }

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

  private getRiskLevel(score: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (score < 0.3) return 'LOW';
    if (score < 0.5) return 'MODERATE';
    if (score < 0.7) return 'HIGH';
    return 'CRITICAL';
  }

  // ============= Direct AI Test Methods (No Database Required) =============

  /**
   * Direct diagnosis test - calls AI service without database lookup
   * Useful for testing AI integration
   */
  async directDiagnose(data: {
    symptoms: string[];
    patientAge: number;
    gender: string;
    medicalHistory?: string[];
    currentMedications?: string[];
    allergies?: string[];
    vitalSigns?: Record<string, any>;
    hospitalId?: string;
  }) {
    try {
      logger.info('Direct AI diagnosis call');

      // Fetch hospital AI config if hospitalId provided
      let hospitalConfig: HospitalAIConfig | null = null;
      if (data.hospitalId) {
        hospitalConfig = await this.getHospitalAIConfig(data.hospitalId);
        if (hospitalConfig) {
          logger.info(`Direct diagnosis using AI provider: ${hospitalConfig.provider}`);
        }
      }

      const response = await this.aiClient.post<AIDiagnosisResponse>('/api/diagnose', {
        symptoms: data.symptoms,
        patientAge: data.patientAge,
        gender: data.gender,
        medicalHistory: data.medicalHistory || [],
        currentMedications: data.currentMedications || [],
        allergies: data.allergies || [],
        vitalSigns: data.vitalSigns,
        hospitalConfig,
      });

      return {
        ...response.data,
        disclaimer: 'This is an AI-generated suggestion. Please verify with clinical judgment.',
      };
    } catch (error) {
      logger.error('Direct AI diagnosis error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('AI service is not reachable. Ensure it is running on ' + config.ai.serviceUrl, 503);
        }
        throw new AppError(`AI service error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('AI diagnosis service error', 500);
    }
  }

  /**
   * Direct risk prediction test - calls AI service without database lookup
   */
  async directPredictRisk(data: {
    predictionType: string;
    timeframe?: string;
    patientData: Record<string, any>;
    hospitalId?: string;
  }) {
    try {
      logger.info(`Direct AI risk prediction: ${data.predictionType}`);

      // Fetch hospital AI config if hospitalId provided
      let hospitalConfig: HospitalAIConfig | null = null;
      if (data.hospitalId) {
        hospitalConfig = await this.getHospitalAIConfig(data.hospitalId);
        if (hospitalConfig) {
          logger.info(`Direct risk prediction using AI provider: ${hospitalConfig.provider}`);
        }
      }

      const response = await this.aiClient.post<AIRiskPredictionResponse>('/api/predict-risk', {
        patientId: 'test-patient',
        predictionType: data.predictionType,
        timeframe: data.timeframe || '30 days',
        patientData: data.patientData,
        hospitalConfig,
      });

      return response.data;
    } catch (error) {
      logger.error('Direct AI risk prediction error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('AI service is not reachable. Ensure it is running on ' + config.ai.serviceUrl, 503);
        }
        throw new AppError(`AI service error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('AI risk prediction service error', 500);
    }
  }

  /**
   * Direct image analysis test - calls AI service without database lookup
   */
  async directAnalyzeImage(data: {
    imageUrl: string;
    modalityType: string;
    bodyPart: string;
    patientAge: number;
    patientGender: string;
    clinicalHistory?: string;
    hospitalId?: string;
  }) {
    try {
      logger.info(`Direct AI image analysis: ${data.modalityType} - ${data.bodyPart}`);

      // Fetch hospital AI config if hospitalId provided
      let hospitalConfig: HospitalAIConfig | null = null;
      if (data.hospitalId) {
        hospitalConfig = await this.getHospitalAIConfig(data.hospitalId);
        if (hospitalConfig) {
          logger.info(`Direct image analysis using AI provider: ${hospitalConfig.provider}`);
        }
      }

      const response = await this.aiClient.post<AIImageAnalysisResponse>('/api/analyze-image', {
        imageUrl: data.imageUrl,
        modalityType: data.modalityType,
        bodyPart: data.bodyPart,
        patientAge: data.patientAge,
        patientGender: data.patientGender,
        clinicalHistory: data.clinicalHistory,
        hospitalConfig,
      });

      return {
        ...response.data,
        disclaimer: 'AI-assisted analysis. Final interpretation by radiologist required.',
      };
    } catch (error) {
      logger.error('Direct AI image analysis error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('AI service is not reachable. Ensure it is running on ' + config.ai.serviceUrl, 503);
        }
        throw new AppError(`AI service error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('AI image analysis service error', 500);
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
        serviceUrl: config.ai.serviceUrl,
      };
    } catch (error) {
      logger.error('AI health check failed:', error);
      return {
        status: 'disconnected',
        error: axios.isAxiosError(error) ? error.message : 'Unknown error',
        serviceUrl: config.ai.serviceUrl,
      };
    }
  }

  // ============= Chat and Voice Command Methods =============

  /**
   * Process a chat message with context awareness
   */
  async processChat(data: {
    message: string;
    context?: {
      currentPage?: string;
      currentModule?: string;
      patientId?: string;
    };
    userId?: string;
  }) {
    const { message, context } = data;

    try {
      // Try to call the AI chat service
      const response = await this.aiClient.post('/api/chat', {
        message,
        context: context || {},
      });

      return {
        response: response.data.response,
        intent: response.data.intent,
        actions: response.data.actions || [],
        suggestions: response.data.suggestions || [],
      };
    } catch (error) {
      logger.warn('AI chat service unavailable, using fallback');
      // Fallback local processing
      return this.fallbackChatProcessing(message, context);
    }
  }

  /**
   * Process a voice command
   */
  async processVoiceCommand(data: {
    transcript: string;
    context?: {
      currentPage?: string;
      currentModule?: string;
      patientId?: string;
    };
    userId?: string;
  }) {
    const { transcript, context } = data;

    try {
      const response = await this.aiClient.post('/api/voice-command', {
        transcript,
        context: context || {},
      });

      return {
        intent: response.data.intent,
        entities: response.data.entities || {},
        action: response.data.action,
        response: response.data.response,
        confidence: response.data.confidence,
      };
    } catch (error) {
      logger.warn('AI voice command service unavailable, using fallback');
      return this.fallbackVoiceCommandProcessing(transcript, context);
    }
  }

  /**
   * Fallback chat processing when AI service is unavailable
   */
  private fallbackChatProcessing(message: string, context?: Record<string, any>) {
    const lowerMessage = message.toLowerCase();

    // Navigation intents
    const navPatterns: Record<string, { route: string; response: string }> = {
      'patients': { route: '/patients', response: 'Opening patient list...' },
      'dashboard': { route: '/dashboard', response: 'Opening dashboard...' },
      'appointments': { route: '/appointments', response: 'Opening appointments...' },
      'laboratory': { route: '/laboratory', response: 'Opening laboratory module...' },
      'lab': { route: '/laboratory', response: 'Opening laboratory module...' },
      'pharmacy': { route: '/pharmacy', response: 'Opening pharmacy module...' },
      'ipd': { route: '/ipd', response: 'Opening inpatient department...' },
      'opd': { route: '/opd', response: 'Opening outpatient department...' },
      'emergency': { route: '/emergency', response: 'Opening emergency department...' },
      'radiology': { route: '/radiology', response: 'Opening radiology module...' },
      'surgery': { route: '/surgery', response: 'Opening surgery/OT module...' },
      'billing': { route: '/billing', response: 'Opening billing module...' },
    };

    // Check for navigation intent
    if (lowerMessage.includes('go to') || lowerMessage.includes('open') || lowerMessage.includes('navigate')) {
      for (const [key, value] of Object.entries(navPatterns)) {
        if (lowerMessage.includes(key)) {
          return {
            response: value.response,
            intent: 'navigation',
            actions: [{ type: 'navigate', route: value.route }],
            suggestions: [],
          };
        }
      }
    }

    // Check for action intents
    if (lowerMessage.includes('new patient') || lowerMessage.includes('register patient')) {
      return {
        response: 'Opening patient registration form...',
        intent: 'action',
        actions: [{ type: 'navigate', route: '/patients?action=new' }],
        suggestions: [],
      };
    }

    if (lowerMessage.includes('new appointment') || lowerMessage.includes('book appointment')) {
      return {
        response: 'Opening appointment booking form...',
        intent: 'action',
        actions: [{ type: 'navigate', route: '/appointments?action=new' }],
        suggestions: [],
      };
    }

    // Check for help queries
    if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
      return {
        response: `I can help you with:
• Navigation: "Go to patients", "Open laboratory"
• Patient actions: "Register new patient", "Book appointment"
• Lab orders: "Order CBC for patient"
• Quick filters: "Show critical lab results", "High risk patients"
• Module actions based on your current page

What would you like to do?`,
        intent: 'help',
        actions: [],
        suggestions: ['Go to patients', 'New appointment', 'Show critical labs'],
      };
    }

    // Context-aware suggestions
    const suggestions: string[] = [];
    if (context?.currentModule) {
      switch (context.currentModule) {
        case 'patients':
          suggestions.push('Register new patient', 'Search patient', 'View patient details');
          break;
        case 'laboratory':
          suggestions.push('Order lab test', 'Show critical values', 'View pending tests');
          break;
        case 'pharmacy':
          suggestions.push('Check drug interactions', 'View prescriptions', 'Check inventory');
          break;
        case 'emergency':
          suggestions.push('New triage', 'Show ESI 1-2 patients', 'Update wait times');
          break;
        default:
          suggestions.push('Go to dashboard', 'View patients', 'Check appointments');
      }
    }

    return {
      response: `I understand you said: "${message}". I can help you navigate the system, manage patients, order tests, and more. Try saying "help" for available commands.`,
      intent: 'unknown',
      actions: [],
      suggestions,
    };
  }

  /**
   * Fallback voice command processing
   */
  private fallbackVoiceCommandProcessing(transcript: string, context?: Record<string, any>) {
    // Use the same logic as chat for now
    const chatResult = this.fallbackChatProcessing(transcript, context);

    return {
      intent: chatResult.intent,
      entities: {},
      action: chatResult.actions[0] || null,
      response: chatResult.response,
      confidence: 0.6,
    };
  }

  // ============= Symptom Checker Methods =============

  /**
   * Start a new symptom checker session
   */
  async startSymptomCheckerSession(data: {
    patientInfo?: {
      patientId?: string;
      age?: number;
      gender?: string;
      medicalHistory?: string[];
      currentMedications?: string[];
      allergies?: string[];
    };
    initialSymptoms?: string[];
    hospitalId?: string;
  }) {
    try {
      logger.info('Starting symptom checker session');

      // Fetch hospital AI config if hospitalId provided
      let hospitalConfig: HospitalAIConfig | null = null;
      if (data.hospitalId) {
        hospitalConfig = await this.getHospitalAIConfig(data.hospitalId);
        if (hospitalConfig) {
          logger.info(`Symptom checker using AI provider: ${hospitalConfig.provider}`);
        }
      }

      const response = await this.aiClient.post('/api/symptom-checker/start', {
        ...data,
        hospitalConfig,
      });
      return response.data;
    } catch (error) {
      logger.error('Symptom checker start error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Symptom checker service is not reachable', 503);
        }
        throw new AppError(`Symptom checker error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Symptom checker service error', 500);
    }
  }

  /**
   * Submit responses to symptom checker
   */
  async respondToSymptomChecker(data: {
    sessionId: string;
    responses: Array<{ questionId: string; answer: any }>;
    hospitalId?: string;
  }) {
    try {
      logger.info(`Symptom checker response for session ${data.sessionId}`);

      // Fetch hospital AI config if hospitalId provided
      let hospitalConfig: HospitalAIConfig | null = null;
      if (data.hospitalId) {
        hospitalConfig = await this.getHospitalAIConfig(data.hospitalId);
        if (hospitalConfig) {
          logger.info(`Symptom checker respond using AI provider: ${hospitalConfig.provider}`);
        }
      }

      const response = await this.aiClient.post('/api/symptom-checker/respond', {
        ...data,
        hospitalConfig,
      });
      return response.data;
    } catch (error) {
      logger.error('Symptom checker respond error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Symptom checker service is not reachable', 503);
        }
        throw new AppError(`Symptom checker error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Symptom checker service error', 500);
    }
  }

  /**
   * Complete symptom checker assessment
   */
  async completeSymptomChecker(data: { sessionId: string; hospitalId?: string }) {
    try {
      logger.info(`Completing symptom checker session ${data.sessionId}`);

      // Fetch hospital AI config if hospitalId provided
      let hospitalConfig: HospitalAIConfig | null = null;
      if (data.hospitalId) {
        hospitalConfig = await this.getHospitalAIConfig(data.hospitalId);
        if (hospitalConfig) {
          logger.info(`Symptom checker complete using AI provider: ${hospitalConfig.provider}`);
        }
      }

      const response = await this.aiClient.post('/api/symptom-checker/complete', {
        ...data,
        hospitalConfig,
      });
      return response.data;
    } catch (error) {
      logger.error('Symptom checker complete error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Symptom checker service is not reachable', 503);
        }
        throw new AppError(`Symptom checker error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Symptom checker service error', 500);
    }
  }

  /**
   * Get symptom checker session details
   */
  async getSymptomCheckerSession(sessionId: string) {
    try {
      logger.info(`Getting symptom checker session ${sessionId}`);
      const response = await this.aiClient.get(`/api/symptom-checker/session/${sessionId}`);
      return response.data;
    } catch (error) {
      logger.error('Symptom checker get session error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Symptom checker service is not reachable', 503);
        }
        throw new AppError(`Symptom checker error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Symptom checker service error', 500);
    }
  }

  /**
   * Quick symptom check without full conversation
   */
  async quickSymptomCheck(data: { symptoms: string[]; patientAge?: number; hospitalId?: string }) {
    try {
      logger.info('Quick symptom check');

      // Fetch hospital AI config if hospitalId provided
      let hospitalConfig: HospitalAIConfig | null = null;
      if (data.hospitalId) {
        hospitalConfig = await this.getHospitalAIConfig(data.hospitalId);
        if (hospitalConfig) {
          logger.info(`Quick symptom check using AI provider: ${hospitalConfig.provider}`);
        }
      }

      const response = await this.aiClient.post('/api/symptom-checker/quick-check', {
        ...data,
        hospitalConfig,
      });
      return response.data;
    } catch (error) {
      logger.error('Quick symptom check error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Symptom checker service is not reachable', 503);
        }
        throw new AppError(`Symptom checker error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Symptom checker service error', 500);
    }
  }

  /**
   * Get available departments for symptom checker
   */
  async getSymptomCheckerDepartments() {
    try {
      const response = await this.aiClient.get('/api/symptom-checker/departments');
      return response.data;
    } catch (error) {
      logger.error('Symptom checker departments error:', error);
      // Return fallback list if service is unavailable
      return {
        departments: [
          { id: 'cardiology', name: 'Cardiology' },
          { id: 'pulmonology', name: 'Pulmonology' },
          { id: 'gastroenterology', name: 'Gastroenterology' },
          { id: 'neurology', name: 'Neurology' },
          { id: 'orthopedics', name: 'Orthopedics' },
          { id: 'dermatology', name: 'Dermatology' },
          { id: 'ent', name: 'ENT' },
          { id: 'internal-medicine', name: 'Internal Medicine' },
          { id: 'emergency', name: 'Emergency' },
          { id: 'psychiatry', name: 'Psychiatry' },
        ],
      };
    }
  }

  // ============= Entity Extraction Methods (AI-powered creation) =============

  /**
   * Parse text to detect creation intent (patient/doctor/appointment)
   */
  async parseCreationIntent(data: { text: string; context?: Record<string, any> }) {
    try {
      logger.info('Parsing creation intent from text');
      const response = await this.aiClient.post('/api/entity/parse-creation-intent', {
        text: data.text,
        context: data.context || {},
      });
      return response.data;
    } catch (error) {
      logger.error('Parse creation intent error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Entity extraction service is not reachable', 503);
        }
        throw new AppError(`Entity extraction error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Entity extraction service error', 500);
    }
  }

  /**
   * Extract patient data from natural language text
   */
  async extractPatientData(data: { text: string; context?: Record<string, any> }) {
    try {
      logger.info('Extracting patient data from text');
      const response = await this.aiClient.post('/api/entity/extract-patient', {
        text: data.text,
        context: data.context || {},
      });
      return response.data;
    } catch (error) {
      logger.error('Extract patient data error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Entity extraction service is not reachable', 503);
        }
        throw new AppError(`Entity extraction error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Entity extraction service error', 500);
    }
  }

  /**
   * Extract doctor data from natural language text
   */
  async extractDoctorData(data: { text: string; context?: Record<string, any> }) {
    try {
      logger.info('Extracting doctor data from text');
      const response = await this.aiClient.post('/api/entity/extract-doctor', {
        text: data.text,
        context: data.context || {},
      });
      return response.data;
    } catch (error) {
      logger.error('Extract doctor data error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Entity extraction service is not reachable', 503);
        }
        throw new AppError(`Entity extraction error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Entity extraction service error', 500);
    }
  }

  /**
   * Extract appointment data from natural language text
   */
  async extractAppointmentData(data: { text: string; context?: Record<string, any> }) {
    try {
      logger.info('Extracting appointment data from text');
      const response = await this.aiClient.post('/api/entity/extract-appointment', {
        text: data.text,
        context: data.context || {},
      });
      return response.data;
    } catch (error) {
      logger.error('Extract appointment data error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Entity extraction service is not reachable', 503);
        }
        throw new AppError(`Entity extraction error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Entity extraction service error', 500);
    }
  }

  // ============= Clinical Notes Methods =============

  /**
   * Get available clinical note templates
   */
  async getClinicalNoteTemplates() {
    try {
      logger.info('Fetching clinical note templates');
      const response = await this.aiClient.get('/api/notes/templates');
      return response.data;
    } catch (error) {
      logger.error('Get clinical note templates error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Clinical notes AI service is not reachable', 503);
        }
        throw new AppError(`Clinical notes error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Clinical notes service error', 500);
    }
  }

  /**
   * Generate clinical note from template
   */
  async generateClinicalNote(data: {
    templateType: string;
    patientData?: Record<string, any>;
    encounterData?: Record<string, any>;
  }) {
    try {
      logger.info(`Generating clinical note with template: ${data.templateType}`);
      const response = await this.aiClient.post('/api/notes/generate', {
        template_type: data.templateType,
        patient_data: data.patientData || {},
        encounter_data: data.encounterData || {},
      });
      return response.data;
    } catch (error) {
      logger.error('Generate clinical note error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Clinical notes AI service is not reachable', 503);
        }
        throw new AppError(`Clinical notes error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Clinical notes service error', 500);
    }
  }

  /**
   * Enhance clinical note with AI
   */
  async enhanceClinicalNote(data: { noteText: string; enhancementType?: string }) {
    try {
      logger.info(`Enhancing clinical note with type: ${data.enhancementType || 'improve'}`);
      const response = await this.aiClient.post('/api/notes/enhance', {
        note_text: data.noteText,
        enhancement_type: data.enhancementType || 'improve',
      });
      return response.data;
    } catch (error) {
      logger.error('Enhance clinical note error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Clinical notes AI service is not reachable', 503);
        }
        throw new AppError(`Clinical notes error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Clinical notes service error', 500);
    }
  }

  // ============= Pharmacy/Drug Interaction Methods =============

  /**
   * Check drug interactions for a list of medications
   */
  async checkDrugInteractions(data: {
    medications: string[];
    patientAge?: number;
    patientConditions?: string[];
    allergies?: string[];
  }) {
    try {
      logger.info(`Checking drug interactions for ${data.medications.length} medications`);
      const response = await this.aiClient.post('/api/pharmacy/check-interactions', {
        medications: data.medications,
        patient_age: data.patientAge,
        patient_conditions: data.patientConditions || [],
        allergies: data.allergies || [],
      });
      return response.data;
    } catch (error) {
      logger.error('Check drug interactions error:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Pharmacy AI service is not reachable', 503);
        }
        throw new AppError(`Pharmacy error: ${error.response?.data?.detail || error.message}`, error.response?.status || 500);
      }
      throw new AppError('Pharmacy service error', 500);
    }
  }
}

export const aiService = new AIService();
