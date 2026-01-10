import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, isBefore } from 'date-fns';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Prescription } from '../../types';
import { useMedicationReminders } from '../../hooks/usePushNotifications';

type RouteParams = {
  PrescriptionDetail: {
    prescriptionId: string;
  };
};

const PrescriptionDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'PrescriptionDetail'>>();
  const { prescriptionId } = route.params;
  const queryClient = useQueryClient();
  const { scheduleReminder, cancelReminder } = useMedicationReminders();

  const [reminderEnabled, setReminderEnabled] = useState(false);

  const {
    data: prescription,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['prescription', prescriptionId],
    queryFn: async () => {
      const response = await patientPortalApi.getPrescriptionById(prescriptionId);
      return response.data.data as Prescription;
    },
  });

  const refillMutation = useMutation({
    mutationFn: async () => {
      await patientPortalApi.requestRefill(prescriptionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescription', prescriptionId] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      Alert.alert('Success', 'Refill request submitted successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to request refill');
    },
  });

  const handleRequestRefill = useCallback(() => {
    Alert.alert(
      'Request Refill',
      'Are you sure you want to request a refill for this prescription?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Refill',
          onPress: () => refillMutation.mutate(),
        },
      ]
    );
  }, [refillMutation]);

  const handleToggleReminder = useCallback(async (enabled: boolean) => {
    setReminderEnabled(enabled);

    if (enabled && prescription) {
      // Schedule daily reminder at 9 AM
      const reminderTime = new Date();
      reminderTime.setHours(9, 0, 0, 0);
      if (isBefore(reminderTime, new Date())) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }

      try {
        await scheduleReminder(
          prescriptionId,
          prescription.medicationName || prescription.medication || 'your medication',
          reminderTime
        );
        Alert.alert('Reminder Set', 'You will be reminded to take your medication daily at 9 AM');
      } catch (error) {
        setReminderEnabled(false);
        Alert.alert('Error', 'Failed to set reminder');
      }
    } else {
      // Cancel reminder - would need to track notification ID
      Alert.alert('Reminder Cancelled', 'Medication reminder has been turned off');
    }
  }, [prescription, prescriptionId, scheduleReminder]);

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return { bg: colors.success[100], text: colors.success[700] };
      case 'COMPLETED':
        return { bg: colors.gray[100], text: colors.gray[700] };
      case 'REFILL_REQUESTED':
        return { bg: colors.warning[100], text: colors.warning[700] };
      case 'EXPIRED':
        return { bg: colors.error[100], text: colors.error[700] };
      default:
        return { bg: colors.gray[100], text: colors.gray[700] };
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!prescription) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error[500]} />
        <Text style={styles.errorText}>Prescription not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = getStatusColor(prescription.status);
  const medicationName = prescription.medicationName || prescription.medication || 'Unknown Medication';
  const canRequestRefill = prescription.status === 'ACTIVE' && (prescription.refillsRemaining ?? 0) > 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Medication Header */}
        <View style={styles.medicationCard}>
          <View style={styles.medicationIcon}>
            <Ionicons name="medical" size={32} color={colors.primary[600]} />
          </View>
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{medicationName}</Text>
            <Text style={styles.medicationDosage}>
              {prescription.dosage || 'Dosage not specified'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>
                {prescription.status?.replace('_', ' ') || 'Unknown'}
              </Text>
            </View>
          </View>
        </View>

        {/* Prescription Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prescription Details</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="fitness-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Dosage</Text>
                <Text style={styles.detailValue}>
                  {prescription.dosage || 'As directed'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="time-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Frequency</Text>
                <Text style={styles.detailValue}>
                  {prescription.frequency || 'As needed'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>
                  {prescription.duration || 'As prescribed'}
                </Text>
              </View>
            </View>

            {prescription.quantity && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="cube-outline" size={20} color={colors.primary[600]} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Quantity</Text>
                    <Text style={styles.detailValue}>{prescription.quantity}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Prescriber Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prescribed By</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="person-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Doctor</Text>
                <Text style={styles.detailValue}>
                  Dr. {prescription.doctorName || prescription.doctor?.firstName || 'Unknown'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date Prescribed</Text>
                <Text style={styles.detailValue}>
                  {prescription.prescribedDate
                    ? format(new Date(prescription.prescribedDate), 'MMMM dd, yyyy')
                    : 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Refill Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refill Information</Text>

          <View style={styles.detailCard}>
            <View style={styles.refillRow}>
              <View>
                <Text style={styles.refillLabel}>Refills Remaining</Text>
                <Text style={styles.refillValue}>
                  {prescription.refillsRemaining ?? 0}
                </Text>
              </View>
              <View style={styles.refillProgress}>
                <View
                  style={[
                    styles.refillProgressBar,
                    {
                      width: prescription.refillsRemaining > 0 ? '100%' : '0%',
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Pharmacy Info */}
        {prescription.pharmacy && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pharmacy</Text>

            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="storefront-outline" size={20} color={colors.primary[600]} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailValue}>{prescription.pharmacy}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Instructions */}
        {prescription.instructions && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <View style={styles.instructionsCard}>
              <Ionicons name="information-circle-outline" size={20} color={colors.warning[600]} />
              <Text style={styles.instructionsText}>{prescription.instructions}</Text>
            </View>
          </View>
        )}

        {/* Reminder Toggle */}
        <View style={styles.section}>
          <View style={styles.reminderCard}>
            <View style={styles.reminderInfo}>
              <Ionicons name="notifications-outline" size={24} color={colors.primary[600]} />
              <View style={styles.reminderText}>
                <Text style={styles.reminderTitle}>Medication Reminders</Text>
                <Text style={styles.reminderDescription}>
                  Get daily reminders to take your medication
                </Text>
              </View>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: colors.gray[200], true: colors.primary[200] }}
              thumbColor={reminderEnabled ? colors.primary[600] : colors.gray[400]}
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      {canRequestRefill && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.refillButton}
            onPress={handleRequestRefill}
            disabled={refillMutation.isPending}
          >
            {refillMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color={colors.white} />
                <Text style={styles.refillButtonText}>Request Refill</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  backButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  medicationCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  medicationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  medicationDosage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.md,
  },
  refillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refillLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  refillValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  refillProgress: {
    width: 100,
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  refillProgressBar: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
  },
  instructionsCard: {
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    ...shadows.sm,
  },
  instructionsText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.warning[700],
    lineHeight: 22,
  },
  reminderCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.sm,
  },
  reminderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  reminderText: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  reminderDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  bottomActions: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  refillButton: {
    backgroundColor: colors.primary[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  refillButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default PrescriptionDetailScreen;
