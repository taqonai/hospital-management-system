import api from './client';
import {
  ApiResponse,
  SymptomCheckerSession,
  SymptomQuestion,
  SymptomCheckerResult,
} from '../../types';

// Extended timeout for AI operations (90 seconds instead of default 30)
const AI_TIMEOUT = 90000;

export interface StartSessionData {
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
}

export interface SessionResponse {
  sessionId: string;
  questions: SymptomQuestion[];
  progress: number;
}

export interface RespondData {
  sessionId: string;
  responses: Array<{
    questionId: string;
    answer: any;
  }>;
}

export const symptomCheckerApi = {
  // Transcribe audio to text using Whisper AI service
  transcribeAudio: async (audioUri: string) => {
    const formData = new FormData();
    const audioFile = {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any;
    formData.append('audio', audioFile);

    // Uses public transcribe endpoint with Whisper AI
    // Backend returns 'transcript' field, but we support both for compatibility
    return api.post<ApiResponse<{ transcript: string; text?: string; confidence?: number; duration?: number }>>('/ai/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Start a new symptom checker session
  // Uses extended timeout for GPT-4 analysis
  startSession: (data?: StartSessionData) =>
    api.post<ApiResponse<SessionResponse>>('/ai/symptom-checker/start', data || {}, { timeout: AI_TIMEOUT }),

  // Submit responses to get next questions
  // Uses extended timeout for GPT-4 analysis
  respond: (data: RespondData) =>
    api.post<ApiResponse<{
      questions?: SymptomQuestion[];
      progress: number;
      isComplete: boolean;
    }>>('/ai/symptom-checker/respond', data, { timeout: AI_TIMEOUT }),

  // Complete assessment and get triage result
  // Uses extended timeout for GPT-4 triage analysis
  complete: (sessionId: string, hospitalId?: string) =>
    api.post<ApiResponse<SymptomCheckerResult>>('/ai/symptom-checker/complete', { sessionId, hospitalId }, { timeout: AI_TIMEOUT }),

  // Get session details
  getSession: (sessionId: string) =>
    api.get<ApiResponse<SymptomCheckerSession>>(`/ai/symptom-checker/session/${sessionId}`),

  // Quick symptom check (simplified)
  // Uses extended timeout for AI analysis
  quickCheck: (symptoms: string[], patientAge?: number) =>
    api.post<ApiResponse<{
      urgency: string;
      recommendations: string[];
      suggestedDepartment?: string;
    }>>('/ai/symptom-checker/quick-check', { symptoms, patientAge }, { timeout: AI_TIMEOUT }),

  // Get available departments for booking
  getDepartments: () =>
    api.get<ApiResponse<Array<{ id: string; name: string; keywords: string[] }>>>('/ai/symptom-checker/departments'),
};

export default symptomCheckerApi;
