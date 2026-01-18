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
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import {
  healthPlatformApi,
  PlatformConnection,
  HealthPlatformType,
} from '../../services/api';
import {
  HealthPlatformService,
  HealthDataType,
  HealthPlatformStatus,
} from '../../../modules/health-platform/src';

// Available data types to sync
const DATA_TYPES_TO_SYNC: HealthDataType[] = [
  'STEPS',
  'HEART_RATE',
  'SLEEP_DURATION',
  'CALORIES_BURNED',
  'DISTANCE',
  'WEIGHT',
  'BLOOD_OXYGEN',
  'HRV',
];

interface PlatformInfo {
  id: HealthPlatformType;
  name: string;
  icon: string;
  color: string;
  description: string;
  platform: 'ios' | 'android' | 'both';
}

const PLATFORMS: PlatformInfo[] = [
  {
    id: 'APPLE_HEALTH_KIT',
    name: 'Apple Health',
    icon: 'heart',
    color: '#FF3B30',
    description: 'Sync data from Apple Health including steps, heart rate, sleep, and workouts.',
    platform: 'ios',
  },
  {
    id: 'GOOGLE_HEALTH_CONNECT',
    name: 'Google Health Connect',
    icon: 'fitness',
    color: '#4285F4',
    description: 'Sync data from Health Connect including fitness, vitals, and sleep data.',
    platform: 'android',
  },
  {
    id: 'SAMSUNG_HEALTH',
    name: 'Samsung Health',
    icon: 'phone-portrait',
    color: '#1428A0',
    description: 'Sync data from Samsung Health on compatible Samsung devices.',
    platform: 'android',
  },
];

const HealthPlatformConnectScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<PlatformConnection[]>([]);
  const [platformStatus, setPlatformStatus] = useState<HealthPlatformStatus | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{ success: boolean; count: number } | null>(null);

  const healthService = HealthPlatformService.getInstance();

  // Load data on screen focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      // Get native platform status
      const status = await healthService.getStatus();
      setPlatformStatus(status);

      // Get connected platforms from backend
      const response = await healthPlatformApi.getConnectedPlatforms();
      if (response.data) {
        setConnectedPlatforms(response.data);
      }
    } catch (error) {
      console.error('Error loading health platform data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleConnect = async (platform: PlatformInfo) => {
    setConnectingPlatform(platform.id);

    try {
      // Check if native platform is available
      const isAvailable = await healthService.isAvailable();
      if (!isAvailable) {
        Alert.alert(
          'Not Available',
          `${platform.name} is not available on this device. Please make sure it's installed and set up.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('x-apple-health://');
                } else {
                  Linking.openURL('market://details?id=com.google.android.apps.healthdata');
                }
              },
            },
          ]
        );
        return;
      }

      // Request authorization from native platform
      const authResult = await healthService.requestAuthorization(DATA_TYPES_TO_SYNC);

      if (!authResult.granted) {
        Alert.alert(
          'Permission Required',
          authResult.error || `Please grant access to ${platform.name} in your device settings.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Register connection with backend
      const response = await healthPlatformApi.connectPlatform({
        platform: platform.id,
        scopes: DATA_TYPES_TO_SYNC,
      });

      if (response.data?.connected) {
        Alert.alert('Connected', `Successfully connected to ${platform.name}!`);
        loadData();
      }
    } catch (error: any) {
      console.error('Error connecting platform:', error);
      Alert.alert('Error', error.message || 'Failed to connect. Please try again.');
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async (platform: PlatformInfo) => {
    Alert.alert(
      'Disconnect',
      `Are you sure you want to disconnect from ${platform.name}? Your synced data will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await healthPlatformApi.disconnectPlatform(platform.id);
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to disconnect.');
            }
          },
        },
      ]
    );
  };

  const handleSync = async (platform: PlatformInfo) => {
    setSyncingPlatform(platform.id);
    setLastSyncResult(null);

    try {
      // Get date range for sync (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Sync data from native platform
      const syncResult = await healthService.syncData({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        dataTypes: DATA_TYPES_TO_SYNC,
      });

      if (!syncResult.success) {
        throw new Error(syncResult.error || 'Sync failed');
      }

      // Send data to backend
      if (syncResult.dataPoints.length > 0) {
        const response = await healthPlatformApi.syncHealthData({
          source: platform.id,
          data: syncResult.dataPoints.map((dp: { dataType: string; value: number; unit: string; timestamp: string; metadata?: Record<string, any> }) => ({
            dataType: dp.dataType as HealthDataType,
            value: dp.value,
            unit: dp.unit,
            timestamp: dp.timestamp,
            metadata: dp.metadata,
          })),
        });

        setLastSyncResult({
          success: true,
          count: response.data?.synced || syncResult.dataPoints.length,
        });

        Alert.alert(
          'Sync Complete',
          `Successfully synced ${response.data?.synced || syncResult.dataPoints.length} data points from ${platform.name}.`
        );
      } else {
        setLastSyncResult({ success: true, count: 0 });
        Alert.alert('No New Data', 'No new health data found to sync.');
      }

      loadData();
    } catch (error: any) {
      console.error('Error syncing:', error);
      setLastSyncResult({ success: false, count: 0 });
      Alert.alert('Sync Failed', error.message || 'Failed to sync data. Please try again.');
    } finally {
      setSyncingPlatform(null);
    }
  };

  const isConnected = (platformId: HealthPlatformType): boolean => {
    return connectedPlatforms.some(p => p.platform === platformId && p.isActive);
  };

  const getConnectionInfo = (platformId: HealthPlatformType): PlatformConnection | undefined => {
    return connectedPlatforms.find(p => p.platform === platformId);
  };

  const formatLastSync = (timestamp?: string): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getAvailablePlatforms = (): PlatformInfo[] => {
    return PLATFORMS.filter(p => {
      if (p.platform === 'both') return true;
      return Platform.OS === p.platform;
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading health platforms...</Text>
        </View>
      </SafeAreaView>
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
        {/* Header Info */}
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <Ionicons name="sync-circle" size={32} color={colors.primary[600]} />
          </View>
          <Text style={styles.headerTitle}>Connect Health Platforms</Text>
          <Text style={styles.headerDescription}>
            Sync your health data from your device's native health app to get personalized insights and recommendations.
          </Text>
        </View>

        {/* Native Platform Status */}
        {platformStatus && (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Device Platform:</Text>
              <Text style={styles.statusValue}>
                {Platform.OS === 'ios' ? 'iOS (HealthKit)' : 'Android (Health Connect)'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Available:</Text>
              <View style={styles.statusBadge}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: platformStatus.isAvailable ? colors.success[500] : colors.error[500] },
                  ]}
                />
                <Text style={styles.statusBadgeText}>
                  {platformStatus.isAvailable ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Available Platforms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Platforms</Text>
          {getAvailablePlatforms().map(platform => {
            const connected = isConnected(platform.id);
            const connectionInfo = getConnectionInfo(platform.id);
            const isConnecting = connectingPlatform === platform.id;
            const isSyncing = syncingPlatform === platform.id;

            return (
              <View key={platform.id} style={styles.platformCard}>
                <View style={styles.platformHeader}>
                  <View style={[styles.platformIcon, { backgroundColor: `${platform.color}20` }]}>
                    <Ionicons name={platform.icon as any} size={24} color={platform.color} />
                  </View>
                  <View style={styles.platformInfo}>
                    <Text style={styles.platformName}>{platform.name}</Text>
                    <Text style={styles.platformDescription}>{platform.description}</Text>
                  </View>
                  {connected && (
                    <View style={styles.connectedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success[600]} />
                      <Text style={styles.connectedText}>Connected</Text>
                    </View>
                  )}
                </View>

                {connected && connectionInfo && (
                  <View style={styles.connectionDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={16} color={colors.gray[500]} />
                      <Text style={styles.detailText}>
                        Last synced: {formatLastSync(connectionInfo.lastSyncAt)}
                      </Text>
                    </View>
                    {connectionInfo.scopes && connectionInfo.scopes.length > 0 && (
                      <View style={styles.detailRow}>
                        <Ionicons name="list-outline" size={16} color={colors.gray[500]} />
                        <Text style={styles.detailText}>
                          {connectionInfo.scopes.length} data types enabled
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.platformActions}>
                  {connected ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.syncButton]}
                        onPress={() => handleSync(platform)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <ActivityIndicator size="small" color={colors.primary[600]} />
                        ) : (
                          <>
                            <Ionicons name="sync" size={18} color={colors.primary[600]} />
                            <Text style={styles.syncButtonText}>Sync Now</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.disconnectButton]}
                        onPress={() => handleDisconnect(platform)}
                      >
                        <Ionicons name="unlink" size={18} color={colors.error[600]} />
                        <Text style={styles.disconnectButtonText}>Disconnect</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.connectButton]}
                      onPress={() => handleConnect(platform)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Ionicons name="link" size={18} color={colors.white} />
                          <Text style={styles.connectButtonText}>Connect</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Data Types Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data We Sync</Text>
          <View style={styles.dataTypesGrid}>
            {[
              { type: 'STEPS', label: 'Steps', icon: 'footsteps' },
              { type: 'HEART_RATE', label: 'Heart Rate', icon: 'heart' },
              { type: 'SLEEP_DURATION', label: 'Sleep', icon: 'moon' },
              { type: 'CALORIES_BURNED', label: 'Calories', icon: 'flame' },
              { type: 'DISTANCE', label: 'Distance', icon: 'map' },
              { type: 'WEIGHT', label: 'Weight', icon: 'scale' },
              { type: 'BLOOD_OXYGEN', label: 'SpO2', icon: 'pulse' },
              { type: 'HRV', label: 'HRV', icon: 'analytics' },
            ].map(item => (
              <View key={item.type} style={styles.dataTypeItem}>
                <Ionicons name={item.icon as any} size={20} color={colors.primary[600]} />
                <Text style={styles.dataTypeLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark" size={20} color={colors.info[600]} />
          <Text style={styles.privacyText}>
            Your health data is encrypted and securely stored. We only sync the data types you authorize and never share your information with third parties.
          </Text>
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
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  content: {
    padding: spacing.lg,
  },
  headerCard: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  headerDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  statusLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  statusValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  platformCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  platformIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  platformName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  platformDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  connectedText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  connectionDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  platformActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  connectButton: {
    backgroundColor: colors.primary[600],
  },
  connectButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  syncButton: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  syncButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  disconnectButton: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[100],
  },
  disconnectButtonText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  dataTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dataTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  dataTypeLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  privacyNotice: {
    flexDirection: 'row',
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  privacyText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.info[700],
    lineHeight: 18,
  },
});

export default HealthPlatformConnectScreen;
