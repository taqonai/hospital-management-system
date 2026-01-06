import { Router, Request, Response } from 'express';
import { patientPortalService } from '../services/patientPortalService';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';

const router = Router();

// Helper function to get patientId from userId
async function getPatientIdFromUser(userId: string, hospitalId: string): Promise<string> {
  // First try to find patient record linked to this user (via oderId)
  const linkedPatient = await prisma.patient.findFirst({
    where: { oderId: userId, hospitalId },
    select: { id: true },
  });

  if (linkedPatient) {
    return linkedPatient.id;
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

  // Default: return empty string (will trigger not found in service)
  return '';
}

// =============================================================================
// Patient Portal Dashboard Routes (Authenticated)
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
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const summary = await patientPortalService.getDashboardSummary(hospitalId, patientId);
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
      type: type as 'upcoming' | 'past' | 'all',
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
    const appointment = await patientPortalService.bookAppointment(hospitalId, patientId, {
      ...req.body,
      appointmentDate: new Date(req.body.appointmentDate),
    });
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
    await patientPortalService.cancelAppointment(hospitalId, patientId, req.params.id, req.body.reason);
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
    const { type, page, limit } = req.query;
    const records = await patientPortalService.getMedicalRecords(hospitalId, patientId, {
      type: type as string,
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
      status: (status as 'active' | 'expired' | 'all') || 'all',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, prescriptions, 'Prescriptions retrieved');
  })
);

/**
 * Request prescription refill (placeholder - returns success)
 * POST /api/v1/patient-portal/prescriptions/:id/refill
 */
router.post(
  '/prescriptions/:id/refill',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Simplified: Just return success - full implementation pending
    sendSuccess(res, { requested: true, prescriptionId: req.params.id }, 'Refill request submitted');
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
      status: (status as 'ready' | 'pending' | 'all') || 'all',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, labs, 'Lab results retrieved');
  })
);

/**
 * Get messages (placeholder - returns empty)
 * GET /api/v1/patient-portal/messages
 */
router.get(
  '/messages',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Simplified: Return empty messages - messaging feature pending
    sendSuccess(res, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }, 'Messages retrieved');
  })
);

/**
 * Send message (placeholder - returns success)
 * POST /api/v1/patient-portal/messages
 */
router.post(
  '/messages',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Simplified: Just return success - messaging feature pending
    sendSuccess(res, { sent: true }, 'Message sent');
  })
);

/**
 * Get billing summary
 * GET /api/v1/patient-portal/billing/summary
 */
router.get(
  '/billing/summary',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const summary = await patientPortalService.getBillingSummary(hospitalId, patientId);
    sendSuccess(res, summary, 'Billing summary retrieved');
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
      type: (type === 'pending' || type === 'paid') ? type : 'all',
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
    const { departmentId, search } = req.query;
    const doctors = await patientPortalService.getDoctors(hospitalId, {
      departmentId: departmentId as string,
      search: search as string,
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

/**
 * Get health reminders
 * GET /api/v1/patient-portal/reminders
 */
router.get(
  '/reminders',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const hospitalId = req.user?.hospitalId || '';
    const patientId = await getPatientIdFromUser(req.user?.userId || '', hospitalId);
    const reminders = await patientPortalService.getHealthReminders(hospitalId, patientId);
    sendSuccess(res, reminders, 'Health reminders retrieved');
  })
);

export default router;
