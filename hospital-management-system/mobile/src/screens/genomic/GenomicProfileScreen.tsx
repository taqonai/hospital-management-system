import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import {
  genomicsApi,
  GenomicProfile,
  GenomicMarker,
  GenomicRiskScore,
  MarkerCategory,
} from '../../services/api';

const CATEGORY_INFO: Record<MarkerCategory, { icon: string; color: string; title: string }> = {
  METABOLISM: { icon: 'flame', color: '#FF6B6B', title: 'Metabolism' },
  NUTRITION: { icon: 'nutrition', color: '#4ECDC4', title: 'Nutrition' },
  INFLAMMATION: { icon: 'medical', color: '#FFE66D', title: 'Inflammation' },
  FITNESS: { icon: 'fitness', color: '#45B7D1', title: 'Fitness' },
  SLEEP: { icon: 'moon', color: '#6C5CE7', title: 'Sleep' },
  CARDIOVASCULAR: { icon: 'heart', color: '#FD79A8', title: 'Cardiovascular' },
  MENTAL_HEALTH: { icon: 'happy', color: '#A29BFE', title: 'Mental Health' },
  DETOXIFICATION: { icon: 'leaf', color: '#00B894', title: 'Detoxification' },
};

const RISK_LEVEL_INFO: Record<string, { color: string; label: string }> = {
  LOW: { color: colors.success[500], label: 'Low Risk' },
  BELOW_AVERAGE: { color: '#4ECDC4', label: 'Below Average' },
  AVERAGE: { color: colors.warning[500], label: 'Average' },
  ABOVE_AVERAGE: { color: '#FF9F43', label: 'Above Average' },
  HIGH: { color: colors.error[500], label: 'High Risk' },
};

