import { Router, Response } from 'express';
import { queueService } from '../services/queueService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== TICKET MANAGEMENT ====================

// Issue a new queue ticket
router.post(
  '/tickets',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const ticket = await queueService.issueTicket(req.user!.hospitalId, req.body);
    sendCreated(res, ticket, 'Queue ticket issued successfully');
  })
);

// Get current queue status
router.get(
  '/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { serviceType, departmentId } = req.query;
    const status = await queueService.getQueueStatus(
      req.user!.hospitalId,
      serviceType as string | undefined,
      departmentId as string | undefined
    );
    sendSuccess(res, status);
  })
);

// Get queue display data (for display boards)
router.get(
  '/display',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { boardId } = req.query;
    const display = await queueService.getQueueDisplay(
      req.user!.hospitalId,
      boardId as string | undefined
    );
    sendSuccess(res, display);
  })
);

// Public endpoint for queue display (kiosk/TV screens)
router.get(
  '/public/display/:hospitalId',
  asyncHandler(async (req, res: Response) => {
    const { hospitalId } = req.params;
    const { boardId } = req.query;
    const display = await queueService.getQueueDisplay(hospitalId, boardId as string | undefined);
    sendSuccess(res, display);
  })
);

// Get patient ticket status
router.get(
  '/tickets/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ticketId, phone } = req.query;
    const status = await queueService.getPatientTicketStatus(
      req.user!.hospitalId,
      ticketId as string | undefined,
      phone as string | undefined
    );
    sendSuccess(res, status);
  })
);

// Public endpoint for patient to check their ticket status
router.get(
  '/public/ticket-status/:hospitalId',
  asyncHandler(async (req, res: Response) => {
    const { hospitalId } = req.params;
    const { ticketId, phone } = req.query;
    const status = await queueService.getPatientTicketStatus(
      hospitalId,
      ticketId as string | undefined,
      phone as string | undefined
    );
    sendSuccess(res, status);
  })
);

// Call next patient
router.post(
  '/call-next',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { counterId } = req.body;
    const ticket = await queueService.callNext(req.user!.hospitalId, {
      counterId,
      staffId: req.user!.userId,
    });
    if (ticket) {
      sendSuccess(res, ticket, 'Next patient called');
    } else {
      sendSuccess(res, null, 'No patients waiting in queue');
    }
  })
);

// Start serving a patient
router.post(
  '/tickets/:ticketId/start-serving',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const ticket = await queueService.startServing(
      req.user!.hospitalId,
      req.params.ticketId,
      req.user!.userId
    );
    sendSuccess(res, ticket, 'Started serving patient');
  })
);

// Complete a ticket
router.post(
  '/tickets/:ticketId/complete',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const ticket = await queueService.completeTicket(
      req.user!.hospitalId,
      req.params.ticketId
    );
    sendSuccess(res, ticket, 'Ticket completed');
  })
);

// Mark as no-show
router.post(
  '/tickets/:ticketId/no-show',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const ticket = await queueService.markNoShow(
      req.user!.hospitalId,
      req.params.ticketId
    );
    sendSuccess(res, ticket, 'Marked as no-show');
  })
);

// Cancel ticket
router.post(
  '/tickets/:ticketId/cancel',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const ticket = await queueService.cancelTicket(
      req.user!.hospitalId,
      req.params.ticketId,
      reason
    );
    sendSuccess(res, ticket, 'Ticket cancelled');
  })
);

// Transfer ticket to another counter
router.post(
  '/tickets/:ticketId/transfer',
  authenticate,
  authorize('RECEPTIONIST', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { newCounterId } = req.body;
    const ticket = await queueService.transferTicket(
      req.user!.hospitalId,
      req.params.ticketId,
      newCounterId
    );
    sendSuccess(res, ticket, 'Ticket transferred');
  })
);

// ==================== COUNTER MANAGEMENT ====================

// Create a counter
router.post(
  '/counters',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const counter = await queueService.createCounter(req.user!.hospitalId, req.body);
    sendCreated(res, counter, 'Counter created');
  })
);

// Get all counters
router.get(
  '/counters',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { counterType, isActive } = req.query;
    const counters = await queueService.getCounters(req.user!.hospitalId, {
      counterType: counterType as string | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
    sendSuccess(res, counters);
  })
);

// Update counter
router.patch(
  '/counters/:counterId',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const counter = await queueService.updateCounter(req.params.counterId, req.body);
    sendSuccess(res, counter, 'Counter updated');
  })
);

// ==================== QUEUE CONFIG ====================

// Get queue config
router.get(
  '/config/:serviceType',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const config = await queueService.getQueueConfig(
      req.user!.hospitalId,
      req.params.serviceType
    );
    sendSuccess(res, config);
  })
);

// Upsert queue config
router.put(
  '/config',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const config = await queueService.upsertQueueConfig(req.user!.hospitalId, req.body);
    sendSuccess(res, config, 'Queue config saved');
  })
);

// ==================== DISPLAY BOARDS ====================

// Create display board
router.post(
  '/display-boards',
  authenticate,
  authorize('HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const board = await queueService.createDisplayBoard(req.user!.hospitalId, req.body);
    sendCreated(res, board, 'Display board created');
  })
);

// Get display boards
router.get(
  '/display-boards',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const boards = await queueService.getDisplayBoards(req.user!.hospitalId);
    sendSuccess(res, boards);
  })
);

// ==================== ANALYTICS ====================

// Get queue analytics
router.get(
  '/analytics',
  authenticate,
  authorize('HOSPITAL_ADMIN', 'DOCTOR'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { dateFrom, dateTo, serviceType, departmentId } = req.query;
    const analytics = await queueService.getAnalytics(req.user!.hospitalId, {
      dateFrom: dateFrom ? new Date(dateFrom as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      dateTo: dateTo ? new Date(dateTo as string) : new Date(),
      serviceType: serviceType as string | undefined,
      departmentId: departmentId as string | undefined,
    });
    sendSuccess(res, analytics);
  })
);

// ==================== ANNOUNCEMENTS ====================

// Get pending announcements
router.get(
  '/announcements/pending',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const announcements = await queueService.getPendingAnnouncements(req.user!.hospitalId);
    sendSuccess(res, announcements);
  })
);

// Public endpoint for announcements (display boards)
router.get(
  '/public/announcements/:hospitalId',
  asyncHandler(async (req, res: Response) => {
    const announcements = await queueService.getPendingAnnouncements(req.params.hospitalId);
    sendSuccess(res, announcements);
  })
);

// Mark announcement as played
router.post(
  '/announcements/:announcementId/played',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const announcement = await queueService.markAnnouncementPlayed(req.params.announcementId);
    sendSuccess(res, announcement, 'Announcement marked as played');
  })
);

export default router;
