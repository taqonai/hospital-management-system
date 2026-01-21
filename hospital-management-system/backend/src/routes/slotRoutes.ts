import { Router, Response } from 'express';
import { slotService } from '../services/slotService';
import { authenticate, authorize } from '../middleware/auth';
import { validate, uuidParamSchema } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Get all available slots for a doctor (future slots only)
router.get(
  '/doctor/:doctorId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const slots = await slotService.getAvailableSlotsForDoctor(
      req.params.doctorId,
      req.user!.hospitalId
    );
    sendSuccess(res, slots);
  })
);

// Get available slots for a specific date
router.get(
  '/doctor/:doctorId/date/:date',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const slots = await slotService.getAvailableSlotsByDate(
      req.params.doctorId,
      req.params.date,
      req.user!.hospitalId
    );
    sendSuccess(res, slots);
  })
);

// Get slots by date range (for calendar view)
router.get(
  '/doctor/:doctorId/range',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate } = req.query;
    const slots = await slotService.getSlotsByDateRange(
      req.params.doctorId,
      req.user!.hospitalId,
      startDate as string,
      endDate as string
    );
    sendSuccess(res, slots);
  })
);

// Manually generate/regenerate slots for a doctor (Admin only)
router.post(
  '/generate/:doctorId',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { daysAhead = 30 } = req.body;
    const count = await slotService.generateSlotsForDoctor(
      req.params.doctorId,
      req.user!.hospitalId,
      daysAhead
    );
    sendCreated(res, { slotsGenerated: count }, `Generated ${count} slots`);
  })
);

// Regenerate slots (delete unbooked future slots and recreate)
router.post(
  '/regenerate/:doctorId',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await slotService.regenerateSlots(
      req.params.doctorId,
      req.user!.hospitalId
    );
    sendSuccess(res, { slotsGenerated: count }, `Regenerated ${count} slots`);
  })
);

// Block/unblock a slot (Doctor or Admin)
router.patch(
  '/:slotId/block',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { isBlocked } = req.body;
    const slot = await slotService.toggleBlockSlot(
      req.params.slotId,
      req.user!.hospitalId,
      isBlocked
    );
    sendSuccess(res, slot, isBlocked ? 'Slot blocked' : 'Slot unblocked');
  })
);

export default router;
