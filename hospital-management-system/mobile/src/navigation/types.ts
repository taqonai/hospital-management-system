import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';

// Root stack
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Auth stack
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OTPVerification: { phone: string; method: 'sms' | 'whatsapp' };
  ForgotPassword: undefined;
};

// Main tab navigator
export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  AppointmentsTab: NavigatorScreenParams<AppointmentsStackParamList>;
  HealthTab: NavigatorScreenParams<HealthStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};

// Home stack
export type HomeStackParamList = {
  Dashboard: undefined;
  Notifications: undefined;
};

// Appointments stack
export type AppointmentsStackParamList = {
  AppointmentsList: undefined;
  BookAppointment: { doctorId?: string; departmentId?: string } | undefined;
  AppointmentDetail: { appointmentId: string };
  SelectDoctor: { departmentId: string };
  SelectSlot: { doctorId: string; date: string };
};

// Health stack
export type HealthStackParamList = {
  HealthHub: undefined;
  HealthInsights: undefined;
  SymptomChecker: undefined;
  HealthAssistant: undefined;
  MedicalRecords: undefined;
  RecordDetail: { recordId: string };
  Prescriptions: undefined;
  PrescriptionDetail: { prescriptionId: string };
  LabResults: undefined;
  LabResultDetail: { resultId: string };
  MedicalHistory: undefined;
  Allergies: undefined;
  // Health Sync
  HealthSync: undefined;
  DeviceConnection: { provider?: string };
  ManualMetricLog: { metricType?: string };
  // Fitness
  FitnessTracker: undefined;
  LogActivity: { activityType?: string };
  FitnessGoals: undefined;
  FitnessStats: undefined;
  // Nutrition
  Nutrition: undefined;
  LogMeal: { mealType?: string };
  NutritionPlan: undefined;
  // Wellness
  WellnessHub: undefined;
  WellnessAssessment: undefined;
  WellnessGoals: undefined;
  HealthCoach: undefined;
  // Messages
  Messages: undefined;
  MessageThread: { threadId: string };
  NewMessage: { recipientId?: string };
};

// Settings stack
export type SettingsStackParamList = {
  SettingsHome: undefined;
  Profile: undefined;
  NotificationSettings: undefined;
  CommunicationSettings: undefined;
  ChangePassword: undefined;
  Billing: undefined;
  BillDetail: { billId: string };
  About: undefined;
};

// Screen props types
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AuthStackParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type HomeStackScreenProps<T extends keyof HomeStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HomeStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type AppointmentsStackScreenProps<T extends keyof AppointmentsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AppointmentsStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type HealthStackScreenProps<T extends keyof HealthStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HealthStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

export type SettingsStackScreenProps<T extends keyof SettingsStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<SettingsStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

// Declare global navigation types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
