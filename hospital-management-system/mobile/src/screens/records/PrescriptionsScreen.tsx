import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Prescription } from '../../types';

type FilterType = 'all' | 'active' | 'completed' | 'refill';

const PrescriptionsScreen: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [filteredPrescriptions, setFilteredPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refillLoading, setRefillLoading] = useState<string | null>(null);

  useEffect(() => {
    loadPrescriptions();
  }, []);

  useEffect(() => {
    filterPrescriptions();
  }, [prescriptions, activeFilter]);

  const loadPrescriptions = async () => {
    try {
      const response = await patientPortalApi.getPrescriptions();
      setPrescriptions(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load prescriptions:', error);
      Alert.alert('Error', 'Failed to load prescriptions');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filterPrescriptions = () => {
    let filtered = [...prescriptions];

    switch (activeFilter) {
      case 'active':
        filtered = filtered.filter((p) => p.status === 'ACTIVE');
        break;
      case 'completed':
        filtered = filtered.filter((p) => p.status === 'COMPLETED' || p.status === 'DISPENSED');
        break;
      case 'refill':
        filtered = filtered.filter((p) => p.refillsRemaining && p.refillsRemaining > 0);
        break;
    }

    setFilteredPrescriptions(filtered);
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadPrescriptions();
  }, []);

  const handleRequestRefill = async (prescriptionId: string) => {
    setRefillLoading(prescriptionId);
    try {
      await patientPortalApi.requestRefill(prescriptionId);
      Alert.alert('Success', 'Refill request submitted successfully');
      loadPrescriptions();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to request refill');
    } finally {
      setRefillLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      ACTIVE: colors.success[600],
      PENDING: colors.warning[600],
      DISPENSED: colors.primary[600],
      COMPLETED: colors.gray[500],
      CANCELLED: colors.error[600],
    };
    return colorMap[status] || colors.gray[500];
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'refill', label: 'Refill Available' },
  ];

  const renderPrescriptionItem = ({ item }: { item: Prescription }) => {
    const isExpanded = expandedId === item.id;
    const statusColor = getStatusColor(item.status);
    const canRefill = item.refillsRemaining && item.refillsRemaining > 0 && item.status === 'ACTIVE';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.medicationIcon}>
            <Ionicons name="medical" size={24} color={colors.primary[600]} />
          </View>
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{item.medicationName}</Text>
            <Text style={styles.dosage}>{item.dosage} - {item.frequency}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color={colors.gray[400]} />
            <Text style={styles.metaText}>Dr. {item.doctorName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.gray[400]} />
            <Text style={styles.metaText}>{formatDate(item.prescribedDate)}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {item.instructions && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Instructions:</Text>
                <Text style={styles.detailValue}>{item.instructions}</Text>
              </View>
            )}

            {item.duration && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Duration:</Text>
                <Text style={styles.detailValue}>{item.duration}</Text>
              </View>
            )}

            {item.quantity && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Quantity:</Text>
                <Text style={styles.detailValue}>{item.quantity}</Text>
              </View>
            )}

            {item.refillsRemaining !== undefined && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Refills Remaining:</Text>
                <Text style={styles.detailValue}>{item.refillsRemaining}</Text>
              </View>
            )}

            {item.pharmacy && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pharmacy:</Text>
                <Text style={styles.detailValue}>{item.pharmacy}</Text>
              </View>
            )}

            {canRefill && (
              <TouchableOpacity
                style={styles.refillButton}
                onPress={() => handleRequestRefill(item.id)}
                disabled={refillLoading === item.id}
              >
                {refillLoading === item.id ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={18} color={colors.white} />
                    <Text style={styles.refillButtonText}>Request Refill</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.expandIndicator}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.gray[400]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="medkit-outline" size={64} color={colors.gray[300]} />
      <Text style={styles.emptyTitle}>No Prescriptions</Text>
      <Text style={styles.emptyText}>
        Your prescriptions will appear here
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                activeFilter === item.key && styles.filterTabActive,
              ]}
              onPress={() => setActiveFilter(item.key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === item.key && styles.filterTabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Prescriptions List */}
      <FlatList
        data={filteredPrescriptions}
        keyExtractor={(item) => item.id}
        renderItem={renderPrescriptionItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary[600]]}
          />
        }
      />
    </View>
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
  filterContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filterTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  filterTabActive: {
    backgroundColor: colors.primary[600],
  },
  filterTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  filterTabTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  dosage: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  cardMeta: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    gap: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  expandedContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    width: 120,
  },
  detailValue: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  refillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  refillButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
});

export default PrescriptionsScreen;
