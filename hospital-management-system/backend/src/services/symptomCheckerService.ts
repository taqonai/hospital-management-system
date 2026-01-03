import axios from 'axios';
import prisma from '../config/database';
import { config } from '../config';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import logger from '../utils/logger';

// =============================================================================
// Types and Interfaces
// =============================================================================

export enum TriageLevel {
  EMERGENCY = 'EMERGENCY',
  URGENT = 'URGENT',
  ROUTINE = 'ROUTINE',
  SELF_CARE = 'SELF_CARE',
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
  RED_FLAG_DETECTED = 'RED_FLAG_DETECTED',
}

export interface PatientInfo {
  patientId?: string;
  age?: number;
  gender?: string;
  medicalHistory?: string[];
  currentMedications?: string[];
  allergies?: string[];
}

export interface StartSessionRequest {
  patientInfo?: PatientInfo;
  initialSymptoms?: string[];
  hospitalId?: string;
}

export interface StartSessionResponse {
  sessionId: string;
  status: string;
  message: string;
  nextQuestions: QuestionData[];
  progress: number;
  redFlagDetected: boolean;
  redFlagMessage?: string;
}

export interface QuestionData {
  id: string;
  type: string;
  question: string;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  labels?: Record<string, string>;
  required?: boolean;
  priority?: number;
}

export interface RespondRequest {
  sessionId: string;
  responses: { questionId: string; answer: any }[];
}

export interface RespondResponse {
  sessionId: string;
  status: string;
  message?: string;
  nextQuestions?: QuestionData[];
  progress: number;
  isComplete: boolean;
  redFlagDetected: boolean;
  redFlagMessage?: string;
  triageLevel?: TriageLevel;
}

export interface GetSessionResponse {
  sessionId: string;
  status: string;
  patientInfo?: PatientInfo;
  collectedSymptoms: string[];
  answers: Record<string, any>;
  progress: number;
  redFlags: RedFlag[];
  createdAt: string;
  lastUpdatedAt: string;
}

export interface RedFlag {
  flagId: string;
  keyword: string;
  severity: number;
  message: string;
  triageLevel: string;
  department: string;
}

export interface PossibleCondition {
  name: string;
  confidence: number;
  icdCode?: string;
  description?: string;
  severity: string;
}

export interface EstimatedWaitTime {
  estimatedMinutes: number;
  rangeMinutes: {
    min: number;
    max: number;
  };
  note: string;
}

export interface CompleteResponse {
  sessionId: string;
  triageLevel: TriageLevel;
  recommendedDepartment: string;
  urgencyScore: number;
  redFlags: string[];
  nextQuestions: string[];
  possibleConditions: PossibleCondition[];
  recommendedAction: string;
  estimatedWaitTime?: EstimatedWaitTime;
  selfCareAdvice: string[];
  whenToSeekHelp: string[];
  symptomsSummary: string[];
  disclaimer: string;
}

// Legacy types for backward compatibility
interface LegacyStartSessionRequest {
  patientId?: string;
  patientAge?: number;
  patientGender?: string;
}

interface LegacyAnswerRequest {
  sessionId: string;
  answer: any;
  questionId: string;
}

interface LegacyCompleteRequest {
  sessionId: string;
}

interface LegacyQuestion {
  id: string;
  type: 'text' | 'select' | 'multiselect' | 'scale';
  question: string;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  help_text?: string;
  min?: number;
  max?: number;
  labels?: Record<string, string>;
}

interface LegacyStartSessionResponse {
  session_id: string;
  message: string;
  question: LegacyQuestion;
  progress: number;
}

interface LegacyAnswerResponse {
  session_id: string;
  message?: string;
  question?: LegacyQuestion;
  progress: number;
  is_complete: boolean;
  red_flag_detected: boolean;
  red_flag_message?: string;
}

interface LegacyTriageResult {
  session_id: string;
  urgency: 'self-care' | 'schedule-appointment' | 'urgent-care' | 'emergency';
  urgency_level: 1 | 2 | 3 | 4;
  urgency_color: 'green' | 'blue' | 'orange' | 'red';
  primary_concern: string;
  body_part: string;
  severity: 'mild' | 'moderate' | 'severe';
  symptoms_summary: string[];
  possible_conditions: Array<{
    name: string;
    likelihood: string;
    note: string;
  }>;
  recommended_department: string;
  follow_up_questions: string[];
  self_care_advice: string[];
  when_to_seek_help: string[];
  red_flags_present: boolean;
  red_flag_symptoms: string[];
  disclaimer: string;
}

