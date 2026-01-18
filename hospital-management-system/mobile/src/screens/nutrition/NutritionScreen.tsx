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
import { wellnessApi, NutritionSummary, NutritionPlan } from '../../services/api';
import { NutritionStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<NutritionStackParamList>;

const MEAL_ICONS: Record<string, string> = {
  breakfast: 'sunny-outline',
  lunch: 'partly-sunny-outline',
  dinner: 'moon-outline',
  snack: 'cafe-outline',
};

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

// Default empty summary - used as initial state
const DEFAULT_SUMMARY: NutritionSummary = {
  date: new Date().toISOString().split('T')[0],
  totalCalories: 0,
  calorieGoal: 2000,
  totalProtein: 0,
  proteinGoal: 120,
  totalCarbs: 0,
  carbsGoal: 250,
  totalFat: 0,
  fatGoal: 65,
  totalFiber: 0,
  macroPercentages: { protein: 0, carbs: 0, fat: 0 },
  meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
};

const NutritionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Initialize with default summary - NEVER null
  const [summary, setSummary] = useState<NutritionSummary>(DEFAULT_SUMMARY);
  const [activePlan, setActivePlan] = useState<NutritionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [summaryRes, planRes] = await Promise.all([
        wellnessApi.getNutritionSummary().catch(() => ({ data: { data: null } })),
        wellnessApi.getActivePlan().catch(() => ({ data: { data: null } })),
      ]);

      // Transform backend response to match mobile expected format
      const rawSummary = summaryRes?.data?.data as any;

      if (rawSummary && typeof rawSummary === 'object') {
        // Backend returns byMealType with uppercase keys, we need meals with lowercase
        const byMealType = rawSummary.byMealType || {};

        // Safely transform meals
        const safeMealTransform = (mealData: any, mealType: string) => {
          if (!mealData?.meals || !Array.isArray(mealData.meals)) return [];
          return mealData.meals.map((name: any, i: number) => ({
            id: `${mealType}-${i}`,
            name: String(name || 'Unnamed meal'),
            calories: Math.round((Number(mealData?.calories) || 0) / Math.max(mealData?.meals?.length || 1, 1)),
            protein: 0,
            carbs: 0,
            fat: 0,
            mealType,
            timestamp: new Date().toISOString(),
          }));
        };

        const transformedSummary: NutritionSummary = {
          date: rawSummary.date || new Date().toISOString().split('T')[0],
          totalCalories: Number(rawSummary.totalCalories) || 0,
          calorieGoal: Number(rawSummary.calorieGoal) || 2000,
          totalProtein: Number(rawSummary.totalProtein) || 0,
          proteinGoal: Number(rawSummary.proteinGoal) || 120,
          totalCarbs: Number(rawSummary.totalCarbs) || 0,
          carbsGoal: Number(rawSummary.carbsGoal) || 250,
          totalFat: Number(rawSummary.totalFat) || 0,
          fatGoal: Number(rawSummary.fatGoal) || 65,
          totalFiber: Number(rawSummary.totalFiber) || 0,
          macroPercentages: {
            protein: Number(rawSummary.macroPercentages?.protein) || 0,
            carbs: Number(rawSummary.macroPercentages?.carbs) || 0,
            fat: Number(rawSummary.macroPercentages?.fat) || 0,
          },
          meals: {
            breakfast: safeMealTransform(byMealType.BREAKFAST, 'breakfast'),
            lunch: safeMealTransform(byMealType.LUNCH, 'lunch'),
            dinner: safeMealTransform(byMealType.DINNER, 'dinner'),
            snack: [
              ...safeMealTransform(byMealType.MORNING_SNACK, 'snack'),
              ...safeMealTransform(byMealType.AFTERNOON_SNACK, 'snack'),
              ...safeMealTransform(byMealType.EVENING_SNACK, 'snack'),
            ],
          },
        };
        setSummary(transformedSummary);
      }
      // If no rawSummary, keep the default summary (already set as initial state)

      setActivePlan(planRes?.data?.data || null);
    } catch (err) {
      console.error('Error loading nutrition data:', err);
      setError('Unable to load nutrition data');
      // Keep default summary on error
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
    if (goal === 0) return colors.gray[400];
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

  // Show loading spinner only on initial load
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading nutrition data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate values safely
  const totalCalories = summary.totalCalories || 0;
  const calorieGoal = summary.calorieGoal || 2000;
  const calorieProgress = calorieGoal > 0 ? (totalCalories / calorieGoal) * 100 : 0;
  const calorieRemaining = Math.max(0, calorieGoal - totalCalories);

  // Check if user has any data
  const hasNoData = totalCalories === 0 &&
    (!summary.meals?.breakfast?.length) &&
    (!summary.meals?.lunch?.length) &&
    (!summary.meals?.dinner?.length) &&
    (!summary.meals?.snack?.length);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Error Message */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={20} color={colors.warning[700]} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Calorie Summary Card - Always show */}
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
                {totalCalories.toLocaleString()}
              </Text>
              <Text style={styles.calorieUnit}>cal consumed</Text>
            </View>
            <View style={styles.circleProgress}>
              <View
                style={[
                  styles.circleProgressFill,
                  {
                    width: `${Math.min(Math.max(calorieProgress, 0), 100)}%`,
                    backgroundColor: getProgressColor(totalCalories, calorieGoal),
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.calorieStats}>
            <View style={styles.calorieStat}>
              <Ionicons name="flame-outline" size={20} color={colors.success[500]} />
              <Text style={styles.calorieStatValue}>{calorieRemaining.toLocaleString()}</Text>
              <Text style={styles.calorieStatLabel}>Remaining</Text>
            </View>
            <View style={styles.calorieStat}>
              <Ionicons name="restaurant-outline" size={20} color={colors.primary[500]} />
              <Text style={styles.calorieStatValue}>{calorieGoal.toLocaleString()}</Text>
              <Text style={styles.calorieStatLabel}>Goal</Text>
            </View>
          </View>
        </View>

        {/* Macros Card - Always show */}
        <View style={styles.macrosCard}>
          <Text style={styles.sectionTitle}>Macronutrients</Text>
          <View style={styles.macrosGrid}>
            {[
              { key: 'protein', value: summary.totalProtein || 0, goal: summary.proteinGoal || 120 },
              { key: 'carbs', value: summary.totalCarbs || 0, goal: summary.carbsGoal || 250 },
              { key: 'fat', value: summary.totalFat || 0, goal: summary.fatGoal || 65 },
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
                        width: `${Math.min(Math.max((macro.value / macro.goal) * 100, 0), 100)}%`,
                        backgroundColor: getMacroColor(macro.key),
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Macro Distribution */}
          <View style={styles.macroPie}>
            <View style={styles.macroPieSegments}>
              <View style={[styles.pieSegment, { flex: Math.max(summary.macroPercentages?.protein || 1, 1), backgroundColor: colors.error[500] }]} />
              <View style={[styles.pieSegment, { flex: Math.max(summary.macroPercentages?.carbs || 1, 1), backgroundColor: colors.warning[500] }]} />
              <View style={[styles.pieSegment, { flex: Math.max(summary.macroPercentages?.fat || 1, 1), backgroundColor: colors.primary[500] }]} />
            </View>
            <View style={styles.pieLabels}>
              <Text style={styles.pieLabel}>
                <Text style={{ color: colors.error[500] }}>{summary.macroPercentages?.protein || 0}%</Text> Protein
              </Text>
              <Text style={styles.pieLabel}>
                <Text style={{ color: colors.warning[500] }}>{summary.macroPercentages?.carbs || 0}%</Text> Carbs
              </Text>
              <Text style={styles.pieLabel}>
                <Text style={{ color: colors.primary[500] }}>{summary.macroPercentages?.fat || 0}%</Text> Fat
              </Text>
            </View>
          </View>
        </View>

        {/* Active Plan - Only show if exists */}
        {activePlan && (
          <TouchableOpacity
            style={styles.planCard}
            onPress={() => navigation.navigate('NutritionPlan')}
          >
            <View style={styles.planIcon}>
              <Ionicons name="clipboard-outline" size={24} color={colors.primary[600]} />
            </View>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>{activePlan.name || 'Nutrition Plan'}</Text>
              <Text style={styles.planDetails}>
                {activePlan.calorieTarget || 2000} cal/day - {(activePlan.type || 'custom').replace('_', ' ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
          </TouchableOpacity>
        )}

        {/* Today's Meals - Always show */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Meals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('LogMeal', {})}>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary[600]} />
            </TouchableOpacity>
          </View>

          {hasNoData && (
            <View style={styles.noDataHint}>
              <Ionicons name="information-circle-outline" size={18} color={colors.info[600]} />
              <Text style={styles.noDataHintText}>Tap on a meal to start logging your food</Text>
            </View>
          )}

          <View style={styles.mealsList}>
            {MEAL_ORDER.map((mealType) => {
              const meals = summary.meals?.[mealType as keyof typeof summary.meals] || [];
              const totalCals = Array.isArray(meals)
                ? meals.reduce((sum, m) => sum + (Number(m?.calories) || 0), 0)
                : 0;

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
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
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
  noDataHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  noDataHintText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.info[700],
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
