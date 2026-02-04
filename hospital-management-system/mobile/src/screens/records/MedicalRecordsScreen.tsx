import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { HealthStackParamList } from '../../types';
import TabBar, { TabItem } from '../../components/common/TabBar';
import { VisitHistoryTab, AllergiesTab, ImmunizationsTab, PastSurgeriesTab, HealthProfileTab } from './tabs';

type MedicalRecordsRouteProp = RouteProp<HealthStackParamList, 'MedicalRecords'>;

type TabKey = 'allergies' | 'immunizations' | 'surgeries' | 'profile' | 'visits';

const TABS: TabItem[] = [
  { key: 'allergies', label: 'Allergies', icon: 'warning-outline' },
  { key: 'immunizations', label: 'Vaccines', icon: 'shield-checkmark-outline' },
  { key: 'surgeries', label: 'Surgeries', icon: 'cut-outline' },
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
  { key: 'visits', label: 'Visits', icon: 'document-text-outline' },
];

const MedicalRecordsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<MedicalRecordsRouteProp>();
  const source = (route.params as any)?.source;
  const initialTab = (route.params as any)?.initialTab as TabKey | undefined;

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab || 'allergies');

  // Custom back handler when accessed from home dashboard
  useLayoutEffect(() => {
    if (source === 'home') {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    { name: 'HomeTab', state: { routes: [{ name: 'Dashboard' }] } },
                    { name: 'AppointmentsTab', state: { routes: [{ name: 'AppointmentsList' }] } },
                    { name: 'HealthTab', state: { routes: [{ name: 'HealthHub' }] } },
                    { name: 'SettingsTab', state: { routes: [{ name: 'SettingsHome' }] } },
                  ],
                })
              );
            }}
            style={{ marginLeft: 8, padding: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, source]);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'allergies':
        return <AllergiesTab />;
      case 'immunizations':
        return <ImmunizationsTab />;
      case 'surgeries':
        return <PastSurgeriesTab />;
      case 'profile':
        return <HealthProfileTab />;
      case 'visits':
        return <VisitHistoryTab />;
      default:
        return <AllergiesTab />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as TabKey)}
      />
      <View style={styles.tabContent}>
        {renderActiveTab()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabContent: {
    flex: 1,
  },
});

export default MedicalRecordsScreen;