// =============================================================================
// Fallback Knowledge Base
// =============================================================================

const RED_FLAG_KEYWORDS: Record<string, { message: string; triageLevel: TriageLevel; department: string; severity: number }> = {
  'chest pain': {
    message: 'CRITICAL: Chest pain may indicate a cardiac emergency. Call 911 or seek immediate medical attention.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency/Cardiology',
    severity: 10,
  },
  'chest pressure': {
    message: 'CRITICAL: Chest pressure may indicate a cardiac emergency. Seek immediate medical attention.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency/Cardiology',
    severity: 10,
  },
  'difficulty breathing': {
    message: 'CRITICAL: Severe breathing difficulty requires immediate emergency care.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency',
    severity: 10,
  },
  'can\'t breathe': {
    message: 'CRITICAL: Severe breathing difficulty requires immediate emergency care. Call 911.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency',
    severity: 10,
  },
  'severe bleeding': {
    message: 'CRITICAL: Severe or uncontrolled bleeding requires immediate emergency care.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency',
    severity: 10,
  },
  'coughing blood': {
    message: 'CRITICAL: Coughing up blood requires immediate medical evaluation.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency',
    severity: 10,
  },
  'vomiting blood': {
    message: 'CRITICAL: Vomiting blood requires immediate medical evaluation.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency',
    severity: 10,
  },
  'loss of consciousness': {
    message: 'CRITICAL: Loss of consciousness requires immediate medical evaluation.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency',
    severity: 9,
  },
  'passed out': {
    message: 'CRITICAL: Loss of consciousness requires immediate medical evaluation.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency',
    severity: 9,
  },
  'suicidal': {
    message: 'URGENT: If you\'re having thoughts of self-harm, please reach out immediately. National Suicide Prevention Lifeline: 988. You are not alone.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency/Psychiatry',
    severity: 10,
  },
  'want to die': {
    message: 'URGENT: If you\'re having thoughts of self-harm, please reach out immediately. National Suicide Prevention Lifeline: 988. You are not alone.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency/Psychiatry',
    severity: 10,
  },
  'stroke': {
    message: 'CRITICAL: Stroke symptoms require immediate emergency care. Remember FAST: Face, Arms, Speech, Time. Call 911.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency/Neurology',
    severity: 10,
  },
  'face drooping': {
    message: 'CRITICAL: Facial drooping may indicate a stroke. Call 911 immediately.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency/Neurology',
    severity: 10,
  },
  'slurred speech': {
    message: 'CRITICAL: Sudden slurred speech may indicate a stroke. Call 911 immediately.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency/Neurology',
    severity: 10,
  },
  'seizure': {
    message: 'URGENT: Seizure activity requires emergency evaluation.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency/Neurology',
    severity: 9,
  },
  'severe allergic': {
    message: 'CRITICAL: Severe allergic reaction (anaphylaxis) is life-threatening. Use epinephrine if available and call 911.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency',
    severity: 10,
  },
  'throat swelling': {
    message: 'CRITICAL: Throat swelling may indicate anaphylaxis. Seek immediate emergency care.',
    triageLevel: TriageLevel.EMERGENCY,
    department: 'Emergency',
    severity: 10,
  },
};

