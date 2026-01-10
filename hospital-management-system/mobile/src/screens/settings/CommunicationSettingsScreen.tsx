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

interface CommunicationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
}

const CommunicationSettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<CommunicationSettings>({
    emailNotifications: true,
    smsNotifications: true,
    whatsappNotifications: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await patientPortalApi.getCommunicationPreferences();
      const data = response.data?.data;
      if (data) {
        setSettings({
          emailNotifications: data.emailNotifications ?? true,
          smsNotifications: data.smsNotifications ?? true,
          whatsappNotifications: false,
        });
      }
    } catch (error) {
      console.error('Failed to load communication settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof CommunicationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    setIsSaving(true);

    try {
      await patientPortalApi.updateCommunicationPreferences(newSettings);
    } catch (error) {
      setSettings(settings);
      Alert.alert('Error', 'Failed to update communication settings');
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

  const communicationOptions = [
    {
      key: 'emailNotifications' as const,
      title: 'Email',
      description: 'Receive notifications via email',
      icon: 'mail-outline',
    },
    {
      key: 'smsNotifications' as const,
      title: 'SMS',
      description: 'Receive notifications via text message',
      icon: 'chatbubble-outline',
    },
    {
      key: 'whatsappNotifications' as const,
      title: 'WhatsApp',
      description: 'Receive notifications via WhatsApp',
      icon: 'logo-whatsapp',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionHeader}>Communication Channels</Text>
      <Text style={styles.sectionDescription}>
        Choose how you'd like to receive updates from us
      </Text>

      <View style={styles.card}>
        {communicationOptions.map((option, index) => (
          <View
            key={option.key}
            style={[
              styles.settingRow,
              index < communicationOptions.length - 1 && styles.settingRowBorder,
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
        At least one communication channel must remain active to receive important health updates.
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
  sectionHeader: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
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

export default CommunicationSettingsScreen;
