import { Router, Request, Response } from 'express';
import multer from 'multer';
import { aiService } from '../services/aiService';
import { aiScribeService } from '../services/aiScribeService';
import { storageService } from '../services/storageService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import {
  validate,
  aiDiagnoseSchema,
  aiPredictRiskSchema,
  aiAnalyzeImageSchema,
  aiDirectDiagnoseSchema,
  aiDirectPredictRiskSchema,
  aiDirectAnalyzeImageSchema,
} from '../middleware/validation';

const router = Router();

// Configure multer for image upload
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept image files and DICOM
    const allowedMimes = ['image/jpeg', 'image/png', 'image/dicom', 'application/dicom'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.dcm')) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and DICOM files are allowed'));
    }
  },
});

// Configure multer for audio upload (for public transcription)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max for audio
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/m4a'];
    if (allowedMimes.includes(file.mimetype) ||
        file.originalname.match(/\.(webm|wav|mp3|ogg|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (webm, wav, mp3, ogg, m4a) are allowed'));
    }
  },
});

// ============= Health Check =============

// Check AI service health (no auth required)
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await aiService.checkHealth();
    sendSuccess(res, health, 'AI service health check');
  })
);

// ============= Public Transcription (for Symptom Checker Voice) =============

// Check transcription service status (public)
router.get(
  '/transcribe/status',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const health = await aiService.checkHealth();
      const isAvailable = health.status === 'healthy' || health.status === 'connected';
      sendSuccess(res, {
        available: isAvailable,
        service: 'whisper',
        status: isAvailable ? 'ready' : 'unavailable',
      }, 'Transcription service status');
    } catch (error) {
      sendSuccess(res, {
        available: false,
        service: 'whisper',
        status: 'unavailable',
      }, 'Transcription service unavailable');
    }
  })
);

// Public transcribe endpoint (for symptom checker voice input)
router.post(
  '/transcribe',
  audioUpload.single('audio'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required',
      });
    }

    try {
      const result = await aiScribeService.transcribeAudio(
        req.file.buffer,
        req.file.originalname || 'audio.webm'
      );

      sendSuccess(res, {
        transcript: result.transcript,
        confidence: 0.95,
        duration: result.duration,
      }, 'Audio transcribed successfully');
    } catch (error: any) {
      console.error('Transcription error:', error);
      // Check if it's an AI service unavailability issue
      if (error.message?.includes('unavailable') || error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          error: 'Voice transcription service is unavailable. Please ensure the AI service is running and OPENAI_API_KEY is configured.',
        });
      }
      throw error;
    }
  })
);

// ============= Production Endpoints (Authenticated, Database-Backed) =============

// Analyze symptoms for diagnosis (supports both database-backed and direct diagnosis)
router.post(
  '/diagnose',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, symptoms, patientAge, gender, medicalHistory, currentMedications, allergies, vitalSigns } = req.body;

    // Validate symptoms are provided
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one symptom is required' });
    }

    // Check if patientId is a valid UUID (for database-backed diagnosis)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const hasValidPatientId = patientId && uuidRegex.test(patientId);

    // If valid patientId is provided, use database-backed diagnosis
    if (hasValidPatientId) {
      const result = await aiService.analyzeSymptomsForDiagnosis({
        patientId,
        symptoms,
        medicalHistory,
        currentMedications,
        vitalSigns,
      });
      return sendSuccess(res, result, 'Diagnosis analysis complete');
    }

    // If patientAge and gender are provided, use direct diagnosis (no database lookup)
    if (patientAge !== undefined && gender) {
      const result = await aiService.directDiagnose({
        symptoms,
        patientAge: Number(patientAge),
        gender,
        medicalHistory: medicalHistory || [],
        currentMedications: currentMedications || [],
        allergies: allergies || [],
        vitalSigns: vitalSigns || undefined,
        hospitalId: req.user?.hospitalId,
      });
      return sendSuccess(res, result, 'Diagnosis analysis complete');
    }

    // Neither valid patientId nor patientAge/gender provided
    return res.status(400).json({
      success: false,
      message: 'Either a valid patientId (UUID) or patientAge and gender are required',
    });
  })
);

