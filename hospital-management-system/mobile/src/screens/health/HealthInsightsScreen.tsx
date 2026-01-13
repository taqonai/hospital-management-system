import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { HealthInsight } from '../../types';

const { width: screenWidth } = Dimensions.get('window');

const HealthInsightsScreen: React.FC = () => {
  const [insights, setInsights] = useState<HealthInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      const response = await patientPortalApi.getHealthInsights();
      setInsights(response.data?.data || null);
    } catch (error) {
      console.error('Failed to load health insights:', error);
      Alert.alert('Error', 'Failed to load health insights');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadInsights();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return colors.success[600];
    if (score >= 60) return colors.warning[600];
    return colors.error[600];
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const healthScore = insights?.healthScore || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary[600]]}
        />
      }
    >
      {/* Health Score Card */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreTitle}>Your Health Score</Text>
        <View style={styles.scoreContainer}>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreNumber, { color: getScoreColor(healthScore) }]}>
              {healthScore}
            </Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <View style={styles.scoreLabelContainer}>
            <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(healthScore)}15` }]}>
              <Text style={[styles.scoreBadgeText, { color: getScoreColor(healthScore) }]}>
                {getScoreLabel(healthScore)}
              </Text>
            </View>
            <Text style={styles.scoreUpdated}>
              Updated {insights?.lastUpdated ? formatDate(insights.lastUpdated) : 'today'}
            </Text>
          </View>
        </View>
      </View>

      {/* Category Scores */}
      {insights?.categories && insights.categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Categories</Text>
          {insights.categories.map((category, index) => (
            <View key={index} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryIcon}>
                  <Ionicons
                    name={getCategoryIcon(category.name)}
                    size={20}
                    color={colors.primary[600]}
                  />
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={[styles.categoryScore, { color: getScoreColor(category.score) }]}>
                  {category.score}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${category.score}%`,
                      backgroundColor: getScoreColor(category.score),
                    },
                  ]}
                />
              </View>
              {category.recommendation && (
                <Text style={styles.categoryRecommendation}>{category.recommendation}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Recent Vitals */}
      {insights?.recentVitals && insights.recentVitals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Vitals</Text>
          <View style={styles.vitalsGrid}>
            {insights.recentVitals.map((vital, index) => (
              <View key={index} style={styles.vitalCard}>
                <View style={styles.vitalHeader}>
                  <Ionicons name={getVitalIcon(vital.type)} size={18} color={colors.gray[500]} />
                  <Text style={styles.vitalType}>{vital.type}</Text>
                  {vital.trend && (
                    <Ionicons
                      name={getTrendIcon(vital.trend).name}
                      size={16}
                      color={getTrendIcon(vital.trend).color}
                      style={{ marginLeft: 4 }}
                    />
                  )}
                </View>
                <Text style={[styles.vitalValue, vital.isAbnormal && styles.vitalValueAbnormal]}>
                  {vital.value}
                </Text>
                <View style={styles.vitalFooter}>
                  <Text style={styles.vitalUnit}>{vital.unit}</Text>
                  {vital.previousValue && (
                    <Text style={styles.vitalPrevious}>prev: {vital.previousValue}</Text>
                  )}
                </View>
                {vital.isAbnormal && (
                  <View style={styles.abnormalIndicator}>
                    <Ionicons name="warning" size={12} color={colors.error[600]} />
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* AI Recommendations */}
      {insights?.recommendations && insights.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Recommendations</Text>
          {insights.recommendations.map((rec, index) => {
            // Handle both string and object recommendations
            if (typeof rec === 'string') {
              return (
                <View key={index} style={styles.recommendationCard}>
                  <View style={[styles.recommendationIcon, { backgroundColor: colors.primary[500] }]}>
                    <Ionicons name="bulb" size={20} color={colors.white} />
                  </View>
                  <View style={styles.recommendationContent}>
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                </View>
              );
            }
            return (
              <View key={index} style={styles.recommendationCard}>
                <View style={[styles.recommendationIcon, { backgroundColor: getRecommendationColor(rec.priority) }]}>
                  <Ionicons
                    name={rec.priority === 'high' ? 'alert' : rec.priority === 'medium' ? 'bulb' : 'checkmark'}
                    size={20}
                    color={colors.white}
                  />
                </View>
                <View style={styles.recommendationContent}>
                  <Text style={styles.recommendationTitle}>{rec.title}</Text>
                  <Text style={styles.recommendationText}>{rec.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Lab Results Analysis */}
      {insights?.labAnalysis && insights.labAnalysis.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lab Results Analysis</Text>
          {insights.labAnalysis.map((lab, index) => (
            <View key={index} style={styles.labCard}>
              <View style={styles.labHeader}>
                <Text style={styles.labName}>{lab.testName}</Text>
                <View style={[
                  styles.labStatus,
                  { backgroundColor: lab.isAbnormal ? `${colors.error[500]}15` : `${colors.success[500]}15` }
                ]}>
                  <Text style={[
                    styles.labStatusText,
                    { color: lab.isAbnormal ? colors.error[600] : colors.success[600] }
                  ]}>
                    {lab.isAbnormal ? 'Abnormal' : 'Normal'}
                  </Text>
                </View>
              </View>
              <View style={styles.labValues}>
                <Text style={[styles.labValue, lab.isAbnormal && styles.labValueAbnormal]}>
                  {lab.value} {lab.unit}
                </Text>
                <Text style={styles.labRange}>
                  Range: {lab.referenceRange}
                </Text>
              </View>
              {lab.interpretation && (
                <Text style={styles.labInterpretation}>{lab.interpretation}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Risk Assessment */}
      {insights?.riskAssessment && insights.riskAssessment.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Assessment</Text>
          {insights.riskAssessment.map((risk, index) => (
            <View key={index} style={styles.riskCard}>
              <View style={styles.riskHeader}>
                <Ionicons name="shield" size={20} color={getRiskColor(risk.level)} />
                <Text style={styles.riskName}>{risk.condition}</Text>
                <View style={[
                  styles.riskLevel,
                  { backgroundColor: `${getRiskColor(risk.level)}15` }
                ]}>
                  <Text style={[styles.riskLevelText, { color: getRiskColor(risk.level) }]}>
                    {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)}
                  </Text>
                </View>
              </View>
              {risk.factors && risk.factors.length > 0 && (
                <View style={styles.riskFactors}>
                  <Text style={styles.riskFactorsLabel}>Risk Factors:</Text>
                  {risk.factors.map((factor, i) => (
                    <Text key={i} style={styles.riskFactor}>• {factor}</Text>
                  ))}
                </View>
              )}
              {risk.recommendation && (
                <Text style={styles.riskRecommendation}>{risk.recommendation}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Health Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Tips</Text>
        <View style={styles.tipsContainer}>
          {(insights?.tips || getDefaultTips()).map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <Ionicons name="leaf" size={18} color={colors.success[600]} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const getCategoryIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    'Heart Health': 'heart',
    'Blood Pressure': 'pulse',
    'Weight Management': 'scale',
    'Physical Activity': 'fitness',
    'Sleep Quality': 'moon',
    'Nutrition': 'nutrition',
    'Mental Health': 'happy',
    'Preventive Care': 'shield-checkmark',
  };
  return iconMap[name] || 'analytics';
};

const getVitalIcon = (type: string): keyof typeof Ionicons.glyphMap => {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    'Blood Pressure': 'pulse',
    'Heart Rate': 'heart',
    'Temperature': 'thermometer',
    'Weight': 'scale',
    'Blood Sugar': 'water',
    'Oxygen Level': 'fitness',
  };
  return iconMap[type] || 'analytics';
};

const getRecommendationColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return colors.error[500];
    case 'medium':
      return colors.warning[500];
    default:
      return colors.success[500];
  }
};

const getTrendIcon = (trend?: 'up' | 'down' | 'stable'): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  switch (trend) {
    case 'up':
      return { name: 'trending-up', color: colors.error[500] };
    case 'down':
      return { name: 'trending-down', color: colors.success[500] };
    case 'stable':
      return { name: 'remove', color: colors.gray[400] };
    default:
      return { name: 'remove', color: colors.gray[400] };
  }
};

const getRiskColor = (level: string) => {
  switch (level) {
    case 'high':
      return colors.error[500];
    case 'moderate':
      return colors.warning[500];
    default:
      return colors.success[500];
  }
};

const getDefaultTips = () => [
  'Stay hydrated - aim for 8 glasses of water daily',
  'Take regular breaks from screens to rest your eyes',
  'Practice deep breathing for stress management',
  'Get at least 7-8 hours of quality sleep',
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scoreCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.md,
  },
  scoreTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.primary[100],
    marginRight: spacing.xl,
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
  },
  scoreMax: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  scoreLabelContainer: {
    alignItems: 'flex-start',
  },
  scoreBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  scoreBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  scoreUpdated: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  categoryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  categoryName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  categoryScore: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  categoryRecommendation: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  vitalCard: {
    width: (screenWidth - spacing.lg * 2 - spacing.md) / 2,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    margin: spacing.xs,
    ...shadows.sm,
  },
  vitalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  vitalType: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  vitalValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  vitalValueAbnormal: {
    color: colors.error[600],
  },
  vitalUnit: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  vitalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vitalPrevious: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
  },
  abnormalIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  recommendationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  recommendationText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  tipsContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  // Lab Analysis Styles
  labCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  labHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  labName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  labStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  labStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  labValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  labValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  labValueAbnormal: {
    color: colors.error[600],
  },
  labRange: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  labInterpretation: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  // Risk Assessment Styles
  riskCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  riskName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  riskLevel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  riskLevelText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  riskFactors: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  riskFactorsLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  riskFactor: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
  riskRecommendation: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});

export default HealthInsightsScreen;
