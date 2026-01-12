import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, FitnessStats, FitnessActivity } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

type Period = 'week' | 'month' | 'year';

const FitnessStatsScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<FitnessStats | null>(null);
  const [activities, setActivities] = useState<FitnessActivity[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, activitiesRes] = await Promise.all([
        wellnessApi.getFitnessStats(period),
        wellnessApi.getActivities({ limit: 20 }),
      ]);
      setStats(statsRes.data?.data || null);
      setActivities(activitiesRes.data?.data || []);
    } catch (error) {
      console.error('Error loading fitness stats:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getActivityTypeDistribution = () => {
    const distribution: Record<string, number> = {};
    activities.forEach((activity) => {
      const type = activity.type;
      distribution[type] = (distribution[type] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([type, count]) => ({ type, count, percentage: Math.round((count / activities.length) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  const getMaxValue = (data: number[]) => Math.max(...data, 1);

  const renderBarChart = (data: { label: string; value: number }[], maxValue: number, unit: string) => {
    return (
      <View style={styles.barChart}>
        {data.map((item, index) => (
          <View key={index} style={styles.barContainer}>
            <View style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max((item.value / maxValue) * 100, 5)}%` },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const activityDistribution = getActivityTypeDistribution();

  // Prepare daily data for charts
  const dailyData = stats?.dailyStats || [];
  const caloriesData = dailyData.map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
    value: d.calories,
  }));
  const durationData = dailyData.map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
    value: d.duration,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['week', 'month', 'year'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodButton, period === p && styles.periodButtonActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview Stats */}
        {stats && (
          <View style={styles.overviewCard}>
            <Text style={styles.cardTitle}>Overview</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Ionicons name="fitness-outline" size={24} color={colors.primary[600]} />
                <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
                <Text style={styles.statLabel}>Workouts</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={24} color={colors.warning[500]} />
                <Text style={styles.statValue}>{formatDuration(stats.totalDuration)}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="flame-outline" size={24} color={colors.error[500]} />
                <Text style={styles.statValue}>{stats.totalCalories.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="map-outline" size={24} color={colors.success[500]} />
                <Text style={styles.statValue}>{stats.totalDistance.toFixed(1)}</Text>
                <Text style={styles.statLabel}>km</Text>
              </View>
            </View>
          </View>
        )}

        {/* Streak and Average */}
        {stats && (
          <View style={styles.row}>
            <View style={[styles.highlightCard, styles.streakCard]}>
              <View style={styles.highlightIcon}>
                <Ionicons name="flame" size={28} color={colors.warning[600]} />
              </View>
              <Text style={styles.highlightValue}>{stats.streakDays}</Text>
              <Text style={styles.highlightLabel}>Day Streak</Text>
            </View>
            <View style={[styles.highlightCard, styles.avgCard]}>
              <View style={styles.highlightIcon}>
                <Ionicons name="trending-up" size={28} color={colors.success[600]} />
              </View>
              <Text style={styles.highlightValue}>{stats.avgWorkoutsPerWeek.toFixed(1)}</Text>
              <Text style={styles.highlightLabel}>Avg/Week</Text>
            </View>
          </View>
        )}

        {/* Calories Chart */}
        {dailyData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Calories Burned</Text>
            {renderBarChart(caloriesData, getMaxValue(caloriesData.map(d => d.value)), 'cal')}
          </View>
        )}

        {/* Duration Chart */}
        {dailyData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Workout Duration</Text>
            {renderBarChart(durationData, getMaxValue(durationData.map(d => d.value)), 'min')}
          </View>
        )}

        {/* Activity Distribution */}
        {activityDistribution.length > 0 && (
          <View style={styles.distributionCard}>
            <Text style={styles.cardTitle}>Activity Distribution</Text>
            <View style={styles.distributionList}>
              {activityDistribution.map((item) => (
                <View key={item.type} style={styles.distributionItem}>
                  <View style={styles.distributionInfo}>
                    <Text style={styles.distributionType}>
                      {item.type.replace('_', ' ')}
                    </Text>
                    <Text style={styles.distributionCount}>
                      {item.count} {item.count === 1 ? 'workout' : 'workouts'}
                    </Text>
                  </View>
                  <View style={styles.distributionBarContainer}>
                    <View
                      style={[
                        styles.distributionBar,
                        { width: `${item.percentage}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.distributionPercent}>{item.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Favorite Activity */}
        {stats?.favoriteActivity && (
          <View style={styles.favoriteCard}>
            <Ionicons name="heart" size={24} color={colors.error[500]} />
            <View style={styles.favoriteInfo}>
              <Text style={styles.favoriteLabel}>Favorite Activity</Text>
              <Text style={styles.favoriteValue}>
                {stats.favoriteActivity.replace('_', ' ')}
              </Text>
            </View>
          </View>
        )}
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
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  periodButtonActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  periodText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  periodTextActive: {
    color: colors.primary[600],
  },
  overviewCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  streakCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
  avgCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success[500],
  },
  highlightIcon: {
    marginBottom: spacing.sm,
  },
  highlightValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  highlightLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    paddingTop: spacing.md,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    flex: 1,
    width: '60%',
    justifyContent: 'flex-end',
  },
  bar: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.sm,
    minHeight: 4,
  },
  barLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  distributionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  distributionList: {
    gap: spacing.md,
  },
  distributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distributionInfo: {
    width: 100,
  },
  distributionType: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  distributionCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  distributionBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    marginHorizontal: spacing.md,
    overflow: 'hidden',
  },
  distributionBar: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 4,
  },
  distributionPercent: {
    width: 40,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'right',
  },
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  favoriteInfo: {
    flex: 1,
  },
  favoriteLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  favoriteValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textTransform: 'capitalize',
    marginTop: spacing.xs,
  },
});

export default FitnessStatsScreen;
