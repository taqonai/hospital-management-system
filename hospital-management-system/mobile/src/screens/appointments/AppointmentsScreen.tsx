import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Appointment } from '../../types';

type TabType = 'upcoming' | 'past';

const AppointmentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');

  // Review state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAppointment, setReviewAppointment] = useState<Appointment | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  // Fetch reviewed appointment IDs
  const { data: reviewedData } = useQuery({
    queryKey: ['patient-reviewed-appointments'],
    queryFn: async () => {
      const response = await patientPortalApi.getMyReviewedAppointments();
      return (response.data as any)?.data?.reviewedAppointmentIds || [];
    },
  });
  const reviewedAppointmentIds: string[] = Array.isArray(reviewedData) ? reviewedData : [];

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: (data: { appointmentId: string; rating: number; comment?: string }) =>
      patientPortalApi.submitReview(data),
    onSuccess: () => {
      setShowReviewModal(false);
      setReviewAppointment(null);
      setReviewRating(0);
      setReviewComment('');
      queryClient.invalidateQueries({ queryKey: ['patient-reviewed-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      Alert.alert('Thank you!', 'Your review has been submitted successfully.');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Failed to submit review';
      Alert.alert('Error', msg);
    },
  });

  const handleOpenReview = useCallback((appointment: Appointment) => {
    setReviewAppointment(appointment);
    setReviewRating(0);
    setReviewComment('');
    setShowReviewModal(true);
  }, []);

  const handleSubmitReview = useCallback(() => {
    if (!reviewAppointment || reviewRating === 0) return;
    submitReviewMutation.mutate({
      appointmentId: reviewAppointment.id,
      rating: reviewRating,
      comment: reviewComment.trim() || undefined,
    });
  }, [reviewAppointment, reviewRating, reviewComment, submitReviewMutation]);

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return 'Tap a star to rate';
    }
  };

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['patient-appointments', activeTab],
    queryFn: async () => {
      const response = await patientPortalApi.getAppointments({
        type: activeTab === 'upcoming' ? 'upcoming' : 'past',
        limit: 20,
      });
      // Handle different API response formats
      // Backend may return { data: [...], pagination: {...} } or just [...]
      const responseData = response.data as any;
      const rawData = responseData?.data?.data || responseData?.data || responseData || [];
      const appointments = Array.isArray(rawData) ? rawData : [];

      // Transform backend format to expected Appointment format
      // Backend now returns: { appointmentDate, startTime, doctorName, doctorSpecialty, departmentName, createdAt }
      // Backend already sorts by createdAt DESC (latest bookings first)
      return appointments.map((apt: any) => ({
        id: apt.id,
        appointmentDate: apt.appointmentDate || apt.date,
        startTime: apt.startTime || apt.time,
        endTime: apt.endTime,
        type: apt.type,
        reason: apt.reason,
        status: apt.status,
        notes: apt.notes,
        tokenNumber: apt.tokenNumber,
        createdAt: apt.createdAt,
        // Handle both nested doctor object and flat doctorName format
        doctor: apt.doctor || {
          user: {
            firstName: apt.doctorName?.replace('Dr. ', '').split(' ')[0] || '',
            lastName: apt.doctorName?.replace('Dr. ', '').split(' ').slice(1).join(' ') || '',
          },
          specialization: apt.doctorSpecialty || apt.doctorSpecialization || '',
          department: {
            id: apt.departmentId || '',
            name: apt.departmentName || '',
          },
        },
      })) as unknown as Appointment[];
    },
    retry: 1,
  });

  // Refetch when screen gains focus (e.g., after booking)
  useFocusEffect(
    useCallback(() => {
      // Invalidate and refetch appointments data when screen is focused
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      refetch();
    }, [queryClient, refetch])
  );

  // Log error for debugging
  React.useEffect(() => {
    if (error) {
      console.error('Failed to fetch appointments:', error);
    }
  }, [error]);

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

  const formatAppointmentDate = (dateString: string) => {
    if (!dateString) return 'Date TBD';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date TBD';
      return format(date, 'EEEE, MMMM dd, yyyy');
    } catch {
      return 'Date TBD';
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
              Dr. {item.doctor?.user?.firstName ?? ''} {item.doctor?.user?.lastName ?? 'Unknown'}
            </Text>
            <Text style={styles.specialty}>{item.doctor?.specialization ?? 'Specialist'}</Text>
            <Text style={styles.department}>{item.doctor?.department?.name ?? 'General'}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'SCHEDULED') + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status || 'SCHEDULED') }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status || 'SCHEDULED') }]}>
            {(item.status || 'SCHEDULED').replace('_', ' ')}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.gray[500]} />
          <Text style={styles.detailText}>
            {formatAppointmentDate(item.appointmentDate)}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color={colors.gray[500]} />
          <Text style={styles.detailText}>
            {item.startTime ?? 'TBD'} - {item.endTime ?? 'TBD'}
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

      {/* Rate Doctor / Reviewed badge for completed appointments */}
      {item.status === 'COMPLETED' && !reviewedAppointmentIds.includes(item.id) && (
        <TouchableOpacity
          style={styles.rateButton}
          onPress={(e) => {
            e.stopPropagation?.();
            handleOpenReview(item);
          }}
        >
          <Ionicons name="star-outline" size={16} color={colors.warning[600]} />
          <Text style={styles.rateButtonText}>Rate Doctor</Text>
        </TouchableOpacity>
      )}
      {item.status === 'COMPLETED' && reviewedAppointmentIds.includes(item.id) && (
        <View style={styles.reviewedBadge}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success[600]} />
          <Text style={styles.reviewedBadgeText}>Reviewed</Text>
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
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error[500]} />
          <Text style={styles.errorTitle}>Failed to Load Appointments</Text>
          <Text style={styles.errorSubtitle}>Please check your connection and try again</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Ionicons name="refresh" size={20} color={colors.white} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
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
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate Your Visit</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>

            {reviewAppointment && (
              <Text style={styles.modalSubtitle}>
                How was your visit with Dr.{' '}
                {reviewAppointment.doctor?.user?.firstName ?? ''}{' '}
                {reviewAppointment.doctor?.user?.lastName ?? ''}?
              </Text>
            )}

            {/* Star Rating */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= reviewRating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= reviewRating ? colors.warning[500] : colors.gray[300]}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingLabel}>{getRatingLabel(reviewRating)}</Text>

            {/* Comment */}
            <TextInput
              style={styles.commentInput}
              placeholder="Share your experience (optional)"
              placeholderTextColor={colors.gray[400]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (reviewRating === 0 || submitReviewMutation.isPending) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmitReview}
              disabled={reviewRating === 0 || submitReviewMutation.isPending}
            >
              {submitReviewMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  errorSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
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
    bottom: 100,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  // Review styles
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
    gap: spacing.xs,
  },
  rateButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  reviewedBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.success[700],
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  starButton: {
    padding: spacing.xs,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
    marginBottom: spacing.lg,
  },
  submitButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default AppointmentsScreen;
