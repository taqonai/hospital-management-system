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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, typography, shadows } from '../../../theme';
import { patientPortalApi } from '../../../services/api';
import { MedicalHistory } from '../../../types';
import type { RootState } from '../../../store';

interface EditableSection {
  title: string;
  key: keyof MedicalHistory;
  icon: string;
  color: string;
  isArray: boolean;
}

const SECTIONS: EditableSection[] = [
  { title: 'Chronic Conditions', key: 'chronicConditions', icon: 'heart-outline', color: colors.error[500], isArray: true },
  { title: 'Family History', key: 'familyHistory', icon: 'people-outline', color: colors.primary[500], isArray: true },
  { title: 'Current Medications', key: 'currentMedications', icon: 'medical-outline', color: colors.success[500], isArray: true },
  { title: 'Ongoing Treatment', key: 'currentTreatment', icon: 'bandage-outline', color: colors.info[600], isArray: false },
];

const calculateAge = (dateOfBirth: string | undefined): number | null => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const HealthProfileTab: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<MedicalHistory | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSection, setEditingSection] = useState<EditableSection | null>(null);
  const [editValue, setEditValue] = useState('');
  const [analysisResult, setAnalysisResult] = useState<{ insights: string[]; recommendations: string[] } | null>(null);

  const user = useSelector((state: RootState) => state.auth.user);

  const [showLifestyleModal, setShowLifestyleModal] = useState(false);
  const [lifestyleForm, setLifestyleForm] = useState({ smoking: '', alcohol: '', exercise: '', diet: '' });

  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [tempDueDate, setTempDueDate] = useState<Date>(new Date());

  const patientAge = calculateAge(user?.dateOfBirth);
  const shouldShowPregnancy = user?.gender?.toUpperCase() === 'FEMALE' && patientAge !== null && patientAge >= 18 && patientAge <= 55;

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

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleRefresh = () => { setIsRefreshing(true); loadHistory(); };

  const handleEditSection = (section: EditableSection) => {
    setEditingSection(section);
    if (history) {
      if (section.isArray) {
        const value = history[section.key] as string[];
        setEditValue(Array.isArray(value) ? value.join('\n') : '');
      } else {
        setEditValue((history[section.key] as string) || '');
      }
    }
    setShowEditModal(true);
  };

  const handleSaveSection = async () => {
    if (!editingSection || !history) return;
    setIsSaving(true);
    try {
      let newValue: string[] | string | null;
      if (editingSection.isArray) {
        newValue = editValue.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      } else {
        newValue = editValue.trim() || null;
      }
      const updatedHistory = { ...history, [editingSection.key]: newValue };
      const response = await patientPortalApi.updateMedicalHistory(updatedHistory);
      setHistory(response.data?.data || updatedHistory);
      setShowEditModal(false);
      Alert.alert('Success', 'Medical history updated');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to update. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditLifestyle = () => {
    const lifestyle = history?.lifestyle || {};
    setLifestyleForm({ smoking: lifestyle.smoking || '', alcohol: lifestyle.alcohol || '', exercise: lifestyle.exercise || '', diet: lifestyle.diet || '' });
    setShowLifestyleModal(true);
  };

  const handleSaveLifestyle = async () => {
    if (!history) return;
    setIsSaving(true);
    try {
      const updatedHistory = { ...history, lifestyle: lifestyleForm };
      const response = await patientPortalApi.updateMedicalHistory(updatedHistory);
      setHistory(response.data?.data || updatedHistory);
      setShowLifestyleModal(false);
      Alert.alert('Success', 'Lifestyle information updated');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to update. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const normalizeBoolean = (value: any): boolean | null => {
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false') return false;
    return null;
  };

  const getPregnancyStatus = (): boolean | null => normalizeBoolean(history?.isPregnant);

  const handleUpdatePregnancy = async (isPregnant: boolean | null, expectedDueDate?: string) => {
    if (!history) return;
    if (isPregnant === true && !expectedDueDate) {
      const existingDate = history?.expectedDueDate ? new Date(history.expectedDueDate) : null;
      setTempDueDate(existingDate || new Date(Date.now() + 9 * 30 * 24 * 60 * 60 * 1000));
      setShowDueDatePicker(true);
      return;
    }
    setIsSaving(true);
    try {
      const updatedHistory = { ...history, isPregnant, expectedDueDate: isPregnant && expectedDueDate ? expectedDueDate : null };
      const response = await patientPortalApi.updateMedicalHistory(updatedHistory);
      setHistory(response.data?.data || updatedHistory);
      Alert.alert('Success', 'Pregnancy status updated');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to update. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDueDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDueDatePicker(false);
    if (event.type === 'dismissed') { setShowDueDatePicker(false); return; }
    if (selectedDate) {
      setTempDueDate(selectedDate);
      if (Platform.OS === 'android') handleUpdatePregnancy(true, selectedDate.toISOString());
    }
  };

  const handleConfirmDueDate = () => {
    setShowDueDatePicker(false);
    handleUpdatePregnancy(true, tempDueDate.toISOString());
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const response = await patientPortalApi.analyzeMedicalHistory();
      const data: any = response.data?.data;
      if (data && typeof data === 'object') {
        const insights: string[] = [];
        const recommendations: string[] = [];
        if (data.summary) {
          if (data.summary.riskLevel === 'elevated') {
            insights.push(`Risk Level: Elevated - based on ${data.summary.totalConditions} condition(s) and ${data.summary.totalAllergies} allergy(ies)`);
          } else if (data.summary.totalConditions > 0 || data.summary.totalAllergies > 0) {
            insights.push(`Health Summary: ${data.summary.totalConditions} chronic condition(s), ${data.summary.totalAllergies} known allergy(ies)`);
          }
        }
        if (Array.isArray(data.riskFactors)) {
          data.riskFactors.forEach((rf: any) => { if (rf?.factor) insights.push(`${rf.factor} risk: ${rf.level || 'noted'}`); });
        }
        if (Array.isArray(data.recommendations)) {
          data.recommendations.forEach((rec: any) => {
            if (typeof rec === 'string') recommendations.push(rec);
            else if (rec?.title && rec?.description) recommendations.push(`${rec.title}: ${rec.description}`);
            else if (rec?.title) recommendations.push(rec.title);
            else if (rec?.description) recommendations.push(rec.description);
          });
        }
        if (Array.isArray(data.preventiveCare)) {
          data.preventiveCare.forEach((pc: any) => { if (pc?.test) recommendations.push(`${pc.test}${pc.frequency ? ` (${pc.frequency})` : ''}`); });
        }
        setAnalysisResult({ insights, recommendations });
      } else {
        setAnalysisResult({ insights: [], recommendations: [] });
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404 || status === 503) Alert.alert('Service Unavailable', 'AI analysis is currently unavailable. Please try again later.');
      else Alert.alert('Error', 'Failed to analyze medical history. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderListSection = (section: EditableSection) => {
    if (!section.isArray) {
      const value = (history?.[section.key] as string) || '';
      return (
        <View key={section.key} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: `${section.color}15` }]}>
              <Ionicons name={section.icon as any} size={20} color={section.color} />
            </View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <TouchableOpacity style={styles.editButton} onPress={() => handleEditSection(section)}>
              <Ionicons name="pencil" size={16} color={colors.primary[600]} />
            </TouchableOpacity>
          </View>
          {!value ? <Text style={styles.emptyText}>No information recorded</Text> : <Text style={styles.treatmentText}>{value}</Text>}
        </View>
      );
    }
    const items = (history?.[section.key] as string[]) || [];
    return (
      <View key={section.key} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: `${section.color}15` }]}>
            <Ionicons name={section.icon as any} size={20} color={section.color} />
          </View>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <TouchableOpacity style={styles.editButton} onPress={() => handleEditSection(section)}>
            <Ionicons name="pencil" size={16} color={colors.primary[600]} />
          </TouchableOpacity>
        </View>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>No items recorded</Text>
        ) : (
          <View style={styles.itemsList}>
            {items.map((item, index) => (
              <View key={index} style={styles.itemChip}><Text style={styles.itemText}>{item}</Text></View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPregnancySection = () => {
    if (!shouldShowPregnancy) return null;
    const pregnancyStatus = getPregnancyStatus();
    return (
      <View style={styles.pregnancyCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.error[100] }]}>
            <Ionicons name="heart-half-outline" size={20} color={colors.error[500]} />
          </View>
          <Text style={styles.sectionTitle}>Pregnancy Status</Text>
        </View>
        <Text style={styles.pregnancyHelpText}>This information helps healthcare providers make safer treatment decisions.</Text>
        <View style={styles.radioGroup}>
          {[
            { value: true, label: 'Yes, I am pregnant', activeColor: colors.error[500] },
            { value: false, label: 'No', activeColor: colors.primary[500] },
            { value: null, label: 'Not specified', activeColor: colors.gray[500] },
          ].map((option) => {
            const isSelected = pregnancyStatus === option.value;
            return (
              <TouchableOpacity key={String(option.value)} style={[styles.radioOption, isSelected && styles.radioSelected]} onPress={() => handleUpdatePregnancy(option.value as any)} disabled={isSaving}>
                <Ionicons name={isSelected ? 'radio-button-on' : 'radio-button-off'} size={20} color={isSelected ? option.activeColor : colors.gray[400]} />
                <Text style={[styles.radioText, isSelected && styles.radioTextSelected]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {pregnancyStatus === true && (
          <View style={styles.dueDateContainer}>
            <Text style={styles.dueDateLabel}>Expected Due Date</Text>
            <TouchableOpacity style={styles.dueDateButton} onPress={() => { setTempDueDate(history?.expectedDueDate ? new Date(history.expectedDueDate) : new Date(Date.now() + 9 * 30 * 24 * 60 * 60 * 1000)); setShowDueDatePicker(true); }}>
              <Text style={styles.dueDateValue}>{history?.expectedDueDate ? new Date(history.expectedDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Tap to set due date'}</Text>
              <Ionicons name="calendar-outline" size={20} color={colors.error[500]} />
            </TouchableOpacity>
          </View>
        )}
        {showDueDatePicker && (
          Platform.OS === 'ios' ? (
            <Modal visible transparent animationType="slide" onRequestClose={() => setShowDueDatePicker(false)}>
              <View style={styles.datePickerOverlay}>
                <View style={styles.datePickerContent}>
                  <View style={styles.datePickerHeader}>
                    <TouchableOpacity onPress={() => setShowDueDatePicker(false)}><Text style={styles.datePickerCancel}>Cancel</Text></TouchableOpacity>
                    <Text style={styles.datePickerTitle}>Expected Due Date</Text>
                    <TouchableOpacity onPress={handleConfirmDueDate}><Text style={styles.datePickerDone}>Done</Text></TouchableOpacity>
                  </View>
                  <DateTimePicker value={tempDueDate} mode="date" display="spinner" onChange={handleDueDateChange} minimumDate={new Date()} maximumDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)} />
                </View>
              </View>
            </Modal>
          ) : (
            <DateTimePicker value={tempDueDate} mode="date" display="default" onChange={handleDueDateChange} minimumDate={new Date()} maximumDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)} />
          )
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
          <TouchableOpacity style={styles.editButton} onPress={handleEditLifestyle}>
            <Ionicons name="pencil" size={16} color={colors.primary[600]} />
          </TouchableOpacity>
        </View>
        <View style={styles.lifestyleGrid}>
          {[
            { label: 'Smoking', value: lifestyle.smoking },
            { label: 'Alcohol', value: lifestyle.alcohol },
            { label: 'Exercise', value: lifestyle.exercise },
            { label: 'Diet', value: lifestyle.diet },
          ].map((item) => (
            <View key={item.label} style={styles.lifestyleItem}>
              <Text style={styles.lifestyleLabel}>{item.label}</Text>
              <Text style={styles.lifestyleValue}>{item.value || 'Not specified'}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary[600]} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}>
      {SECTIONS.map(section => renderListSection(section))}
      {renderPregnancySection()}
      {renderLifestyle()}

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

      <TouchableOpacity style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]} onPress={handleAnalyze} disabled={isAnalyzing}>
        {isAnalyzing ? (
          <><ActivityIndicator size="small" color={colors.white} /><Text style={styles.analyzeButtonText}>Analyzing...</Text></>
        ) : (
          <><Ionicons name="sparkles" size={20} color={colors.white} /><Text style={styles.analyzeButtonText}>AI Health Analysis</Text></>
        )}
      </TouchableOpacity>

      {analysisResult && (
        <View style={styles.analysisCard}>
          <Text style={styles.analysisTitle}>AI Health Insights</Text>
          {analysisResult.insights.length > 0 && (
            <View style={styles.analysisSection}>
              <Text style={styles.analysisSubtitle}>Insights</Text>
              {analysisResult.insights.map((insight, i) => (
                <View key={i} style={styles.insightItem}>
                  <Ionicons name="bulb-outline" size={16} color={colors.warning[500]} />
                  <Text style={styles.insightText}>{insight ?? ''}</Text>
                </View>
              ))}
            </View>
          )}
          {analysisResult.recommendations.length > 0 && (
            <View style={styles.analysisSection}>
              <Text style={styles.analysisSubtitle}>Recommendations</Text>
              {analysisResult.recommendations.map((rec, i) => (
                <View key={i} style={styles.recommendationItem}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.success[500]} />
                  <Text style={styles.recommendationText}>{rec ?? ''}</Text>
                </View>
              ))}
            </View>
          )}
          {analysisResult.insights.length === 0 && analysisResult.recommendations.length === 0 && (
            <Text style={styles.emptyAnalysis}>No specific insights available at this time.</Text>
          )}
        </View>
      )}

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editingSection?.title}</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}><Ionicons name="close" size={24} color={colors.gray[500]} /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalInstructions}>{editingSection?.isArray ? 'Enter each item on a new line' : 'Enter the information below'}</Text>
              <TextInput style={styles.modalInput} placeholder={editingSection?.isArray ? 'Enter items...' : 'Enter information...'} placeholderTextColor={colors.gray[400]} value={editValue} onChangeText={setEditValue} multiline textAlignVertical="top" />
            </View>
            <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSaveSection} disabled={isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lifestyle Modal */}
      <Modal visible={showLifestyleModal} animationType="slide" transparent onRequestClose={() => setShowLifestyleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Lifestyle</Text>
              <TouchableOpacity onPress={() => setShowLifestyleModal(false)}><Ionicons name="close" size={24} color={colors.gray[500]} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {[
                { label: 'Smoking Status', key: 'smoking' as const, options: ['Never', 'Former', 'Current', 'Occasional'] },
                { label: 'Alcohol Consumption', key: 'alcohol' as const, options: ['Never', 'Rarely', 'Occasionally', 'Regularly'] },
                { label: 'Exercise Frequency', key: 'exercise' as const, options: ['Never', 'Rarely', '1-2x/week', '3-4x/week', 'Daily'] },
                { label: 'Diet Type', key: 'diet' as const, options: ['Regular', 'Vegetarian', 'Vegan', 'Keto', 'Low-carb', 'Other'] },
              ].map(({ label, key, options }) => (
                <View key={key}>
                  <Text style={styles.lifestyleFieldLabel}>{label}</Text>
                  <View style={styles.lifestyleOptions}>
                    {options.map((option) => (
                      <TouchableOpacity key={option} style={[styles.lifestyleOption, lifestyleForm[key] === option && styles.lifestyleOptionSelected]} onPress={() => setLifestyleForm({ ...lifestyleForm, [key]: option })}>
                        <Text style={[styles.lifestyleOptionText, lifestyleForm[key] === option && styles.lifestyleOptionTextSelected]}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSaveLifestyle} disabled={isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg },
  sectionCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sectionIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { flex: 1, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary, marginLeft: spacing.md },
  editButton: { padding: spacing.sm },
  emptyText: { fontSize: typography.fontSize.sm, color: colors.text.secondary, fontStyle: 'italic' },
  treatmentText: { fontSize: typography.fontSize.sm, color: colors.text.primary, lineHeight: 20 },
  itemsList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  itemChip: { backgroundColor: colors.gray[100], paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: borderRadius.md },
  itemText: { fontSize: typography.fontSize.sm, color: colors.text.primary },
  lifestyleGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  lifestyleItem: { width: '50%', paddingVertical: spacing.sm },
  lifestyleLabel: { fontSize: typography.fontSize.xs, color: colors.text.secondary },
  lifestyleValue: { fontSize: typography.fontSize.sm, color: colors.text.primary, fontWeight: typography.fontWeight.medium as any, marginTop: spacing.xs },
  notesText: { fontSize: typography.fontSize.sm, color: colors.text.secondary, lineHeight: 20 },
  analyzeButton: { flexDirection: 'row', backgroundColor: colors.primary[600], borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md, ...shadows.md },
  analyzeButtonDisabled: { backgroundColor: colors.gray[400] },
  analyzeButtonText: { color: colors.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any },
  analysisCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.primary[200], ...shadows.sm },
  analysisTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold as any, color: colors.primary[700], marginBottom: spacing.md },
  analysisSection: { marginTop: spacing.md },
  analysisSubtitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium as any, color: colors.text.secondary, marginBottom: spacing.sm },
  insightItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  insightText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.text.primary, lineHeight: 18 },
  recommendationItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  recommendationText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.text.primary, lineHeight: 18 },
  emptyAnalysis: { fontSize: typography.fontSize.sm, color: colors.text.secondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: spacing.md },
  pregnancyCard: { backgroundColor: colors.error[50], borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm },
  pregnancyHelpText: { fontSize: typography.fontSize.sm, color: colors.error[600], marginBottom: spacing.md },
  radioGroup: { gap: spacing.sm },
  radioOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.white, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  radioSelected: { borderColor: colors.primary[400], backgroundColor: colors.primary[50] },
  radioText: { marginLeft: spacing.sm, fontSize: typography.fontSize.sm, color: colors.text.secondary },
  radioTextSelected: { color: colors.text.primary, fontWeight: typography.fontWeight.medium as any },
  dueDateContainer: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.error[100] },
  dueDateLabel: { fontSize: typography.fontSize.xs, color: colors.error[600], marginBottom: spacing.xs },
  dueDateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error[100] },
  dueDateValue: { fontSize: typography.fontSize.sm, color: colors.text.primary, fontWeight: typography.fontWeight.medium as any },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary },
  modalBody: { padding: spacing.lg },
  modalInstructions: { fontSize: typography.fontSize.sm, color: colors.text.secondary, marginBottom: spacing.md },
  modalInput: { backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, padding: spacing.md, fontSize: typography.fontSize.base, color: colors.text.primary, minHeight: 150 },
  saveButton: { backgroundColor: colors.primary[600], margin: spacing.lg, paddingVertical: spacing.lg, borderRadius: borderRadius.lg, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: colors.gray[300] },
  saveButtonText: { color: colors.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any },
  lifestyleFieldLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium as any, color: colors.text.primary, marginBottom: spacing.sm, marginTop: spacing.md },
  lifestyleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  lifestyleOption: { backgroundColor: colors.gray[100], paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'transparent' },
  lifestyleOptionSelected: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  lifestyleOptionText: { fontSize: typography.fontSize.sm, color: colors.text.secondary },
  lifestyleOptionTextSelected: { color: colors.primary[600], fontWeight: typography.fontWeight.medium as any },
  datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  datePickerContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingBottom: spacing.xl },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  datePickerTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary },
  datePickerCancel: { fontSize: typography.fontSize.base, color: colors.gray[500] },
  datePickerDone: { fontSize: typography.fontSize.base, color: colors.primary[600], fontWeight: typography.fontWeight.semibold as any },
});

export default HealthProfileTab;
