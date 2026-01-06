import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { sendUnauthorized } from '../utils/response';

/**
 * JWT payload for patient authentication tokens
 * Distinguished from staff tokens by `type: 'patient'`
 */
export interface PatientJwtPayload {
  patientId: string;
  hospitalId: string;
  email: string;
  mobile: string;
  type: 'patient';
}

/**
 * Extended Request interface with patient authentication info
 */
export interface PatientAuthenticatedRequest extends Request {
  patient?: PatientJwtPayload;
}

/**
 * Middleware to authenticate patient JWT tokens
 * Only accepts tokens with `type: 'patient'` in the payload
 */
export const patientAuthenticate = (
  req: PatientAuthenticatedRequest,
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

    const decoded = jwt.verify(token, config.jwt.secret) as PatientJwtPayload;

    // Verify this is a patient token
    if (decoded.type !== 'patient') {
      sendUnauthorized(res, 'Invalid patient token');
      return;
    }

    req.patient = decoded;
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

/**
 * Optional patient authentication middleware
 * Does not fail if no token is provided, but validates if present
 */
export const optionalPatientAuth = (
  req: PatientAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret) as PatientJwtPayload;

      // Only set patient if it's a patient token
      if (decoded.type === 'patient') {
        req.patient = decoded;
      }
    }

    next();
  } catch (error) {
    // Ignore errors and continue without authentication
    next();
  }
};
