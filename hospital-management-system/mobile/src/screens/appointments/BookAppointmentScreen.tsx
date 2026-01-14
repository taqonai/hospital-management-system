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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, shadows, keyboardConfig } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Department, Doctor, TimeSlot } from '../../types';
import { AppointmentsStackParamList } from '../../navigation/types';

type BookAppointmentRouteProp = RouteProp<AppointmentsStackParamList, 'BookAppointment'>;

type BookingMode = 'emergency' | 'ai-guided' | 'standard';
type BookingStep = 'mode' | 'department' | 'doctor' | 'date' | 'time' | 'confirm';

type AppointmentType = 'CONSULTATION' | 'FOLLOW_UP' | 'EMERGENCY' | 'TELEMEDICINE' | 'PROCEDURE';

interface BookingData {
  bookingMode: BookingMode | null;
  department: Department | null;
  doctor: Doctor | null;
  date: string;
  timeSlot: TimeSlot | null;
  reason: string;
  type: AppointmentType;
}

const BookAppointmentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<BookAppointmentRouteProp>();
  const [currentStep, setCurrentStep] = useState<BookingStep>('mode');
  const [bookingData, setBookingData] = useState<BookingData>({
    bookingMode: null,
    department: null,
    doctor: null,
    date: '',
    timeSlot: null,
    reason: '',
    type: 'CONSULTATION',
  });

  // Data states
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for AI-guided return params
  const routeParams = route.params;

  // Load departments on mount
  useEffect(() => {
    loadDepartments();
  }, []);

  // Handle AI-guided return - auto-select department or go to department selection
  useEffect(() => {
    if (routeParams?.fromSymptomChecker && departments.length > 0) {
      // Determine appointment type based on urgency from symptom checker
      // Only set EMERGENCY for explicit emergency/urgent_care levels
      const urgency = routeParams.urgency?.toLowerCase();
      const appointmentType: AppointmentType =
        urgency === 'emergency' ? 'EMERGENCY' :
        urgency === 'urgent_care' ? 'EMERGENCY' : 'CONSULTATION';

      // Find department by NAME first (from symptom checker), then by ID
      let dept: Department | undefined;

      if (routeParams?.departmentName) {
        // Find department by name (case-insensitive partial match)
        const deptNameLower = routeParams.departmentName.toLowerCase();
        dept = departments.find(d =>
          d.name.toLowerCase() === deptNameLower ||
          d.name.toLowerCase().includes(deptNameLower) ||
          deptNameLower.includes(d.name.toLowerCase())
        );
        console.log('Finding department by name:', routeParams.departmentName, '-> Found:', dept?.name);
      }

      if (!dept && routeParams?.departmentId) {
        // Fallback to finding by ID
        dept = departments.find(d => d.id === routeParams.departmentId);
      }

      if (dept) {
        // AI suggested a specific department - auto-select it
        setBookingData(prev => ({
          ...prev,
          bookingMode: 'ai-guided',
          department: dept,
          reason: routeParams.symptoms || '',
          type: appointmentType,
        }));
        setCurrentStep('doctor');
        return;
      }

      // No matching department found - go to department selection with symptoms pre-filled
      setBookingData(prev => ({
        ...prev,
        bookingMode: 'ai-guided',
        reason: routeParams.symptoms || '',
        type: appointmentType,
      }));
      setCurrentStep('department');
    }
  }, [routeParams, departments]);

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
      const rawSlots = response.data?.data || response.data || [];

      if (rawSlots.length > 0) {
        // Transform backend response to expected TimeSlot format
        // Backend returns: { time: "09:00 AM", time24: "09:00", isAvailable: true }
        // We need: { startTime: "09:00", endTime: "09:30", isAvailable: true }
        const transformedSlots: TimeSlot[] = rawSlots.map((slot: any, index: number) => {
          // Get the start time in 24-hour format
          const startTime = slot.time24 || slot.startTime || slot.time || '';

          // Calculate end time (30 min later)
          let endTime = slot.endTime || '';
          if (!endTime && startTime) {
            const [hours, mins] = startTime.split(':').map(Number);
            const endMins = mins + 30;
            const endHours = endMins >= 60 ? hours + 1 : hours;
            const finalMins = endMins >= 60 ? endMins - 60 : endMins;
            endTime = `${endHours.toString().padStart(2, '0')}:${finalMins.toString().padStart(2, '0')}`;
          }

          return {
            startTime,
            endTime,
            isAvailable: slot.isAvailable !== false, // Default to true if not specified
          };
        });

        setTimeSlots(transformedSlots);
      } else {
        // Generate default time slots if none returned
        setTimeSlots(generateDefaultTimeSlots());
      }
    } catch (error) {
      console.error('Failed to load time slots:', error);
      // Generate default time slots as fallback
      setTimeSlots(generateDefaultTimeSlots());
    } finally {
      setIsLoading(false);
    }
  };

  // Generate default time slots (9 AM to 5 PM, 30 min intervals)
  const generateDefaultTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = 9; hour < 17; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const endHour = min === 30 ? hour + 1 : hour;
        const endMin = min === 30 ? 0 : 30;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
        slots.push({
          startTime,
          endTime,
          isAvailable: true,
        });
      }
    }
    return slots;
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
    const steps: BookingStep[] = ['mode', 'department', 'doctor', 'date', 'time', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      navigation.goBack();
    }
  };

  const handleBookingModeSelect = (mode: BookingMode) => {
    if (mode === 'emergency') {
      // Emergency: Auto-select Emergency department + today's date
      const emergencyDept = departments.find(d =>
        d.name.toLowerCase().includes('emergency') ||
        d.name.toLowerCase().includes('urgent')
      );
      const today = new Date().toISOString().split('T')[0];

      if (emergencyDept) {
        setBookingData(prev => ({
          ...prev,
          bookingMode: mode,
          type: 'EMERGENCY',
          department: emergencyDept,
          date: today,
          reason: 'Emergency consultation',
        }));
        goToStep('doctor');
      } else {
        // If no emergency dept found, go to department selection
        setBookingData(prev => ({ ...prev, bookingMode: mode, type: 'EMERGENCY' }));
        goToStep('department');
      }
    } else if (mode === 'ai-guided') {
      // AI-Guided: Navigate to Symptom Checker with return param
      navigation.navigate('HealthTab', {
        screen: 'SymptomChecker',
        params: { fromBooking: true }
      });
    } else {
      // Standard: Go to department selection
      // Explicitly set type to CONSULTATION and clear any stale state
      setBookingData(prev => ({
        ...prev,
        bookingMode: mode,
        type: 'CONSULTATION',
        department: null,
      }));
      goToStep('department');
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

  const renderBookingModeStep = () => (
    <View style={styles.modeStepContent}>
      <Text style={styles.modeSubtitle}>Choose how you'd like to proceed</Text>

      {/* Emergency */}
      <TouchableOpacity
        style={styles.modeCard}
        onPress={() => handleBookingModeSelect('emergency')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#FF6B6B', '#EE5A5A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modeCardGradient}
        >
          <View style={styles.modeCardIcon}>
            <Ionicons name="alert-circle" size={28} color={colors.white} />
          </View>
          <View style={styles.modeCardContent}>
            <View style={styles.modeCardHeader}>
              <Text style={styles.modeCardTitle}>Emergency</Text>
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>INSTANT</Text>
              </View>
            </View>
            <Text style={styles.modeCardDesc}>One-click booking for urgent care today</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* AI-Guided */}
      <TouchableOpacity
        style={[styles.modeCard, styles.modeCardLight]}
        onPress={() => handleBookingModeSelect('ai-guided')}
        activeOpacity={0.8}
      >
        <View style={[styles.modeCardIcon, styles.modeCardIconLight]}>
          <Ionicons name="sparkles" size={28} color={colors.secondary[600]} />
        </View>
        <View style={styles.modeCardContent}>
          <View style={styles.modeCardHeader}>
            <Text style={[styles.modeCardTitle, styles.modeCardTitleLight]}>AI-Guided</Text>
            <View style={[styles.modeBadge, styles.modeBadgeLight]}>
              <Text style={[styles.modeBadgeText, styles.modeBadgeTextLight]}>Smart</Text>
            </View>
          </View>
          <Text style={[styles.modeCardDesc, styles.modeCardDescLight]}>
            Unsure which doctor? AI recommends based on symptoms
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.gray[400]} />
      </TouchableOpacity>

      {/* Standard Booking */}
      <TouchableOpacity
        style={styles.modeCard}
        onPress={() => handleBookingModeSelect('standard')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#6B7280', '#4B5563']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.modeCardGradient}
        >
          <View style={styles.modeCardIcon}>
            <Ionicons name="calendar" size={28} color={colors.white} />
          </View>
          <View style={styles.modeCardContent}>
            <View style={styles.modeCardHeader}>
              <Text style={styles.modeCardTitle}>Standard Booking</Text>
            </View>
            <Text style={styles.modeCardDesc}>Choose department, doctor, date & time</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Info box */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={colors.info[600]} />
        <Text style={styles.infoText}>
          Not sure which specialist you need? Try AI-Guided Booking to get recommendations based on your symptoms.
        </Text>
      </View>
    </View>
  );

  const renderStepIndicator = () => {
    // Don't show step indicator on mode selection
    if (currentStep === 'mode') return null;

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
                    Consultation: AED {Number(doctor.consultationFee).toFixed(2)}
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
                    AED {Number(bookingData.doctor.consultationFee).toFixed(2)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Appointment Type */}
        <View style={styles.typeSection}>
          <Text style={styles.sectionLabel}>Appointment Type</Text>
          <View style={styles.typeOptionsGrid}>
            <TouchableOpacity
              style={[
                styles.typeOption,
                bookingData.type === 'CONSULTATION' && styles.typeOptionSelected,
              ]}
              onPress={() => setBookingData({ ...bookingData, type: 'CONSULTATION' })}
            >
              <Ionicons
                name="person"
                size={20}
                color={bookingData.type === 'CONSULTATION' ? colors.primary[600] : colors.gray[400]}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  bookingData.type === 'CONSULTATION' && styles.typeOptionTextSelected,
                ]}
              >
                Consultation
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeOption,
                bookingData.type === 'FOLLOW_UP' && styles.typeOptionSelected,
              ]}
              onPress={() => setBookingData({ ...bookingData, type: 'FOLLOW_UP' })}
            >
              <Ionicons
                name="refresh"
                size={20}
                color={bookingData.type === 'FOLLOW_UP' ? colors.primary[600] : colors.gray[400]}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  bookingData.type === 'FOLLOW_UP' && styles.typeOptionTextSelected,
                ]}
              >
                Follow-up
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
                Telemedicine
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeOption,
                bookingData.type === 'PROCEDURE' && styles.typeOptionSelected,
              ]}
              onPress={() => setBookingData({ ...bookingData, type: 'PROCEDURE' })}
            >
              <Ionicons
                name="medkit"
                size={20}
                color={bookingData.type === 'PROCEDURE' ? colors.primary[600] : colors.gray[400]}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  bookingData.type === 'PROCEDURE' && styles.typeOptionTextSelected,
                ]}
              >
                Procedure
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeOption,
                styles.typeOptionEmergency,
                bookingData.type === 'EMERGENCY' && styles.typeOptionEmergencySelected,
              ]}
              onPress={() => setBookingData({ ...bookingData, type: 'EMERGENCY' })}
            >
              <Ionicons
                name="warning"
                size={20}
                color={bookingData.type === 'EMERGENCY' ? colors.error[700] : colors.error[500]}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  styles.typeOptionTextEmergency,
                  bookingData.type === 'EMERGENCY' && styles.typeOptionTextEmergencySelected,
                ]}
              >
                Emergency
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
      case 'mode':
        return renderBookingModeStep();
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
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={keyboardConfig.behavior as 'padding' | 'height'}
        keyboardVerticalOffset={keyboardConfig.verticalOffset}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Appointment</Text>
          <View style={styles.headerSpacer} />
        </View>

        {renderStepIndicator()}
        {renderCurrentStep()}
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
  typeOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  typeOptionEmergency: {
    borderColor: colors.error[100],
    backgroundColor: colors.error[50],
  },
  typeOptionEmergencySelected: {
    borderColor: colors.error[600],
    backgroundColor: colors.error[100],
  },
  typeOptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  typeOptionTextSelected: {
    color: colors.primary[600],
  },
  typeOptionTextEmergency: {
    color: colors.error[500],
  },
  typeOptionTextEmergencySelected: {
    color: colors.error[700],
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
  // Booking Mode Selection Styles
  modeStepContent: {
    flex: 1,
    padding: spacing.lg,
  },
  modeTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modeSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  modeCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  modeCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modeCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  modeCardIconLight: {
    backgroundColor: colors.secondary[50],
  },
  modeCardIconOutline: {
    backgroundColor: colors.gray[100],
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  modeCardContent: {
    flex: 1,
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modeCardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    marginRight: spacing.sm,
  },
  modeCardTitleLight: {
    color: colors.text.primary,
  },
  modeCardDesc: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  modeCardDescLight: {
    color: colors.text.secondary,
  },
  modeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  modeBadgeLight: {
    backgroundColor: colors.secondary[100],
  },
  modeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  modeBadgeTextLight: {
    color: colors.secondary[700],
  },
  modeCardLight: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modeCardOutline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  modeCardStandardText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.info[50],
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.info[700],
    marginLeft: spacing.sm,
    lineHeight: 20,
  },
});

export default BookAppointmentScreen;
