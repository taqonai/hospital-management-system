import { Router, Response } from 'express';
import { rbacService } from '../services/rbacService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { invalidatePermissions, invalidateAllPermissions } from '../services/permissionCacheService';

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
  authorizeWithPermission('rbac:roles:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Return the list of available permissions from the service
    const permissions = await rbacService.getUserPermissions(req.user!.userId);
    sendSuccess(res, { permissions }, 'Permissions retrieved successfully');
  })
);

// ==================== ROLES ====================

/**
 * Create a new custom role
 */
router.post(
  '/roles',
  authorizeWithPermission('rbac:roles:write', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const role = await rbacService.createRole(req.user!.hospitalId, {
      ...req.body,
      createdBy: req.user!.userId,
    });
    await invalidateAllPermissions();
    sendCreated(res, role, 'Role created successfully');
  })
);

/**
 * Get all roles for the hospital
 */
router.get(
  '/roles',
  authorizeWithPermission('rbac:roles:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const roles = await rbacService.getRoles(req.user!.hospitalId, {
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
  authorizeWithPermission('rbac:roles:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const role = await rbacService.getRoleById(req.user!.hospitalId, req.params.id);
    sendSuccess(res, role, 'Role retrieved successfully');
  })
);

/**
 * Update role
 */
router.put(
  '/roles/:id',
  authorizeWithPermission('rbac:roles:write', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const role = await rbacService.updateRole(
      req.user!.hospitalId,
      req.params.id,
      req.body,
      req.user!.userId
    );
    await invalidateAllPermissions();
    sendSuccess(res, role, 'Role updated successfully');
  })
);

/**
 * Delete role
 */
router.delete(
  '/roles/:id',
  authorizeWithPermission('rbac:roles:write', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await rbacService.deleteRole(req.user!.hospitalId, req.params.id, req.user!.userId);
    await invalidateAllPermissions();
    sendSuccess(res, null, 'Role deleted successfully');
  })
);

// ==================== USER ROLE ASSIGNMENT ====================

/**
 * Assign role to user
 */
router.post(
  '/users/:userId/roles',
  authorizeWithPermission('rbac:assign', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await rbacService.assignRoleToUser(
      req.params.userId,
      req.body.roleId,
      req.user!.userId
    );
    await invalidatePermissions(req.params.userId);
    sendCreated(res, { success: true }, 'Role assigned to user successfully');
  })
);

/**
 * Remove role from user
 */
router.delete(
  '/users/:userId/roles/:roleId',
  authorizeWithPermission('rbac:assign', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await rbacService.removeRoleFromUser(
      req.params.userId,
      req.params.roleId,
      req.user!.userId
    );
    await invalidatePermissions(req.params.userId);
    sendSuccess(res, null, 'Role removed from user successfully');
  })
);

/**
 * Get user's roles and permissions
 */
router.get(
  '/users/:userId/roles',
  authorizeWithPermission('rbac:roles:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const roles = await rbacService.getUserRoles(req.params.userId);
    const permissions = await rbacService.getUserPermissions(req.params.userId);
    sendSuccess(res, { roles, permissions }, 'User roles and permissions retrieved successfully');
  })
);

/**
 * Get users by role
 */
router.get(
  '/roles/:roleId/users',
  authorizeWithPermission('rbac:roles:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const users = await rbacService.getUsersByRole(req.user!.hospitalId, req.params.roleId);
    sendSuccess(res, users, 'Users retrieved successfully');
  })
);

// ==================== DIRECT PERMISSIONS ====================

/**
 * Grant permission directly to user (bypassing roles)
 */
router.post(
  '/users/:userId/permissions',
  authorizeWithPermission('rbac:assign', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await rbacService.grantPermission(
      req.params.userId,
      req.body.permission,
      req.user!.userId
    );
    await invalidatePermissions(req.params.userId);
    sendCreated(res, { success: true }, 'Permission granted to user successfully');
  })
);

/**
 * Revoke permission from user
 */
router.delete(
  '/users/:userId/permissions/:permission',
  authorizeWithPermission('rbac:assign', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await rbacService.revokePermission(
      req.params.userId,
      req.params.permission,
      req.user!.userId
    );
    await invalidatePermissions(req.params.userId);
    sendSuccess(res, null, 'Permission revoked from user successfully');
  })
);

// ==================== AUDIT LOGS ====================

/**
 * Get RBAC audit logs
 */
router.get(
  '/audit-logs',
  authorizeWithPermission('rbac:audit', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const logs = await rbacService.getAuditLogs(req.user!.hospitalId, {
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

// ==================== USERS LIST ====================

/**
 * Get all users for the hospital (for assignment dropdowns)
 * Returns users that can be assigned to leads, tasks, etc.
 */
router.get(
  '/users',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const users = await rbacService.getHospitalUsers(req.user!.hospitalId);
    sendSuccess(res, users, 'Users retrieved successfully');
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
