import { Router, Response } from 'express';
import { aiSettingsService } from '../services/aiSettingsService';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);

/**
 * Get AI provider settings for the hospital
 */
router.get(
  '/settings',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const settings = await aiSettingsService.getSettings(req.user!.hospitalId);
    sendSuccess(res, settings, 'AI settings retrieved successfully');
  })
);

/**
 * Update AI provider settings
 */
router.put(
  '/settings',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const settings = await aiSettingsService.updateSettings(
      req.user!.hospitalId,
      req.body,
      req.user!.userId
    );
    sendSuccess(res, settings, 'AI settings updated successfully');
  })
);

/**
 * Fetch available models from Ollama endpoint
 */
router.get(
  '/ollama/models',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { endpoint } = req.query;

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Ollama endpoint URL is required'
      });
    }

    const models = await aiSettingsService.fetchOllamaModels(endpoint);
    sendSuccess(res, models, 'Ollama models retrieved successfully');
  })
);

/**
 * Check Ollama endpoint health
 */
router.get(
  '/ollama/health',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { endpoint } = req.query;

    if (!endpoint || typeof endpoint !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Ollama endpoint URL is required'
      });
    }

    const health = await aiSettingsService.checkOllamaHealth(endpoint);
    sendSuccess(res, health, 'Ollama health check completed');
  })
);

/**
 * Test Ollama completion with a specific model
 */
router.post(
  '/ollama/test',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { endpoint, model } = req.body;

    if (!endpoint || !model) {
      return res.status(400).json({
        success: false,
        error: 'Ollama endpoint and model are required'
      });
    }

    const result = await aiSettingsService.testOllamaCompletion(endpoint, model);
    sendSuccess(res, result, 'Ollama test completed');
  })
);

/**
 * Get provider status (current configuration)
 */
router.get(
  '/provider/status',
  authorize('HOSPITAL_ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const status = await aiSettingsService.getProviderStatus(req.user!.hospitalId);
    sendSuccess(res, status, 'Provider status retrieved successfully');
  })
);

export default router;
