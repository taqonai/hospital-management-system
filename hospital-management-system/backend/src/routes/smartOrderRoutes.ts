import { Router, Request, Response } from 'express';
import { smartOrderService } from '../services/smartOrderService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ============= Health Check =============

/**
 * Check Smart Order AI service health
 * GET /api/smart-orders/health
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await smartOrderService.checkHealth();
    sendSuccess(res, health, 'Smart Order AI service health check');
  })
);

// ============= Order Recommendations =============

/**
 * Get AI-powered order recommendations for a diagnosis
 * POST /api/smart-orders/recommend
 * Body: {
 *   diagnosis: string,
 *   icdCode?: string,
 *   symptoms?: string[],
 *   patientId?: string,
 *   patientContext?: {
 *     age?: number,
 *     weight?: number,
 *     gender?: string,
 *     allergies?: string[],
 *     currentMedications?: string[],
 *     renalFunction?: string,
 *     hepaticFunction?: string,
 *     pregnancyStatus?: string,
 *     comorbidities?: string[],
 *   },
 *   includeAlternatives?: boolean
 * }
 */
router.post(
  '/recommend',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { diagnosis, icdCode, symptoms, patientId, patientContext, includeAlternatives } = req.body;

    if (!diagnosis) {
      return res.status(400).json({ success: false, message: 'Diagnosis is required' });
    }

    const recommendations = await smartOrderService.getRecommendations(
      {
        diagnosis,
        icdCode,
        symptoms,
        patientContext,
        includeAlternatives,
      },
      patientId
    );

    sendSuccess(res, recommendations, 'Order recommendations generated successfully');
  })
);

// ============= Order Bundles =============

/**
 * Get all available order bundles
 * GET /api/smart-orders/bundles
 */
router.get(
  '/bundles',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const bundles = await smartOrderService.getBundles();
    sendSuccess(res, bundles, 'Order bundles retrieved successfully');
  })
);

/**
 * Get details of a specific bundle
 * GET /api/smart-orders/bundle/:id
 */
router.get(
  '/bundle/:id',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const bundle = await smartOrderService.getBundleDetails(id);
    sendSuccess(res, bundle, 'Bundle details retrieved successfully');
  })
);

// ============= Order Customization =============

/**
 * Customize orders for a specific patient
 * POST /api/smart-orders/customize
 * Body: {
 *   bundleId?: string,
 *   selectedOrders: Array<{
 *     id: string,
 *     name: string,
 *     category: string,
 *     urgency?: string,
 *   }>,
 *   patientId?: string,
 *   patientContext: {
 *     age?: number,
 *     weight?: number,
 *     gender?: string,
 *     allergies?: string[],
 *     currentMedications?: string[],
 *     renalFunction?: string,
 *     hepaticFunction?: string,
 *     pregnancyStatus?: string,
 *     comorbidities?: string[],
 *   },
 *   customizations?: Record<string, any>
 * }
 */
router.post(
  '/customize',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { bundleId, selectedOrders, patientId, patientContext, customizations } = req.body;

    if (!selectedOrders || !Array.isArray(selectedOrders) || selectedOrders.length === 0) {
      return res.status(400).json({ success: false, message: 'Selected orders are required' });
    }

    if (!patientContext) {
      return res.status(400).json({ success: false, message: 'Patient context is required' });
    }

    const result = await smartOrderService.customizeBundle(
      {
        bundleId,
        selectedOrders,
        patientContext,
        customizations,
      },
      patientId
    );

    sendSuccess(res, result, 'Orders customized successfully');
  })
);

// ============= Order Placement =============

/**
 * Place selected orders
 * POST /api/smart-orders/place
 * Body: {
 *   patientId: string,
 *   orders: Array<{
 *     id: string,
 *     name: string,
 *     category: string,
 *     urgency: string,
 *     dosing?: any,
 *   }>,
 *   providerId: string,
 *   notes?: string
 * }
 */
router.post(
  '/place',
  authenticate,
  authorize('DOCTOR', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId, orders, notes } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ success: false, message: 'Orders are required' });
    }

    const providerId = req.user?.userId || 'unknown';

    const result = await smartOrderService.placeOrders({
      patientId,
      orders,
      providerId,
      notes,
    });

    sendSuccess(res, result, 'Orders placed successfully');
  })
);

// ============= Order History =============

/**
 * Get patient's order history
 * GET /api/smart-orders/history/:patientId
 */
router.get(
  '/history/:patientId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;
    const history = await smartOrderService.getOrderHistory(patientId);
    sendSuccess(res, history, 'Order history retrieved successfully');
  })
);

// ============= Drug Interactions =============

/**
 * Check drug interactions
 * POST /api/smart-orders/check-interactions
 * Body: {
 *   medications: string[]
 * }
 */
router.post(
  '/check-interactions',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'PHARMACIST', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { medications } = req.body;

    if (!medications || !Array.isArray(medications) || medications.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 medications are required to check interactions',
      });
    }

    const result = await smartOrderService.checkInteractions(medications);
    sendSuccess(res, result, 'Drug interactions checked successfully');
  })
);

export default router;
