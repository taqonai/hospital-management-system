import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import {
  recommendationsApi,
  DailyHealthScore,
  HealthScoreTrend,
} from '../../services/api';

const { width } = Dimensions.get('window');

const SCORE_CATEGORIES = [
  { key: 'sleep', icon: 'moon', label: 'Sleep', color: '#6C5CE7' },
  { key: 'activity', icon: 'fitness', label: 'Activity', color: '#45B7D1' },
  { key: 'nutrition', icon: 'nutrition', label: 'Nutrition', color: '#4ECDC4' },
  { key: 'recovery', icon: 'heart', label: 'Recovery', color: '#FD79A8' },
  { key: 'compliance', icon: 'checkmark-circle', label: 'Compliance', color: '#00B894' },
];

const TREND_INFO: Record<HealthScoreTrend, { icon: string; color: string; label: string }> = {
  IMPROVING: { icon: 'trending-up', color: colors.status.success, label: 'Improving' },
  STABLE: { icon: 'remove', color: colors.status.warning, label: 'Stable' },
  DECLINING: { icon: 'trending-down', color: colors.status.error, label: 'Declining' },
  INSUFFICIENT_DATA: { icon: 'help-circle', color: colors.text.secondary, label: 'More data needed' },
};

function ScoreRing({
  score,
  size = 200,
  strokeWidth = 15,
  color = colors.primary,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (score / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: colors.border.light,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderLeftColor: 'transparent',
          borderBottomColor: score > 25 ? color : 'transparent',
          borderRightColor: score > 50 ? color : 'transparent',
          borderTopColor: score > 75 ? color : 'transparent',
          transform: [{ rotate: '-135deg' }],
        }}
      />
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.scoreValue, { color }]}>{score}</Text>
        <Text style={styles.scoreLabel}>out of 100</Text>
      </View>
    </View>
  );
}

