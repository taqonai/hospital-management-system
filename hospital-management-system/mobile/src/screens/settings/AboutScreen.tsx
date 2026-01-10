import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

const AboutScreen: React.FC = () => {
  const appVersion = '1.0.0';
  const buildNumber = '1';

  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  const linkItems = [
    {
      title: 'Terms of Service',
      icon: 'document-text-outline' as const,
      url: 'https://example.com/terms',
    },
    {
      title: 'Privacy Policy',
      icon: 'shield-checkmark-outline' as const,
      url: 'https://example.com/privacy',
    },
    {
      title: 'Contact Support',
      icon: 'mail-outline' as const,
      url: 'mailto:support@hospital.com',
    },
    {
      title: 'Rate the App',
      icon: 'star-outline' as const,
      url: 'https://apps.apple.com/app', // Replace with actual app store URL
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* App Logo and Info */}
      <View style={styles.headerCard}>
        <View style={styles.logoContainer}>
          <Ionicons name="medical" size={48} color={colors.primary[600]} />
        </View>
        <Text style={styles.appName}>HMS Patient Portal</Text>
        <Text style={styles.tagline}>Your Health, Our Priority</Text>
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>
            Version {appVersion} ({buildNumber})
          </Text>
        </View>
      </View>

      {/* Links */}
      <View style={styles.card}>
        {linkItems.map((item, index) => (
          <TouchableOpacity
            key={item.title}
            style={[
              styles.linkItem,
              index < linkItems.length - 1 && styles.linkItemBorder,
            ]}
            onPress={() => handleOpenLink(item.url)}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={colors.gray[600]}
            />
            <Text style={styles.linkText}>{item.title}</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.gray[400]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Credits */}
      <View style={styles.creditsContainer}>
        <Text style={styles.creditsText}>
          Built with care for patients everywhere
        </Text>
        <Text style={styles.copyrightText}>
          © {new Date().getFullYear()} Hospital Management System
        </Text>
        <Text style={styles.copyrightText}>All rights reserved</Text>
      </View>

      {/* Tech Stack (hidden in production) */}
      {__DEV__ && (
        <View style={styles.devInfo}>
          <Text style={styles.devTitle}>Development Info</Text>
          <Text style={styles.devText}>React Native + Expo</Text>
          <Text style={styles.devText}>TypeScript</Text>
          <Text style={styles.devText}>Redux Toolkit</Text>
        </View>
      )}
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
    paddingBottom: spacing['3xl'],
  },
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  appName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  versionContainer: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  versionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  linkItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  linkText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  creditsContainer: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  creditsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  copyrightText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
    marginBottom: spacing.xs,
  },
  devInfo: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  devTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.sm,
  },
  devText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    marginBottom: spacing.xs,
  },
});

export default AboutScreen;
