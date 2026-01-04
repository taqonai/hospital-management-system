import { Router, Request, Response } from 'express';
import multer from 'multer';
import { aiService } from '../services/aiService';
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

// ============= Health Check =============

// Check AI service health (no auth required)
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await aiService.checkHealth();
    sendSuccess(res, health, 'AI service health check');
  })
);

// ============= Production Endpoints (Authenticated, Database-Backed) =============

// Analyze symptoms for diagnosis (requires patient in database)
router.post(
  '/diagnose',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  validate(aiDiagnoseSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await aiService.analyzeSymptomsForDiagnosis(req.body);
    sendSuccess(res, result, 'Diagnosis analysis complete');
  })
);

// Predict patient risk (requires patient in database)
router.post(
  '/predict-risk',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  validate(aiPredictRiskSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await aiService.predictRisk(req.body);
    sendSuccess(res, result, 'Risk prediction complete');
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

export default router;
