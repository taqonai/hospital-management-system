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
  recommendationsApi,
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
} from '../../services/api';

const CATEGORY_INFO: Record<RecommendationCategory, { icon: string; color: string; title: string }> = {
  NUTRITION: { icon: 'nutrition', color: '#4ECDC4', title: 'Nutrition' },
  SUPPLEMENT: { icon: 'medical', color: '#9B59B6', title: 'Supplement' },
  ACTIVITY: { icon: 'fitness', color: '#45B7D1', title: 'Activity' },
  SLEEP: { icon: 'moon', color: '#6C5CE7', title: 'Sleep' },
  LIFESTYLE: { icon: 'sunny', color: '#FFE66D', title: 'Lifestyle' },
  MEDICAL: { icon: 'medkit', color: '#E74C3C', title: 'Medical' },
  GENOMIC: { icon: 'flask', color: '#00B894', title: 'Genetic' },
  LAB_BASED: { icon: 'analytics', color: '#FD79A8', title: 'Lab-Based' },
  WEARABLE_BASED: { icon: 'watch', color: '#FF6B6B', title: 'Wearable' },
};

const PRIORITY_INFO: Record<RecommendationPriority, { color: string; label: string }> = {
  LOW: { color: colors.text.secondary, label: 'Low' },
  MEDIUM: { color: colors.status.warning, label: 'Medium' },
  HIGH: { color: '#FF9F43', label: 'High' },
  URGENT: { color: colors.status.error, label: 'Urgent' },
};

