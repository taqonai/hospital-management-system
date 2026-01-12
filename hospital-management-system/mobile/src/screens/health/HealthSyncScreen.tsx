import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, DeviceConnection, MetricsSummary, MetricType } from '../../services/api';
import { HealthStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<HealthStackParamList>;

const DEVICE_PROVIDERS = [
  { id: 'apple_health', name: 'Apple Health', icon: 'heart', color: '#FF3B30' },
  { id: 'google_fit', name: 'Google Fit', icon: 'fitness', color: '#4285F4' },
  { id: 'fitbit', name: 'Fitbit', icon: 'watch-outline', color: '#00B0B9' },
  { id: 'garmin', name: 'Garmin', icon: 'navigate', color: '#000000' },
  { id: 'samsung_health', name: 'Samsung Health', icon: 'phone-portrait', color: '#1428A0' },
] as const;

const QUICK_LOG_OPTIONS: Array<{ type: MetricType; label: string; icon: string; unit: string }> = [
  { type: 'weight', label: 'Weight', icon: 'scale-outline', unit: 'kg' },
  { type: 'blood_glucose', label: 'Blood Sugar', icon: 'water-outline', unit: 'mg/dL' },
  { type: 'blood_pressure', label: 'Blood Pressure', icon: 'heart-outline', unit: 'mmHg' },
  { type: 'water_intake', label: 'Water', icon: 'water', unit: 'ml' },
  { type: 'sleep', label: 'Sleep', icon: 'moon-outline', unit: 'hours' },
  { type: 'steps', label: 'Steps', icon: 'footsteps-outline', unit: 'steps' },
];

const HealthSyncScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [devices, setDevices] = useState<DeviceConnection[]>([]);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [syncingDevice, setSyncingDevice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [devicesRes, summaryRes] = await Promise.all([
        wellnessApi.getDevices(),
        wellnessApi.getMetricsSummary(),
      ]);
      setDevices(devicesRes.data?.data || []);
      setSummary(summaryRes.data?.data || null);
    } catch (error) {
      console.error('Error loading health sync data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleSyncDevice = async (provider: string) => {
    setSyncingDevice(provider);
    try {
      await wellnessApi.syncDevice(provider);
      Alert.alert('Success', 'Data synced successfully!');
      loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to sync data. Please try again.');
    } finally {
      setSyncingDevice(null);
    }
  };

  const handleDisconnectDevice = (provider: string, name: string) => {
    Alert.alert(
      'Disconnect Device',
      `Are you sure you want to disconnect ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await wellnessApi.disconnectDevice(provider);
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect device.');
            }
          },
        },
      ]
    );
  };

  const getDeviceInfo = (providerId: string) => {
    return DEVICE_PROVIDERS.find(d => d.id === providerId) || {
      name: providerId,
      icon: 'hardware-chip-outline',
      color: colors.gray[500],
    };
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never synced';
    const date = new Date(lastSync);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Today's Summary */}
        {summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Today's Summary</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Ionicons name="footsteps" size={24} color={colors.primary[600]} />
                <Text style={styles.statValue}>{summary.todayStats.steps.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Steps</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="flame" size={24} color={colors.error[500]} />
                <Text style={styles.statValue}>{summary.todayStats.calories}</Text>
                <Text style={styles.statLabel}>Calories</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="water" size={24} color={colors.info[500]} />
                <Text style={styles.statValue}>{summary.todayStats.waterIntake}ml</Text>
                <Text style={styles.statLabel}>Water</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="moon" size={24} color={colors.primary[700]} />
                <Text style={styles.statValue}>{summary.todayStats.sleepHours}h</Text>
                <Text style={styles.statLabel}>Sleep</Text>
              </View>
            </View>
          </View>
        )}

        {/* Connected Devices */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Connected Devices</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('DeviceConnection', {})}
            >
              <Ionicons name="add" size={20} color={colors.primary[600]} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {devices.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="watch-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>No devices connected</Text>
              <Text style={styles.emptyText}>
                Connect a fitness device or health app to automatically sync your health data
              </Text>
              <TouchableOpacity
                style={styles.connectButton}
                onPress={() => navigation.navigate('DeviceConnection', {})}
              >
                <Text style={styles.connectButtonText}>Connect Device</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.deviceList}>
              {devices.map((device) => {
                const info = getDeviceInfo(device.provider);
                const isSyncing = syncingDevice === device.provider;
                return (
                  <View key={device.id} style={styles.deviceCard}>
                    <View style={[styles.deviceIcon, { backgroundColor: `${info.color}15` }]}>
                      <Ionicons name={info.icon as any} size={24} color={info.color} />
                    </View>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{info.name}</Text>
                      <Text style={styles.deviceStatus}>
                        {device.status === 'connected' ? (
                          <>
                            <Text style={{ color: colors.success[600] }}>Connected</Text>
                            {' - '}{formatLastSync(device.lastSync)}
                          </>
                        ) : (
                          <Text style={{ color: colors.warning[600] }}>{device.status}</Text>
                        )}
                      </Text>
                    </View>
                    <View style={styles.deviceActions}>
                      <TouchableOpacity
                        style={styles.syncButton}
                        onPress={() => handleSyncDevice(device.provider)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <ActivityIndicator size="small" color={colors.primary[600]} />
                        ) : (
                          <Ionicons name="sync" size={20} color={colors.primary[600]} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.moreButton}
                        onPress={() => handleDisconnectDevice(device.provider, info.name)}
                      >
                        <Ionicons name="ellipsis-vertical" size={20} color={colors.gray[500]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Quick Log */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Log</Text>
          <Text style={styles.sectionSubtitle}>Manually track your health metrics</Text>
          <View style={styles.quickLogGrid}>
            {QUICK_LOG_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.type}
                style={styles.quickLogItem}
                onPress={() => navigation.navigate('ManualMetricLog', { metricType: option.type })}
              >
                <View style={styles.quickLogIcon}>
                  <Ionicons name={option.icon as any} size={24} color={colors.primary[600]} />
                </View>
                <Text style={styles.quickLogLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  connectButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  connectButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  deviceList: {
    gap: spacing.md,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  deviceName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  deviceStatus: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  syncButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickLogItem: {
    width: '30%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickLogIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickLogLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    textAlign: 'center',
  },
});

export default HealthSyncScreen;
