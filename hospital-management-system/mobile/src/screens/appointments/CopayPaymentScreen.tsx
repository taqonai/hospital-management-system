import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { AppointmentsStackParamList } from '../../navigation/types';

type CopayPaymentRouteProp = RouteProp<AppointmentsStackParamList, 'CopayPayment'>;

interface CopayInfo {
  appointmentId: string;
  copayAmount: number;
  paymentStatus: string;
  paymentMethod?: string;
  paidAt?: string;
}

type PaymentChoice = 'pay_online' | 'pay_at_clinic' | 'decide_later';

const CopayPaymentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<CopayPaymentRouteProp>();
  const queryClient = useQueryClient();
  
  const { appointmentId, doctorName, appointmentDate, appointmentTime } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copayInfo, setCopayInfo] = useState<CopayInfo | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<PaymentChoice | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Fetch copay info on mount
  useEffect(() => {
    fetchCopayInfo();
  }, []);

  const fetchCopayInfo = async () => {
    try {
      setIsLoading(true);
      const response = await patientPortalApi.getCopayInfo(appointmentId);
      const data = response.data?.data || response.data;
      setCopayInfo(data);
    } catch (error) {
      console.error('Failed to fetch copay info:', error);
      // Use default copay if API fails
      setCopayInfo({
        appointmentId,
        copayAmount: 50,
        paymentStatus: 'pending',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentChoice = async (choice: PaymentChoice) => {
    setSelectedChoice(choice);
    setIsProcessing(true);

    try {
      switch (choice) {
        case 'pay_online':
          // For now, show a message that online payment will open
          // In production, integrate with Stripe React Native SDK
          Alert.alert(
            'Online Payment',
            'Online payment integration coming soon. Please select "Pay at Clinic" for now.',
            [{ text: 'OK', onPress: () => setIsProcessing(false) }]
          );
          setSelectedChoice(null);
          return;

        case 'pay_at_clinic':
          await patientPortalApi.selectPayAtClinic(appointmentId);
          setIsComplete(true);
          break;

        case 'decide_later':
          await patientPortalApi.selectDecideLater(appointmentId);
          setIsComplete(true);
          break;
      }

      // Invalidate queries to refresh appointment data
      await queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save payment preference');
      setSelectedChoice(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDone = () => {
    // Navigate back to appointments list
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'AppointmentsList' }],
      })
    );
  };

  const renderPaymentOptions = () => (
    <View style={styles.optionsContainer}>
      {/* Pay Now Option */}
      <TouchableOpacity
        style={[styles.optionCard, styles.payNowCard]}
        onPress={() => handlePaymentChoice('pay_online')}
        disabled={isProcessing}
      >
        <View style={styles.optionIconContainer}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.optionIconGradient}
          >
            <Ionicons name="card-outline" size={28} color="#fff" />
          </LinearGradient>
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Pay Now</Text>
          <Text style={styles.optionSubtitle}>Faster check-in, skip the queue!</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.success} />
      </TouchableOpacity>

      {/* Pay at Clinic Option */}
      <TouchableOpacity
        style={[styles.optionCard, styles.clinicCard]}
        onPress={() => handlePaymentChoice('pay_at_clinic')}
        disabled={isProcessing}
      >
        <View style={styles.optionIconContainer}>
          <View style={[styles.optionIconBg, { backgroundColor: colors.warning + '20' }]}>
            <Ionicons name="cash-outline" size={28} color={colors.warning} />
          </View>
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Pay Cash at Clinic</Text>
          <Text style={styles.optionSubtitle}>Pay at reception when you arrive</Text>
        </View>
        {selectedChoice === 'pay_at_clinic' && isProcessing ? (
          <ActivityIndicator size="small" color={colors.warning} />
        ) : (
          <Ionicons name="chevron-forward" size={24} color={colors.textLight} />
        )}
      </TouchableOpacity>

      {/* Decide Later Option */}
      <TouchableOpacity
        style={[styles.optionCard, styles.laterCard]}
        onPress={() => handlePaymentChoice('decide_later')}
        disabled={isProcessing}
      >
        <View style={styles.optionIconContainer}>
          <View style={[styles.optionIconBg, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="time-outline" size={28} color={colors.primary} />
          </View>
        </View>
        <View style={styles.optionContent}>
          <Text style={styles.optionTitle}>Decide Later</Text>
          <Text style={styles.optionSubtitle}>We'll remind you 24h before</Text>
        </View>
        {selectedChoice === 'decide_later' && isProcessing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={24} color={colors.textLight} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <View style={styles.successIconContainer}>
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.successIconGradient}
        >
          <Ionicons name="checkmark" size={48} color="#fff" />
        </LinearGradient>
      </View>
      
      <Text style={styles.successTitle}>
        {selectedChoice === 'pay_at_clinic' ? 'Preference Saved' : 'Reminder Set'}
      </Text>
      
      <Text style={styles.successMessage}>
        {selectedChoice === 'pay_at_clinic'
          ? `Please pay AED ${copayInfo?.copayAmount || 50} at the reception when you arrive.`
          : "We'll send you a payment reminder 24 hours before your appointment."}
      </Text>

      <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.doneButtonGradient}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleDone}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {isComplete ? 'All Set!' : 'Copay Payment'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {doctorName} • {appointmentDate}
        </Text>
      </LinearGradient>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading payment details...</Text>
          </View>
        ) : isComplete ? (
          renderSuccess()
        ) : (
          <>
            {/* Amount Display */}
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Copay Amount Due</Text>
              <Text style={styles.amountValue}>
                AED {copayInfo?.copayAmount || 50}
              </Text>
            </View>

            {/* Payment Options */}
            {renderPaymentOptions()}

            {/* Security Note */}
            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              <Text style={styles.securityText}>
                Your payment is secured with industry-standard encryption.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
  },
  skipButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    padding: spacing.sm,
  },
  skipButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textLight,
    fontSize: 14,
  },
  amountContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  amountValue: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xs,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  payNowCard: {
    borderWidth: 2,
    borderColor: colors.success + '30',
    backgroundColor: colors.success + '05',
  },
  clinicCard: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  laterCard: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIconContainer: {
    marginRight: spacing.md,
  },
  optionIconGradient: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconBg: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  optionSubtitle: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  securityText: {
    fontSize: 12,
    color: colors.primary,
    flex: 1,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  successIconContainer: {
    marginBottom: spacing.lg,
  },
  successIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successMessage: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
  },
  doneButton: {
    marginTop: spacing.xl,
    width: '100%',
  },
  doneButtonGradient: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CopayPaymentScreen;
