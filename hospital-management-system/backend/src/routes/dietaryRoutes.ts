import { Router, Response } from 'express';
import { dietaryService } from '../services/dietaryService';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendPaginated, calculatePagination } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ==================== DIET PLAN MANAGEMENT ====================

// Create diet plan
router.post(
  '/plans',
  authenticate,
  authorizeWithPermission('dietary:write', ['HOSPITAL_ADMIN', 'DOCTOR', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const plan = await dietaryService.createDietPlan(req.user!.hospitalId, req.body);
    sendCreated(res, plan, 'Diet plan created');
  })
);

// Get diet plans
router.get(
  '/plans',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await dietaryService.getDietPlans(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.plans, pagination);
  })
);

// Get diet plan by ID
router.get(
  '/plans/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const plan = await dietaryService.getDietPlanById(req.params.id);
    sendSuccess(res, plan);
  })
);

// Update diet plan
router.put(
  '/plans/:id',
  authenticate,
  authorizeWithPermission('dietary:write', ['HOSPITAL_ADMIN', 'DOCTOR']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const plan = await dietaryService.updateDietPlan(req.params.id, req.body);
    sendSuccess(res, plan, 'Diet plan updated');
  })
);

// ==================== PATIENT DIET ASSIGNMENT ====================

// Assign diet to patient
router.post(
  '/patient-diets',
  authenticate,
  authorizeWithPermission('dietary:write', ['DOCTOR', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const diet = await dietaryService.assignPatientDiet(req.user!.hospitalId, {
      ...req.body,
      prescribedBy: req.user!.userId,
    });
    sendCreated(res, diet, 'Diet assigned to patient');
  })
);

// Get patient diets
router.get(
  '/patient-diets',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await dietaryService.getPatientDiets(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.diets, pagination);
  })
);

// Get patient diet by ID
router.get(
  '/patient-diets/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const diet = await dietaryService.getPatientDietById(req.params.id);
    sendSuccess(res, diet);
  })
);

// Update patient diet
router.patch(
  '/patient-diets/:id',
  authenticate,
  authorizeWithPermission('dietary:write', ['DOCTOR', 'NURSE']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const diet = await dietaryService.updatePatientDiet(req.params.id, req.body);
    sendSuccess(res, diet, 'Patient diet updated');
  })
);

// ==================== MEAL ORDERS ====================

// Create meal order
router.post(
  '/orders',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await dietaryService.createMealOrder(req.user!.hospitalId, req.body);
    sendCreated(res, order, 'Meal order created');
  })
);

// Get meal orders
router.get(
  '/orders',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await dietaryService.getMealOrders(req.user!.hospitalId, req.query);
    const pagination = calculatePagination(result.page, result.limit, result.total);
    sendPaginated(res, result.orders, pagination);
  })
);

// Update meal order status
router.patch(
  '/orders/:id/status',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body;
    const order = await dietaryService.updateMealOrderStatus(req.params.id, status);
    sendSuccess(res, order, 'Order status updated');
  })
);

// ==================== AI FEATURES ====================

// AI: Get nutritional recommendations
router.post(
  '/ai/recommendations',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const recommendations = dietaryService.getAINutritionalRecommendations(req.body);
    sendSuccess(res, recommendations);
  })
);

// AI: Suggest diet plan
router.post(
  '/ai/suggest-plan',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const suggestion = dietaryService.suggestDietPlan(req.body);
    sendSuccess(res, suggestion);
  })
);

// AI: Analyze nutrition intake
router.post(
  '/ai/analyze-intake',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const analysis = dietaryService.analyzeNutritionIntake(req.body);
    sendSuccess(res, analysis);
  })
);

// ==================== DASHBOARD ====================

// Get dietary dashboard stats
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await dietaryService.getDashboardStats(req.user!.hospitalId);
    sendSuccess(res, stats);
  })
);

export default router;
