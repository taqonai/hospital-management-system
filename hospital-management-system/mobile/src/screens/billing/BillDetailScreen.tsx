import React from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, isPast, addDays } from 'date-fns';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Bill, BillItem } from '../../types';

type RouteParams = {
  BillDetail: {
    billId: string;
  };
};

const BillDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'BillDetail'>>();
  const { billId } = route.params;

  const {
    data: bill,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['bill', billId],
    queryFn: async () => {
      const response = await patientPortalApi.getBillById(billId);
      return response.data.data as Bill;
    },
  });

  const handlePayNow = () => {
    // In a real app, this would integrate with a payment gateway
    Alert.alert(
      'Payment',
      'Payment gateway integration would go here. This would redirect to a secure payment page.',
      [{ text: 'OK' }]
    );
  };

  const handleDownloadInvoice = async () => {
    // In a real app, this would download a PDF invoice
    Alert.alert('Download', 'Invoice PDF download would be triggered here.');
  };

  const handleShare = async () => {
    if (!bill) return;

    try {
      await Share.share({
        title: `Bill #${bill.billNumber || bill.id}`,
        message: `Bill #${bill.billNumber || bill.id}\nAmount Due: $${formatAmount(bill.balanceAmount || bill.totalAmount || bill.amount)}\nDue Date: ${bill.dueDate ? format(new Date(bill.dueDate), 'MMM dd, yyyy') : 'N/A'}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return { bg: colors.warning[100], text: colors.warning[700] };
      case 'PAID':
        return { bg: colors.success[100], text: colors.success[700] };
      case 'PARTIAL':
        return { bg: colors.info[100], text: colors.info[700] };
      case 'OVERDUE':
        return { bg: colors.error[100], text: colors.error[700] };
      case 'CANCELLED':
        return { bg: colors.gray[100], text: colors.gray[700] };
      default:
        return { bg: colors.gray[100], text: colors.gray[700] };
    }
  };

  const formatAmount = (amount: number | string | undefined): string => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return (num || 0).toFixed(2);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error[500]} />
        <Text style={styles.errorText}>Bill not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = getStatusColor(bill.status);
  const totalAmount = bill.totalAmount || bill.amount || 0;
  const amountPaid = (totalAmount) - (bill.balanceAmount || 0);
  const balanceDue = bill.balanceAmount ?? totalAmount;
  const isOverdue = bill.dueDate && isPast(new Date(bill.dueDate)) && balanceDue > 0;
  const isPaid = bill.status?.toUpperCase() === 'PAID' || balanceDue === 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.billNumber}>Bill #{bill.billNumber || bill.id?.slice(0, 8)}</Text>
              <Text style={styles.billDate}>
                {bill.billDate
                  ? format(new Date(bill.billDate), 'MMMM dd, yyyy')
                  : bill.createdAt
                  ? format(new Date(bill.createdAt), 'MMMM dd, yyyy')
                  : 'Unknown date'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>
                {isOverdue ? 'OVERDUE' : bill.status}
              </Text>
            </View>
          </View>

          <View style={styles.amountSection}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>${formatAmount(totalAmount)}</Text>
            </View>
            {amountPaid > 0 && (
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Amount Paid</Text>
                <Text style={styles.paidAmount}>-${formatAmount(amountPaid)}</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.amountRow}>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={[styles.balanceAmount, isPaid && styles.paidText]}>
                ${formatAmount(balanceDue)}
              </Text>
            </View>
          </View>

          {isOverdue && (
            <View style={styles.overdueBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.error[700]} />
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
                <Ionicons name="document-text-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Bill Type</Text>
                <Text style={styles.detailValue}>
                  {bill.type?.replace('_', ' ') || 'Medical Services'}
                </Text>
              </View>
            </View>

            {bill.description && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary[600]} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{bill.description}</Text>
                  </View>
                </View>
              </>
            )}

            {bill.dueDate && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Due Date</Text>
                    <Text style={[styles.detailValue, isOverdue && { color: colors.error[600] }]}>
                      {format(new Date(bill.dueDate), 'MMMM dd, yyyy')}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Itemized Charges */}
        {bill.items && bill.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Itemized Charges</Text>

            <View style={styles.itemsCard}>
              {bill.items.map((item: BillItem, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.itemRow,
                    index < bill.items!.length - 1 && styles.itemRowBorder,
                  ]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name || item.description}</Text>
                    {item.quantity && item.quantity > 1 && (
                      <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                    )}
                  </View>
                  <Text style={styles.itemAmount}>
                    ${formatAmount(item.amount || (item.unitPrice || 0) * (item.quantity || 1))}
                  </Text>
                </View>
              ))}

              <View style={styles.subtotalSection}>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Subtotal</Text>
                  <Text style={styles.subtotalValue}>${formatAmount(bill.subtotal || totalAmount)}</Text>
                </View>

                {bill.discount && bill.discount > 0 && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Discount</Text>
                    <Text style={[styles.subtotalValue, { color: colors.success[600] }]}>
                      -${formatAmount(bill.discount)}
                    </Text>
                  </View>
                )}

                {bill.tax && bill.tax > 0 && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Tax</Text>
                    <Text style={styles.subtotalValue}>${formatAmount(bill.tax)}</Text>
                  </View>
                )}

                {bill.insuranceCoverage && bill.insuranceCoverage > 0 && (
                  <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Insurance Coverage</Text>
                    <Text style={[styles.subtotalValue, { color: colors.success[600] }]}>
                      -${formatAmount(bill.insuranceCoverage)}
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
              {bill.payments.map((payment: any, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.paymentRow,
                    index < bill.payments!.length - 1 && styles.paymentRowBorder,
                  ]}
                >
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentMethod}>
                      {payment.method || 'Payment'}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {payment.date
                        ? format(new Date(payment.date), 'MMM dd, yyyy')
                        : 'Unknown date'}
                    </Text>
                  </View>
                  <Text style={styles.paymentAmount}>
                    ${formatAmount(payment.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={handleDownloadInvoice}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                <Ionicons name="download-outline" size={24} color={colors.primary[600]} />
              </View>
              <Text style={styles.actionText}>Download Invoice</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <View style={[styles.actionIcon, { backgroundColor: colors.success[50] }]}>
                <Ionicons name="share-outline" size={24} color={colors.success[600]} />
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
            <Ionicons name="card-outline" size={20} color={colors.white} />
            <Text style={styles.payButtonText}>Pay ${formatAmount(balanceDue)}</Text>
          </TouchableOpacity>
        </View>
      )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  backButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  billNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  billDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  amountSection: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  amountLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  totalAmount: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  paidAmount: {
    fontSize: typography.fontSize.base,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: spacing.sm,
  },
  balanceLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
  balanceAmount: {
    fontSize: typography.fontSize.xl,
    color: colors.error[600],
    fontWeight: typography.fontWeight.bold,
  },
  paidText: {
    color: colors.success[600],
  },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  overdueText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  itemsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  itemQuantity: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  itemAmount: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  subtotalSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  subtotalLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  subtotalValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  paymentsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  paymentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMethod: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  paymentDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: typography.fontSize.base,
    color: colors.success[600],
    fontWeight: typography.fontWeight.semibold,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    textAlign: 'center',
  },
  bottomActions: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payButton: {
    backgroundColor: colors.primary[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  payButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default BillDetailScreen;
