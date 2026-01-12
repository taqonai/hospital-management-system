import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi, MessageThread } from '../../services/api';
import { MessagesStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<MessagesStackParamList>;

const MessagesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadMessages = useCallback(async () => {
    try {
      const response = await patientPortalApi.getMessages({
        status: filter === 'unread' ? 'unread' : 'all',
      });
      setThreads(response.data?.data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadMessages();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.subject.toLowerCase().includes(query) ||
      thread.participants.some((p) => p.name.toLowerCase().includes(query)) ||
      thread.lastMessage?.body.toLowerCase().includes(query)
    );
  });

  const renderThread = ({ item }: { item: MessageThread }) => {
    const otherParticipants = item.participants.filter((p) => p.role !== 'patient');
    const participantNames = otherParticipants.map((p) => p.name).join(', ');
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={[styles.threadCard, hasUnread && styles.threadCardUnread]}
        onPress={() => navigation.navigate('MessageThread', { threadId: item.id })}
      >
        <View style={styles.avatarContainer}>
          {otherParticipants.length > 0 ? (
            <View style={[styles.avatar, { backgroundColor: colors.primary[100] }]}>
              <Text style={styles.avatarText}>
                {otherParticipants[0].name.charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.gray[200] }]}>
              <Ionicons name="person" size={20} color={colors.gray[500]} />
            </View>
          )}
          {hasUnread && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.threadContent}>
          <View style={styles.threadHeader}>
            <Text style={[styles.participantName, hasUnread && styles.textBold]} numberOfLines={1}>
              {participantNames || 'Unknown'}
            </Text>
            <Text style={styles.threadDate}>{formatDate(item.updatedAt)}</Text>
          </View>
          <Text style={[styles.threadSubject, hasUnread && styles.textBold]} numberOfLines={1}>
            {item.subject}
          </Text>
          {item.lastMessage && (
            <Text style={styles.threadPreview} numberOfLines={1}>
              {item.lastMessage.senderRole === 'patient' ? 'You: ' : ''}
              {item.lastMessage.body}
            </Text>
          )}
        </View>

        {hasUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{item.unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color={colors.gray[400]} />
          <TextInput
            style={styles.searchText}
            placeholder="Search messages..."
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
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterTabText, filter === 'unread' && styles.filterTabTextActive]}>
            Unread
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      {filteredThreads.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mail-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No messages</Text>
          <Text style={styles.emptyText}>
            {filter === 'unread'
              ? "You're all caught up!"
              : 'Start a conversation with your healthcare provider'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredThreads}
          renderItem={renderThread}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* New Message FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewMessage', {})}
      >
        <Ionicons name="create" size={24} color={colors.white} />
      </TouchableOpacity>
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
  searchContainer: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  filterTab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
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
    paddingVertical: spacing.sm,
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  threadCardUnread: {
    backgroundColor: colors.primary[50],
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary[600],
    borderWidth: 2,
    borderColor: colors.white,
  },
  threadContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  participantName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  textBold: {
    fontWeight: typography.fontWeight.semibold,
  },
  threadDate: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  threadSubject: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  threadPreview: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  unreadBadge: {
    backgroundColor: colors.primary[600],
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  unreadCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});

export default MessagesScreen;
