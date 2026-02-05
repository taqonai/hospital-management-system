import { Router, Response } from 'express';
import { opdService } from '../services/opdService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';

const router = Router();

// Helper function to get doctorId for the logged-in doctor
async function getDoctorIdForUser(userId: string): Promise<string | null> {
  const doctor = await prisma.doctor.findFirst({
    where: { userId },
    select: { id: true },
  });
  return doctor?.id || null;
}

// Get today's queue (Live Queue)
// RECEPTIONIST: Sees SCHEDULED, CONFIRMED, CHECKED_IN, IN_PROGRESS (to check patients in)
// NURSE: Sees CHECKED_IN, IN_PROGRESS (patients ready for vitals)
// DOCTOR: Sees only their own CHECKED_IN, IN_PROGRESS (patients ready for consultation)
router.get(
  '/queue',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    let doctorId = req.query.doctorId as string | undefined;
    const userRole = req.user!.role;

    // If user is a DOCTOR, automatically filter to their own queue
    if (userRole === 'DOCTOR') {
      const loggedInDoctorId = await getDoctorIdForUser(req.user!.userId);
      if (loggedInDoctorId) {
        doctorId = loggedInDoctorId;
      }
    }

    const queue = await opdService.getTodayQueue(req.user!.hospitalId, doctorId, userRole);
    sendSuccess(res, queue);
  })
);

// Get all today's appointments (full schedule for the day)
// DOCTOR: Only sees their own appointments
// NURSE/RECEPTIONIST/ADMIN: See all departments
router.get(
  '/appointments/today',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    let doctorId = req.query.doctorId as string | undefined;

    // If user is a DOCTOR, automatically filter to their own appointments
    if (req.user!.role === 'DOCTOR') {
      const loggedInDoctorId = await getDoctorIdForUser(req.user!.userId);
      if (loggedInDoctorId) {
        doctorId = loggedInDoctorId;
      }
    }

    const appointments = await opdService.getTodayAppointments(req.user!.hospitalId, doctorId);
    sendSuccess(res, appointments);
  })
);

// Check in patient (Front Desk / Receptionist only - not Nurse)
router.post(
  '/check-in/:appointmentId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['RECEPTIONIST', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await opdService.checkInPatient(req.params.appointmentId, req.user!.hospitalId);
    sendSuccess(res, result, 'Patient checked in');
  })
);

// Call next patient
router.post(
  '/call-next',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get doctor ID: prefer explicit body param, otherwise look up from user profile
    let doctorId = req.body.doctorId;
    if (!doctorId) {
      doctorId = await getDoctorIdForUser(req.user!.userId);
    }
    if (!doctorId) {
      sendSuccess(res, null, 'Doctor profile not found');
      return;
    }
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
  authorizeWithPermission('opd:visits:write', ['RECEPTIONIST', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await opdService.markNoShow(req.params.appointmentId, req.user!.hospitalId);
    sendSuccess(res, result, 'Marked as no-show');
  })
);

