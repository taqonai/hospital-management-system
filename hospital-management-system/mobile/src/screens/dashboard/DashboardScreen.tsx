import React, { useCallback, useRef, useMemo } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { useAppSelector } from '../../store';
import { offlinePatientApi } from '../../services/api';
import { DashboardSummary, Appointment } from '../../types';
import { useOfflineData } from '../../hooks/useOfflineData';
import { OfflineIndicator } from '../../components/common/OfflineBanner';

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAppSelector((state) => state.auth);

  // Memoize the fetcher to prevent unnecessary re-renders and refresh cycles
  const fetcher = useCallback(
    (forceRefresh?: boolean) => offlinePatientApi.getSummary(forceRefresh),
    []
  );

  const {
    data: summary,
    isLoading,
    isRefreshing,
    isFromCache,
    isStale,
    refresh,
  } = useOfflineData<DashboardSummary>({
    fetcher,
  });

  const onRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Track if this is the initial mount to avoid double-fetching
  const isFirstFocus = useRef(true);
  const isRefreshingOnFocus = useRef(false);

  // Refresh dashboard data when screen gains focus (e.g., after booking)
  // Skip the first focus since useOfflineData already fetches on mount
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      // Prevent multiple simultaneous refreshes from focus events
      if (isRefreshingOnFocus.current) {
        return;
      }
      isRefreshingOnFocus.current = true;
      // Only refresh on subsequent focuses (after navigating away and back)
      refresh().finally(() => {
        isRefreshingOnFocus.current = false;
      });
    }, [refresh])
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const renderUpcomingAppointment = (appointment: Appointment) => (
    <TouchableOpacity
      key={appointment.id}
      style={styles.appointmentCard}
      onPress={() => navigation.navigate('AppointmentsTab', {
        screen: 'AppointmentDetail',
        params: { appointmentId: appointment.id },
      })}
    >
      <View style={styles.appointmentHeader}>
        <View style={styles.doctorInfo}>
          <View style={styles.doctorAvatar}>
            <Ionicons name="person" size={24} color={colors.primary[600]} />
          </View>
          <View>
            <Text style={styles.doctorName}>
              Dr. {appointment.doctor?.user?.firstName ?? ''} {appointment.doctor?.user?.lastName ?? 'Unknown'}
            </Text>
            <Text style={styles.specialty}>{appointment.doctor?.specialization ?? 'Specialist'}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, getStatusStyle(appointment.status)]}>
          <Text style={styles.statusText}>{appointment.status}</Text>
        </View>
      </View>
      <View style={styles.appointmentDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={16} color={colors.gray[500]} />
          <Text style={styles.detailText}>
            {appointment.appointmentDate && !isNaN(new Date(appointment.appointmentDate).getTime())
              ? format(new Date(appointment.appointmentDate), 'MMM dd, yyyy')
              : 'Date TBD'}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color={colors.gray[500]} />
          <Text style={styles.detailText}>{appointment.startTime ?? 'Time TBD'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return { backgroundColor: colors.primary[100] };
      case 'CONFIRMED':
        return { backgroundColor: colors.success[100] };
      case 'CHECKED_IN':
        return { backgroundColor: colors.warning[100] };
      default:
        return { backgroundColor: colors.gray[100] };
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing === true} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Offline Indicator */}
        {isFromCache && (
          <OfflineIndicator isFromCache={isFromCache} isStale={isStale} />
        )}

        {/* Branding Header */}
        <View style={styles.brandingHeader}>
          <View style={styles.brandingContainer}>
            <Ionicons name="heart" size={24} color={colors.error[500]} />
            <Text style={styles.brandingText}>Spetaar Pro</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
            {(summary?.quickStats?.unreadMessages ?? 0) > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationCount}>
                  {summary?.quickStats?.unreadMessages}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>
              {user?.firstName} {user?.lastName}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('AppointmentsTab', { screen: 'AppointmentsList' })}
          >
            <View style={[styles.statIcon, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="calendar" size={24} color={colors.primary[600]} />
            </View>
            <Text style={styles.statNumber}>{summary?.quickStats?.totalAppointments ?? 0}</Text>
            <Text style={styles.statLabel}>Appointments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('HealthTab', { screen: 'Prescriptions' })}
          >
            <View style={[styles.statIcon, { backgroundColor: colors.success[100] }]}>
              <Ionicons name="medical" size={24} color={colors.success[600]} />
            </View>
            <Text style={styles.statNumber}>{summary?.quickStats?.activePrescriptions ?? 0}</Text>
            <Text style={styles.statLabel}>Prescriptions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('HealthTab', { screen: 'LabResults' })}
          >
            <View style={[styles.statIcon, { backgroundColor: colors.warning[100] }]}>
              <Ionicons name="flask" size={24} color={colors.warning[600]} />
            </View>
            <Text style={styles.statNumber}>{summary?.quickStats?.pendingLabs ?? 0}</Text>
            <Text style={styles.statLabel}>Pending Labs</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('AppointmentsTab', { screen: 'BookAppointment' })}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                <Ionicons name="add-circle-outline" size={28} color={colors.primary[600]} />
              </View>
              <Text style={styles.actionText}>Book Appointment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('HealthTab', { screen: 'SymptomChecker', params: { source: 'home' } })}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.error[50] }]}>
                <Ionicons name="fitness-outline" size={28} color={colors.error[600]} />
              </View>
              <Text style={styles.actionText}>Check Symptoms</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('HealthTab', { screen: 'HealthAssistant', params: { source: 'home' } })}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.success[50] }]}>
                <Ionicons name="chatbubbles-outline" size={28} color={colors.success[600]} />
              </View>
              <Text style={styles.actionText}>AI Health Assistant</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('HealthTab', { screen: 'MedicalRecords', params: { source: 'home' } })}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.gray[100] }]}>
                <Ionicons name="document-text-outline" size={28} color={colors.gray[600]} />
              </View>
              <Text style={styles.actionText}>View Records</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Appointments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AppointmentsTab', { screen: 'AppointmentsList' })}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {(summary?.upcomingAppointments?.length ?? 0) > 0 ? (
            summary?.upcomingAppointments?.slice(0, 3).map(renderUpcomingAppointment)
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>No Upcoming Appointments</Text>
              <Text style={styles.emptySubtitle}>Book an appointment to see your doctor</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => navigation.navigate('AppointmentsTab', { screen: 'BookAppointment' })}
              >
                <Text style={styles.emptyButtonText}>Book Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Health Score */}
        {summary?.healthScore !== undefined && (
          <TouchableOpacity
            style={styles.healthScoreCard}
            onPress={() => navigation.navigate('HealthTab', { screen: 'HealthInsights' })}
          >
            <View style={styles.healthScoreContent}>
              <View>
                <Text style={styles.healthScoreTitle}>Your Health Score</Text>
                <Text style={styles.healthScoreSubtitle}>Based on your recent data</Text>
              </View>
              <View style={styles.healthScoreValue}>
                <Text style={styles.healthScoreNumber}>{summary.healthScore}</Text>
                <Text style={styles.healthScoreMax}>/100</Text>
              </View>
            </View>
            <View style={styles.healthScoreBar}>
              <View
                style={[
                  styles.healthScoreProgress,
                  { width: `${summary.healthScore}%` },
                  getHealthScoreColor(summary.healthScore),
                ]}
              />
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getHealthScoreColor = (score: number) => {
  if (score >= 80) return { backgroundColor: colors.success[500] };
  if (score >= 60) return { backgroundColor: colors.warning[500] };
  return { backgroundColor: colors.error[500] };
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  brandingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandingText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  userName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  notificationButton: {
    position: 'relative',
    padding: spacing.sm,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error[500],
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCount: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
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
  viewAllText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionButton: {
    width: '48%',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
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
  appointmentCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  doctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  specialty: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  appointmentDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing['2xl'],
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  healthScoreCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  healthScoreContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  healthScoreTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  healthScoreSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  healthScoreValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  healthScoreNumber: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  healthScoreMax: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  healthScoreBar: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  healthScoreProgress: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
});

export default DashboardScreen;
