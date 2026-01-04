import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();
const router = Router();

// Get all departments
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const departments = await prisma.department.findMany({
      where: { hospitalId: req.user!.hospitalId },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, departments);
  })
);

// Get department by ID
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const department = await prisma.department.findFirst({
      where: {
        id: req.params.id,
        hospitalId: req.user!.hospitalId,
      },
    });
    sendSuccess(res, department);
  })
);

export default router;
