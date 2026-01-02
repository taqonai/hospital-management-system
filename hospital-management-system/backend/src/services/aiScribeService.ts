/**
 * AI Scribe Service - Backend integration for AI-powered medical scribe functionality
 * Provides transcription, entity extraction, SOAP note generation, and code suggestions
 */

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import prisma from '../config/database';
import { config } from '../config';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import logger from '../utils/logger';

// ============= Type Definitions =============

interface StartSessionRequest {
  patientId?: string;
  patientName?: string;
  patientAge?: number;
  patientGender?: string;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  appointmentId?: string;
  sessionType?: string; // consultation, follow_up, procedure, discharge
  existingConditions?: string[];
  currentMedications?: string[];
  knownAllergies?: string[];
}

interface StartSessionResponse {
  sessionId: string;
  status: string;
  createdAt: string;
  patientId?: string;
  patientName?: string;
  sessionType: string;
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

interface MedicalEntity {
  type: string;
  value: string;
  confidence: number;
  context?: string;
  unit?: string;
}

interface ExtractedEntities {
  symptoms: MedicalEntity[];
  diagnoses: MedicalEntity[];
  medications: MedicalEntity[];
  vitals: MedicalEntity[];
  allergies: MedicalEntity[];
  procedures: MedicalEntity[];
  history: MedicalEntity[];
  labResults: MedicalEntity[];
}

interface IcdCodeSuggestion {
  code: string;
  description: string;
  confidence: string;
  supportingText: string;
  category?: string;
}

interface CptCodeSuggestion {
  code: string;
  description: string;
  confidence: string;
  supportingText: string;
  category?: string;
}

interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface FollowUpRecommendation {
  timeframe: string;
  reason: string;
  priority: string;
  specialtyReferral?: string;
  testsRequired?: string[];
}

interface PrescriptionSuggestion {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions?: string;
  warnings?: string[];
  reason: string;
}

interface ProcessingResult {
  sessionId: string;
  status: string;
  transcript: TranscriptSegment[];
  fullTranscript: string;
  extractedEntities?: ExtractedEntities;
  generatedNote?: SoapNote;
  suggestedICD10Codes?: IcdCodeSuggestion[];
  suggestedCPTCodes?: CptCodeSuggestion[];
  keyFindings?: string[];
  followUpRecommendations?: FollowUpRecommendation[];
  prescriptionSuggestions?: PrescriptionSuggestion[];
  duration?: number;
  processedAt: string;
  modelVersion: string;
  noteType: string;
}

interface ScribeTemplate {
  id: string;
  name: string;
  description: string;
  noteType: string;
  sections: string[];
  prompts: Record<string, string>;
  requiredFields: string[];
}

interface SaveNotesRequest {
  sessionId: string;
  patientId: string;
  hospitalId: string;
  doctorId: string;
  soapNote: SoapNote;
  icdCodes?: string[];
  cptCodes?: string[];
  entities?: ExtractedEntities;
  prescriptions?: PrescriptionSuggestion[];
  followUpDate?: string;
  consultationId?: string;
  appointmentId?: string;
  notes?: string;
}

interface GenerateNoteRequest {
  text: string;
  noteType?: string;
  patientInfo?: Record<string, any>;
  extractEntities?: boolean;
  suggestCodes?: boolean;
}

interface ExtractEntitiesRequest {
  text: string;
  includeVitals?: boolean;
  includeMedications?: boolean;
  includeSymptoms?: boolean;
  includeDiagnoses?: boolean;
}

// ============= AI Scribe Service Class =============

export class AIScribeService {
  private aiScribeUrl: string;
  private aiClient: AxiosInstance;

  constructor() {
    // AI Scribe runs on port 8011
    this.aiScribeUrl = process.env.AI_SCRIBE_URL || 'http://localhost:8011';

    this.aiClient = axios.create({
      baseURL: this.aiScribeUrl,
      timeout: 180000, // 3 minutes for audio processing
      headers: {
        'Content-Type': 'application/json',
      },
    });

    logger.info(`AI Scribe Service initialized - URL: ${this.aiScribeUrl}`);
  }

  /**
   * Check AI Scribe service health
   */
  async checkHealth(): Promise<{
    status: string;
    available: boolean;
    version?: string;
    url: string;
  }> {
    try {
      const response = await this.aiClient.get('/health');
      return {
        status: 'connected',
        available: response.data.openai_available,
        version: response.data.version,
        url: this.aiScribeUrl,
      };
    } catch (error) {
      logger.error('AI Scribe health check failed:', error);
      return {
        status: 'disconnected',
        available: false,
        url: this.aiScribeUrl,
      };
    }
  }