const FALLBACK_QUESTIONS: QuestionData[] = [
  {
    id: 'main_symptoms',
    type: 'multitext',
    question: 'What symptoms are you experiencing today?',
    placeholder: 'Type or speak your symptoms...',
    helpText: 'Describe your main symptoms in your own words',
    required: true,
    priority: 1,
  },
  {
    id: 'body_location',
    type: 'select',
    question: 'Which part of your body is primarily affected?',
    options: [
      { value: 'head_neck', label: 'Head/Neck' },
      { value: 'chest', label: 'Chest' },
      { value: 'abdomen', label: 'Abdomen/Stomach' },
      { value: 'back_spine', label: 'Back/Spine' },
      { value: 'limbs', label: 'Arms/Legs' },
      { value: 'skin', label: 'Skin' },
      { value: 'general', label: 'Whole Body' },
    ],
    required: true,
    priority: 2,
  },
  {
    id: 'severity',
    type: 'scale',
    question: 'How severe are your symptoms?',
    min: 1,
    max: 10,
    labels: { '1': 'Mild', '10': 'Severe' },
    required: true,
    priority: 3,
  },
  {
    id: 'duration',
    type: 'select',
    question: 'How long have you had these symptoms?',
    options: [
      { value: 'just_started', label: 'Just started' },
      { value: 'today', label: 'Today' },
      { value: '1-3_days', label: '1-3 days' },
      { value: '4-7_days', label: '4-7 days' },
      { value: 'more_than_week', label: 'More than a week' },
    ],
    required: true,
    priority: 4,
  },
  {
    id: 'associated_symptoms',
    type: 'multiselect',
    question: 'Any additional symptoms?',
    options: [
      { value: 'fever', label: 'Fever/chills' },
      { value: 'fatigue', label: 'Fatigue' },
      { value: 'nausea', label: 'Nausea' },
      { value: 'headache', label: 'Headache' },
      { value: 'dizziness', label: 'Dizziness' },
      { value: 'none', label: 'None' },
    ],
    required: false,
    priority: 5,
  },
];

const FALLBACK_QUESTION_FLOW = ['main_symptoms', 'body_location', 'severity', 'duration', 'associated_symptoms'];

// =============================================================================
// Symptom Checker Service
// =============================================================================

export class SymptomCheckerService {
  private symptomCheckerClient = axios.create({
    baseURL: config.ai.symptomCheckerUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // In-memory session storage for fallback
  private fallbackSessions: Map<string, any> = new Map();

  // =============================================================================
  // New API Methods (v2)
  // =============================================================================

  /**
   * Start a new symptom checking session (v2 API)
   */
  async startSession(data: StartSessionRequest, userId?: string): Promise<StartSessionResponse> {
    let patientInfo = data.patientInfo || {};

    // If patient ID is provided, fetch patient data
    if (data.patientInfo?.patientId) {
      try {
        const patient = await prisma.patient.findUnique({
          where: { id: data.patientInfo.patientId },
          include: {
            medicalHistory: true,
            allergies: true,
          },
        });

        if (patient) {
          const age = this.calculateAge(patient.dateOfBirth);
          patientInfo = {
            patientId: patient.id,
            age,
            gender: patient.gender,
            medicalHistory: patient.medicalHistory?.chronicConditions || [],
            currentMedications: patient.medicalHistory?.currentMedications || [],
            allergies: patient.allergies.map(a => a.allergen),
          };
        }
      } catch (error) {
        logger.warn('Failed to fetch patient info for symptom checker:', error);
      }
    }

    try {
      logger.info('Starting symptom checker session (v2)');

      const response = await this.symptomCheckerClient.post<StartSessionResponse>('/api/symptom-checker/start', {
        patientInfo,
        initialSymptoms: data.initialSymptoms || [],
        hospitalId: data.hospitalId,
      });

      // Store session reference in database if patient is provided
      if (patientInfo.patientId) {
        await this.storeSessionReference(patientInfo.patientId, response.data.sessionId);
      }

      return response.data;
    } catch (error) {
      logger.error('Symptom checker AI service error:', error);

      if (axios.isAxiosError(error) && !error.response) {
        logger.warn('Symptom checker service unavailable, using fallback');
        return this.fallbackStartSession(data, patientInfo);
      }

      throw new AppError('Symptom checker service temporarily unavailable', 503);
    }
  }

  /**
   * Submit responses and continue the conversation (v2 API)
   */
  async submitResponse(data: RespondRequest): Promise<RespondResponse> {
    try {
      logger.info(`Submitting responses for session ${data.sessionId}`);

      const response = await this.symptomCheckerClient.post<RespondResponse>('/api/symptom-checker/respond', {
        sessionId: data.sessionId,
        responses: data.responses,
      });

      return response.data;
    } catch (error) {
      logger.error('Symptom checker respond error:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          // Check fallback sessions
          if (this.fallbackSessions.has(data.sessionId)) {
            return this.fallbackSubmitResponse(data);
          }
          throw new NotFoundError('Session not found');
        }
        if (!error.response) {
          // Service unavailable, try fallback
          if (this.fallbackSessions.has(data.sessionId)) {
            return this.fallbackSubmitResponse(data);
          }
        }
      }

      throw new AppError('Failed to process symptom checker response', 500);
    }
  }

  /**
   * Get session status and details (v2 API)
   */
  async getSession(sessionId: string): Promise<GetSessionResponse> {
    try {
      logger.info(`Getting session ${sessionId}`);

      const response = await this.symptomCheckerClient.get<GetSessionResponse>(
        `/api/symptom-checker/session/${sessionId}`
      );

      return response.data;
    } catch (error) {
      logger.error('Get session error:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          // Check fallback sessions
          const fallbackSession = this.fallbackSessions.get(sessionId);
          if (fallbackSession) {
            return this.formatFallbackSession(fallbackSession);
          }
          throw new NotFoundError('Session not found');
        }
      }

      throw new AppError('Failed to get session status', 500);
    }
  }

