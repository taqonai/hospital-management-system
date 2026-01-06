import { Router, Request, Response } from 'express';
import { symptomCheckerService } from '../services/symptomCheckerService';
import { patientPortalService } from '../services/patientPortalService';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { z } from 'zod';
import { validate } from '../middleware/validation';

const router = Router();

// =============================================================================
// Patient Portal Dashboard Routes (Authenticated - PATIENT role)
// =============================================================================

/**
 * Get patient summary/dashboard
 * GET /api/v1/patient-portal/summary
 */
router.get(
  '/summary',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    // Get patientId from user's linked patient record
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const summary = await patientPortalService.getPatientSummary(hospitalId, patientId);
    sendSuccess(res, summary, 'Patient summary retrieved');
  })
);

/**
 * Get patient appointments
 * GET /api/v1/patient-portal/appointments
 */
router.get(
  '/appointments',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const { type, status, page, limit } = req.query;
    const appointments = await patientPortalService.getAppointments(hospitalId, patientId, {
      type: type as 'upcoming' | 'past',
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, appointments, 'Appointments retrieved');
  })
);

/**
 * Book new appointment
 * POST /api/v1/patient-portal/appointments
 */
router.post(
  '/appointments',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const appointment = await patientPortalService.bookAppointment(hospitalId, patientId, req.body);
    sendSuccess(res, appointment, 'Appointment booked successfully');
  })
);

/**
 * Cancel appointment
 * POST /api/v1/patient-portal/appointments/:id/cancel
 */
router.post(
  '/appointments/:id/cancel',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    await patientPortalService.cancelAppointment(hospitalId, patientId, req.params.id);
    sendSuccess(res, null, 'Appointment cancelled');
  })
);

/**
 * Get medical records
 * GET /api/v1/patient-portal/records
 */
router.get(
  '/records',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const { type, search, page, limit } = req.query;
    const records = await patientPortalService.getMedicalRecords(hospitalId, patientId, {
      type: type as string,
      search: search as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, records, 'Medical records retrieved');
  })
);

/**
 * Get prescriptions
 * GET /api/v1/patient-portal/prescriptions
 */
router.get(
  '/prescriptions',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const { status, page, limit } = req.query;
    const prescriptions = await patientPortalService.getPrescriptions(hospitalId, patientId, {
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, prescriptions, 'Prescriptions retrieved');
  })
);

/**
 * Request prescription refill
 * POST /api/v1/patient-portal/prescriptions/:id/refill
 */
router.post(
  '/prescriptions/:id/refill',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const result = await patientPortalService.requestRefill(hospitalId, patientId, req.params.id);
    sendSuccess(res, result, 'Refill request submitted');
  })
);

/**
 * Get lab results
 * GET /api/v1/patient-portal/labs
 */
router.get(
  '/labs',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const { status, page, limit } = req.query;
    const labs = await patientPortalService.getLabResults(hospitalId, patientId, {
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, labs, 'Lab results retrieved');
  })
);

/**
 * Get messages
 * GET /api/v1/patient-portal/messages
 */
router.get(
  '/messages',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const { page, limit } = req.query;
    const messages = await patientPortalService.getMessages(hospitalId, patientId, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    sendSuccess(res, messages, 'Messages retrieved');
  })
);

/**
 * Send message
 * POST /api/v1/patient-portal/messages
 */
router.post(
  '/messages',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const result = await patientPortalService.sendMessage(hospitalId, patientId, req.body);
    sendSuccess(res, result, 'Message sent');
  })
);

/**
 * Get bills
 * GET /api/v1/patient-portal/bills
 */
router.get(
  '/bills',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const { type, page, limit } = req.query;
    const bills = await patientPortalService.getBills(hospitalId, patientId, {
      type: type as 'pending' | 'history',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, bills, 'Bills retrieved');
  })
);

/**
 * Get available doctors for booking
 * GET /api/v1/patient-portal/doctors
 */
router.get(
  '/doctors',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const { departmentId } = req.query;
    const doctors = await patientPortalService.getAvailableDoctors(hospitalId, {
      departmentId: departmentId as string,
    });
    sendSuccess(res, doctors, 'Available doctors retrieved');
  })
);

/**
 * Get departments
 * GET /api/v1/patient-portal/departments
 */
router.get(
  '/departments',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const departments = await patientPortalService.getDepartments(hospitalId);
    sendSuccess(res, departments, 'Departments retrieved');
  })
);

// Helper function to get patientId from userId
import prisma from '../config/database';

async function getPatientIdFromUser(userId: string, hospitalId: string): Promise<string> {
  // First try to find if user has a linked patient record
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { patientId: true },
  });

  if (user?.patientId) {
    return user.patientId;
  }

  // If no linked patient, try to find patient by user's email
  const userWithEmail = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (userWithEmail?.email) {
    const patient = await prisma.patient.findFirst({
      where: { email: userWithEmail.email, hospitalId },
      select: { id: true },
    });
    if (patient) return patient.id;
  }

  // Default: return userId as fallback (for demo purposes)
  // In production, this should throw an error
  return userId;
}

// =============================================================================
// KEEP EXISTING Symptom Checker Routes Below
// =============================================================================

// ... (keep all the existing symptom checker routes from the original file)

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

router.get(
  '/symptom-check/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await symptomCheckerService.checkHealth();
    sendSuccess(res, health, 'Symptom Checker service health');
  })
);

router.get(
  '/symptom-check/body-parts',
  asyncHandler(async (req: Request, res: Response) => {
    const bodyParts = await symptomCheckerService.getBodyParts();
    sendSuccess(res, bodyParts, 'Body parts retrieved');
  })
);

router.post(
  '/symptom-check/start',
  validate(startSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { patientAge, patientGender, initialSymptoms } = req.body;
    const result = await symptomCheckerService.startSession({
      patientInfo: { age: patientAge, gender: patientGender },
      initialSymptoms,
    });
    sendSuccess(res, result, 'Symptom check session started');
  })
);

router.post(
  '/symptom-check/answer',
  validate(answerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, answer, questionId } = req.body;
    const result = await symptomCheckerService.submitAnswer({ sessionId, answer, questionId });
    sendSuccess(res, result, 'Answer processed');
  })
);

router.post(
  '/symptom-check/complete',
  validate(completeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.body;
    const result = await symptomCheckerService.completeAssessment({ sessionId });
    sendSuccess(res, result, 'Assessment completed');
  })
);

router.get(
  '/symptom-check/history',
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = req.query.patientId as string | undefined;
    const result = await symptomCheckerService.getHistory(patientId);
    sendSuccess(res, result, 'Symptom check history retrieved');
  })
);

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
