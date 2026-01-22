import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { hrService } from '../services/hrService';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== EMPLOYEES ====================

// Get all employees
router.get(
  '/employees',
  authorize('HR_MANAGER', 'HR_STAFF', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await hrService.getEmployees({
      hospitalId: req.user!.hospitalId,
      search: req.query.search as string,
      department: req.query.department as string,
      employeeType: req.query.employeeType as string,
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    sendSuccess(res, result);
  })
);

// Get employee by ID
router.get(
  '/employees/:id',
  authorize('HR_MANAGER', 'HR_STAFF', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const employee = await hrService.getEmployeeById(req.params.id);
    sendSuccess(res, employee);
  })
);

// Create employee
router.post(
  '/employees',
  authorize('HR_MANAGER', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const employee = await hrService.createEmployee({
      ...req.body,
      hospitalId: req.user!.hospitalId,
    });
    sendCreated(res, employee, 'Employee created successfully');
  })
);

// Update employee
router.put(
  '/employees/:id',
  authorize('HR_MANAGER', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const employee = await hrService.updateEmployee(req.params.id, req.body);
    sendSuccess(res, employee, 'Employee updated successfully');
  })
);

// ==================== ATTENDANCE ====================

// Check in
router.post(
  '/attendance/check-in',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Get employee ID from user or body
    const employeeId = req.body.employeeId;
    const attendance = await hrService.checkIn(employeeId, {
      location: req.body.location,
      ipAddress: req.ip,
    });
    sendSuccess(res, attendance, 'Checked in successfully');
  })
);

// Check out
router.post(
  '/attendance/check-out',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const employeeId = req.body.employeeId;
    const attendance = await hrService.checkOut(employeeId, {
      location: req.body.location,
    });
    sendSuccess(res, attendance, 'Checked out successfully');
  })
);

// Get attendance records
router.get(
  '/attendance',
  authorize('HR_MANAGER', 'HR_STAFF', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await hrService.getAttendance({
      hospitalId: req.user!.hospitalId,
      employeeId: req.query.employeeId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    });
    sendSuccess(res, result);
  })
);

// Get attendance summary for employee
router.get(
  '/attendance/summary/:employeeId',
  authorize('HR_MANAGER', 'HR_STAFF', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const summary = await hrService.getAttendanceSummary(req.params.employeeId, month, year);
    sendSuccess(res, summary);
  })
);

// ==================== LEAVE MANAGEMENT ====================

// Get leave types
router.get(
  '/leave-types',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const leaveTypes = await hrService.getLeaveTypes(req.user!.hospitalId);
    sendSuccess(res, leaveTypes);
  })
);

// Create leave type
router.post(
  '/leave-types',
  authorize('HR_MANAGER', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const leaveType = await hrService.createLeaveType({
      ...req.body,
      hospitalId: req.user!.hospitalId,
    });
    sendCreated(res, leaveType, 'Leave type created successfully');
  })
);

// Apply for leave
router.post(
  '/leave/apply',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const leaveRequest = await hrService.applyLeave(req.body);
    sendCreated(res, leaveRequest, 'Leave request submitted successfully');
  })
);

// Process leave request (approve/reject)
router.patch(
  '/leave/:id/process',
  authorize('HR_MANAGER', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { action, rejectionReason } = req.body;
    const leaveRequest = await hrService.processLeaveRequest(
      req.params.id,
      action,
      req.user!.userId,
      rejectionReason
    );
    sendSuccess(res, leaveRequest, `Leave request ${action.toLowerCase()}d successfully`);
  })
);

// Get leave requests
router.get(
  '/leave/requests',
  authorize('HR_MANAGER', 'HR_STAFF', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await hrService.getLeaveRequests({
      hospitalId: req.user!.hospitalId,
      employeeId: req.query.employeeId as string,
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    sendSuccess(res, result);
  })
);

// Get employee leave balances
router.get(
  '/leave/balance/:employeeId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const balances = await hrService.getLeaveBalances(req.params.employeeId, year);
    sendSuccess(res, balances);
  })
);

// ==================== PAYROLL ====================

