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

// ============= Test Endpoints (No Auth - Development Only) =============

/**
 * Test transcribe endpoint - no authentication required
 * POST /api/v1/ai-scribe/test/transcribe
 */
router.post(
  '/test/transcribe',
  upload.single('audio'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
      });
    }

    const result = await aiScribeService.transcribeAudio(
      req.file.buffer,
      req.file.originalname || 'audio.webm'
    );

    sendSuccess(res, result, 'Test transcription complete');
  })
);

/**
 * Test generate-note endpoint - no authentication required
 * POST /api/v1/ai-scribe/test/generate-note
 */
router.post(
  '/test/generate-note',
  asyncHandler(async (req: Request, res: Response) => {
    const { text, noteType, patientInfo } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text input is required',
      });
    }

    const result = await aiScribeService.generateNoteFromText({
      text,
      noteType: noteType || 'consultation',
      patientInfo,
      extractEntities: true,
      suggestCodes: true,
    });

    sendSuccess(res, result, 'Test note generation complete');
  })
);

/**
 * Test extract-entities endpoint - no authentication required
 * POST /api/v1/ai-scribe/test/extract-entities
 */
router.post(
  '/test/extract-entities',
  asyncHandler(async (req: Request, res: Response) => {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text input is required',
      });
    }

    const result = await aiScribeService.extractEntities({
      text,
      includeVitals: true,
      includeMedications: true,
      includeSymptoms: true,
      includeDiagnoses: true,
    });

    sendSuccess(res, result, 'Test entity extraction complete');
  })
);

/**
 * Test full process endpoint - no authentication required
 * POST /api/v1/ai-scribe/test/process
 */
router.post(
  '/test/process',
  upload.single('audio'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
      });
    }

    const { patientName, noteType } = req.body;

    // Start a temporary session
    const session = await aiScribeService.startSession({
      patientName: patientName || 'Test Patient',
      sessionType: noteType || 'consultation',
    });

    // Process the audio with all features
    const result = await aiScribeService.processRecording(
      session.sessionId,
      req.file.buffer,
      {
        generateSoapNote: true,
        extractEntities: true,
        suggestIcdCodes: true,
        suggestCptCodes: true,
        generateFollowUp: true,
        generatePrescriptions: true,
      }
    );

    sendSuccess(res, {
      sessionId: session.sessionId,
      ...result,
    }, 'Test processing complete');
  })
);

/**
 * Test transcribe-and-generate endpoint - no authentication required
 * POST /api/v1/ai-scribe/test/transcribe-and-generate
 */
router.post(
  '/test/transcribe-and-generate',
  upload.single('audio'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided',
      });
    }

    const { noteType = 'consultation', patientName } = req.body;

    // Start a temporary session
    const session = await aiScribeService.startSession({
      patientName: patientName || 'Test Patient',
      sessionType: noteType,
    });

    // Process with all features enabled
    const result = await aiScribeService.transcribeAndGenerate(
      session.sessionId,
      req.file.buffer,
      {
        noteType,
        generateSoapNote: true,
        extractEntities: true,
        suggestIcdCodes: true,
        suggestCptCodes: true,
        generateFollowUp: true,
        generatePrescriptions: true,
      }
    );

    sendSuccess(res, {
      sessionId: session.sessionId,
      noteType,
      ...result,
    }, 'Test transcribe-and-generate complete');
  })
);

export default router;
