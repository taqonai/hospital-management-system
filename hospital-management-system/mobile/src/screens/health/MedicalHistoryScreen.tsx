import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { MedicalHistory, HealthStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<HealthStackParamList>;

interface EditableSection {
  title: string;
  key: keyof MedicalHistory;
  icon: string;
  color: string;
  isArray: boolean;
  isObject?: boolean;
}

const SECTIONS: EditableSection[] = [
  { title: 'Chronic Conditions', key: 'chronicConditions', icon: 'heart-outline', color: colors.error[500], isArray: true },
  { title: 'Past Surgeries', key: 'pastSurgeries', icon: 'cut-outline', color: colors.warning[500], isArray: true },
  { title: 'Family History', key: 'familyHistory', icon: 'people-outline', color: colors.primary[500], isArray: true },
  { title: 'Current Medications', key: 'currentMedications', icon: 'medical-outline', color: colors.success[500], isArray: true },
  { title: 'Immunizations', key: 'immunizations', icon: 'shield-checkmark-outline', color: colors.info[500], isArray: true },
];

const MedicalHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<MedicalHistory | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSection, setEditingSection] = useState<EditableSection | null>(null);
  const [editValue, setEditValue] = useState('');
  const [analysisResult, setAnalysisResult] = useState<{ insights: string[]; recommendations: string[] } | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const response = await patientPortalApi.getMedicalHistory();
      setHistory(response.data?.data || null);
    } catch (error) {
      console.error('Error loading medical history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadHistory();
  };

  const handleEditSection = (section: EditableSection) => {
    setEditingSection(section);
    if (history && section.isArray) {
      const value = history[section.key] as string[];
      setEditValue(Array.isArray(value) ? value.join('\n') : '');
    }
    setShowEditModal(true);
  };

  const handleSaveSection = async () => {
    if (!editingSection || !history) return;

    setIsSaving(true);
    try {
      const newValue = editValue
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const updatedHistory = {
        ...history,
        [editingSection.key]: newValue,
      };

      await patientPortalApi.updateMedicalHistory(updatedHistory);
      setHistory(updatedHistory);
      setShowEditModal(false);
      Alert.alert('Success', 'Medical history updated');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to update. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const response = await patientPortalApi.analyzeMedicalHistory();
      const data = response.data?.data;
      if (data) {
        setAnalysisResult(data);
      } else {
        Alert.alert('Analysis Complete', 'No specific insights at this time.');
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404 || status === 503) {
        Alert.alert('Service Unavailable', 'AI analysis is currently unavailable. Please try again later.');
      } else {
        Alert.alert('Error', 'Failed to analyze medical history.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderListSection = (section: EditableSection) => {
    const items = history?.[section.key] as string[] || [];
    return (
      <View key={section.key} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: `${section.color}15` }]}>
            <Ionicons name={section.icon as any} size={20} color={section.color} />
          </View>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditSection(section)}
          >
            <Ionicons name="pencil" size={16} color={colors.primary[600]} />
          </TouchableOpacity>
        </View>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>No items recorded</Text>
        ) : (
          <View style={styles.itemsList}>
            {items.map((item, index) => (
              <View key={index} style={styles.itemChip}>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderLifestyle = () => {
    const lifestyle = history?.lifestyle || {};
    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: `${colors.success[500]}15` }]}>
            <Ionicons name="fitness-outline" size={20} color={colors.success[500]} />
          </View>
          <Text style={styles.sectionTitle}>Lifestyle</Text>
        </View>
        <View style={styles.lifestyleGrid}>
          <View style={styles.lifestyleItem}>
            <Text style={styles.lifestyleLabel}>Smoking</Text>
            <Text style={styles.lifestyleValue}>{lifestyle.smoking || 'Not specified'}</Text>
          </View>
          <View style={styles.lifestyleItem}>
            <Text style={styles.lifestyleLabel}>Alcohol</Text>
            <Text style={styles.lifestyleValue}>{lifestyle.alcohol || 'Not specified'}</Text>
          </View>
          <View style={styles.lifestyleItem}>
            <Text style={styles.lifestyleLabel}>Exercise</Text>
            <Text style={styles.lifestyleValue}>{lifestyle.exercise || 'Not specified'}</Text>
          </View>
          <View style={styles.lifestyleItem}>
            <Text style={styles.lifestyleLabel}>Diet</Text>
            <Text style={styles.lifestyleValue}>{lifestyle.diet || 'Not specified'}</Text>
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Allergies Link */}
        <TouchableOpacity
          style={styles.allergiesCard}
          onPress={() => navigation.navigate('Allergies')}
        >
          <View style={[styles.sectionIcon, { backgroundColor: colors.error[50] }]}>
            <Ionicons name="warning-outline" size={20} color={colors.error[500]} />
          </View>
          <View style={styles.allergiesInfo}>
            <Text style={styles.allergiesTitle}>Allergies</Text>
            <Text style={styles.allergiesSubtitle}>View and manage your allergies</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
        </TouchableOpacity>

        {/* Medical History Sections */}
        {SECTIONS.map(section => renderListSection(section))}

        {/* Lifestyle */}
        {renderLifestyle()}

        {/* Notes */}
        {history?.notes && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: `${colors.gray[500]}15` }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.gray[500]} />
              </View>
              <Text style={styles.sectionTitle}>Notes</Text>
            </View>
            <Text style={styles.notesText}>{history.notes}</Text>
          </View>
        )}

        {/* AI Analysis Button */}
        <TouchableOpacity
          style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]}
          onPress={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <ActivityIndicator size="small" color={colors.white} />
              <Text style={styles.analyzeButtonText}>Analyzing...</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color={colors.white} />
              <Text style={styles.analyzeButtonText}>AI Health Analysis</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Analysis Results */}
        {analysisResult && (
          <View style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>AI Health Insights</Text>

            {analysisResult.insights.length > 0 && (
              <View style={styles.analysisSection}>
                <Text style={styles.analysisSubtitle}>Insights</Text>
                {analysisResult.insights.map((insight, index) => (
                  <View key={index} style={styles.insightItem}>
                    <Ionicons name="bulb-outline" size={16} color={colors.warning[500]} />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>
            )}

            {analysisResult.recommendations.length > 0 && (
              <View style={styles.analysisSection}>
                <Text style={styles.analysisSubtitle}>Recommendations</Text>
                {analysisResult.recommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationItem}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.success[500]} />
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editingSection?.title}</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalInstructions}>
                Enter each item on a new line
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter items..."
                placeholderTextColor={colors.gray[400]}
                value={editValue}
                onChangeText={setEditValue}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSaveSection}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  content: {
    padding: spacing.lg,
  },
  allergiesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  allergiesInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  allergiesTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[700],
  },
  allergiesSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    marginTop: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  editButton: {
    padding: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  itemChip: {
    backgroundColor: colors.gray[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  itemText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  lifestyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  lifestyleItem: {
    width: '50%',
    paddingVertical: spacing.sm,
  },
  lifestyleLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  lifestyleValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
  },
  notesText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  analyzeButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    ...shadows.md,
  },
  analyzeButtonDisabled: {
    backgroundColor: colors.gray[400],
  },
  analyzeButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  analysisCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    ...shadows.sm,
  },
  analysisTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginBottom: spacing.md,
  },
  analysisSection: {
    marginTop: spacing.md,
  },
  analysisSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  insightText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 18,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  recommendationText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
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
  modalBody: {
    padding: spacing.lg,
  },
  modalInstructions: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    minHeight: 150,
  },
  saveButton: {
    backgroundColor: colors.primary[600],
    margin: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  saveButtonText: {
    color: colors.white,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default MedicalHistoryScreen;