// Generate payroll for month
router.post(
  '/payroll/generate',
  authorize('HR_MANAGER', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { month, year } = req.body;
    const payrolls = await hrService.generatePayroll(
      req.user!.hospitalId,
      month,
      year
    );
    sendCreated(res, payrolls, `Generated ${payrolls.length} payroll records`);
  })
);

// Get payroll records
router.get(
  '/payroll',
  authorize('HR_MANAGER', 'HR_STAFF', 'HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await hrService.getPayrolls({
      hospitalId: req.user!.hospitalId,
      month: req.query.month ? parseInt(req.query.month as string) : undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      employeeId: req.query.employeeId as string,
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    sendSuccess(res, result);
  })
);

// Process payroll (approve/pay)
router.patch(
  '/payroll/:id/process',
  authorize('HR_MANAGER', 'HOSPITAL_ADMIN', 'ACCOUNTANT'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { action, paymentMode, transactionId } = req.body;
    const payroll = await hrService.processPayroll(
      req.params.id,
      action,
      req.user!.userId,
      { paymentMode, transactionId }
    );
    sendSuccess(res, payroll, `Payroll ${action.toLowerCase()}d successfully`);
  })
);

// ==================== SHIFTS ====================

// Get shifts
router.get(
  '/shifts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const shifts = await hrService.getShifts(req.user!.hospitalId);
    sendSuccess(res, shifts);
  })
);

// Create shift
router.post(
  '/shifts',
  authorize('HR_MANAGER', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const shift = await hrService.createShift({
      ...req.body,
      hospitalId: req.user!.hospitalId,
    });
    sendCreated(res, shift, 'Shift created successfully');
  })
);

// Update shift
router.put(
  '/shifts/:id',
  authorize('HR_MANAGER', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const shift = await hrService.updateShift(req.params.id, req.body);
    sendSuccess(res, shift, 'Shift updated successfully');
  })
);

// Assign shift to employee
router.post(
  '/shifts/assign',
  authorize('HR_MANAGER', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { employeeId, shiftId } = req.body;
    const employee = await hrService.assignShift(employeeId, shiftId);
    sendSuccess(res, employee, 'Shift assigned successfully');
  })
);

// ==================== EMPLOYEE SELF-SERVICE LEAVE ====================

// Get current user's employee record
router.get(
  '/leave/my-employee',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const employee = await hrService.getEmployeeByUserId(
      req.user!.userId,
      req.user!.hospitalId
    );
    sendSuccess(res, employee);
  })
);

// Get current user's leave balances
router.get(
  '/leave/my-balance',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const employee = await hrService.getEmployeeByUserId(
      req.user!.userId,
      req.user!.hospitalId
    );
    if (!employee) {
      return sendSuccess(res, { balances: [], message: 'No employee record found' });
    }
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const balances = await hrService.getLeaveBalances(employee.id, year);
    sendSuccess(res, { employee, balances });
  })
);

// Get current user's leave requests
router.get(
  '/leave/my-requests',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const employee = await hrService.getEmployeeByUserId(
      req.user!.userId,
      req.user!.hospitalId
    );
    if (!employee) {
      return sendSuccess(res, { requests: [], message: 'No employee record found' });
    }
    const result = await hrService.getLeaveRequests({
      hospitalId: req.user!.hospitalId,
      employeeId: employee.id,
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    sendSuccess(res, result);
  })
);

// Withdraw own pending leave request
router.patch(
  '/leave/:id/withdraw',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const employee = await hrService.getEmployeeByUserId(
      req.user!.userId,
      req.user!.hospitalId
    );
    if (!employee) {
      throw new Error('No employee record found');
    }
    const leaveRequest = await hrService.withdrawLeaveRequest(
      req.params.id,
      employee.id
    );
    sendSuccess(res, leaveRequest, 'Leave request withdrawn successfully');
  })
);

// ==================== DASHBOARD ====================

// Get HR dashboard stats
router.get(
  '/dashboard',
  authorize('HR_MANAGER', 'HR_STAFF', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await hrService.getDashboardStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

export default router;
