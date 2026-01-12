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
import { wellnessApi, NutritionSummary, NutritionLog, NutritionPlan } from '../../services/api';
import { NutritionStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<NutritionStackParamList>;

const MEAL_ICONS: Record<string, string> = {
  breakfast: 'sunny-outline',
  lunch: 'partly-sunny-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

const NutritionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState<NutritionSummary | null>(null);
  const [activePlan, setActivePlan] = useState<NutritionPlan | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [summaryRes, planRes] = await Promise.all([
        wellnessApi.getNutritionSummary(),
        wellnessApi.getActivePlan(),
      ]);
      setSummary(summaryRes.data?.data || null);
      setActivePlan(planRes.data?.data || null);
    } catch (error) {
      console.error('Error loading nutrition data:', error);
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

  const getProgressColor = (current: number, goal: number) => {
    const ratio = current / goal;
    if (ratio < 0.7) return colors.success[500];
    if (ratio < 0.9) return colors.warning[500];
    if (ratio <= 1.1) return colors.success[500];
    return colors.error[500];
  };

  const getMacroColor = (macro: string) => {
    switch (macro) {
      case 'protein': return colors.error[500];
      case 'carbs': return colors.warning[500];
      case 'fat': return colors.primary[500];
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

  const calorieProgress = summary ? (summary.totalCalories / summary.calorieGoal) * 100 : 0;
  const calorieRemaining = summary ? Math.max(0, summary.calorieGoal - summary.totalCalories) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Calorie Summary */}
        <View style={styles.calorieCard}>
          <View style={styles.calorieHeader}>
            <Text style={styles.calorieTitle}>Today's Calories</Text>
            <Text style={styles.calorieDate}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>

          <View style={styles.calorieCircle}>
            <View style={styles.calorieContent}>
              <Text style={styles.calorieValue}>
                {summary?.totalCalories.toLocaleString() || 0}
              </Text>
              <Text style={styles.calorieUnit}>cal consumed</Text>
            </View>
            <View style={styles.circleProgress}>
              <View
                style={[
                  styles.circleProgressFill,
                  {
                    width: `${Math.min(calorieProgress, 100)}%`,
                    backgroundColor: getProgressColor(summary?.totalCalories || 0, summary?.calorieGoal || 2000),
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.calorieStats}>
            <View style={styles.calorieStat}>
              <Ionicons name="flame-outline" size={20} color={colors.success[500]} />
              <Text style={styles.calorieStatValue}>{calorieRemaining}</Text>
              <Text style={styles.calorieStatLabel}>Remaining</Text>
            </View>
            <View style={styles.calorieStat}>
              <Ionicons name="restaurant-outline" size={20} color={colors.primary[500]} />
              <Text style={styles.calorieStatValue}>{summary?.calorieGoal || 2000}</Text>
              <Text style={styles.calorieStatLabel}>Goal</Text>
            </View>
          </View>
        </View>

        {/* Macros */}
        {summary && (
          <View style={styles.macrosCard}>
            <Text style={styles.sectionTitle}>Macronutrients</Text>
            <View style={styles.macrosGrid}>
              {[
                { key: 'protein', value: summary.totalProtein, goal: summary.proteinGoal },
                { key: 'carbs', value: summary.totalCarbs, goal: summary.carbsGoal },
                { key: 'fat', value: summary.totalFat, goal: summary.fatGoal },
              ].map((macro) => (
                <View key={macro.key} style={styles.macroItem}>
                  <View style={styles.macroHeader}>
                    <View
                      style={[
                        styles.macroIndicator,
                        { backgroundColor: getMacroColor(macro.key) },
                      ]}
                    />
                    <Text style={styles.macroLabel}>{macro.key}</Text>
                  </View>
                  <Text style={styles.macroValue}>
                    {macro.value}g
                    <Text style={styles.macroGoal}> / {macro.goal}g</Text>
                  </Text>
                  <View style={styles.macroBar}>
                    <View
                      style={[
                        styles.macroBarFill,
                        {
                          width: `${Math.min((macro.value / macro.goal) * 100, 100)}%`,
                          backgroundColor: getMacroColor(macro.key),
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Macro Pie */}
            <View style={styles.macroPie}>
              <View style={styles.macroPieSegments}>
                <View style={[styles.pieSegment, { flex: summary.macroPercentages.protein, backgroundColor: colors.error[500] }]} />
                <View style={[styles.pieSegment, { flex: summary.macroPercentages.carbs, backgroundColor: colors.warning[500] }]} />
                <View style={[styles.pieSegment, { flex: summary.macroPercentages.fat, backgroundColor: colors.primary[500] }]} />
              </View>
              <View style={styles.pieLabels}>
                <Text style={styles.pieLabel}>
                  <Text style={{ color: colors.error[500] }}>{summary.macroPercentages.protein}%</Text> Protein
                </Text>
                <Text style={styles.pieLabel}>
                  <Text style={{ color: colors.warning[500] }}>{summary.macroPercentages.carbs}%</Text> Carbs
                </Text>
                <Text style={styles.pieLabel}>
                  <Text style={{ color: colors.primary[500] }}>{summary.macroPercentages.fat}%</Text> Fat
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Active Plan */}
        {activePlan && (
          <TouchableOpacity
            style={styles.planCard}
            onPress={() => navigation.navigate('NutritionPlan')}
          >
            <View style={styles.planIcon}>
              <Ionicons name="clipboard-outline" size={24} color={colors.primary[600]} />
            </View>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>{activePlan.name}</Text>
              <Text style={styles.planDetails}>
                {activePlan.calorieTarget} cal/day - {activePlan.type.replace('_', ' ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
          </TouchableOpacity>
        )}

        {/* Today's Meals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('LogMeal', {})}>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary[600]} />
            </TouchableOpacity>
          </View>

          <View style={styles.mealsList}>
            {MEAL_ORDER.map((mealType) => {
              const meals = summary?.meals?.[mealType as keyof typeof summary.meals] || [];
              const totalCals = meals.reduce((sum, m) => sum + m.calories, 0);

              return (
                <TouchableOpacity
                  key={mealType}
                  style={styles.mealCard}
                  onPress={() => navigation.navigate('LogMeal', { mealType })}
                >
                  <View style={styles.mealIcon}>
                    <Ionicons
                      name={MEAL_ICONS[mealType] as any}
                      size={24}
                      color={meals.length > 0 ? colors.primary[600] : colors.gray[400]}
                    />
                  </View>
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealTitle}>
                      {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                    </Text>
                    {meals.length > 0 ? (
                      <Text style={styles.mealItems}>
                        {meals.length} {meals.length === 1 ? 'item' : 'items'} logged
                      </Text>
                    ) : (
                      <Text style={styles.mealEmpty}>Tap to add</Text>
                    )}
                  </View>
                  <Text style={[styles.mealCalories, meals.length === 0 && styles.mealCaloriesEmpty]}>
                    {meals.length > 0 ? `${totalCals} cal` : '-'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* View Plan Button */}
        <TouchableOpacity
          style={styles.viewPlanButton}
          onPress={() => navigation.navigate('NutritionPlan')}
        >
          <Ionicons name="restaurant-outline" size={20} color={colors.primary[600]} />
          <Text style={styles.viewPlanText}>View Meal Plans</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('LogMeal', {})}
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
  calorieCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  calorieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  calorieTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  calorieDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  calorieCircle: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  calorieContent: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  calorieValue: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  calorieUnit: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  circleProgress: {
    width: '100%',
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  circleProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  calorieStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  calorieStat: {
    alignItems: 'center',
  },
  calorieStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  calorieStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  macrosCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  macrosGrid: {
    gap: spacing.md,
  },
  macroItem: {},
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  macroIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  macroLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  macroValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  macroGoal: {
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
  },
  macroBar: {
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  macroPie: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  macroPieSegments: {
    flexDirection: 'row',
    width: 100,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginRight: spacing.lg,
  },
  pieSegment: {
    height: '100%',
  },
  pieLabels: {
    flex: 1,
    gap: spacing.xs,
  },
  pieLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  planName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  planDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  mealsList: {
    gap: spacing.md,
  },
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  mealIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  mealTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  mealItems: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  mealEmpty: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
    marginTop: spacing.xs,
  },
  mealCalories: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  mealCaloriesEmpty: {
    color: colors.gray[300],
  },
  viewPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  viewPlanText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
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

export default NutritionScreen;
