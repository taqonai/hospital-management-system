import { api } from './client';
import { ApiResponse } from '../../types';

// ==================== Types ====================

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export type PortionSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';

export type FoodCategory =
  | 'PROTEIN'
  | 'CARBOHYDRATE'
  | 'VEGETABLE'
  | 'FRUIT'
  | 'DAIRY'
  | 'FAT'
  | 'BEVERAGE'
  | 'MIXED'
  | 'DESSERT'
  | 'CONDIMENT';

export interface DetectedFood {
  name: string;
  name_ar?: string;
  category: FoodCategory;
  confidence: number;
  portion_size: PortionSize;
  portion_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium?: number;
  sugar?: number;
  is_regional: boolean;
  region?: string;
}

export interface MealAnalysis {
  foods: DetectedFood[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fiber: number;
  meal_type: MealType;
  confidence: number;
  suggestions: string[];
  warnings: string[];
}

export interface FoodSearchResult {
  id: string;
  name: string;
  name_ar?: string;
  category: FoodCategory;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  is_regional: boolean;
  region?: string;
  score: number;
}

export interface FoodDetails {
  id: string;
  name: string;
  name_ar?: string;
  category: FoodCategory;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  is_regional: boolean;
  region?: string;
  aliases?: string[];
}

export interface PortionEstimate {
  food_id: string;
  portion_size: PortionSize;
  estimated_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface RegionalFoodsResponse {
  foods: FoodDetails[];
  count: number;
  regions: string[];
}

export interface FoodSearchResponse {
  results: FoodSearchResult[];
  count: number;
  query: string;
}

export interface NutritionAiStatus {
  service: string;
  status: string;
  features: {
    image_analysis: boolean;
    food_search: boolean;
    regional_database: boolean;
    portion_estimation: boolean;
  };
  regional_foods_count: number;
  standard_foods_count: number;
  supported_regions: string[];
  model_version: string;
}

// ==================== Request Types ====================

export interface AnalyzeMealRequest {
  imageBase64: string;
  mealType?: MealType;
}

export interface SearchFoodsRequest {
  query: string;
  includeRegional?: boolean;
  limit?: number;
}

export interface EstimatePortionRequest {
  foodId: string;
  portionSize: PortionSize;
}

// ==================== API Functions ====================

/**
 * Analyze a meal photo using AI vision
 */
export const analyzeMealImage = async (
  data: AnalyzeMealRequest
): Promise<ApiResponse<MealAnalysis>> => {
  const response = await api.post('/nutrition-ai/analyze', data);
  return response.data;
};

/**
 * Search food database
 */
export const searchFoods = async (
  data: SearchFoodsRequest
): Promise<ApiResponse<FoodSearchResponse>> => {
  const response = await api.post('/nutrition-ai/search', data);
  return response.data;
};

/**
 * Get details for a specific food
 */
export const getFoodDetails = async (
  foodId: string
): Promise<ApiResponse<FoodDetails>> => {
  const response = await api.get(`/nutrition-ai/food/${foodId}`);
  return response.data;
};

/**
 * Get regional foods, optionally filtered by region
 */
export const getRegionalFoods = async (
  region?: string
): Promise<ApiResponse<RegionalFoodsResponse>> => {
  const url = region ? `/nutrition-ai/regional?region=${region}` : '/nutrition-ai/regional';
  const response = await api.get(url);
  return response.data;
};

/**
 * Estimate nutrition for a specific portion size
 */
export const estimatePortion = async (
  data: EstimatePortionRequest
): Promise<ApiResponse<PortionEstimate>> => {
  const response = await api.post('/nutrition-ai/estimate-portion', data);
  return response.data;
};

/**
 * Get AI nutrition service status
 */
export const getNutritionAiStatus = async (): Promise<ApiResponse<NutritionAiStatus>> => {
  const response = await api.get('/nutrition-ai/status');
  return response.data;
};

// Export API object for consistent interface
export const nutritionAiApi = {
  analyzeMealImage,
  searchFoods,
  getFoodDetails,
  getRegionalFoods,
  estimatePortion,
  getNutritionAiStatus,
};

export default nutritionAiApi;
