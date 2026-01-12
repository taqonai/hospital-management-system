export { default as api, extractData, setApiBaseUrl } from './client';
export { authApi } from './auth';
export { patientPortalApi } from './patientPortal';
export { symptomCheckerApi } from './symptomChecker';
export { offlinePatientApi } from './offlineApi';
export { wellnessApi } from './wellness';

// Re-export types
export type { LoginCredentials, RegisterData, OTPRequest, OTPVerification, AuthTokens, AuthResponse } from './auth';
export type { StartSessionData, SessionResponse, RespondData } from './symptomChecker';
export type { Message, MessageThread, MessageProvider } from './patientPortal';
export type {
  DeviceConnection,
  ConnectDeviceData,
  MetricType,
  HealthMetric,
  MetricsSummary,
  LogMetricData,
  ActivityType,
  FitnessActivity,
  FitnessGoal,
  FitnessStats,
  LogActivityData,
  CreateFitnessGoalData,
  MealType,
  NutritionLog,
  NutritionSummary,
  NutritionPlan,
  LogMealData,
  GenerateMealPlanData,
  WellnessCategory,
  WellnessGoal,
  WellnessAssessment,
  CreateWellnessGoalData,
  HealthCoachMessage,
  WorkoutRecommendationData,
} from './wellness';
