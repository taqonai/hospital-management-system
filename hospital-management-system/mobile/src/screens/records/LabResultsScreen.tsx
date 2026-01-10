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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { LabResult } from '../../types';

type FilterType = 'all' | 'pending' | 'completed' | 'abnormal';

const LabResultsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<LabResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    loadLabResults();
  }, []);

  useEffect(() => {
    filterResults();
  }, [labResults, activeFilter]);

  const loadLabResults = async () => {
    try {
      const response = await patientPortalApi.getLabResults();
      setLabResults(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load lab results:', error);
      Alert.alert('Error', 'Failed to load lab results');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filterResults = () => {
    let filtered = [...labResults];

    switch (activeFilter) {
      case 'pending':
        filtered = filtered.filter((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS');
        break;
      case 'completed':
        filtered = filtered.filter((r) => r.status === 'COMPLETED');
        break;
      case 'abnormal':
        filtered = filtered.filter((r) => r.hasAbnormalValues);
        break;
    }

    setFilteredResults(filtered);
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadLabResults();
  }, []);

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
      COMPLETED: colors.success[600],
      PENDING: colors.warning[600],
      IN_PROGRESS: colors.primary[600],
      CANCELLED: colors.error[600],
    };
    return colorMap[status] || colors.gray[500];
  };

  const getValueStatus = (value: number | string, min?: number, max?: number) => {
    if (min === undefined || max === undefined) return 'normal';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'normal';
    if (numValue < min) return 'low';
    if (numValue > max) return 'high';
    return 'normal';
  };

  const getValueColor = (status: string) => {
    switch (status) {
      case 'low':
        return colors.warning[600];
      case 'high':
        return colors.error[600];
      default:
        return colors.text.primary;
    }
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'abnormal', label: 'Abnormal' },
  ];

  const renderLabResultItem = ({ item }: { item: LabResult }) => {
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('LabResultDetail', { resultId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.testIcon, item.hasAbnormalValues && styles.testIconAbnormal]}>
            <Ionicons
              name="flask"
              size={24}
              color={item.hasAbnormalValues ? colors.error[600] : colors.primary[600]}
            />
          </View>
          <View style={styles.testInfo}>
            <Text style={styles.testName}>{item.testName}</Text>
            <Text style={styles.testDate}>{formatDate(item.orderedDate || item.resultDate)}</Text>
          </View>
          <View style={styles.statusContainer}>
            {item.hasAbnormalValues && (
              <View style={styles.abnormalBadge}>
                <Ionicons name="warning" size={14} color={colors.error[600]} />
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status}
              </Text>
            </View>
          </View>
        </View>

        {item.doctorName && (
          <View style={styles.cardMeta}>
            <Ionicons name="person-outline" size={14} color={colors.gray[400]} />
            <Text style={styles.metaText}>Ordered by Dr. {item.doctorName}</Text>
          </View>
        )}

        <View style={styles.chevronIndicator}>
          <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="flask-outline" size={64} color={colors.gray[300]} />
      <Text style={styles.emptyTitle}>No Lab Results</Text>
      <Text style={styles.emptyText}>
        Your lab results will appear here
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

      {/* Lab Results List */}
      <FlatList
        data={filteredResults}
        keyExtractor={(item) => item.id}
        renderItem={renderLabResultItem}
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
  testIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  testIconAbnormal: {
    backgroundColor: colors.error[50],
  },
  testInfo: {
    flex: 1,
  },
  testName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  testDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  abnormalBadge: {
    padding: spacing.xs,
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
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
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
  resultsTable: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tableHeaderText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: colors.gray[50],
  },
  tableCell: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  referenceText: {
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
  },
  noResultsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  notesSection: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
  },
  notesLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[600],
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  downloadText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  pendingMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  pendingText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
  chevronIndicator: {
    justifyContent: 'center',
    paddingLeft: spacing.sm,
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

export default LabResultsScreen;
