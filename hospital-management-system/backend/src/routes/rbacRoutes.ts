import { Router, Response } from 'express';
import { rbacService } from '../services/rbacService';
import { authenticate, authorize } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== PERMISSIONS ====================

/**
 * Get all available permissions (for UI display)
 * Returns the complete list of permissions that can be assigned
 */
router.get(
  '/permissions',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const permissions = await rbacService.getAllPermissions();
    sendSuccess(res, permissions, 'Permissions retrieved successfully');
  })
);

// ==================== ROLES ====================

/**
 * Create a new custom role
 */
router.post(
  '/roles',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const role = await rbacService.createRole({
      ...req.body,
      hospitalId: req.user!.hospitalId,
      createdById: req.user!.userId,
    });
    sendCreated(res, role, 'Role created successfully');
  })
);

/**
 * Get all roles for the hospital
 */
router.get(
  '/roles',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const roles = await rbacService.getRoles({
      hospitalId: req.user!.hospitalId,
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    sendSuccess(res, roles, 'Roles retrieved successfully');
  })
);

/**
 * Get role by ID
 */
router.get(
  '/roles/:id',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const role = await rbacService.getRoleById(req.params.id);
    sendSuccess(res, role, 'Role retrieved successfully');
  })
);

/**
 * Update role
 */
router.put(
  '/roles/:id',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const role = await rbacService.updateRole(req.params.id, {
      ...req.body,
      updatedById: req.user!.userId,
    });
    sendSuccess(res, role, 'Role updated successfully');
  })
);

/**
 * Delete role
 */
router.delete(
  '/roles/:id',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await rbacService.deleteRole(req.params.id, req.user!.userId);
    sendSuccess(res, null, 'Role deleted successfully');
  })
);

// ==================== USER ROLE ASSIGNMENT ====================

/**
 * Assign role to user
 */
router.post(
  '/users/:userId/roles',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await rbacService.assignRoleToUser({
      userId: req.params.userId,
      roleId: req.body.roleId,
      assignedById: req.user!.userId,
      hospitalId: req.user!.hospitalId,
    });
    sendCreated(res, result, 'Role assigned to user successfully');
  })
);

/**
 * Remove role from user
 */
router.delete(
  '/users/:userId/roles/:roleId',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await rbacService.removeRoleFromUser({
      userId: req.params.userId,
      roleId: req.params.roleId,
      removedById: req.user!.userId,
    });
    sendSuccess(res, null, 'Role removed from user successfully');
  })
);

/**
 * Get user's roles and permissions
 */
router.get(
  '/users/:userId/roles',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await rbacService.getUserRolesAndPermissions(req.params.userId);
    sendSuccess(res, result, 'User roles and permissions retrieved successfully');
  })
);

/**
 * Get users by role
 */
router.get(
  '/roles/:roleId/users',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const users = await rbacService.getUsersByRole({
      roleId: req.params.roleId,
      hospitalId: req.user!.hospitalId,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });
    sendSuccess(res, users, 'Users retrieved successfully');
  })
);

// ==================== DIRECT PERMISSIONS ====================

/**
 * Grant permission directly to user (bypassing roles)
 */
router.post(
  '/users/:userId/permissions',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await rbacService.grantPermissionToUser({
      userId: req.params.userId,
      permission: req.body.permission,
      grantedById: req.user!.userId,
    });
    sendCreated(res, result, 'Permission granted to user successfully');
  })
);

/**
 * Revoke permission from user
 */
router.delete(
  '/users/:userId/permissions/:permission',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await rbacService.revokePermissionFromUser({
      userId: req.params.userId,
      permission: req.params.permission,
      revokedById: req.user!.userId,
    });
    sendSuccess(res, null, 'Permission revoked from user successfully');
  })
);

// ==================== AUDIT LOGS ====================

/**
 * Get RBAC audit logs
 */
router.get(
  '/audit-logs',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const logs = await rbacService.getAuditLogs({
      hospitalId: req.user!.hospitalId,
      userId: req.query.userId as string,
      action: req.query.action as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
    });
    sendSuccess(res, logs, 'Audit logs retrieved successfully');
  })
);

// ==================== MY PERMISSIONS ====================

/**
 * Get current user's permissions
 * Available to any authenticated user to check their own permissions
 */
router.get(
  '/my-permissions',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const permissions = await rbacService.getUserPermissions(req.user!.userId);
    const roles = await rbacService.getUserRoles(req.user!.userId);
    sendSuccess(
      res,
      {
        baseRole: req.user!.role,
        customRoles: roles,
        permissions,
      },
      'Your permissions retrieved successfully'
    );
  })
);

/**
 * Check if current user has a specific permission
 */
router.get(
  '/my-permissions/check/:permission',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // SUPER_ADMIN has all permissions
    if (req.user!.role === 'SUPER_ADMIN') {
      sendSuccess(res, { hasPermission: true }, 'Permission check completed');
      return;
    }

    const hasPermission = await rbacService.hasPermission(req.user!.userId, req.params.permission);
    sendSuccess(res, { hasPermission }, 'Permission check completed');
  })
);

export default router;
