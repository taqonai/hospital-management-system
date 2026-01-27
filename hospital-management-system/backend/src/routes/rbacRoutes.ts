import { Router, Response } from 'express';
import { rbacService, PERMISSION_CATEGORIES, PERMISSION_DESCRIPTIONS, PERMISSIONS } from '../services/rbacService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { invalidatePermissions, invalidateAllPermissions } from '../services/permissionCacheService';
import prisma from '../config/database';

/**
 * Enrich a flat permission string into a Permission object with category/description.
 */
function enrichPermission(permStr: string): { id: string; name: string; code: string; description: string; category: string; isActive: boolean } {
  let category = 'other';
  for (const [cat, data] of Object.entries(PERMISSION_CATEGORIES)) {
    if ((data.permissions as string[]).includes(permStr)) {
      category = cat;
      break;
    }
  }
  const description = (PERMISSION_DESCRIPTIONS as Record<string, string>)[permStr] || permStr;
  // Convert code like "patients:read" to a readable name "Patients Read"
  const name = permStr.split(':').map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')).join(' ');
  return {
    id: permStr,
    name,
    code: permStr,
    description,
    category,
    isActive: true,
  };
}

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== PERMISSIONS ====================

/**
 * Get all available permissions (for UI display)
 * Returns the complete list of permissions as enriched objects with category/name/description
 */
router.get(
  '/permissions',
  authorizeWithPermission('rbac:roles:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Return ALL available permissions as enriched objects
    const allPermStrings = Object.values(PERMISSIONS) as string[];
    const permissions = allPermStrings.map(enrichPermission);
    sendSuccess(res, { permissions }, 'Permissions retrieved successfully');
  })
);

/**
 * Get all available permissions grouped by category with descriptions
 * Used by the RBAC admin UI for the Permission Matrix
 */
router.get(
  '/available-permissions',
  authorizeWithPermission('rbac:roles:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const categories = rbacService.getPermissionsByCategory();
    const defaultRolePermissions = rbacService.getDefaultRolePermissionsMap();
    sendSuccess(res, { categories, defaultRolePermissions }, 'Available permissions retrieved successfully');
  })
);

// ==================== ROLES ====================

/**
 * Create a new custom role
 * Accepts either 'permissions' or 'permissionIds' from frontend
 */
router.post(
  '/roles',
  authorizeWithPermission('rbac:roles:write', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { permissionIds, permissions, ...rest } = req.body;
    const role = await rbacService.createRole(req.user!.hospitalId, {
      ...rest,
      permissions: permissions || permissionIds || [],
      createdBy: req.user!.userId,
    });
    await invalidateAllPermissions();
    sendCreated(res, role, 'Role created successfully');
  })
);

/**
 * Get all roles for the hospital
 * Enriches flat permission strings into full Permission objects for the frontend
 */
router.get(
  '/roles',
  authorizeWithPermission('rbac:roles:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await rbacService.getRoles(req.user!.hospitalId, {
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });

    // Count users per system role
    const userCountsByRole = await prisma.user.groupBy({
      by: ['role'],
      where: { hospitalId: req.user!.hospitalId, isActive: true },
      _count: { role: true },
    });
    const roleCountMap: Record<string, number> = {};
    for (const entry of userCountsByRole) {
      roleCountMap[`system_${entry.role}`] = entry._count.role;
    }

    // For custom roles, count users with role: assignments
    const customRoleIds = result.roles.filter(r => !r.isSystem).map(r => r.id);
    if (customRoleIds.length > 0) {
      const customRoleCounts = await prisma.userPermission.groupBy({
        by: ['permission'],
        where: {
          permission: { in: customRoleIds.map(id => `role:${id}`) },
          user: { hospitalId: req.user!.hospitalId, isActive: true },
        },
        _count: { permission: true },
      });
      for (const entry of customRoleCounts) {
        const roleId = entry.permission.replace('role:', '');
        roleCountMap[roleId] = entry._count.permission;
      }
    }

    // Enrich permissions from strings to objects and add _count
    const enrichedRoles = result.roles.map(role => ({
      ...role,
      permissions: (role.permissions as string[]).map(enrichPermission),
      _count: {
        users: roleCountMap[role.id] || 0,
      },
    }));

    sendSuccess(res, { roles: enrichedRoles, pagination: result.pagination }, 'Roles retrieved successfully');
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
 * Accepts either 'permissions' or 'permissionIds' from frontend
 */
