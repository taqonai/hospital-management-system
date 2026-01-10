import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../store';
import { logout, enableBiometric, disableBiometric, checkBiometricStatus } from '../../store/authSlice';
import { biometricService } from '../../services/biometric/biometricService';

interface SettingItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen?: string;
  onPress?: () => void;
  showArrow?: boolean;
  color?: string;
}

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const { user, biometricStatus, isBiometricEnabled } = useAppSelector((state) => state.auth);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Check biometric status on mount
  useEffect(() => {
    dispatch(checkBiometricStatus());
  }, [dispatch]);

  const biometricAvailable = biometricStatus?.isAvailable && biometricStatus?.isEnrolled;
  const biometricDisplayName = biometricStatus
    ? biometricService.getBiometricDisplayName(biometricStatus.biometricType)
    : 'Biometric';

  const handleBiometricToggle = async (value: boolean) => {
    if (biometricLoading) return;

    setBiometricLoading(true);
    try {
      if (value) {
        await dispatch(enableBiometric()).unwrap();
        Alert.alert('Success', `${biometricDisplayName} login enabled`);
      } else {
        await dispatch(disableBiometric()).unwrap();
        Alert.alert('Success', `${biometricDisplayName} login disabled`);
      }
    } catch (error: any) {
      Alert.alert('Error', error || 'Failed to update biometric settings');
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => dispatch(logout()),
        },
      ]
    );
  };

  const settingsGroups: { title: string; items: SettingItem[] }[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          title: 'Profile',
          icon: 'person-outline',
          screen: 'Profile',
          showArrow: true,
        },
        {
          id: 'billing',
          title: 'Billing & Payments',
          icon: 'card-outline',
          screen: 'Billing',
          showArrow: true,
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          id: 'notifications',
          title: 'Notifications',
          icon: 'notifications-outline',
          screen: 'NotificationSettings',
          showArrow: true,
        },
        {
          id: 'communication',
          title: 'Communication',
          icon: 'mail-outline',
          screen: 'CommunicationSettings',
          showArrow: true,
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          id: 'password',
          title: 'Change Password',
          icon: 'lock-closed-outline',
          screen: 'ChangePassword',
          showArrow: true,
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          id: 'about',
          title: 'About App',
          icon: 'information-circle-outline',
          screen: 'About',
          showArrow: true,
        },
        {
          id: 'logout',
          title: 'Logout',
          icon: 'log-out-outline',
          onPress: handleLogout,
          color: colors.error[600],
        },
      ],
    },
  ];

  const handlePress = (item: SettingItem) => {
    if (item.onPress) {
      item.onPress();
    } else if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <TouchableOpacity
        style={styles.profileCard}
        onPress={() => navigation.navigate('Profile')}
      >
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={colors.primary[600]} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
      </TouchableOpacity>

      {/* Settings Groups */}
      {settingsGroups.map((group) => (
        <View key={group.title} style={styles.group}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.groupCard}>
            {group.items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.settingItem,
                  index < group.items.length - 1 && styles.settingItemBorder,
                ]}
                onPress={() => handlePress(item)}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={item.color || colors.gray[600]}
                />
                <Text
                  style={[
                    styles.settingTitle,
                    item.color && { color: item.color },
                  ]}
                >
                  {item.title}
                </Text>
                {item.showArrow && (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.gray[400]}
                  />
                )}
              </TouchableOpacity>
            ))}

            {/* Add Biometric Toggle to Security Group */}
            {group.title === 'Security' && biometricAvailable && (
              <View style={[styles.settingItem, styles.settingItemBorder]}>
                <Ionicons
                  name={biometricStatus?.biometricType === 'facial' ? 'scan-outline' : 'finger-print-outline'}
                  size={22}
                  color={colors.gray[600]}
                />
                <View style={styles.biometricTextContainer}>
                  <Text style={styles.settingTitle}>{biometricDisplayName}</Text>
                  <Text style={styles.biometricSubtitle}>Quick sign-in with biometrics</Text>
                </View>
                {biometricLoading ? (
                  <ActivityIndicator size="small" color={colors.primary[600]} />
                ) : (
                  <Switch
                    value={isBiometricEnabled}
                    onValueChange={handleBiometricToggle}
                    trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                    thumbColor={isBiometricEnabled ? colors.primary[600] : colors.gray[100]}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      ))}

      <Text style={styles.version}>Version 1.0.0</Text>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  profileEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  group: {
    marginBottom: spacing.xl,
  },
  groupTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  settingTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  biometricTextContainer: {
    flex: 1,
  },
  biometricSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  version: {
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xl,
  },
});

export default SettingsScreen;
