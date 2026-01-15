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
import { wellnessApi, FitnessActivity, FitnessGoal, FitnessStats } from '../../services/api';
import { FitnessStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<FitnessStackParamList>;

const ACTIVITY_ICONS: Record<string, string> = {
  walking: 'walk-outline',
  running: 'fitness-outline',
  cycling: 'bicycle-outline',
  swimming: 'water-outline',
  yoga: 'body-outline',
  strength_training: 'barbell-outline',
  hiit: 'flash-outline',
  hiking: 'trail-sign-outline',
  sports: 'basketball-outline',
  cardio: 'heart-outline',
  other: 'ellipsis-horizontal-outline',
};

// Demo data removed - using real API data only

const FitnessTrackerScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activities, setActivities] = useState<FitnessActivity[]>([]);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [stats, setStats] = useState<FitnessStats | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [activitiesRes, goalsRes, statsRes] = await Promise.all([
        wellnessApi.getActivities({ limit: 5 }),
        wellnessApi.getFitnessGoals(true),
        wellnessApi.getFitnessStats('week'),
      ]);
      // Use real data from API - empty arrays are valid (user has no data yet)
      setActivities(activitiesRes.data?.data || []);
      setGoals(goalsRes.data?.data || []);
      setStats(statsRes.data?.data || null);
    } catch (error) {
      console.error('Error loading fitness data:', error);
      // On error, show empty state (no demo data)
      setActivities([]);
      setGoals([]);
      setStats(null);
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

  const formatDuration = (minutes: number | undefined | null) => {
    // Handle null, undefined, or NaN
    if (minutes === null || minutes === undefined || isNaN(minutes)) return '0min';
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'low': return colors.success[500];
      case 'moderate': return colors.warning[500];
      case 'high': return colors.error[500];
      case 'very_high': return colors.error[700];
      default: return colors.gray[500];
    }
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
        {/* Weekly Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>This Week</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats?.totalWorkouts ?? 0}</Text>
              <Text style={styles.summaryLabel}>Workouts</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatDuration(stats?.totalDuration)}</Text>
              <Text style={styles.summaryLabel}>Duration</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{(stats?.totalCalories ?? 0).toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Calories</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats?.streakDays ?? 0}</Text>
              <Text style={styles.summaryLabel}>Streak</Text>
            </View>
          </View>
        </View>

        {/* Active Goals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Goals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('FitnessGoals')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {goals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={40} color={colors.gray[300]} />
              <Text style={styles.emptyText}>No active goals</Text>
              <TouchableOpacity
                style={styles.addGoalButton}
                onPress={() => navigation.navigate('FitnessGoals')}
              >
                <Text style={styles.addGoalText}>Set a Goal</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.goalsList}>
              {goals.slice(0, 3).map((goal) => (
                <View key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalInfo}>
                    <Text style={styles.goalType}>
                      {goal.type.replace('_', ' ')} ({goal.period})
                    </Text>
                    <Text style={styles.goalProgress}>
                      {goal.currentValue.toLocaleString()} / {goal.target.toLocaleString()} {goal.unit}
                    </Text>
                  </View>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.min(goal.progress, 100)}%` },
                          goal.progress >= 100 && styles.progressComplete,
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{Math.round(goal.progress)}%</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <TouchableOpacity onPress={() => navigation.navigate('FitnessStats')}>
              <Text style={styles.seeAllText}>View Stats</Text>
            </TouchableOpacity>
          </View>

          {activities.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="fitness-outline" size={40} color={colors.gray[300]} />
              <Text style={styles.emptyText}>No activities yet</Text>
              <Text style={styles.emptySubtext}>Log your first workout to get started</Text>
            </View>
          ) : (
            <View style={styles.activitiesList}>
              {activities.map((activity) => (
                <View key={activity.id} style={styles.activityCard}>
                  <View style={styles.activityIcon}>
                    <Ionicons
                      name={ACTIVITY_ICONS[activity.type] as any || 'fitness-outline'}
                      size={24}
                      color={colors.primary[600]}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>
                      {activity.name || activity.type.replace('_', ' ')}
                    </Text>
                    <Text style={styles.activityDetails}>
                      {formatDuration(activity.duration)} · {activity.caloriesBurned} cal
                      {activity.distance ? ` · ${activity.distance} ${activity.distanceUnit}` : ''}
                    </Text>
                  </View>
                  <View style={styles.activityMeta}>
                    <View
                      style={[
                        styles.intensityBadge,
                        { backgroundColor: getIntensityColor(activity.intensity) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.intensityText,
                          { color: getIntensityColor(activity.intensity) },
                        ]}
                      >
                        {activity.intensity}
                      </Text>
                    </View>
                    <Text style={styles.activityDate}>{formatDate(activity.startTime)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('LogActivity', {})}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
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
    paddingBottom: spacing['5xl'],
  },
  summaryCard: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    marginBottom: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[100],
    marginTop: spacing.xs,
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
  },
  seeAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  goalInfo: {
    marginBottom: spacing.md,
  },
  goalType: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  goalProgress: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[600],
    borderRadius: 4,
  },
  progressComplete: {
    backgroundColor: colors.success[500],
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    width: 40,
    textAlign: 'right',
  },
  activitiesList: {
    gap: spacing.md,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  activityName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  activityDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  activityMeta: {
    alignItems: 'flex-end',
  },
  intensityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  intensityText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  activityDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});

export default FitnessTrackerScreen;
