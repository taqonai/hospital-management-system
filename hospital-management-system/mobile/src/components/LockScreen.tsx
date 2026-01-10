import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

interface LockScreenProps {
  onUnlock: () => void;
  onLogout?: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, onLogout }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'none'>('none');

  useEffect(() => {
    checkBiometricType();
    // Auto-trigger biometric on mount
    handleBiometricAuth();
  }, []);

  const checkBiometricType = async () => {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('face');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('fingerprint');
      }
    } catch (error) {
      console.error('Failed to check biometric type:', error);
    }
  };

  const handleBiometricAuth = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    setError(null);

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setError('Biometric hardware not available');
        setIsAuthenticating(false);
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        setError('No biometrics enrolled on this device');
        setIsAuthenticating(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your health data',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        onUnlock();
      } else if (result.error === 'user_cancel') {
        setError('Authentication cancelled');
      } else if (result.error === 'lockout') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Biometric auth error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  const getBiometricIcon = () => {
    switch (biometricType) {
      case 'face':
        return 'scan-outline';
      case 'fingerprint':
        return 'finger-print';
      default:
        return 'lock-closed';
    }
  };

  const getBiometricLabel = () => {
    switch (biometricType) {
      case 'face':
        return 'Face ID';
      case 'fingerprint':
        return 'Touch ID';
      default:
        return 'Biometric';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Icon */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="medical" size={48} color={colors.primary[600]} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>App Locked</Text>
        <Text style={styles.subtitle}>
          Authenticate to access your health information
        </Text>

        {/* Biometric Button */}
        <TouchableOpacity
          style={styles.biometricButton}
          onPress={handleBiometricAuth}
          disabled={isAuthenticating}
          activeOpacity={0.8}
        >
          {isAuthenticating ? (
            <ActivityIndicator size="large" color={colors.primary[600]} />
          ) : (
            <>
              <View style={styles.biometricIconContainer}>
                <Ionicons
                  name={getBiometricIcon()}
                  size={48}
                  color={colors.primary[600]}
                />
              </View>
              <Text style={styles.biometricLabel}>
                Tap to use {getBiometricLabel()}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color={colors.error[600]} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Try Again Button */}
        {error && !isAuthenticating && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleBiometricAuth}
          >
            <Ionicons name="refresh" size={18} color={colors.primary[600]} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer with Logout */}
      {onLogout && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error[600]} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Security Notice */}
      <View style={styles.securityNotice}>
        <Ionicons name="shield-checkmark" size={14} color={colors.gray[400]} />
        <Text style={styles.securityText}>
          Your health data is protected
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing['2xl'],
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  biometricButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  biometricIconContainer: {
    marginBottom: spacing.sm,
  },
  biometricLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error[50],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
    flex: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  retryText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  logoutText: {
    fontSize: typography.fontSize.base,
    color: colors.error[600],
    fontWeight: typography.fontWeight.medium,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  securityText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
  },
});

export default LockScreen;
