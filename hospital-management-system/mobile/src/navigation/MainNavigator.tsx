import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
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

// Health Sync screens
import HealthSyncScreen from '../screens/health/HealthSyncScreen';
import DeviceConnectionScreen from '../screens/health/DeviceConnectionScreen';
import ManualMetricLogScreen from '../screens/health/ManualMetricLogScreen';

// Medical History screens
import MedicalHistoryScreen from '../screens/health/MedicalHistoryScreen';
import AllergiesScreen from '../screens/health/AllergiesScreen';

// Fitness screens
import { FitnessTrackerScreen, LogActivityScreen, FitnessGoalsScreen, FitnessStatsScreen } from '../screens/fitness';

// Nutrition screens
import { NutritionScreen, LogMealScreen, NutritionPlanScreen } from '../screens/nutrition';

// Wellness screens
import { WellnessHubScreen, WellnessAssessmentScreen, WellnessGoalsScreen, HealthCoachScreen } from '../screens/wellness';

// Messages screens
import { MessagesScreen, MessageThreadScreen, NewMessageScreen } from '../screens/messages';

// A'mad Precision Health - Genomic screens
import { GenomicUploadScreen, GenomicProfileScreen } from '../screens/genomic';

// A'mad Precision Health - Recommendation screens
import RecommendationsScreen from '../screens/health/RecommendationsScreen';
import HealthScoreScreen from '../screens/health/HealthScoreScreen';

// Settings screens
import SettingsScreen from '../screens/settings/SettingsScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import CommunicationSettingsScreen from '../screens/settings/CommunicationSettingsScreen';
import ChangePasswordScreen from '../screens/settings/ChangePasswordScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import BillingScreen from '../screens/billing/BillingScreen';
import BillDetailScreen from '../screens/billing/BillDetailScreen';
import InsuranceScreen from '../screens/settings/InsuranceScreen';

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
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '600',
      },
      headerTitleAlign: 'center',
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
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '600',
      },
      headerTitleAlign: 'center',
      contentStyle: { paddingTop: 0 },
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
      options={{ headerShown: false }}
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
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '600',
      },
      headerTitleAlign: 'center',
      contentStyle: { paddingTop: 0 },
    }}
  >
    <HealthStack.Screen
      name="HealthHub"
      component={HealthHubScreen}
      options={{
        title: 'Health',
        headerBackVisible: false,
        headerLeft: () => null,
      }}
    />
    <HealthStack.Screen
      name="HealthInsights"
      component={HealthInsightsScreen}
      options={{ title: 'Health Insights' }}
    />
    <HealthStack.Screen
      name="SymptomChecker"
      component={SymptomCheckerScreen}
      options={{ headerShown: false }}
    />
    <HealthStack.Screen
      name="HealthAssistant"
      component={HealthAssistantScreen}
      options={{ headerShown: false }}
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
    {/* Health Sync */}
    <HealthStack.Screen
      name="HealthSync"
      component={HealthSyncScreen}
      options={{ title: 'Health Sync' }}
    />
    <HealthStack.Screen
      name="DeviceConnection"
      component={DeviceConnectionScreen}
      options={{ title: 'Connect Device' }}
    />
    <HealthStack.Screen
      name="ManualMetricLog"
      component={ManualMetricLogScreen}
      options={{ title: 'Log Health Metric' }}
    />
    {/* Medical History */}
    <HealthStack.Screen
      name="MedicalHistory"
      component={MedicalHistoryScreen}
      options={{ title: 'Medical History' }}
    />
    <HealthStack.Screen
      name="Allergies"
      component={AllergiesScreen}
      options={{ title: 'Allergies' }}
    />
    {/* Fitness */}
    <HealthStack.Screen
      name="FitnessTracker"
      component={FitnessTrackerScreen}
      options={{ title: 'Fitness Tracker' }}
    />
    <HealthStack.Screen
      name="LogActivity"
      component={LogActivityScreen}
      options={{ title: 'Log Activity' }}
    />
    <HealthStack.Screen
      name="FitnessGoals"
      component={FitnessGoalsScreen}
      options={{ title: 'Fitness Goals' }}
    />
    <HealthStack.Screen
      name="FitnessStats"
      component={FitnessStatsScreen}
      options={{ title: 'Fitness Statistics' }}
    />
    {/* Nutrition */}
    <HealthStack.Screen
      name="Nutrition"
      component={NutritionScreen}
      options={{ title: 'Nutrition' }}
    />
    <HealthStack.Screen
      name="LogMeal"
      component={LogMealScreen}
      options={{ title: 'Log Meal' }}
    />
    <HealthStack.Screen
      name="NutritionPlan"
      component={NutritionPlanScreen}
      options={{ title: 'Nutrition Plans' }}
    />
    {/* Wellness */}
    <HealthStack.Screen
      name="WellnessHub"
      component={WellnessHubScreen}
      options={{ title: 'Wellness Hub' }}
    />
    <HealthStack.Screen
      name="WellnessAssessment"
      component={WellnessAssessmentScreen}
      options={{ title: 'Wellness Assessment' }}
    />
    <HealthStack.Screen
      name="WellnessGoals"
      component={WellnessGoalsScreen}
      options={{ title: 'Wellness Goals' }}
    />
    <HealthStack.Screen
      name="HealthCoach"
      component={HealthCoachScreen}
      options={{ title: 'Health Coach' }}
    />
    {/* Messages */}
    <HealthStack.Screen
      name="Messages"
      component={MessagesScreen}
      options={{ title: 'Messages' }}
    />
    <HealthStack.Screen
      name="MessageThread"
      component={MessageThreadScreen}
      options={{ title: 'Conversation' }}
    />
    <HealthStack.Screen
      name="NewMessage"
      component={NewMessageScreen}
      options={{ title: 'New Message' }}
    />
    {/* A'mad Precision Health - Genomics */}
    <HealthStack.Screen
      name="GenomicUpload"
      component={GenomicUploadScreen}
      options={{ headerShown: false }}
    />
    <HealthStack.Screen
      name="GenomicProfile"
      component={GenomicProfileScreen}
      options={{ headerShown: false }}
    />
    {/* A'mad Precision Health - Recommendations */}
    <HealthStack.Screen
      name="Recommendations"
      component={RecommendationsScreen}
      options={{ headerShown: false }}
    />
    <HealthStack.Screen
      name="HealthScore"
      component={HealthScoreScreen}
      options={{ headerShown: false }}
    />
  </HealthStack.Navigator>
);

