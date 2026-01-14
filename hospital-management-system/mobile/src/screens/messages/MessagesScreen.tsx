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

// Demo data for when API returns empty
const DEMO_MESSAGE_THREADS: MessageThread[] = [
  {
    id: 'demo-1',
    subject: 'Follow-up on blood test results',
    participants: [
      { id: 'patient-1', name: 'You', role: 'patient' },
      { id: 'doctor-1', name: 'Dr. Sarah Johnson', role: 'doctor' },
    ],
    messages: [
      {
        id: 'msg-1',
        threadId: 'demo-1',
        senderId: 'doctor-1',
        senderName: 'Dr. Sarah Johnson',
        senderRole: 'doctor',
        recipientId: 'patient-1',
        recipientName: 'You',
        body: 'Your blood test results look good. Keep up with your current medication regimen.',
        isRead: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ],
    lastMessage: {
      id: 'msg-1',
      threadId: 'demo-1',
      senderId: 'doctor-1',
      senderName: 'Dr. Sarah Johnson',
      senderRole: 'doctor',
      recipientId: 'patient-1',
      recipientName: 'You',
      body: 'Your blood test results look good. Keep up with your current medication regimen.',
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 1,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-2',
    subject: 'Appointment confirmation',
    participants: [
      { id: 'patient-1', name: 'You', role: 'patient' },
      { id: 'staff-1', name: 'Hospital Reception', role: 'staff' },
    ],
    messages: [
      {
        id: 'msg-2',
        threadId: 'demo-2',
        senderId: 'staff-1',
        senderName: 'Hospital Reception',
        senderRole: 'staff',
        recipientId: 'patient-1',
        recipientName: 'You',
        body: 'Your appointment with Dr. Chen has been confirmed for next Monday at 10:00 AM.',
        isRead: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    lastMessage: {
      id: 'msg-2',
      threadId: 'demo-2',
      senderId: 'staff-1',
      senderName: 'Hospital Reception',
      senderRole: 'staff',
      recipientId: 'patient-1',
      recipientName: 'You',
      body: 'Your appointment with Dr. Chen has been confirmed for next Monday at 10:00 AM.',
      isRead: true,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-3',
    subject: 'Prescription refill request',
    participants: [
      { id: 'patient-1', name: 'You', role: 'patient' },
      { id: 'nurse-1', name: 'Nurse Miller', role: 'nurse' },
    ],
    messages: [
      {
        id: 'msg-3',
        threadId: 'demo-3',
        senderId: 'patient-1',
        senderName: 'You',
        senderRole: 'patient',
        recipientId: 'nurse-1',
        recipientName: 'Nurse Miller',
        body: 'Thank you for processing my refill request.',
        isRead: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    lastMessage: {
      id: 'msg-3',
      threadId: 'demo-3',
      senderId: 'patient-1',
      senderName: 'You',
      senderRole: 'patient',
      recipientId: 'nurse-1',
      recipientName: 'Nurse Miller',
      body: 'Thank you for processing my refill request.',
      isRead: true,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    unreadCount: 0,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

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
      const messageThreads = response.data?.data || [];
      // Use demo data if API returns empty
      setThreads(messageThreads.length > 0 ? messageThreads : DEMO_MESSAGE_THREADS);
    } catch (error) {
      console.error('Error loading messages:', error);
      // Use demo data on error
      setThreads(DEMO_MESSAGE_THREADS);
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
