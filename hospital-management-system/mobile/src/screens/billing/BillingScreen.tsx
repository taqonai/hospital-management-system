import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Bill } from '../../types';

const BillingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState({ totalDue: 0, pendingBills: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'paid'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [billsRes, summaryRes] = await Promise.all([
        patientPortalApi.getBills().catch(() => ({ data: { data: [] } })),
        patientPortalApi.getBillingSummary().catch(() => ({ data: { data: { totalDue: 0, pendingBills: 0 } } })),
      ]);

      setBills(billsRes?.data?.data || []);
      setSummary(summaryRes?.data?.data || { totalDue: 0, pendingBills: 0 });
    } catch (error) {
      console.log('Billing load error:', error);
      setBills([]);
      setSummary({ totalDue: 0, pendingBills: 0 });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const formatCurrency = (amount: number | string | undefined) => {
    const num = Number(amount) || 0;
    return `AED ${num.toFixed(2)}`;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return colors.success[600];
      case 'PENDING': return colors.warning[600];
      case 'OVERDUE': return colors.error[600];
      default: return colors.gray[500];
    }
  };

  const filteredBills = bills.filter((bill) => {
    if (activeFilter === 'pending') return bill.status === 'PENDING' || bill.status === 'OVERDUE';
    if (activeFilter === 'paid') return bill.status === 'PAID';
    return true;
  });

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading billing information...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[colors.primary[600]]}
        />
      }
    >
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Due</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(summary.totalDue)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pending Bills</Text>
            <Text style={styles.summaryCount}>{summary.pendingBills || 0}</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'paid'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterTab, activeFilter === filter && styles.filterTabActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bills List */}
      {filteredBills.length > 0 ? (
        filteredBills.map((bill) => (
          <TouchableOpacity
            key={bill.id}
            style={styles.billCard}
            onPress={() => navigation.navigate('BillDetail', { billId: bill.id })}
          >
            <View style={styles.billIcon}>
              <Ionicons name="document-text" size={24} color={colors.primary[600]} />
            </View>
            <View style={styles.billInfo}>
              <Text style={styles.billTitle} numberOfLines={1}>
                {bill.description || `Bill #${bill.billNumber || bill.invoiceNumber || bill.id.slice(0, 8)}`}
              </Text>
              <Text style={styles.billDate}>{formatDate(bill.billDate || bill.createdAt)}</Text>
            </View>
            <View style={styles.billRight}>
              <Text style={styles.billAmount}>{formatCurrency(bill.totalAmount || bill.amount)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bill.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(bill.status) }]}>
                  {bill.status}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={80} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Bills Found</Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'all'
              ? 'Your billing history will appear here'
              : `No ${activeFilter} bills found`}
          </Text>
        </View>
      )}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
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
    fontWeight: '700',
    color: colors.white,
  },
  summaryCount: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '700',
    color: colors.white,
  },
  filterRow: {
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
  filterText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.white,
  },
  billCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
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
    marginRight: spacing.sm,
  },
  billTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  billDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  billRight: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default BillingScreen;
