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
import { format } from 'date-fns';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { LabResult, LabResultItem } from '../../types';

type RouteParams = {
  LabResultDetail: {
    resultId: string;
  };
};

const LabResultDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'LabResultDetail'>>();
  const { resultId } = route.params;

  const {
    data: labResult,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['labResult', resultId],
    queryFn: async () => {
      const response = await patientPortalApi.getLabResultById(resultId);
      return response.data.data as LabResult;
    },
  });

  const handleDownloadReport = async () => {
    if (labResult?.reportUrl) {
      try {
        await Linking.openURL(labResult.reportUrl);
      } catch (error) {
        Alert.alert('Error', 'Unable to open report');
      }
    } else {
      Alert.alert('Not Available', 'PDF report is not available for this result');
    }
  };

  const handleShare = async () => {
    if (!labResult) return;

    try {
      const resultSummary = labResult.results
        ?.map((r) => `${r.parameter || r.testName}: ${r.value} ${r.unit || ''}`)
        .join('\n');

      await Share.share({
        title: `Lab Results - ${labResult.testName}`,
        message: `Lab Results for ${labResult.testName}\nDate: ${format(new Date(labResult.resultDate || labResult.orderedDate || new Date()), 'MMM dd, yyyy')}\n\n${resultSummary || 'No detailed results available'}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return { bg: colors.warning[100], text: colors.warning[700] };
      case 'IN_PROGRESS':
        return { bg: colors.info[100], text: colors.info[700] };
      case 'COMPLETED':
        return { bg: colors.success[100], text: colors.success[700] };
      case 'CANCELLED':
        return { bg: colors.error[100], text: colors.error[700] };
      default:
        return { bg: colors.gray[100], text: colors.gray[700] };
    }
  };

  const getResultStatus = (item: LabResultItem): 'normal' | 'high' | 'low' | 'critical' => {
    if (item.isAbnormal || item.flag) {
      const flag = item.flag?.toUpperCase();
      if (flag === 'CRITICAL' || flag === 'CRITICAL HIGH' || flag === 'CRITICAL LOW') {
        return 'critical';
      }
      if (flag === 'HIGH' || flag === 'H') return 'high';
      if (flag === 'LOW' || flag === 'L') return 'low';
      return 'high'; // Default abnormal to high
    }

    // Check against reference range
    if (item.minRange !== undefined && item.maxRange !== undefined && item.value) {
      const numValue = parseFloat(item.value);
      if (!isNaN(numValue)) {
        if (numValue < item.minRange) return 'low';
        if (numValue > item.maxRange) return 'high';
      }
    }

    return 'normal';
  };

  const getResultColor = (status: 'normal' | 'high' | 'low' | 'critical') => {
    switch (status) {
      case 'critical':
        return { bg: colors.error[100], text: colors.error[700], icon: 'alert-circle' };
      case 'high':
        return { bg: colors.warning[100], text: colors.warning[700], icon: 'arrow-up' };
      case 'low':
        return { bg: colors.info[100], text: colors.info[700], icon: 'arrow-down' };
      default:
        return { bg: colors.success[100], text: colors.success[700], icon: 'checkmark' };
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!labResult) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error[500]} />
        <Text style={styles.errorText}>Lab result not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = getStatusColor(labResult.status);
  const hasAbnormalResults = labResult.hasAbnormalValues ||
    labResult.results?.some((r) => r.isAbnormal || r.flag);

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
            <View style={styles.testIcon}>
              <Ionicons name="flask" size={32} color={colors.primary[600]} />
            </View>
            <View style={styles.testInfo}>
              <Text style={styles.testName}>{labResult.testName}</Text>
              <Text style={styles.testCategory}>Laboratory Test</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusText, { color: statusColor.text }]}>
                {labResult.status}
              </Text>
            </View>
          </View>

          {hasAbnormalResults && (
            <View style={styles.abnormalBanner}>
              <Ionicons name="warning" size={18} color={colors.warning[700]} />
              <Text style={styles.abnormalText}>
                Some values are outside normal range
              </Text>
            </View>
          )}
        </View>

        {/* Test Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Information</Text>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Ordered Date</Text>
                <Text style={styles.detailValue}>
                  {labResult.orderedDate
                    ? format(new Date(labResult.orderedDate), 'MMMM dd, yyyy')
                    : 'Not available'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Result Date</Text>
                <Text style={styles.detailValue}>
                  {labResult.resultDate
                    ? format(new Date(labResult.resultDate), 'MMMM dd, yyyy')
                    : 'Pending'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="person-outline" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Ordered By</Text>
                <Text style={styles.detailValue}>
                  Dr. {labResult.doctorName ||
                    (labResult.orderedBy && typeof labResult.orderedBy === 'object'
                      ? `${labResult.orderedBy.firstName} ${labResult.orderedBy.lastName}`
                      : 'Unknown')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Results Table */}
        {labResult.results && labResult.results.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Results</Text>

            <View style={styles.resultsCard}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.parameterCol]}>Parameter</Text>
                <Text style={[styles.tableHeaderText, styles.valueCol]}>Value</Text>
                <Text style={[styles.tableHeaderText, styles.rangeCol]}>Range</Text>
                <Text style={[styles.tableHeaderText, styles.statusCol]}>Status</Text>
              </View>

              {/* Table Rows */}
              {labResult.results.map((result, index) => {
                const resultStatus = getResultStatus(result);
                const resultColor = getResultColor(resultStatus);

                return (
                  <View
                    key={index}
                    style={[
                      styles.tableRow,
                      index % 2 === 0 && styles.tableRowAlt,
                      resultStatus !== 'normal' && { backgroundColor: resultColor.bg },
                    ]}
                  >
                    <Text style={[styles.tableCell, styles.parameterCol]} numberOfLines={2}>
                      {result.parameter || result.testName}
                    </Text>
                    <Text style={[styles.tableCell, styles.valueCol, { fontWeight: '600' }]}>
                      {result.value} {result.unit}
                    </Text>
                    <Text style={[styles.tableCell, styles.rangeCol]}>
                      {result.referenceRange ||
                        (result.minRange !== undefined && result.maxRange !== undefined
                          ? `${result.minRange} - ${result.maxRange}`
                          : '-')}
                    </Text>
                    <View style={[styles.statusCol, styles.statusCell]}>
                      <Ionicons
                        name={resultColor.icon as any}
                        size={16}
                        color={resultColor.text}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success[500] }]} />
                <Text style={styles.legendText}>Normal</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.warning[500] }]} />
                <Text style={styles.legendText}>High</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.info[500] }]} />
                <Text style={styles.legendText}>Low</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.error[500] }]} />
                <Text style={styles.legendText}>Critical</Text>
              </View>
            </View>
          </View>
        )}

        {/* Notes */}
        {labResult.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Doctor's Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{labResult.notes}</Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={handleDownloadReport}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                <Ionicons name="download-outline" size={24} color={colors.primary[600]} />
              </View>
              <Text style={styles.actionText}>Download PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <View style={[styles.actionIcon, { backgroundColor: colors.success[50] }]}>
                <Ionicons name="share-outline" size={24} color={colors.success[600]} />
              </View>
              <Text style={styles.actionText}>Share Results</Text>
            </TouchableOpacity>
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
    alignItems: 'center',
  },
  testIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  testInfo: {
    flex: 1,
  },
  testName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  testCategory: {
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
  abnormalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  abnormalText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
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
  divider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginVertical: spacing.md,
  },
  resultsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
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
  parameterCol: {
    flex: 2,
  },
  valueCol: {
    flex: 1.5,
    textAlign: 'center',
  },
  rangeCol: {
    flex: 1.5,
    textAlign: 'center',
  },
  statusCol: {
    width: 40,
    alignItems: 'center',
  },
  statusCell: {
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  notesCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  notesText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
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
});

export default LabResultDetailScreen;
