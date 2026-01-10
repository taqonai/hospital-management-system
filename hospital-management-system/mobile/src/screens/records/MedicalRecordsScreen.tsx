import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { MedicalRecord } from '../../types';

type FilterType = 'all' | 'consultation' | 'lab' | 'imaging' | 'procedure';

const MedicalRecordsScreen: React.FC = () => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    filterRecords();
  }, [records, activeFilter, searchQuery]);

  const loadRecords = async () => {
    try {
      const response = await patientPortalApi.getMedicalRecords();
      setRecords(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load medical records:', error);
      Alert.alert('Error', 'Failed to load medical records');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filterRecords = () => {
    let filtered = [...records];

    if (activeFilter !== 'all') {
      filtered = filtered.filter((record) =>
        record.type?.toLowerCase().includes(activeFilter)
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (record) =>
          record.type?.toLowerCase().includes(query) ||
          record.diagnosis?.toLowerCase().includes(query) ||
          record.doctorName?.toLowerCase().includes(query) ||
          record.departmentName?.toLowerCase().includes(query)
      );
    }

    setFilteredRecords(filtered);
  };

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadRecords();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRecordIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    const typeMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      consultation: 'chatbubbles-outline',
      lab: 'flask-outline',
      imaging: 'scan-outline',
      procedure: 'cut-outline',
      prescription: 'document-text-outline',
      vaccination: 'shield-checkmark-outline',
    };
    return typeMap[type?.toLowerCase()] || 'document-outline';
  };

  const getRecordColor = (type: string) => {
    const colorMap: Record<string, string> = {
      consultation: colors.primary[600],
      lab: colors.success[600],
      imaging: colors.warning[600],
      procedure: colors.error[600],
      prescription: colors.primary[500],
      vaccination: colors.success[500],
    };
    return colorMap[type?.toLowerCase()] || colors.gray[600];
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'consultation', label: 'Visits' },
    { key: 'lab', label: 'Lab' },
    { key: 'imaging', label: 'Imaging' },
    { key: 'procedure', label: 'Procedures' },
  ];

  const toggleExpand = (recordId: string) => {
    setExpandedRecordId(expandedRecordId === recordId ? null : recordId);
  };

  const renderRecordItem = ({ item }: { item: MedicalRecord }) => {
    const isExpanded = expandedRecordId === item.id;
    const recordColor = getRecordColor(item.type || '');

    return (
      <TouchableOpacity
        style={styles.recordCard}
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.recordHeader}>
          <View style={[styles.recordIcon, { backgroundColor: `${recordColor}15` }]}>
            <Ionicons
              name={getRecordIcon(item.type || '')}
              size={24}
              color={recordColor}
            />
          </View>
          <View style={styles.recordInfo}>
            <Text style={styles.recordType}>{item.type || 'Medical Record'}</Text>
            <Text style={styles.recordDate}>{formatDate(item.date || item.createdAt || '')}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.gray[400]}
          />
        </View>

        {item.diagnosis && (
          <View style={styles.diagnosisContainer}>
            <Text style={styles.diagnosisLabel}>Diagnosis:</Text>
            <Text style={styles.diagnosisText} numberOfLines={isExpanded ? undefined : 2}>
              {item.diagnosis}
            </Text>
          </View>
        )}

        {item.doctorName && (
          <View style={styles.doctorRow}>
            <Ionicons name="person-outline" size={14} color={colors.gray[400]} />
            <Text style={styles.doctorText}>Dr. {item.doctorName}</Text>
            {item.departmentName && (
              <>
                <Text style={styles.dotSeparator}>•</Text>
                <Text style={styles.departmentText}>{item.departmentName}</Text>
              </>
            )}
          </View>
        )}

        {isExpanded && (
          <View style={styles.expandedContent}>
            {item.notes && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.detailText}>{item.notes}</Text>
              </View>
            )}

            {item.treatment && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Treatment</Text>
                <Text style={styles.detailText}>{item.treatment}</Text>
              </View>
            )}

            {item.followUp && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Follow-up</Text>
                <Text style={styles.detailText}>{item.followUp}</Text>
              </View>
            )}

            {item.attachments && item.attachments.length > 0 && (
              <View style={styles.attachmentsSection}>
                <Text style={styles.detailLabel}>Attachments</Text>
                {item.attachments.map((attachment, index) => {
                  const attachmentName = typeof attachment === 'string'
                    ? attachment
                    : attachment.name || `Attachment ${index + 1}`;
                  return (
                    <TouchableOpacity key={index} style={styles.attachmentItem}>
                      <Ionicons name="document-attach" size={18} color={colors.primary[600]} />
                      <Text style={styles.attachmentText}>{attachmentName}</Text>
                      <Ionicons name="download-outline" size={18} color={colors.gray[400]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="folder-open-outline" size={64} color={colors.gray[300]} />
      <Text style={styles.emptyTitle}>No Records Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'Try adjusting your search or filters'
          : 'Your medical records will appear here'}
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
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.gray[400]} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search records..."
          placeholderTextColor={colors.gray[400]}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.gray[400]} />
          </TouchableOpacity>
        )}
      </View>

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

      {/* Records Count */}
      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Records List */}
      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        renderItem={renderRecordItem}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    margin: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  filterContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
  countContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  countText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  recordCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  recordInfo: {
    flex: 1,
  },
  recordType: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  recordDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  diagnosisContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  diagnosisLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  diagnosisText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  doctorText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  dotSeparator: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[300],
    marginHorizontal: spacing.sm,
  },
  departmentText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  expandedContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  detailSection: {
    marginBottom: spacing.md,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  attachmentsSection: {
    marginTop: spacing.sm,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  attachmentText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
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
});

export default MedicalRecordsScreen;
