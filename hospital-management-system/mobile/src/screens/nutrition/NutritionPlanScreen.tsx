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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, NutritionPlan, GenerateMealPlanData } from '../../services/api';

const PLAN_TYPES = [
  { type: 'weight_loss', label: 'Weight Loss', icon: 'trending-down', description: 'Calorie deficit plan' },
  { type: 'muscle_gain', label: 'Muscle Gain', icon: 'barbell', description: 'High protein plan' },
  { type: 'maintenance', label: 'Maintenance', icon: 'scale', description: 'Balanced nutrition' },
  { type: 'medical', label: 'Medical', icon: 'medical', description: 'Health-focused plan' },
] as const;

const DIETARY_RESTRICTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'Low-Carb',
  'Halal',
  'Kosher',
];

const NutritionPlanScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [activePlan, setActivePlan] = useState<NutritionPlan | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // AI Plan generation state
  const [selectedGoal, setSelectedGoal] = useState<typeof PLAN_TYPES[number] | null>(null);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [plansRes, activeRes] = await Promise.all([
        wellnessApi.getNutritionPlans(),
        wellnessApi.getActivePlan(),
      ]);
      setPlans(plansRes.data?.data || []);
      setActivePlan(activeRes.data?.data || null);
    } catch (error) {
      console.error('Error loading nutrition plans:', error);
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

  const handleActivatePlan = async (planId: string) => {
    try {
      await wellnessApi.setActivePlan(planId);
      loadData();
      Alert.alert('Success', 'Meal plan activated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to activate plan');
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedGoal) {
      Alert.alert('Error', 'Please select a goal');
      return;
    }

    setIsGenerating(true);
    try {
      const data: GenerateMealPlanData = {
        goal: selectedGoal.type as any,
        dietaryRestrictions: selectedRestrictions,
        mealsPerDay: 3,
        duration: 7,
      };

      await wellnessApi.generateAIMealPlan(data);
      setShowGenerateModal(false);
      resetForm();
      loadData();
      Alert.alert('Success', 'AI meal plan generated! Check your plans to activate it.');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to generate meal plan. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setSelectedGoal(null);
    setSelectedRestrictions([]);
  };

  const toggleRestriction = (restriction: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(restriction)
        ? prev.filter((r) => r !== restriction)
        : [...prev, restriction]
    );
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
        {/* AI Generate Button */}
        <TouchableOpacity
          style={styles.generateCard}
          onPress={() => setShowGenerateModal(true)}
        >
          <View style={styles.generateIcon}>
            <Ionicons name="sparkles" size={28} color={colors.primary[600]} />
          </View>
          <View style={styles.generateInfo}>
            <Text style={styles.generateTitle}>Generate AI Meal Plan</Text>
            <Text style={styles.generateDesc}>
              Get a personalized meal plan based on your goals and preferences
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
        </TouchableOpacity>

        {/* Active Plan */}
        {activePlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Plan</Text>
            <View style={[styles.planCard, styles.activePlanCard]}>
              <View style={styles.planBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success[600]} />
                <Text style={styles.planBadgeText}>Active</Text>
              </View>
              <Text style={styles.planName}>{activePlan.name}</Text>
              <Text style={styles.planDescription}>{activePlan.description}</Text>
              <View style={styles.planStats}>
                <View style={styles.planStat}>
                  <Text style={styles.planStatValue}>{activePlan.calorieTarget || 0}</Text>
                  <Text style={styles.planStatLabel}>Calories/day</Text>
                </View>
                <View style={styles.planStat}>
                  <Text style={styles.planStatValue}>{activePlan.macros?.protein || 0}g</Text>
                  <Text style={styles.planStatLabel}>Protein</Text>
                </View>
                <View style={styles.planStat}>
                  <Text style={styles.planStatValue}>{activePlan.macros?.carbs || 0}g</Text>
                  <Text style={styles.planStatLabel}>Carbs</Text>
                </View>
                <View style={styles.planStat}>
                  <Text style={styles.planStatValue}>{activePlan.macros?.fat || 0}g</Text>
                  <Text style={styles.planStatLabel}>Fat</Text>
                </View>
              </View>
              {activePlan.restrictions && activePlan.restrictions.length > 0 && (
                <View style={styles.restrictionsList}>
                  {activePlan.restrictions.map((r, i) => (
                    <View key={i} style={styles.restrictionBadge}>
                      <Text style={styles.restrictionText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* All Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Plans</Text>
          {plans.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="clipboard-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>No meal plans yet</Text>
              <Text style={styles.emptyText}>
                Generate an AI meal plan or create one manually
              </Text>
            </View>
          ) : (
            <View style={styles.plansList}>
              {plans.map((plan) => (
                <View key={plan.id} style={styles.planCard}>
                  <View style={styles.planHeader}>
                    <View style={styles.planTypeIcon}>
                      <Ionicons
                        name={PLAN_TYPES.find(t => t.type === plan.type)?.icon as any || 'restaurant'}
                        size={20}
                        color={colors.primary[600]}
                      />
                    </View>
                    <View style={styles.planTitleContainer}>
                      <Text style={styles.planName}>{plan.name || 'Untitled Plan'}</Text>
                      <Text style={styles.planType}>{(plan.type || 'general').replace('_', ' ')}</Text>
                    </View>
                    {plan.isActive ? (
                      <View style={styles.activeBadge}>
                        <Ionicons name="checkmark" size={14} color={colors.success[600]} />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.activateButton}
                        onPress={() => handleActivatePlan(plan.id)}
                      >
                        <Text style={styles.activateText}>Activate</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.planCalories}>
                    {plan.calorieTarget || 0} cal/day
                  </Text>
                  <Text style={styles.planMacros}>
                    {plan.macros?.protein || 0}g protein · {plan.macros?.carbs || 0}g carbs · {plan.macros?.fat || 0}g fat
                  </Text>
                  <Text style={styles.planCreator}>
                    Created by: {plan.createdBy === 'ai' ? 'AI' : (plan.createdBy || 'Unknown')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Generate Plan Modal */}
      <Modal
        visible={showGenerateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowGenerateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Generate AI Meal Plan</Text>
              <TouchableOpacity onPress={() => {
                setShowGenerateModal(false);
                resetForm();
              }}>
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Goal Selection */}
              <Text style={styles.fieldLabel}>What's your goal?</Text>
              <View style={styles.goalGrid}>
                {PLAN_TYPES.map((goal) => (
                  <TouchableOpacity
                    key={goal.type}
                    style={[
                      styles.goalOption,
                      selectedGoal?.type === goal.type && styles.goalOptionSelected,
                    ]}
                    onPress={() => setSelectedGoal(goal)}
                  >
                    <Ionicons
                      name={goal.icon as any}
                      size={24}
                      color={selectedGoal?.type === goal.type ? colors.primary[600] : colors.gray[500]}
                    />
                    <Text
                      style={[
                        styles.goalLabel,
                        selectedGoal?.type === goal.type && styles.goalLabelSelected,
                      ]}
                    >
                      {goal.label}
                    </Text>
                    <Text style={styles.goalDesc}>{goal.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Dietary Restrictions */}
              <Text style={styles.fieldLabel}>Dietary Restrictions (Optional)</Text>
              <View style={styles.restrictionsGrid}>
                {DIETARY_RESTRICTIONS.map((restriction) => (
                  <TouchableOpacity
                    key={restriction}
                    style={[
                      styles.restrictionOption,
                      selectedRestrictions.includes(restriction) && styles.restrictionOptionSelected,
                    ]}
                    onPress={() => toggleRestriction(restriction)}
                  >
                    <Text
                      style={[
                        styles.restrictionOptionText,
                        selectedRestrictions.includes(restriction) && styles.restrictionOptionTextSelected,
                      ]}
                    >
                      {restriction}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.generateButton, (!selectedGoal || isGenerating) && styles.generateButtonDisabled]}
              onPress={handleGeneratePlan}
              disabled={!selectedGoal || isGenerating}
            >
              {isGenerating ? (
                <>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.generateButtonText}>Generating...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color={colors.white} />
                  <Text style={styles.generateButtonText}>Generate Plan</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  generateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
  },
  generateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  generateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  generateDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginTop: spacing.xs,
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
  planCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  activePlanCard: {
    borderWidth: 2,
    borderColor: colors.success[500],
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  planBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[600],
  },
  planName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  planDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  planStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  planStat: {
    alignItems: 'center',
  },
  planStatValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  planStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  restrictionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  restrictionBadge: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  restrictionText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  plansList: {
    gap: spacing.md,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  planTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  planTitleContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  planType: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textTransform: 'capitalize',
    marginTop: spacing.xs,
  },
  activeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  activateButton: {
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  activateText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  planCalories: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  planMacros: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  planCreator: {
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
    marginTop: spacing.sm,
    textTransform: 'capitalize',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  modalBody: {
    padding: spacing.lg,
    maxHeight: 400,
  },
  fieldLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  goalOption: {
    width: '48%',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  goalLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  goalLabelSelected: {
    color: colors.primary[600],
  },
  goalDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  restrictionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  restrictionOption: {
    backgroundColor: colors.gray[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  restrictionOptionSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
  },
  restrictionOptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  restrictionOptionTextSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  generateButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary[600],
    margin: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  generateButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  generateButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default NutritionPlanScreen;
