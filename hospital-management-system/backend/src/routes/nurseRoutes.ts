import { Router, Response } from 'express';
import { nurseService } from '../services/nurseService';
import { authenticate, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import prisma from '../config/database';

const router = Router();

// ==================== DASHBOARD ====================

// Get nurse dashboard
router.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { nurseId } = req.query;
    const stats = await nurseService.getDashboard(
      req.user!.hospitalId,
      nurseId as string || req.user!.userId
    );
    sendSuccess(res, stats);
  })
);

// Get unit overview (charge nurse)
router.get(
  '/unit-overview',
  authenticate,
  authorizeWithPermission('nursing:unit:overview', ['NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const overview = await nurseService.getUnitOverview(req.user!.hospitalId);
    sendSuccess(res, overview);
  })
);

// ==================== ASSIGNMENTS ====================

// Assign patient to nurse
router.post(
  '/assignments',
  authenticate,
  authorizeWithPermission('nursing:patients:assign', ['NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const assignment = await nurseService.assignPatient({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      assignedBy: req.user!.userId,
    });
    sendCreated(res, assignment, 'Patient assigned to nurse');
  })
);

// Get my assigned patients
router.get(
  '/my-patients',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { shift } = req.query;
    // Get nurseId from the authenticated nurse user
    const nurse = await prisma.nurse.findUnique({
      where: { userId: req.user!.userId },
    });
    
    if (!nurse) {
      return sendSuccess(res, []); // Not a nurse, return empty
    }

    const patients = await nurseService.getMyPatients(
      req.user!.hospitalId,
      nurse.id,
      shift as string
    );
    sendSuccess(res, patients);
  })
);

// Get all assignments (charge nurse view)
router.get(
  '/assignments',
  authenticate,
  authorizeWithPermission('nursing:patients:read', ['NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { date } = req.query;
    const assignments = await nurseService.getAssignments(
      req.user!.hospitalId,
      date ? new Date(date as string) : undefined
    );
    sendSuccess(res, assignments);
  })
);

// Remove assignment
router.delete(
  '/assignments/:id',
  authenticate,
  authorizeWithPermission('nursing:patients:assign', ['NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await nurseService.removeAssignment(req.params.id);
    sendSuccess(res, null, 'Assignment removed');
  })
);

// ==================== eMAR ====================

// Get eMAR for patient
router.get(
  '/emar/:admissionId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const medications = await nurseService.getEMAR(req.params.admissionId);
    sendSuccess(res, medications);
  })
);

// Administer medication
router.post(
  '/emar/administer',
  authenticate,
  authorizeWithPermission('nursing:emar:administer', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await nurseService.administerMedication({
      ...req.body,
      administeredBy: req.user!.userId,
    });
    sendSuccess(res, result, 'Medication administered');
  })
);

// Verify medication (5 Rights scan)
router.post(
  '/emar/verify',
  authenticate,
  authorizeWithPermission('nursing:emar:administer', ['NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await nurseService.verifyMedication(req.body);
    sendSuccess(res, result, 'Medication verified');
  })
);

// Record medication not given
router.patch(
  '/emar/:id/not-given',
  authenticate,
  authorizeWithPermission('nursing:emar:administer', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reason, notes } = req.body;
    const result = await nurseService.recordNotGiven(req.params.id, reason, notes);
    sendSuccess(res, result, 'Medication marked as not given');
  })
);

// Get overdue medications
router.get(
  '/emar/overdue',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { nurseId } = req.query;
    const medications = await nurseService.getOverdueMedications(
      req.user!.hospitalId,
      nurseId as string
    );
    sendSuccess(res, medications);
  })
);

// ==================== VITALS ====================

// Record vitals
router.post(
  '/vitals',
  authenticate,
  authorizeWithPermission('nursing:vitals:write', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const vital = await nurseService.recordVitals({
      ...req.body,
      recordedBy: req.user!.userId,
    });
    sendCreated(res, vital, 'Vitals recorded');
  })
);

// Get vitals history
router.get(
  '/vitals/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { limit } = req.query;
    const vitals = await nurseService.getVitalsHistory(
      req.params.patientId,
      limit ? parseInt(limit as string) : undefined
    );
    sendSuccess(res, vitals);
  })
);

// Get vitals trends
router.get(
  '/vitals/trends/:patientId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { hours } = req.query;
    const trends = await nurseService.getVitalsTrends(
      req.params.patientId,
      hours ? parseInt(hours as string) : undefined
    );
    sendSuccess(res, trends);
  })
);

// ==================== I&O ====================

// Record intake or output
router.post(
  '/io',
  authenticate,
  authorizeWithPermission('nursing:io:write', ['NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get nurseId from the authenticated nurse user
    const nurse = await prisma.nurse.findUnique({
      where: { userId: req.user!.userId },
    });
    
    if (!nurse) {
      throw new Error('User is not a nurse');
    }

    const record = await nurseService.recordIntakeOutput({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      nurseId: nurse.id,
    });
    sendCreated(res, record, 'I&O recorded');
  })
);

