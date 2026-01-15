import api from './client';
import { ApiResponse } from '../../types';

// ==================== Device Types ====================
export interface DeviceConnection {
  id: string;
  provider: 'apple_health' | 'google_fit' | 'fitbit' | 'garmin' | 'samsung_health' | 'whoop';
  status: 'connected' | 'disconnected' | 'pending' | 'error';
  lastSync?: string;
  connectedAt?: string;
  permissions?: string[];
}

export interface ConnectDeviceData {
  provider: string;
  authCode?: string;
  permissions?: string[];
}

// ==================== Metric Types ====================
export type MetricType =
  | 'weight'
  | 'height'
  | 'blood_pressure'
  | 'heart_rate'
  | 'blood_glucose'
  | 'oxygen_saturation'
  | 'temperature'
  | 'steps'
  | 'sleep'
  | 'water_intake'
  | 'calories_burned';

export interface HealthMetric {
  id: string;
  type: MetricType;
  value: number;
  unit: string;
  secondaryValue?: number; // For blood pressure (systolic/diastolic)
  timestamp: string;
  source: 'manual' | 'device' | 'sync';
  deviceProvider?: string;
  notes?: string;
}

export interface MetricsSummary {
  latestMetrics: Record<MetricType, HealthMetric | null>;
  todayStats: {
    steps: number;
    calories: number;
    waterIntake: number;
    sleepHours: number;
  };
  weeklyTrends: Record<MetricType, { value: number; change: number }>;
}

export interface LogMetricData {
  type: MetricType;
  value: number;
  secondaryValue?: number;
  unit?: string;
  timestamp?: string;
  notes?: string;
}

// ==================== Fitness Types ====================
export type ActivityType =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'yoga'
  | 'strength_training'
  | 'hiit'
  | 'pilates'
  | 'dance'
  | 'hiking'
  | 'sports'
  | 'cardio'
  | 'stretching'
  | 'meditation'
  | 'other';

export interface FitnessActivity {
  id: string;
  type: ActivityType;
  name: string;
  duration: number; // minutes
  caloriesBurned: number;
  distance?: number;
  distanceUnit?: 'km' | 'mi';
  intensity: 'low' | 'moderate' | 'high' | 'very_high';
  heartRateAvg?: number;
  heartRateMax?: number;
  startTime: string;
  endTime?: string;
  notes?: string;
  source: 'manual' | 'device';
}

export interface FitnessGoal {
  id: string;
  type: 'steps' | 'calories' | 'duration' | 'distance' | 'workouts';
  target: number;
  currentValue: number;
  unit: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate?: string;
  isActive: boolean;
  progress: number; // percentage
}

export interface FitnessStats {
  period: 'week' | 'month' | 'year';
  totalWorkouts: number;
  totalDuration: number;
  totalCalories: number;
  totalDistance: number;
  avgWorkoutsPerWeek: number;
  favoriteActivity: string;
  streakDays: number;
  dailyStats: Array<{
    date: string;
    workouts: number;
    duration: number;
    calories: number;
    steps: number;
  }>;
}

export interface LogActivityData {
  type: ActivityType;
  name?: string;
  duration: number;
  caloriesBurned?: number;
  distance?: number;
  distanceUnit?: 'km' | 'mi';
  intensity: 'low' | 'moderate' | 'high' | 'very_high';
  startTime?: string;
  notes?: string;
}

export interface CreateFitnessGoalData {
  type: 'steps' | 'calories' | 'duration' | 'distance' | 'workouts';
  target: number;
  period: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
}

// ==================== Nutrition Types ====================
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface NutritionLog {
  id: string;
  mealType: MealType;
  name: string;
  description?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  servingSize?: number;
  servingUnit?: string;
  timestamp: string;
  imageUrl?: string;
}

export interface NutritionSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  meals: {
    breakfast: NutritionLog[];
    lunch: NutritionLog[];
    dinner: NutritionLog[];
    snack: NutritionLog[];
  };
  macroPercentages: {
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface NutritionPlan {
  id: string;
  name: string;
  description: string;
  type: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'medical' | 'custom';
  calorieTarget: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
  };
  restrictions?: string[];
  recommendations?: string[];
  startDate: string;
  endDate?: string;
  isActive: boolean;
  createdBy: 'user' | 'ai' | 'provider';
}

