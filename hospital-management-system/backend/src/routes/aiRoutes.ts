import { Router, Request, Response } from 'express';
import { aiService } from '../services/aiService';
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

// ============= Health Check =============

// Check AI service health (no auth required)
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await aiService.checkHealth();
    sendSuccess(res, health, 'AI service health check');
  })
);

// ============= Direct Test Endpoints (No Database Required) =============

// Direct diagnosis test - bypasses patient lookup
router.post(
  '/test/diagnose',
  validate(aiDirectDiagnoseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.directDiagnose(req.body);
    sendSuccess(res, result, 'Direct diagnosis analysis complete');
  })
);

// Direct risk prediction test
router.post(
  '/test/predict-risk',
  validate(aiDirectPredictRiskSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.directPredictRisk(req.body);
    sendSuccess(res, result, 'Direct risk prediction complete');
  })
);

// Direct image analysis test
router.post(
  '/test/analyze-image',
  validate(aiDirectAnalyzeImageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await aiService.directAnalyzeImage(req.body);
    sendSuccess(res, result, 'Direct image analysis complete');
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

// Analyze medical image (requires imaging order in database)
router.post(
  '/analyze-image',
  authenticate,
  authorize('DOCTOR', 'RADIOLOGIST'),
  validate(aiAnalyzeImageSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await aiService.analyzeImage(req.body);
    sendSuccess(res, result, 'Image analysis complete');
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

// AI Chat endpoint (no auth required for testing)
router.post(
  '/chat',
  asyncHandler(async (req: Request, res: Response) => {
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

// Voice command endpoint (no auth required for testing)
router.post(
  '/voice-command',
  asyncHandler(async (req: Request, res: Response) => {
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
