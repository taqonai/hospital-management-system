import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme';

// Redirect to Medical Records with Health Profile tab
const MedicalHistoryScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  useEffect(() => {
    navigation.replace('MedicalRecords', { initialTab: 'profile' });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary[600]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default MedicalHistoryScreen;
