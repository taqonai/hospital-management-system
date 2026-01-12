import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isPast, isFuture, addMinutes } from 'date-fns';
import * as Calendar from 'expo-calendar';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Appointment } from '../../types';

type RouteParams = {
  AppointmentDetail: {
    appointmentId: string;
  };
};

const AppointmentDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'AppointmentDetail'>>();
  const { appointmentId } = route.params;
  const queryClient = useQueryClient();

  const [isRescheduling, setIsRescheduling] = useState(false);

  const {
    data: appointment,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      const response = await patientPortalApi.getAppointmentById(appointmentId);
      // Handle different API response formats
      const data = response.data?.data || response.data;
      return data as Appointment;
    },
    retry: 1,
  });

  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      await patientPortalApi.cancelAppointment(appointmentId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      Alert.alert('Success', 'Appointment cancelled successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to cancel appointment');
    },
  });

  const handleCancel = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Cancel Appointment',
        'Please provide a reason for cancellation:',
        [
          { text: 'Back', style: 'cancel' },
          {
            text: 'Cancel Appointment',
            style: 'destructive',
            onPress: (reason: string | undefined) => {
              if (reason) {
                cancelMutation.mutate(reason);
              }
            },
          },
        ],
        'plain-text'
      );
    } else {
      // For Android, show a simple confirmation
      Alert.alert(
        'Cancel Appointment',
        'Are you sure you want to cancel this appointment?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: () => {
              cancelMutation.mutate('Cancelled by patient');
            },
          },
        ]
      );
    }
  }, [cancelMutation]);

  const handleReschedule = useCallback(() => {
    navigation.navigate('BookAppointment', {
      rescheduleId: appointmentId,
      doctorId: appointment?.doctor?.id,
    });
  }, [navigation, appointmentId, appointment]);

  const handleAddToCalendar = useCallback(async () => {
    if (!appointment) return;

    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Calendar access is required to add events');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(
        (cal: Calendar.Calendar) => cal.allowsModifications && cal.source.name === 'Default'
      ) || calendars[0];

      if (!defaultCalendar) {
        Alert.alert('Error', 'No calendar available');
        return;
      }

      const startDate = new Date(appointment.appointmentDate);
      const [hours, minutes] = (appointment.startTime || '09:00').split(':').map(Number);
      startDate.setHours(hours, minutes, 0, 0);

      const endDate = addMinutes(startDate, 30); // Default 30 min appointment

      await Calendar.createEventAsync(defaultCalendar.id, {
        title: `Doctor Appointment - Dr. ${appointment.doctor?.user?.firstName} ${appointment.doctor?.user?.lastName}`,
        startDate,
        endDate,
        location: appointment.doctor?.department?.name || 'Hospital',
        notes: `Appointment Type: ${appointment.type}\nReason: ${appointment.reason || 'General Consultation'}`,
        alarms: [{ relativeOffset: -60 }], // Reminder 1 hour before
      });

      Alert.alert('Success', 'Appointment added to your calendar');
    } catch (error) {
      console.error('Calendar error:', error);
      Alert.alert('Error', 'Failed to add to calendar');
    }
  }, [appointment]);

  const handleGetDirections = useCallback(() => {
    // This would ideally use the hospital's actual address
    const address = 'Hospital Medical Center';
    const url = Platform.select({
      ios: `maps:?q=${encodeURIComponent(address)}`,
      android: `geo:0,0?q=${encodeURIComponent(address)}`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open maps');
      });
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return { bg: colors.primary[100], text: colors.primary[700] };
      case 'CONFIRMED':
        return { bg: colors.success[100], text: colors.success[700] };
      case 'CHECKED_IN':
        return { bg: colors.warning[100], text: colors.warning[700] };
      case 'IN_PROGRESS':
        return { bg: colors.info[100], text: colors.info[700] };
      case 'COMPLETED':
        return { bg: colors.gray[100], text: colors.gray[700] };
      case 'CANCELLED':
        return { bg: colors.error[100], text: colors.error[700] };
      case 'NO_SHOW':
        return { bg: colors.error[100], text: colors.error[700] };
      default:
        return { bg: colors.gray[100], text: colors.gray[700] };
    }
  };

  const canModify = appointment &&
    ['SCHEDULED', 'CONFIRMED'].includes(appointment.status) &&
    isFuture(new Date(appointment.appointmentDate));

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!appointment || error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error[500]} />
        <Text style={styles.errorText}>
          {error ? 'Failed to load appointment' : 'Appointment not found'}
        </Text>
        <Text style={styles.errorSubtext}>
          {error ? 'Please check your connection and try again' : 'This appointment may have been deleted'}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = getStatusColor(appointment.status || 'SCHEDULED');
  const appointmentDate = appointment.appointmentDate ? new Date(appointment.appointmentDate) : new Date();
  const isValidDate = !isNaN(appointmentDate.getTime());

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
        {/* Doctor Card */}
        <View style={styles.doctorCard}>
          <View style={styles.doctorAvatar}>
            <Ionicons name="person" size={40} color={colors.primary[600]} />
          </View>
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName}>
              Dr. {appointment.doctor?.user?.firstName} {appointment.doctor?.user?.lastName}
            </Text>
            <Text style={styles.doctorSpecialty}>
              {appointment.doctor?.specialization || 'General Practitioner'}
            </Text>
            <View style={styles.departmentRow}>
              <Ionicons name="business-outline" size={14} color={colors.gray[500]} />
              <Text style={styles.departmentText}>
                {appointment.doctor?.department?.name || 'General Medicine'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {appointment.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Appointment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appointment Details</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>
                  {isValidDate ? format(appointmentDate, 'EEEE, MMMM dd, yyyy') : 'Date not available'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="time-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{appointment.startTime || 'TBD'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="medical-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>
                  {appointment.type?.replace('_', ' ') || 'Consultation'}
                </Text>
              </View>
            </View>

            {appointment.reason && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="document-text-outline" size={20} color={colors.primary[600]} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Reason for Visit</Text>
                    <Text style={styles.detailValue}>{appointment.reason}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={handleAddToCalendar}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                <Ionicons name="calendar" size={24} color={colors.primary[600]} />
              </View>
              <Text style={styles.actionText}>Add to Calendar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleGetDirections}>
              <View style={[styles.actionIcon, { backgroundColor: colors.success[50] }]}>
                <Ionicons name="navigate" size={24} color={colors.success[600]} />
              </View>
              <Text style={styles.actionText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notes Section */}
        {appointment.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{appointment.notes}</Text>
            </View>
          </View>
        )}

        {/* Cancellation Info */}
        {appointment.status === 'CANCELLED' && appointment.cancelReason && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cancellation</Text>
            <View style={[styles.notesCard, { backgroundColor: colors.error[50] }]}>
              <Text style={[styles.notesText, { color: colors.error[700] }]}>
                {appointment.cancelReason}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      {canModify && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.bottomButton, styles.rescheduleButton]}
            onPress={handleReschedule}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
            <Text style={styles.rescheduleButtonText}>Reschedule</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomButton, styles.cancelButton]}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color={colors.white} />
                <Text style={styles.cancelButtonText}>Cancel</Text>
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
  },
  errorSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    textAlign: 'center',
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
  doctorCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  doctorAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  doctorSpecialty: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  departmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  departmentText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
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
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  notesCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  notesText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  rescheduleButton: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  rescheduleButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  cancelButton: {
    backgroundColor: colors.error[500],
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default AppointmentDetailScreen;
