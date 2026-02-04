import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api/patientPortal';
import { InsuranceClaim } from '../../types';

type SettingsStackParamList = {
  Billing: undefined;
  BillDetail: { billId: string };
};

interface BillRecord {
  id?: string;
  billId?: string;
  billNumber?: string;
  invoiceNumber?: string;
  totalAmount?: number;
  amount?: number;
  status?: string;
  billDate?: string;
  createdAt?: string;
  date?: string;
  description?: string;
  serviceName?: string;
}

type TabKey = 'all' | 'pending' | 'paid' | 'claims';

function BillingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState(false);
  const [summary, setSummary] = useState({ totalDue: 0, pendingBills: 0 });
  const [error, setError] = useState<string | null>(null);

  const loadBills = useCallback(async () => {
    setError(null);
    try {
      // Load summary
      try {
        const summaryRes = await patientPortalApi.getBillingSummary();
        if (summaryRes.data?.data) {
          setSummary({
            totalDue: Number(summaryRes.data.data.totalDue || 0),
            pendingBills: Number(summaryRes.data.data.pendingBills || 0),
          });
        }
      } catch (err) {
        console.log('Summary error:', err);
      }

      // Load bills
      const type = activeTab === 'all' || activeTab === 'claims' ? 'all' as const : activeTab as 'pending';
      const billsRes = await patientPortalApi.getBills({ type });
      setBills(billsRes.data?.data || []);
    } catch (err) {
      console.log('Bills error:', err);
      setError('Failed to load bills');
      setBills([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  const loadClaims = useCallback(async () => {
    setClaimsLoading(true);
    setClaimsError(false);
    try {
      const res = await patientPortalApi.getInsuranceClaims();
      setClaims(res.data?.data || []);
    } catch (err) {
      console.log('Claims error:', err);
      setClaimsError(true);
      setClaims([]);
    } finally {
      setClaimsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    if (activeTab === 'claims') {
      loadClaims();
      setIsLoading(false);
    } else {
      loadBills();
    }
  }, [activeTab, loadBills, loadClaims]);

  const onRefresh = () => {
    setIsRefreshing(true);
    if (activeTab === 'claims') {
      loadClaims().then(() => setIsRefreshing(false));
    } else {
      loadBills();
    }
  };

  function formatMoney(val: number | string | null | undefined): string {
    if (val == null) return 'AED 0.00';
    const n = Number(val);
    if (isNaN(n)) return 'AED 0.00';
    return 'AED ' + n.toFixed(2);
  }

  function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function getStatusColor(status: string | undefined): string {
    if (!status) return colors.gray[500];
    const s = status.toLowerCase();
    if (s === 'paid' || s === 'approved') return colors.success[600];
    if (s === 'pending' || s === 'processing') return colors.warning[600];
    if (s === 'overdue' || s === 'denied') return colors.error[600];
    if (s === 'submitted') return colors.info[600];
    if (s === 'partial') return colors.warning[700];
    return colors.gray[500];
  }

  function goToDetail(billId: string) {
    navigation.navigate('BillDetail', { billId });
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'paid', label: 'Paid' },
    { key: 'claims', label: 'Claims' },
  ];

  if (isLoading && !isRefreshing && activeTab !== 'claims') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading billing...</Text>
      </View>
    );
  }

  const renderClaimsContent = () => {
    if (claimsLoading) {
      return (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.emptyText}>Loading claims...</Text>
        </View>
      );
    }

    if (claimsError) {
      return (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={60} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Claims Data</Text>
          <Text style={styles.emptyText}>Insurance claims information is not available yet.</Text>
        </View>
      );
    }

    if (claims.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="shield-outline" size={60} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Claims</Text>
          <Text style={styles.emptyText}>No insurance claims have been submitted.</Text>
        </View>
      );
    }

    return (
      <View style={styles.billsList}>
        {claims.map((claim) => (
          <View key={claim.id} style={styles.billCard}>
            <View style={styles.billHeader}>
              <View style={styles.billInfo}>
                <Text style={styles.billNumber}>{claim.claimNumber}</Text>
                <Text style={styles.billDate}>{formatDate(claim.submittedDate)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(claim.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(claim.status) }]}>
                  {(claim.status || '').toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.billDescription} numberOfLines={1}>
              {claim.insuranceProvider} - {claim.policyNumber}
            </Text>
            {claim.invoiceNumber && (
              <Text style={styles.claimInvoice}>Invoice: {claim.invoiceNumber}</Text>
            )}
            <View style={styles.claimAmounts}>
              <View style={styles.claimAmountCol}>
                <Text style={styles.claimAmountLabel}>Claimed</Text>
                <Text style={styles.billAmount}>{formatMoney(claim.claimedAmount)}</Text>
              </View>
              {claim.approvedAmount != null && (
                <View style={styles.claimAmountCol}>
                  <Text style={styles.claimAmountLabel}>Approved</Text>
                  <Text style={[styles.billAmount, { color: colors.success[600] }]}>
                    {formatMoney(claim.approvedAmount)}
                  </Text>
                </View>
              )}
            </View>
            {claim.notes && (
              <Text style={styles.claimNotes} numberOfLines={2}>{claim.notes}</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderBillsContent = () => {
    if (error) {
      return (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={60} color={colors.error[600]} />
          <Text style={styles.emptyTitle}>Error</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      );
    }

    if (bills.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={60} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Bills Found</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'pending' ? 'No pending bills' : activeTab === 'paid' ? 'No paid bills' : 'No billing history'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.billsList}>
        {bills.map((bill: BillRecord, index: number) => {
          const billId = bill.id || bill.billId || String(index);
          const billNumber = bill.billNumber || bill.invoiceNumber || 'Bill #' + (index + 1);
          const amount = bill.totalAmount || bill.amount || 0;
          const status = bill.status || 'pending';
          const date = bill.billDate || bill.createdAt || bill.date;
          const description = bill.description || bill.serviceName || 'Medical Services';

          return (
            <TouchableOpacity
              key={billId}
              style={styles.billCard}
              onPress={() => goToDetail(billId)}
            >
              <View style={styles.billHeader}>
                <View style={styles.billInfo}>
                  <Text style={styles.billNumber}>{billNumber}</Text>
                  <Text style={styles.billDate}>{formatDate(date)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                    {(status || '').toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.billDescription} numberOfLines={1}>{description}</Text>
              <View style={styles.billFooter}>
                <Text style={styles.billAmount}>{formatMoney(amount)}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Total Due</Text>
              <Text style={styles.summaryValue}>{formatMoney(summary.totalDue)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Pending</Text>
              <Text style={styles.summaryValue}>{summary.pendingBills || 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'claims' ? renderClaimsContent() : renderBillsContent()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: spacing.md, fontSize: typography.fontSize.base, color: colors.text.secondary },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  summaryCard: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.primary[400], marginHorizontal: spacing.md },
  summaryLabel: { fontSize: typography.fontSize.sm, color: colors.primary[100], marginBottom: spacing.xs },
  summaryValue: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.white },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.md },
  tabActive: { backgroundColor: colors.white, ...shadows.sm },
  tabText: { fontSize: typography.fontSize.sm, color: colors.text.secondary, fontWeight: typography.fontWeight.medium },
  tabTextActive: { color: colors.primary[600] },
  empty: { alignItems: 'center', paddingVertical: spacing['3xl'] },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.text.primary, marginTop: spacing.lg },
  emptyText: { fontSize: typography.fontSize.sm, color: colors.text.secondary, marginTop: spacing.sm, textAlign: 'center' },
  billsList: { gap: spacing.md },
  billCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  billInfo: { flex: 1 },
  billNumber: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.text.primary },
  billDate: { fontSize: typography.fontSize.sm, color: colors.text.secondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  statusText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold },
  billDescription: { fontSize: typography.fontSize.sm, color: colors.gray[600], marginBottom: spacing.md },
  billFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.gray[100], paddingTop: spacing.md },
  billAmount: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.text.primary },
  claimInvoice: { fontSize: typography.fontSize.xs, color: colors.text.secondary, marginBottom: spacing.sm },
  claimAmounts: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    paddingTop: spacing.md,
    gap: spacing.xl,
  },
  claimAmountCol: { flex: 1 },
  claimAmountLabel: { fontSize: typography.fontSize.xs, color: colors.text.secondary, marginBottom: 2 },
  claimNotes: { fontSize: typography.fontSize.xs, color: colors.text.secondary, marginTop: spacing.sm, fontStyle: 'italic' },
});

export default BillingScreen;
