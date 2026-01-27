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

// Get available ED doctors
router.get(
  '/available-doctors',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const doctors = await emergencyService.getAvailableDoctors(req.user!.hospitalId);
    sendSuccess(res, doctors);
  })
);

// Get available beds for admission
router.get(
  '/available-beds',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const beds = await emergencyService.getAvailableBeds(req.user!.hospitalId);
    sendSuccess(res, beds);
  })
);

// Get stats with hourly trends
router.get(
  '/stats-with-trends',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await emergencyService.getStatsWithTrends(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

// ==================== FEATURE 4: ED BED MANAGEMENT ====================

// Get ED beds with status
router.get(
  '/beds',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const beds = await emergencyService.getEDBeds(req.user!.hospitalId);
    sendSuccess(res, beds);
  })
);

// Assign patient to bed
router.patch(
  '/beds/:bedId/assign',
  authenticate,
  authorizeWithPermission('emergency:write', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { appointmentId } = req.body;
    const result = await emergencyService.assignPatientToBed(appointmentId, req.params.bedId);
    sendSuccess(res, result, 'Patient assigned to bed');
  })
);

// Update bed status
router.patch(
  '/beds/:bedId/status',
  authenticate,
  authorizeWithPermission('emergency:write', ['NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const bed = await emergencyService.updateEDBedStatus(req.params.bedId, status);
    sendSuccess(res, bed, 'Bed status updated');
  })
);

// Get waiting patients (not assigned to beds)
router.get(
  '/waiting-patients',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const patients = await emergencyService.getWaitingPatients(req.user!.hospitalId);
    sendSuccess(res, patients);
  })
);

// ==================== FEATURE 6: AMBULANCE INTEGRATION ====================

// Get incoming ambulances
router.get(
  '/incoming-ambulances',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const ambulances = await emergencyService.getIncomingAmbulances(req.user!.hospitalId);
    sendSuccess(res, ambulances);
  })
);

// ==================== BLOOD BANK INTEGRATION ====================

// Get blood bank inventory (quick view for emergency)
router.get(
  '/blood-bank/inventory',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const inventory = await emergencyService.getBloodBankInventory(req.user!.hospitalId);
    sendSuccess(res, inventory);
  })
);

// Create emergency blood request
router.post(
  '/blood-bank/request',
  authenticate,
  authorizeWithPermission('emergency:write', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const request = await emergencyService.createEmergencyBloodRequest(
      req.user!.hospitalId,
      { ...req.body, requestedBy: req.user!.userId }
    );
    sendCreated(res, request, 'Emergency blood request created');
  })
);

// Get emergency blood requests
router.get(
  '/blood-bank/requests',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requests = await emergencyService.getEmergencyBloodRequests(req.user!.hospitalId);
    sendSuccess(res, requests);
  })
);

// Emergency release (O- universal donor)
router.post(
  '/blood-bank/emergency-release',
  authenticate,
  authorizeWithPermission('emergency:write', ['DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, unitsNeeded } = req.body;
    const result = await emergencyService.emergencyBloodRelease(
      req.user!.hospitalId,
      patientId,
      unitsNeeded,
      req.user!.userId
    );
    sendCreated(res, result, 'Emergency blood released');
  })
);

export default router;
