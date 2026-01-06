/**
 * AI Scribe Routes
 * Routes for AI-powered medical transcription and note generation
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { aiScribeService } from '../services/aiScribeService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Configure multer for audio upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size for longer recordings
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

// ============= Health Check =============

/**
 * Check AI Scribe service health
 * GET /api/v1/ai-scribe/health
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await aiScribeService.checkHealth();
    sendSuccess(res, health, 'AI Scribe service health check');
  })
);

// ============= Session Management =============

/**
 * Start a new scribe session
 * POST /api/v1/ai-scribe/start-session
 */
router.post(
  '/start-session',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      patientId,
      patientName,
      patientAge,
      patientGender,
      appointmentId,
      sessionType,
      existingConditions,
      currentMedications,
      knownAllergies,
    } = req.body;

    const result = await aiScribeService.startSession({
      patientId,
      patientName,
      patientAge,
      patientGender,
      doctorId: req.user?.userId,
      appointmentId,
      sessionType: sessionType || 'consultation',
      existingConditions,
      currentMedications,
      knownAllergies,
    });

    sendSuccess(res, result, 'Scribe session started');
  })
);

/**
 * Get session details
 * GET /api/v1/ai-scribe/session/:id
 */
router.get(
  '/session/:id',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const session = await aiScribeService.getSession(id);
    sendSuccess(res, session);
  })
);

// ============= Audio Transcription =============

/**
 * Transcribe audio file
 * POST /api/v1/ai-scribe/transcribe
 */
router.post(
  '/transcribe',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  upload.single('audio'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
      });
    }

    const { sessionId } = req.body;

    const result = await aiScribeService.transcribeAudio(
      req.file.buffer,
      req.file.originalname || 'audio.webm',
      sessionId
    );

    sendSuccess(res, result, 'Audio transcribed successfully');
  })
);

/**
 * Upload audio chunk for streaming transcription
 * POST /api/v1/ai-scribe/upload-audio
 */
router.post(
  '/upload-audio',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  upload.single('audio'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { sessionId, chunkNumber, isFinal } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const result = await aiScribeService.uploadAudioChunk(
      sessionId,
      req.file.buffer,
      parseInt(chunkNumber) || 0,
      isFinal === 'true' || isFinal === true
    );

    sendSuccess(res, result, 'Audio chunk uploaded');
  })
);

// ============= Note Generation =============

/**
 * Generate clinical note from text input
 * POST /api/v1/ai-scribe/generate-note
 */
router.post(
  '/generate-note',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { text, noteType, patientInfo, extractEntities, suggestCodes } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Text input is required',
      });
    }

    const result = await aiScribeService.generateNoteFromText({
      text,
      noteType: noteType || 'consultation',
      patientInfo,
      extractEntities: extractEntities !== false,
      suggestCodes: suggestCodes !== false,
    });

    sendSuccess(res, result, 'Note generated successfully');
  })
);

/**
 * Process recording and generate documentation
 * POST /api/v1/ai-scribe/process
 */
router.post(
  '/process',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  upload.single('audio'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      sessionId,
      generateSoapNote,
      extractEntities,
      suggestIcdCodes,
      suggestCptCodes,
      generateFollowUp,
      generatePrescriptions,
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required',
      });
    }

    const result = await aiScribeService.processRecording(
      sessionId,
      req.file?.buffer,
      {
        generateSoapNote: generateSoapNote !== 'false' && generateSoapNote !== false,
        extractEntities: extractEntities !== 'false' && extractEntities !== false,
        suggestIcdCodes: suggestIcdCodes !== 'false' && suggestIcdCodes !== false,
        suggestCptCodes: suggestCptCodes !== 'false' && suggestCptCodes !== false,
        generateFollowUp: generateFollowUp !== 'false' && generateFollowUp !== false,
        generatePrescriptions: generatePrescriptions !== 'false' && generatePrescriptions !== false,
      }
    );

    sendSuccess(res, result, 'Recording processed successfully');
  })
);

// ============= Entity Extraction =============

/**
 * Extract clinical entities from text
 * POST /api/v1/ai-scribe/extract-entities
 */
router.post(
  '/extract-entities',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { text, includeVitals, includeMedications, includeSymptoms, includeDiagnoses } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Text input is required',
      });
    }

    const result = await aiScribeService.extractEntities({
      text,
      includeVitals: includeVitals !== false,
      includeMedications: includeMedications !== false,
      includeSymptoms: includeSymptoms !== false,
      includeDiagnoses: includeDiagnoses !== false,
    });

    sendSuccess(res, result, 'Entities extracted successfully');
  })
);

