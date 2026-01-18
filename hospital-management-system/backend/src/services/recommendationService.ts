import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { RecommendationCategory, RecommendationPriority, RecommendationStatus } from '@prisma/client';
import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Recommendation Service
 * Handles AI-powered health recommendations:
 * - Recommendation generation from multiple data sources
 * - Daily health score calculation
 * - Feedback collection and analysis
 */
export class RecommendationService {
  /**
   * Generate recommendations for a patient
   * Correlates data from: wearables, genomics, lab results, nutrition
   */
  async generateRecommendations(patientId: string, hospitalId: string) {
    try {
      // Gather patient data from all sources
      const [
        healthData,
        genomicProfile,
        labResults,
        nutritionLogs,
        fitnessGoals,
      ] = await Promise.all([
        this.getRecentHealthData(patientId),
        this.getGenomicSummary(patientId),
        this.getRecentLabResults(patientId),
        this.getRecentNutrition(patientId),
        this.getActiveGoals(patientId),
      ]);

      // Call AI service to generate recommendations
      const response = await axios.post(`${AI_SERVICE_URL}/recommendations/generate`, {
        patientId,
        hospitalId,
        data: {
          healthData,
          genomicProfile,
          labResults,
          nutritionLogs,
          fitnessGoals,
        },
      });

      if (response.data.recommendations) {
        // Store generated recommendations
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30); // Default 30 days validity

        for (const rec of response.data.recommendations) {
          await prisma.recommendation.create({
            data: {
              patientId,
              hospitalId,
              category: rec.category as RecommendationCategory,
              priority: rec.priority as RecommendationPriority,
              title: rec.title,
              description: rec.description,
              reasoning: rec.reasoning || [],
              dataSources: rec.dataSources || [],
              actionItems: rec.actionItems || null,
              validUntil: rec.validUntil ? new Date(rec.validUntil) : validUntil,
            },
          });
        }

        return {
          generated: response.data.recommendations.length,
          recommendations: response.data.recommendations,
        };
      }

      return { generated: 0, recommendations: [] };
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      throw new AppError('Failed to generate recommendations', 500);
    }
  }

  /**
   * Get recent health data for AI analysis
   */
  private async getRecentHealthData(patientId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const data = await prisma.healthDataPoint.findMany({
      where: {
        patientId,
        timestamp: { gte: sevenDaysAgo },
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    // Aggregate by type
    const aggregated: Record<string, any> = {};
    for (const point of data) {
      if (!aggregated[point.dataType]) {
        aggregated[point.dataType] = {
          values: [],
          unit: point.unit,
        };
      }
      aggregated[point.dataType].values.push({
        value: point.value,
        timestamp: point.timestamp,
      });
    }

    return aggregated;
  }

  /**
   * Get genomic profile summary for AI analysis
   */
  private async getGenomicSummary(patientId: string) {
    const profile = await prisma.genomicProfile.findUnique({
      where: { patientId },
      include: {
        markers: true,
        riskScores: true,
      },
    });

    if (!profile || profile.status !== 'COMPLETED') {
      return null;
    }

    return {
      markers: profile.markers.map(m => ({
        gene: m.gene,
        rsId: m.rsId,
        category: m.category,
        phenotype: m.phenotype,
      })),
      riskScores: profile.riskScores.map(r => ({
        condition: r.condition,
        riskLevel: r.riskLevel,
        percentile: r.percentile,
      })),
    };
  }

  /**
   * Get recent lab results for AI analysis
   */
  private async getRecentLabResults(patientId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const labOrders = await prisma.labOrder.findMany({
      where: {
        patientId,
        status: 'COMPLETED',
        completedAt: { gte: thirtyDaysAgo },
      },
      include: {
        tests: {
          include: { labTest: true },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    return labOrders.flatMap(order =>
      order.tests.map(test => ({
        testName: test.labTest?.name || 'Unknown',
        value: test.resultValue?.toString() || test.result,
        unit: test.unit,
        normalRange: test.normalRange,
        isAbnormal: test.isAbnormal,
        date: order.completedAt,
      }))
    );
  }

  /**
   * Get recent nutrition logs for AI analysis
   */
  private async getRecentNutrition(patientId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const logs = await prisma.nutritionLog.findMany({
      where: {
        patientId,
        loggedAt: { gte: sevenDaysAgo },
      },
      orderBy: { loggedAt: 'desc' },
    });

    return logs.map(log => ({
      mealType: log.mealType,
      calories: log.calories,
      protein: log.protein,
      carbs: log.carbohydrates,
      fat: log.fat,
      date: log.loggedAt,
    }));
  }

  /**
   * Get active fitness/wellness goals
   */
  private async getActiveGoals(patientId: string) {
    const [fitnessGoals, wellnessGoals] = await Promise.all([
      prisma.fitnessGoal.findMany({
        where: { patientId, isActive: true },
      }),
      prisma.wellnessGoal.findMany({
        where: { patientId, status: 'ACTIVE' },
      }),
    ]);

    return {
      fitness: fitnessGoals.map(g => ({
        type: g.goalType,
        target: g.targetValue,
        current: g.currentValue,
        unit: g.unit,
      })),
      wellness: wellnessGoals.map(g => ({
        category: g.category,
        title: g.title,
        target: g.targetValue,
        current: g.currentValue,
      })),
    };
  }

  /**
   * Calculate daily health score
   */
  async calculateDailyScore(patientId: string, hospitalId: string, date?: Date) {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);

    try {
      // Gather data for the day
      const dayStart = new Date(targetDate);
      const dayEnd = new Date(targetDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [healthData, nutritionLogs, fitnessActivities] = await Promise.all([
        prisma.healthDataPoint.findMany({
          where: {
            patientId,
            timestamp: { gte: dayStart, lt: dayEnd },
          },
        }),
        prisma.nutritionLog.findMany({
          where: {
            patientId,
            loggedAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        prisma.fitnessActivity.findMany({
          where: {
            patientId,
            startTime: { gte: dayStart, lt: dayEnd },
          },
        }),
      ]);

      // Call AI service to calculate score
      const response = await axios.post(`${AI_SERVICE_URL}/recommendations/score`, {
        patientId,
        date: targetDate.toISOString(),
        data: {
          healthData: healthData.map(d => ({
            type: d.dataType,
            value: d.value,
            unit: d.unit,
          })),
          nutrition: nutritionLogs.map(n => ({
            mealType: n.mealType,
            calories: n.calories,
            protein: n.protein,
            carbs: n.carbohydrates,
            fat: n.fat,
          })),
          activities: fitnessActivities.map(a => ({
            type: a.activityType,
            duration: a.durationMinutes,
            calories: a.caloriesBurned,
          })),
        },
      });

      if (response.data.score) {
        const score = response.data.score;

        // Store the score
        await prisma.dailyHealthScore.upsert({
          where: {
            patientId_date: {
              patientId,
              date: targetDate,
            },
          },
          update: {
            overall: score.overall,
            sleep: score.sleep,
            activity: score.activity,
            nutrition: score.nutrition,
            recovery: score.recovery,
            compliance: score.compliance,
            stress: score.stress,
            trend: score.trend,
            insights: score.insights,
            dataQuality: score.dataQuality,
            calculatedAt: new Date(),
          },
          create: {
            patientId,
            hospitalId,
            date: targetDate,
            overall: score.overall,
            sleep: score.sleep,
            activity: score.activity,
            nutrition: score.nutrition,
            recovery: score.recovery,
            compliance: score.compliance,
            stress: score.stress,
            trend: score.trend,
            insights: score.insights,
            dataQuality: score.dataQuality,
          },
        });

        return score;
      }

      return null;
    } catch (error) {
      console.error('Failed to calculate health score:', error);
      return null;
    }
  }

  /**
   * Get recommendations for a patient
   */
  async getRecommendations(
    patientId: string,
    options: {
      status?: RecommendationStatus;
      category?: RecommendationCategory;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const where: any = {
      patientId,
      validUntil: { gte: new Date() },
    };

    if (options.status) {
      where.status = options.status;
    }

    if (options.category) {
      where.category = options.category;
    }

    const [recommendations, total] = await Promise.all([
      prisma.recommendation.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: options.limit || 20,
        skip: options.offset || 0,
        include: {
          feedback: true,
        },
      }),
      prisma.recommendation.count({ where }),
    ]);

    return { recommendations, total };
  }

  /**
   * Update recommendation status
   */
  async updateStatus(recommendationId: string, patientId: string, status: RecommendationStatus) {
    const recommendation = await prisma.recommendation.findFirst({
      where: { id: recommendationId, patientId },
    });

    if (!recommendation) {
      throw new NotFoundError('Recommendation not found');
    }

    const updateData: any = { status };

    if (status === 'DISMISSED') {
      updateData.dismissedAt = new Date();
    } else if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    return prisma.recommendation.update({
      where: { id: recommendationId },
      data: updateData,
    });
  }

  /**
   * Submit feedback on a recommendation
   */
  async submitFeedback(
    recommendationId: string,
    feedback: {
      helpful?: boolean;
      followed?: boolean;
      rating?: number;
      comment?: string;
    }
  ) {
    return prisma.recommendationFeedback.create({
      data: {
        recommendationId,
        helpful: feedback.helpful,
        followed: feedback.followed,
        rating: feedback.rating,
        comment: feedback.comment,
      },
    });
  }

  /**
   * Get recommendation statistics for a patient
   */
  async getStats(patientId: string) {
    const [totalActive, totalCompleted, totalDismissed, byCategory] = await Promise.all([
      prisma.recommendation.count({
        where: { patientId, status: 'ACTIVE' },
      }),
      prisma.recommendation.count({
        where: { patientId, status: 'COMPLETED' },
      }),
      prisma.recommendation.count({
        where: { patientId, status: 'DISMISSED' },
      }),
      prisma.recommendation.groupBy({
        by: ['category'],
        where: { patientId },
        _count: { category: true },
      }),
    ]);

    const complianceRate = totalCompleted + totalDismissed > 0
      ? (totalCompleted / (totalCompleted + totalDismissed)) * 100
      : null;

    return {
      active: totalActive,
      completed: totalCompleted,
      dismissed: totalDismissed,
      complianceRate,
      byCategory: byCategory.map(c => ({
        category: c.category,
        count: c._count.category,
      })),
    };
  }
}

export const recommendationService = new RecommendationService();
