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
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { patientPortalApi } from '../../services/api';
import { InsurancePolicy, InsuranceFormData } from '../../types';

const RELATIONSHIP_OPTIONS = [
  { value: 'Self', label: 'Self (Primary Holder)' },
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Child', label: 'Child' },
  { value: 'Parent', label: 'Parent' },
  { value: 'Other', label: 'Other Dependent' },
];

const COVERAGE_TYPES = [
  { value: 'Basic', label: 'Basic (DHA Essential)' },
  { value: 'Enhanced', label: 'Enhanced' },
  { value: 'VIP', label: 'VIP / Executive' },
  { value: 'International', label: 'International' },
];

const UAE_INSURERS = [
  'Daman (National Health Insurance Company)',
  'AXA Insurance (Gulf)',
  'Dubai Insurance Company',
  'Emirates Insurance Company',
  'ADNIC',
  'Oman Insurance Company',
  'Sukoon Insurance',
  'Al Sagr Insurance',
  'Methaq Takaful',
  'Abu Dhabi National Takaful',
  'Other',
];

const emptyForm: InsuranceFormData = {
  providerName: '',
  policyNumber: '',
  groupNumber: '',
  subscriberName: '',
  subscriberId: '',
  relationship: 'Self',
  effectiveDate: '',
  expiryDate: '',
  coverageType: 'Basic',
  isPrimary: false,
};

const InsuranceScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InsuranceFormData>(emptyForm);
  const [customProvider, setCustomProvider] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);
  const [showCoveragePicker, setShowCoveragePicker] = useState(false);

  // Date picker state
  const [showEffectiveDatePicker, setShowEffectiveDatePicker] = useState(false);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);

  const loadInsurance = useCallback(async () => {
    try {
      const response = await patientPortalApi.getInsurance();
      setPolicies(response.data?.data || []);
    } catch (error) {
      console.error('Error loading insurance:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInsurance();
  }, [loadInsurance]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadInsurance();
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setCustomProvider(false);
  };

  const handleEdit = (policy: InsurancePolicy) => {
    setFormData({
      providerName: policy.providerName,
      policyNumber: policy.policyNumber,
      groupNumber: policy.groupNumber || '',
      subscriberName: policy.subscriberName,
      subscriberId: policy.subscriberId,
      relationship: policy.relationship,
      effectiveDate: policy.effectiveDate?.split('T')[0] || '',
      expiryDate: policy.expiryDate?.split('T')[0] || '',
      coverageType: policy.coverageType,
      isPrimary: policy.isPrimary,
    });
    setCustomProvider(!UAE_INSURERS.includes(policy.providerName));
    setEditingId(policy.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.providerName || !formData.policyNumber || !formData.subscriberName) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await patientPortalApi.updateInsurance(editingId, formData);
        Alert.alert('Success', 'Insurance updated successfully!');
      } else {
        await patientPortalApi.addInsurance(formData);
        Alert.alert('Success', 'Insurance added successfully! Pending verification.');
      }
      resetForm();
      loadInsurance();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to save insurance');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (policy: InsurancePolicy) => {
    Alert.alert('Remove Insurance', `Are you sure you want to remove ${policy.providerName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await patientPortalApi.deleteInsurance(policy.id);
            loadInsurance();
          } catch {
            Alert.alert('Error', 'Failed to remove insurance');
          }
        },
      },
    ]);
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await patientPortalApi.setPrimaryInsurance(id);
      loadInsurance();
    } catch {
      Alert.alert('Error', 'Failed to set primary insurance');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleDateChange = (target: 'effective' | 'expiry') => (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (target === 'effective') setShowEffectiveDatePicker(false);
      else setShowExpiryDatePicker(false);
    }
    if (event.type === 'dismissed') {
      if (target === 'effective') setShowEffectiveDatePicker(false);
      else setShowExpiryDatePicker(false);
      return;
    }
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setFormData({ ...formData, [target === 'effective' ? 'effectiveDate' : 'expiryDate']: dateStr });
    }
  };

  const getStatusBadge = (status?: string) => {
    const config: Record<string, { bg: string; text: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
      VERIFIED: { bg: `${colors.success[500]}15`, text: colors.success[700], label: 'Verified', icon: 'checkmark-circle' },
      REJECTED: { bg: `${colors.error[500]}15`, text: colors.error[700], label: 'Rejected', icon: 'close-circle' },
      PENDING: { bg: `${colors.warning[500]}15`, text: colors.warning[700], label: 'Pending', icon: 'time' },
    };
    const s = config[status || 'PENDING'] || config.PENDING;
    return (
      <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
        <Ionicons name={s.icon} size={12} color={s.text} />
        <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
      </View>
    );
  };

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary[600]} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* DHA Notice */}
        <View style={styles.dhaBanner}>
          <Ionicons name="shield-checkmark" size={24} color={colors.primary[600]} />
          <View style={styles.dhaText}>
            <Text style={styles.dhaTitle}>UAE Health Insurance Requirement</Text>
            <Text style={styles.dhaSubtitle}>
              All UAE residents are required to have valid health insurance. Adding your insurance helps us verify coverage and process claims faster.
            </Text>
          </View>
        </View>

        {/* Add Button */}
        {!showForm && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <Ionicons name="add-circle" size={24} color={colors.primary[600]} />
            <Text style={styles.addButtonText}>Add Insurance</Text>
          </TouchableOpacity>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{editingId ? 'Edit Insurance' : 'Add Insurance'}</Text>
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>

            {/* Provider */}
            <Text style={styles.fieldLabel}>Insurance Provider *</Text>
            {!customProvider ? (
              <>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowProviderPicker(true)}>
                  <Text style={formData.providerName ? styles.pickerText : styles.pickerPlaceholder}>
                    {formData.providerName || 'Select insurance provider...'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.gray[400]} />
                </TouchableOpacity>
                <Modal visible={showProviderPicker} transparent animationType="slide" onRequestClose={() => setShowProviderPicker(false)}>
                  <View style={styles.pickerModalOverlay}>
                    <View style={styles.pickerModalContent}>
                      <View style={styles.pickerModalHeader}>
                        <Text style={styles.pickerModalTitle}>Select Provider</Text>
                        <TouchableOpacity onPress={() => setShowProviderPicker(false)}>
                          <Ionicons name="close" size={24} color={colors.gray[500]} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView>
                        {UAE_INSURERS.map((insurer) => (
                          <TouchableOpacity
                            key={insurer}
                            style={[styles.pickerOption, formData.providerName === insurer && styles.pickerOptionSelected]}
                            onPress={() => {
                              if (insurer === 'Other') {
                                setCustomProvider(true);
                                setFormData({ ...formData, providerName: '' });
                              } else {
                                setFormData({ ...formData, providerName: insurer });
                              }
                              setShowProviderPicker(false);
                            }}
                          >
                            <Text style={[styles.pickerOptionText, formData.providerName === insurer && styles.pickerOptionTextSelected]}>
                              {insurer}
                            </Text>
                            {formData.providerName === insurer && <Ionicons name="checkmark" size={20} color={colors.primary[600]} />}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              </>
            ) : (
              <View style={styles.customProviderRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Enter insurance provider name"
                  placeholderTextColor={colors.gray[400]}
                  value={formData.providerName}
                  onChangeText={(v) => setFormData({ ...formData, providerName: v })}
                />
                <TouchableOpacity onPress={() => { setCustomProvider(false); setFormData({ ...formData, providerName: '' }); }}>
                  <Text style={styles.chooseFromListText}>List</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Policy & Group */}
            <Text style={styles.fieldLabel}>Policy Number *</Text>
            <TextInput style={styles.input} placeholder="e.g., POL-123456789" placeholderTextColor={colors.gray[400]} value={formData.policyNumber} onChangeText={(v) => setFormData({ ...formData, policyNumber: v })} />

            <Text style={styles.fieldLabel}>Group Number</Text>
            <TextInput style={styles.input} placeholder="e.g., GRP-001" placeholderTextColor={colors.gray[400]} value={formData.groupNumber} onChangeText={(v) => setFormData({ ...formData, groupNumber: v })} />

            {/* Subscriber */}
            <Text style={styles.fieldLabel}>Subscriber Name *</Text>
            <TextInput style={styles.input} placeholder="Name on insurance card" placeholderTextColor={colors.gray[400]} value={formData.subscriberName} onChangeText={(v) => setFormData({ ...formData, subscriberName: v })} />

            <Text style={styles.fieldLabel}>Member / Subscriber ID</Text>
            <TextInput style={styles.input} placeholder="Member ID on card" placeholderTextColor={colors.gray[400]} value={formData.subscriberId} onChangeText={(v) => setFormData({ ...formData, subscriberId: v })} />

            {/* Relationship Picker */}
            <Text style={styles.fieldLabel}>Relationship</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowRelationshipPicker(true)}>
              <Text style={styles.pickerText}>{RELATIONSHIP_OPTIONS.find(r => r.value === formData.relationship)?.label || formData.relationship}</Text>
              <Ionicons name="chevron-down" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
            <Modal visible={showRelationshipPicker} transparent animationType="slide" onRequestClose={() => setShowRelationshipPicker(false)}>
              <View style={styles.pickerModalOverlay}>
                <View style={styles.pickerModalContent}>
                  <View style={styles.pickerModalHeader}>
                    <Text style={styles.pickerModalTitle}>Relationship</Text>
                    <TouchableOpacity onPress={() => setShowRelationshipPicker(false)}><Ionicons name="close" size={24} color={colors.gray[500]} /></TouchableOpacity>
                  </View>
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <TouchableOpacity key={opt.value} style={[styles.pickerOption, formData.relationship === opt.value && styles.pickerOptionSelected]} onPress={() => { setFormData({ ...formData, relationship: opt.value }); setShowRelationshipPicker(false); }}>
                      <Text style={[styles.pickerOptionText, formData.relationship === opt.value && styles.pickerOptionTextSelected]}>{opt.label}</Text>
                      {formData.relationship === opt.value && <Ionicons name="checkmark" size={20} color={colors.primary[600]} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Modal>

            {/* Coverage Type Picker */}
            <Text style={styles.fieldLabel}>Coverage Type</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCoveragePicker(true)}>
              <Text style={styles.pickerText}>{COVERAGE_TYPES.find(c => c.value === formData.coverageType)?.label || formData.coverageType}</Text>
              <Ionicons name="chevron-down" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
            <Modal visible={showCoveragePicker} transparent animationType="slide" onRequestClose={() => setShowCoveragePicker(false)}>
              <View style={styles.pickerModalOverlay}>
                <View style={styles.pickerModalContent}>
                  <View style={styles.pickerModalHeader}>
                    <Text style={styles.pickerModalTitle}>Coverage Type</Text>
                    <TouchableOpacity onPress={() => setShowCoveragePicker(false)}><Ionicons name="close" size={24} color={colors.gray[500]} /></TouchableOpacity>
                  </View>
                  {COVERAGE_TYPES.map((opt) => (
                    <TouchableOpacity key={opt.value} style={[styles.pickerOption, formData.coverageType === opt.value && styles.pickerOptionSelected]} onPress={() => { setFormData({ ...formData, coverageType: opt.value }); setShowCoveragePicker(false); }}>
                      <Text style={[styles.pickerOptionText, formData.coverageType === opt.value && styles.pickerOptionTextSelected]}>{opt.label}</Text>
                      {formData.coverageType === opt.value && <Ionicons name="checkmark" size={20} color={colors.primary[600]} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Modal>

            {/* Dates */}
            <Text style={styles.fieldLabel}>Effective Date *</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEffectiveDatePicker(true)}>
              <Text style={formData.effectiveDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {formData.effectiveDate ? formatDate(formData.effectiveDate) : 'Select effective date'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Expiry Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowExpiryDatePicker(true)}>
              <Text style={formData.expiryDate ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {formData.expiryDate ? formatDate(formData.expiryDate) : 'Select expiry date'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
            </TouchableOpacity>

            {/* Primary toggle */}
            {policies.length > 0 && (
              <View style={styles.primaryToggle}>
                <Text style={styles.primaryToggleText}>Set as primary insurance</Text>
                <Switch
                  value={formData.isPrimary}
                  onValueChange={(v) => setFormData({ ...formData, isPrimary: v })}
                  trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                  thumbColor={formData.isPrimary ? colors.primary[600] : colors.gray[100]}
                />
              </View>
            )}

            {/* Submit */}
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, isSaving && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={isSaving}>
                <Text style={styles.submitButtonText}>{isSaving ? 'Saving...' : editingId ? 'Update' : 'Add Insurance'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Insurance Cards */}
        {policies.length === 0 && !showForm ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Insurance on File</Text>
            <Text style={styles.emptyText}>Add your insurance information to streamline your visits and enable faster claims processing.</Text>
            <TouchableOpacity style={styles.emptyAddButton} onPress={() => setShowForm(true)}>
              <Ionicons name="add-circle" size={20} color={colors.white} />
              <Text style={styles.emptyAddButtonText}>Add Your Insurance</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.policyList}>
            {policies.map((policy) => (
              <View key={policy.id} style={[styles.policyCard, policy.isPrimary && styles.policyCardPrimary]}>
                <View style={styles.policyHeader}>
                  <View style={[styles.policyIcon, { backgroundColor: policy.isPrimary ? colors.primary[100] : colors.gray[100] }]}>
                    <Ionicons name="shield-checkmark" size={24} color={policy.isPrimary ? colors.primary[600] : colors.gray[500]} />
                  </View>
                  <View style={styles.policyInfo}>
                    <View style={styles.policyTitleRow}>
                      <Text style={styles.policyName} numberOfLines={1}>{policy.providerName}</Text>
                      {policy.isPrimary && (
                        <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Primary</Text></View>
                      )}
                    </View>
                    {getStatusBadge(policy.verificationStatus)}
                  </View>
                </View>

                <View style={styles.policyDetails}>
                  <Text style={styles.policyDetailText}>Policy: {policy.policyNumber}</Text>
                  {policy.groupNumber && <Text style={styles.policyDetailText}>Group: {policy.groupNumber}</Text>}
                  <Text style={styles.policyDetailText}>{policy.subscriberName} ({policy.relationship}) | {policy.coverageType}</Text>
                  <Text style={styles.policyDateText}>
                    Valid: {formatDate(policy.effectiveDate)}{policy.expiryDate ? ` - ${formatDate(policy.expiryDate)}` : ''}
                  </Text>
                </View>

                {(policy.networkTier || policy.copayPercentage || policy.copay) && (
                  <View style={styles.coverageInfo}>
                    {policy.networkTier && (
                      <Text style={[styles.networkText, { color: policy.networkTier === 'IN_NETWORK' ? colors.success[600] : colors.warning[600] }]}>
                        {policy.networkTier === 'IN_NETWORK' ? 'In-Network' : 'Out-of-Network'}
                      </Text>
                    )}
                    {policy.copayPercentage != null && <Text style={styles.copayText}>Copay: {policy.copayPercentage}%</Text>}
                    {policy.copay != null && <Text style={styles.copayText}>Fixed: AED {policy.copay}</Text>}
                  </View>
                )}

                <View style={styles.policyActions}>
                  {!policy.isPrimary && (
                    <TouchableOpacity style={styles.setPrimaryButton} onPress={() => handleSetPrimary(policy.id)}>
                      <Text style={styles.setPrimaryText}>Set Primary</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(policy)}>
                    <Ionicons name="pencil-outline" size={18} color={colors.primary[600]} />
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(policy)}>
                    <Ionicons name="trash-outline" size={18} color={colors.error[500]} />
                    <Text style={[styles.actionText, { color: colors.error[500] }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tips Card */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="information-circle" size={20} color={colors.primary[700]} />
            <Text style={styles.tipsTitle}>Tips for Insurance Information</Text>
          </View>
          <View style={styles.tipsList}>
            {[
              'Have your insurance card ready when adding new insurance',
              'The policy number is usually on the front of your card',
              'Set your most comprehensive plan as the primary insurance',
              'Update your insurance before it expires to avoid coverage gaps',
              'Staff will verify your insurance at check-in using your Emirates ID',
            ].map((tip, i) => (
              <Text key={i} style={styles.tipText}>{'\u2022'} {tip}</Text>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Date Pickers */}
      {showEffectiveDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowEffectiveDatePicker(false)}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContent}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowEffectiveDatePicker(false)}><Text style={styles.datePickerCancel}>Cancel</Text></TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Effective Date</Text>
                  <TouchableOpacity onPress={() => setShowEffectiveDatePicker(false)}><Text style={styles.datePickerDone}>Done</Text></TouchableOpacity>
                </View>
                <DateTimePicker value={formData.effectiveDate ? new Date(formData.effectiveDate) : new Date()} mode="date" display="spinner" onChange={handleDateChange('effective')} />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker value={formData.effectiveDate ? new Date(formData.effectiveDate) : new Date()} mode="date" display="default" onChange={handleDateChange('effective')} />
        )
      )}
      {showExpiryDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowExpiryDatePicker(false)}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContent}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowExpiryDatePicker(false)}><Text style={styles.datePickerCancel}>Cancel</Text></TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Expiry Date</Text>
                  <TouchableOpacity onPress={() => setShowExpiryDatePicker(false)}><Text style={styles.datePickerDone}>Done</Text></TouchableOpacity>
                </View>
                <DateTimePicker value={formData.expiryDate ? new Date(formData.expiryDate) : new Date()} mode="date" display="spinner" onChange={handleDateChange('expiry')} />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker value={formData.expiryDate ? new Date(formData.expiryDate) : new Date()} mode="date" display="default" onChange={handleDateChange('expiry')} />
        )
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  dhaBanner: { flexDirection: 'row', backgroundColor: colors.primary[50], borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.md, alignItems: 'flex-start' },
  dhaText: { flex: 1 },
  dhaTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any, color: colors.primary[800], marginBottom: spacing.xs },
  dhaSubtitle: { fontSize: typography.fontSize.sm, color: colors.primary[700], lineHeight: 18 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[50], borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.primary[200], borderStyle: 'dashed' },
  addButtonText: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium as any, color: colors.primary[600] },
  formCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  formTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary },
  fieldLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium as any, color: colors.text.primary, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, padding: spacing.md, fontSize: typography.fontSize.base, color: colors.text.primary },
  pickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, padding: spacing.md },
  pickerText: { fontSize: typography.fontSize.base, color: colors.text.primary },
  pickerPlaceholder: { fontSize: typography.fontSize.base, color: colors.gray[400] },
  customProviderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chooseFromListText: { fontSize: typography.fontSize.sm, color: colors.primary[600], fontWeight: typography.fontWeight.medium as any },
  pickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  pickerModalContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '60%' },
  pickerModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerModalTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  pickerOptionSelected: { backgroundColor: colors.primary[50] },
  pickerOptionText: { fontSize: typography.fontSize.base, color: colors.text.primary },
  pickerOptionTextSelected: { color: colors.primary[600], fontWeight: typography.fontWeight.medium as any },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, padding: spacing.md },
  dateButtonText: { fontSize: typography.fontSize.base, color: colors.text.primary },
  dateButtonPlaceholder: { fontSize: typography.fontSize.base, color: colors.gray[400] },
  primaryToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.md },
  primaryToggleText: { fontSize: typography.fontSize.sm, color: colors.text.primary },
  formActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelButton: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.gray[300], alignItems: 'center' },
  cancelButtonText: { fontSize: typography.fontSize.base, color: colors.text.secondary, fontWeight: typography.fontWeight.medium as any },
  submitButton: { flex: 2, paddingVertical: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.primary[600], alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.gray[300] },
  submitButtonText: { fontSize: typography.fontSize.base, color: colors.white, fontWeight: typography.fontWeight.semibold as any },
  emptyCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.xl, alignItems: 'center', ...shadows.sm },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary, marginTop: spacing.lg },
  emptyText: { fontSize: typography.fontSize.sm, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 20 },
  emptyAddButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary[600], paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.lg },
  emptyAddButtonText: { color: colors.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium as any },
  policyList: { gap: spacing.md, marginBottom: spacing.lg },
  policyCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 2, borderColor: colors.gray[200], ...shadows.sm },
  policyCardPrimary: { borderColor: colors.primary[300], backgroundColor: colors.primary[50] },
  policyHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  policyIcon: { width: 48, height: 48, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  policyInfo: { flex: 1 },
  policyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  policyName: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary, flex: 1 },
  primaryBadge: { backgroundColor: colors.primary[100], paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  primaryBadgeText: { fontSize: typography.fontSize.xs, color: colors.primary[700], fontWeight: typography.fontWeight.medium as any },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, alignSelf: 'flex-start' },
  statusText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium as any },
  policyDetails: { paddingBottom: spacing.sm },
  policyDetailText: { fontSize: typography.fontSize.sm, color: colors.text.secondary, marginBottom: 2 },
  policyDateText: { fontSize: typography.fontSize.xs, color: colors.gray[400], marginTop: spacing.xs },
  coverageInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray[100] },
  networkText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium as any },
  copayText: { fontSize: typography.fontSize.sm, color: colors.text.secondary },
  policyActions: { flexDirection: 'row', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray[100], gap: spacing.md, flexWrap: 'wrap' },
  setPrimaryButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.md, backgroundColor: colors.primary[50] },
  setPrimaryText: { fontSize: typography.fontSize.sm, color: colors.primary[600], fontWeight: typography.fontWeight.medium as any },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { fontSize: typography.fontSize.sm, color: colors.primary[600], fontWeight: typography.fontWeight.medium as any },
  tipsCard: { backgroundColor: colors.primary[50], borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.primary[200], marginTop: spacing.md },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  tipsTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any, color: colors.primary[800] },
  tipsList: { gap: spacing.sm },
  tipText: { fontSize: typography.fontSize.sm, color: colors.primary[700], lineHeight: 18 },
  datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  datePickerContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingBottom: spacing.xl },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  datePickerTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary },
  datePickerCancel: { fontSize: typography.fontSize.base, color: colors.gray[500] },
  datePickerDone: { fontSize: typography.fontSize.base, color: colors.primary[600], fontWeight: typography.fontWeight.semibold as any },
});

export default InsuranceScreen;
