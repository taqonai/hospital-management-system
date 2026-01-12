import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { wellnessApi, DeviceConnection } from '../../services/api';
import { HealthStackParamList } from '../../types';

type RouteProps = RouteProp<HealthStackParamList, 'DeviceConnection'>;

const DEVICE_PROVIDERS = [
  {
    id: 'apple_health',
    name: 'Apple Health',
    icon: 'heart',
    color: '#FF3B30',
    description: 'Sync data from Apple Health including steps, heart rate, and more',
    platform: 'ios',
    permissions: ['steps', 'heart_rate', 'sleep', 'weight', 'blood_pressure'],
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    icon: 'fitness',
    color: '#4285F4',
    description: 'Connect to Google Fit for activity and health data',
    platform: 'android',
    permissions: ['steps', 'heart_rate', 'sleep', 'weight', 'calories'],
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    icon: 'watch-outline',
    color: '#00B0B9',
    description: 'Sync your Fitbit device data including activity and sleep',
    platform: 'all',
    permissions: ['steps', 'heart_rate', 'sleep', 'weight', 'calories', 'distance'],
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    icon: 'navigate',
    color: '#000000',
    description: 'Connect your Garmin device for fitness and health metrics',
    platform: 'all',
    permissions: ['steps', 'heart_rate', 'sleep', 'calories', 'distance', 'stress'],
  },
  {
    id: 'samsung_health',
    name: 'Samsung Health',
    icon: 'phone-portrait',
    color: '#1428A0',
    description: 'Sync data from Samsung Health on your Galaxy device',
    platform: 'android',
    permissions: ['steps', 'heart_rate', 'sleep', 'weight', 'blood_pressure'],
  },
];

const DeviceConnectionScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const selectedProvider = route.params?.provider;

  const [connectedDevices, setConnectedDevices] = useState<DeviceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  useEffect(() => {
    loadConnectedDevices();
  }, []);

  const loadConnectedDevices = async () => {
    try {
      const response = await wellnessApi.getDevices();
      setConnectedDevices(response.data?.data || []);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (provider: typeof DEVICE_PROVIDERS[0]) => {
    setConnectingProvider(provider.id);
    try {
      // Check platform compatibility
      if (provider.platform !== 'all' && Platform.OS !== provider.platform) {
        Alert.alert(
          'Not Available',
          `${provider.name} is only available on ${provider.platform === 'ios' ? 'iOS' : 'Android'} devices.`
        );
        return;
      }

      await wellnessApi.connectDevice({
        provider: provider.id,
        permissions: provider.permissions,
      });

      Alert.alert(
        'Connected',
        `Successfully connected to ${provider.name}. Your health data will now sync automatically.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to connect device. Please try again.';
      Alert.alert('Connection Failed', message);
    } finally {
      setConnectingProvider(null);
    }
  };

  const isConnected = (providerId: string) => {
    return connectedDevices.some(d => d.provider === providerId && d.status === 'connected');
  };

  const getAvailableProviders = () => {
    return DEVICE_PROVIDERS.filter(p => {
      if (p.platform === 'all') return true;
      return Platform.OS === p.platform;
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  const availableProviders = getAvailableProviders();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Connect a Device</Text>
        <Text style={styles.subtitle}>
          Link your fitness devices and health apps to automatically sync your health data
        </Text>

        <View style={styles.providerList}>
          {availableProviders.map((provider) => {
            const connected = isConnected(provider.id);
            const isConnecting = connectingProvider === provider.id;

            return (
              <View key={provider.id} style={styles.providerCard}>
                <View style={[styles.providerIcon, { backgroundColor: `${provider.color}15` }]}>
                  <Ionicons name={provider.icon as any} size={28} color={provider.color} />
                </View>
                <View style={styles.providerInfo}>
                  <View style={styles.providerHeader}>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    {connected && (
                      <View style={styles.connectedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success[600]} />
                        <Text style={styles.connectedText}>Connected</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.providerDescription}>{provider.description}</Text>
                  <View style={styles.permissionsList}>
                    {provider.permissions.slice(0, 4).map((perm) => (
                      <View key={perm} style={styles.permissionBadge}>
                        <Text style={styles.permissionText}>
                          {perm.replace('_', ' ')}
                        </Text>
                      </View>
                    ))}
                    {provider.permissions.length > 4 && (
                      <View style={styles.permissionBadge}>
                        <Text style={styles.permissionText}>
                          +{provider.permissions.length - 4} more
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.connectButton,
                    connected && styles.connectedButton,
                    isConnecting && styles.connectingButton,
                  ]}
                  onPress={() => !connected && handleConnect(provider)}
                  disabled={connected || isConnecting}
                >
                  {isConnecting ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : connected ? (
                    <Ionicons name="checkmark" size={20} color={colors.success[600]} />
                  ) : (
                    <Text style={styles.connectButtonText}>Connect</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={24} color={colors.primary[600]} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Your data is secure</Text>
            <Text style={styles.infoText}>
              We only access the data types you authorize. You can disconnect at any time from the Health Sync settings.
            </Text>
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
    lineHeight: 22,
  },
  providerList: {
    gap: spacing.md,
  },
  providerCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  providerIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  providerInfo: {
    flex: 1,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  providerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  connectedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
  providerDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  permissionBadge: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  permissionText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  connectButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  connectedButton: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[100],
  },
  connectingButton: {
    opacity: 0.7,
  },
  connectButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    lineHeight: 20,
  },
});

export default DeviceConnectionScreen;
