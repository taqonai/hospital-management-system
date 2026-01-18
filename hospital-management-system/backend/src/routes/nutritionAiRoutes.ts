import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import axios from 'axios';

const router = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// =============================================================================
// REQUEST VALIDATION SCHEMAS
// =============================================================================

const analyzeMealSchema = z.object({
  body: z.object({
    imageBase64: z.string().min(1, 'Image data is required'),
    mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).optional(),
  }),
});

const searchFoodsSchema = z.object({
  body: z.object({
    query: z.string().min(1, 'Search query is required'),
    includeRegional: z.boolean().optional().default(true),
    limit: z.number().min(1).max(50).optional().default(20),
  }),
});

const estimatePortionSchema = z.object({
  body: z.object({
    foodId: z.string().min(1, 'Food ID is required'),
    portionSize: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE']),
  }),
});

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /api/v1/nutrition-ai/analyze
 * Analyze a meal photo using GPT-4 Vision
 */
router.post(
  '/analyze',
  patientAuthenticate,
  validate(analyzeMealSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { imageBase64, mealType } = req.body;

    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/api/nutrition/analyze-image`,
        {
          image_base64: imageBase64,
          meal_type: mealType || null,
        },
        {
          timeout: 60000, // 60 second timeout for image analysis
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      sendSuccess(res, response.data, 'Meal analyzed successfully');
    } catch (error: any) {
      console.error('AI Nutrition analysis error:', error.response?.data || error.message);

      if (error.response?.status === 500) {
        sendError(res, 'AI service temporarily unavailable', 503);
      } else {
        sendError(res, error.response?.data?.detail || 'Failed to analyze meal', 500);
      }
    }
  })
);

/**
 * POST /api/v1/nutrition-ai/search
 * Search the food database
 */
router.post(
  '/search',
  patientAuthenticate,
  validate(searchFoodsSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { query, includeRegional, limit } = req.body;

    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/api/nutrition/search`,
        {
          query,
          include_regional: includeRegional,
          limit,
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      sendSuccess(res, response.data, 'Food search completed');
    } catch (error: any) {
      console.error('Food search error:', error.response?.data || error.message);
      sendError(res, 'Failed to search foods', 500);
    }
  })
);

/**
 * GET /api/v1/nutrition-ai/food/:foodId
 * Get detailed nutrition info for a food item
 */
router.get(
  '/food/:foodId',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { foodId } = req.params;

    try {
      const response = await axios.get(
        `${AI_SERVICE_URL}/api/nutrition/food/${foodId}`,
        {
          timeout: 10000,
        }
      );

      sendSuccess(res, response.data, 'Food details retrieved');
    } catch (error: any) {
      if (error.response?.status === 404) {
        sendError(res, 'Food not found', 404);
      } else {
        console.error('Food details error:', error.response?.data || error.message);
        sendError(res, 'Failed to get food details', 500);
      }
    }
  })
);

/**
 * GET /api/v1/nutrition-ai/regional
 * Get regional foods, optionally filtered by region
 */
router.get(
  '/regional',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { region } = req.query;

    try {
      const url = new URL(`${AI_SERVICE_URL}/api/nutrition/regional`);
      if (region) {
        url.searchParams.append('region', region as string);
      }

      const response = await axios.get(url.toString(), {
        timeout: 10000,
      });

      sendSuccess(res, response.data, 'Regional foods retrieved');
    } catch (error: any) {
      console.error('Regional foods error:', error.response?.data || error.message);
      sendError(res, 'Failed to get regional foods', 500);
    }
  })
);

/**
 * POST /api/v1/nutrition-ai/estimate-portion
 * Estimate nutrition for a specific portion size
 */
router.post(
  '/estimate-portion',
  patientAuthenticate,
  validate(estimatePortionSchema),
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { foodId, portionSize } = req.body;

    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/api/nutrition/estimate-portion`,
        null,
        {
          params: {
            food_id: foodId,
            portion_size: portionSize,
          },
          timeout: 10000,
        }
      );

      sendSuccess(res, response.data, 'Portion estimated');
    } catch (error: any) {
      console.error('Portion estimation error:', error.response?.data || error.message);
      sendError(res, 'Failed to estimate portion', 500);
    }
  })
);

/**
 * GET /api/v1/nutrition-ai/status
 * Get AI nutrition service status
 */
router.get(
  '/status',
  asyncHandler(async (req, res: Response) => {
    try {
      const response = await axios.get(
        `${AI_SERVICE_URL}/api/nutrition/status`,
        {
          timeout: 5000,
        }
      );

      sendSuccess(res, response.data, 'Service status retrieved');
    } catch (error: any) {
      sendSuccess(res, {
        service: 'nutrition_ai',
        status: 'unavailable',
        message: 'AI service not reachable',
      }, 'Service status');
    }
  })
);

export default router;
