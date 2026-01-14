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
import { useAppSelector } from '../../store';

interface Message {
  id: string;
  type: 'bot' | 'user' | 'options';
  content: string;
  options?: { id: string; text: string }[];
}

interface TriageResult {
  urgency: 'SELF_CARE' | 'SCHEDULE_APPOINTMENT' | 'URGENT_CARE' | 'EMERGENCY';
  recommendation: string;
  possibleConditions: { name: string; confidence?: number; likelihood?: string; severity?: string }[];
  recommendedDepartment?: string;  // Department name from AI (e.g., "Neurology", "General Medicine")
  urgencyScore?: number;  // Urgency score (1-10) for display
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
    options: ['No fever', 'Low-grade (37.2-37.8°C)', 'Moderate (37.8-39°C)', 'High (above 39°C)'],
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

  // Determine urgency level and recommended department
  let urgency: TriageResult['urgency'];
  let recommendation: string;
  let recommendedDepartment = 'General Medicine';  // Default department

  if (urgencyScore >= 6) {
    urgency = 'EMERGENCY';
    recommendedDepartment = 'Emergency';
    recommendation = 'Based on your symptoms, you should seek immediate emergency care. Please call 911 or go to the nearest emergency room.';
  } else if (urgencyScore >= 4) {
    urgency = 'URGENT_CARE';
    recommendedDepartment = 'General Medicine';
    recommendation = 'Your symptoms suggest you should see a doctor within 24 hours. Please visit an urgent care center or schedule a same-day appointment.';
  } else if (urgencyScore >= 2) {
    urgency = 'SCHEDULE_APPOINTMENT';
    recommendedDepartment = 'General Medicine';
    recommendation = 'Based on your symptoms, we recommend scheduling an appointment with a healthcare provider within the next few days.';
  } else {
    urgency = 'SELF_CARE';
    recommendedDepartment = 'General Medicine';
    recommendation = 'Your symptoms appear mild. Rest, stay hydrated, and monitor your condition. If symptoms worsen, consult a healthcare provider.';
  }

  // Calculate urgency score for display (scale 1-10)
  const displayUrgencyScore = Math.min(10, Math.max(1, (urgencyScore / 13) * 10 + 3));

  return {
    urgency,
    recommendation,
    possibleConditions: [],
    recommendedDepartment,  // Always include a department recommendation
    urgencyScore: displayUrgencyScore,
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
  const { user } = useAppSelector((state) => state.auth);
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
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);

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
      console.log('[SymptomChecker] Starting session with hospitalId:', user?.hospitalId);
      const response = await symptomCheckerApi.startSession({
        hospitalId: user?.hospitalId,
      });
      console.log('[SymptomChecker] Raw API response:', JSON.stringify(response.data, null, 2));

      const data = response.data?.data || response.data;
      console.log('[SymptomChecker] Extracted data:', JSON.stringify(data, null, 2));

