import { Router, Response } from 'express';
import { slotService } from '../services/slotService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler, ValidationError } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const validateUUID = (id: string, field: string) => {
  if (!UUID_REGEX.test(id)) {
    throw new ValidationError(`Invalid ${field} format`);
  }
};

const validateDate = (date: string, field: string) => {
  if (!DATE_REGEX.test(date)) {
    throw new ValidationError(`Invalid ${field} format. Use YYYY-MM-DD`);
  }
};

// Get all available slots for a doctor (future slots only)
router.get(
  '/doctor/:doctorId',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    validateUUID(req.params.doctorId, 'doctorId');

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
    validateUUID(req.params.doctorId, 'doctorId');
    validateDate(req.params.date, 'date');

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
    validateUUID(req.params.doctorId, 'doctorId');

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      throw new ValidationError('startDate and endDate query parameters are required');
    }
    validateDate(startDate as string, 'startDate');
    validateDate(endDate as string, 'endDate');

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
    validateUUID(req.params.doctorId, 'doctorId');

    const { daysAhead = 30 } = req.body;

    // Validate daysAhead
    const days = Number(daysAhead);
    if (isNaN(days) || days < 1 || days > 90) {
      throw new ValidationError('daysAhead must be between 1 and 90');
    }

    const count = await slotService.generateSlotsForDoctor(
      req.params.doctorId,
      req.user!.hospitalId,
      days
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
    validateUUID(req.params.doctorId, 'doctorId');

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
    validateUUID(req.params.slotId, 'slotId');

    const { isBlocked } = req.body;
    if (typeof isBlocked !== 'boolean') {
      throw new ValidationError('isBlocked must be a boolean');
    }

    const slot = await slotService.toggleBlockSlot(
      req.params.slotId,
      req.user!.hospitalId,
      isBlocked
    );
    sendSuccess(res, slot, isBlocked ? 'Slot blocked' : 'Slot unblocked');
  })
);

export default router;
