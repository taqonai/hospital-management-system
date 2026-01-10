import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { offlineActionQueue } from '../../services/offline';

interface OfflineBannerProps {
  showPendingActions?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  showPendingActions = true,
}) => {
  const { isOffline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [slideAnim] = useState(new Animated.Value(-60));

  useEffect(() => {
    // Load pending actions count
    const loadPendingCount = async () => {
      const count = await offlineActionQueue.getPendingCount();
      setPendingCount(count);
    };

    loadPendingCount();

    // Subscribe to queue changes
    const unsubscribe = offlineActionQueue.onProcessComplete(() => {
      loadPendingCount();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? 0 : -60,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, slideAnim]);

  if (!isOffline && pendingCount === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
        isOffline ? styles.offlineContainer : styles.pendingContainer,
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={isOffline ? 'cloud-offline-outline' : 'cloud-upload-outline'}
          size={20}
          color={colors.white}
          style={styles.icon}
        />
        <Text style={styles.text}>
          {isOffline
            ? 'You are offline'
            : `${pendingCount} pending action${pendingCount !== 1 ? 's' : ''}`}
        </Text>
      </View>
      {showPendingActions && pendingCount > 0 && !isOffline && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => offlineActionQueue.tryProcessQueue()}
        >
          <Text style={styles.syncText}>Sync Now</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

interface OfflineIndicatorProps {
  isFromCache?: boolean;
  isStale?: boolean;
  lastUpdated?: Date | string | null;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isFromCache,
  isStale,
  lastUpdated,
}) => {
  if (!isFromCache) {
    return null;
  }

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    const date = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <View style={[styles.indicator, isStale ? styles.staleIndicator : styles.cachedIndicator]}>
      <Ionicons
        name={isStale ? 'warning-outline' : 'cloud-done-outline'}
        size={14}
        color={isStale ? colors.warning[600] : colors.gray[500]}
      />
      <Text style={[styles.indicatorText, isStale && styles.staleText]}>
        {isStale ? 'Offline data (may be outdated)' : 'Cached'}
        {lastUpdated && ` - ${formatLastUpdated()}`}
      </Text>
    </View>
  );
};

interface PendingActionBadgeProps {
  count: number;
}

export const PendingActionBadge: React.FC<PendingActionBadgeProps> = ({ count }) => {
  if (count === 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  offlineContainer: {
    backgroundColor: colors.error[500],
  },
  pendingContainer: {
    backgroundColor: colors.warning[500],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  syncText: {
    color: colors.white,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  cachedIndicator: {
    backgroundColor: colors.gray[100],
  },
  staleIndicator: {
    backgroundColor: colors.warning[50],
  },
  indicatorText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    marginLeft: spacing.xs,
  },
  staleText: {
    color: colors.warning[600],
  },
  badge: {
    backgroundColor: colors.error[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: typography.fontWeight.bold,
  },
});

export default OfflineBanner;
