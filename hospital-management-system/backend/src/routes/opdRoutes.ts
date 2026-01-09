import { Router, Response } from 'express';
import { opdService } from '../services/opdService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Get today's queue
router.get(
  '/queue',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { doctorId } = req.query;
    const queue = await opdService.getTodayQueue(req.user!.hospitalId, doctorId as string);
    sendSuccess(res, queue);
  })
);

// Check in patient
router.post(
  '/check-in/:appointmentId',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await opdService.checkInPatient(req.params.appointmentId, req.user!.hospitalId);
    sendSuccess(res, result, 'Patient checked in');
  })
);

// Call next patient
router.post(
  '/call-next',
  authenticate,
  authorize('DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get doctor ID from user's doctor profile
    const doctorId = req.body.doctorId || req.user!.userId;
    const result = await opdService.callNextPatient(doctorId, req.user!.hospitalId);
    if (result) {
      sendSuccess(res, result, 'Next patient called');
    } else {
      sendSuccess(res, null, 'No patients waiting');
    }
  })
);

// Get current token for doctor
router.get(
  '/current-token/:doctorId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await opdService.getCurrentToken(req.params.doctorId, req.user!.hospitalId);
    sendSuccess(res, result);
  })
);

// Get wait time for doctor
router.get(
  '/wait-time/:doctorId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await opdService.getWaitTime(req.params.doctorId, req.user!.hospitalId);
    sendSuccess(res, result);
  })
);

// Mark no-show
router.post(
  '/no-show/:appointmentId',
  authenticate,
  authorize('RECEPTIONIST', 'DOCTOR', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await opdService.markNoShow(req.params.appointmentId, req.user!.hospitalId);
    sendSuccess(res, result, 'Marked as no-show');
  })
);

// Reschedule appointment
router.post(
  '/reschedule/:appointmentId',
  authenticate,
  authorize('RECEPTIONIST', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { newDate, newStartTime, newEndTime } = req.body;
    const result = await opdService.rescheduleAppointment(
      req.params.appointmentId,
      req.user!.hospitalId,
      new Date(newDate),
      newStartTime,
      newEndTime
    );
    sendSuccess(res, result, 'Appointment rescheduled');
  })
);

// Get OPD stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await opdService.getOPDStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

// Get doctor queue display (for TV/waiting room)
router.get(
  '/display',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const display = await opdService.getDoctorQueueDisplay(req.user!.hospitalId);
    sendSuccess(res, display);
  })
);

// Record pre-consultation vitals for an appointment
router.post(
  '/appointments/:appointmentId/vitals',
  authenticate,
  authorize('NURSE', 'DOCTOR', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.params;
    const {
      temperature,
      bloodPressureSys,
      bloodPressureDia,
      heartRate,
      respiratoryRate,
      oxygenSaturation,
      weight,
      height,
      bloodSugar,
      painLevel,
      notes,
    } = req.body;

    const result = await opdService.recordVitals(
      appointmentId,
      req.user!.hospitalId,
      {
        temperature,
        bloodPressureSys,
        bloodPressureDia,
        heartRate,
        respiratoryRate,
        oxygenSaturation,
        weight,
        height,
        bloodSugar,
        painLevel,
        notes,
      },
      req.user!.userId
    );

    sendSuccess(res, result, 'Vitals recorded successfully');
  })
);

// Get vitals for an appointment
router.get(
  '/appointments/:appointmentId/vitals',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.params;
    const result = await opdService.getAppointmentVitals(appointmentId, req.user!.hospitalId);
    sendSuccess(res, result);
  })
);

// Get unified booking ticket with all clinical data
router.get(
  '/booking-ticket/:appointmentId',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'DOCTOR', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.params;
    const result = await opdService.getBookingTicket(appointmentId, req.user!.hospitalId);
    sendSuccess(res, result);
  })
);

// Get patient booking history for follow-up context
router.get(
  '/patient-history/:patientId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await opdService.getPatientBookingHistory(patientId, req.user!.hospitalId, limit);
    sendSuccess(res, result);
  })
);

export default router;
