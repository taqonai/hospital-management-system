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
import { wellnessApi, MetricType, LogMetricData } from '../../services/api';
import { HealthStackParamList } from '../../types';

type RouteProps = RouteProp<HealthStackParamList, 'ManualMetricLog'>;

interface MetricConfig {
  type: MetricType;
  label: string;
  icon: string;
  unit: string;
  placeholder: string;
  hasSecondary?: boolean;
  secondaryLabel?: string;
  secondaryUnit?: string;
  secondaryPlaceholder?: string;
  min?: number;
  max?: number;
  step?: number;
  quickValues?: number[];
}

const METRIC_CONFIGS: MetricConfig[] = [
  {
    type: 'weight',
    label: 'Weight',
    icon: 'scale-outline',
    unit: 'kg',
    placeholder: 'e.g., 70',
    min: 20,
    max: 300,
    quickValues: [60, 65, 70, 75, 80],
  },
  {
    type: 'blood_glucose',
    label: 'Blood Glucose',
    icon: 'water-outline',
    unit: 'mg/dL',
    placeholder: 'e.g., 100',
    min: 20,
    max: 500,
    quickValues: [80, 100, 120, 140],
  },
  {
    type: 'blood_pressure',
    label: 'Blood Pressure',
    icon: 'heart-outline',
    unit: 'mmHg',
    placeholder: 'Systolic (e.g., 120)',
    hasSecondary: true,
    secondaryLabel: 'Diastolic',
    secondaryUnit: 'mmHg',
    secondaryPlaceholder: 'Diastolic (e.g., 80)',
    min: 40,
    max: 250,
  },
  {
    type: 'heart_rate',
    label: 'Heart Rate',
    icon: 'pulse-outline',
    unit: 'bpm',
    placeholder: 'e.g., 72',
    min: 30,
    max: 220,
    quickValues: [60, 70, 80, 90, 100],
  },
  {
    type: 'water_intake',
    label: 'Water Intake',
    icon: 'water',
    unit: 'ml',
    placeholder: 'e.g., 250',
    min: 50,
    max: 5000,
    quickValues: [200, 250, 500, 750, 1000],
  },
  {
    type: 'sleep',
    label: 'Sleep Duration',
    icon: 'moon-outline',
    unit: 'hours',
    placeholder: 'e.g., 7.5',
    min: 0,
    max: 24,
    step: 0.5,
    quickValues: [5, 6, 7, 8, 9],
  },
  {
    type: 'steps',
    label: 'Steps',
    icon: 'footsteps-outline',
    unit: 'steps',
    placeholder: 'e.g., 10000',
    min: 0,
    max: 100000,
    quickValues: [2000, 5000, 8000, 10000],
  },
  {
    type: 'oxygen_saturation',
    label: 'Oxygen Saturation',
    icon: 'fitness-outline',
    unit: '%',
    placeholder: 'e.g., 98',
    min: 70,
    max: 100,
    quickValues: [95, 96, 97, 98, 99],
  },
  {
    type: 'temperature',
    label: 'Body Temperature',
    icon: 'thermometer-outline',
    unit: '\u00B0C',
    placeholder: 'e.g., 36.6',
    min: 34,
    max: 42,
    step: 0.1,
    quickValues: [36.0, 36.5, 37.0, 37.5, 38.0],
  },
];

const ManualMetricLogScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const initialType = route.params?.metricType as MetricType;

  const [selectedMetric, setSelectedMetric] = useState<MetricConfig | null>(
    METRIC_CONFIGS.find(m => m.type === initialType) || null
  );
  const [value, setValue] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectMetric = (metric: MetricConfig) => {
    setSelectedMetric(metric);
    setValue('');
    setSecondaryValue('');
  };

  const handleQuickValue = (quickValue: number) => {
    setValue(quickValue.toString());
  };

  const validateInput = (): boolean => {
    if (!selectedMetric) {
      Alert.alert('Error', 'Please select a metric type');
      return false;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      Alert.alert('Error', 'Please enter a valid number');
      return false;
    }

    if (selectedMetric.min !== undefined && numValue < selectedMetric.min) {
      Alert.alert('Error', `Value must be at least ${selectedMetric.min}`);
      return false;
    }

    if (selectedMetric.max !== undefined && numValue > selectedMetric.max) {
      Alert.alert('Error', `Value must be at most ${selectedMetric.max}`);
      return false;
    }

    if (selectedMetric.hasSecondary) {
      const numSecondary = parseFloat(secondaryValue);
      if (isNaN(numSecondary)) {
        Alert.alert('Error', 'Please enter a valid secondary value');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateInput() || !selectedMetric) return;

    setIsSubmitting(true);
    try {
      const data: LogMetricData = {
        type: selectedMetric.type,
        value: parseFloat(value),
        unit: selectedMetric.unit,
        timestamp: new Date().toISOString(),
      };

      if (selectedMetric.hasSecondary && secondaryValue) {
        data.secondaryValue = parseFloat(secondaryValue);
      }

      if (notes.trim()) {
        data.notes = notes.trim();
      }

      await wellnessApi.logMetric(data);

      Alert.alert(
        'Logged Successfully',
        `Your ${selectedMetric.label.toLowerCase()} has been recorded.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to log metric. Please try again.';
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
          {/* Metric Type Selection */}
          {!initialType && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Metric</Text>
              <View style={styles.metricGrid}>
                {METRIC_CONFIGS.map((metric) => (
                  <TouchableOpacity
                    key={metric.type}
                    style={[
                      styles.metricOption,
                      selectedMetric?.type === metric.type && styles.metricOptionSelected,
                    ]}
                    onPress={() => handleSelectMetric(metric)}
                  >
                    <Ionicons
                      name={metric.icon as any}
                      size={24}
                      color={
                        selectedMetric?.type === metric.type
                          ? colors.primary[600]
                          : colors.gray[500]
                      }
                    />
                    <Text
                      style={[
                        styles.metricOptionLabel,
                        selectedMetric?.type === metric.type && styles.metricOptionLabelSelected,
                      ]}
                    >
                      {metric.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Input Section */}
          {selectedMetric && (
            <>
              <View style={styles.section}>
                <View style={styles.inputHeader}>
                  <Ionicons name={selectedMetric.icon as any} size={28} color={colors.primary[600]} />
                  <Text style={styles.inputTitle}>{selectedMetric.label}</Text>
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder={selectedMetric.placeholder}
                    placeholderTextColor={colors.gray[400]}
                    keyboardType="decimal-pad"
                    value={value}
                    onChangeText={setValue}
                  />
                  <Text style={styles.unitLabel}>{selectedMetric.unit}</Text>
                </View>

                {selectedMetric.hasSecondary && (
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder={selectedMetric.secondaryPlaceholder}
                      placeholderTextColor={colors.gray[400]}
                      keyboardType="decimal-pad"
                      value={secondaryValue}
                      onChangeText={setSecondaryValue}
                    />
                    <Text style={styles.unitLabel}>{selectedMetric.secondaryUnit}</Text>
                  </View>
                )}

                {/* Quick Values */}
                {selectedMetric.quickValues && (
                  <View style={styles.quickValuesContainer}>
                    <Text style={styles.quickValuesLabel}>Quick select:</Text>
                    <View style={styles.quickValues}>
                      {selectedMetric.quickValues.map((qv) => (
                        <TouchableOpacity
                          key={qv}
                          style={[
                            styles.quickValueButton,
                            value === qv.toString() && styles.quickValueButtonSelected,
                          ]}
                          onPress={() => handleQuickValue(qv)}
                        >
                          <Text
                            style={[
                              styles.quickValueText,
                              value === qv.toString() && styles.quickValueTextSelected,
                            ]}
                          >
                            {qv}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Notes Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add any notes about this reading..."
                  placeholderTextColor={colors.gray[400]}
                  multiline
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting || !value}
              >
                {isSubmitting ? (
                  <Text style={styles.submitButtonText}>Saving...</Text>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                    <Text style={styles.submitButtonText}>Log {selectedMetric.label}</Text>
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
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricOption: {
    width: '31%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  metricOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  metricOptionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  metricOptionLabelSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  inputTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    paddingVertical: spacing.lg,
  },
  unitLabel: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  quickValuesContainer: {
    marginTop: spacing.md,
  },
  quickValuesLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  quickValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickValueButton: {
    backgroundColor: colors.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickValueButtonSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  quickValueText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  quickValueTextSelected: {
    color: colors.white,
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

export default ManualMetricLogScreen;