// Reschedule appointment
router.post(
  '/reschedule/:appointmentId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['RECEPTIONIST', 'HOSPITAL_ADMIN']),
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
// DOCTOR: Only sees their own stats
// NURSE/RECEPTIONIST/ADMIN: See hospital-wide stats
// Stats reflect role-based queue counts
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    let doctorId: string | undefined;
    const userRole = req.user!.role;

    // If user is a DOCTOR, automatically filter to their own stats
    if (userRole === 'DOCTOR') {
      const loggedInDoctorId = await getDoctorIdForUser(req.user!.userId);
      if (loggedInDoctorId) {
        doctorId = loggedInDoctorId;
      }
    }

    const stats = await opdService.getOPDStats(req.user!.hospitalId, doctorId, userRole);
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
// Primary: NURSE records vitals | DOCTOR can override in emergencies (flagged for audit)
router.post(
  '/appointments/:appointmentId/vitals',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
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
      isEmergencyOverride, // Flag when doctor records vitals (bypassing normal nurse workflow)
      // Patient details (pregnancy, medications, treatment)
      isPregnant,
      expectedDueDate,
      currentMedications,
      currentTreatment,
      // Medical history records
      pastSurgeries,
      immunizations,
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
        // Patient details
        isPregnant,
        expectedDueDate,
        currentMedications,
        currentTreatment,
        // Medical history records
        pastSurgeries,
        immunizations,
      },
      req.user!.userId,
      req.user!.role, // Pass role for tracking
      isEmergencyOverride // Pass override flag
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
  authorizeWithPermission('opd:visits:read', ['RECEPTIONIST', 'NURSE', 'DOCTOR', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']),
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
  authorizeWithPermission('opd:visits:read', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await opdService.getPatientBookingHistory(patientId, req.user!.hospitalId, limit);
    sendSuccess(res, result);
  })
);

// Get patient's latest patient status (pregnancy, medications, treatment) from previous vitals
router.get(
  '/patient-status/:patientId',
  authenticate,
  authorizeWithPermission('opd:visits:read', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const result = await opdService.getPatientLatestStatus(patientId, req.user!.hospitalId);
    sendSuccess(res, result);
  })
);

// Get patient's medical summary (medical history + allergies) for nurse vitals modal
router.get(
  '/patient-medical-summary/:patientId',
  authenticate,
  authorizeWithPermission('opd:visits:read', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const result = await opdService.getPatientMedicalSummary(patientId, req.user!.hospitalId);
    sendSuccess(res, result);
  })
);

// Update patient's medical history (chronic conditions & family history)
router.put(
  '/patient-medical-history/:patientId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const result = await opdService.updatePatientMedicalHistory(patientId, req.user!.hospitalId, req.body, req.user!.userId);
    sendSuccess(res, result, 'Medical history updated');
  })
);

// Add allergy for a patient
router.post(
  '/patient-allergies/:patientId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const result = await opdService.addPatientAllergy(patientId, req.user!.hospitalId, req.body);
    sendSuccess(res, result, 'Allergy added');
  })
);

// Update allergy for a patient
router.put(
  '/patient-allergies/:patientId/:allergyId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, allergyId } = req.params;
    const result = await opdService.updatePatientAllergy(patientId, req.user!.hospitalId, allergyId, req.body);
    sendSuccess(res, result, 'Allergy updated');
  })
);

// Delete allergy for a patient
router.delete(
  '/patient-allergies/:patientId/:allergyId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, allergyId } = req.params;
    const result = await opdService.deletePatientAllergy(patientId, req.user!.hospitalId, allergyId);
    sendSuccess(res, result, 'Allergy deleted');
  })
);

// Update past surgery record
router.put(
  '/patient-surgeries/:patientId/:surgeryId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, surgeryId } = req.params;
    const result = await opdService.updatePastSurgery(patientId, req.user!.hospitalId, surgeryId, req.body, req.user!.userId);
    sendSuccess(res, result, 'Past surgery updated');
  })
);

// Delete past surgery record
router.delete(
  '/patient-surgeries/:patientId/:surgeryId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, surgeryId } = req.params;
    const result = await opdService.deletePastSurgery(patientId, req.user!.hospitalId, surgeryId);
    sendSuccess(res, result, 'Past surgery deleted');
  })
);

// Update immunization record
router.put(
  '/patient-immunizations/:patientId/:immunizationId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, immunizationId } = req.params;
    const result = await opdService.updateImmunization(patientId, req.user!.hospitalId, immunizationId, req.body, req.user!.userId);
    sendSuccess(res, result, 'Immunization updated');
  })
);

// Delete immunization record
router.delete(
  '/patient-immunizations/:patientId/:immunizationId',
  authenticate,
  authorizeWithPermission('opd:visits:write', ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, immunizationId } = req.params;
    const result = await opdService.deleteImmunization(patientId, req.user!.hospitalId, immunizationId);
    sendSuccess(res, result, 'Immunization deleted');
  })
);

export default router;
