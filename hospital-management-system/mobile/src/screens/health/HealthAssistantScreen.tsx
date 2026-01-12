import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi, symptomCheckerApi } from '../../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

const HealthAssistantScreen: React.FC = () => {
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Voice recording functions
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const requestMicrophonePermission = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Microphone access is needed to use voice input. Please enable it in your device settings.'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      startPulseAnimation();
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start voice recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;

      setIsRecording(false);
      stopPulseAnimation();

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      stopPulseAnimation();
      Alert.alert('Error', 'Failed to process voice recording. Please try again.');
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    setIsTranscribing(true);
    try {
      const response = await symptomCheckerApi.transcribeAudio(audioUri);
      const responseData = response.data as any;
      const data = responseData?.data || responseData;
      // Backend returns 'transcript' field, support both for compatibility
      const transcribedText = data?.transcript || data?.text;

      if (transcribedText) {
        setInputText(transcribedText);
      } else {
        Alert.alert(
          'Transcription Failed',
          'Could not transcribe your voice. Please try speaking more clearly or type your message instead.'
        );
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      const status = error?.response?.status;
      if (status === 404 || status === 503) {
        Alert.alert(
          'Service Unavailable',
          'Voice transcription service is currently unavailable. Please type your message instead.'
        );
      } else {
        Alert.alert(
          'Transcription Error',
          'Failed to transcribe audio. Please try again or type your message.'
        );
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    // Add initial greeting
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your AI health assistant. I can help you with health-related questions, explain medical terms, or guide you to the right resources. How can I assist you today?",
        timestamp: new Date(),
        suggestions: [
          'What are common cold symptoms?',
          'How can I improve my sleep?',
          'What should I eat for better health?',
        ],
      },
    ]);
  }, []);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading) return;

    setInputText('');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    addMessage(userMessage);

    setIsLoading(true);
    try {
      const response = await patientPortalApi.aiChat({
        message: messageText,
        history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const data = response.data?.data || response.data;
      if (data && data.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          suggestions: data.suggestions,
        };
        addMessage(assistantMessage);
      } else {
        throw new Error('Invalid response');
      }
    } catch (error: any) {
      console.error('Failed to get response:', error);
      const errorMessage = error?.response?.status === 404
        ? "The AI Health Assistant service is currently unavailable. Please try again later or contact support."
        : error?.response?.status === 503
        ? "The AI service is temporarily unavailable due to high demand. Please try again in a few minutes."
        : "I'm sorry, I couldn't process your request. Please check your connection and try again.";

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
        suggestions: ['Book an appointment', 'View medical records'],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user';
    const showTimestamp =
      index === 0 ||
      messages[index - 1].role !== message.role ||
      message.timestamp.getTime() - messages[index - 1].timestamp.getTime() > 60000;

    return (
      <View key={message.id} style={styles.messageWrapper}>
        {showTimestamp && (
          <Text style={[styles.timestamp, isUser && styles.timestampRight]}>
            {formatTime(message.timestamp)}
          </Text>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {!isUser && (
            <View style={styles.assistantAvatar}>
              <Ionicons name="medical" size={16} color={colors.primary[600]} />
            </View>
          )}
          <View style={styles.messageContent}>
            <Text style={[styles.messageText, isUser && styles.userText]}>
              {message.content}
            </Text>
          </View>
        </View>
        {message.suggestions && message.suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>Suggested questions:</Text>
            {message.suggestions.map((suggestion, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.suggestionButton}
                onPress={() => handleSuggestionPress(suggestion)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary[600]} />
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const quickActions = [
    { icon: 'fitness', label: 'Exercise Tips', query: 'What are some good exercises for beginners?' },
    { icon: 'nutrition', label: 'Diet Advice', query: 'What foods should I eat for a balanced diet?' },
    { icon: 'moon', label: 'Sleep Help', query: 'How can I improve my sleep quality?' },
    { icon: 'happy', label: 'Stress Relief', query: 'What are effective ways to manage stress?' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Disclaimer */}
          <View style={styles.disclaimerCard}>
            <Ionicons name="information-circle" size={18} color={colors.warning[600]} />
            <Text style={styles.disclaimerText}>
              I provide general health information only. Always consult a healthcare professional for medical advice.
            </Text>
          </View>

          {/* Quick Actions */}
          {messages.length <= 1 && (
            <View style={styles.quickActionsContainer}>
              <Text style={styles.quickActionsLabel}>Quick Topics</Text>
              <View style={styles.quickActionsGrid}>
                {quickActions.map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickActionButton}
                    onPress={() => handleSendMessage(action.query)}
                  >
                    <Ionicons name={action.icon as any} size={24} color={colors.primary[600]} />
                    <Text style={styles.quickActionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {messages.map((message, index) => renderMessage(message, index))}

          {isLoading && (
            <View style={styles.loadingBubble}>
              <View style={styles.assistantAvatar}>
                <Ionicons name="medical" size={16} color={colors.primary[600]} />
              </View>
              <View style={styles.typingIndicator}>
                <View style={[styles.typingDot, styles.typingDot1]} />
                <View style={[styles.typingDot, styles.typingDot2]} />
                <View style={[styles.typingDot, styles.typingDot3]} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask a health question..."
            placeholderTextColor={colors.gray[400]}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading && !isTranscribing}
            onSubmitEditing={() => handleSendMessage()}
          />
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[
                styles.micButton,
                isRecording && styles.micButtonRecording,
                isTranscribing && styles.micButtonDisabled,
              ]}
              onPress={handleMicPress}
              disabled={isLoading || isTranscribing}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons
                  name={isRecording ? 'stop' : 'mic'}
                  size={20}
                  color={colors.white}
                />
              )}
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={20} color={colors.white} />
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
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  disclaimerCard: {
    flexDirection: 'row',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  disclaimerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 18,
  },
  quickActionsContainer: {
    marginBottom: spacing.lg,
  },
  quickActionsLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  quickActionButton: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    margin: '1%',
    alignItems: 'center',
    ...shadows.sm,
  },
  quickActionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  messageWrapper: {
    marginBottom: spacing.md,
    flexShrink: 0,
  },
  timestamp: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginLeft: spacing.sm,
  },
  timestampRight: {
    textAlign: 'right',
    marginRight: spacing.sm,
    marginLeft: 0,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    flexShrink: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary[600],
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 1,
    ...shadows.sm,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  messageContent: {
    flexShrink: 1,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  userText: {
    color: colors.white,
  },
  suggestionsContainer: {
    marginTop: spacing.md,
    marginLeft: 36,
  },
  suggestionsLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary[100],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  suggestionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderBottomLeftRadius: 4,
    ...shadows.sm,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray[400],
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  input: {
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
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonRecording: {
    backgroundColor: colors.error[500],
  },
  micButtonDisabled: {
    backgroundColor: colors.gray[400],
  },
});

export default HealthAssistantScreen;