export default function GenomicProfileScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<GenomicProfile | null>(null);
  const [markers, setMarkers] = useState<GenomicMarker[]>([]);
  const [riskScores, setRiskScores] = useState<GenomicRiskScore[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MarkerCategory | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [profileRes, markersRes, risksRes] = await Promise.all([
        genomicsApi.getProfile(),
        genomicsApi.getMarkers(),
        genomicsApi.getRiskScores(),
      ]);

      if (profileRes.data?.data) {
        setProfile(profileRes.data.data);
      }
      // Backend returns { markers: [...], grouped: {...}, ... } or just [...]
      const markersData = markersRes.data?.data as any;
      if (markersData?.markers) {
        setMarkers(markersData.markers);
      } else if (Array.isArray(markersData)) {
        setMarkers(markersData);
      }
      // Backend returns { riskScores: [...], totalConditions: ... } or just [...]
      const risksData = risksRes.data?.data as any;
      if (risksData?.riskScores) {
        setRiskScores(risksData.riskScores);
      } else if (Array.isArray(risksData)) {
        setRiskScores(risksData);
      }
    } catch (err: any) {
      console.error('Failed to fetch genomic data:', err);
      if (err.response?.status === 404) {
        setError('no_profile');
      } else {
        setError(err.message || 'Failed to load genomic data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const filteredMarkers =
    selectedCategory === 'ALL'
      ? markers
      : markers.filter((m) => m.category === selectedCategory);

  const handleDeleteProfile = () => {
    Alert.alert(
      'Delete Genomic Profile',
      'Are you sure you want to delete your genomic profile? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await genomicsApi.deleteProfile();
              setProfile(null);
              setMarkers([]);
              setRiskScores([]);
              setError('no_profile');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete profile. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleUpload = () => {
    navigation.navigate('GenomicUpload' as never);
  };

  const renderNoProfile = () => (
    <View style={styles.emptyState}>
      <Ionicons name="flask-outline" size={64} color={colors.text.disabled} />
      <Text style={styles.emptyTitle}>No Genomic Profile</Text>
      <Text style={styles.emptySubtitle}>
        Upload your genetic data to discover personalized health insights based on your DNA.
      </Text>
      <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
        <Ionicons name="cloud-upload" size={20} color={colors.white} />
        <Text style={styles.uploadButtonText}>Upload Genetic Data</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCategoryFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterContainer}
    >
      <TouchableOpacity
        style={[styles.filterChip, selectedCategory === 'ALL' && styles.filterChipActive]}
        onPress={() => setSelectedCategory('ALL')}
      >
        <Text
          style={[
            styles.filterChipText,
            selectedCategory === 'ALL' && styles.filterChipTextActive,
          ]}
        >
          All
        </Text>
      </TouchableOpacity>
      {Object.entries(CATEGORY_INFO).map(([key, info]) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.filterChip,
            selectedCategory === key && styles.filterChipActive,
          ]}
          onPress={() => setSelectedCategory(key as MarkerCategory)}
        >
          <Ionicons
            name={info.icon as any}
            size={16}
            color={selectedCategory === key ? colors.white : info.color}
            style={{ marginRight: spacing.xs }}
          />
          <Text
            style={[
              styles.filterChipText,
              selectedCategory === key && styles.filterChipTextActive,
            ]}
          >
            {info.title}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderRiskOverview = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Risk Overview</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {riskScores.map((risk: any, index) => {
          // Backend returns 'condition' field with category name
          const categoryKey = (risk.category || risk.condition) as MarkerCategory;
          const categoryInfo = CATEGORY_INFO[categoryKey] || { icon: 'help-circle', color: '#888', title: categoryKey };
          const riskInfo = RISK_LEVEL_INFO[risk.riskLevel] || { color: '#888', label: risk.riskLevel };
          const scoreValue = risk.score ?? risk.percentile ?? 0;
          return (
            <View key={index} style={styles.riskCard}>
              <View style={[styles.riskIconContainer, { backgroundColor: categoryInfo.color + '20' }]}>
                <Ionicons name={categoryInfo.icon as any} size={24} color={categoryInfo.color} />
              </View>
              <Text style={styles.riskCategory}>{categoryInfo.title}</Text>
              <View style={[styles.riskBadge, { backgroundColor: riskInfo.color + '20' }]}>
                <Text style={[styles.riskBadgeText, { color: riskInfo.color }]}>
                  {riskInfo.label}
                </Text>
              </View>
              <Text style={styles.riskScore}>{Math.round(scoreValue)}%</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderMarkerCard = (marker: GenomicMarker) => {
    const categoryInfo = CATEGORY_INFO[marker.category] || { icon: 'help-circle', color: '#888', title: marker.category || 'Unknown' };
    const recommendations = Array.isArray(marker.recommendations) ? marker.recommendations : [];
    return (
      <View key={marker.rsId} style={styles.markerCard}>
        <View style={styles.markerHeader}>
          <View style={[styles.markerIconContainer, { backgroundColor: categoryInfo.color + '20' }]}>
            <Ionicons name={categoryInfo.icon as any} size={20} color={categoryInfo.color} />
          </View>
          <View style={styles.markerInfo}>
            <Text style={styles.markerGene}>{marker.gene}</Text>
            <Text style={styles.markerRsId}>{marker.rsId}</Text>
          </View>
          <View style={styles.markerGenotype}>
            <Text style={styles.genotypeText}>{marker.genotype}</Text>
          </View>
        </View>
        <Text style={styles.markerPhenotype}>{marker.phenotype}</Text>
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              { width: `${marker.confidence * 100}%`, backgroundColor: categoryInfo.color },
            ]}
          />
        </View>
        <Text style={styles.confidenceText}>
          {Math.round(marker.confidence * 100)}% confidence
        </Text>
        {recommendations.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationsTitle}>Recommendations:</Text>
            {recommendations.slice(0, 3).map((rec, idx) => (
              <View key={idx} style={styles.recommendationItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading your genetic profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Genetic Profile</Text>
        {profile && (
          <TouchableOpacity onPress={handleDeleteProfile} style={styles.menuButton}>
            <Ionicons name="trash-outline" size={24} color={colors.error[500]} />
          </TouchableOpacity>
        )}
        {!profile && <View style={{ width: 40 }} />}
      </View>

      {error === 'no_profile' || !profile ? (
        renderNoProfile()
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Profile Info */}
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profileIcon}>
                <Ionicons name="flask" size={32} color={colors.primary[500]} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileTitle}>Genomic Profile</Text>
                <Text style={styles.profileSubtitle}>
                  Source: {profile.source?.replace('_', ' ')}
                </Text>
                <Text style={styles.profileDate}>
                  Uploaded: {new Date(profile.uploadedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{markers.length}</Text>
                <Text style={styles.statLabel}>Markers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{riskScores.length}</Text>
                <Text style={styles.statLabel}>Categories</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.success[500] }]}>
                  {profile.status}
                </Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>
            </View>
          </View>

          {/* Risk Overview */}
          {riskScores.length > 0 && renderRiskOverview()}

          {/* Category Filters */}
          {markers.length > 0 && renderCategoryFilters()}

          {/* Markers List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Genetic Markers ({filteredMarkers.length})
            </Text>
            {filteredMarkers.map(renderMarkerCard)}
          </View>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  menuButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
  },
  uploadButtonText: {
    fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold,
    color: colors.white,
    marginLeft: spacing.sm,
  },
  profileCard: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500] + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileTitle: {
    fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  profileSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: 2,
  },
  profileDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold,
    color: colors.primary[500],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  riskCard: {
    width: 140,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    alignItems: 'center',
    ...shadows.sm,
  },
  riskIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  riskCategory: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  riskBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  riskBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  riskScore: {
    fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  filterScroll: {
    marginTop: spacing.sm,
  },
  filterContainer: {
    paddingHorizontal: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  filterChipText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  markerCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  markerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  markerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  markerGene: {
    fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  markerRsId: {
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
  },
  markerGenotype: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary[500] + '15',
    borderRadius: borderRadius.sm,
  },
  genotypeText: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.primary[500],
  },
  markerPhenotype: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
    marginTop: 4,
  },
  recommendationsContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recommendationsTitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  recommendationText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    flex: 1,
    marginLeft: spacing.xs,
  },
});
