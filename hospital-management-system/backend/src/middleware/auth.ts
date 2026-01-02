import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { UserRole } from '@prisma/client';

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