// Get I&O records
router.get(
  '/io/:admissionId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { hours } = req.query;
    const records = await nurseService.getIntakeOutput(
      req.params.admissionId,
      hours ? parseInt(hours as string) : undefined
    );
    sendSuccess(res, records);
  })
);

// Get I&O balance
router.get(
  '/io/balance/:admissionId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { hours } = req.query;
    const balance = await nurseService.getIOBalance(
      req.params.admissionId,
      hours ? parseInt(hours as string) : undefined
    );
    sendSuccess(res, balance);
  })
);

// ==================== ASSESSMENTS ====================

// Create nursing assessment
router.post(
  '/assessments',
  authenticate,
  authorizeWithPermission('nursing:assessments:write', ['NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get nurseId from the authenticated nurse user
    const nurse = await prisma.nurse.findUnique({
      where: { userId: req.user!.userId },
    });
    
    if (!nurse) {
      throw new Error('User is not a nurse');
    }

    const assessment = await nurseService.createAssessment({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      nurseId: nurse.id,
    });
    sendCreated(res, assessment, 'Assessment created');
  })
);

// Get assessments for patient
router.get(
  '/assessments/:admissionId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type } = req.query;
    const assessments = await nurseService.getAssessments(
      req.params.admissionId,
      type as string
    );
    sendSuccess(res, assessments);
  })
);

// Get assessment types
router.get(
  '/assessments/types',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const types = await nurseService.getAssessmentTypes();
    sendSuccess(res, types);
  })
);

// ==================== HANDOFF ====================

// Create shift handoff
router.post(
  '/handoff',
  authenticate,
  authorizeWithPermission('nursing:handoff:write', ['NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get nurseId from the authenticated nurse user
    const nurse = await prisma.nurse.findUnique({
      where: { userId: req.user!.userId },
    });
    
    if (!nurse) {
      throw new Error('User is not a nurse');
    }

    const handoff = await nurseService.createHandoff({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      outgoingNurseId: nurse.id,
    });
    sendCreated(res, handoff, 'Handoff created');
  })
);

// Get handoff history
router.get(
  '/handoff/:admissionId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const history = await nurseService.getHandoffHistory(req.params.admissionId);
    sendSuccess(res, history);
  })
);

// Get pending handoffs
router.get(
  '/handoff/pending',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get nurseId from the authenticated nurse user
    const nurse = await prisma.nurse.findUnique({
      where: { userId: req.user!.userId },
    });
    
    if (!nurse) {
      return sendSuccess(res, []); // Not a nurse, return empty
    }

    const handoffs = await nurseService.getPendingHandoffs(
      req.user!.hospitalId,
      nurse.id
    );
    sendSuccess(res, handoffs);
  })
);

// Accept handoff
router.patch(
  '/handoff/:id/accept',
  authenticate,
  authorizeWithPermission('nursing:handoff:write', ['NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const handoff = await nurseService.acceptHandoff(req.params.id);
    sendSuccess(res, handoff, 'Handoff accepted');
  })
);

// ==================== TASKS ====================

// Create task
router.post(
  '/tasks',
  authenticate,
  authorizeWithPermission('nursing:tasks:write', ['NURSE', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get nurseId from the authenticated nurse user
    const nurse = await prisma.nurse.findUnique({
      where: { userId: req.user!.userId },
    });
    
    if (!nurse) {
      throw new Error('User is not a nurse');
    }

    const task = await nurseService.createTask({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      nurseId: nurse.id,
    });
    sendCreated(res, task, 'Task created');
  })
);

// Get my tasks
router.get(
  '/tasks',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, category, admissionId } = req.query;
    
    // Get nurseId from the authenticated nurse user
    const nurse = await prisma.nurse.findUnique({
      where: { userId: req.user!.userId },
    });
    
    if (!nurse) {
      return sendSuccess(res, []); // Not a nurse, return empty
    }

    const tasks = await nurseService.getTasks(req.user!.hospitalId, nurse.id, {
      status: status as string,
      category: category as string,
      admissionId: admissionId as string,
    });
    sendSuccess(res, tasks);
  })
);

// Update task status
router.patch(
  '/tasks/:id',
  authenticate,
  authorizeWithPermission('nursing:tasks:write', ['NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const task = await nurseService.updateTask(req.params.id, req.body);
    sendSuccess(res, task, 'Task updated');
  })
);

// Get overdue tasks
router.get(
  '/tasks/overdue',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { nurseId } = req.query;
    const tasks = await nurseService.getOverdueTasks(
      req.user!.hospitalId,
      nurseId as string
    );
    sendSuccess(res, tasks);
  })
);

export default router;
