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
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { Allergy } from '../../types';

const ALLERGY_TYPES = [
  { value: 'DRUG', label: 'Drug', icon: 'medical' },
  { value: 'FOOD', label: 'Food', icon: 'nutrition' },
  { value: 'ENVIRONMENTAL', label: 'Environmental', icon: 'leaf' },
  { value: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal' },
] as const;

const SEVERITY_LEVELS = [
  { value: 'MILD', label: 'Mild', color: colors.success[500] },
  { value: 'MODERATE', label: 'Moderate', color: colors.warning[500] },
  { value: 'SEVERE', label: 'Severe', color: colors.error[500] },
  { value: 'LIFE_THREATENING', label: 'Life-threatening', color: colors.error[700] },
] as const;

interface AllergySuggestion {
  allergen: string;
  type: Allergy['type'];
  confidence: number;
  reason: string;
}

const AllergiesScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<Allergy | null>(null);

  // AI Suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<AllergySuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form state
  const [allergen, setAllergen] = useState('');
  const [type, setType] = useState<Allergy['type']>('DRUG');
  const [severity, setSeverity] = useState<Allergy['severity']>('MILD');
  const [reaction, setReaction] = useState('');
  const [notes, setNotes] = useState('');

  const loadAllergies = useCallback(async () => {
    try {
      const response = await patientPortalApi.getAllergies();
      setAllergies(response.data?.data || []);
    } catch (error) {
      console.error('Error loading allergies:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllergies();
  }, [loadAllergies]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAllergies();
  };

  const resetForm = () => {
    setAllergen('');
    setType('DRUG');
    setSeverity('MILD');
    setReaction('');
    setNotes('');
    setEditingAllergy(null);
  };

  const handleAddNew = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    setAllergen(allergy.allergen);
    setType(allergy.type);
    setSeverity(allergy.severity);
    setReaction(allergy.reaction || '');
    setNotes(allergy.notes || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!allergen.trim()) {
      Alert.alert('Error', 'Please enter the allergen name');
      return;
    }

    setIsSaving(true);
    try {
      const allergyData = {
        allergen: allergen.trim(),
        type,
        severity,
        reaction: reaction.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (editingAllergy) {
        await patientPortalApi.updateAllergy(editingAllergy.id, allergyData);
        Alert.alert('Success', 'Allergy updated');
      } else {
        await patientPortalApi.addAllergy(allergyData);
        Alert.alert('Success', 'Allergy added');
      }

      setShowModal(false);
      resetForm();
      loadAllergies();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to save. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (allergy: Allergy) => {
    Alert.alert(
      'Delete Allergy',
      `Are you sure you want to delete "${allergy.allergen}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await patientPortalApi.deleteAllergy(allergy.id);
              loadAllergies();
            } catch {
              Alert.alert('Error', 'Failed to delete allergy');
            }
          },
        },
      ]
    );
  };

  const handleGetSuggestions = async () => {
    setIsLoadingSuggestions(true);
    try {
      const response = await patientPortalApi.suggestAllergies();
      const rawData = response.data?.data;
      const rawSuggestions = rawData?.suggestions || [];

      // Map API response to AllergySuggestion format
      // API returns: { suggestions: [{ type, possible?: string[], reason?, categories?: [...], message? }], disclaimer }
      // UI expects: { allergen: string, type: string, confidence: number, reason: string }[]
      const mappedSuggestions: AllergySuggestion[] = [];

      rawSuggestions.forEach((suggestion: any) => {
        if (suggestion.type === 'GENERAL' && suggestion.categories) {
          // Handle general suggestions with categories
          suggestion.categories.forEach((category: any) => {
            if (category.common && Array.isArray(category.common)) {
              category.common.slice(0, 3).forEach((allergen: string, index: number) => {
                mappedSuggestions.push({
                  allergen,
                  type: category.type || 'OTHER',
                  confidence: 0.5 - (index * 0.1), // Decreasing confidence for general suggestions
                  reason: suggestion.message || 'Common allergen to consider'
                });
              });
            }
          });
        } else if (suggestion.possible && Array.isArray(suggestion.possible)) {
          // Handle specific suggestions with possible array
          suggestion.possible.forEach((allergen: string, index: number) => {
            mappedSuggestions.push({
              allergen,
              type: suggestion.type || 'OTHER',
              confidence: 0.8 - (index * 0.1), // Decreasing confidence based on position
              reason: suggestion.reason || 'Based on your symptoms'
            });
          });
        } else if (suggestion.allergen) {
          // Already in correct format (from AI service)
          mappedSuggestions.push({
            allergen: suggestion.allergen,
            type: suggestion.type || 'OTHER',
            confidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : 0.7,
            reason: suggestion.reason || 'AI suggested'
          });
        }
      });

      setAiSuggestions(mappedSuggestions);
      setShowSuggestions(mappedSuggestions.length > 0);
      if (mappedSuggestions.length === 0) {
        Alert.alert('No Suggestions', 'No allergy suggestions available based on your medical history.');
      }
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
      Alert.alert('Error', 'Failed to get AI suggestions. Please try again later.');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleAddFromSuggestion = (suggestion: AllergySuggestion) => {
    setAllergen(suggestion.allergen);
    setType(suggestion.type);
    setSeverity('MILD');
    setReaction('');
    setNotes(`AI suggested: ${suggestion.reason}`);
    setEditingAllergy(null);
    setShowModal(true);
  };

  const getSeverityColor = (sev: Allergy['severity']) => {
    return SEVERITY_LEVELS.find(s => s.value === sev)?.color || colors.gray[500];
  };

  const getTypeIcon = (t: Allergy['type']) => {
    return ALLERGY_TYPES.find(at => at.value === t)?.icon || 'alert-circle';
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
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={24} color={colors.warning[600]} />
          <Text style={styles.warningText}>
            Keep this list up to date. Your healthcare providers rely on this information for safe treatment.
          </Text>
        </View>

        {/* Add Button */}
        <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
          <Ionicons name="add-circle" size={24} color={colors.primary[600]} />
          <Text style={styles.addButtonText}>Add Allergy</Text>
        </TouchableOpacity>

        {/* AI Suggestions Button */}
        <TouchableOpacity
          style={styles.suggestButton}
          onPress={handleGetSuggestions}
          disabled={isLoadingSuggestions}
        >
          {isLoadingSuggestions ? (
            <ActivityIndicator size="small" color={colors.info[600]} />
          ) : (
            <Ionicons name="sparkles" size={20} color={colors.info[600]} />
          )}
          <Text style={styles.suggestButtonText}>
            {isLoadingSuggestions ? 'Getting Suggestions...' : 'Get AI Suggestions'}
          </Text>
        </TouchableOpacity>

        {/* AI Suggestions List */}
        {showSuggestions && aiSuggestions.length > 0 && (
          <View style={styles.suggestionsSection}>
            <View style={styles.suggestionsSectionHeader}>
              <Text style={styles.suggestionsSectionTitle}>AI Suggestions</Text>
              <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                <Ionicons name="close-circle" size={20} color={colors.gray[400]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.suggestionsSectionSubtitle}>
              Based on your medical history, these allergies may be relevant:
            </Text>
            {aiSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionCard}
                onPress={() => handleAddFromSuggestion(suggestion)}
              >
                <View style={styles.suggestionHeader}>
                  <View style={styles.suggestionTypeIcon}>
                    <Ionicons
                      name={ALLERGY_TYPES.find(t => t.value === suggestion.type)?.icon as any || 'alert-circle'}
                      size={18}
                      color={colors.info[600]}
                    />
                  </View>
                  <View style={styles.suggestionInfo}>
                    <Text style={styles.suggestionName}>{suggestion.allergen}</Text>
                    <Text style={styles.suggestionType}>
                      {ALLERGY_TYPES.find(t => t.value === suggestion.type)?.label || suggestion.type}
                    </Text>
                  </View>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {Math.round(suggestion.confidence * 100)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                <View style={styles.suggestionAction}>
                  <Text style={styles.suggestionActionText}>Tap to add</Text>
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary[600]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Allergies List */}
        {allergies.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.success[500]} />
            <Text style={styles.emptyTitle}>No Allergies Recorded</Text>
            <Text style={styles.emptyText}>
              If you have any known allergies, add them here to keep your medical records accurate.
            </Text>
          </View>
        ) : (
          <View style={styles.allergyList}>
            {allergies.map((allergy) => (
              <View key={allergy.id} style={styles.allergyCard}>
                <View style={styles.allergyHeader}>
                  <View style={styles.allergyTypeIcon}>
                    <Ionicons
                      name={getTypeIcon(allergy.type) as any}
                      size={20}
                      color={colors.gray[600]}
                    />
                  </View>
                  <View style={styles.allergyInfo}>
                    <Text style={styles.allergyName}>{allergy.allergen}</Text>
                    <Text style={styles.allergyType}>
                      {ALLERGY_TYPES.find(t => t.value === allergy.type)?.label || allergy.type}
                    </Text>
                  </View>
                  <View style={[styles.severityBadge, { backgroundColor: `${getSeverityColor(allergy.severity)}15` }]}>
                    <Text style={[styles.severityText, { color: getSeverityColor(allergy.severity) }]}>
                      {SEVERITY_LEVELS.find(s => s.value === allergy.severity)?.label || allergy.severity}
                    </Text>
                  </View>
                </View>

                {allergy.reaction && (
                  <View style={styles.reactionContainer}>
                    <Text style={styles.reactionLabel}>Reaction:</Text>
                    <Text style={styles.reactionText}>{allergy.reaction}</Text>
                  </View>
                )}

                {allergy.notes && (
                  <Text style={styles.allergyNotes}>{allergy.notes}</Text>
                )}

                <View style={styles.allergyActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEdit(allergy)}
                  >
                    <Ionicons name="pencil-outline" size={18} color={colors.primary[600]} />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDelete(allergy)}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error[500]} />
                    <Text style={[styles.actionText, { color: colors.error[500] }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAllergy ? 'Edit Allergy' : 'Add Allergy'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowModal(false);
                resetForm();
              }}>
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Allergen Name */}
              <Text style={styles.fieldLabel}>Allergen *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Penicillin, Peanuts, Pollen"
                placeholderTextColor={colors.gray[400]}
                value={allergen}
                onChangeText={setAllergen}
              />

              {/* Type */}
              <Text style={styles.fieldLabel}>Type *</Text>
              <View style={styles.typeGrid}>
                {ALLERGY_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeOption, type === t.value && styles.typeOptionSelected]}
                    onPress={() => setType(t.value)}
                  >
                    <Ionicons
                      name={t.icon as any}
                      size={20}
                      color={type === t.value ? colors.primary[600] : colors.gray[500]}
                    />
                    <Text style={[styles.typeLabel, type === t.value && styles.typeLabelSelected]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Severity */}
              <Text style={styles.fieldLabel}>Severity *</Text>
              <View style={styles.severityGrid}>
                {SEVERITY_LEVELS.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.severityOption,
                      severity === s.value && styles.severityOptionSelected,
                      severity === s.value && { borderColor: s.color },
                    ]}
                    onPress={() => setSeverity(s.value)}
                  >
                    <View style={[styles.severityDot, { backgroundColor: s.color }]} />
                    <Text style={[styles.severityLabel, severity === s.value && { color: s.color }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Reaction */}
              <Text style={styles.fieldLabel}>Reaction (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Describe the allergic reaction"
                placeholderTextColor={colors.gray[400]}
                value={reaction}
                onChangeText={setReaction}
              />

              {/* Notes */}
              <Text style={styles.fieldLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Any additional information"
                placeholderTextColor={colors.gray[400]}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, (!allergen || isSaving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!allergen || isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : editingAllergy ? 'Update Allergy' : 'Add Allergy'}
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
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
    lineHeight: 18,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.info[100],
  },
  suggestButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.info[700],
  },
  suggestionsSection: {
    backgroundColor: colors.info[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.info[100],
  },
  suggestionsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  suggestionsSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.info[700],
  },
  suggestionsSectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.info[600],
    marginBottom: spacing.md,
  },
  suggestionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.info[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  suggestionName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  suggestionType: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  confidenceBadge: {
    backgroundColor: colors.info[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  confidenceText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.info[700],
  },
  suggestionReason: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  suggestionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  suggestionActionText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  allergyList: {
    gap: spacing.md,
  },
  allergyCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  allergyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allergyTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  allergyInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  allergyName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  allergyType: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  severityBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  severityText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  reactionContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reactionLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  reactionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  allergyNotes: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
  allergyActions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
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
    maxHeight: '85%',
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
    maxHeight: 400,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  typeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  typeLabelSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  severityGrid: {
    gap: spacing.sm,
  },
  severityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: spacing.sm,
  },
  severityOptionSelected: {
    backgroundColor: colors.white,
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  severityLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
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

export default AllergiesScreen;
