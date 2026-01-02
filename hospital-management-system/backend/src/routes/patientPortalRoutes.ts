import { Router, Request, Response } from 'express';
import { symptomCheckerService } from '../services/symptomCheckerService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';
import { validate } from '../middleware/validation';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const startSessionSchema = z.object({
  body: z.object({
    patientId: z.string().uuid().optional(),
    patientAge: z.number().int().min(0).max(150).optional(),
    patientGender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  }),
});

const answerSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid('Invalid session ID'),
    answer: z.any(),
    questionId: z.string().min(1, 'Question ID is required'),
  }),
});

const completeSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid('Invalid session ID'),
  }),
});

// =============================================================================
// Symptom Checker Routes
// =============================================================================

/**
 * @route   GET /api/patient-portal/symptom-check/health
 * @desc    Check symptom checker service health
 * @access  Public
 */
router.get(
  '/symptom-check/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await symptomCheckerService.checkHealth();
    sendSuccess(res, health, 'Symptom Checker service health');
  })
);

/**
 * @route   GET /api/patient-portal/symptom-check/body-parts
 * @desc    Get body parts for the body diagram
 * @access  Public
 */
router.get(
  '/symptom-check/body-parts',
  asyncHandler(async (req: Request, res: Response) => {
    const bodyParts = await symptomCheckerService.getBodyParts();
    sendSuccess(res, bodyParts, 'Body parts retrieved');
  })
);

/**
 * @route   POST /api/patient-portal/symptom-check/start
 * @desc    Start a new symptom checking session
 * @access  Public (can be used by patients without login or authenticated users)
 */
router.post(
  '/symptom-check/start',
  validate(startSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { patientId, patientAge, patientGender } = req.body;

    const result = await symptomCheckerService.startSession({
      patientId,
      patientAge,
      patientGender,
    });

    sendSuccess(res, result, 'Symptom check session started');
  })
);

/**
 * @route   POST /api/patient-portal/symptom-check/answer
 * @desc    Submit an answer and get the next question
 * @access  Public
 */
router.post(
  '/symptom-check/answer',
  validate(answerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, answer, questionId } = req.body;

    const result = await symptomCheckerService.submitAnswer({
      sessionId,
      answer,
      questionId,
    });

    sendSuccess(res, result, 'Answer processed');
  })
);

/**
 * @route   POST /api/patient-portal/symptom-check/complete
 * @desc    Complete the assessment and get triage result
 * @access  Public
 */
router.post(
  '/symptom-check/complete',
  validate(completeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.body;

    const result = await symptomCheckerService.completeAssessment({
      sessionId,
    });

    sendSuccess(res, result, 'Assessment completed');
  })
);

/**
 * @route   GET /api/patient-portal/symptom-check/history
 * @desc    Get patient's symptom check history
 * @access  Authenticated (optional - returns all if no patientId)
 */
router.get(
  '/symptom-check/history',
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = req.query.patientId as string | undefined;

    const result = await symptomCheckerService.getHistory(patientId);

    sendSuccess(res, result, 'Symptom check history retrieved');
  })
);

/**
 * @route   GET /api/patient-portal/symptom-check/history/:patientId
 * @desc    Get symptom check history for a specific patient
 * @access  Authenticated
 */
router.get(
  '/symptom-check/history/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;

    const result = await symptomCheckerService.getHistory(patientId);

    sendSuccess(res, result, 'Patient symptom check history retrieved');
  })
);

export default router;
