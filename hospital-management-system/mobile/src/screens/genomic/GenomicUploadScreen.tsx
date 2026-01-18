import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { genomicsApi, GenomicSource, DataConsentType } from '../../services/api';

interface ConsentItem {
  type: DataConsentType;
  title: string;
  description: string;
  required: boolean;
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    type: 'GENOMIC_ANALYSIS',
    title: 'Genomic Data Analysis',
    description: 'I consent to having my genetic data analyzed to identify health-related markers and provide personalized insights.',
    required: true,
  },
  {
    type: 'AI_RECOMMENDATIONS',
    title: 'AI-Powered Recommendations',
    description: 'I consent to receiving AI-generated health recommendations based on my genetic markers.',
    required: true,
  },
  {
    type: 'CLINICIAN_ACCESS',
    title: 'Healthcare Provider Access',
    description: 'I consent to allowing my healthcare providers to view my genetic profile for better care coordination.',
    required: false,
  },
];

const FILE_SOURCES: { key: GenomicSource; name: string; description: string; icon: string }[] = [
  {
    key: 'TWENTYTHREE_AND_ME',
    name: '23andMe',
    description: 'Upload your 23andMe raw data file',
    icon: 'flask',
  },
  {
    key: 'ANCESTRY_DNA',
    name: 'AncestryDNA',
    description: 'Upload your AncestryDNA raw data file',
    icon: 'leaf',
  },
  {
    key: 'VCF',
    name: 'VCF File',
    description: 'Upload a Variant Call Format file',
    icon: 'document-text',
  },
];