// Predict patient risk (supports both database-backed and direct prediction)
router.post(
  '/predict-risk',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, predictionType, timeframe, patientData } = req.body;

    // Validate predictionType is provided
    if (!predictionType) {
      return res.status(400).json({ error: 'Prediction type is required' });
    }

    // Check if patientId is a valid UUID (for database-backed prediction)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const hasValidPatientId = patientId && uuidRegex.test(patientId);

    // If valid patientId is provided, use database-backed prediction
    if (hasValidPatientId) {
      const result = await aiService.predictRisk({
        patientId,
        predictionType: predictionType.toUpperCase(),
        timeframe,
      });
      return sendSuccess(res, result, 'Risk prediction complete');
    }

    // If patientData is provided, use direct prediction (no database lookup)
    if (patientData) {
      const result = await aiService.directPredictRisk({
        predictionType: predictionType.toLowerCase(),
        timeframe: timeframe || '30 days',
        patientData,
      });
      return sendSuccess(res, result, 'Risk prediction complete');
    }

    // Neither valid patientId nor patientData provided
    return res.status(400).json({ error: 'Either a valid patientId (UUID) or patientData is required' });
  })
);

// Analyze medical image (supports both file upload and URL)
router.post(
  '/analyze-image',
  authenticate,
  authorize('DOCTOR', 'RADIOLOGIST', 'NURSE', 'HOSPITAL_ADMIN'),
  imageUpload.single('image'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { modalityType, bodyPart, patientAge, patientGender, clinicalHistory, imageUrl, imagingOrderId } = req.body;

    // Validate required fields
    if (!modalityType || !bodyPart) {
      return res.status(400).json({ error: 'Modality type and body part are required' });
    }

    let finalImageUrl = imageUrl;
    let uploadedToS3 = false;
    let s3Key: string | null = null;

    // If file was uploaded, try to upload to S3 first
    if (req.file) {
      // Check if S3/MinIO is configured
      if (storageService.isStorageConfigured()) {
        try {
          const uploadResult = await storageService.uploadMedicalImage(req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
            modality: modalityType,
            bodyPart: bodyPart,
          });
          finalImageUrl = uploadResult.url;
          s3Key = uploadResult.key;
          uploadedToS3 = true;
          console.log(`Image uploaded to S3: ${uploadResult.url}`);
        } catch (s3Error: any) {
          console.warn('S3 upload failed, falling back to base64:', s3Error.message);
          // Fall back to base64 if S3 upload fails
          const base64 = req.file.buffer.toString('base64');
          const mimeType = req.file.mimetype || 'image/jpeg';
          finalImageUrl = `data:${mimeType};base64,${base64}`;
        }
      } else {
        // No S3 configured, use base64
        const base64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype || 'image/jpeg';
        finalImageUrl = `data:${mimeType};base64,${base64}`;
      }
    }

    if (!finalImageUrl) {
      return res.status(400).json({ error: 'Please provide an image file or URL' });
    }

    // If imagingOrderId is provided, use the database-backed method
    if (imagingOrderId) {
      const result = await aiService.analyzeImage({
        imagingOrderId,
        imageUrl: finalImageUrl,
        modalityType,
        bodyPart,
      });
      return sendSuccess(res, { ...result, uploadedToS3, s3Key }, 'Image analysis complete');
    }

    // Use direct analysis method (no database record)
    const result = await aiService.directAnalyzeImage({
      imageUrl: finalImageUrl,
      modalityType,
      bodyPart,
      patientAge: parseInt(patientAge) || 45,
      patientGender: patientGender || 'male',
      clinicalHistory: clinicalHistory || undefined,
    });
    sendSuccess(res, { ...result, uploadedToS3, s3Key, imageUrl: finalImageUrl }, 'Image analysis complete');
  })
);

// Get patient AI insights (historical AI analyses)
router.get(
  '/insights/:patientId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const insights = await aiService.getPatientAIInsights(req.params.patientId);
    sendSuccess(res, insights);
  })
);

// ============= Chat and Voice Command Endpoints =============

