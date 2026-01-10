import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../store';
import { loginWithEmail, loginWithBiometric, clearError } from '../../store/authSlice';
import { authApi } from '../../services/api';
import { AuthStackScreenProps } from '../../navigation/types';
import { biometricService } from '../../services/biometric/biometricService';

type NavigationProp = AuthStackScreenProps<'Login'>['navigation'];

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type LoginMethod = 'email' | 'phone';

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { isLoading, error, biometricStatus, isBiometricEnabled } = useAppSelector((state) => state.auth);

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [showPassword, setShowPassword] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Check if biometric login is available
  const canUseBiometric = biometricStatus?.isAvailable &&
    biometricStatus?.isEnrolled &&
    isBiometricEnabled;

  const biometricDisplayName = biometricStatus
    ? biometricService.getBiometricDisplayName(biometricStatus.biometricType)
    : 'Biometric';

  const biometricIcon = biometricStatus
    ? biometricService.getBiometricIcon(biometricStatus.biometricType) as keyof typeof Ionicons.glyphMap
    : 'finger-print-outline';

  // Auto-trigger biometric login on mount if available
  useEffect(() => {
    if (canUseBiometric) {
      handleBiometricLogin();
    }
  }, [canUseBiometric]);

  const handleBiometricLogin = async () => {
    if (!canUseBiometric) return;

    setBiometricLoading(true);
    dispatch(clearError());

    try {
      await dispatch(loginWithBiometric()).unwrap();
    } catch (err: any) {
      // Error is handled in the slice
    } finally {
      setBiometricLoading(false);
    }
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onEmailLogin = async (data: LoginFormData) => {
    dispatch(clearError());
    dispatch(loginWithEmail(data));
  };

  const onSendOTP = async (method: 'sms' | 'whatsapp') => {
    if (!phone || phone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    setSendingOTP(true);
    try {
      const fullPhone = `${countryCode}${phone}`;
      if (method === 'sms') {
        await authApi.sendOTP({ mobile: fullPhone });
      } else {
        await authApi.sendWhatsAppOTP({ mobile: fullPhone });
      }
      navigation.navigate('OTPVerification', { phone: fullPhone, method });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSendingOTP(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="medical" size={48} color={colors.primary[600]} />
            </View>
            <Text style={styles.title}>Patient Portal</Text>
            <Text style={styles.subtitle}>Sign in to access your health records</Text>
          </View>

          {/* Login Method Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, loginMethod === 'email' && styles.activeTab]}
              onPress={() => setLoginMethod('email')}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={loginMethod === 'email' ? colors.primary[600] : colors.gray[500]}
              />
              <Text
                style={[styles.tabText, loginMethod === 'email' && styles.activeTabText]}
              >
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, loginMethod === 'phone' && styles.activeTab]}
              onPress={() => setLoginMethod('phone')}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={20}
                color={loginMethod === 'phone' ? colors.primary[600] : colors.gray[500]}
              />
              <Text
                style={[styles.tabText, loginMethod === 'phone' && styles.activeTabText]}
              >
                Phone
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email Login Form */}
          {loginMethod === 'email' && (
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color={colors.gray[400]}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor={colors.gray[400]}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    </View>
                  )}
                />
                {errors.email && (
                  <Text style={styles.fieldError}>{errors.email.message}</Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={colors.gray[400]}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your password"
                        placeholderTextColor={colors.gray[400]}
                        secureTextEntry={!showPassword}
                        autoComplete="password"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeIcon}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                          size={20}
                          color={colors.gray[400]}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                />
                {errors.password && (
                  <Text style={styles.fieldError}>{errors.password.message}</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSubmit(onEmailLogin)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Phone Login Form */}
          {loginMethod === 'phone' && (
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.phoneInputContainer}>
                  <TouchableOpacity style={styles.countryCodeButton}>
                    <Text style={styles.countryCodeText}>{countryCode}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.gray[500]} />
                  </TouchableOpacity>
                  <View style={styles.phoneInputWrapper}>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="Enter phone number"
                      placeholderTextColor={colors.gray[400]}
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.button, sendingOTP && styles.buttonDisabled]}
                onPress={() => onSendOTP('sms')}
                disabled={sendingOTP}
              >
                {sendingOTP ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="chatbubble-outline" size={20} color={colors.white} />
                    <Text style={styles.buttonText}>Send SMS OTP</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.whatsappButton, sendingOTP && styles.buttonDisabled]}
                onPress={() => onSendOTP('whatsapp')}
                disabled={sendingOTP}
              >
                <Ionicons name="logo-whatsapp" size={20} color={colors.white} />
                <Text style={styles.buttonText}>Send WhatsApp OTP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Biometric Login */}
          {canUseBiometric && (
            <View style={styles.biometricSection}>
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>
              <TouchableOpacity
                style={[styles.biometricButton, biometricLoading && styles.buttonDisabled]}
                onPress={handleBiometricLogin}
                disabled={biometricLoading || isLoading}
              >
                {biometricLoading ? (
                  <ActivityIndicator color={colors.primary[600]} />
                ) : (
                  <>
                    <Ionicons name={biometricIcon} size={28} color={colors.primary[600]} />
                    <Text style={styles.biometricButtonText}>
                      Sign in with {biometricDisplayName}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Register Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.linkText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing['2xl'],
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  activeTab: {
    backgroundColor: colors.white,
  },
  tabText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[500],
    fontWeight: typography.fontWeight.medium,
  },
  activeTabText: {
    color: colors.primary[600],
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  form: {
    gap: spacing.lg,
  },
  inputContainer: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.error[500],
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  fieldError: {
    fontSize: typography.fontSize.xs,
    color: colors.error[600],
    marginTop: spacing.xs,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.xs,
  },
  countryCodeText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  phoneInputWrapper: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
  },
  phoneInput: {
    height: 48,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  biometricSection: {
    marginTop: spacing.xl,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[300],
  },
  dividerText: {
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  biometricButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing['2xl'],
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  linkText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
});

export default LoginScreen;
