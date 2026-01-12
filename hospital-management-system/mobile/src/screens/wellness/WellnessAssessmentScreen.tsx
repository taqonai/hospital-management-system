import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, WellnessAssessment, WellnessCategory } from '../../services/api';

const WELLNESS_CATEGORIES: Array<{
  key: WellnessCategory;
  label: string;
  icon: string;
  color: string;
}> = [
  { key: 'physical', label: 'Physical', icon: 'body-outline', color: colors.error[500] },
  { key: 'mental', label: 'Mental', icon: 'happy-outline', color: colors.primary[500] },
  { key: 'nutrition', label: 'Nutrition', icon: 'nutrition-outline', color: colors.warning[500] },
  { key: 'sleep', label: 'Sleep', icon: 'moon-outline', color: colors.info[500] },
  { key: 'stress', label: 'Stress', icon: 'pulse-outline', color: colors.success[500] },
  { key: 'social', label: 'Social', icon: 'people-outline', color: colors.primary[700] },
  { key: 'purpose', label: 'Purpose', icon: 'compass-outline', color: colors.warning[700] },
  { key: 'environment', label: 'Environment', icon: 'leaf-outline', color: colors.success[700] },
];

const WellnessAssessmentScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [assessment, setAssessment] = useState<WellnessAssessment | null>(null);

  const loadAssessment = useCallback(async () => {
    try {
      const response = await wellnessApi.getWellnessAssessment();
      setAssessment(response.data?.data || null);
    } catch (error) {
      console.error('Error loading assessment:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAssessment();
  };

  const handleRequestAssessment = async () => {
    setIsRequesting(true);
    try {
      const response = await wellnessApi.requestWellnessAssessment();
      setAssessment(response.data?.data || null);
      Alert.alert('Assessment Complete', 'Your wellness assessment has been updated.');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to generate assessment. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsRequesting(false);
    }
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
    return 'Needs Work';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!assessment) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="clipboard-outline" size={80} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Assessment Yet</Text>
          <Text style={styles.emptyText}>
            Take a comprehensive wellness assessment to understand your health across 8 key categories
          </Text>
          <TouchableOpacity
            style={[styles.assessButton, isRequesting && styles.assessButtonDisabled]}
            onPress={handleRequestAssessment}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.assessButtonText}>Analyzing...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color={colors.white} />
                <Text style={styles.assessButtonText}>Start Assessment</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
        <View style={styles.overallCard}>
          <Text style={styles.assessmentDate}>
            Last assessed: {formatDate(assessment.completedAt)}
          </Text>
          <View style={styles.scoreSection}>
            <Text style={[styles.overallScore, { color: getScoreColor(assessment.overallScore) }]}>
              {assessment.overallScore}
            </Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <Text style={[styles.scoreLabel, { color: getScoreColor(assessment.overallScore) }]}>
            {getScoreLabel(assessment.overallScore)}
          </Text>

          {assessment.compareToPrevious && (
            <View style={styles.changeContainer}>
              <Ionicons
                name={assessment.compareToPrevious.overallChange >= 0 ? 'trending-up' : 'trending-down'}
                size={20}
                color={assessment.compareToPrevious.overallChange >= 0 ? colors.success[500] : colors.error[500]}
              />
              <Text
                style={[
                  styles.changeText,
                  { color: assessment.compareToPrevious.overallChange >= 0 ? colors.success[600] : colors.error[600] },
                ]}
              >
                {assessment.compareToPrevious.overallChange >= 0 ? '+' : ''}
                {assessment.compareToPrevious.overallChange} from last assessment
              </Text>
            </View>
          )}
        </View>

        {/* Category Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Scores</Text>
          <View style={styles.categoryList}>
            {WELLNESS_CATEGORIES.map((category) => {
              const score = assessment.categoryScores[category.key] || 0;
              const change = assessment.compareToPrevious?.categoryChanges?.[category.key];
              return (
                <View key={category.key} style={styles.categoryRow}>
                  <View style={[styles.categoryIcon, { backgroundColor: `${category.color}15` }]}>
                    <Ionicons name={category.icon as any} size={20} color={category.color} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryLabel}>{category.label}</Text>
                      <View style={styles.categoryScoreRow}>
                        <Text style={[styles.categoryScore, { color: getScoreColor(score) }]}>
                          {score}
                        </Text>
                        {change !== undefined && (
                          <Text
                            style={[
                              styles.categoryChange,
                              { color: change >= 0 ? colors.success[600] : colors.error[600] },
                            ]}
                          >
                            {change >= 0 ? '+' : ''}{change}
                          </Text>
                        )}
                      </View>
                    </View>
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

        {/* Insights */}
        {assessment.insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Insights</Text>
            <View style={styles.insightsList}>
              {assessment.insights.map((insight, index) => (
                <View key={index} style={styles.insightCard}>
                  <Ionicons name="bulb-outline" size={20} color={colors.warning[500]} />
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recommendations */}
        {assessment.recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <View style={styles.recommendationsList}>
              {assessment.recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationCard}>
                  <View style={[
                    styles.priorityBadge,
                    {
                      backgroundColor: rec.priority === 'high' ? colors.error[100] :
                        rec.priority === 'medium' ? colors.warning[100] : colors.success[100],
                    },
                  ]}>
                    <Text style={[
                      styles.priorityText,
                      {
                        color: rec.priority === 'high' ? colors.error[700] :
                          rec.priority === 'medium' ? colors.warning[700] : colors.success[700],
                      },
                    ]}>
                      {rec.priority} priority
                    </Text>
                  </View>
                  <Text style={styles.recommendationTitle}>{rec.title}</Text>
                  <Text style={styles.recommendationDesc}>{rec.description}</Text>
                  <Text style={styles.recommendationCategory}>
                    Category: {WELLNESS_CATEGORIES.find(c => c.key === rec.category)?.label || rec.category}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Retake Assessment */}
        <TouchableOpacity
          style={[styles.retakeButton, isRequesting && styles.retakeButtonDisabled]}
          onPress={handleRequestAssessment}
          disabled={isRequesting}
        >
          {isRequesting ? (
            <ActivityIndicator size="small" color={colors.primary[600]} />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color={colors.primary[600]} />
              <Text style={styles.retakeText}>Retake Assessment</Text>
            </>
          )}
        </TouchableOpacity>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  assessButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  assessButtonDisabled: {
    backgroundColor: colors.gray[400],
  },
  assessButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  content: {
    padding: spacing.lg,
  },
  overallCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  assessmentDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  overallScore: {
    fontSize: 72,
    fontWeight: typography.fontWeight.bold,
  },
  scoreMax: {
    fontSize: typography.fontSize['2xl'],
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  scoreLabel: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.sm,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  changeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  categoryList: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  categoryScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryScore: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  categoryChange: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  categoryBar: {
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  insightsList: {
    gap: spacing.md,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  insightText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 20,
  },
  recommendationsList: {
    gap: spacing.md,
  },
  recommendationCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  priorityText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  recommendationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  recommendationDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  recommendationCategory: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: spacing.md,
    textTransform: 'capitalize',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  retakeButtonDisabled: {
    opacity: 0.6,
  },
  retakeText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
});

export default WellnessAssessmentScreen;
