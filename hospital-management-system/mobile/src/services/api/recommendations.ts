import { api } from './client';
import { ApiResponse } from '../../types';

// ==================== Recommendation Types ====================

export type RecommendationCategory =
  | 'NUTRITION'
  | 'SUPPLEMENT'
  | 'ACTIVITY'
  | 'SLEEP'
  | 'LIFESTYLE'
  | 'MEDICAL'
  | 'GENOMIC'
  | 'LAB_BASED'
  | 'WEARABLE_BASED';

export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type RecommendationStatus = 'ACTIVE' | 'DISMISSED' | 'COMPLETED' | 'EXPIRED' | 'SNOOZED';

export type HealthScoreTrend = 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  reasoning: string[];
  dataSources: string[];
  actionItems: string[];
  validUntil?: string;
  status: RecommendationStatus;
  createdAt: string;
  snoozedUntil?: string;
}

export interface DailyHealthScore {
  id?: string;
  date: string;
  overall: number; // 0-100
  sleep: number;
  activity: number;
  nutrition: number;
  recovery: number;
  compliance: number;
  stress?: number;
  trend: HealthScoreTrend;
  insights: string[];
  dataQuality: number;
}

export interface RecommendationFeedback {
  id: string;
  recommendationId: string;
  helpful: boolean;
  feedback?: string;
  createdAt: string;
}

// ==================== Request Types ====================

export interface PatientHealthData {
  wearableData?: {
    steps?: { avg: number; date: string }[];
    heartRate?: { resting: number; date: string }[];
    hrv?: { avg: number; date: string }[];
    sleep?: { duration: number; quality?: number; date: string }[];
    activeMinutes?: number;
    stressLevel?: number;
  };
  genomicMarkers?: Array<{
    gene: string;
    phenotype: string;
    category: string;
  }>;
  labResults?: Array<{
    testName: string;
    value: string;
    unit: string;
    date: string;
  }>;
  nutritionLogs?: Array<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    date: string;
  }>;
  fitnessGoals?: {
    stepsGoal?: number;
    calorieGoal?: number;
    activeMinutesGoal?: number;
    sleepGoal?: number;
  };
  currentRecommendations?: Recommendation[];
}

export interface DismissRecommendationData {
  reason?: string;
}

export interface SnoozeRecommendationData {
  duration: 'day' | 'week' | 'month';
}

export interface SubmitFeedbackData {
  helpful: boolean;
  feedback?: string;
}

export interface ScoreHistoryParams {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

// ==================== Response Types ====================

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  count: number;
  categories: RecommendationCategory[];
}

export interface HealthScoreResponse {
  score: DailyHealthScore;
  previousScore?: DailyHealthScore;
  change?: number;
}

export interface ScoreHistoryResponse {
  scores: DailyHealthScore[];
  averageScore: number;
  trend: HealthScoreTrend;
}

// ==================== API Service ====================

export const recommendationsApi = {
  // ==================== Recommendations ====================

  /**
   * Get all active recommendations for the patient
   */
  getRecommendations: (params?: { category?: RecommendationCategory; status?: RecommendationStatus }) =>
    api.get<ApiResponse<RecommendationsResponse>>('/recommendations', { params }),

  /**
   * Get a single recommendation by ID
   */
  getRecommendation: (recommendationId: string) =>
    api.get<ApiResponse<Recommendation>>(`/recommendations/${recommendationId}`),

  /**
   * Generate new recommendations based on patient data
   * Note: Backend gathers patient data automatically - no need to send it
   */
  generateRecommendations: () =>
    api.post<ApiResponse<{
      status: string;
      recommendationsCreated: number;
      recommendations: Recommendation[];
      healthScore: DailyHealthScore | null;
    }>>('/recommendations/generate'),

  /**
   * Dismiss a recommendation
   */
  dismissRecommendation: (recommendationId: string, data?: DismissRecommendationData) =>
    api.put<ApiResponse<Recommendation>>(`/recommendations/${recommendationId}/dismiss`, data),

  /**
   * Mark a recommendation as completed
   */
  completeRecommendation: (recommendationId: string) =>
    api.put<ApiResponse<Recommendation>>(`/recommendations/${recommendationId}/complete`),

  /**
   * Snooze a recommendation for a period
   */
  snoozeRecommendation: (recommendationId: string, data: SnoozeRecommendationData) =>
    api.put<ApiResponse<Recommendation>>(`/recommendations/${recommendationId}/snooze`, data),

  /**
   * Submit feedback on a recommendation
   */
  submitFeedback: (recommendationId: string, data: SubmitFeedbackData) =>
    api.post<ApiResponse<RecommendationFeedback>>(`/recommendations/${recommendationId}/feedback`, data),

  // ==================== Health Score ====================

  /**
   * Get today's health score
   */
  getHealthScore: () =>
    api.get<ApiResponse<HealthScoreResponse>>('/recommendations/score'),

  /**
   * Get health score history
   */
  getScoreHistory: (params?: ScoreHistoryParams) =>
    api.get<ApiResponse<ScoreHistoryResponse>>('/recommendations/score/history', { params }),

  /**
   * Calculate/refresh health score for today
   * Note: Backend gathers patient data automatically
   */
  calculateScore: () =>
    api.post<ApiResponse<DailyHealthScore>>('/recommendations/score/calculate'),

  // ==================== Categories ====================

  /**
   * Get available recommendation categories
   */
  getCategories: () =>
    api.get<ApiResponse<{
      categories: Array<{
        name: RecommendationCategory;
        description: string;
        count: number;
      }>;
    }>>('/recommendations/categories'),

  /**
   * Get recommendations grouped by category
   */
  getByCategory: () =>
    api.get<ApiResponse<Record<RecommendationCategory, Recommendation[]>>>('/recommendations/by-category'),

  // ==================== Insights ====================

  /**
   * Get personalized health insights
   */
  getInsights: () =>
    api.get<ApiResponse<{
      insights: string[];
      focusAreas: Array<{
        category: RecommendationCategory;
        score: number;
        improvement: string;
      }>;
    }>>('/recommendations/insights'),

  /**
   * Get weekly health summary
   */
  getWeeklySummary: () =>
    api.get<ApiResponse<{
      averageScore: number;
      trend: HealthScoreTrend;
      completedRecommendations: number;
      topAchievements: string[];
      areasForImprovement: string[];
    }>>('/recommendations/weekly-summary'),

  /**
   * Get recommendation statistics
   */
  getStats: () =>
    api.get<ApiResponse<{
      active: number;
      completed: number;
      dismissed: number;
      complianceRate: number | null;
      byCategory: Array<{ category: RecommendationCategory; count: number }>;
    }>>('/recommendations/stats'),
};

export default recommendationsApi;
