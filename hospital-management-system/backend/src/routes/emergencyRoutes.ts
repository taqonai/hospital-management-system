import { Router, Response } from 'express';
import { emergencyService } from '../services/emergencyService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Register emergency patient
router.post(
  '/register',
  authenticate,
  authorizeWithPermission('emergency:write', ['DOCTOR', 'NURSE', 'RECEPTIONIST', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patient = await emergencyService.registerEmergencyPatient(req.user!.hospitalId, req.body);
    sendCreated(res, patient, 'Emergency patient registered');
  })
);

// Get all emergency patients
router.get(
  '/patients',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patients = await emergencyService.getEmergencyPatients(req.user!.hospitalId);
    sendSuccess(res, patients);
  })
);

// Update triage level
router.patch(
  '/:appointmentId/triage',
  authenticate,
  authorizeWithPermission('emergency:triage', ['DOCTOR', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { esiLevel, notes } = req.body;
    const result = await emergencyService.updateTriageLevel(req.params.appointmentId, esiLevel, notes);
    sendSuccess(res, result, 'Triage level updated');
  })
);

// Assign doctor
router.patch(
  '/:appointmentId/assign-doctor',
  authenticate,
  authorizeWithPermission('emergency:write', ['HOSPITAL_ADMIN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await emergencyService.assignDoctor(req.params.appointmentId, req.body.doctorId);
    sendSuccess(res, result, 'Doctor assigned');
  })
);

// Admit from emergency
router.post(
  '/:appointmentId/admit',
  authenticate,
  authorizeWithPermission('emergency:write', ['DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const admission = await emergencyService.admitFromEmergency(
      req.params.appointmentId,
      req.user!.hospitalId,
      req.body.bedId
    );
    sendCreated(res, admission, 'Patient admitted from emergency');
  })
);

// Discharge from emergency
router.post(
  '/:appointmentId/discharge',
  authenticate,
  authorizeWithPermission('emergency:write', ['DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await emergencyService.dischargeFromEmergency(req.params.appointmentId, req.body.notes);
    sendSuccess(res, result, 'Patient discharged');
  })
);

// Get emergency stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await emergencyService.getEmergencyStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

// Get resuscitation status (ESI 1-2)
router.get(
  '/resuscitation',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patients = await emergencyService.getResuscitationStatus(req.user!.hospitalId);
    sendSuccess(res, patients);
  })
);

// Calculate ESI level using AI triage algorithm
router.post(
  '/calculate-esi',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = emergencyService.calculateESI(req.body);
    sendSuccess(res, result);
  })
);

export default router;
