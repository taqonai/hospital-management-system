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
import { wellnessApi, WellnessGoal, WellnessCategory, CreateWellnessGoalData } from '../../services/api';

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

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

const WellnessGoalsScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [goals, setGoals] = useState<WellnessGoal[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [category, setCategory] = useState<WellnessCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const loadGoals = useCallback(async () => {
    try {
      const response = await wellnessApi.getWellnessGoals();
      setGoals(response.data?.data || []);
    } catch (error) {
      console.error('Error loading wellness goals:', error);
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
    if (!category || !title || !target || !unit) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const data: CreateWellnessGoalData = {
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        target: parseInt(target),
        unit: unit.trim(),
        frequency,
      };

      await wellnessApi.createWellnessGoal(data);
      setShowCreateModal(false);
      resetForm();
      loadGoals();
      Alert.alert('Success', 'Wellness goal created!');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to create goal.';
      Alert.alert('Error', message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGoal = (goal: WellnessGoal) => {
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete "${goal.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await wellnessApi.deleteWellnessGoal(goal.id);
              loadGoals();
            } catch {
              Alert.alert('Error', 'Failed to delete goal');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setCategory(null);
    setTitle('');
    setDescription('');
    setTarget('');
    setUnit('');
    setFrequency('daily');
  };

  const getCategoryInfo = (key: WellnessCategory) => {
    return WELLNESS_CATEGORIES.find(c => c.key === key) || WELLNESS_CATEGORIES[0];
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const activeGoals = goals.filter(g => g.isActive);
  const completedGoals = goals.filter(g => !g.isActive);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Add Goal Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add-circle" size={24} color={colors.primary[600]} />
          <Text style={styles.addButtonText}>Add New Goal</Text>
        </TouchableOpacity>

        {/* Active Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Goals ({activeGoals.length})</Text>
          {activeGoals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="flag-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyText}>No active goals yet</Text>
              <Text style={styles.emptySubtext}>Create a goal to track your progress</Text>
            </View>
          ) : (
            <View style={styles.goalsList}>
              {activeGoals.map((goal) => {
                const categoryInfo = getCategoryInfo(goal.category);
                return (
                  <View key={goal.id} style={styles.goalCard}>
                    <View style={styles.goalHeader}>
                      <View style={[styles.goalIcon, { backgroundColor: `${categoryInfo.color}15` }]}>
                        <Ionicons name={categoryInfo.icon as any} size={24} color={categoryInfo.color} />
                      </View>
                      <View style={styles.goalInfo}>
                        <Text style={styles.goalTitle}>{goal.title}</Text>
                        <Text style={styles.goalCategory}>
                          {categoryInfo.label} · {goal.frequency}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteGoal(goal)}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error[500]} />
                      </TouchableOpacity>
                    </View>

                    {goal.description && (
                      <Text style={styles.goalDescription}>{goal.description}</Text>
                    )}

                    <View style={styles.progressSection}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressText}>
                          {goal.currentValue} / {goal.target} {goal.unit}
                        </Text>
                        <Text style={[
                          styles.progressPercent,
                          goal.progress >= 100 && styles.progressComplete,
                        ]}>
                          {Math.round(goal.progress)}%
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(goal.progress, 100)}%`,
                              backgroundColor: goal.progress >= 100 ? colors.success[500] : categoryInfo.color,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed ({completedGoals.length})</Text>
            <View style={styles.goalsList}>
              {completedGoals.slice(0, 5).map((goal) => {
                const categoryInfo = getCategoryInfo(goal.category);
                return (
                  <View key={goal.id} style={[styles.goalCard, styles.completedCard]}>
                    <View style={styles.goalHeader}>
                      <View style={[styles.goalIcon, { backgroundColor: colors.success[50] }]}>
                        <Ionicons name="checkmark" size={24} color={colors.success[600]} />
                      </View>
                      <View style={styles.goalInfo}>
                        <Text style={styles.goalTitle}>{goal.title}</Text>
                        <Text style={styles.goalCategory}>{categoryInfo.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
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
              <Text style={styles.modalTitle}>Create Wellness Goal</Text>
              <TouchableOpacity onPress={() => {
                setShowCreateModal(false);
                resetForm();
              }}>
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Category */}
              <Text style={styles.fieldLabel}>Category *</Text>
              <View style={styles.categoryGrid}>
                {WELLNESS_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryOption,
                      category === cat.key && styles.categoryOptionSelected,
                    ]}
                    onPress={() => setCategory(cat.key)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={20}
                      color={category === cat.key ? cat.color : colors.gray[500]}
                    />
                    <Text style={[
                      styles.categoryLabel,
                      category === cat.key && { color: cat.color },
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title */}
              <Text style={styles.fieldLabel}>Goal Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Meditate daily"
                placeholderTextColor={colors.gray[400]}
                value={title}
                onChangeText={setTitle}
              />

              {/* Description */}
              <Text style={styles.fieldLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="What do you want to achieve?"
                placeholderTextColor={colors.gray[400]}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {/* Target */}
              <View style={styles.targetRow}>
                <View style={styles.targetField}>
                  <Text style={styles.fieldLabel}>Target *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="number-pad"
                    value={target}
                    onChangeText={setTarget}
                  />
                </View>
                <View style={styles.unitField}>
                  <Text style={styles.fieldLabel}>Unit *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="minutes"
                    placeholderTextColor={colors.gray[400]}
                    value={unit}
                    onChangeText={setUnit}
                  />
                </View>
              </View>

              {/* Frequency */}
              <Text style={styles.fieldLabel}>Frequency</Text>
              <View style={styles.frequencyOptions}>
                {FREQUENCIES.map((freq) => (
                  <TouchableOpacity
                    key={freq.value}
                    style={[
                      styles.frequencyOption,
                      frequency === freq.value && styles.frequencyOptionSelected,
                    ]}
                    onPress={() => setFrequency(freq.value)}
                  >
                    <Text style={[
                      styles.frequencyText,
                      frequency === freq.value && styles.frequencyTextSelected,
                    ]}>
                      {freq.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.createButton, (!category || !title || !target || !unit || isCreating) && styles.createButtonDisabled]}
              onPress={handleCreateGoal}
              disabled={!category || !title || !target || !unit || isCreating}
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
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
    color: colors.text.disabled,
    marginTop: spacing.xs,
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
    opacity: 0.7,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  goalTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  goalCategory: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  deleteButton: {
    padding: spacing.sm,
  },
  goalDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  progressSection: {
    marginTop: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  progressPercent: {
    fontSize: typography.fontSize.sm,
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
    borderRadius: 4,
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
    maxHeight: 450,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  categoryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  input: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  targetRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  targetField: {
    flex: 1,
  },
  unitField: {
    flex: 1,
  },
  frequencyOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  frequencyOption: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  frequencyOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  frequencyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  frequencyTextSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
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

export default WellnessGoalsScreen;
