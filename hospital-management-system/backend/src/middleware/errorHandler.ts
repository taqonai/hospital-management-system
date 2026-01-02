import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { sendError, sendServerError } from '../utils/response';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  errors: any[];

  constructor(message: string = 'Validation failed', errors: any[] = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known operational errors
  if (err instanceof AppError) {
    if (err instanceof ValidationError) {
      sendError(res, err.message, err.statusCode, err.errors);
      return;
    }
    sendError(res, err.message, err.statusCode);
    return;
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        sendError(res, 'A record with this value already exists', 409);
        return;
      case 'P2025':
        sendError(res, 'Record not found', 404);
        return;
      case 'P2003':
        sendError(res, 'Foreign key constraint failed', 400);
        return;
      case 'P2014':
        sendError(res, 'The change you are trying to make would violate the required relation', 400);
        return;
      default:
        sendError(res, 'Database error occurred', 500);
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 'Invalid data provided', 400);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid token', 401);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Token expired', 401);
    return;
  }

  // Handle unexpected errors
  sendServerError(res, 'An unexpected error occurred');
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  sendError(res, `Route ${req.originalUrl} not found`, 404);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