      if (data && data.sessionId) {
        console.log('[SymptomChecker] Got sessionId:', data.sessionId);
        setSessionId(data.sessionId);

        // Backend returns nextQuestions (like web), support both field names
        const questions = data.nextQuestions || data.questions || [];
        const firstQuestion = questions[0];
        console.log('[SymptomChecker] First question:', JSON.stringify(firstQuestion, null, 2));

        // Store the current question ID for responses
        if (firstQuestion?.id) {
          setCurrentQuestionId(firstQuestion.id);
        }

        // Show welcome message from API or default
        const welcomeMessage = data.message || firstQuestion?.question || "Hello! I'm your AI health assistant. Please describe your main symptoms or concern.";
        addMessage({
          id: Date.now().toString(),
          type: 'bot',
          content: welcomeMessage,
        });

        if (firstQuestion?.options && firstQuestion.options.length > 0) {
          addMessage({
            id: (Date.now() + 1).toString(),
            type: 'options',
            content: '',
            options: firstQuestion.options.map((opt: any, idx: number) => ({
              id: `option_${idx}`,
              text: opt,
            })),
          });
        }
      } else {
        // Log why we're falling back
        console.warn('[SymptomChecker] No sessionId in response, falling back. Data:', JSON.stringify(data, null, 2));
        startFallbackMode(`No sessionId in API response. Keys: ${data ? Object.keys(data).join(', ') : 'null'}`);
      }
    } catch (error: any) {
      console.error('[SymptomChecker] Failed to start session:', error?.message || error);
      console.error('[SymptomChecker] Error response:', error?.response?.data);
      // Start in fallback mode instead of showing error
      startFallbackMode(`API error: ${error?.message || 'unknown'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startFallbackMode = (reason?: string) => {
    console.warn('[SymptomChecker] ENTERING FALLBACK MODE. Reason:', reason || 'unknown');
    setSessionId('fallback-' + Date.now());
    setFallbackQuestionIndex(0);
    setFallbackResponses([]);

    // Welcome message - include reason for debugging
    addMessage({
      id: Date.now().toString(),
      type: 'bot',
      content: `Hello! I'm your health assistant. ${reason ? `[Debug: ${reason}]` : ''} The AI service is currently limited, but I can still help assess your symptoms with a few questions. Please describe your main symptoms or concern first.`,
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
      // Use the stored currentQuestionId or fallback to provided questionId or 'main'
      const effectiveQuestionId = currentQuestionId || questionId || 'main';
      console.log('[SymptomChecker] Sending response:', { sessionId, questionId: effectiveQuestionId, answer: responseText });

      const apiResponse = await symptomCheckerApi.respond({
        sessionId: sessionId!,
        responses: [{
          questionId: effectiveQuestionId,
          answer: responseText,
        }],
      });
      console.log('[SymptomChecker] Raw respond API response:', JSON.stringify(apiResponse.data, null, 2));
      const data = apiResponse.data?.data || apiResponse.data;
      console.log('[SymptomChecker] Extracted respond data:', JSON.stringify(data, null, 2));

      if (data) {
        if (data.isComplete) {
          // Get final result
          console.log('[SymptomChecker] Assessment complete, fetching result with hospitalId:', user?.hospitalId);
          const completeResponse = await symptomCheckerApi.complete(sessionId!, user?.hospitalId);
          console.log('[SymptomChecker] Raw complete API response:', JSON.stringify(completeResponse.data, null, 2));
          const result = completeResponse.data?.data || completeResponse.data;
          console.log('[SymptomChecker] Extracted complete result:', JSON.stringify(result, null, 2));

          if (result) {
            // DEBUG: Show Alert with API response for debugging
            Alert.alert(
              'DEBUG: API Response',
              `urgencyScore: ${result.urgencyScore}\ntriageLevel: ${result.triageLevel}\nrecommendedDepartment: ${result.recommendedDepartment}\nKeys: ${Object.keys(result).join(', ')}`,
              [{ text: 'OK' }]
            );

            // Map the API result to our local TriageResult type
            // Backend returns recommendedDepartment, also support suggestedDepartment for compatibility
            // Map conditions with likelihood percentage (like web does)
            const mappedConditions = (result.possibleConditions || []).map((c: any) => ({
              name: c.name || c,
              confidence: c.confidence,
              likelihood: c.likelihood || (c.confidence ? `${Math.round((c.confidence) * 100)}%` : 'Possible'),
              severity: c.severity,
            }));

            // Map triageLevel to urgency format
            const urgencyMap: Record<string, TriageResult['urgency']> = {
              'EMERGENCY': 'EMERGENCY',
              'URGENT': 'URGENT_CARE',
              'URGENT_CARE': 'URGENT_CARE',
              'ROUTINE': 'SCHEDULE_APPOINTMENT',
              'SCHEDULE_APPOINTMENT': 'SCHEDULE_APPOINTMENT',
              'SELF_CARE': 'SELF_CARE',
            };

            const triageData: TriageResult = {
              urgency: urgencyMap[result.triageLevel] || result.urgency || 'SCHEDULE_APPOINTMENT',
              recommendation: result.recommendedAction || result.recommendation || result.recommendations?.[0] || 'Please consult a healthcare professional.',
              possibleConditions: mappedConditions,
              recommendedDepartment: result.recommendedDepartment || result.suggestedDepartment || 'General Medicine',
              urgencyScore: result.urgencyScore,
              nextSteps: result.nextSteps || result.whenToSeekHelp || [],
              recommendations: result.selfCareAdvice || result.recommendations || [],
            };
            console.log('[SymptomChecker] API result urgencyScore:', result.urgencyScore);
            console.log('[SymptomChecker] API result triageLevel:', result.triageLevel);
            console.log('[SymptomChecker] Mapped triage result:', JSON.stringify(triageData, null, 2));
            setTriageResult(triageData);
            setIsComplete(true);
            addMessage({
              id: Date.now().toString(),
              type: 'bot',
              content: 'Based on your symptoms, here is my assessment:',
            });
          }
        } else {
          // Continue conversation - get next question (backend returns nextQuestions, not questions)
          const questions = data.nextQuestions || data.questions || [];
          const nextQuestion = questions[0];

          // Show bot message if provided
          if (data.message) {
            addMessage({
              id: Date.now().toString(),
              type: 'bot',
              content: data.message,
            });
          }

          if (nextQuestion) {
            // Store the new question ID for the next response
            if (nextQuestion.id) {
              setCurrentQuestionId(nextQuestion.id);
              console.log('[SymptomChecker] Set currentQuestionId to:', nextQuestion.id);
            }

            // Show the question if not already in message
            if (!data.message && nextQuestion.question) {
              addMessage({
                id: Date.now().toString(),
                type: 'bot',
                content: nextQuestion.question,
              });
            }

            if (nextQuestion.options && nextQuestion.options.length > 0) {
              addMessage({
                id: (Date.now() + 1).toString(),
                type: 'options',
                content: '',
                options: nextQuestion.options.map((opt: any, idx: number) => ({
                  id: `option_${idx}`,
                  text: typeof opt === 'string' ? opt : opt.label || opt.value,
                })),
              });
            }
          } else {
            // No questions returned - this might mean the AI wants more info via free text
            // Don't switch to fallback, just wait for user to continue typing
            console.log('[SymptomChecker] AI returned no questions. Message:', data.message);
            console.log('[SymptomChecker] Progress:', data.progress, 'isComplete:', data.isComplete);

            // If there's a message, show it - the AI might want more info
            if (data.message) {
              addMessage({
                id: Date.now().toString(),
                type: 'bot',
                content: data.message,
              });
            } else {
              // If no message and no questions, prompt user to continue
              addMessage({
                id: Date.now().toString(),
                type: 'bot',
                content: "Please continue describing your symptoms or provide more details.",
              });
            }
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
    // Collect symptom summary from user messages
    const userMessages = messages
      .filter(m => m.type === 'user')
      .map(m => m.content)
      .join('; ');

    // Use fallback responses first entry if available (initial symptom description)
    const symptomsSummary = fallbackResponses[0] || userMessages || 'Symptoms described in symptom checker';

    // Pass department NAME (not ID) - booking screen will find matching department
    // Use recommendedDepartment from API response (e.g., "Neurology", "General Medicine")
    navigation.navigate('AppointmentsTab', {
      screen: 'BookAppointment',
      params: {
        fromSymptomChecker: true,
        departmentName: triageResult?.recommendedDepartment,  // Pass department NAME
        symptoms: symptomsSummary,
        urgency: triageResult?.urgency?.toLowerCase(),
      },
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
        {/* Urgency Badge with Score */}
        <View style={styles.urgencyRow}>
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
          {triageResult.urgencyScore && (
            <View style={styles.urgencyScoreContainer}>
              <Text style={styles.urgencyScoreValue}>{triageResult.urgencyScore.toFixed(1)}</Text>
              <Text style={styles.urgencyScoreMax}>/10</Text>
              <Text style={styles.urgencyScoreLabel}>Urgency</Text>
            </View>
          )}
        </View>

        {/* Recommended Department - Key section matching web */}
        {triageResult.recommendedDepartment && (
          <View style={styles.departmentSection}>
            <Text style={styles.departmentLabel}>Recommended Department</Text>
            <Text style={styles.departmentValue}>{triageResult.recommendedDepartment}</Text>
          </View>
        )}

        <View style={styles.resultSection}>
          <Text style={styles.resultLabel}>Recommendation</Text>
          <Text style={styles.resultText}>{triageResult.recommendation}</Text>
        </View>

        {triageResult.possibleConditions.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>Possible Conditions</Text>
            {triageResult.possibleConditions.slice(0, 5).map((condition, index) => (
              <View key={index} style={styles.conditionItemRow}>
                <View style={styles.conditionItem}>
                  <Ionicons name="ellipse" size={6} color={colors.gray[400]} />
                  <Text style={styles.conditionText}>{condition.name}</Text>
                </View>
                {condition.likelihood && (
                  <Text style={styles.conditionLikelihood}>{condition.likelihood}</Text>
                )}
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
          {/* Hide Book Appointment for SELF_CARE (like web) */}
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
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Symptom Checker</Text>
        <View style={styles.headerSpacer} />
      </View>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
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
  urgencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  urgencyBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  urgencyText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  urgencyScoreContainer: {
    alignItems: 'center',
    paddingLeft: spacing.md,
  },
  urgencyScoreValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[600],
  },
  urgencyScoreMax: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
    marginTop: -4,
  },
  urgencyScoreLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  departmentSection: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  departmentLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[800],
    marginBottom: spacing.xs,
  },
  departmentValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
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
  conditionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    backgroundColor: colors.gray[50],
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  conditionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  conditionLikelihood: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    fontWeight: typography.fontWeight.medium,
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