function CategoryScoreBar({
  icon,
  label,
  score,
  color,
}: {
  icon: string;
  label: string;
  score: number;
  color: string;
}) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return colors.status.success;
    if (s >= 60) return colors.status.warning;
    return colors.status.error;
  };

  return (
    <View style={styles.categoryRow}>
      <View style={[styles.categoryIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.categoryLabel}>{label}</Text>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${score}%`, backgroundColor: getScoreColor(score) },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.categoryScore, { color: getScoreColor(score) }]}>{score}</Text>
    </View>
  );
}

export default function HealthScoreScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentScore, setCurrentScore] = useState<DailyHealthScore | null>(null);
  const [history, setHistory] = useState<DailyHealthScore[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [scoreRes, historyRes] = await Promise.all([
        recommendationsApi.getHealthScore(),
        recommendationsApi.getScoreHistory({ limit: 7 }),
      ]);

      if (scoreRes.data?.data?.score) {
        setCurrentScore(scoreRes.data.data.score);
      }
      if (historyRes.data?.data?.scores) {
        setHistory(historyRes.data.data.scores);
      }
    } catch (err: any) {
      console.error('Failed to fetch health score:', err);
      // Use mock data for demo
      setCurrentScore({
        date: new Date().toISOString(),
        overall: 72,
        sleep: 68,
        activity: 75,
        nutrition: 70,
        recovery: 78,
        compliance: 65,
        trend: 'IMPROVING',
        insights: [
          'Your sleep has improved this week',
          'Activity levels are meeting your goals',
          'Consider adding more vegetables to your meals',
        ],
        dataQuality: 0.85,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getOverallScoreColor = (score: number) => {
    if (score >= 80) return colors.status.success;
    if (score >= 60) return colors.primary;
    if (score >= 40) return colors.status.warning;
    return colors.status.error;
  };

  const renderTrendBadge = () => {
    if (!currentScore) return null;
    const trend = TREND_INFO[currentScore.trend];
    return (
      <View style={[styles.trendBadge, { backgroundColor: trend.color + '20' }]}>
        <Ionicons name={trend.icon as any} size={16} color={trend.color} />
        <Text style={[styles.trendText, { color: trend.color }]}>{trend.label}</Text>
      </View>
    );
  };

  const renderInsights = () => {
    if (!currentScore || !currentScore.insights.length) return null;
    return (
      <View style={styles.insightsCard}>
        <View style={styles.insightsHeader}>
          <Ionicons name="bulb" size={20} color={colors.status.warning} />
          <Text style={styles.insightsTitle}>Today's Insights</Text>
        </View>
        {currentScore.insights.map((insight, index) => (
          <View key={index} style={styles.insightItem}>
            <View style={styles.insightBullet} />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderHistoryChart = () => {
    if (history.length === 0) return null;

    const maxScore = 100;
    const chartHeight = 100;

    return (
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Last 7 Days</Text>
        <View style={styles.chartContainer}>
          {history.slice(0, 7).reverse().map((day, index) => {
            const barHeight = (day.overall / maxScore) * chartHeight;
            const isToday = index === history.length - 1;
            return (
              <View key={index} style={styles.chartBar}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: isToday
                          ? getOverallScoreColor(day.overall)
                          : colors.primary + '60',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Calculating your health score...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health Score</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Main Score Ring */}
        <View style={styles.scoreSection}>
          <ScoreRing
            score={currentScore?.overall || 0}
            size={200}
            color={getOverallScoreColor(currentScore?.overall || 0)}
          />
          {renderTrendBadge()}
          <Text style={styles.dateLabel}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Category Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={styles.sectionTitle}>Score Breakdown</Text>
          <View style={styles.breakdownCard}>
            {SCORE_CATEGORIES.map((category) => (
              <CategoryScoreBar
                key={category.key}
                icon={category.icon}
                label={category.label}
                score={(currentScore as any)?.[category.key] || 0}
                color={category.color}
              />
            ))}
          </View>
        </View>

        {/* Insights */}
        {renderInsights()}

        {/* History Chart */}
        {renderHistoryChart()}

        {/* Data Quality */}
        {currentScore && (
          <View style={styles.dataQualitySection}>
            <View style={styles.dataQualityHeader}>
              <Ionicons name="analytics" size={16} color={colors.text.secondary} />
              <Text style={styles.dataQualityLabel}>Data Quality</Text>
            </View>
            <View style={styles.dataQualityBar}>
              <View
                style={[
                  styles.dataQualityFill,
                  { width: `${currentScore.dataQuality * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.dataQualityText}>
              {Math.round(currentScore.dataQuality * 100)}% - Connect more devices for better accuracy
            </Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate('Recommendations' as never)}
        >
          <Ionicons name="bulb" size={20} color={colors.white} />
          <Text style={styles.ctaButtonText}>View Recommendations</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </TouchableOpacity>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scoreSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '700',
  },
  scoreLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  trendText: {
    ...typography.caption,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  dateLabel: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  breakdownSection: {
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  breakdownCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    ...typography.body,
    color: colors.text.primary,
    width: 80,
    marginLeft: spacing.sm,
  },
  progressBarContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border.light,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  categoryScore: {
    ...typography.subtitle,
    width: 30,
    textAlign: 'right',
  },
  insightsCard: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.status.warning + '10',
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.status.warning,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  insightsTitle: {
    ...typography.subtitle,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
  },
  insightBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.warning,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  insightText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  historySection: {
    padding: spacing.md,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 130,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    height: 100,
    justifyContent: 'flex-end',
    width: 20,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  dataQualitySection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  dataQualityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dataQualityLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  dataQualityBar: {
    height: 4,
    backgroundColor: colors.border.light,
    borderRadius: 2,
    overflow: 'hidden',
  },
  dataQualityFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  dataQualityText: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  ctaButtonText: {
    ...typography.button,
    color: colors.white,
    marginHorizontal: spacing.sm,
  },
});
