import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';

interface NotificationSettings {
  appointmentReminders: boolean;
  labResults: boolean;
  prescriptionUpdates: boolean;
  healthTips: boolean;
  promotions: boolean;
}

const NotificationSettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    appointmentReminders: true,
    labResults: true,
    prescriptionUpdates: true,
    healthTips: false,
    promotions: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await patientPortalApi.getNotificationPreferences();
      const data = response.data?.data;
      if (data) {
        setSettings({
          appointmentReminders: data.appointmentReminders ?? true,
          labResults: data.labResultsReady ?? true,
          prescriptionUpdates: data.prescriptionReminders ?? true,
          healthTips: data.healthTips ?? false,
          promotions: false,
        });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    setIsSaving(true);

    try {
      await patientPortalApi.updateNotificationPreferences(newSettings);
    } catch (error) {
      // Revert on error
      setSettings(settings);
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const notificationOptions = [
    {
      key: 'appointmentReminders' as const,
      title: 'Appointment Reminders',
      description: 'Get notified before your scheduled appointments',
    },
    {
      key: 'labResults' as const,
      title: 'Lab Results',
      description: 'Receive alerts when your lab results are ready',
    },
    {
      key: 'prescriptionUpdates' as const,
      title: 'Prescription Updates',
      description: 'Get notified about prescription refills and status',
    },
    {
      key: 'healthTips' as const,
      title: 'Health Tips',
      description: 'Receive personalized health recommendations',
    },
    {
      key: 'promotions' as const,
      title: 'Promotions & Offers',
      description: 'Stay updated on special offers and discounts',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        {notificationOptions.map((option, index) => (
          <View
            key={option.key}
            style={[
              styles.settingRow,
              index < notificationOptions.length - 1 && styles.settingRowBorder,
            ]}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>{option.title}</Text>
              <Text style={styles.settingDescription}>{option.description}</Text>
            </View>
            <Switch
              value={settings[option.key]}
              onValueChange={() => handleToggle(option.key)}
              trackColor={{ false: colors.gray[200], true: colors.primary[200] }}
              thumbColor={settings[option.key] ? colors.primary[600] : colors.gray[400]}
              disabled={isSaving}
            />
          </View>
        ))}
      </View>

      <Text style={styles.footerNote}>
        Push notifications require the app to have notification permissions enabled in your device settings.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  settingDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  footerNote: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});

export default NotificationSettingsScreen;