  /**
   * Start a new scribe session
   */
  async startSession(data: StartSessionRequest): Promise<StartSessionResponse> {
    try {
      logger.info('Starting AI Scribe session', {
        patientId: data.patientId,
        sessionType: data.sessionType,
      });

      const response = await this.aiClient.post<StartSessionResponse>(
        '/api/scribe/start-session',
        data
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to start scribe session:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('AI Scribe service is not reachable', 503);
        }
        throw new AppError(
          `AI Scribe error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('Failed to start scribe session', 500);
    }
  }

  /**
   * Upload audio chunk for streaming transcription
   */
  async uploadAudioChunk(
    sessionId: string,
    audioData: Buffer,
    chunkNumber: number = 0,
    isFinal: boolean = false
  ): Promise<{
    sessionId: string;
    chunkNumber: number;
    received: boolean;
    totalChunks: number;
    isFinal: boolean;
  }> {
    try {
      // FormData already imported at top level
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('chunkNumber', chunkNumber.toString());
      formData.append('isFinal', isFinal.toString());
      formData.append('audio', audioData, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });

      const response = await this.aiClient.post('/api/scribe/upload-audio', formData, {
        headers: formData.getHeaders(),
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to upload audio chunk:', error);
      if (axios.isAxiosError(error)) {
        throw new AppError(
          `Audio upload error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('Failed to upload audio chunk', 500);
    }
  }

  /**
   * Transcribe audio file
   */
  async transcribeAudio(
    audioData: Buffer,
    filename: string = 'audio.webm',
    sessionId?: string
  ): Promise<{
    success: boolean;
    transcript: string;
    duration?: number;
    segments?: any[];
    modelVersion: string;
  }> {
    try {
      logger.info('Transcribing audio', { filename, sessionId });

      // FormData already imported at top level
      const formData = new FormData();
      formData.append('audio', audioData, {
        filename,
        contentType: this.getAudioContentType(filename),
      });
      if (sessionId) {
        formData.append('sessionId', sessionId);
      }

      const response = await this.aiClient.post('/api/scribe/transcribe', formData, {
        headers: formData.getHeaders(),
      });

      return response.data;
    } catch (error) {
      logger.error('Audio transcription failed:', error);
      if (axios.isAxiosError(error)) {
        throw new AppError(
          `Transcription error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('Audio transcription service unavailable', 503);
    }
  }

  /**
   * Process recording and generate documentation
   */
  async processRecording(
    sessionId: string,
    audioData?: Buffer,
    options: {
      generateSoapNote?: boolean;
      extractEntities?: boolean;
      suggestIcdCodes?: boolean;
      suggestCptCodes?: boolean;
      generateFollowUp?: boolean;
      generatePrescriptions?: boolean;
    } = {}
  ): Promise<ProcessingResult> {
    try {
      logger.info('Processing scribe recording', { sessionId, hasAudio: !!audioData });

      // FormData already imported at top level
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('generateSoapNote', (options.generateSoapNote !== false).toString());
      formData.append('extractEntities', (options.extractEntities !== false).toString());
      formData.append('suggestIcdCodes', (options.suggestIcdCodes !== false).toString());
      formData.append('suggestCptCodes', (options.suggestCptCodes !== false).toString());
      formData.append('generateFollowUp', (options.generateFollowUp !== false).toString());
      formData.append('generatePrescriptions', (options.generatePrescriptions !== false).toString());

      if (audioData) {
        formData.append('audio', audioData, {
          filename: 'audio.webm',
          contentType: 'audio/webm',
        });
      }

      const response = await this.aiClient.post<ProcessingResult>(
        '/api/scribe/process',
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 180000, // 3 minutes for processing
        }
      );

      logger.info('Recording processed successfully', {
        sessionId,
        hasSOAP: !!response.data.generatedNote,
        hasEntities: !!response.data.extractedEntities,
        icdCodesCount: response.data.suggestedICD10Codes?.length || 0,
        cptCodesCount: response.data.suggestedCPTCodes?.length || 0,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to process recording:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('AI Scribe service is not reachable', 503);
        }
        throw new AppError(
          `Processing error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('Failed to process recording', 500);
    }
  }

  /**
   * Generate clinical note from text input
   */
  async generateNoteFromText(request: GenerateNoteRequest): Promise<{
    success: boolean;
    sessionId: string;
    noteType: string;
    extractedEntities?: ExtractedEntities;
    generatedNote?: SoapNote;
    suggestedICD10Codes?: IcdCodeSuggestion[];
    suggestedCPTCodes?: CptCodeSuggestion[];
    keyFindings?: string[];
    followUpRecommendations?: FollowUpRecommendation[];
    prescriptionSuggestions?: PrescriptionSuggestion[];
    processedAt: string;
    modelVersion: string;
  }> {
    try {
      logger.info('Generating note from text', { noteType: request.noteType });

      const response = await this.aiClient.post('/api/scribe/generate-note', {
        text: request.text,
        noteType: request.noteType || 'consultation',
        patientInfo: request.patientInfo,
        extractEntities: request.extractEntities ?? true,
        suggestCodes: request.suggestCodes ?? true,
      });

      return response.data;
    } catch (error) {
      logger.error('Note generation failed:', error);
      if (axios.isAxiosError(error)) {
        throw new AppError(
          `Note generation error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('Note generation service unavailable', 503);
    }
  }

  /**
   * Extract clinical entities from text
   */
  async extractEntities(request: ExtractEntitiesRequest): Promise<{
    success: boolean;
    extractedEntities: ExtractedEntities;
    keyFindings: string[];
    processedAt: string;
    modelVersion: string;
  }> {
    try {
      logger.info('Extracting entities from text');

      const response = await this.aiClient.post('/api/scribe/extract-entities', {
        text: request.text,
        includeVitals: request.includeVitals ?? true,
        includeMedications: request.includeMedications ?? true,
        includeSymptoms: request.includeSymptoms ?? true,
        includeDiagnoses: request.includeDiagnoses ?? true,
      });

      return response.data;
    } catch (error) {
      logger.error('Entity extraction failed:', error);
      if (axios.isAxiosError(error)) {
        throw new AppError(
          `Entity extraction error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('Entity extraction service unavailable', 503);
    }
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<any> {
    try {
      const response = await this.aiClient.get(`/api/scribe/session/${sessionId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get session:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundError('Session not found');
        }
        throw new AppError(
          `Session error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('Failed to get session', 500);
    }
  }

  /**
   * Save generated note to patient record
   *
   * If a consultationId is provided, updates the existing consultation.
   * Otherwise, creates a new consultation if appointmentId is provided.
   * Also creates prescriptions if provided.
   */
  async saveNote(data: SaveNotesRequest): Promise<{
    success: boolean;
    noteId: string;
    savedAt: string;
    message: string;
  }> {
    try {
      logger.info('Saving scribe note', {
        sessionId: data.sessionId,
        patientId: data.patientId,
      });

      // Verify patient exists
      const patient = await prisma.patient.findFirst({
        where: {
          id: data.patientId,
          hospitalId: data.hospitalId,
        },
      });

      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      let noteId = '';

      // If we have a consultation ID, update the existing consultation
      if (data.consultationId) {
        const consultation = await prisma.consultation.update({
          where: { id: data.consultationId },
          data: {
            chiefComplaint: data.soapNote.subjective.substring(0, 500),
            historyOfIllness: data.soapNote.subjective,
            examination: data.soapNote.objective,
            diagnosis: [data.soapNote.assessment],
            icdCodes: data.icdCodes || [],
            treatmentPlan: data.soapNote.plan,
            notes: `AI Scribe Session: ${data.sessionId}\n\nSOAP Note:\n\nSubjective:\n${data.soapNote.subjective}\n\nObjective:\n${data.soapNote.objective}\n\nAssessment:\n${data.soapNote.assessment}\n\nPlan:\n${data.soapNote.plan}`,
            followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
          },
        });
        noteId = consultation.id;
      }
      // Otherwise, if we have an appointment ID, create a new consultation
      else if (data.appointmentId) {
        // Verify the appointment exists and belongs to the patient
        const appointment = await prisma.appointment.findFirst({
          where: {
            id: data.appointmentId,
            patientId: data.patientId,
          },
        });

        if (!appointment) {
          throw new NotFoundError('Appointment not found');
        }

        // Check if a consultation already exists for this appointment
        const existingConsultation = await prisma.consultation.findUnique({
          where: { appointmentId: data.appointmentId },
        });

        if (existingConsultation) {
          // Update existing consultation
          const consultation = await prisma.consultation.update({
            where: { id: existingConsultation.id },
            data: {
              chiefComplaint: data.soapNote.subjective.substring(0, 500),
              historyOfIllness: data.soapNote.subjective,
              examination: data.soapNote.objective,
              diagnosis: [data.soapNote.assessment],
              icdCodes: data.icdCodes || [],
              treatmentPlan: data.soapNote.plan,
              notes: `AI Scribe Session: ${data.sessionId}\n\nSOAP Note:\n\nSubjective:\n${data.soapNote.subjective}\n\nObjective:\n${data.soapNote.objective}\n\nAssessment:\n${data.soapNote.assessment}\n\nPlan:\n${data.soapNote.plan}`,
              followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
            },
          });
          noteId = consultation.id;
        } else {
          // Create new consultation
          const consultation = await prisma.consultation.create({
            data: {
              appointmentId: data.appointmentId,
              patientId: data.patientId,
              doctorId: data.doctorId,
              chiefComplaint: data.soapNote.subjective.substring(0, 500),
              historyOfIllness: data.soapNote.subjective,
              examination: data.soapNote.objective,
              diagnosis: [data.soapNote.assessment],
              icdCodes: data.icdCodes || [],
              treatmentPlan: data.soapNote.plan,
              notes: `AI Scribe Session: ${data.sessionId}\n\nSOAP Note:\n\nSubjective:\n${data.soapNote.subjective}\n\nObjective:\n${data.soapNote.objective}\n\nAssessment:\n${data.soapNote.assessment}\n\nPlan:\n${data.soapNote.plan}`,
              followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
            },
          });
          noteId = consultation.id;
        }
      } else {
        // No consultation or appointment - just log the note (placeholder for future implementation)
        noteId = data.sessionId;
        logger.info('Note saved (no consultation created - missing appointmentId)', {
          sessionId: data.sessionId,
          patientId: data.patientId,
        });
      }

      // Create prescriptions if provided and we have a consultation
      if (data.prescriptions && data.prescriptions.length > 0 && noteId !== data.sessionId) {
        const prescription = await prisma.prescription.create({
          data: {
            patientId: data.patientId,
            prescribedById: data.doctorId,
            consultationId: noteId,
            notes: `AI Scribe generated prescription - Session: ${data.sessionId}`,
            status: 'PENDING',
          },
        });

        for (const rx of data.prescriptions) {
          await prisma.prescriptionMedication.create({
            data: {
              prescriptionId: prescription.id,
              drugName: rx.medication,
              dosage: rx.dosage,
              frequency: rx.frequency,
              duration: rx.duration,
              route: rx.route,
              instructions: rx.instructions || '',
              quantity: 1,
            },
          });
        }
      }

      // Log follow-up recommendation if provided
      if (data.followUpDate) {
        logger.info('Follow-up scheduled', {
          patientId: data.patientId,
          followUpDate: data.followUpDate,
        });
      }

      return {
        success: true,
        noteId: noteId,
        savedAt: new Date().toISOString(),
        message: noteId === data.sessionId
          ? 'Note logged (create appointment to save to patient record)'
          : 'Note saved successfully to patient consultation',
      };
    } catch (error) {
      logger.error('Failed to save note:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new AppError('Failed to save note', 500);
    }
  }

  /**
   * Get available templates
   */
  async getTemplates(): Promise<{
    templates: ScribeTemplate[];
    modelVersion: string;
  }> {
    try {
      const response = await this.aiClient.get('/api/scribe/templates');
      return response.data;
    } catch (error) {
      logger.error('Failed to get templates:', error);
      // Return default templates if service is unavailable
      return {
        templates: this.getDefaultTemplates(),
        modelVersion: 'fallback-v1.0',
      };
    }
  }

  /**
   * Transcribe and generate clinical notes in a single operation
   */
  async transcribeAndGenerate(
    sessionId: string,
    audioData: Buffer,
    options: {
      noteType?: string;
      language?: string;
      generateSoapNote?: boolean;
      extractEntities?: boolean;
      suggestIcdCodes?: boolean;
      suggestCptCodes?: boolean;
      generateFollowUp?: boolean;
      generatePrescriptions?: boolean;
    } = {}
  ): Promise<ProcessingResult> {
    try {
      logger.info('Transcribe and generate clinical notes', {
        sessionId,
        noteType: options.noteType || 'consultation',
      });

      // FormData already imported at top level
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('generateSoapNote', (options.generateSoapNote !== false).toString());
      formData.append('extractEntities', (options.extractEntities !== false).toString());
      formData.append('suggestIcdCodes', (options.suggestIcdCodes !== false).toString());
      formData.append('suggestCptCodes', (options.suggestCptCodes !== false).toString());
      formData.append('generateFollowUp', (options.generateFollowUp !== false).toString());
      formData.append('generatePrescriptions', (options.generatePrescriptions !== false).toString());
      formData.append('audio', audioData, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });

      const response = await this.aiClient.post<ProcessingResult>(
        '/api/scribe/process',
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 180000, // 3 minutes for full processing
        }
      );

      logger.info('Transcribe and generate completed', {
        sessionId,
        noteType: options.noteType || 'consultation',
        hasSOAP: !!response.data.generatedNote,
        transcriptLength: response.data.fullTranscript?.length || 0,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to transcribe and generate:', error);
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new AppError('AI Scribe service is not reachable', 503);
        }
        throw new AppError(
          `Transcription error: ${error.response?.data?.detail || error.message}`,
          error.response?.status || 500
        );
      }
      throw new AppError('Failed to transcribe and generate notes', 500);
    }
  }

  // ============= Private Helper Methods =============

  private getAudioContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const contentTypes: Record<string, string> = {
      webm: 'audio/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
    };
    return contentTypes[ext || 'webm'] || 'audio/webm';
  }

  private getDefaultTemplates(): ScribeTemplate[] {
    return [
      {
        id: 'general-consultation',
        name: 'General Consultation',
        description: 'Standard outpatient consultation template',
        noteType: 'consultation',
        sections: ['Chief Complaint', 'HPI', 'Past Medical History', 'Medications', 'Allergies', 'ROS', 'Physical Exam', 'Assessment', 'Plan'],
        prompts: {
          chief_complaint: 'What brings you in today?',
          duration: 'How long have you had this problem?',
          severity: 'On a scale of 1-10, how severe is it?',
          medications: 'What medications are you currently taking?',
          allergies: 'Do you have any allergies?',
        },
        requiredFields: ['chiefComplaint', 'hpi', 'assessment', 'plan'],
      },
      {
        id: 'follow-up',
        name: 'Follow-up Visit',
        description: 'Template for follow-up appointments with established patients',
        noteType: 'follow_up',
        sections: ['Interval History', 'Current Symptoms', 'Medication Review', 'Vitals', 'Physical Exam', 'Assessment', 'Plan'],
        prompts: {
          improvement: 'How have you been since last visit?',
          medication: 'Are you taking your medications as prescribed?',
          side_effects: 'Are you experiencing any side effects?',
          new_symptoms: 'Any new symptoms or concerns?',
        },
        requiredFields: ['intervalHistory', 'medicationReview', 'assessment', 'plan'],
      },
      {
        id: 'emergency',
        name: 'Emergency Encounter',
        description: 'Template for emergency department visits',
        noteType: 'consultation',
        sections: ['Chief Complaint', 'Triage', 'HPI', 'Physical Exam', 'Diagnostic Workup', 'MDM', 'Disposition'],
        prompts: {
          onset: 'When did this start?',
          mechanism: 'What happened?',
          severity: 'How bad is the pain?',
          prior_treatment: 'Have you tried anything for this?',
        },
        requiredFields: ['chiefComplaint', 'triage', 'mdm', 'disposition'],
      },
      {
        id: 'procedure',
        name: 'Procedure Note',
        description: 'Template for procedure documentation',
        noteType: 'procedure',
        sections: ['Indication', 'Consent', 'Anesthesia', 'Procedure Details', 'Findings', 'Specimens', 'Complications', 'Disposition'],
        prompts: {
          indication: 'Reason for procedure',
          technique: 'Describe the technique used',
          findings: 'What were the findings?',
          complications: 'Were there any complications?',
        },
        requiredFields: ['indication', 'consent', 'procedureDetails', 'findings'],
      },
      {
        id: 'discharge',
        name: 'Discharge Summary',
        description: 'Template for hospital discharge documentation',
        noteType: 'discharge',
        sections: ['Admission Diagnosis', 'Hospital Course', 'Procedures Performed', 'Discharge Diagnosis', 'Discharge Medications', 'Follow-up Instructions', 'Activity Restrictions'],
        prompts: {
          course: 'Summarize the hospital course',
          medications: 'List discharge medications with instructions',
          follow_up: 'When and with whom should patient follow up?',
          precautions: 'What warning signs should prompt return?',
        },
        requiredFields: ['admissionDiagnosis', 'hospitalCourse', 'dischargeDiagnosis', 'dischargeMedications', 'followUpInstructions'],
      },
      {
        id: 'telehealth',
        name: 'Telehealth Visit',
        description: 'Template for telemedicine consultations',
        noteType: 'consultation',
        sections: ['Chief Complaint', 'HPI', 'Visible Examination', 'Assessment', 'Plan', 'Technology Notes'],
        prompts: {
          chief_complaint: 'What brings you in today?',
          visual_exam: 'What can you observe on video?',
          limitations: 'Any limitations to the virtual exam?',
        },
        requiredFields: ['chiefComplaint', 'hpi', 'assessment', 'plan'],
      },
    ];
  }
}

export const aiScribeService = new AIScribeService();
