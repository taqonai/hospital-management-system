import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import {
  MainTabParamList,
  HomeStackParamList,
  AppointmentsStackParamList,
  HealthStackParamList,
  SettingsStackParamList,
} from './types';

// Home screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';

// Appointments screens
import AppointmentsScreen from '../screens/appointments/AppointmentsScreen';
import BookAppointmentScreen from '../screens/appointments/BookAppointmentScreen';
import AppointmentDetailScreen from '../screens/appointments/AppointmentDetailScreen';

// Health screens
import HealthHubScreen from '../screens/health/HealthHubScreen';
import HealthInsightsScreen from '../screens/health/HealthInsightsScreen';
import SymptomCheckerScreen from '../screens/health/SymptomCheckerScreen';
import HealthAssistantScreen from '../screens/health/HealthAssistantScreen';
import MedicalRecordsScreen from '../screens/records/MedicalRecordsScreen';
import PrescriptionsScreen from '../screens/records/PrescriptionsScreen';
import PrescriptionDetailScreen from '../screens/records/PrescriptionDetailScreen';
import LabResultsScreen from '../screens/records/LabResultsScreen';
import LabResultDetailScreen from '../screens/records/LabResultDetailScreen';

// Settings screens
import SettingsScreen from '../screens/settings/SettingsScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import CommunicationSettingsScreen from '../screens/settings/CommunicationSettingsScreen';
import ChangePasswordScreen from '../screens/settings/ChangePasswordScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import BillingScreen from '../screens/billing/BillingScreen';
import BillDetailScreen from '../screens/billing/BillDetailScreen';

// Create navigators
const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const AppointmentsStack = createNativeStackNavigator<AppointmentsStackParamList>();
const HealthStack = createNativeStackNavigator<HealthStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

// Stack navigators
const HomeStackNavigator = () => (
  <HomeStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.white },
      headerTintColor: colors.text.primary,
      headerShadowVisible: false,
    }}
  >
    <HomeStack.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{ headerShown: false }}
    />
  </HomeStack.Navigator>
);

const AppointmentsStackNavigator = () => (
  <AppointmentsStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.white },
      headerTintColor: colors.text.primary,
      headerShadowVisible: false,
    }}
  >
    <AppointmentsStack.Screen
      name="AppointmentsList"
      component={AppointmentsScreen}
      options={{ title: 'Appointments' }}
    />
    <AppointmentsStack.Screen
      name="BookAppointment"
      component={BookAppointmentScreen}
      options={{ title: 'Book Appointment' }}
    />
    <AppointmentsStack.Screen
      name="AppointmentDetail"
      component={AppointmentDetailScreen}
      options={{ title: 'Appointment Details' }}
    />
  </AppointmentsStack.Navigator>
);

const HealthStackNavigator = () => (
  <HealthStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.white },
      headerTintColor: colors.text.primary,
      headerShadowVisible: false,
    }}
  >
    <HealthStack.Screen
      name="HealthHub"
      component={HealthHubScreen}
      options={{ title: 'Health' }}
    />
    <HealthStack.Screen
      name="HealthInsights"
      component={HealthInsightsScreen}
      options={{ title: 'Health Insights' }}
    />
    <HealthStack.Screen
      name="SymptomChecker"
      component={SymptomCheckerScreen}
      options={{ title: 'Symptom Checker' }}
    />
    <HealthStack.Screen
      name="HealthAssistant"
      component={HealthAssistantScreen}
      options={{ title: 'Health Assistant' }}
    />
    <HealthStack.Screen
      name="MedicalRecords"
      component={MedicalRecordsScreen}
      options={{ title: 'Medical Records' }}
    />
    <HealthStack.Screen
      name="Prescriptions"
      component={PrescriptionsScreen}
      options={{ title: 'Prescriptions' }}
    />
    <HealthStack.Screen
      name="PrescriptionDetail"
      component={PrescriptionDetailScreen}
      options={{ title: 'Prescription Details' }}
    />
    <HealthStack.Screen
      name="LabResults"
      component={LabResultsScreen}
      options={{ title: 'Lab Results' }}
    />
    <HealthStack.Screen
      name="LabResultDetail"
      component={LabResultDetailScreen}
      options={{ title: 'Lab Result Details' }}
    />
  </HealthStack.Navigator>
);

const SettingsStackNavigator = () => (
  <SettingsStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.white },
      headerTintColor: colors.text.primary,
      headerShadowVisible: false,
    }}
  >
    <SettingsStack.Screen
      name="SettingsHome"
      component={SettingsScreen}
      options={{ title: 'Settings' }}
    />
    <SettingsStack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
    <SettingsStack.Screen
      name="NotificationSettings"
      component={NotificationSettingsScreen}
      options={{ title: 'Notifications' }}
    />
    <SettingsStack.Screen
      name="CommunicationSettings"
      component={CommunicationSettingsScreen}
      options={{ title: 'Communication' }}
    />
    <SettingsStack.Screen
      name="ChangePassword"
      component={ChangePasswordScreen}
      options={{ title: 'Change Password' }}
    />
    <SettingsStack.Screen
      name="About"
      component={AboutScreen}
      options={{ title: 'About' }}
    />
    <SettingsStack.Screen
      name="Billing"
      component={BillingScreen}
      options={{ title: 'Billing' }}
    />
    <SettingsStack.Screen
      name="BillDetail"
      component={BillDetailScreen}
      options={{ title: 'Bill Details' }}
    />
  </SettingsStack.Navigator>
);

// Main tab navigator
const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'HomeTab':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'AppointmentsTab':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'HealthTab':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
            case 'SettingsTab':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="AppointmentsTab"
        component={AppointmentsStackNavigator}
        options={{ tabBarLabel: 'Appointments' }}
      />
      <Tab.Screen
        name="HealthTab"
        component={HealthStackNavigator}
        options={{ tabBarLabel: 'Health' }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
