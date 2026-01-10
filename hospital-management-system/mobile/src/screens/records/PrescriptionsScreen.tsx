import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

const PrescriptionsScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Prescriptions Screen</Text>
      <Text style={styles.description}>View your active medications</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  placeholder: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  description: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
});

export default PrescriptionsScreen;
