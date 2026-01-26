import { Router, Response } from 'express';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { departmentService } from '../services/departmentService';
import { body, param, query, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validate = (req: any, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ==================== DEPARTMENT ROUTES ====================

// Get all departments
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const departments = await departmentService.getAllDepartments(
      req.user!.hospitalId,
      includeInactive
    );
    sendSuccess(res, departments);
  })
);

// Get all specializations for the hospital (utility endpoint)
router.get(
  '/specializations/all',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const specializations = await departmentService.getAllSpecializationsForHospital(
      req.user!.hospitalId
    );
    sendSuccess(res, specializations);
  })
);

// Get department by ID
router.get(
  '/:id',
  authenticate,
  param('id').isUUID().withMessage('Invalid department ID'),
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const department = await departmentService.getDepartmentById(
      req.user!.hospitalId,
      req.params.id
    );
    sendSuccess(res, department);
  })
);

// Create department (Admin only)
router.post(
  '/',
  authenticate,
  authorizeWithPermission('departments:write', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('description').optional().trim(),
    body('floor').optional().trim(),
    body('phone').optional().trim(),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('headDoctorId').optional().isUUID().withMessage('Invalid doctor ID'),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const department = await departmentService.createDepartment(
      req.user!.hospitalId,
      req.body
    );
    sendSuccess(res, department, 'Department created successfully', 201);
  })
);

// Update department (Admin only)
router.put(
  '/:id',
  authenticate,
  authorizeWithPermission('departments:write', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Invalid department ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('code').optional().trim().notEmpty().withMessage('Code cannot be empty'),
    body('description').optional().trim(),
    body('floor').optional().trim(),
    body('phone').optional().trim(),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('headDoctorId').optional().isUUID().withMessage('Invalid doctor ID'),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const department = await departmentService.updateDepartment(
      req.user!.hospitalId,
      req.params.id,
      req.body
    );
    sendSuccess(res, department, 'Department updated successfully');
  })
);

// Delete department (Admin only - soft delete)
router.delete(
  '/:id',
  authenticate,
  authorizeWithPermission('departments:delete', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  param('id').isUUID().withMessage('Invalid department ID'),
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await departmentService.deleteDepartment(
      req.user!.hospitalId,
      req.params.id
    );
    sendSuccess(res, result);
  })
);

// ==================== SPECIALIZATION ROUTES ====================

// Get specializations for a department
router.get(
  '/:id/specializations',
  authenticate,
  param('id').isUUID().withMessage('Invalid department ID'),
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const specializations = await departmentService.getSpecializations(
      req.user!.hospitalId,
      req.params.id
    );
    sendSuccess(res, specializations);
  })
);

// Create specialization (Admin only)
router.post(
  '/:id/specializations',
  authenticate,
  authorizeWithPermission('departments:write', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Invalid department ID'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('code').trim().notEmpty().withMessage('Code is required'),
    body('description').optional().trim(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const specialization = await departmentService.createSpecialization(
      req.user!.hospitalId,
      req.params.id,
      req.body
    );
    sendSuccess(res, specialization, 'Specialization created successfully', 201);
  })
);

// Update specialization (Admin only)
router.put(
  '/:id/specializations/:specId',
  authenticate,
  authorizeWithPermission('departments:write', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Invalid department ID'),
    param('specId').isUUID().withMessage('Invalid specialization ID'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('code').optional().trim().notEmpty().withMessage('Code cannot be empty'),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const specialization = await departmentService.updateSpecialization(
      req.user!.hospitalId,
      req.params.id,
      req.params.specId,
      req.body
    );
    sendSuccess(res, specialization, 'Specialization updated successfully');
  })
);

// Delete specialization (Admin only - soft delete)
router.delete(
  '/:id/specializations/:specId',
  authenticate,
  authorizeWithPermission('departments:delete', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  [
    param('id').isUUID().withMessage('Invalid department ID'),
    param('specId').isUUID().withMessage('Invalid specialization ID'),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await departmentService.deleteSpecialization(
      req.user!.hospitalId,
      req.params.id,
      req.params.specId
    );
    sendSuccess(res, result);
  })
);

export default router;