export interface LogMealData {
  mealType: MealType;
  name: string;
  description?: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  servingSize?: number;
  servingUnit?: string;
  timestamp?: string;
}

export interface GenerateMealPlanData {
  goal: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'energy';
  dietaryRestrictions?: string[];
  allergies?: string[];
  calorieTarget?: number;
  mealsPerDay?: number;
  duration?: number; // days
}

// ==================== Wellness Types ====================
export type WellnessCategory =
  | 'physical'
  | 'mental'
  | 'nutrition'
  | 'sleep'
  | 'stress'
  | 'social'
  | 'purpose'
  | 'environment';

export interface WellnessGoal {
  id: string;
  category: WellnessCategory;
  title: string;
  description?: string;
  target: number;
  currentValue: number;
  unit: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate?: string;
  isActive: boolean;
  progress: number;
  reminders?: boolean;
}

export interface WellnessAssessment {
  id: string;
  completedAt: string;
  overallScore: number;
  categoryScores: Record<WellnessCategory, number>;
  insights: string[];
  recommendations: Array<{
    category: WellnessCategory;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  compareToPrevious?: {
    overallChange: number;
    categoryChanges: Record<WellnessCategory, number>;
  };
}

export interface CreateWellnessGoalData {
  category: WellnessCategory;
  title: string;
  description?: string;
  target: number;
  unit: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  reminders?: boolean;
}

// ==================== AI Types ====================
export interface HealthCoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WorkoutRecommendationData {
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  availableTime: number; // minutes
  equipment?: string[];
  preferences?: string[];
  injuries?: string[];
}

// ==================== Helper functions for data transformation ====================

// Map mobile metric types to backend enum values
const METRIC_TYPE_MAP: Record<string, string> = {
  weight: 'WEIGHT',
  height: 'HEIGHT',
  blood_pressure: 'BLOOD_PRESSURE_SYSTOLIC',
  heart_rate: 'HEART_RATE',
  blood_glucose: 'BLOOD_GLUCOSE',
  oxygen_saturation: 'BLOOD_OXYGEN',
  temperature: 'BODY_TEMPERATURE',
  steps: 'STEPS',
  sleep: 'SLEEP_DURATION',
  water_intake: 'WATER_INTAKE',
  calories_burned: 'CALORIES_BURNED',
};

// Map mobile intensity values to backend enum values
const INTENSITY_MAP: Record<string, string> = {
  low: 'LIGHT',
  moderate: 'MODERATE',
  high: 'VIGOROUS',
  very_high: 'VERY_VIGOROUS',
};

// Map mobile meal types to backend enum values
const MEAL_TYPE_MAP: Record<string, string> = {
  breakfast: 'BREAKFAST',
  lunch: 'LUNCH',
  dinner: 'DINNER',
  snack: 'AFTERNOON_SNACK',
};

// Map mobile wellness categories to backend enum values
const WELLNESS_CATEGORY_MAP: Record<string, string> = {
  physical: 'PHYSICAL_FITNESS',
  mental: 'MENTAL_HEALTH',
  nutrition: 'NUTRITION',
  sleep: 'SLEEP',
  stress: 'STRESS_MANAGEMENT',
  social: 'SOCIAL_WELLNESS',
  purpose: 'MINDFULNESS',
  environment: 'HABIT_BUILDING',
};

// Map mobile frequency values to backend enum values
const FREQUENCY_MAP: Record<string, string> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
};