// ============= Notes Management =============

/**
 * Save generated note to patient record
 * POST /api/v1/ai-scribe/save-note
 */
router.post(
  '/save-note',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      sessionId,
      patientId,
      soapNote,
      icdCodes,
      cptCodes,
      entities,
      prescriptions,
      followUpDate,
      consultationId,
      appointmentId,
      notes,
    } = req.body;

    if (!sessionId || !patientId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and Patient ID are required',
      });
    }

    if (!soapNote || !soapNote.subjective || !soapNote.assessment) {
      return res.status(400).json({
        success: false,
        error: 'Valid SOAP note with at least subjective and assessment is required',
      });
    }

    const result = await aiScribeService.saveNote({
      sessionId,
      patientId,
      hospitalId: req.user?.hospitalId || '',
      doctorId: req.user?.userId || '',
      soapNote,
      icdCodes,
      cptCodes,
      entities,
      prescriptions,
      followUpDate,
      consultationId,
      appointmentId,
      notes,
    });

    sendSuccess(res, result, 'Note saved successfully');
  })
);

// ============= Templates =============

/**
 * Get available scribe templates
 * GET /api/v1/ai-scribe/templates
 */
router.get(
  '/templates',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templates = await aiScribeService.getTemplates();
    sendSuccess(res, templates);
  })
);

// ============= Unified Transcribe and Generate Endpoint =============

/**
 * Transcribe audio and generate clinical notes in a single request
 * POST /api/v1/ai-scribe/transcribe-and-generate
 *
 * This unified endpoint handles:
 * - Audio transcription with speaker diarization
 * - SOAP note generation (Consultation, Follow-up, Procedure, Discharge)
 * - Entity extraction (symptoms, diagnoses, medications, vitals, allergies)
 * - ICD-10 and CPT code suggestions
 * - Follow-up recommendations
 * - Prescription suggestions
 */
router.post(
  '/transcribe-and-generate',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  upload.single('audio'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      patientId,
      patientName,
      patientAge,
      patientGender,
      appointmentId,
      noteType = 'consultation',
      language = 'en',
      existingConditions,
      currentMedications,
      knownAllergies,
      generateSoapNote = 'true',
      extractEntities = 'true',
      suggestIcdCodes = 'true',
      suggestCptCodes = 'true',
      generateFollowUp = 'true',
      generatePrescriptions = 'true',
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
      });
    }

    // Validate note type
    const validNoteTypes = ['consultation', 'follow_up', 'procedure', 'discharge'];
    const selectedNoteType = validNoteTypes.includes(noteType) ? noteType : 'consultation';

    // Start session with patient context
    const session = await aiScribeService.startSession({
      patientId,
      patientName,
      patientAge: patientAge ? parseInt(patientAge) : undefined,
      patientGender,
      doctorId: req.user?.userId,
      appointmentId,
      sessionType: selectedNoteType,
      existingConditions: existingConditions ? JSON.parse(existingConditions) : undefined,
      currentMedications: currentMedications ? JSON.parse(currentMedications) : undefined,
      knownAllergies: knownAllergies ? JSON.parse(knownAllergies) : undefined,
    });

    // Process recording with all options
    const result = await aiScribeService.transcribeAndGenerate(
      session.sessionId,
      req.file.buffer,
      {
        noteType: selectedNoteType,
        language,
        generateSoapNote: generateSoapNote !== 'false' && generateSoapNote !== false,
        extractEntities: extractEntities !== 'false' && extractEntities !== false,
        suggestIcdCodes: suggestIcdCodes !== 'false' && suggestIcdCodes !== false,
        suggestCptCodes: suggestCptCodes !== 'false' && suggestCptCodes !== false,
        generateFollowUp: generateFollowUp !== 'false' && generateFollowUp !== false,
        generatePrescriptions: generatePrescriptions !== 'false' && generatePrescriptions !== false,
      }
    );

    sendSuccess(res, {
      sessionId: session.sessionId,
      noteType: selectedNoteType,
      ...result,
    }, `${selectedNoteType.replace('_', ' ')} note generated successfully`);
  })
);

// ============= Clinical Notes Management =============

/**
 * Get clinical notes (with filters)
 * GET /api/v1/ai-scribe/notes
 */
router.get(
  '/notes',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, authorId, noteType, status, startDate, endDate, page, limit } = req.query;

    const result = await aiScribeService.getClinicalNotes(req.user?.hospitalId || '', {
      patientId: patientId as string,
      authorId: authorId as string,
      noteType: noteType as string,
      status: status as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });

    sendSuccess(res, result, 'Clinical notes retrieved');
  })
);

