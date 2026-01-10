import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Department, Doctor, TimeSlot } from '../../types';

type BookingStep = 'department' | 'doctor' | 'date' | 'time' | 'confirm';

interface BookingData {
  department: Department | null;
  doctor: Doctor | null;
  date: string;
  timeSlot: TimeSlot | null;
  reason: string;
  type: 'IN_PERSON' | 'TELEMEDICINE';
}

const BookAppointmentScreen: React.FC = () => {
  const navigation = useNavigation();
  const [currentStep, setCurrentStep] = useState<BookingStep>('department');
  const [bookingData, setBookingData] = useState<BookingData>({
    department: null,
    doctor: null,
    date: '',
    timeSlot: null,
    reason: '',
    type: 'IN_PERSON',
  });

  // Data states
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load departments on mount
  useEffect(() => {
    loadDepartments();
  }, []);

  // Load doctors when department changes
  useEffect(() => {
    if (bookingData.department) {
      loadDoctors(bookingData.department.id);
    }
  }, [bookingData.department]);

  // Load time slots when doctor and date change
  useEffect(() => {
    if (bookingData.doctor && bookingData.date) {
      loadTimeSlots(bookingData.doctor.id, bookingData.date);
    }
  }, [bookingData.doctor, bookingData.date]);

  // Generate available dates (next 14 days, excluding Sundays)
  useEffect(() => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() !== 0) { // Exclude Sundays
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    setAvailableDates(dates);
  }, []);

  const loadDepartments = async () => {
    setIsLoading(true);
    try {
      const response = await patientPortalApi.getDepartments();
      setDepartments(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
      Alert.alert('Error', 'Failed to load departments');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDoctors = async (departmentId: string) => {
    setIsLoading(true);
    try {
      const response = await patientPortalApi.getDoctors({ departmentId });
      setDoctors(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load doctors:', error);
      Alert.alert('Error', 'Failed to load doctors');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTimeSlots = async (doctorId: string, date: string) => {
    setIsLoading(true);
    try {
      const response = await patientPortalApi.getAvailableSlots(doctorId, date);
      setTimeSlots(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load time slots:', error);
      Alert.alert('Error', 'Failed to load available times');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookAppointment = async () => {
    if (!bookingData.doctor || !bookingData.timeSlot) return;

    setIsSubmitting(true);
    try {
      await patientPortalApi.bookAppointment({
        doctorId: bookingData.doctor.id,
        appointmentDate: bookingData.date,
        startTime: bookingData.timeSlot.startTime,
        type: bookingData.type,
        reason: bookingData.reason,
      });

      Alert.alert(
        'Success',
        'Your appointment has been booked successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to book appointment'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToStep = (step: BookingStep) => {
    setCurrentStep(step);
  };

  const goBack = () => {
    const steps: BookingStep[] = ['department', 'doctor', 'date', 'time', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      navigation.goBack();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'department', label: 'Dept' },
      { key: 'doctor', label: 'Doctor' },
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
      { key: 'confirm', label: 'Confirm' },
    ];
    const currentIndex = steps.findIndex((s) => s.key === currentStep);

    return (
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  index <= currentIndex && styles.stepCircleActive,
                  index < currentIndex && styles.stepCircleCompleted,
                ]}
              >
                {index < currentIndex ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      index <= currentIndex && styles.stepNumberActive,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  index <= currentIndex && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  index < currentIndex && styles.stepLineActive,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const renderDepartmentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Department</Text>
      <Text style={styles.stepSubtitle}>Choose a medical specialty</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary[600]} style={styles.loader} />
      ) : (
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
          {departments.map((dept) => (
            <TouchableOpacity
              key={dept.id}
              style={[
                styles.optionCard,
                bookingData.department?.id === dept.id && styles.optionCardSelected,
              ]}
              onPress={() => {
                setBookingData({ ...bookingData, department: dept, doctor: null });
                goToStep('doctor');
              }}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="medical" size={24} color={colors.primary[600]} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{dept.name}</Text>
                {dept.description && (
                  <Text style={styles.optionSubtitle} numberOfLines={2}>
                    {dept.description}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderDoctorStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Doctor</Text>
      <Text style={styles.stepSubtitle}>
        {bookingData.department?.name} specialists
      </Text>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary[600]} style={styles.loader} />
      ) : doctors.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyText}>No doctors available</Text>
        </View>
      ) : (
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
          {doctors.map((doctor) => (
            <TouchableOpacity
              key={doctor.id}
              style={[
                styles.optionCard,
                bookingData.doctor?.id === doctor.id && styles.optionCardSelected,
              ]}
              onPress={() => {
                setBookingData({ ...bookingData, doctor });
                goToStep('date');
              }}
            >
              <View style={styles.doctorAvatar}>
                <Ionicons name="person" size={24} color={colors.primary[600]} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>
                  Dr. {doctor.user?.firstName} {doctor.user?.lastName}
                </Text>
                <Text style={styles.optionSubtitle}>{doctor.specialization}</Text>
                {doctor.consultationFee && (
                  <Text style={styles.feeText}>
                    Consultation: ${Number(doctor.consultationFee).toFixed(2)}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderDateStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Date</Text>
      <Text style={styles.stepSubtitle}>Choose your preferred appointment date</Text>

      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        <View style={styles.dateGrid}>
          {availableDates.map((date) => (
            <TouchableOpacity
              key={date}
              style={[
                styles.dateCard,
                bookingData.date === date && styles.dateCardSelected,
              ]}
              onPress={() => {
                setBookingData({ ...bookingData, date, timeSlot: null });
                goToStep('time');
              }}
            >
              <Text
                style={[
                  styles.dateDay,
                  bookingData.date === date && styles.dateDaySelected,
                ]}
              >
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text
                style={[
                  styles.dateNumber,
                  bookingData.date === date && styles.dateNumberSelected,
                ]}
              >
                {new Date(date).getDate()}
              </Text>
              <Text
                style={[
                  styles.dateMonth,
                  bookingData.date === date && styles.dateMonthSelected,
                ]}
              >
                {new Date(date).toLocaleDateString('en-US', { month: 'short' })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderTimeStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Time</Text>
      <Text style={styles.stepSubtitle}>{formatDate(bookingData.date)}</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary[600]} style={styles.loader} />
      ) : timeSlots.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyText}>No available slots for this date</Text>
          <TouchableOpacity
            style={styles.changeDateButton}
            onPress={() => goToStep('date')}
          >
            <Text style={styles.changeDateText}>Choose another date</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
          <View style={styles.timeGrid}>
            {timeSlots
              .filter((slot) => slot.isAvailable)
              .map((slot) => (
                <TouchableOpacity
                  key={slot.startTime}
                  style={[
                    styles.timeCard,
                    bookingData.timeSlot?.startTime === slot.startTime &&
                      styles.timeCardSelected,
                  ]}
                  onPress={() => {
                    setBookingData({ ...bookingData, timeSlot: slot });
                    goToStep('confirm');
                  }}
                >
                  <Text
                    style={[
                      styles.timeText,
                      bookingData.timeSlot?.startTime === slot.startTime &&
                        styles.timeTextSelected,
                    ]}
                  >
                    {formatTime(slot.startTime)}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        </ScrollView>
      )}
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm Booking</Text>
      <Text style={styles.stepSubtitle}>Review your appointment details</Text>

      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="medical" size={20} color={colors.primary[600]} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryLabel}>Department</Text>
              <Text style={styles.summaryValue}>{bookingData.department?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => goToStep('department')}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="person" size={20} color={colors.primary[600]} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryLabel}>Doctor</Text>
              <Text style={styles.summaryValue}>
                Dr. {bookingData.doctor?.user?.firstName} {bookingData.doctor?.user?.lastName}
              </Text>
            </View>
            <TouchableOpacity onPress={() => goToStep('doctor')}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="calendar" size={20} color={colors.primary[600]} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryLabel}>Date & Time</Text>
              <Text style={styles.summaryValue}>
                {formatDate(bookingData.date)} at {formatTime(bookingData.timeSlot?.startTime || '')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => goToStep('date')}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>

          {bookingData.doctor?.consultationFee && (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <View style={styles.summaryIcon}>
                  <Ionicons name="card" size={20} color={colors.primary[600]} />
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryLabel}>Consultation Fee</Text>
                  <Text style={styles.summaryValue}>
                    ${Number(bookingData.doctor.consultationFee).toFixed(2)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Appointment Type */}
        <View style={styles.typeSection}>
          <Text style={styles.sectionLabel}>Appointment Type</Text>
          <View style={styles.typeOptions}>
            <TouchableOpacity
              style={[
                styles.typeOption,
                bookingData.type === 'IN_PERSON' && styles.typeOptionSelected,
              ]}
              onPress={() => setBookingData({ ...bookingData, type: 'IN_PERSON' })}
            >
              <Ionicons
                name="person"
                size={20}
                color={bookingData.type === 'IN_PERSON' ? colors.primary[600] : colors.gray[400]}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  bookingData.type === 'IN_PERSON' && styles.typeOptionTextSelected,
                ]}
              >
                In Person
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeOption,
                bookingData.type === 'TELEMEDICINE' && styles.typeOptionSelected,
              ]}
              onPress={() => setBookingData({ ...bookingData, type: 'TELEMEDICINE' })}
            >
              <Ionicons
                name="videocam"
                size={20}
                color={bookingData.type === 'TELEMEDICINE' ? colors.primary[600] : colors.gray[400]}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  bookingData.type === 'TELEMEDICINE' && styles.typeOptionTextSelected,
                ]}
              >
                Video Call
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reason for Visit */}
        <View style={styles.reasonSection}>
          <Text style={styles.sectionLabel}>Reason for Visit (Optional)</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Describe your symptoms or reason for visit..."
            placeholderTextColor={colors.gray[400]}
            multiline
            numberOfLines={3}
            value={bookingData.reason}
            onChangeText={(text) => setBookingData({ ...bookingData, reason: text })}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
        onPress={handleBookAppointment}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color={colors.white} />
            <Text style={styles.confirmButtonText}>Confirm Booking</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'department':
        return renderDepartmentStep();
      case 'doctor':
        return renderDoctorStep();
      case 'date':
        return renderDateStep();
      case 'time':
        return renderTimeStep();
      case 'confirm':
        return renderConfirmStep();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderStepIndicator()}
      {renderCurrentStep()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: colors.primary[600],
  },
  stepCircleCompleted: {
    backgroundColor: colors.success[600],
  },
  stepNumber: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.gray[500],
  },
  stepNumberActive: {
    color: colors.white,
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
    marginTop: spacing.xs,
  },
  stepLabelActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  stepLineActive: {
    backgroundColor: colors.success[600],
  },
  stepContent: {
    flex: 1,
    padding: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  loader: {
    marginTop: spacing['2xl'],
  },
  optionsList: {
    flex: 1,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  optionCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary[600],
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  doctorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  optionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  feeText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  changeDateButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
  },
  changeDateText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  dateCard: {
    width: '23%',
    aspectRatio: 0.85,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    margin: '1%',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  dateCardSelected: {
    backgroundColor: colors.primary[600],
  },
  dateDay: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  dateDaySelected: {
    color: colors.primary[100],
  },
  dateNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginVertical: spacing.xs,
  },
  dateNumberSelected: {
    color: colors.white,
  },
  dateMonth: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  dateMonthSelected: {
    color: colors.primary[100],
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  timeCard: {
    width: '31%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    margin: '1%',
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  timeCardSelected: {
    backgroundColor: colors.primary[600],
  },
  timeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  timeTextSelected: {
    color: colors.white,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.md,
  },
  changeLink: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  typeSection: {
    marginTop: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  typeOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  typeOptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  typeOptionTextSelected: {
    color: colors.primary[600],
  },
  reasonSection: {
    marginTop: spacing.xl,
  },
  reasonInput: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 100,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});

export default BookAppointmentScreen;
