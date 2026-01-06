import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { rbacService } from '../services/rbacService';
import { sendForbidden } from '../utils/response';

/**
 * Middleware to check if user has a specific permission
 * SUPER_ADMIN bypasses all permission checks
 */
export const requirePermission = (permission: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendForbidden(res, 'User not authenticated');
      return;
    }

    // SUPER_ADMIN bypasses all permission checks
    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    try {
      const hasPermission = await rbacService.hasPermission(req.user.userId, permission);
      if (!hasPermission) {
        sendForbidden(res, `Missing required permission: ${permission}`);
        return;
      }

      next();
    } catch (error) {
      sendForbidden(res, 'Failed to verify permissions');
    }
  };
};

/**
 * Middleware to check if user has any of the specified permissions
 * SUPER_ADMIN bypasses all permission checks
 */
export const requireAnyPermission = (...permissions: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendForbidden(res, 'User not authenticated');
      return;
    }

    // SUPER_ADMIN bypasses all permission checks
    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    try {
      const userPermissions = await rbacService.getUserPermissions(req.user.userId);
      const hasAnyPermission = permissions.some((p) => userPermissions.includes(p));

      if (!hasAnyPermission) {
        sendForbidden(res, `Missing required permissions. Need one of: ${permissions.join(', ')}`);
        return;
      }

      next();
    } catch (error) {
      sendForbidden(res, 'Failed to verify permissions');
    }
  };
};

/**
 * Middleware to check if user has all of the specified permissions
 * SUPER_ADMIN bypasses all permission checks
 */
export const requireAllPermissions = (...permissions: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendForbidden(res, 'User not authenticated');
      return;
    }

    // SUPER_ADMIN bypasses all permission checks
    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    try {
      const userPermissions = await rbacService.getUserPermissions(req.user.userId);
      const missingPermissions = permissions.filter((p) => !userPermissions.includes(p));

      if (missingPermissions.length > 0) {
        sendForbidden(res, `Missing required permissions: ${missingPermissions.join(', ')}`);
        return;
      }

      next();
    } catch (error) {
      sendForbidden(res, 'Failed to verify permissions');
    }
  };
};

/**
 * Middleware to attach user permissions to the request object
 * Useful for downstream handlers that need to check permissions
 */
export const attachPermissions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    next();
    return;
  }

  try {
    const permissions = await rbacService.getUserPermissions(req.user.userId);
    (req as any).permissions = permissions;
    next();
  } catch (error) {
    // Don't fail the request, just don't attach permissions
    next();
  }
};