/**
 * Get clinical note by ID
 * GET /api/v1/ai-scribe/notes/:noteId
 */
router.get(
  '/notes/:noteId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { noteId } = req.params;
    const note = await aiScribeService.getClinicalNoteById(req.user?.hospitalId || '', noteId);
    sendSuccess(res, note, 'Clinical note retrieved');
  })
);

/**
 * Update clinical note (draft only)
 * PUT /api/v1/ai-scribe/notes/:noteId
 */
router.put(
  '/notes/:noteId',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { noteId } = req.params;
    const { subjective, objective, assessment, plan } = req.body;

    const note = await aiScribeService.updateClinicalNote(
      req.user?.hospitalId || '',
      noteId,
      req.user?.userId || '',
      { subjective, objective, assessment, plan }
    );

    sendSuccess(res, note, 'Clinical note updated');
  })
);

/**
 * Sign clinical note
 * POST /api/v1/ai-scribe/notes/:noteId/sign
 */
router.post(
  '/notes/:noteId/sign',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { noteId } = req.params;

    const note = await aiScribeService.signClinicalNote(
      req.user?.hospitalId || '',
      noteId,
      req.user?.userId || ''
    );

    sendSuccess(res, note, 'Clinical note signed');
  })
);

/**
 * Save AI-generated note to database
 * POST /api/v1/ai-scribe/notes/save
 */
router.post(
  '/notes/save',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      sessionId,
      patientId,
      consultationId,
      appointmentId,
      noteType,
      content,
      extractedEntities,
      icdCodes,
      cptCodes,
      keyFindings,
      prescriptionSuggestions,
      modelVersion,
    } = req.body;

    if (!sessionId || !patientId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and Patient ID are required',
      });
    }

    if (!content || (!content.subjective && !content.assessment)) {
      return res.status(400).json({
        success: false,
        error: 'Note content with at least subjective or assessment is required',
      });
    }

    const result = await aiScribeService.saveGeneratedNote(
      req.user?.hospitalId || '',
      req.user?.userId || '',
      {
        sessionId,
        patientId,
        consultationId,
        appointmentId,
        noteType: noteType || 'consultation',
        content,
        extractedEntities,
        icdCodes,
        cptCodes,
        keyFindings,
        prescriptionSuggestions,
        modelVersion,
      }
    );

    sendSuccess(res, result, 'Clinical note saved to database');
  })
);

// ============= Session History =============

/**
 * Get scribe session history
 * GET /api/v1/ai-scribe/sessions
 */
router.get(
  '/sessions',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, status, page, limit } = req.query;

    const result = await aiScribeService.getDbSessionHistory(
      req.user?.hospitalId || '',
      req.user?.userId || '',
      {
        patientId: patientId as string,
        status: status as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
      }
    );

    sendSuccess(res, result, 'Session history retrieved');
  })
);

/**
 * Create and persist a new scribe session
 * POST /api/v1/ai-scribe/sessions
 */
router.post(
  '/sessions',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      patientId,
      patientName,
      patientAge,
      patientGender,
      appointmentId,
      sessionType,
      existingConditions,
      currentMedications,
      knownAllergies,
    } = req.body;

    // Create database session
    const dbSession = await aiScribeService.createDbSession(
      req.user?.hospitalId || '',
      req.user?.userId || '',
      {
        patientId,
        patientName,
        patientAge,
        patientGender,
        appointmentId,
        sessionType: sessionType || 'consultation',
        existingConditions,
        currentMedications,
        knownAllergies,
      }
    );

    // Also start the AI service session
    const aiSession = await aiScribeService.startSession({
      patientId,
      patientName,
      patientAge,
      patientGender,
      doctorId: req.user?.userId,
      appointmentId,
      sessionType: sessionType || 'consultation',
      existingConditions,
      currentMedications,
      knownAllergies,
    });

    sendSuccess(res, {
      dbSessionId: dbSession.id,
      aiSessionId: aiSession.sessionId,
      status: dbSession.status,
      createdAt: dbSession.startedAt,
    }, 'Scribe session created and persisted');
  })
);

/**
 * Get patient's clinical notes
 * GET /api/v1/ai-scribe/patients/:patientId/notes
 */
router.get(
  '/patients/:patientId/notes',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const { noteType, status, page, limit } = req.query;

    const result = await aiScribeService.getClinicalNotes(req.user?.hospitalId || '', {
      patientId,
      noteType: noteType as string,
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    sendSuccess(res, result, 'Patient clinical notes retrieved');
  })
);

export default router;