router.put(
  '/roles/:id',
  authorizeWithPermission('rbac:roles:write', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { permissionIds, permissions, ...rest } = req.body;
    const updateData = {
      ...rest,
      ...(permissions || permissionIds ? { permissions: permissions || permissionIds } : {}),
    };
    const role = await rbacService.updateRole(
      req.user!.hospitalId,
      req.params.id,
      updateData,
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
 * Assign role(s) to user.
 * Supports both single roleId and bulk roleIds array.
 * When roleIds is provided, it syncs: removes missing roles and adds new ones.
 */
router.post(
  '/users/:userId/roles',
  authorizeWithPermission('rbac:assign', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { roleId, roleIds } = req.body;
    const userId = req.params.userId;
    const assignedBy = req.user!.userId;

    if (roleIds && Array.isArray(roleIds)) {
      // Bulk sync: get current roles, remove stale, add new
      const currentRoles = await rbacService.getUserRoles(userId);
      const currentRoleIds = currentRoles.map((r: any) => r.id);

      // Remove roles no longer in the list
      for (const existingId of currentRoleIds) {
        if (!roleIds.includes(existingId)) {
          try {
            await rbacService.removeRoleFromUser(userId, existingId, assignedBy);
          } catch (e) { /* ignore if already removed */ }
        }
      }

      // Add new roles
      for (const newRoleId of roleIds) {
        if (!currentRoleIds.includes(newRoleId)) {
          try {
            await rbacService.assignRoleToUser(userId, newRoleId, assignedBy);
          } catch (e) { /* ignore duplicates */ }
        }
      }

      await invalidatePermissions(userId);
      sendSuccess(res, { success: true }, 'User roles updated successfully');
    } else if (roleId) {
      // Single assignment
      await rbacService.assignRoleToUser(userId, roleId, assignedBy);
      await invalidatePermissions(userId);
      sendCreated(res, { success: true }, 'Role assigned to user successfully');
    } else {
      res.status(400).json({ success: false, message: 'roleId or roleIds required' });
    }
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
 * Get user's effective permissions (enriched with metadata)
 */
router.get(
  '/users/:userId/effective-permissions',
  authorizeWithPermission('rbac:roles:read', ['HOSPITAL_ADMIN', 'SUPER_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const permStrings = await rbacService.getUserPermissions(req.params.userId);
    const permissions = permStrings.map(enrichPermission);
    sendSuccess(res, { permissions }, 'User effective permissions retrieved successfully');
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
 * Get all users for the hospital with their custom roles.
 * Returns users wrapped in { users: [...] } for the RBAC management page.
 */
router.get(
  '/users',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, role, page, limit } = req.query;
    const hospitalId = req.user!.hospitalId;

    // Build where clause
    const where: any = {
      hospitalId,
      isActive: true,
      role: { not: 'PATIENT' as any },
    };
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role as any;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        permissions: {
          where: { permission: { startsWith: 'role:' } },
          select: { permission: true },
        },
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });

    // Get hospital custom roles to resolve role IDs
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { settings: true },
    });
    const settings = (hospital?.settings as any) || {};
    const customRoles: any[] = settings.customRoles || [];
    const customRoleMap = new Map(customRoles.filter((r: any) => r.isActive).map((r: any) => [r.id, r]));

    // Enrich users with custom roles info
    const enrichedUsers = users.map(u => {
      const roleIds = u.permissions.map(p => p.permission.replace('role:', ''));
      const userCustomRoles = roleIds
        .map(id => customRoleMap.get(id))
        .filter(Boolean)
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          permissions: (r.permissions as string[]).map(enrichPermission),
        }));

      return {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: u.isActive,
        customRoles: userCustomRoles,
        createdAt: u.createdAt,
      };
    });

    sendSuccess(res, { users: enrichedUsers }, 'Users retrieved successfully');
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