export default function GenomicUploadScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<'consent' | 'upload' | 'processing' | 'complete'>('consent');
  const [consents, setConsents] = useState<Record<DataConsentType, boolean>>({
    HEALTH_DATA_COLLECTION: false,
    GENOMIC_ANALYSIS: false,
    AI_RECOMMENDATIONS: false,
    CLINICIAN_ACCESS: false,
    DATA_SHARING_RESEARCH: false,
  });
  const [selectedSource, setSelectedSource] = useState<GenomicSource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const toggleConsent = (type: DataConsentType) => {
    setConsents((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const canProceedFromConsent = useCallback(() => {
    return CONSENT_ITEMS.filter((item) => item.required).every((item) => consents[item.type]);
  }, [consents]);

  const handleConsentContinue = async () => {
    if (!canProceedFromConsent()) {
      Alert.alert('Required Consents', 'Please agree to all required consents to continue.');
      return;
    }

    // Save consents
    try {
      for (const item of CONSENT_ITEMS) {
        if (consents[item.type]) {
          await genomicsApi.updateConsent({ consentType: item.type, granted: true });
        }
      }
      setStep('upload');
    } catch (err) {
      console.error('Failed to save consents:', err);
      // Continue anyway for now
      setStep('upload');
    }
  };

  const handleFilePick = async (source: GenomicSource) => {
    setSelectedSource(source);
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/csv', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      // Validate file size (max 50MB)
      if (file.size && file.size > 50 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Please select a file smaller than 50MB.');
        return;
      }

      setStep('processing');
      setUploading(true);
      setUploadProgress(10);

      // Read file content
      const fileContent = await FileSystem.readAsStringAsync(file.uri);
      setUploadProgress(30);

      // Upload to API
      const response = await genomicsApi.uploadFile({
        fileContent,
        source,
        fileName: file.name,
        consentGranted: true,
      });

      setUploadProgress(100);

      if (response.data) {
        setTimeout(() => {
          setStep('complete');
          setUploading(false);
        }, 500);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file. Please try again.');
      setUploading(false);
      setStep('upload');
    }
  };

  const handleViewProfile = () => {
    navigation.navigate('GenomicProfile' as never);
  };

  const renderConsentStep = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerSection}>
        <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
        <Text style={styles.title}>Data Privacy & Consent</Text>
        <Text style={styles.subtitle}>
          Your genetic data is highly sensitive. Please review and agree to the following before uploading.
        </Text>
      </View>

      <View style={styles.consentList}>
        {CONSENT_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.type}
            style={[
              styles.consentItem,
              consents[item.type] && styles.consentItemSelected,
            ]}
            onPress={() => toggleConsent(item.type)}
            activeOpacity={0.7}
          >
            <View style={styles.consentCheckbox}>
              {consents[item.type] ? (
                <Ionicons name="checkbox" size={24} color={colors.primary} />
              ) : (
                <Ionicons name="square-outline" size={24} color={colors.text.secondary} />
              )}
            </View>
            <View style={styles.consentContent}>
              <View style={styles.consentHeader}>
                <Text style={styles.consentTitle}>{item.title}</Text>
                {item.required && (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredText}>Required</Text>
                  </View>
                )}
              </View>
              <Text style={styles.consentDescription}>{item.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Your data is encrypted and stored securely. You can delete your genomic data at any time from the settings.
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.continueButton,
          !canProceedFromConsent() && styles.continueButtonDisabled,
        ]}
        onPress={handleConsentContinue}
        disabled={!canProceedFromConsent()}
      >
        <Text style={styles.continueButtonText}>Continue to Upload</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.white} />
      </TouchableOpacity>
    </ScrollView>
  );

  const renderUploadStep = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerSection}>
        <Ionicons name="cloud-upload" size={48} color={colors.primary} />
        <Text style={styles.title}>Upload Genetic Data</Text>
        <Text style={styles.subtitle}>
          Select your data source and upload your raw genetic data file.
        </Text>
      </View>

      <View style={styles.sourceList}>
        {FILE_SOURCES.map((source) => (
          <TouchableOpacity
            key={source.key}
            style={styles.sourceItem}
            onPress={() => handleFilePick(source.key)}
            activeOpacity={0.7}
          >
            <View style={styles.sourceIcon}>
              <Ionicons name={source.icon as any} size={32} color={colors.primary} />
            </View>
            <View style={styles.sourceContent}>
              <Text style={styles.sourceName}>{source.name}</Text>
              <Text style={styles.sourceDescription}>{source.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={20} color={colors.error[500]} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.instructionsBox}>
        <Text style={styles.instructionsTitle}>How to get your raw data:</Text>
        <Text style={styles.instructionsText}>
          {'\u2022'} 23andMe: Go to Settings {'>'} Download Your Data {'>'} Request Download{'\n'}
          {'\u2022'} AncestryDNA: Go to Settings {'>'} Download DNA Data{'\n'}
          {'\u2022'} VCF: Export from your genetic testing provider
        </Text>
      </View>
    </ScrollView>
  );

  const renderProcessingStep = () => (
    <View style={styles.centerContent}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.processingTitle}>Analyzing Your Genetic Data</Text>
      <Text style={styles.processingSubtitle}>
        This may take a few moments...
      </Text>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
      </View>
      <Text style={styles.progressText}>{uploadProgress}% complete</Text>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.centerContent}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={80} color={colors.success[500]} />
      </View>
      <Text style={styles.successTitle}>Analysis Complete!</Text>
      <Text style={styles.successSubtitle}>
        Your genetic profile has been created. You can now view your markers and personalized insights.
      </Text>
      <TouchableOpacity
        style={styles.viewProfileButton}
        onPress={handleViewProfile}
      >
        <Text style={styles.viewProfileButtonText}>View My Genetic Profile</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Genomic Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {['consent', 'upload', 'processing', 'complete'].map((s, index) => (
          <View key={s} style={styles.stepRow}>
            <View
              style={[
                styles.stepDot,
                (step === s || ['consent', 'upload', 'processing', 'complete'].indexOf(step) > index) &&
                  styles.stepDotActive,
              ]}
            />
            {index < 3 && (
              <View
                style={[
                  styles.stepLine,
                  ['consent', 'upload', 'processing', 'complete'].indexOf(step) > index &&
                    styles.stepLineActive,
                ]}
              />
            )}
          </View>
        ))}
      </View>

      {step === 'consent' && renderConsentStep()}
      {step === 'upload' && renderUploadStep()}
      {step === 'processing' && renderProcessingStep()}
      {step === 'complete' && renderCompleteStep()}
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
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border.light,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.xs,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  consentList: {
    marginBottom: spacing.lg,
  },
  consentItem: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  consentItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  consentCheckbox: {
    marginRight: spacing.md,
    paddingTop: 2,
  },
  consentContent: {
    flex: 1,
  },
  consentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  consentTitle: {
    ...typography.subtitle,
    color: colors.text.primary,
    flex: 1,
  },
  requiredBadge: {
    backgroundColor: colors.error[500] + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  requiredText: {
    ...typography.caption,
    color: colors.error[500],
    fontWeight: '600',
  },
  consentDescription: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
    marginLeft: spacing.sm,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  continueButtonDisabled: {
    backgroundColor: colors.text.disabled,
  },
  continueButtonText: {
    ...typography.button,
    color: colors.white,
    marginRight: spacing.sm,
  },
  sourceList: {
    marginBottom: spacing.lg,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  sourceIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sourceContent: {
    flex: 1,
  },
  sourceName: {
    ...typography.subtitle,
    color: colors.text.primary,
    marginBottom: 2,
  },
  sourceDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  errorBox: {
    flexDirection: 'row',
    backgroundColor: colors.error[500] + '15',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error[500],
    flex: 1,
    marginLeft: spacing.sm,
  },
  instructionsBox: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  instructionsTitle: {
    ...typography.subtitle,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  instructionsText: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  processingTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  processingSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  progressContainer: {
    width: '80%',
    height: 6,
    backgroundColor: colors.border.light,
    borderRadius: 3,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  successIcon: {
    marginBottom: spacing.md,
  },
  successTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  successSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
  },
  viewProfileButtonText: {
    ...typography.button,
    color: colors.white,
    marginRight: spacing.sm,
  },
});
