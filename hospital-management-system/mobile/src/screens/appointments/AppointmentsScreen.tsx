import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Appointment } from '../../types';

type TabType = 'upcoming' | 'past';

const AppointmentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['patient-appointments', activeTab],
    queryFn: async () => {
      const response = await patientPortalApi.getAppointments({
        type: activeTab === 'upcoming' ? 'upcoming' : 'past',
        limit: 20,
      });
      return response.data.data as Appointment[];
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return colors.primary[600];
      case 'CONFIRMED':
        return colors.success[600];
      case 'CHECKED_IN':
        return colors.warning[600];
      case 'COMPLETED':
        return colors.gray[600];
      case 'CANCELLED':
        return colors.error[600];
      default:
        return colors.gray[600];
    }
  };

  const renderAppointment = ({ item }: { item: Appointment }) => (
    <TouchableOpacity
      style={styles.appointmentCard}
      onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.doctorInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={colors.primary[600]} />
          </View>
          <View style={styles.doctorDetails}>
            <Text style={styles.doctorName}>
              Dr. {item.doctor.user.firstName} {item.doctor.user.lastName}
            </Text>
            <Text style={styles.specialty}>{item.doctor.specialization}</Text>
            <Text style={styles.department}>{item.doctor.department.name}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.gray[500]} />
          <Text style={styles.detailText}>
            {format(new Date(item.appointmentDate), 'EEEE, MMMM dd, yyyy')}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color={colors.gray[500]} />
          <Text style={styles.detailText}>
            {item.startTime} - {item.endTime}
          </Text>
        </View>
        {item.type && (
          <View style={styles.detailRow}>
            <Ionicons name="medical-outline" size={18} color={colors.gray[500]} />
            <Text style={styles.detailText}>{item.type}</Text>
          </View>
        )}
      </View>

      {item.reason && (
        <View style={styles.reasonContainer}>
          <Text style={styles.reasonLabel}>Reason:</Text>
          <Text style={styles.reasonText} numberOfLines={2}>{item.reason}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
        size={64}
        color={colors.gray[300]}
      />
      <Text style={styles.emptyTitle}>
        No {activeTab === 'upcoming' ? 'Upcoming' : 'Past'} Appointments
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'upcoming'
          ? 'Book an appointment to see your doctor'
          : 'Your appointment history will appear here'}
      </Text>
      {activeTab === 'upcoming' && (
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => navigation.navigate('BookAppointment')}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.bookButtonText}>Book Appointment</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* Appointments List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      ) : (
        <FlatList
          data={data || []}
          renderItem={renderAppointment}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('BookAppointment')}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
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
  },
  tabContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: colors.primary[600],
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[600],
  },
  activeTabText: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
  },
  appointmentCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  doctorInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  doctorDetails: {
    flex: 1,
  },
  doctorName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  specialty: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  department: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.md,
  },
  cardDetails: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  reasonContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
  },
  reasonLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[500],
    marginBottom: spacing.xs,
  },
  reasonText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  bookButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});

export default AppointmentsScreen;
