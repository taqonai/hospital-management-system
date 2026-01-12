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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, FitnessGoal, CreateFitnessGoalData } from '../../services/api';

const GOAL_TYPES = [
  { type: 'steps', label: 'Steps', unit: 'steps', icon: 'footsteps-outline', defaultTarget: 10000 },
  { type: 'calories', label: 'Calories', unit: 'cal', icon: 'flame-outline', defaultTarget: 500 },
  { type: 'duration', label: 'Duration', unit: 'min', icon: 'time-outline', defaultTarget: 30 },
  { type: 'workouts', label: 'Workouts', unit: 'workouts', icon: 'fitness-outline', defaultTarget: 5 },
  { type: 'distance', label: 'Distance', unit: 'km', icon: 'map-outline', defaultTarget: 5 },
] as const;

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

const FitnessGoalsScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [goals, setGoals] = useState<FitnessGoal[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // New goal form state
  const [newGoalType, setNewGoalType] = useState<typeof GOAL_TYPES[number] | null>(null);
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalPeriod, setNewGoalPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const loadGoals = useCallback(async () => {
    try {
      const response = await wellnessApi.getFitnessGoals();
      setGoals(response.data?.data || []);
    } catch (error) {
      console.error('Error loading fitness goals:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadGoals();
  };

  const handleCreateGoal = async () => {
    if (!newGoalType) {
      Alert.alert('Error', 'Please select a goal type');
      return;
    }

    const target = parseInt(newGoalTarget) || newGoalType.defaultTarget;

    setIsCreating(true);
    try {
      const data: CreateFitnessGoalData = {
        type: newGoalType.type as any,
        target,
        period: newGoalPeriod,
      };

      await wellnessApi.createFitnessGoal(data);
      setShowCreateModal(false);
      resetForm();
      loadGoals();
      Alert.alert('Success', 'Goal created successfully!');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to create goal. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGoal = (goal: FitnessGoal) => {
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete this ${goal.type} goal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await wellnessApi.deleteFitnessGoal(goal.id);
              loadGoals();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete goal');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setNewGoalType(null);
    setNewGoalTarget('');
    setNewGoalPeriod('daily');
  };

  const getGoalIcon = (type: string) => {
    return GOAL_TYPES.find(g => g.type === type)?.icon || 'trophy-outline';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const activeGoals = goals.filter(g => g.isActive);
  const completedGoals = goals.filter(g => !g.isActive || g.progress >= 100);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Active Goals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Goals</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={20} color={colors.primary[600]} />
              <Text style={styles.addButtonText}>Add Goal</Text>
            </TouchableOpacity>
          </View>

          {activeGoals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>No active goals</Text>
              <Text style={styles.emptyText}>
                Set fitness goals to track your progress and stay motivated
              </Text>
            </View>
          ) : (
            <View style={styles.goalsList}>
              {activeGoals.map((goal) => (
                <View key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <View style={styles.goalIconContainer}>
                      <Ionicons
                        name={getGoalIcon(goal.type) as any}
                        size={24}
                        color={colors.primary[600]}
                      />
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalTitle}>
                        {goal.type.replace('_', ' ')}
                      </Text>
                      <Text style={styles.goalSubtitle}>
                        {goal.period} goal
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteGoal(goal)}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error[500]} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.goalProgress}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressValue}>
                        {goal.currentValue.toLocaleString()}
                        <Text style={styles.progressTarget}>
                          {' / '}{goal.target.toLocaleString()} {goal.unit}
                        </Text>
                      </Text>
                      <Text
                        style={[
                          styles.progressPercent,
                          goal.progress >= 100 && styles.progressComplete,
                        ]}
                      >
                        {Math.round(goal.progress)}%
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.min(goal.progress, 100)}%` },
                          goal.progress >= 100 && styles.progressFillComplete,
                        ]}
                      />
                    </View>
                  </View>

                  {goal.progress >= 100 && (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success[600]} />
                      <Text style={styles.completedText}>Goal achieved!</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed</Text>
            <View style={styles.goalsList}>
              {completedGoals.slice(0, 5).map((goal) => (
                <View key={goal.id} style={[styles.goalCard, styles.completedCard]}>
                  <View style={styles.goalHeader}>
                    <View style={[styles.goalIconContainer, styles.completedIcon]}>
                      <Ionicons name="checkmark" size={24} color={colors.success[600]} />
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalTitle}>
                        {goal.target.toLocaleString()} {goal.unit} {goal.type.replace('_', ' ')}
                      </Text>
                      <Text style={styles.goalSubtitle}>
                        {goal.period} - Completed
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Create Goal Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Goal</Text>
              <TouchableOpacity onPress={() => {
                setShowCreateModal(false);
                resetForm();
              }}>
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Goal Type */}
              <Text style={styles.fieldLabel}>Goal Type</Text>
              <View style={styles.typeGrid}>
                {GOAL_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.type}
                    style={[
                      styles.typeOption,
                      newGoalType?.type === type.type && styles.typeOptionSelected,
                    ]}
                    onPress={() => {
                      setNewGoalType(type);
                      setNewGoalTarget(type.defaultTarget.toString());
                    }}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={24}
                      color={newGoalType?.type === type.type ? colors.primary[600] : colors.gray[500]}
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        newGoalType?.type === type.type && styles.typeLabelSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Target */}
              {newGoalType && (
                <>
                  <Text style={styles.fieldLabel}>Target</Text>
                  <View style={styles.targetInput}>
                    <TextInput
                      style={styles.input}
                      value={newGoalTarget}
                      onChangeText={setNewGoalTarget}
                      keyboardType="number-pad"
                      placeholder={newGoalType.defaultTarget.toString()}
                      placeholderTextColor={colors.gray[400]}
                    />
                    <Text style={styles.unitLabel}>{newGoalType.unit}</Text>
                  </View>

                  {/* Period */}
                  <Text style={styles.fieldLabel}>Period</Text>
                  <View style={styles.periodOptions}>
                    {PERIODS.map((period) => (
                      <TouchableOpacity
                        key={period.value}
                        style={[
                          styles.periodOption,
                          newGoalPeriod === period.value && styles.periodOptionSelected,
                        ]}
                        onPress={() => setNewGoalPeriod(period.value)}
                      >
                        <Text
                          style={[
                            styles.periodLabel,
                            newGoalPeriod === period.value && styles.periodLabelSelected,
                          ]}
                        >
                          {period.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.createButton, (!newGoalType || isCreating) && styles.createButtonDisabled]}
              onPress={handleCreateGoal}
              disabled={!newGoalType || isCreating}
            >
              <Text style={styles.createButtonText}>
                {isCreating ? 'Creating...' : 'Create Goal'}
              </Text>
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addButtonText: {
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
    lineHeight: 20,
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
  completedCard: {
    opacity: 0.8,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedIcon: {
    backgroundColor: colors.success[50],
  },
  goalInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  goalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  goalSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  deleteButton: {
    padding: spacing.sm,
  },
  goalProgress: {
    marginTop: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  progressValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  progressTarget: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
  },
  progressPercent: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  progressComplete: {
    color: colors.success[600],
  },
  progressBar: {
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
  progressFillComplete: {
    backgroundColor: colors.success[500],
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  completedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
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
    maxHeight: '80%',
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
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeOption: {
    width: '31%',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  typeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  targetInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  unitLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  periodOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  periodOption: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  periodOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  periodLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  periodLabelSelected: {
    color: colors.primary[600],
  },
  createButton: {
    backgroundColor: colors.primary[600],
    margin: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  createButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default FitnessGoalsScreen;
