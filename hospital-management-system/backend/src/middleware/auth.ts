import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { UserRole } from '@prisma/client';
import { getCachedPermissions } from '../services/permissionCacheService';

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendUnauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendUnauthorized(res, 'Token expired');
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      sendUnauthorized(res, 'Invalid token');
      return;
    }
    sendUnauthorized(res, 'Authentication failed');
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'User not authenticated');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendForbidden(res, 'You do not have permission to perform this action');
      return;
    }

    next();
  };
};

export const authorizeHospital = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const hospitalId = req.params.hospitalId || req.body.hospitalId;

  if (!req.user) {
    sendUnauthorized(res, 'User not authenticated');
    return;
  }

  if (req.user.role === 'SUPER_ADMIN') {
    next();
    return;
  }

  if (hospitalId && req.user.hospitalId !== hospitalId) {
    sendForbidden(res, 'Access denied to this hospital');
    return;
  }

  next();
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.user = decoded;
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Hybrid authorization middleware.
 * - In 'legacy' mode: checks role name (same as current authorize())
 * - In 'dynamic' mode: checks permission via rbacService + Redis cache
 * - In 'hybrid' mode: checks permission first, falls back to role check on error
 *
 * SUPER_ADMIN always passes regardless of mode.
 *
 * Usage: authorizeWithPermission('appointments:read', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'])
 */
export const authorizeWithPermission = (permission: string, legacyRoles: UserRole[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendUnauthorized(res, 'User not authenticated');
      return;
    }

    // SUPER_ADMIN always passes
    if (req.user.role === 'SUPER_ADMIN') {
      next();
      return;
    }

    const mode = config.rbac.mode;

    // Legacy mode: just check role
    if (mode === 'legacy') {
      if (!legacyRoles.includes(req.user.role)) {
        sendForbidden(res, 'You do not have permission to perform this action');
        return;
      }
      next();
      return;
    }

    // Dynamic mode: check permission only
    if (mode === 'dynamic') {
      try {
        const permissions = await getCachedPermissions(req.user.userId);
        if (permissions && permissions.includes(permission)) {
          next();
          return;
        }
        sendForbidden(res, `Missing required permission: ${permission}`);
        return;
      } catch (error) {
        sendForbidden(res, 'Failed to verify permissions');
        return;
      }
    }

    // Hybrid mode (default): try permission check, fall back to role check
    try {
      const permissions = await getCachedPermissions(req.user.userId);
      if (permissions && permissions.includes(permission)) {
        next();
        return;
      }
      // Permission check says no — but check if it's a real denial or a data issue
      if (permissions !== null) {
        // We got a valid permission list and the permission is missing
        // Still fall back to legacy roles for safety during transition
        if (legacyRoles.includes(req.user.role)) {
          next();
          return;
        }
        sendForbidden(res, 'You do not have permission to perform this action');
        return;
      }
      // permissions is null — cache/DB failure, fall back to role check
      if (legacyRoles.includes(req.user.role)) {
        next();
        return;
      }
      sendForbidden(res, 'You do not have permission to perform this action');
      return;
    } catch (error) {
      // Error in permission check — fall back to legacy role check
      if (legacyRoles.includes(req.user.role)) {
        next();
        return;
      }
      sendForbidden(res, 'You do not have permission to perform this action');
      return;
    }
  };
};
