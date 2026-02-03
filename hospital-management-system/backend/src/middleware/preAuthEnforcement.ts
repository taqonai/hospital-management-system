/**
 * Pre-Authorization Enforcement Middleware
 * 
 * Verifies that required pre-authorization exists before allowing
 * high-cost orders (imaging, surgery, etc.) to be created.
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';
import logger from '../utils/logger';

interface PreAuthCheckData {
  patientId: string;
  cptCode?: string;
  estimatedCost?: number;
  procedureType?: 'IMAGING' | 'SURGERY' | 'LAB' | 'PROCEDURE';
}

/**
 * Check if a procedure requires pre-authorization
 */
export async function checkPreAuthRequirement(
  hospitalId: string,
  cptCode: string,
  payerId?: string
): Promise<{ required: boolean; reason?: string }> {
  // Check global CPT requirement
  const cpt = await prisma.cPTCode.findFirst({
    where: {
      hospitalId,
      code: cptCode,
      isActive: true,
    },
  });

  if (!cpt) {
    return { required: false };
  }

  // Check if CPT globally requires pre-auth
  if (cpt.requiresPreAuth) {
    return {
      required: true,
      reason: 'Procedure requires pre-authorization per hospital policy',
    };
  }

  // Check payer-specific rules
  if (payerId) {
    const payerRule = await prisma.cPTPayerRule.findFirst({
      where: {
        cptCode: { code: cptCode } as any,
        payerId,
        isActive: true,
        requiresPreAuth: true,
      },
    });

    if (payerRule) {
      return {
        required: true,
        reason: 'Procedure requires pre-authorization per payer policy',
      };
    }
  }

  return { required: false };
}

/**
 * Verify that valid pre-authorization exists
 */
export async function verifyPreAuthExists(
  hospitalId: string,
  patientId: string,
  cptCode: string
): Promise<{ exists: boolean; preAuthNumber?: string; error?: string }> {
  // Look for approved pre-auth that is still valid
  const preAuth = await prisma.preAuthRequest.findFirst({
    where: {
      hospitalId,
      patientId,
      procedureCPTCode: cptCode,
      status: 'APPROVED',
      approvedFrom: { lte: new Date() },
      OR: [
        { approvedTo: { gte: new Date() } },
        { approvedTo: null },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (preAuth) {
    return {
      exists: true,
      preAuthNumber: preAuth.requestNumber,
    };
  }

  return {
    exists: false,
    error: 'No valid pre-authorization found for this procedure',
  };
}

/**
 * Express middleware: Enforce pre-auth for radiology orders
 */
export async function enforcePreAuthForRadiology(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const hospitalId = (req as any).user?.hospitalId;
    const { patientId, procedureCode, estimatedCost } = req.body;

    if (!hospitalId) {
      return next(new AppError('Hospital ID not found', 400));
    }

    // Get patient's insurance
    const insurance = await prisma.patientInsurance.findFirst({
      where: {
        patientId,
        isPrimary: true,
        isActive: true,
      },
    });

    if (!insurance) {
      // No insurance, no pre-auth needed
      return next();
    }

    // Check if procedure requires pre-auth
    const requirement = await checkPreAuthRequirement(
      hospitalId,
      procedureCode,
      (insurance as any).payerId || undefined
    );

    if (!requirement.required) {
      return next();
    }

    // Verify pre-auth exists
    const verification = await verifyPreAuthExists(hospitalId, patientId, procedureCode);

    if (!verification.exists) {
      logger.warn('[PRE-AUTH] Radiology order blocked - no pre-auth:', {
        patientId,
        procedureCode,
      });
      return next(
        new AppError(
          `Pre-authorization required for this procedure. ${verification.error}`,
          403
        )
      );
    }

    // Attach pre-auth number to request for reference
    req.body.preAuthNumber = verification.preAuthNumber;
    
    logger.info('[PRE-AUTH] Radiology order approved with pre-auth:', verification.preAuthNumber);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Express middleware: Enforce pre-auth for surgery orders
 */
export async function enforcePreAuthForSurgery(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const hospitalId = (req as any).user?.hospitalId;
    const { patientId, procedureCode, surgeryType } = req.body;

    if (!hospitalId) {
      return next(new AppError('Hospital ID not found', 400));
    }

    // Get patient's insurance
    const insurance = await prisma.patientInsurance.findFirst({
      where: {
        patientId,
        isPrimary: true,
        isActive: true,
      },
    });

    if (!insurance) {
      // No insurance, no pre-auth needed
      return next();
    }

    // Surgeries typically always require pre-auth unless marked as emergency
    const isEmergency = req.body.urgency === 'EMERGENCY';
    
    if (isEmergency) {
      logger.info('[PRE-AUTH] Emergency surgery - pre-auth bypass:', { patientId, procedureCode });
      return next();
    }

    // Check if procedure requires pre-auth
    const requirement = await checkPreAuthRequirement(
      hospitalId,
      procedureCode,
      (insurance as any).payerId || undefined
    );

    if (!requirement.required) {
      // Even if not required by rules, surgeries should have pre-auth
      logger.warn('[PRE-AUTH] Surgery without pre-auth requirement:', procedureCode);
    }

    // Verify pre-auth exists
    const verification = await verifyPreAuthExists(hospitalId, patientId, procedureCode);

    if (!verification.exists) {
      logger.warn('[PRE-AUTH] Surgery order blocked - no pre-auth:', {
        patientId,
        procedureCode,
        surgeryType,
      });
      return next(
        new AppError(
          `Pre-authorization required for surgery. ${verification.error}`,
          403
        )
      );
    }

    // Attach pre-auth number to request
    req.body.preAuthNumber = verification.preAuthNumber;
    
    logger.info('[PRE-AUTH] Surgery order approved with pre-auth:', verification.preAuthNumber);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Generic pre-auth enforcement function
 * Can be used for any procedure type
 */
export async function enforcePreAuth(
  hospitalId: string,
  data: PreAuthCheckData
): Promise<{ allowed: boolean; reason?: string; preAuthNumber?: string }> {
  const { patientId, cptCode, estimatedCost } = data;

  if (!cptCode) {
    // No CPT code provided, can't check requirement
    return { allowed: true };
  }

  // Get patient's insurance
  const insurance = await prisma.patientInsurance.findFirst({
    where: {
      patientId,
      isPrimary: true,
      isActive: true,
    },
  });

  if (!insurance) {
    // No insurance, allow
    return { allowed: true, reason: 'No insurance coverage' };
  }

  // Check if procedure requires pre-auth
  const requirement = await checkPreAuthRequirement(
    hospitalId,
    cptCode,
    (insurance as any).payerId || undefined
  );

  if (!requirement.required) {
    return { allowed: true, reason: 'Pre-authorization not required' };
  }

  // Verify pre-auth exists
  const verification = await verifyPreAuthExists(hospitalId, patientId, cptCode);

  if (!verification.exists) {
    return {
      allowed: false,
      reason: verification.error || 'Pre-authorization required but not found',
    };
  }

  return {
    allowed: true,
    preAuthNumber: verification.preAuthNumber,
    reason: 'Pre-authorization verified',
  };
}
