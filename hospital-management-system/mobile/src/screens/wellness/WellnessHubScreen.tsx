import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, WellnessAssessment, WellnessGoal, WellnessCategory } from '../../services/api';
import { WellnessStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<WellnessStackParamList>;

const WELLNESS_CATEGORIES: Array<{
  key: WellnessCategory;
  label: string;
  icon: string;
  color: string;
  description: string;
}> = [
  { key: 'physical', label: 'Physical', icon: 'body-outline', color: colors.error[500], description: 'Exercise & fitness' },
  { key: 'mental', label: 'Mental', icon: 'happy-outline', color: colors.primary[500], description: 'Stress & mindfulness' },
  { key: 'nutrition', label: 'Nutrition', icon: 'nutrition-outline', color: colors.warning[500], description: 'Diet & hydration' },
  { key: 'sleep', label: 'Sleep', icon: 'moon-outline', color: colors.info[500], description: 'Rest & recovery' },
  { key: 'stress', label: 'Stress', icon: 'pulse-outline', color: colors.success[500], description: 'Anxiety management' },
  { key: 'social', label: 'Social', icon: 'people-outline', color: colors.primary[700], description: 'Relationships' },
  { key: 'purpose', label: 'Purpose', icon: 'compass-outline', color: colors.warning[700], description: 'Goals & meaning' },
  { key: 'environment', label: 'Environment', icon: 'leaf-outline', color: colors.success[700], description: 'Living space' },
];

const WellnessHubScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assessment, setAssessment] = useState<WellnessAssessment | null>(null);
  const [goals, setGoals] = useState<WellnessGoal[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [assessmentRes, goalsRes] = await Promise.all([
        wellnessApi.getWellnessAssessment(),
        wellnessApi.getWellnessGoals({ active: true }),
      ]);
      setAssessment(assessmentRes.data?.data || null);
      setGoals(goalsRes.data?.data || []);
    } catch (error) {
      console.error('Error loading wellness data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return colors.success[500];
    if (score >= 60) return colors.warning[500];
    return colors.error[500];
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Overall Score */}
        <View style={styles.scoreCard}>
          {assessment ? (
            <>
              <Text style={styles.scoreLabel}>Your Wellness Score</Text>
              <View style={styles.scoreCircle}>
                <Text style={[styles.scoreValue, { color: getScoreColor(assessment.overallScore) }]}>
                  {assessment.overallScore}
                </Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
              <Text style={[styles.scoreStatus, { color: getScoreColor(assessment.overallScore) }]}>
                {getScoreLabel(assessment.overallScore)}
              </Text>
              <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() => navigation.navigate('WellnessAssessment')}
              >
                <Text style={styles.viewDetailsText}>View Full Assessment</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary[600]} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.noAssessment}>
              <Ionicons name="clipboard-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.noAssessmentTitle}>Take Your First Assessment</Text>
              <Text style={styles.noAssessmentText}>
                Get personalized insights about your wellness across 8 categories
              </Text>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => navigation.navigate('WellnessAssessment')}
              >
                <Text style={styles.startButtonText}>Start Assessment</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Category Scores */}
        {assessment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            <View style={styles.categoryGrid}>
              {WELLNESS_CATEGORIES.map((category) => {
                const score = assessment.categoryScores[category.key] || 0;
                return (
                  <View key={category.key} style={styles.categoryCard}>
                    <View style={[styles.categoryIcon, { backgroundColor: `${category.color}15` }]}>
                      <Ionicons name={category.icon as any} size={24} color={category.color} />
                    </View>
                    <Text style={styles.categoryLabel}>{category.label}</Text>
                    <View style={styles.categoryScoreContainer}>
                      <Text style={[styles.categoryScore, { color: getScoreColor(score) }]}>
                        {score}
                      </Text>
                      <View style={styles.categoryBar}>
                        <View
                          style={[
                            styles.categoryBarFill,
                            { width: `${score}%`, backgroundColor: getScoreColor(score) },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Active Goals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Goals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('WellnessGoals')}>
              <Text style={styles.seeAllText}>Manage</Text>
            </TouchableOpacity>
          </View>

          {goals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="flag-outline" size={40} color={colors.gray[300]} />
              <Text style={styles.emptyText}>No active wellness goals</Text>
              <TouchableOpacity
                style={styles.addGoalButton}
                onPress={() => navigation.navigate('WellnessGoals')}
              >
                <Text style={styles.addGoalText}>Set Goals</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.goalsList}>
              {goals.slice(0, 3).map((goal) => {
                const categoryInfo = WELLNESS_CATEGORIES.find(c => c.key === goal.category);
                return (
                  <View key={goal.id} style={styles.goalCard}>
                    <View style={[styles.goalIcon, { backgroundColor: `${categoryInfo?.color || colors.gray[500]}15` }]}>
                      <Ionicons
                        name={categoryInfo?.icon as any || 'flag-outline'}
                        size={20}
                        color={categoryInfo?.color || colors.gray[500]}
                      />
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalTitle}>{goal.title}</Text>
                      <Text style={styles.goalProgress}>
                        {goal.currentValue} / {goal.target} {goal.unit}
                      </Text>
                    </View>
                    <Text style={styles.goalPercent}>{Math.round(goal.progress)}%</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Recommendations */}
        {assessment && assessment.recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <View style={styles.recommendationsList}>
              {assessment.recommendations.slice(0, 3).map((rec, index) => (
                <View key={index} style={styles.recommendationCard}>
                  <View style={[
                    styles.priorityIndicator,
                    { backgroundColor: rec.priority === 'high' ? colors.error[500] :
                      rec.priority === 'medium' ? colors.warning[500] : colors.success[500] }
                  ]} />
                  <View style={styles.recommendationContent}>
                    <Text style={styles.recommendationTitle}>{rec.title}</Text>
                    <Text style={styles.recommendationDesc}>{rec.description}</Text>
                    <Text style={styles.recommendationCategory}>
                      {WELLNESS_CATEGORIES.find(c => c.key === rec.category)?.label || rec.category}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('HealthCoach')}
          >
            <Ionicons name="chatbubbles" size={24} color={colors.primary[600]} />
            <Text style={styles.actionLabel}>Health Coach</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WellnessAssessment')}
          >
            <Ionicons name="clipboard" size={24} color={colors.primary[600]} />
            <Text style={styles.actionLabel}>Assessment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('WellnessGoals')}
          >
            <Ionicons name="flag" size={24} color={colors.primary[600]} />
            <Text style={styles.actionLabel}>Goals</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  scoreCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  scoreLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: typography.fontWeight.bold,
  },
  scoreMax: {
    fontSize: typography.fontSize.xl,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  scoreStatus: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.sm,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  viewDetailsText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  noAssessment: {
    alignItems: 'center',
  },
  noAssessmentTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  noAssessmentText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  startButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  seeAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  categoryScoreContainer: {
    marginTop: spacing.sm,
  },
  categoryScore: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  categoryBar: {
    height: 4,
    backgroundColor: colors.gray[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  addGoalButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
  },
  addGoalText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  goalsList: {
    gap: spacing.md,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  goalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  goalProgress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  goalPercent: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  recommendationsList: {
    gap: spacing.md,
  },
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  priorityIndicator: {
    width: 4,
  },
  recommendationContent: {
    flex: 1,
    padding: spacing.md,
  },
  recommendationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  recommendationDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  recommendationCategory: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: spacing.sm,
    textTransform: 'capitalize',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
});

export default WellnessHubScreen;