  /**
   * Complete the session and get final triage result (v2 API)
   */
  async completeSession(sessionId: string): Promise<CompleteResponse> {
    try {
      logger.info(`Completing session ${sessionId}`);

      const response = await this.symptomCheckerClient.post<CompleteResponse>('/api/symptom-checker/complete', {
        sessionId,
      });

      // Update database record
      await this.storeAssessmentResultV2(sessionId, response.data);

      return response.data;
    } catch (error) {
      logger.error('Complete session error:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          // Check fallback sessions
          if (this.fallbackSessions.has(sessionId)) {
            return this.fallbackCompleteSession(sessionId);
          }
          throw new NotFoundError('Session not found');
        }
        if (!error.response) {
          // Service unavailable, try fallback
          if (this.fallbackSessions.has(sessionId)) {
            return this.fallbackCompleteSession(sessionId);
          }
        }
      }

      throw new AppError('Failed to complete symptom checker session', 500);
    }
  }

  /**
   * Quick check for emergency symptoms
   */
  async quickCheck(symptoms: string[]): Promise<{
    triageLevel: TriageLevel;
    urgencyScore: number;
    recommendedDepartment: string;
    redFlagsDetected: boolean;
    redFlags: string[];
    recommendedAction: string;
  }> {
    const allText = symptoms.join(' ').toLowerCase();
    const detectedFlags: string[] = [];
    let highestTriageLevel = TriageLevel.SELF_CARE;
    let department = 'General Practice';
    let maxSeverity = 0;

    for (const [keyword, data] of Object.entries(RED_FLAG_KEYWORDS)) {
      if (allText.includes(keyword)) {
        detectedFlags.push(keyword);
        if (data.severity > maxSeverity) {
          maxSeverity = data.severity;
          highestTriageLevel = data.triageLevel;
          department = data.department;
        }
      }
    }

    let urgencyScore = 3;
    if (highestTriageLevel === TriageLevel.EMERGENCY) {
      urgencyScore = 10;
    } else if (highestTriageLevel === TriageLevel.URGENT) {
      urgencyScore = 7;
    } else if (highestTriageLevel === TriageLevel.ROUTINE) {
      urgencyScore = 5;
    }

    return {
      triageLevel: highestTriageLevel,
      urgencyScore,
      recommendedDepartment: department,
      redFlagsDetected: detectedFlags.length > 0,
      redFlags: detectedFlags,
      recommendedAction: this.getRecommendedAction(highestTriageLevel, department),
    };
  }

  // =============================================================================
  // Legacy API Methods (v1 - for backward compatibility)
  // =============================================================================

  /**
   * Start a new symptom checking session (legacy v1)
   */
  async startSessionLegacy(data: LegacyStartSessionRequest): Promise<LegacyStartSessionResponse> {
    try {
      let patientAge = data.patientAge;
      let patientGender = data.patientGender;

      if (data.patientId) {
        const patient = await prisma.patient.findUnique({
          where: { id: data.patientId },
        });

        if (patient) {
          patientAge = this.calculateAge(patient.dateOfBirth);
          patientGender = patient.gender;
        }
      }

      logger.info('Starting symptom checker session (legacy)', { patientId: data.patientId });

      const response = await this.symptomCheckerClient.post<LegacyStartSessionResponse>(
        '/api/symptom-check/start',
        {
          patient_id: data.patientId,
          patient_age: patientAge,
          patient_gender: patientGender,
        }
      );

      if (data.patientId) {
        await this.storeSessionReference(data.patientId, response.data.session_id);
      }

      return response.data;
    } catch (error) {
      logger.error('Error starting symptom checker session:', error);
      if (axios.isAxiosError(error) && !error.response) {
        throw new AppError(
          'Symptom Checker service is not available. Please try again later.',
          503
        );
      }
      throw new AppError('Failed to start symptom checking session', 500);
    }
  }

  /**
   * Submit an answer and get the next question (legacy v1)
   */
  async submitAnswer(data: LegacyAnswerRequest): Promise<LegacyAnswerResponse> {
    try {
      logger.info('Submitting symptom checker answer', {
        sessionId: data.sessionId,
        questionId: data.questionId,
      });

      const response = await this.symptomCheckerClient.post<LegacyAnswerResponse>(
        '/api/symptom-check/answer',
        {
          session_id: data.sessionId,
          answer: data.answer,
          question_id: data.questionId,
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error submitting symptom checker answer:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Symptom Checker service is not available', 503);
        }
        if (error.response.status === 404) {
          throw new NotFoundError('Session not found');
        }
        if (error.response.status === 400) {
          throw new AppError(error.response.data?.detail || 'Invalid request', 400);
        }
      }
      throw new AppError('Failed to process answer', 500);
    }
  }

  /**
   * Complete the assessment and get triage result (legacy v1)
   */
  async completeAssessment(data: LegacyCompleteRequest): Promise<LegacyTriageResult> {
    try {
      logger.info('Completing symptom checker assessment', { sessionId: data.sessionId });

      const response = await this.symptomCheckerClient.post<LegacyTriageResult>(
        '/api/symptom-check/complete',
        {
          session_id: data.sessionId,
        }
      );

      await this.storeAssessmentResult(data.sessionId, response.data);

      return response.data;
    } catch (error) {
      logger.error('Error completing symptom checker assessment:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('Symptom Checker service is not available', 503);
        }
        if (error.response.status === 404) {
          throw new NotFoundError('Session not found');
        }
      }
      throw new AppError('Failed to complete assessment', 500);
    }
  }

  /**
   * Get symptom check history for a patient
   */
  async getHistory(patientId?: string, hospitalId?: string): Promise<{ history: any[] }> {
    try {
      // Note: symptomCheckSession model not yet in schema, using AI service directly
      // Fall back to AI service
      const params = new URLSearchParams();
      if (patientId) params.append('patient_id', patientId);
      if (hospitalId) params.append('hospital_id', hospitalId);

      const response = await this.symptomCheckerClient.get(`/api/symptom-checker/history?${params.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching symptom check history:', error);
      return { history: [] };
    }
  }

  /**
   * Get body parts for the body diagram
   */
  async getBodyParts(): Promise<any> {
    try {
      const response = await this.symptomCheckerClient.get('/api/symptom-checker/body-parts');
      return response.data;
    } catch (error) {
      logger.error('Error fetching body parts:', error);
      return {
        bodyParts: [
          { id: 'head_neck', name: 'Head/Neck', examples: 'headache, sore throat, ear pain' },
          { id: 'chest', name: 'Chest', examples: 'breathing, heart, cough' },
          { id: 'abdomen', name: 'Abdomen/Stomach', examples: 'digestive issues' },
          { id: 'back_spine', name: 'Back/Spine', examples: '' },
          { id: 'arms_hands', name: 'Arms/Hands', examples: '' },
          { id: 'legs_feet', name: 'Legs/Feet', examples: '' },
          { id: 'skin', name: 'Skin', examples: 'rash, itching' },
          { id: 'general', name: 'Whole Body/General', examples: 'fever, fatigue' },
          { id: 'mental', name: 'Mental/Emotional', examples: '' },
        ],
      };
    }
  }

  /**
   * Get available departments
   */
  async getDepartments(): Promise<any> {
    try {
      const response = await this.symptomCheckerClient.get('/api/symptom-checker/departments');
      return response.data;
    } catch (error) {
      logger.error('Error fetching departments:', error);
      return {
        departments: [
          { id: 'emergency', name: 'Emergency' },
          { id: 'cardiology', name: 'Cardiology' },
          { id: 'neurology', name: 'Neurology' },
          { id: 'gastroenterology', name: 'Gastroenterology' },
          { id: 'orthopedics', name: 'Orthopedics' },
          { id: 'pulmonology', name: 'Pulmonology' },
          { id: 'dermatology', name: 'Dermatology' },
          { id: 'internal-medicine', name: 'Internal Medicine' },
          { id: 'general-practice', name: 'General Practice' },
        ],
      };
    }
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<any> {
    try {
      const response = await this.symptomCheckerClient.get('/health');
      return {
        status: 'connected',
        serviceHealth: response.data,
        serviceUrl: config.ai.symptomCheckerUrl,
        fallbackAvailable: true,
      };
    } catch (error) {
      logger.error('Symptom Checker health check failed:', error);
      return {
        status: 'disconnected',
        error: axios.isAxiosError(error) ? error.message : 'Unknown error',
        serviceUrl: config.ai.symptomCheckerUrl,
        fallbackAvailable: true,
      };
    }
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

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

  private getTriagePriority(level: TriageLevel): number {
    const priorities: Record<TriageLevel, number> = {
      [TriageLevel.EMERGENCY]: 4,
      [TriageLevel.URGENT]: 3,
      [TriageLevel.ROUTINE]: 2,
      [TriageLevel.SELF_CARE]: 1,
    };
    return priorities[level] || 0;
  }

  private getRecommendedAction(triageLevel: TriageLevel, department: string): string {
    const actions: Record<TriageLevel, string> = {
      [TriageLevel.EMERGENCY]: `SEEK IMMEDIATE EMERGENCY CARE. Go to the nearest Emergency Room or call 911. Your symptoms require urgent evaluation by ${department}.`,
      [TriageLevel.URGENT]: `Seek medical attention within the next few hours. Contact ${department} or visit urgent care. If symptoms worsen, go to Emergency Room.`,
      [TriageLevel.ROUTINE]: `Schedule an appointment with ${department} within the next few days. Monitor symptoms and seek earlier care if they worsen.`,
      [TriageLevel.SELF_CARE]: `Your symptoms appear manageable with self-care. If symptoms persist beyond a few days or worsen, schedule an appointment with ${department}.`,
    };
    return actions[triageLevel];
  }

  private async storeSessionReference(_patientId: string, _sessionId: string): Promise<void> {
    // Note: symptomCheckSession model not yet in schema
    // Sessions are managed in-memory or via AI service
    logger.debug('Session reference stored in-memory (database model pending)');
  }

  private async storeAssessmentResult(_sessionId: string, _result: LegacyTriageResult): Promise<void> {
    // Note: symptomCheckSession model not yet in schema
    // Results are managed in-memory or via AI service
    logger.debug('Assessment result stored in-memory (database model pending)');
  }

  private async storeAssessmentResultV2(_sessionId: string, _result: CompleteResponse): Promise<void> {
    // Note: symptomCheckSession model not yet in schema
    // Results are managed in-memory or via AI service
    logger.debug('Assessment result (v2) stored in-memory (database model pending)');
  }

  // =============================================================================
  // Fallback Methods
  // =============================================================================

  private fallbackStartSession(data: StartSessionRequest, patientInfo: PatientInfo): StartSessionResponse {
    const sessionId = `fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const redFlags: RedFlag[] = [];
    let redFlagMessage: string | undefined;

    if (data.initialSymptoms) {
      const allText = data.initialSymptoms.join(' ').toLowerCase();
      for (const [keyword, flagData] of Object.entries(RED_FLAG_KEYWORDS)) {
        if (allText.includes(keyword)) {
          redFlags.push({
            flagId: keyword.replace(/\s+/g, '_'),
            keyword,
            severity: flagData.severity,
            message: flagData.message,
            triageLevel: flagData.triageLevel,
            department: flagData.department,
          });
          redFlagMessage = flagData.message;
        }
      }
    }

    this.fallbackSessions.set(sessionId, {
      id: sessionId,
      status: redFlags.length > 0 && redFlags.some(rf => rf.triageLevel === TriageLevel.EMERGENCY)
        ? SessionStatus.RED_FLAG_DETECTED
        : SessionStatus.ACTIVE,
      patientInfo,
      initialSymptoms: data.initialSymptoms || [],
      collectedSymptoms: data.initialSymptoms || [],
      answers: {},
      currentQuestionIndex: 0,
      redFlags,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    });

    if (redFlags.length > 0 && redFlags.some(rf => rf.triageLevel === TriageLevel.EMERGENCY)) {
      return {
        sessionId,
        status: SessionStatus.RED_FLAG_DETECTED,
        message: redFlagMessage || 'Red flag symptoms detected. Please seek immediate medical attention.',
        nextQuestions: [],
        progress: 100,
        redFlagDetected: true,
        redFlagMessage,
      };
    }

    return {
      sessionId,
      status: SessionStatus.ACTIVE,
      message: 'Welcome to the Symptom Checker. I\'ll ask you a few questions to better understand your symptoms.',
      nextQuestions: FALLBACK_QUESTIONS.slice(0, 2),
      progress: 0,
      redFlagDetected: redFlags.length > 0,
      redFlagMessage,
    };
  }

  private fallbackSubmitResponse(data: RespondRequest): RespondResponse {
    const session = this.fallbackSessions.get(data.sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    for (const response of data.responses) {
      session.answers[response.questionId] = response.answer;

      // Collect symptoms from main_symptoms
      if (response.questionId === 'main_symptoms') {
        const answer = response.answer;
        if (typeof answer === 'string') {
          const symptoms = answer.split(',').map((s: string) => s.trim());
          session.collectedSymptoms = [...(session.collectedSymptoms || []), ...symptoms];
        }
      }

      if (typeof response.answer === 'string') {
        const text = response.answer.toLowerCase();
        for (const [keyword, flagData] of Object.entries(RED_FLAG_KEYWORDS)) {
          if (text.includes(keyword)) {
            const existingFlag = session.redFlags.find((rf: RedFlag) => rf.keyword === keyword);
            if (!existingFlag) {
              session.redFlags.push({
                flagId: keyword.replace(/\s+/g, '_'),
                keyword,
                severity: flagData.severity,
                message: flagData.message,
                triageLevel: flagData.triageLevel,
                department: flagData.department,
              });
            }
          }
        }
      }
    }

    session.lastUpdatedAt = new Date().toISOString();

    // Calculate progress based on answered questions in flow
    const answeredInFlow = FALLBACK_QUESTION_FLOW.filter(qId => qId in session.answers);
    const progress = Math.min(Math.round((answeredInFlow.length / FALLBACK_QUESTION_FLOW.length) * 100), 100);

    const emergencyFlags = session.redFlags.filter((rf: RedFlag) => rf.triageLevel === TriageLevel.EMERGENCY);
    if (emergencyFlags.length > 0) {
      session.status = SessionStatus.RED_FLAG_DETECTED;
      return {
        sessionId: data.sessionId,
        status: session.status,
        progress: 100,
        isComplete: true,
        redFlagDetected: true,
        redFlagMessage: emergencyFlags[0].message,
        triageLevel: TriageLevel.EMERGENCY,
      };
    }

    // Get next unanswered questions from flow
    const nextQuestionIds = FALLBACK_QUESTION_FLOW.filter(qId => !(qId in session.answers));
    const nextQuestions = nextQuestionIds
      .slice(0, 2)
      .map(qId => FALLBACK_QUESTIONS.find(q => q.id === qId))
      .filter(Boolean) as QuestionData[];

    const isComplete = nextQuestions.length === 0;

    if (isComplete) {
      session.status = SessionStatus.COMPLETED;
    }

    // Generate contextual message
    let message: string | undefined;
    if (!isComplete && session.collectedSymptoms?.length > 0) {
      const symptom = session.collectedSymptoms[0];
      message = `Got it. Let me understand more about your ${symptom.toLowerCase()}.`;
    } else if (isComplete) {
      message = 'Assessment complete. Your results are ready.';
    }

    return {
      sessionId: data.sessionId,
      status: session.status,
      message,
      nextQuestions: isComplete ? undefined : nextQuestions,
      progress,
      isComplete,
      redFlagDetected: session.redFlags.length > 0,
    };
  }

  private formatFallbackSession(session: any): GetSessionResponse {
    const answeredInFlow = FALLBACK_QUESTION_FLOW.filter(qId => qId in session.answers);
    const progress = Math.min(Math.round((answeredInFlow.length / FALLBACK_QUESTION_FLOW.length) * 100), 100);

    return {
      sessionId: session.id,
      status: session.status,
      patientInfo: session.patientInfo,
      collectedSymptoms: session.initialSymptoms || [],
      answers: session.answers,
      progress,
      redFlags: session.redFlags,
      createdAt: session.createdAt,
      lastUpdatedAt: session.lastUpdatedAt,
    };
  }

  private fallbackCompleteSession(sessionId: string): CompleteResponse {
    const session = this.fallbackSessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    const severity = session.answers.severity || 5;
    const symptoms = session.collectedSymptoms || session.initialSymptoms || [];
    const redFlags = session.redFlags || [];

    let triageLevel = TriageLevel.ROUTINE;
    let urgencyScore = 5;
    let department = 'General Practice';

    if (redFlags.length > 0) {
      const highestFlag = redFlags.reduce((prev: RedFlag, curr: RedFlag) =>
        this.getTriagePriority(curr.triageLevel as TriageLevel) > this.getTriagePriority(prev.triageLevel as TriageLevel) ? curr : prev
      );
      triageLevel = highestFlag.triageLevel as TriageLevel;
      department = highestFlag.department;
      urgencyScore = triageLevel === TriageLevel.EMERGENCY ? 10 : 8;
    } else if (severity >= 8) {
      triageLevel = TriageLevel.URGENT;
      urgencyScore = 8;
    } else if (severity >= 5) {
      triageLevel = TriageLevel.ROUTINE;
      urgencyScore = 5;
    } else {
      triageLevel = TriageLevel.SELF_CARE;
      urgencyScore = 3;
    }

    const bodyLocation = session.answers.body_location;
    const locationDepartments: Record<string, string> = {
      head_neck: 'ENT/Neurology',
      chest: 'Cardiology/Pulmonology',
      abdomen: 'Gastroenterology',
      back_spine: 'Orthopedics',
      arms_hands: 'Orthopedics',
      legs_feet: 'Orthopedics',
      skin: 'Dermatology',
      general: 'Internal Medicine',
      mental: 'Psychiatry',
    };
    if (!redFlags.length && bodyLocation && locationDepartments[bodyLocation]) {
      department = locationDepartments[bodyLocation];
    }

    session.status = SessionStatus.COMPLETED;
    session.lastUpdatedAt = new Date().toISOString();

    return {
      sessionId,
      triageLevel,
      recommendedDepartment: department,
      urgencyScore,
      redFlags: redFlags.map((rf: RedFlag) => rf.keyword),
      nextQuestions: [
        'Have you experienced these symptoms before?',
        'Are there any activities that make symptoms better or worse?',
        'Have you recently traveled or been exposed to illness?',
      ],
      possibleConditions: [
        {
          name: 'Further Evaluation Needed',
          confidence: 0,
          severity: 'unknown',
          description: 'Your symptoms require professional medical evaluation for proper diagnosis.',
        },
      ],
      recommendedAction: this.getRecommendedAction(triageLevel, department),
      estimatedWaitTime: {
        estimatedMinutes: triageLevel === TriageLevel.EMERGENCY ? 5 : 30,
        rangeMinutes: {
          min: triageLevel === TriageLevel.EMERGENCY ? 0 : 15,
          max: triageLevel === TriageLevel.EMERGENCY ? 15 : 60,
        },
        note: 'Wait times are estimates and may vary based on current patient volume.',
      },
      selfCareAdvice: [
        'Get adequate rest and sleep',
        'Stay well-hydrated by drinking plenty of water',
        'Monitor your symptoms and note any changes',
      ],
      whenToSeekHelp: [
        'Symptoms suddenly worsen',
        'New symptoms develop',
        'Fever above 103F (39.4C)',
        'Symptoms persist beyond expected duration',
      ],
      symptomsSummary: symptoms,
      disclaimer: 'IMPORTANT: This symptom checker is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider.',
    };
  }
}

export const symptomCheckerService = new SymptomCheckerService();
