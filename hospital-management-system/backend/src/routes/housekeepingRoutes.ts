import { Router, Response } from 'express';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { housekeepingService } from '../services/housekeepingService';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== ZONES ====================

// Get all zones
router.get(
  '/zones',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const zones = await housekeepingService.getZones(req.user!.hospitalId);
    sendSuccess(res, zones);
  })
);

// Create zone
router.post(
  '/zones',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const zone = await housekeepingService.createZone({
      ...req.body,
      hospitalId: req.user!.hospitalId,
    });
    sendCreated(res, zone, 'Zone created successfully');
  })
);

// Update zone
router.put(
  '/zones/:id',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const zone = await housekeepingService.updateZone(req.params.id, req.body);
    sendSuccess(res, zone, 'Zone updated successfully');
  })
);

// ==================== TASKS ====================

// Get all tasks
router.get(
  '/tasks',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await housekeepingService.getTasks({
      hospitalId: req.user!.hospitalId,
      zoneId: req.query.zoneId as string,
      status: req.query.status as string,
      priority: req.query.priority as string,
      assignedTo: req.query.assignedTo as string,
      taskType: req.query.taskType as string,
      date: req.query.date ? new Date(req.query.date as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    sendSuccess(res, result);
  })
);

// Get task by ID
router.get(
  '/tasks/:id',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const task = await housekeepingService.getTaskById(req.params.id);
    sendSuccess(res, task);
  })
);

// Create task
router.post(
  '/tasks',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const task = await housekeepingService.createTask({
      ...req.body,
      hospitalId: req.user!.hospitalId,
    });
    sendCreated(res, task, 'Task created successfully');
  })
);

// Update task
router.put(
  '/tasks/:id',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const task = await housekeepingService.updateTask(req.params.id, req.body);
    sendSuccess(res, task, 'Task updated successfully');
  })
);

// Assign task
router.post(
  '/tasks/:id/assign',
  authorizeWithPermission('housekeeping:assign', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { employeeId, supervisorId } = req.body;
    const task = await housekeepingService.assignTask(req.params.id, employeeId, supervisorId);
    sendSuccess(res, task, 'Task assigned successfully');
  })
);

// Start task
router.post(
  '/tasks/:id/start',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const task = await housekeepingService.startTask(req.params.id);
    sendSuccess(res, task, 'Task started');
  })
);

// Complete task
router.post(
  '/tasks/:id/complete',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const task = await housekeepingService.completeTask(req.params.id, req.body);
    sendSuccess(res, task, 'Task completed');
  })
);

// Verify task
router.post(
  '/tasks/:id/verify',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { qualityScore } = req.body;
    const task = await housekeepingService.verifyTask(req.params.id, req.user!.userId, qualityScore);
    sendSuccess(res, task, task.status === 'VERIFIED' ? 'Task verified' : 'Task requires re-cleaning');
  })
);

// Update checklist item
router.patch(
  '/tasks/checklist/:itemId',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { isCompleted, notes } = req.body;
    const item = await housekeepingService.updateChecklistItem(req.params.itemId, isCompleted, notes);
    sendSuccess(res, item);
  })
);

// Get AI prioritized tasks
router.get(
  '/tasks/ai/prioritized',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tasks = await housekeepingService.getAIPrioritizedTasks(req.user!.hospitalId);
    sendSuccess(res, tasks);
  })
);

// Predict cleaning time
router.get(
  '/tasks/ai/predict-time',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { taskType, zoneId } = req.query;
    const prediction = await housekeepingService.predictCleaningTime(
      taskType as string,
      zoneId as string
    );
    sendSuccess(res, prediction);
  })
);

// ==================== SCHEDULES ====================

// Get schedules
router.get(
  '/schedules',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const schedules = await housekeepingService.getSchedules(
      req.user!.hospitalId,
      req.query.zoneId as string
    );
    sendSuccess(res, schedules);
  })
);

// Create schedule
router.post(
  '/schedules',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const schedule = await housekeepingService.createSchedule({
      ...req.body,
      hospitalId: req.user!.hospitalId,
    });
    sendCreated(res, schedule, 'Schedule created successfully');
  })
);

// Generate scheduled tasks
router.post(
  '/schedules/generate-tasks',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tasks = await housekeepingService.generateScheduledTasks(req.user!.hospitalId);
    sendSuccess(res, tasks, `Generated ${tasks.length} tasks from schedules`);
  })
);

// ==================== INVENTORY ====================

// Get inventory
router.get(
  '/inventory',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const inventory = await housekeepingService.getInventory(req.user!.hospitalId, {
      category: req.query.category as string,
      lowStock: req.query.lowStock === 'true',
    });
    sendSuccess(res, inventory);
  })
);

// Get low stock items
router.get(
  '/inventory/low-stock',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const items = await housekeepingService.getLowStockItems(req.user!.hospitalId);
    sendSuccess(res, items);
  })
);

// Create inventory item
router.post(
  '/inventory',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const item = await housekeepingService.createInventoryItem({
      ...req.body,
      hospitalId: req.user!.hospitalId,
    });
    sendCreated(res, item, 'Inventory item created successfully');
  })
);

// Update inventory stock
router.patch(
  '/inventory/:id/stock',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { quantity, action, taskId, notes } = req.body;
    const item = await housekeepingService.updateInventoryStock(
      req.params.id,
      quantity,
      action,
      req.user!.userId,
      taskId,
      notes
    );
    sendSuccess(res, item, `Stock ${action.toLowerCase()}ed successfully`);
  })
);

// ==================== QUALITY AUDITS ====================

// Get audits
router.get(
  '/audits',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await housekeepingService.getAudits({
      hospitalId: req.user!.hospitalId,
      zoneId: req.query.zoneId as string,
      status: req.query.status as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    sendSuccess(res, result);
  })
);

// Create audit
router.post(
  '/audits',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const audit = await housekeepingService.createAudit({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      auditorId: req.user!.userId,
    });
    sendCreated(res, audit, 'Quality audit created successfully');
  })
);

// Resolve audit
router.patch(
  '/audits/:id/resolve',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const audit = await housekeepingService.resolveAudit(req.params.id, req.user!.userId);
    sendSuccess(res, audit, 'Audit resolved');
  })
);

// ==================== CHECKLISTS ====================

// Get checklists
router.get(
  '/checklists',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const checklists = await housekeepingService.getChecklists(
      req.user!.hospitalId,
      req.query.taskType as string
    );
    sendSuccess(res, checklists);
  })
);

// Create checklist
router.post(
  '/checklists',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const checklist = await housekeepingService.createChecklist({
      ...req.body,
      hospitalId: req.user!.hospitalId,
    });
    sendCreated(res, checklist, 'Checklist created successfully');
  })
);

// Update checklist
router.put(
  '/checklists/:id',
  authorizeWithPermission('housekeeping:write', ['HOUSEKEEPING_MANAGER', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const checklist = await housekeepingService.updateChecklist(req.params.id, req.body);
    sendSuccess(res, checklist, 'Checklist updated successfully');
  })
);

// ==================== DASHBOARD ====================

// Get housekeeping dashboard stats
router.get(
  '/dashboard',
  authorizeWithPermission('housekeeping:read', ['HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_STAFF', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await housekeepingService.getDashboardStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

export default router;