// ==================== API Service ====================
export const wellnessApi = {
  // ==================== Device Management ====================
  getDevices: () =>
    api.get<ApiResponse<DeviceConnection[]>>('/wellness/devices'),

  connectDevice: (data: ConnectDeviceData) =>
    api.post<ApiResponse<DeviceConnection>>('/wellness/devices/connect', {
      provider: data.provider.toUpperCase().replace('-', '_'),
      accessToken: data.authCode,
      scopes: data.permissions,
    }),

  disconnectDevice: (provider: string) =>
    api.delete<ApiResponse<void>>(`/wellness/devices/${provider.toUpperCase()}`),

  syncDevice: (provider: string) =>
    api.post<ApiResponse<{ synced: number; lastSync: string }>>(`/wellness/devices/${provider.toUpperCase()}/sync`),

  // ==================== Health Metrics ====================
  getMetrics: (params?: { type?: MetricType; startDate?: string; endDate?: string; limit?: number }) =>
    api.get<ApiResponse<HealthMetric[]>>('/wellness/metrics', { params }),

  getMetricsSummary: () =>
    api.get<ApiResponse<MetricsSummary>>('/wellness/metrics/summary'),

  logMetric: (data: LogMetricData) =>
    api.post<ApiResponse<HealthMetric>>('/wellness/metrics', {
      metricType: METRIC_TYPE_MAP[data.type] || data.type.toUpperCase(),
      value: data.value,
      unit: data.unit || 'units',
      recordedAt: data.timestamp || new Date().toISOString(),
      source: 'MANUAL',
      metadata: data.secondaryValue ? { secondaryValue: data.secondaryValue } : undefined,
    }),

  syncMetrics: (metrics: HealthMetric[]) =>
    api.post<ApiResponse<{ synced: number }>>('/wellness/metrics/sync', { metrics }),

  deleteMetric: (metricId: string) =>
    api.delete<ApiResponse<void>>(`/wellness/metrics/${metricId}`),

  // ==================== Fitness Tracking ====================
  getActivities: (params?: { type?: ActivityType; startDate?: string; endDate?: string; limit?: number }) =>
    api.get<ApiResponse<FitnessActivity[]>>('/wellness/fitness/activities', { params }),

  getActivity: (activityId: string) =>
    api.get<ApiResponse<FitnessActivity>>(`/wellness/fitness/activities/${activityId}`),

  logActivity: (data: LogActivityData) =>
    api.post<ApiResponse<FitnessActivity>>('/wellness/fitness/activities', {
      activityType: data.type.toUpperCase(),
      name: data.name || data.type,
      durationMinutes: data.duration,
      intensity: INTENSITY_MAP[data.intensity] || 'MODERATE',
      caloriesBurned: data.caloriesBurned,
      distanceKm: data.distance ? (data.distanceUnit === 'mi' ? data.distance * 1.60934 : data.distance) : undefined,
      startTime: data.startTime || new Date().toISOString(),
      notes: data.notes,
    }),

  updateActivity: (activityId: string, data: Partial<LogActivityData>) =>
    api.put<ApiResponse<FitnessActivity>>(`/wellness/fitness/activities/${activityId}`, data),

  deleteActivity: (activityId: string) =>
    api.delete<ApiResponse<void>>(`/wellness/fitness/activities/${activityId}`),

  getFitnessStats: (period: 'week' | 'month' | 'year' = 'week') =>
    api.get<ApiResponse<FitnessStats>>('/wellness/fitness/stats', { params: { period } }),

  getFitnessGoals: (active?: boolean) =>
    api.get<ApiResponse<FitnessGoal[]>>('/wellness/fitness/goals', { params: { active } }),

  createFitnessGoal: (data: CreateFitnessGoalData) =>
    api.post<ApiResponse<FitnessGoal>>('/wellness/fitness/goals', {
      goalType: data.type.toUpperCase(),
      targetValue: data.target,
      unit: data.type === 'workouts' ? 'count' : data.type === 'duration' ? 'minutes' : data.type === 'calories' ? 'cal' : data.type === 'distance' ? 'km' : 'steps',
      frequency: FREQUENCY_MAP[data.period] || 'DAILY',
      startDate: data.startDate || new Date().toISOString(),
    }),

  updateFitnessGoal: (goalId: string, data: Partial<CreateFitnessGoalData>) =>
    api.put<ApiResponse<FitnessGoal>>(`/wellness/fitness/goals/${goalId}`, data),

  updateGoalProgress: (goalId: string, currentValue: number) =>
    api.put<ApiResponse<FitnessGoal>>(`/wellness/fitness/goals/${goalId}/progress`, { currentValue }),

  deleteFitnessGoal: (goalId: string) =>
    api.delete<ApiResponse<void>>(`/wellness/fitness/goals/${goalId}`),

  // ==================== Nutrition ====================
  getNutritionLogs: (params?: { mealType?: MealType; startDate?: string; endDate?: string; limit?: number }) =>
    api.get<ApiResponse<NutritionLog[]>>('/wellness/nutrition/logs', { params }),

  getNutritionLog: (logId: string) =>
    api.get<ApiResponse<NutritionLog>>(`/wellness/nutrition/logs/${logId}`),

  logMeal: (data: LogMealData) =>
    api.post<ApiResponse<NutritionLog>>('/wellness/nutrition/logs', {
      mealType: MEAL_TYPE_MAP[data.mealType] || data.mealType.toUpperCase(),
      mealName: data.name,
      description: data.description,
      calories: data.calories,
      protein: data.protein,
      carbohydrates: data.carbs,
      fat: data.fat,
      fiber: data.fiber,
      servingSize: data.servingSize ? `${data.servingSize} ${data.servingUnit || 'g'}` : undefined,
      loggedAt: data.timestamp || new Date().toISOString(),
    }),

  updateMealLog: (logId: string, data: Partial<LogMealData>) =>
    api.put<ApiResponse<NutritionLog>>(`/wellness/nutrition/logs/${logId}`, data),

  deleteMealLog: (logId: string) =>
    api.delete<ApiResponse<void>>(`/wellness/nutrition/logs/${logId}`),

  getNutritionSummary: (date?: string) =>
    api.get<ApiResponse<NutritionSummary>>('/wellness/nutrition/summary', { params: { date } }),

  getNutritionPlans: () =>
    api.get<ApiResponse<NutritionPlan[]>>('/wellness/nutrition/plans'),

  getActivePlan: () =>
    api.get<ApiResponse<NutritionPlan | null>>('/wellness/nutrition/plans/active'),

  createNutritionPlan: (data: Partial<NutritionPlan>) =>
    api.post<ApiResponse<NutritionPlan>>('/wellness/nutrition/plans', data),

  updateNutritionPlan: (planId: string, data: Partial<NutritionPlan>) =>
    api.put<ApiResponse<NutritionPlan>>(`/wellness/nutrition/plans/${planId}`, data),

  setActivePlan: (planId: string) =>
    api.put<ApiResponse<NutritionPlan>>(`/wellness/nutrition/plans/${planId}/activate`),

  // ==================== Wellness Goals ====================
  getWellnessGoals: (params?: { category?: WellnessCategory; active?: boolean }) =>
    api.get<ApiResponse<WellnessGoal[]>>('/wellness/wellness/goals', { params }),

  getWellnessGoal: (goalId: string) =>
    api.get<ApiResponse<WellnessGoal>>(`/wellness/wellness/goals/${goalId}`),

  createWellnessGoal: (data: CreateWellnessGoalData) =>
    api.post<ApiResponse<WellnessGoal>>('/wellness/wellness/goals', {
      category: WELLNESS_CATEGORY_MAP[data.category] || data.category.toUpperCase(),
      title: data.title,
      description: data.description,
      targetValue: data.target,
      unit: data.unit,
      // Note: frequency is not supported in backend wellness goals schema
    }),

  updateWellnessGoal: (goalId: string, data: Partial<CreateWellnessGoalData & { currentValue?: number }>) =>
    api.put<ApiResponse<WellnessGoal>>(`/wellness/wellness/goals/${goalId}`, data),

  deleteWellnessGoal: (goalId: string) =>
    api.delete<ApiResponse<void>>(`/wellness/wellness/goals/${goalId}`),

  // ==================== AI Features ====================
  getWellnessAssessment: () =>
    api.get<ApiResponse<WellnessAssessment | null>>('/wellness/ai/wellness-assessment'),

  requestWellnessAssessment: () =>
    api.post<ApiResponse<WellnessAssessment>>('/wellness/ai/wellness-assessment'),

  chatWithHealthCoach: (message: string, context?: { history?: HealthCoachMessage[]; topic?: string }) =>
    api.post<ApiResponse<{ response: string; suggestions?: string[] }>>('/wellness/ai/health-coach', {
      message,
      ...context,
    }),

  getWorkoutRecommendations: (data: WorkoutRecommendationData) =>
    api.post<ApiResponse<{
      workouts: Array<{
        name: string;
        type: ActivityType;
        duration: number;
        exercises: Array<{
          name: string;
          sets?: number;
          reps?: number;
          duration?: number;
          notes?: string;
        }>;
        difficulty: 'easy' | 'moderate' | 'challenging';
      }>;
    }>>('/wellness/ai/workout-recommendations', data),

  generateAIMealPlan: (data: GenerateMealPlanData) =>
    api.post<ApiResponse<{
      plan: NutritionPlan;
      dailyMeals: Array<{
        day: number;
        meals: Array<{
          mealType: MealType;
          name: string;
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          recipe?: string;
        }>;
      }>;
    }>>('/wellness/ai/meal-plan', data),
};

export default wellnessApi;
