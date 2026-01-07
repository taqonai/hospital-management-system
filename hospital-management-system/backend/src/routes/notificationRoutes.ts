import { Router, Response } from 'express';
import { notificationService } from '../services/notificationService';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { NotificationType } from '@prisma/client';

const router = Router();

// =============================================================================
// Notification Routes (All routes require authentication)
// =============================================================================

/**
 * Get user's notifications (paginated)
 * GET /api/v1/notifications
 * Query params: page, limit, unreadOnly, type
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || '';
    const { page, limit, unreadOnly, type } = req.query;

    const result = await notificationService.getUserNotifications(userId, {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      unreadOnly: unreadOnly === 'true',
      type: type as NotificationType | undefined,
    });

    sendSuccess(res, {
      data: result.notifications,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
      unreadCount: result.unreadCount,
    }, 'Notifications retrieved successfully');
  })
);

/**
 * Get count of unread notifications
 * GET /api/v1/notifications/unread-count
 */
router.get(
  '/unread-count',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || '';

    const result = await notificationService.getUserNotifications(userId, {
      page: 1,
      limit: 1,
    });

    sendSuccess(res, { unreadCount: result.unreadCount }, 'Unread count retrieved successfully');
  })
);

/**
 * Get notification preferences
 * GET /api/v1/notifications/preferences
 */
router.get(
  '/preferences',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || '';

    const preferences = await notificationService.getUserPreferences(userId);

    sendSuccess(res, preferences, 'Notification preferences retrieved successfully');
  })
);

/**
 * Update notification preferences
 * PUT /api/v1/notifications/preferences
 */
router.put(
  '/preferences',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || '';
    const { email, sms, whatsapp, inApp, quietHoursStart, quietHoursEnd, enabledTypes } = req.body;

    const preferences = await notificationService.updateUserPreferences(userId, {
      email,
      sms,
      whatsapp,
      inApp,
      quietHoursStart,
      quietHoursEnd,
      enabledTypes,
    });

    sendSuccess(res, preferences, 'Notification preferences updated successfully');
  })
);

/**
 * Mark all notifications as read
 * PUT /api/v1/notifications/read-all
 */
router.put(
  '/read-all',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || '';

    const result = await notificationService.markAllNotificationsRead(userId);

    sendSuccess(res, result, 'All notifications marked as read');
  })
);

/**
 * Mark single notification as read
 * PUT /api/v1/notifications/:id/read
 */
router.put(
  '/:id/read',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || '';
    const notificationId = req.params.id;

    const notification = await notificationService.markNotificationRead(notificationId, userId);

    sendSuccess(res, notification, 'Notification marked as read');
  })
);

/**
 * Delete a notification
 * DELETE /api/v1/notifications/:id
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId || '';
    const notificationId = req.params.id;

    await notificationService.deleteNotification(notificationId, userId);

    sendSuccess(res, null, 'Notification deleted successfully');
  })
);

export default router;