const SettingsStackNavigator = () => (
  <SettingsStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.white },
      headerTintColor: colors.text.primary,
      headerShadowVisible: false,
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '600',
      },
      headerTitleAlign: 'center',
      contentStyle: { paddingTop: 0 },
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
    <SettingsStack.Screen
      name="Insurance"
      component={InsuranceScreen}
      options={{ title: 'Insurance' }}
    />
  </SettingsStack.Navigator>
);

// Main tab navigator
const MainNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  // Ensure minimum bottom padding for devices with gesture navigation
  // Android devices often need more padding to avoid system navigation overlap
  const androidExtraPadding = Platform.OS === 'android' ? 10 : 0;
  const bottomPadding = Math.max(insets.bottom, 24) + androidExtraPadding;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: 60 + bottomPadding,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
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
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  { name: 'HomeTab', state: { index: 0, routes: [{ name: 'Dashboard' }] } },
                  { name: 'AppointmentsTab' },
                  { name: 'HealthTab' },
                  { name: 'SettingsTab' },
                ],
              })
            );
          },
        })}
      />
      <Tab.Screen
        name="AppointmentsTab"
        component={AppointmentsStackNavigator}
        options={{ tabBarLabel: 'Appointments' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.reset({
                index: 1,
                routes: [
                  { name: 'HomeTab' },
                  { name: 'AppointmentsTab', state: { index: 0, routes: [{ name: 'AppointmentsList' }] } },
                  { name: 'HealthTab' },
                  { name: 'SettingsTab' },
                ],
              })
            );
          },
        })}
      />
      <Tab.Screen
        name="HealthTab"
        component={HealthStackNavigator}
        options={{ tabBarLabel: 'Health' }}
        listeners={({ navigation, route }) => ({
          tabPress: (e) => {
            // Prevent default tab press behavior
            e.preventDefault();
            // Always reset Health stack to HealthHub when tab is pressed
            navigation.dispatch(
              CommonActions.reset({
                index: 2, // HealthTab index
                routes: [
                  { name: 'HomeTab' },
                  { name: 'AppointmentsTab' },
                  { name: 'HealthTab', state: { index: 0, routes: [{ name: 'HealthHub' }] } },
                  { name: 'SettingsTab' },
                ],
              })
            );
          },
        })}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{ tabBarLabel: 'Settings' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.dispatch(
              CommonActions.reset({
                index: 3,
                routes: [
                  { name: 'HomeTab' },
                  { name: 'AppointmentsTab' },
                  { name: 'HealthTab' },
                  { name: 'SettingsTab', state: { index: 0, routes: [{ name: 'SettingsHome' }] } },
                ],
              })
            );
          },
        })}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
