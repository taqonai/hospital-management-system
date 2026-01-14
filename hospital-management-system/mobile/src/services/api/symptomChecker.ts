import api, { aiApi } from './client';
import {
  ApiResponse,
  SymptomCheckerSession,
  SymptomQuestion,
  SymptomCheckerResult,
} from '../../types';

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
  // Uses regular api (30s timeout) since Whisper is fast
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
  // Uses aiApi (90s timeout) for GPT-4 analysis
  startSession: (data?: StartSessionData) =>
    aiApi.post<ApiResponse<SessionResponse>>('/ai/symptom-checker/start', data || {}),

  // Submit responses to get next questions
  // Uses aiApi (90s timeout) for GPT-4 analysis
  respond: (data: RespondData) =>
    aiApi.post<ApiResponse<{
      questions?: SymptomQuestion[];
      progress: number;
      isComplete: boolean;
    }>>('/ai/symptom-checker/respond', data),

  // Complete assessment and get triage result
  // Uses aiApi (90s timeout) for GPT-4 triage analysis
  complete: (sessionId: string, hospitalId?: string) =>
    aiApi.post<ApiResponse<SymptomCheckerResult>>('/ai/symptom-checker/complete', { sessionId, hospitalId }),

  // Get session details - no AI, uses regular api
  getSession: (sessionId: string) =>
    api.get<ApiResponse<SymptomCheckerSession>>(`/ai/symptom-checker/session/${sessionId}`),

  // Quick symptom check (simplified)
  // Uses aiApi (90s timeout) for AI analysis
  quickCheck: (symptoms: string[], patientAge?: number) =>
    aiApi.post<ApiResponse<{
      urgency: string;
      recommendations: string[];
      suggestedDepartment?: string;
    }>>('/ai/symptom-checker/quick-check', { symptoms, patientAge }),

  // Get available departments for booking - no AI, uses regular api
  getDepartments: () =>
    api.get<ApiResponse<Array<{ id: string; name: string; keywords: string[] }>>>('/ai/symptom-checker/departments'),
};

export default symptomCheckerApi;
