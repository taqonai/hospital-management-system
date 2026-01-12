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
import { wellnessApi, symptomCheckerApi, HealthCoachMessage } from '../../services/api';

interface Message extends HealthCoachMessage {
  id: string;
  timestamp: Date;
}

const QUICK_TOPICS = [
  'How can I improve my sleep?',
  'What exercises are good for stress?',
  'Tips for eating healthier',
  'How to stay motivated',
];

const HealthCoachScreen: React.FC = () => {
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    // Initial greeting
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your AI Health Coach. I can help you with fitness tips, nutrition advice, stress management, sleep improvement, and more. What would you like to work on today?",
        timestamp: new Date(),
      },
    ]);
  }, []);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Voice recording functions
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
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
      return false;
    }
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Microphone access is needed for voice input.');
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      startPulseAnimation();
    } catch (error) {
      Alert.alert('Error', 'Failed to start voice recording.');
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

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (uri) {
        setIsTranscribing(true);
        try {
          const response = await symptomCheckerApi.transcribeAudio(uri);
          const responseData = response.data as any;
          const data = responseData?.data || responseData;
          const text = data?.transcript || data?.text;
          if (text) {
            setInputText(text);
          } else {
            Alert.alert('Transcription Failed', 'Could not transcribe your voice.');
          }
        } catch {
          Alert.alert('Error', 'Voice transcription service unavailable.');
        } finally {
          setIsTranscribing(false);
        }
      }
    } catch (error) {
      setIsRecording(false);
      stopPulseAnimation();
      Alert.alert('Error', 'Failed to process voice recording.');
    }
  };

  const handleMicPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
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
      const response = await wellnessApi.chatWithHealthCoach(messageText, {
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const responseData = response.data as any;
      const data = responseData?.data || responseData;
      if (data?.response) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        };
        addMessage(assistantMessage);
      } else {
        throw new Error('Invalid response');
      }
    } catch (error: any) {
      const errorMsg = error?.response?.status === 404 || error?.response?.status === 503
        ? "Health Coach service is temporarily unavailable. Please try again later."
        : "I couldn't process your request. Please try again.";
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

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
          {/* Quick Topics */}
          {messages.length <= 1 && (
            <View style={styles.quickTopics}>
              <Text style={styles.quickTopicsLabel}>Quick Topics</Text>
              <View style={styles.quickTopicsGrid}>
                {QUICK_TOPICS.map((topic, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickTopicButton}
                    onPress={() => handleSendMessage(topic)}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={colors.primary[600]} />
                    <Text style={styles.quickTopicText}>{topic}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {messages.map((message, index) => {
            const isUser = message.role === 'user';
            const showTime = index === 0 || messages[index - 1].role !== message.role;

            return (
              <View key={message.id} style={styles.messageWrapper}>
                {showTime && (
                  <Text style={[styles.timestamp, isUser && styles.timestampRight]}>
                    {formatTime(message.timestamp)}
                  </Text>
                )}
                <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                  {!isUser && (
                    <View style={styles.coachAvatar}>
                      <Ionicons name="fitness" size={16} color={colors.primary[600]} />
                    </View>
                  )}
                  <View style={styles.messageContent}>
                    <Text style={[styles.messageText, isUser && styles.userText]}>
                      {message.content}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {isLoading && (
            <View style={styles.loadingBubble}>
              <View style={styles.coachAvatar}>
                <Ionicons name="fitness" size={16} color={colors.primary[600]} />
              </View>
              <View style={styles.typingIndicator}>
                <View style={[styles.typingDot, { opacity: 0.4 }]} />
                <View style={[styles.typingDot, { opacity: 0.6 }]} />
                <View style={[styles.typingDot, { opacity: 0.8 }]} />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask your health coach..."
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
                <Ionicons name={isRecording ? 'stop' : 'mic'} size={20} color={colors.white} />
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
  },
  quickTopics: {
    marginBottom: spacing.lg,
  },
  quickTopicsLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  quickTopicsGrid: {
    gap: spacing.sm,
  },
  quickTopicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  quickTopicText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
  },
  messageWrapper: {
    marginBottom: spacing.md,
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
    ...shadows.sm,
  },
  coachAvatar: {
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
  },
  userText: {
    color: colors.white,
  },
  loadingBubble: {
    flexDirection: 'row',
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

export default HealthCoachScreen;
