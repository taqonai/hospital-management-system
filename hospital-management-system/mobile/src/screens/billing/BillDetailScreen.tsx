import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

var API_URL = 'https://spetaar.ai/api/v1';
var TOKEN_KEY = 'patientPortalToken';

interface BillItem {
  name?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
}

interface Payment {
  method?: string;
  date?: string;
  amount?: number;
}

interface Bill {
  id: string;
  billNumber?: string;
  billDate?: string;
  createdAt?: string;
  dueDate?: string;
  status?: string;
  type?: string;
  description?: string;
  totalAmount?: number;
  amount?: number;
  balanceAmount?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  insuranceCoverage?: number;
  items?: BillItem[];
  payments?: Payment[];
}

type BillDetailParams = {
  BillDetail: { billId: string };
};

function BillDetailScreen() {
  var navigation = useNavigation();
  var route = useRoute<RouteProp<BillDetailParams, 'BillDetail'>>();
  var billId = route.params?.billId;

  var [bill, setBill] = useState<Bill | null>(null);
  var [isLoading, setIsLoading] = useState(true);
  var [isRefreshing, setIsRefreshing] = useState(false);
  var [error, setError] = useState<string | null>(null);

  function loadBill() {
    setError(null);

    SecureStore.getItemAsync(TOKEN_KEY).then(function(token) {
      if (!token) {
        setError('Not logged in');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      var headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      };

      fetch(API_URL + '/patient-portal/billing/bills/' + billId, {
        method: 'GET',
        headers: headers
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.success && data.data) {
          setBill(data.data);
        } else {
          setError('Bill not found');
        }
        setIsLoading(false);
        setIsRefreshing(false);
      })
      .catch(function(err) {
        console.log('Bill error:', err);
        setError('Failed to load bill');
        setIsLoading(false);
        setIsRefreshing(false);
      });
    }).catch(function(err) {
      console.log('Token error:', err);
      setError('Failed to get token');
      setIsLoading(false);
      setIsRefreshing(false);
    });
  }

  useEffect(function() {
    if (billId) {
      loadBill();
    } else {
      setError('No bill ID provided');
      setIsLoading(false);
    }
  }, [billId]);

  function onRefresh() {
    setIsRefreshing(true);
    loadBill();
  }

  function formatAmount(amount: number | string | undefined): string {
    var num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return 'AED ' + (num || 0).toFixed(2);
  }

  function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function formatShortDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function getStatusColor(status: string | undefined): { bg: string; text: string } {
    if (!status) return { bg: '#F3F4F6', text: '#6B7280' };
    var s = status.toUpperCase();
    if (s === 'PAID') return { bg: '#D1FAE5', text: '#047857' };
    if (s === 'PENDING') return { bg: '#FEF3C7', text: '#D97706' };
    if (s === 'PARTIAL') return { bg: '#DBEAFE', text: '#2563EB' };
    if (s === 'OVERDUE') return { bg: '#FEE2E2', text: '#DC2626' };
    if (s === 'CANCELLED') return { bg: '#F3F4F6', text: '#6B7280' };
    return { bg: '#F3F4F6', text: '#6B7280' };
  }

  function handlePayNow() {
    Alert.alert(
      'Payment',
      'Payment gateway integration would go here. This would redirect to a secure payment page.',
      [{ text: 'OK' }]
    );
  }

  function handleDownloadInvoice() {
    Alert.alert('Download', 'Invoice PDF download would be triggered here.');
  }

  function handleShare() {
    if (!bill) return;
    Share.share({
      title: 'Bill #' + (bill.billNumber || bill.id),
      message: 'Bill #' + (bill.billNumber || bill.id) + '\nAmount Due: ' + formatAmount(bill.balanceAmount || bill.totalAmount || bill.amount) + '\nDue Date: ' + (bill.dueDate ? formatShortDate(bill.dueDate) : 'N/A'),
    }).catch(function(err) {
      console.log('Share error:', err);
    });
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (error || !bill) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>{error || 'Bill not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={function() { navigation.goBack(); }}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  var statusColor = getStatusColor(bill.status);
  var totalAmount = bill.totalAmount || bill.amount || 0;
  var amountPaid = totalAmount - (bill.balanceAmount || 0);
  var balanceDue = bill.balanceAmount != null ? bill.balanceAmount : totalAmount;
  var isOverdue = bill.dueDate && new Date(bill.dueDate) < new Date() && balanceDue > 0;
  var isPaid = (bill.status && bill.status.toUpperCase() === 'PAID') || balanceDue === 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.billNumber}>Bill #{bill.billNumber || (bill.id ? bill.id.slice(0, 8) : 'N/A')}</Text>
              <Text style={styles.billDate}>
                {formatDate(bill.billDate || bill.createdAt)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>
                {isOverdue ? 'OVERDUE' : (bill.status || 'PENDING').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.amountSection}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>{formatAmount(totalAmount)}</Text>
            </View>
            {amountPaid > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Amount Paid</Text>
                <Text style={styles.paidAmount}>-{formatAmount(amountPaid)}</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.amountRow}>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={[styles.balanceAmount, isPaid && styles.paidText]}>
                {formatAmount(balanceDue)}
              </Text>
            </View>
          </View>

          {isOverdue && (
            <View style={styles.overdueBanner}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.overdueText}>
                This bill is overdue. Please make payment as soon as possible.
              </Text>
            </View>
          )}
        </View>

        {/* Bill Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Details</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="document-text-outline" size={20} color="#2563EB" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Bill Type</Text>
                <Text style={styles.detailValue}>
                  {bill.type ? bill.type.replace('_', ' ') : 'Medical Services'}
                </Text>
              </View>
            </View>

            {bill.description && (
              <View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{bill.description}</Text>
                  </View>
                </View>
              </View>
            )}

            {bill.dueDate && (
              <View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="calendar-outline" size={20} color="#2563EB" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Due Date</Text>
                    <Text style={[styles.detailValue, isOverdue && { color: '#DC2626' }]}>
                      {formatDate(bill.dueDate)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Itemized Charges */}
        {bill.items && bill.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Itemized Charges</Text>

            <View style={styles.itemsCard}>
              {bill.items.map(function(item: BillItem, index: number) {
                const itemsLength = bill!.items?.length ?? 0;
                return (
                  <View
                    key={index}
                    style={[
                      styles.itemRow,
                      index < itemsLength - 1 && styles.itemRowBorder,
                    ]}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name || item.description}</Text>
                      {item.quantity && item.quantity > 1 && (
                        <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                      )}
                    </View>
                    <Text style={styles.itemAmount}>
                      {formatAmount(item.amount || (item.unitPrice || 0) * (item.quantity || 1))}
                    </Text>
                  </View>
                );
              })}

              <View style={styles.subtotalSection}>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Subtotal</Text>
                  <Text style={styles.subtotalValue}>{formatAmount(bill.subtotal || totalAmount)}</Text>
                </View>

                {bill.discount && bill.discount > 0 && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Discount</Text>
                    <Text style={[styles.subtotalValue, { color: '#10B981' }]}>
                      -{formatAmount(bill.discount)}
                    </Text>
                  </View>
                )}

                {bill.tax && bill.tax > 0 && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Tax</Text>
                    <Text style={styles.subtotalValue}>{formatAmount(bill.tax)}</Text>
                  </View>
                )}

                {bill.insuranceCoverage && bill.insuranceCoverage > 0 && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Insurance Coverage</Text>
                    <Text style={[styles.subtotalValue, { color: '#10B981' }]}>
                      -{formatAmount(bill.insuranceCoverage)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Payment History */}
        {bill.payments && bill.payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment History</Text>

            <View style={styles.paymentsCard}>
              {bill.payments.map(function(payment: Payment, index: number) {
                const paymentsLength = bill!.payments?.length ?? 0;
                return (
                  <View
                    key={index}
                    style={[
                      styles.paymentRow,
                      index < paymentsLength - 1 && styles.paymentRowBorder,
                    ]}
                  >
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentMethod}>
                        {payment.method || 'Payment'}
                      </Text>
                      <Text style={styles.paymentDate}>
                        {formatShortDate(payment.date)}
                      </Text>
                    </View>
                    <Text style={styles.paymentAmount}>
                      {formatAmount(payment.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={handleDownloadInvoice}>
              <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="download-outline" size={24} color="#2563EB" />
              </View>
              <Text style={styles.actionText}>Download Invoice</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <View style={[styles.actionIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="share-outline" size={24} color="#10B981" />
              </View>
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      {!isPaid && (
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.payButton} onPress={handlePayNow}>
            <Ionicons name="card-outline" size={20} color="#FFFFFF" />
            <Text style={styles.payButtonText}>Pay {formatAmount(balanceDue)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 24 },
  errorText: { fontSize: 18, color: '#6B7280', marginTop: 16, marginBottom: 24 },
  backButton: { backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  headerCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  billNumber: { fontSize: 18, fontWeight: '700', color: '#111827' },
  billDate: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100 },
  statusText: { fontSize: 12, fontWeight: '600' },
  amountSection: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  amountLabel: { fontSize: 14, color: '#6B7280' },
  totalAmount: { fontSize: 16, color: '#111827', fontWeight: '500' },
  paidAmount: { fontSize: 16, color: '#10B981', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  balanceLabel: { fontSize: 16, color: '#111827', fontWeight: '600' },
  balanceAmount: { fontSize: 20, color: '#DC2626', fontWeight: '700' },
  paidText: { color: '#10B981' },
  overdueBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 8, padding: 12, marginTop: 12, gap: 8 },
  overdueText: { flex: 1, fontSize: 14, color: '#DC2626' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start' },
  detailIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 14, color: '#6B7280', marginBottom: 2 },
  detailValue: { fontSize: 16, color: '#111827', fontWeight: '500' },
  itemsCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, color: '#111827' },
  itemQuantity: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  itemAmount: { fontSize: 16, color: '#111827', fontWeight: '500' },
  subtotalSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  subtotalLabel: { fontSize: 14, color: '#6B7280' },
  subtotalValue: { fontSize: 16, color: '#111827', fontWeight: '500' },
  paymentsCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  paymentRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  paymentInfo: { flex: 1 },
  paymentMethod: { fontSize: 16, color: '#111827' },
  paymentDate: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  paymentAmount: { fontSize: 16, color: '#10B981', fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionText: { fontSize: 14, color: '#111827', fontWeight: '500', textAlign: 'center' },
  bottomActions: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  payButton: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 8, gap: 8 },
  payButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default BillDetailScreen;
