import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Bill } from '../../types';

type FilterType = 'all' | 'pending' | 'paid';

const BillingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState<{ totalDue: number; pendingBills: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterBills();
  }, [bills, activeFilter]);

  const loadData = async () => {
    try {
      setError(null);
      const [billsResponse, summaryResponse] = await Promise.all([
        patientPortalApi.getBills(),
        patientPortalApi.getBillingSummary(),
      ]);

      setBills(billsResponse.data?.data || []);
      setSummary(summaryResponse.data?.data || { totalDue: 0, pendingBills: 0 });
    } catch (err: any) {
      console.error('Failed to load billing data:', err);
      setError(err?.message || 'Failed to load billing information');
      // Set default empty values so UI still renders
      setBills([]);
      setSummary({ totalDue: 0, pendingBills: 0 });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filterBills = () => {
    let filtered = [...bills];

    switch (activeFilter) {
      case 'pending':
        filtered = filtered.filter((b) => b.status === 'PENDING' || b.status === 'OVERDUE');
        break;
      case 'paid':
        filtered = filtered.filter((b) => b.status === 'PAID');
        break;
    }

    setFilteredBills(filtered);
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `AED ${numAmount.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      PAID: colors.success[600],
      PENDING: colors.warning[600],
      OVERDUE: colors.error[600],
      CANCELLED: colors.gray[500],
      PARTIALLY_PAID: colors.primary[600],
    };
    return colorMap[status] || colors.gray[500];
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'paid', label: 'Paid' },
  ];

  const renderSummaryCard = () => {
    const displaySummary = summary || { totalDue: 0, pendingBills: 0 };

    return (
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Due</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(displaySummary.totalDue)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pending Bills</Text>
            <Text style={styles.summaryCount}>{displaySummary.pendingBills}</Text>
          </View>
        </View>
        {displaySummary.totalDue > 0 && (
          <TouchableOpacity style={styles.payAllButton}>
            <Ionicons name="card" size={20} color={colors.white} />
            <Text style={styles.payAllText}>Pay All Pending</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderBillItem = ({ item }: { item: Bill }) => {
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={styles.billCard}
        onPress={() => navigation.navigate('BillDetail', { billId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.billHeader}>
          <View style={styles.billIcon}>
            <Ionicons
              name={item.type === 'CONSULTATION' ? 'chatbubbles' : 'document-text'}
              size={24}
              color={colors.primary[600]}
            />
          </View>
          <View style={styles.billInfo}>
            <Text style={styles.billTitle}>{item.description || `Bill #${item.billNumber || item.invoiceNumber}`}</Text>
            <Text style={styles.billDate}>{formatDate(item.billDate || item.createdAt)}</Text>
          </View>
          <View style={styles.billAmountContainer}>
            <Text style={styles.billAmount}>{formatCurrency(item.totalAmount || item.amount)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.chevronIndicator}>
          <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name={error ? "alert-circle-outline" : "receipt-outline"}
        size={64}
        color={error ? colors.warning[400] : colors.gray[300]}
      />
      <Text style={styles.emptyTitle}>{error ? 'Unable to Load' : 'No Bills'}</Text>
      <Text style={styles.emptyText}>
        {error
          ? 'Could not load billing data. Pull down to retry.'
          : activeFilter === 'pending'
          ? 'No pending bills found'
          : activeFilter === 'paid'
          ? 'No paid bills found'
          : 'Your billing history will appear here'}
      </Text>
      {error && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setIsLoading(true);
            loadData();
          }}
        >
          <Ionicons name="refresh" size={18} color={colors.primary[600]} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredBills}
        keyExtractor={(item) => item.id}
        renderItem={renderBillItem}
        ListHeaderComponent={
          <>
            {renderSummaryCard()}
            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterTab,
                    activeFilter === filter.key && styles.filterTabActive,
                  ]}
                  onPress={() => setActiveFilter(filter.key)}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      activeFilter === filter.key && styles.filterTabTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        contentContainerStyle={[
          styles.listContent,
          filteredBills.length === 0 && styles.emptyListContent,
        ]}
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
  listContent: {
    padding: spacing.lg,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  summaryCard: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.primary[400],
    marginHorizontal: spacing.lg,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[200],
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  summaryCount: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  payAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[700],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  payAllText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
  billCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  billHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  billIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  billDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  billAmountContainer: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  billDetails: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  itemsSection: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  lineItemName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
  },
  lineItemAmount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  totalLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  totalAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  paymentInfo: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  paymentLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  paymentValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  dueDateText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  payButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  downloadText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
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
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[600],
    gap: spacing.xs,
  },
  retryText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
});

export default BillingScreen;
