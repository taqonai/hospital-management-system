import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi, MessageProvider } from '../../services/api';
import { MessagesStackParamList } from '../../types';

type RouteProps = RouteProp<MessagesStackParamList, 'NewMessage'>;

const NewMessageScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const preselectedRecipientId = route.params?.recipientId;

  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [providers, setProviders] = useState<MessageProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<MessageProvider | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showProviderPicker, setShowProviderPicker] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await patientPortalApi.getProviders();
      const providerList = response.data?.data || [];
      setProviders(providerList);

      // If we have a preselected recipient, select them
      if (preselectedRecipientId) {
        const preselected = providerList.find((p) => p.id === preselectedRecipientId);
        if (preselected) {
          setSelectedProvider(preselected);
        }
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  const handleSend = async () => {
    if (!selectedProvider) {
      Alert.alert('Error', 'Please select a recipient');
      return;
    }

    if (!subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setIsSending(true);
    try {
      await patientPortalApi.sendMessage({
        recipientId: selectedProvider.id,
        subject: subject.trim(),
        body: message.trim(),
      });

      Alert.alert(
        'Message Sent',
        `Your message has been sent to ${selectedProvider.name}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || 'Failed to send message. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Recipient Selection */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>To *</Text>
            <TouchableOpacity
              style={styles.recipientPicker}
              onPress={() => setShowProviderPicker(true)}
              disabled={isLoadingProviders}
            >
              {isLoadingProviders ? (
                <ActivityIndicator size="small" color={colors.gray[400]} />
              ) : selectedProvider ? (
                <View style={styles.selectedProvider}>
                  <View style={styles.providerAvatar}>
                    <Text style={styles.providerInitial}>
                      {selectedProvider.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{selectedProvider.name}</Text>
                    <Text style={styles.providerRole}>
                      {selectedProvider.role} {selectedProvider.department ? `- ${selectedProvider.department}` : ''}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.placeholderText}>Select a provider</Text>
              )}
              <Ionicons name="chevron-down" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          </View>

          {/* Subject */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Subject *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter subject"
              placeholderTextColor={colors.gray[400]}
              value={subject}
              onChangeText={setSubject}
              maxLength={200}
            />
          </View>

          {/* Message */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Message *</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              placeholder="Type your message here..."
              placeholderTextColor={colors.gray[400]}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>{message.length}/2000</Text>
          </View>

          {/* Info */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={colors.info[500]} />
            <Text style={styles.infoText}>
              Your message will be sent securely to your healthcare provider. Expect a response within 1-2 business days.
            </Text>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendButton, (!selectedProvider || !subject || !message || isSending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!selectedProvider || !subject || !message || isSending}
          >
            {isSending ? (
              <>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.sendButtonText}>Sending...</Text>
              </>
            ) : (
              <>
                <Ionicons name="send" size={20} color={colors.white} />
                <Text style={styles.sendButtonText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Provider Picker Modal */}
        {showProviderPicker && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Provider</Text>
                <TouchableOpacity onPress={() => setShowProviderPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.gray[500]} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.providerList}>
                {providers.length === 0 ? (
                  <Text style={styles.noProvidersText}>No providers available</Text>
                ) : (
                  providers.map((provider) => (
                    <TouchableOpacity
                      key={provider.id}
                      style={[
                        styles.providerOption,
                        selectedProvider?.id === provider.id && styles.providerOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedProvider(provider);
                        setShowProviderPicker(false);
                      }}
                    >
                      <View style={styles.providerAvatar}>
                        <Text style={styles.providerInitial}>
                          {provider.name.charAt(0)}
                        </Text>
                      </View>
                      <View style={styles.providerInfo}>
                        <Text style={styles.providerName}>{provider.name}</Text>
                        <Text style={styles.providerRole}>
                          {provider.role} {provider.department ? `- ${provider.department}` : ''}
                        </Text>
                      </View>
                      {provider.isAvailable ? (
                        <View style={styles.availableBadge}>
                          <Text style={styles.availableText}>Available</Text>
                        </View>
                      ) : (
                        <View style={styles.unavailableBadge}>
                          <Text style={styles.unavailableText}>Away</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
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
  content: {
    padding: spacing.lg,
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    ...shadows.sm,
  },
  messageInput: {
    minHeight: 150,
  },
  charCount: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  recipientPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  placeholderText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.gray[400],
  },
  selectedProvider: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInitial: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  providerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  providerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  providerRole: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.info[700],
    lineHeight: 18,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  sendButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  providerList: {
    padding: spacing.md,
    maxHeight: 400,
  },
  noProvidersText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    padding: spacing.xl,
  },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  providerOptionSelected: {
    backgroundColor: colors.primary[50],
  },
  availableBadge: {
    backgroundColor: colors.success[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  availableText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[700],
    fontWeight: typography.fontWeight.medium,
  },
  unavailableBadge: {
    backgroundColor: colors.gray[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  unavailableText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[600],
    fontWeight: typography.fontWeight.medium,
  },
});

export default NewMessageScreen;
