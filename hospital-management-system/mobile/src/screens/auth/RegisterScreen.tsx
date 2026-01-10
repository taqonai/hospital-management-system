import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../store';
import { register as registerUser, clearError } from '../../store/authSlice';
import { AuthStackScreenProps } from '../../navigation/types';

type NavigationProp = AuthStackScreenProps<'Register'>['navigation'];

// Validation schema
const registerSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    dispatch(clearError());
    dispatch(registerUser({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      password: data.password,
      dateOfBirth: '1990-01-01', // Default, can be updated in profile
      gender: 'OTHER',
    }));
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
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our patient portal</Text>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Registration Form */}
          <View style={styles.form}>
            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.label}>First Name</Text>
                <Controller
                  control={control}
                  name="firstName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.inputWrapper, errors.firstName && styles.inputError]}>
                      <TextInput
                        style={styles.input}
                        placeholder="First name"
                        placeholderTextColor={colors.gray[400]}
                        autoCapitalize="words"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    </View>
                  )}
                />
                {errors.firstName && (
                  <Text style={styles.fieldError}>{errors.firstName.message}</Text>
                )}
              </View>

              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.label}>Last Name</Text>
                <Controller
                  control={control}
                  name="lastName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.inputWrapper, errors.lastName && styles.inputError]}>
                      <TextInput
                        style={styles.input}
                        placeholder="Last name"
                        placeholderTextColor={colors.gray[400]}
                        autoCapitalize="words"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    </View>
                  )}
                />
                {errors.lastName && (
                  <Text style={styles.fieldError}>{errors.lastName.message}</Text>
                )}
              </View>
            </View>

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
              <Text style={styles.label}>Phone Number</Text>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={20}
                      color={colors.gray[400]}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your phone number"
                      placeholderTextColor={colors.gray[400]}
                      keyboardType="phone-pad"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                  </View>
                )}
              />
              {errors.phone && (
                <Text style={styles.fieldError}>{errors.phone.message}</Text>
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
                      placeholder="Create a password"
                      placeholderTextColor={colors.gray[400]}
                      secureTextEntry={!showPassword}
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

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={colors.gray[400]}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm your password"
                      placeholderTextColor={colors.gray[400]}
                      secureTextEntry={!showConfirmPassword}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={colors.gray[400]}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.confirmPassword && (
                <Text style={styles.fieldError}>{errors.confirmPassword.message}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Sign In</Text>
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
    marginBottom: spacing['2xl'],
  },
  backButton: {
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
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
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
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

export default RegisterScreen;
