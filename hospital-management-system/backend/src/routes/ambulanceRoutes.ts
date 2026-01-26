import { Router, Response } from 'express';
import { ambulanceService } from '../services/ambulanceService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== AMBULANCE FLEET MANAGEMENT ====================

// Add ambulance
router.post(
  '/',
  authenticate,
  authorizeWithPermission('ambulance:write', ['HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const ambulance = await ambulanceService.addAmbulance(req.user!.hospitalId, req.body);
    sendCreated(res, ambulance, 'Ambulance added successfully');
  })
);

// Get ambulances
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await ambulanceService.getAmbulances(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.ambulances, pagination);
  })
);

// Get ambulance by ID
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const ambulance = await ambulanceService.getAmbulanceById(req.params.id);
    sendSuccess(res, ambulance);
  })
);

// Update ambulance status
router.patch(
  '/:id/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const ambulance = await ambulanceService.updateAmbulanceStatus(req.params.id, status);
    sendSuccess(res, ambulance, 'Status updated');
  })
);

// Update ambulance location
router.patch(
  '/:id/location',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { latitude, longitude } = req.body;
    const ambulance = await ambulanceService.updateAmbulanceLocation(req.params.id, latitude, longitude);
    sendSuccess(res, ambulance, 'Location updated');
  })
);

// ==================== TRIP MANAGEMENT ====================

// Create trip request
router.post(
  '/trips',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const trip = await ambulanceService.createTrip(req.user!.hospitalId, {
      ...req.body,
      requestedBy: req.user!.userId,
    });
    sendCreated(res, trip, 'Trip request created');
  })
);

// Get trips
router.get(
  '/trips',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await ambulanceService.getTrips(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.trips, pagination);
  })
);

// Get trip by ID
router.get(
  '/trips/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const trip = await ambulanceService.getTripById(req.params.id);
    sendSuccess(res, trip);
  })
);

// Dispatch ambulance
router.post(
  '/trips/:id/dispatch',
  authenticate,
  authorizeWithPermission('ambulance:write', ['HOSPITAL_ADMIN', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ambulanceId, driverId, paramedicId, estimatedArrival } = req.body;
    const trip = await ambulanceService.dispatchAmbulance(req.params.id, {
      ambulanceId,
      driverId,
      paramedicId,
      estimatedArrival: new Date(estimatedArrival),
    });
    sendSuccess(res, trip, 'Ambulance dispatched');
  })
);

// Update trip status
router.patch(
  '/trips/:id/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status, notes, location } = req.body;
    const trip = await ambulanceService.updateTripStatus(req.params.id, status, { notes, location });
    sendSuccess(res, trip, 'Trip status updated');
  })
);

// Complete trip
router.patch(
  '/trips/:id/complete',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const trip = await ambulanceService.completeTrip(req.params.id, req.body);
    sendSuccess(res, trip, 'Trip completed');
  })
);

// Cancel trip
router.patch(
  '/trips/:id/cancel',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const trip = await ambulanceService.cancelTrip(req.params.id, reason);
    sendSuccess(res, trip, 'Trip cancelled');
  })
);

// ==================== AI FEATURES ====================

// AI: Get optimal ambulance
router.post(
  '/ai/optimal-ambulance',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await ambulanceService.getOptimalAmbulance(req.user!.hospitalId, req.body);
    sendSuccess(res, result);
  })
);

// AI: Optimize dispatch
router.post(
  '/ai/optimize-dispatch',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await ambulanceService.optimizeDispatch(req.user!.hospitalId, req.body);
    sendSuccess(res, result);
  })
);

// AI: Predict response time
router.post(
  '/ai/predict-response',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const prediction = ambulanceService.predictResponseTime(req.body);
    sendSuccess(res, prediction);
  })
);

// ==================== DASHBOARD ====================

// Get ambulance dashboard stats
router.get(
  '/stats/dashboard',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await ambulanceService.getDashboardStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

export default router;
