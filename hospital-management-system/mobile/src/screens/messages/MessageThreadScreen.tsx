import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi, Message, MessageThread } from '../../services/api';
import { MessagesStackParamList } from '../../types';

type RouteProps = RouteProp<MessagesStackParamList, 'MessageThread'>;

const MessageThreadScreen: React.FC = () => {
  const route = useRoute<RouteProps>();
  const { threadId } = route.params;
  const flatListRef = useRef<FlatList>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [replyText, setReplyText] = useState('');

  const loadThread = useCallback(async () => {
    try {
      const response = await patientPortalApi.getThread(threadId);
      setThread(response.data?.data || null);

      // Mark messages as read
      const unreadMessages = response.data?.data?.messages.filter((m) => !m.isRead && m.senderRole !== 'patient') || [];
      for (const msg of unreadMessages) {
        await patientPortalApi.markAsRead(msg.id);
      }
    } catch (error) {
      console.error('Error loading thread:', error);
      Alert.alert('Error', 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !thread) return;

    setIsSending(true);
    try {
      const recipient = thread.participants.find((p) => p.role !== 'patient');
      if (!recipient) {
        Alert.alert('Error', 'No recipient found');
        return;
      }

      await patientPortalApi.sendMessage({
        recipientId: recipient.id,
        subject: thread.subject,
        body: replyText.trim(),
        threadId: thread.id,
      });

      setReplyText('');
      loadThread();

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to send message';
      Alert.alert('Error', message);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isPatient = item.senderRole === 'patient';
    const showDate =
      index === 0 ||
      formatDate(thread!.messages[index - 1].createdAt) !== formatDate(item.createdAt);

    return (
      <View>
        {showDate && (
          <View style={styles.dateDivider}>
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
        )}
        <View style={[styles.messageRow, isPatient && styles.messageRowPatient]}>
          {!isPatient && (
            <View style={styles.senderAvatar}>
              <Text style={styles.senderInitial}>{item.senderName.charAt(0)}</Text>
            </View>
          )}
          <View style={[styles.messageBubble, isPatient ? styles.patientBubble : styles.providerBubble]}>
            {!isPatient && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            <Text style={[styles.messageBody, isPatient && styles.patientMessageBody]}>
              {item.body}
            </Text>
            <Text style={[styles.messageTime, isPatient && styles.patientMessageTime]}>
              {formatTime(item.createdAt)}
              {isPatient && item.isRead && (
                <Text style={styles.readIndicator}> · Read</Text>
              )}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Conversation not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header Info */}
        <View style={styles.threadHeader}>
          <Text style={styles.threadSubject}>{thread.subject}</Text>
          <Text style={styles.threadParticipants}>
            with {thread.participants.filter((p) => p.role !== 'patient').map((p) => p.name).join(', ')}
          </Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={thread.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {/* Reply Input */}
        <View style={styles.replyContainer}>
          <TextInput
            style={styles.replyInput}
            placeholder="Type your message..."
            placeholderTextColor={colors.gray[400]}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={1000}
            editable={!isSending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!replyText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSendReply}
            disabled={!replyText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="send" size={20} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  threadHeader: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  threadSubject: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  threadParticipants: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  messagesList: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  dateDivider: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dateText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    backgroundColor: colors.gray[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-end',
  },
  messageRowPatient: {
    justifyContent: 'flex-end',
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  senderInitial: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  providerBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    ...shadows.sm,
  },
  patientBubble: {
    backgroundColor: colors.primary[600],
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
    marginBottom: spacing.xs,
  },
  messageBody: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  patientMessageBody: {
    color: colors.white,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
  },
  patientMessageTime: {
    color: colors.primary[100],
  },
  readIndicator: {
    fontStyle: 'italic',
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  replyInput: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
});

export default MessageThreadScreen;
