import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

interface MenuItem {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  screen: string;
}

const menuItems: MenuItem[] = [
  {
    id: 'insights',
    title: 'Health Insights',
    description: 'View your health score and trends',
    icon: 'analytics-outline',
    color: colors.primary[600],
    bgColor: colors.primary[50],
    screen: 'HealthInsights',
  },
  {
    id: 'symptom',
    title: 'Symptom Checker',
    description: 'Check symptoms and get guidance',
    icon: 'fitness-outline',
    color: colors.error[600],
    bgColor: colors.error[50],
    screen: 'SymptomChecker',
  },
  {
    id: 'assistant',
    title: 'Health Assistant',
    description: 'Ask health questions',
    icon: 'chatbubbles-outline',
    color: colors.success[600],
    bgColor: colors.success[50],
    screen: 'HealthAssistant',
  },
  {
    id: 'records',
    title: 'Medical Records',
    description: 'View your medical documents',
    icon: 'document-text-outline',
    color: colors.gray[600],
    bgColor: colors.gray[100],
    screen: 'MedicalRecords',
  },
  {
    id: 'prescriptions',
    title: 'Prescriptions',
    description: 'View active medications',
    icon: 'medical-outline',
    color: colors.warning[600],
    bgColor: colors.warning[50],
    screen: 'Prescriptions',
  },
  {
    id: 'labs',
    title: 'Lab Results',
    description: 'View your test results',
    icon: 'flask-outline',
    color: colors.primary[700],
    bgColor: colors.primary[100],
    screen: 'LabResults',
  },
];

const HealthHubScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your Health Hub</Text>
      <Text style={styles.subtitle}>Manage your health information</Text>

      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={[styles.iconContainer, { backgroundColor: item.bgColor }]}>
              <Ionicons name={item.icon} size={28} color={item.color} />
            </View>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  menuItem: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  menuTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  menuDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 16,
  },
});

export default HealthHubScreen;
