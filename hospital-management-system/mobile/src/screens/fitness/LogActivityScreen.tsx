import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, ActivityType, LogActivityData } from '../../services/api';
import { FitnessStackParamList } from '../../types';

type RouteProps = RouteProp<FitnessStackParamList, 'LogActivity'>;

interface ActivityOption {
  type: ActivityType;
  label: string;
  icon: string;
  hasDistance?: boolean;
  estimatedCaloriesPerMin: number;
}

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { type: 'walking', label: 'Walking', icon: 'walk-outline', hasDistance: true, estimatedCaloriesPerMin: 4 },
  { type: 'running', label: 'Running', icon: 'fitness-outline', hasDistance: true, estimatedCaloriesPerMin: 10 },
  { type: 'cycling', label: 'Cycling', icon: 'bicycle-outline', hasDistance: true, estimatedCaloriesPerMin: 8 },
  { type: 'swimming', label: 'Swimming', icon: 'water-outline', hasDistance: true, estimatedCaloriesPerMin: 9 },
  { type: 'yoga', label: 'Yoga', icon: 'body-outline', hasDistance: false, estimatedCaloriesPerMin: 3 },
  { type: 'strength_training', label: 'Strength', icon: 'barbell-outline', hasDistance: false, estimatedCaloriesPerMin: 5 },
  { type: 'hiit', label: 'HIIT', icon: 'flash-outline', hasDistance: false, estimatedCaloriesPerMin: 12 },
  { type: 'pilates', label: 'Pilates', icon: 'body-outline', hasDistance: false, estimatedCaloriesPerMin: 4 },
  { type: 'dance', label: 'Dance', icon: 'musical-notes-outline', hasDistance: false, estimatedCaloriesPerMin: 6 },
  { type: 'hiking', label: 'Hiking', icon: 'trail-sign-outline', hasDistance: true, estimatedCaloriesPerMin: 6 },
  { type: 'sports', label: 'Sports', icon: 'basketball-outline', hasDistance: false, estimatedCaloriesPerMin: 7 },
  { type: 'cardio', label: 'Cardio', icon: 'heart-outline', hasDistance: false, estimatedCaloriesPerMin: 8 },
  { type: 'stretching', label: 'Stretching', icon: 'body-outline', hasDistance: false, estimatedCaloriesPerMin: 2 },
  { type: 'meditation', label: 'Meditation', icon: 'leaf-outline', hasDistance: false, estimatedCaloriesPerMin: 1 },
  { type: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', hasDistance: false, estimatedCaloriesPerMin: 5 },
];

const INTENSITY_OPTIONS = [
  { value: 'low', label: 'Low', description: 'Light effort, easy to talk', multiplier: 0.8 },
  { value: 'moderate', label: 'Moderate', description: 'Some effort, can still talk', multiplier: 1.0 },
  { value: 'high', label: 'High', description: 'Hard effort, difficult to talk', multiplier: 1.2 },
  { value: 'very_high', label: 'Very High', description: 'Maximum effort', multiplier: 1.5 },
] as const;

const LogActivityScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const initialType = route.params?.activityType as ActivityType;

  const [selectedActivity, setSelectedActivity] = useState<ActivityOption | null>(
    ACTIVITY_OPTIONS.find(a => a.type === initialType) || null
  );
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState<'low' | 'moderate' | 'high' | 'very_high'>('moderate');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculateEstimatedCalories = () => {
    if (!selectedActivity || !duration) return 0;
    const durationNum = parseInt(duration);
    const intensityMultiplier = INTENSITY_OPTIONS.find(i => i.value === intensity)?.multiplier || 1;
    return Math.round(durationNum * selectedActivity.estimatedCaloriesPerMin * intensityMultiplier);
  };

  const handleDurationChange = (value: string) => {
    setDuration(value);
    // Auto-calculate calories
    if (selectedActivity && value) {
      const estimated = calculateEstimatedCalories();
      setCalories(estimated.toString());
    }
  };

  const handleIntensityChange = (newIntensity: typeof intensity) => {
    setIntensity(newIntensity);
    // Recalculate calories with new intensity
    if (selectedActivity && duration) {
      const durationNum = parseInt(duration);
      const multiplier = INTENSITY_OPTIONS.find(i => i.value === newIntensity)?.multiplier || 1;
      const estimated = Math.round(durationNum * selectedActivity.estimatedCaloriesPerMin * multiplier);
      setCalories(estimated.toString());
    }
  };

  const handleSubmit = async () => {
    if (!selectedActivity) {
      Alert.alert('Error', 'Please select an activity type');
      return;
    }

    if (!duration || parseInt(duration) <= 0) {
      Alert.alert('Error', 'Please enter a valid duration');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: LogActivityData = {
        type: selectedActivity.type,
        name: selectedActivity.label,
        duration: parseInt(duration),
        intensity,
        caloriesBurned: calories ? parseInt(calories) : calculateEstimatedCalories(),
      };

      if (selectedActivity.hasDistance && distance) {
        data.distance = parseFloat(distance);
        data.distanceUnit = distanceUnit;
      }

      if (notes.trim()) {
        data.notes = notes.trim();
      }

      await wellnessApi.logActivity(data);

      Alert.alert(
        'Activity Logged',
        `Your ${selectedActivity.label.toLowerCase()} workout has been recorded!`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to log activity. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Activity Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity Type</Text>
            <View style={styles.activityGrid}>
              {ACTIVITY_OPTIONS.map((activity) => (
                <TouchableOpacity
                  key={activity.type}
                  style={[
                    styles.activityOption,
                    selectedActivity?.type === activity.type && styles.activityOptionSelected,
                  ]}
                  onPress={() => setSelectedActivity(activity)}
                >
                  <Ionicons
                    name={activity.icon as any}
                    size={24}
                    color={
                      selectedActivity?.type === activity.type
                        ? colors.primary[600]
                        : colors.gray[500]
                    }
                  />
                  <Text
                    style={[
                      styles.activityLabel,
                      selectedActivity?.type === activity.type && styles.activityLabelSelected,
                    ]}
                  >
                    {activity.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedActivity && (
            <>
              {/* Duration */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Duration</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="30"
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="number-pad"
                    value={duration}
                    onChangeText={handleDurationChange}
                  />
                  <Text style={styles.unitText}>minutes</Text>
                </View>
              </View>

              {/* Intensity */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Intensity</Text>
                <View style={styles.intensityOptions}>
                  {INTENSITY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.intensityOption,
                        intensity === option.value && styles.intensityOptionSelected,
                      ]}
                      onPress={() => handleIntensityChange(option.value)}
                    >
                      <Text
                        style={[
                          styles.intensityLabel,
                          intensity === option.value && styles.intensityLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.intensityDesc}>{option.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Distance (if applicable) */}
              {selectedActivity.hasDistance && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Distance (Optional)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="5"
                      placeholderTextColor={colors.gray[400]}
                      keyboardType="decimal-pad"
                      value={distance}
                      onChangeText={setDistance}
                    />
                    <View style={styles.unitToggle}>
                      <TouchableOpacity
                        style={[
                          styles.unitButton,
                          distanceUnit === 'km' && styles.unitButtonActive,
                        ]}
                        onPress={() => setDistanceUnit('km')}
                      >
                        <Text
                          style={[
                            styles.unitButtonText,
                            distanceUnit === 'km' && styles.unitButtonTextActive,
                          ]}
                        >
                          km
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.unitButton,
                          distanceUnit === 'mi' && styles.unitButtonActive,
                        ]}
                        onPress={() => setDistanceUnit('mi')}
                      >
                        <Text
                          style={[
                            styles.unitButtonText,
                            distanceUnit === 'mi' && styles.unitButtonTextActive,
                          ]}
                        >
                          mi
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Calories */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Calories Burned</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder={calculateEstimatedCalories().toString() || '200'}
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="number-pad"
                    value={calories}
                    onChangeText={setCalories}
                  />
                  <Text style={styles.unitText}>cal</Text>
                </View>
                {duration && !calories && (
                  <Text style={styles.estimateText}>
                    Estimated: {calculateEstimatedCalories()} cal
                  </Text>
                )}
              </View>

              {/* Notes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="How did it go?"
                  placeholderTextColor={colors.gray[400]}
                  multiline
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting || !duration}
              >
                {isSubmitting ? (
                  <Text style={styles.submitButtonText}>Saving...</Text>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                    <Text style={styles.submitButtonText}>Log Activity</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  activityOption: {
    width: '23%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  activityOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  activityLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  activityLabelSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingVertical: spacing.lg,
  },
  unitText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    padding: 2,
  },
  unitButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  unitButtonActive: {
    backgroundColor: colors.white,
  },
  unitButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  unitButtonTextActive: {
    color: colors.primary[600],
  },
  intensityOptions: {
    gap: spacing.sm,
  },
  intensityOption: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  intensityOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  intensityLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  intensityLabelSelected: {
    color: colors.primary[600],
  },
  intensityDesc: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  estimateText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  notesInput: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
    ...shadows.sm,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray[400],
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default LogActivityScreen;
