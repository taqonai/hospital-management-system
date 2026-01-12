import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { colors, spacing, borderRadius, typography, shadows, keyboardConfig } from '../../theme';
import { symptomCheckerApi } from '../../services/api';
import { SymptomCheckerResult, SymptomQuestion } from '../../types';

interface Message {
  id: string;
  type: 'bot' | 'user' | 'options';
  content: string;
  options?: { id: string; text: string }[];
}

interface TriageResult {
  urgency: 'SELF_CARE' | 'SCHEDULE_APPOINTMENT' | 'URGENT_CARE' | 'EMERGENCY';
  recommendation: string;
  possibleConditions: { name: string; probability: number; severity: string }[];
  suggestedDepartment?: string;
  nextSteps: string[];
  recommendations: string[];
}

// Fallback questions when AI service is unavailable
const FALLBACK_QUESTIONS = [
  {
    id: 'duration',
    question: 'How long have you been experiencing these symptoms?',
    options: ['Less than 24 hours', '1-3 days', '4-7 days', 'More than a week'],
  },
  {
    id: 'severity',
    question: 'On a scale of 1-10, how severe is your discomfort?',
    options: ['Mild (1-3)', 'Moderate (4-6)', 'Severe (7-8)', 'Very Severe (9-10)'],
  },
  {
    id: 'fever',
    question: 'Are you experiencing any fever?',
    options: ['No fever', 'Low-grade (99-100°F)', 'Moderate (100-102°F)', 'High (above 102°F)'],
  },
  {
    id: 'breathing',
    question: 'Are you having any difficulty breathing?',
    options: ['No difficulty', 'Mild shortness of breath', 'Moderate difficulty', 'Severe difficulty'],
  },
  {
    id: 'emergency_signs',
    question: 'Are you experiencing any of these warning signs?',
    options: ['None of these', 'Chest pain', 'Severe headache/confusion', 'Uncontrolled bleeding'],
  },
];

// Calculate triage based on fallback responses
const calculateFallbackTriage = (responses: string[]): TriageResult => {
  let urgencyScore = 0;

  // Analyze severity response (index 1)
  if (responses[1]?.includes('Very Severe') || responses[1]?.includes('9-10')) urgencyScore += 3;
  else if (responses[1]?.includes('Severe') || responses[1]?.includes('7-8')) urgencyScore += 2;
  else if (responses[1]?.includes('Moderate')) urgencyScore += 1;

  // Analyze fever response (index 2)
  if (responses[2]?.includes('High') || responses[2]?.includes('above 102')) urgencyScore += 2;
  else if (responses[2]?.includes('Moderate') || responses[2]?.includes('100-102')) urgencyScore += 1;

  // Analyze breathing response (index 3)
  if (responses[3]?.includes('Severe difficulty')) urgencyScore += 3;
  else if (responses[3]?.includes('Moderate difficulty')) urgencyScore += 2;
  else if (responses[3]?.includes('Mild')) urgencyScore += 1;

  // Analyze emergency signs (index 4) - highest weight
  if (responses[4] && !responses[4].includes('None')) urgencyScore += 4;

  // Determine urgency level
  let urgency: TriageResult['urgency'];
  let recommendation: string;

  if (urgencyScore >= 6) {
    urgency = 'EMERGENCY';
    recommendation = 'Based on your symptoms, you should seek immediate emergency care. Please call 911 or go to the nearest emergency room.';
  } else if (urgencyScore >= 4) {
    urgency = 'URGENT_CARE';
    recommendation = 'Your symptoms suggest you should see a doctor within 24 hours. Please visit an urgent care center or schedule a same-day appointment.';
  } else if (urgencyScore >= 2) {
    urgency = 'SCHEDULE_APPOINTMENT';
    recommendation = 'Based on your symptoms, we recommend scheduling an appointment with a healthcare provider within the next few days.';
  } else {
    urgency = 'SELF_CARE';
    recommendation = 'Your symptoms appear mild. Rest, stay hydrated, and monitor your condition. If symptoms worsen, consult a healthcare provider.';
  }

  return {
    urgency,
    recommendation,
    possibleConditions: [],
    nextSteps: urgency === 'EMERGENCY'
      ? ['Call 911 or go to emergency room immediately', 'Do not drive yourself if symptoms are severe']
      : ['Book an appointment with your doctor', 'Note down all your symptoms', 'Prepare a list of any medications you are taking'],
    recommendations: urgency === 'SELF_CARE'
      ? ['Rest and stay hydrated', 'Monitor your symptoms', 'Take over-the-counter medication if appropriate', 'Seek care if symptoms worsen']
      : ['Seek medical attention as recommended', 'Avoid strenuous activity', 'Keep a symptom diary'],
  };
};

const SymptomCheckerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [fallbackQuestionIndex, setFallbackQuestionIndex] = useState(0);
  const [fallbackResponses, setFallbackResponses] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Keyboard listeners for Android to scroll when keyboard appears
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
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

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
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

      // Reset audio mode
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
          'Could not transcribe your voice. Please try speaking more clearly or type your symptoms instead.'
        );
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      // Check if it's a 404/service unavailable error
      const status = error?.response?.status;
      if (status === 404 || status === 503) {
        Alert.alert(
          'Service Unavailable',
          'Voice transcription service is currently unavailable. Please type your symptoms instead.'
        );
      } else {
        Alert.alert(
          'Transcription Error',
          'Failed to transcribe audio. Please try again or type your symptoms.'
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

  const startSession = async () => {
    setIsLoading(true);
    try {
      const response = await symptomCheckerApi.startSession();
      const data = response.data?.data || response.data;

      if (data && data.sessionId) {
        setSessionId(data.sessionId);

        // Get first question from questions array
        const firstQuestion = data.questions?.[0];
        addMessage({
          id: Date.now().toString(),
          type: 'bot',
          content: firstQuestion?.question || "Hello! I'm your AI health assistant. Please describe your main symptoms or concern.",
        });

        if (firstQuestion?.options && firstQuestion.options.length > 0) {
          addMessage({
            id: (Date.now() + 1).toString(),
            type: 'options',
            content: '',
            options: firstQuestion.options.map((opt, idx) => ({
              id: `option_${idx}`,
              text: opt,
            })),
          });
        }
      } else {
        // Fallback to structured questions mode
        startFallbackMode();
      }
    } catch (error: any) {
      console.error('Failed to start session:', error);
      // Start in fallback mode instead of showing error
      startFallbackMode();
    } finally {
      setIsLoading(false);
    }
  };

  const startFallbackMode = () => {
    setSessionId('fallback-' + Date.now());
    setFallbackQuestionIndex(0);
    setFallbackResponses([]);

    // Welcome message
    addMessage({
      id: Date.now().toString(),
      type: 'bot',
      content: "Hello! I'm your health assistant. The AI service is currently limited, but I can still help assess your symptoms with a few questions. Please describe your main symptoms or concern first.",
    });

    // After user describes symptoms, we'll show the first structured question
    // The first question will be shown after they submit their initial description
  };

  const showNextFallbackQuestion = () => {
    const question = FALLBACK_QUESTIONS[fallbackQuestionIndex];
    if (question) {
      addMessage({
        id: Date.now().toString(),
        type: 'bot',
        content: question.question,
      });

      addMessage({
        id: (Date.now() + 1).toString(),
        type: 'options',
        content: '',
        options: question.options.map((opt, idx) => ({
          id: `fallback_${question.id}_${idx}`,
          text: opt,
        })),
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !sessionId || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');

    addMessage({
      id: Date.now().toString(),
      type: 'user',
      content: userMessage,
    });

    await processResponse(userMessage);
  };

  const handleOptionSelect = async (optionId: string, optionText: string) => {
    if (!sessionId || isLoading) return;

    addMessage({
      id: Date.now().toString(),
      type: 'user',
      content: optionText,
    });

    await processResponse(optionId);
  };

  const processResponse = async (responseText: string, questionId?: string) => {
    // Handle fallback mode with structured questions
    if (sessionId?.startsWith('fallback-')) {
      // Check if this is the initial symptom description (before structured questions)
      if (fallbackResponses.length === 0 && fallbackQuestionIndex === 0) {
        // Store initial symptom description and show first structured question
        setFallbackResponses([responseText]);

        addMessage({
          id: Date.now().toString(),
          type: 'bot',
          content: "Thank you for sharing. Let me ask you a few questions to better understand your condition.",
        });

        // Show first structured question
        setTimeout(() => {
          const firstQuestion = FALLBACK_QUESTIONS[0];
          addMessage({
            id: Date.now().toString(),
            type: 'bot',
            content: firstQuestion.question,
          });

          addMessage({
            id: (Date.now() + 1).toString(),
            type: 'options',
            content: '',
            options: firstQuestion.options.map((opt, idx) => ({
              id: `fallback_${firstQuestion.id}_${idx}`,
              text: opt,
            })),
          });
        }, 500);
        return;
      }

      // Store the response for structured questions
      const newResponses = [...fallbackResponses, responseText];
      setFallbackResponses(newResponses);

      // Check if we have more questions (subtract 1 because index 0 is initial symptoms)
      const nextQuestionIndex = fallbackQuestionIndex + 1;

      if (nextQuestionIndex < FALLBACK_QUESTIONS.length) {
        // Show next question
        const nextQuestion = FALLBACK_QUESTIONS[nextQuestionIndex];
        setFallbackQuestionIndex(nextQuestionIndex);

        addMessage({
          id: Date.now().toString(),
          type: 'bot',
          content: nextQuestion.question,
        });

        addMessage({
          id: (Date.now() + 1).toString(),
          type: 'options',
          content: '',
          options: nextQuestion.options.map((opt, idx) => ({
            id: `fallback_${nextQuestion.id}_${idx}`,
            text: opt,
          })),
        });
      } else {
        // All questions answered - calculate triage (skip first response which is symptoms)
        const result = calculateFallbackTriage(newResponses.slice(1));
        setTriageResult(result);
        setIsComplete(true);

        addMessage({
          id: Date.now().toString(),
          type: 'bot',
          content: 'Based on your responses, here is my assessment:',
        });
      }
      return;
    }

    setIsLoading(true);
    try {
      const apiResponse = await symptomCheckerApi.respond({
        sessionId: sessionId!,
        responses: [{
          questionId: questionId || 'main',
          answer: responseText,
        }],
      });
      const data = apiResponse.data?.data || apiResponse.data;

      if (data) {
        if (data.isComplete) {
          // Get final result
          const completeResponse = await symptomCheckerApi.complete(sessionId!);
          const result = completeResponse.data?.data || completeResponse.data;

          if (result) {
            // Map the API result to our local TriageResult type
            const triageData: TriageResult = {
              urgency: result.urgency || 'SCHEDULE_APPOINTMENT',
              recommendation: result.recommendation || result.recommendations?.[0] || 'Please consult a healthcare professional.',
              possibleConditions: result.possibleConditions || [],
              suggestedDepartment: result.suggestedDepartment,
              nextSteps: result.nextSteps || [],
              recommendations: result.recommendations || [],
            };
            setTriageResult(triageData);
            setIsComplete(true);
            addMessage({
              id: Date.now().toString(),
              type: 'bot',
              content: 'Based on your symptoms, here is my assessment:',
            });
          }
        } else {
          // Continue conversation - get first question
          const nextQuestion = data.questions?.[0];
          if (nextQuestion) {
            addMessage({
              id: Date.now().toString(),
              type: 'bot',
              content: nextQuestion.question,
            });

            if (nextQuestion.options && nextQuestion.options.length > 0) {
              addMessage({
                id: (Date.now() + 1).toString(),
                type: 'options',
                content: '',
                options: nextQuestion.options.map((opt, idx) => ({
                  id: `${nextQuestion.id}_${idx}`,
                  text: opt,
                })),
              });
            }
          } else {
            // No questions returned - switch to fallback mode with structured questions
            console.log('AI returned no questions, switching to fallback mode');
            setSessionId('fallback-' + Date.now());
            setFallbackQuestionIndex(0);
            setFallbackResponses([responseText]);

            addMessage({
              id: Date.now().toString(),
              type: 'bot',
              content: "Let me ask you a few questions to better understand your condition.",
            });

            // Show first structured question
            setTimeout(() => {
              const firstQuestion = FALLBACK_QUESTIONS[0];
              addMessage({
                id: Date.now().toString(),
                type: 'bot',
                content: firstQuestion.question,
              });

              addMessage({
                id: (Date.now() + 1).toString(),
                type: 'options',
                content: '',
                options: firstQuestion.options.map((opt, idx) => ({
                  id: `fallback_${firstQuestion.id}_${idx}`,
                  text: opt,
                })),
              });
            }, 300);
          }
        }
      }
    } catch (error) {
      console.error('Failed to process response:', error);
      addMessage({
        id: Date.now().toString(),
        type: 'bot',
        content: "I'm having trouble processing your response. Please try again, or book an appointment with a healthcare provider for assistance.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toUpperCase()) {
      case 'EMERGENCY':
        return colors.error[600];
      case 'URGENT_CARE':
        return colors.warning[600];
      case 'SCHEDULE_APPOINTMENT':
        return colors.primary[600];
      case 'SELF_CARE':
        return colors.success[600];
      default:
        return colors.gray[600];
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency.toUpperCase()) {
      case 'EMERGENCY':
        return 'Seek Emergency Care';
      case 'URGENT_CARE':
        return 'See a Doctor Soon';
      case 'SCHEDULE_APPOINTMENT':
        return 'Schedule an Appointment';
      case 'SELF_CARE':
        return 'Self-Care Recommended';
      default:
        return urgency.replace(/_/g, ' ');
    }
  };

  const handleBookAppointment = () => {
    navigation.navigate('AppointmentsTab', {
      screen: 'BookAppointment',
      params: triageResult?.suggestedDepartment
        ? { departmentId: triageResult.suggestedDepartment }
        : undefined,
    });
  };

  const handleRestart = () => {
    setSessionId(null);
    setMessages([]);
    setIsComplete(false);
    setTriageResult(null);
    setFallbackQuestionIndex(0);
    setFallbackResponses([]);
  };

  // Start session on mount
  React.useEffect(() => {
    startSession();
  }, []);

  const renderMessage = (message: Message) => {
    if (message.type === 'options') {
      return (
        <View key={message.id} style={styles.optionsContainer}>
          {message.options?.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionButton}
              onPress={() => handleOptionSelect(option.id, option.text)}
              disabled={isLoading}
            >
              <Text style={styles.optionText}>{option.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    return (
      <View
        key={message.id}
        style={[
          styles.messageBubble,
          message.type === 'user' ? styles.userBubble : styles.botBubble,
        ]}
      >
        {message.type === 'bot' && (
          <View style={styles.botAvatar}>
            <Ionicons name="medical" size={16} color={colors.primary[600]} />
          </View>
        )}
        <Text
          style={[
            styles.messageText,
            message.type === 'user' ? styles.userText : styles.botText,
          ]}
        >
          {message.content}
        </Text>
      </View>
    );
  };

  const renderTriageResult = () => {
    if (!triageResult) return null;

    return (
      <View style={styles.resultContainer}>
        <View style={[styles.urgencyBadge, { backgroundColor: `${getUrgencyColor(triageResult.urgency)}15` }]}>
          <Ionicons
            name={triageResult.urgency.toUpperCase() === 'EMERGENCY' ? 'warning' : 'information-circle'}
            size={24}
            color={getUrgencyColor(triageResult.urgency)}
          />
          <Text style={[styles.urgencyText, { color: getUrgencyColor(triageResult.urgency) }]}>
            {getUrgencyLabel(triageResult.urgency)}
          </Text>
        </View>

        <View style={styles.resultSection}>
          <Text style={styles.resultLabel}>Recommendation</Text>
          <Text style={styles.resultText}>{triageResult.recommendation}</Text>
        </View>

        {triageResult.possibleConditions.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>Possible Conditions</Text>
            {triageResult.possibleConditions.map((condition, index) => (
              <View key={index} style={styles.conditionItem}>
                <Ionicons name="ellipse" size={6} color={colors.gray[400]} />
                <Text style={styles.conditionText}>{condition.name}</Text>
              </View>
            ))}
          </View>
        )}

        {triageResult.nextSteps.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>Next Steps</Text>
            {triageResult.nextSteps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.resultActions}>
          {triageResult.urgency.toUpperCase() !== 'SELF_CARE' && (
            <TouchableOpacity style={styles.bookButton} onPress={handleBookAppointment}>
              <Ionicons name="calendar" size={20} color={colors.white} />
              <Text style={styles.bookButtonText}>Book Appointment</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.restartButton} onPress={handleRestart}>
            <Ionicons name="refresh" size={20} color={colors.primary[600]} />
            <Text style={styles.restartButtonText}>Start Over</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={colors.primary[600]} />
            <Text style={styles.infoText}>
              This is not a substitute for professional medical advice. Always consult a healthcare provider for accurate diagnosis.
            </Text>
          </View>

          {messages.map(renderMessage)}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary[600]} />
              <Text style={styles.loadingText}>Analyzing...</Text>
            </View>
          )}

          {isComplete && renderTriageResult()}
        </ScrollView>

        {!isComplete && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={isTranscribing ? 'Transcribing...' : 'Describe your symptoms...'}
              placeholderTextColor={colors.gray[400]}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isLoading && !isTranscribing}
            />
            <Animated.View style={{ transform: [{ scale: isRecording ? pulseAnim : 1 }] }}>
              <TouchableOpacity
                style={[
                  styles.micButton,
                  isRecording && styles.micButtonRecording,
                  (isLoading || isTranscribing) && styles.micButtonDisabled,
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
              style={[styles.sendButton, (!inputText.trim() || isLoading || isRecording) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || isLoading || isRecording}
            >
              <Ionicons name="send" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}
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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 18,
  },
  messageBubble: {
    maxWidth: '85%',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    flexShrink: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary[600],
    borderBottomRightRadius: 4,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 1,
    ...shadows.sm,
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    lineHeight: 22,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  userText: {
    color: colors.white,
  },
  botText: {
    color: colors.text.primary,
  },
  optionsContainer: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  optionButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  optionText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  resultContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.md,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  urgencyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  resultSection: {
    marginBottom: spacing.lg,
  },
  resultLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  resultText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  conditionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  stepText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  resultActions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bookButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  restartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary[600],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  restartButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
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
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonRecording: {
    backgroundColor: colors.error[600],
  },
  micButtonDisabled: {
    backgroundColor: colors.gray[300],
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

export default SymptomCheckerScreen;