export default function RecommendationsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<RecommendationCategory | 'ALL'>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await recommendationsApi.getRecommendations({ status: 'ACTIVE' });
      if (response.data?.data?.recommendations) {
        setRecommendations(response.data.data.recommendations);
      }
    } catch (err: any) {
      console.error('Failed to fetch recommendations:', err);
      setError(err.message || 'Failed to load recommendations');
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

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDismiss = async (id: string) => {
    Alert.alert(
      'Dismiss Recommendation',
      'Are you sure you want to dismiss this recommendation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss',
          onPress: async () => {
            try {
              await recommendationsApi.dismissRecommendation(id);
              setRecommendations((prev) => prev.filter((r) => r.id !== id));
            } catch (err) {
              Alert.alert('Error', 'Failed to dismiss recommendation');
            }
          },
        },
      ]
    );
  };

  const handleComplete = async (id: string) => {
    try {
      await recommendationsApi.completeRecommendation(id);
      setRecommendations((prev) => prev.filter((r) => r.id !== id));
      Alert.alert('Great job!', 'Recommendation marked as completed!');
    } catch (err) {
      Alert.alert('Error', 'Failed to complete recommendation');
    }
  };

  const handleSnooze = async (id: string) => {
    Alert.alert('Snooze Recommendation', 'Snooze this recommendation for:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: '1 Day',
        onPress: async () => {
          try {
            await recommendationsApi.snoozeRecommendation(id, { duration: 'day' });
            setRecommendations((prev) => prev.filter((r) => r.id !== id));
          } catch (err) {
            Alert.alert('Error', 'Failed to snooze recommendation');
          }
        },
      },
      {
        text: '1 Week',
        onPress: async () => {
          try {
            await recommendationsApi.snoozeRecommendation(id, { duration: 'week' });
            setRecommendations((prev) => prev.filter((r) => r.id !== id));
          } catch (err) {
            Alert.alert('Error', 'Failed to snooze recommendation');
          }
        },
      },
    ]);
  };

  const filteredRecommendations =
    selectedCategory === 'ALL'
      ? recommendations
      : recommendations.filter((r) => r.category === selectedCategory);

  // Sort by priority
  const sortedRecommendations = [...filteredRecommendations].sort((a, b) => {
    const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const renderCategoryFilters = () => {
    const categories = recommendations.reduce((acc, r) => {
      acc.add(r.category);
      return acc;
    }, new Set<RecommendationCategory>());

    return (
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
            All ({recommendations.length})
          </Text>
        </TouchableOpacity>
        {Array.from(categories).map((category) => {
          const info = CATEGORY_INFO[category];
          const count = recommendations.filter((r) => r.category === category).length;
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                selectedCategory === category && styles.filterChipActive,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Ionicons
                name={info.icon as any}
                size={16}
                color={selectedCategory === category ? colors.white : info.color}
                style={{ marginRight: spacing.xs }}
              />
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === category && styles.filterChipTextActive,
                ]}
              >
                {info.title} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderRecommendationCard = (recommendation: Recommendation) => {
    const categoryInfo = CATEGORY_INFO[recommendation.category];
    const priorityInfo = PRIORITY_INFO[recommendation.priority];
    const isExpanded = expandedIds.has(recommendation.id);

    return (
      <View key={recommendation.id} style={styles.recommendationCard}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleExpand(recommendation.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.categoryIcon, { backgroundColor: categoryInfo.color + '20' }]}>
            <Ionicons name={categoryInfo.icon as any} size={24} color={categoryInfo.color} />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={isExpanded ? undefined : 1}>
                {recommendation.title}
              </Text>
              <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.color + '20' }]}>
                <Text style={[styles.priorityText, { color: priorityInfo.color }]}>
                  {priorityInfo.label}
                </Text>
              </View>
            </View>
            <Text style={styles.cardCategory}>{categoryInfo.title}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.text.secondary}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardExpanded}>
            <Text style={styles.cardDescription}>{recommendation.description}</Text>

            {recommendation.reasoning.length > 0 && (
              <View style={styles.reasoningSection}>
                <Text style={styles.sectionLabel}>Why this recommendation:</Text>
                {recommendation.reasoning.map((reason, idx) => (
                  <View key={idx} style={styles.reasonItem}>
                    <Ionicons name="information-circle" size={16} color={colors.primary} />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            )}

            {recommendation.actionItems.length > 0 && (
              <View style={styles.actionsSection}>
                <Text style={styles.sectionLabel}>Action Items:</Text>
                {recommendation.actionItems.map((action, idx) => (
                  <View key={idx} style={styles.actionItem}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.status.success} />
                    <Text style={styles.actionText}>{action}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleComplete(recommendation.id)}
              >
                <Ionicons name="checkmark" size={18} color={colors.status.success} />
                <Text style={[styles.actionButtonText, { color: colors.status.success }]}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleSnooze(recommendation.id)}
              >
                <Ionicons name="time" size={18} color={colors.text.secondary} />
                <Text style={styles.actionButtonText}>Snooze</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDismiss(recommendation.id)}
              >
                <Ionicons name="close" size={18} color={colors.status.error} />
                <Text style={[styles.actionButtonText, { color: colors.status.error }]}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="checkmark-circle" size={64} color={colors.status.success} />
      <Text style={styles.emptyTitle}>All Caught Up!</Text>
      <Text style={styles.emptySubtitle}>
        You don't have any active recommendations. Keep up the great work!
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading recommendations...</Text>
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
        <Text style={styles.headerTitle}>Recommendations</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('HealthScore' as never)}
          style={styles.scoreButton}
        >
          <Ionicons name="speedometer" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {recommendations.length > 0 && renderCategoryFilters()}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={
          sortedRecommendations.length === 0 ? styles.emptyContainer : undefined
        }
      >
        {sortedRecommendations.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.listContainer}>
            {sortedRecommendations.map(renderRecommendationCard)}
          </View>
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing.xs,
  },
  scoreButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
  },
  filterScroll: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  filterContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.secondary,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  listContainer: {
    padding: spacing.md,
  },
  recommendationCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  priorityText: {
    ...typography.caption,
    fontWeight: '600',
  },
  cardCategory: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  cardExpanded: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
  },
  cardDescription: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  reasoningSection: {
    marginTop: spacing.md,
  },
  actionsSection: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  reasonText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
    marginLeft: spacing.xs,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  actionText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
    marginLeft: spacing.xs,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
  },
  actionButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