// AI Chat endpoint
router.post(
  '/chat',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await aiService.processChat({
      message,
      context,
    });

    sendSuccess(res, result, 'Chat processed');
  })
);

// Voice command endpoint
router.post(
  '/voice-command',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { transcript, context } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const result = await aiService.processVoiceCommand({
      transcript,
      context,
    });

    sendSuccess(res, result, 'Voice command processed');
  })
);

// Provide feedback on AI prediction
router.post(
  '/feedback/:type/:id',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type, id } = req.params;
    const result = await aiService.provideFeedback(
      type as 'diagnosis' | 'prediction' | 'image',
      id,
      req.body
    );
    sendSuccess(res, result, 'Feedback recorded');
  })
);

// ============= Symptom Checker Endpoints =============

// Start a new symptom checker session (public - for patients)
router.post(
  '/symptom-checker/start',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.startSymptomCheckerSession(req.body);
    sendSuccess(res, result, 'Symptom checker session started');
  })
);

// Submit responses to symptom checker
router.post(
  '/symptom-checker/respond',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.respondToSymptomChecker(req.body);
    sendSuccess(res, result, 'Response recorded');
  })
);

// Complete symptom checker assessment
router.post(
  '/symptom-checker/complete',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.completeSymptomChecker(req.body);
    sendSuccess(res, result, 'Assessment complete');
  })
);

// Get symptom checker session
router.get(
  '/symptom-checker/session/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.getSymptomCheckerSession(req.params.sessionId);
    sendSuccess(res, result);
  })
);

// Quick symptom check
router.post(
  '/symptom-checker/quick-check',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.quickSymptomCheck(req.body);
    sendSuccess(res, result, 'Quick check complete');
  })
);

// Get available departments
router.get(
  '/symptom-checker/departments',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.getSymptomCheckerDepartments();
    sendSuccess(res, result);
  })
);

// ============= Entity Extraction Endpoints (AI-powered creation) =============

// Parse creation intent from text/voice
router.post(
  '/entity/parse-intent',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await aiService.parseCreationIntent({ text, context });
    sendSuccess(res, result, 'Creation intent parsed');
  })
);

// Extract patient data from natural language
router.post(
  '/entity/extract-patient',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await aiService.extractPatientData({ text, context });
    sendSuccess(res, result, 'Patient data extracted');
  })
);

// Extract doctor data from natural language
router.post(
  '/entity/extract-doctor',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await aiService.extractDoctorData({ text, context });
    sendSuccess(res, result, 'Doctor data extracted');
  })
);

// Extract appointment data from natural language
router.post(
  '/entity/extract-appointment',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await aiService.extractAppointmentData({ text, context });
    sendSuccess(res, result, 'Appointment data extracted');
  })
);

// ============= Clinical Notes Endpoints =============

// Get clinical note templates
router.get(
  '/clinical-notes/templates',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await aiService.getClinicalNoteTemplates();
    sendSuccess(res, result, 'Templates retrieved');
  })
);

// Generate clinical note from template
router.post(
  '/clinical-notes/generate',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { templateType, patientData, encounterData } = req.body;

    if (!templateType) {
      return res.status(400).json({ error: 'Template type is required' });
    }

    const result = await aiService.generateClinicalNote({
      templateType,
      patientData,
      encounterData,
    });
    sendSuccess(res, result, 'Clinical note generated');
  })
);

// Enhance clinical note with AI
router.post(
  '/clinical-notes/enhance',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { noteText, enhancementType } = req.body;

    if (!noteText) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    const result = await aiService.enhanceClinicalNote({
      noteText,
      enhancementType: enhancementType || 'improve',
    });
    sendSuccess(res, result, 'Clinical note enhanced');
  })
);

// ============= Pharmacy/Drug Interaction Endpoints =============

// Check drug interactions
router.post(
  '/pharmacy/check-interactions',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { medications, patientAge, patientConditions, allergies } = req.body;

    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({ error: 'At least one medication is required' });
    }

    const result = await aiService.checkDrugInteractions({
      medications,
      patientAge,
      patientConditions,
      allergies,
    });
    sendSuccess(res, result, 'Drug interactions checked');
  })
);

export default router;
