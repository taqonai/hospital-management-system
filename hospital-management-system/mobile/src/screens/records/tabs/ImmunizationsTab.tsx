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
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, typography, shadows } from '../../../theme';
import { patientPortalApi } from '../../../services/api';
import { ImmunizationRecord } from '../../../types';

const ImmunizationsTab: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [immunizations, setImmunizations] = useState<ImmunizationRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ImmunizationRecord | null>(null);

  // Form state
  const [vaccineName, setVaccineName] = useState('');
  const [vaccineType, setVaccineType] = useState('');
  const [doseNumber, setDoseNumber] = useState('');
  const [dateAdministered, setDateAdministered] = useState(new Date());
  const [administeredBy, setAdministeredBy] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [nextDueDate, setNextDueDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNextDatePicker, setShowNextDatePicker] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'administered' | 'nextDue'>('administered');

  const loadImmunizations = useCallback(async () => {
    try {
      const response = await patientPortalApi.getImmunizations();
      setImmunizations(response.data?.data || []);
    } catch (error) {
      console.error('Error loading immunizations:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadImmunizations();
  }, [loadImmunizations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadImmunizations();
  };

  const resetForm = () => {
    setVaccineName('');
    setVaccineType('');
    setDoseNumber('');
    setDateAdministered(new Date());
    setAdministeredBy('');
    setLotNumber('');
    setNextDueDate(null);
    setNotes('');
    setEditingRecord(null);
  };

  const handleAddNew = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (record: ImmunizationRecord) => {
    setEditingRecord(record);
    setVaccineName(record.vaccineName);
    setVaccineType(record.vaccineType || '');
    setDoseNumber(record.doseNumber ? String(record.doseNumber) : '');
    setDateAdministered(record.dateAdministered ? new Date(record.dateAdministered) : new Date());
    setAdministeredBy(record.administeredBy || '');
    setLotNumber(record.lotNumber || '');
    setNextDueDate(record.nextDueDate ? new Date(record.nextDueDate) : null);
    setNotes(record.notes || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!vaccineName.trim()) {
      Alert.alert('Error', 'Please enter the vaccine name');
      return;
    }
    setIsSaving(true);
    try {
      const data: any = {
        vaccineName: vaccineName.trim(),
        vaccineType: vaccineType.trim() || undefined,
        doseNumber: doseNumber ? parseInt(doseNumber, 10) : undefined,
        dateAdministered: dateAdministered.toISOString(),
        administeredBy: administeredBy.trim() || undefined,
        lotNumber: lotNumber.trim() || undefined,
        nextDueDate: nextDueDate ? nextDueDate.toISOString() : undefined,
        notes: notes.trim() || undefined,
      };
      if (editingRecord) {
        await patientPortalApi.updateImmunization(editingRecord.id, data);
        Alert.alert('Success', 'Immunization updated');
      } else {
        await patientPortalApi.addImmunization(data);
        Alert.alert('Success', 'Immunization added');
      }
      setShowModal(false);
      resetForm();
      loadImmunizations();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (record: ImmunizationRecord) => {
    Alert.alert('Delete Immunization', `Are you sure you want to remove "${record.vaccineName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await patientPortalApi.deleteImmunization(record.id);
            loadImmunizations();
          } catch {
            Alert.alert('Error', 'Failed to delete immunization');
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const getVerificationBadge = (status?: string) => {
    if (!status) return null;
    const isVerified = status === 'NURSE_VERIFIED' || status === 'DOCTOR_VALIDATED';
    return (
      <View style={[styles.verificationBadge, { backgroundColor: isVerified ? `${colors.success[500]}15` : `${colors.warning[500]}15` }]}>
        <Text style={[styles.verificationText, { color: isVerified ? colors.success[600] : colors.warning[600] }]}>
          {status === 'PATIENT_REPORTED' ? 'Self-reported' : status === 'NURSE_VERIFIED' ? 'Verified' : 'Validated'}
        </Text>
      </View>
    );
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowNextDatePicker(false);
    }
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      setShowNextDatePicker(false);
      return;
    }
    if (selectedDate) {
      if (datePickerTarget === 'administered') {
        setDateAdministered(selectedDate);
        if (Platform.OS === 'android') setShowDatePicker(false);
      } else {
        setNextDueDate(selectedDate);
        if (Platform.OS === 'android') setShowNextDatePicker(false);
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
        <Ionicons name="add-circle" size={24} color={colors.primary[600]} />
        <Text style={styles.addButtonText}>Add Vaccine</Text>
      </TouchableOpacity>

      {immunizations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="shield-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Immunizations Recorded</Text>
          <Text style={styles.emptyText}>Add your vaccination history to keep your records complete.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {immunizations.map((record) => (
            <View key={record.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{record.vaccineName}</Text>
                  {record.vaccineType && (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{record.vaccineType}</Text>
                    </View>
                  )}
                  {record.doseNumber && (
                    <View style={styles.doseBadge}>
                      <Text style={styles.doseBadgeText}>Dose {record.doseNumber}</Text>
                    </View>
                  )}
                </View>
                {getVerificationBadge(record.verificationStatus)}
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.gray[400]} />
                  <Text style={styles.detailText}>{formatDate(record.dateAdministered)}</Text>
                </View>
                {record.administeredBy && (
                  <View style={styles.detailItem}>
                    <Ionicons name="person-outline" size={14} color={colors.gray[400]} />
                    <Text style={styles.detailText}>{record.administeredBy}</Text>
                  </View>
                )}
                {record.lotNumber && (
                  <View style={styles.detailItem}>
                    <Ionicons name="barcode-outline" size={14} color={colors.gray[400]} />
                    <Text style={styles.detailText}>Lot: {record.lotNumber}</Text>
                  </View>
                )}
                {record.nextDueDate && (
                  <View style={styles.detailItem}>
                    <Ionicons name="time-outline" size={14} color={colors.primary[500]} />
                    <Text style={[styles.detailText, { color: colors.primary[600], fontWeight: '500' }]}>
                      Next: {formatDate(record.nextDueDate)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(record)}>
                  <Ionicons name="pencil-outline" size={18} color={colors.primary[600]} />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(record)}>
                  <Ionicons name="trash-outline" size={18} color={colors.error[500]} />
                  <Text style={[styles.actionText, { color: colors.error[500] }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingRecord ? 'Edit Immunization' : 'Add Immunization'}</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Vaccine Name *</Text>
              <TextInput style={styles.input} placeholder="e.g., COVID-19, Influenza, Hepatitis B" placeholderTextColor={colors.gray[400]} value={vaccineName} onChangeText={setVaccineName} />

              <Text style={styles.fieldLabel}>Vaccine Type</Text>
              <TextInput style={styles.input} placeholder="e.g., mRNA, Inactivated" placeholderTextColor={colors.gray[400]} value={vaccineType} onChangeText={setVaccineType} />

              <Text style={styles.fieldLabel}>Date Administered</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => { setDatePickerTarget('administered'); setShowDatePicker(true); }}>
                <Text style={styles.dateButtonText}>{dateAdministered.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Dose Number</Text>
              <TextInput style={styles.input} placeholder="e.g., 1, 2, 3" placeholderTextColor={colors.gray[400]} value={doseNumber} onChangeText={setDoseNumber} keyboardType="number-pad" />

              <Text style={styles.fieldLabel}>Administered By</Text>
              <TextInput style={styles.input} placeholder="Healthcare provider name" placeholderTextColor={colors.gray[400]} value={administeredBy} onChangeText={setAdministeredBy} />

              <Text style={styles.fieldLabel}>Lot Number</Text>
              <TextInput style={styles.input} placeholder="Vaccine lot number" placeholderTextColor={colors.gray[400]} value={lotNumber} onChangeText={setLotNumber} />

              <Text style={styles.fieldLabel}>Next Due Date</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => { setDatePickerTarget('nextDue'); setShowNextDatePicker(true); }}>
                <Text style={styles.dateButtonText}>{nextDueDate ? nextDueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={[styles.input, styles.multilineInput]} placeholder="Any additional notes" placeholderTextColor={colors.gray[400]} value={notes} onChangeText={setNotes} multiline />
            </ScrollView>
            <TouchableOpacity style={[styles.saveButton, (!vaccineName || isSaving) && styles.saveButtonDisabled]} onPress={handleSave} disabled={!vaccineName || isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : editingRecord ? 'Update' : 'Add Immunization'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContent}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={styles.datePickerCancel}>Cancel</Text></TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Date Administered</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={styles.datePickerDone}>Done</Text></TouchableOpacity>
                </View>
                <DateTimePicker value={dateAdministered} mode="date" display="spinner" onChange={handleDateChange} maximumDate={new Date()} />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker value={dateAdministered} mode="date" display="default" onChange={handleDateChange} maximumDate={new Date()} />
        )
      )}
      {showNextDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowNextDatePicker(false)}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContent}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowNextDatePicker(false)}><Text style={styles.datePickerCancel}>Cancel</Text></TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Next Due Date</Text>
                  <TouchableOpacity onPress={() => setShowNextDatePicker(false)}><Text style={styles.datePickerDone}>Done</Text></TouchableOpacity>
                </View>
                <DateTimePicker value={nextDueDate || new Date()} mode="date" display="spinner" onChange={handleDateChange} minimumDate={new Date()} />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker value={nextDueDate || new Date()} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />
        )
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  content: { padding: spacing.lg },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[50], borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.primary[200], borderStyle: 'dashed' },
  addButtonText: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium as any, color: colors.primary[600] },
  emptyCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.xl, alignItems: 'center', ...shadows.sm },
  emptyTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary, marginTop: spacing.md },
  emptyText: { fontSize: typography.fontSize.sm, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  list: { gap: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  cardTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary },
  typeBadge: { backgroundColor: `${colors.primary[500]}15`, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  typeBadgeText: { fontSize: typography.fontSize.xs, color: colors.primary[700] },
  doseBadge: { backgroundColor: `${colors.info[500]}15`, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  doseBadgeText: { fontSize: typography.fontSize.xs, color: colors.info[700] },
  verificationBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  verificationText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium as any },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detailText: { fontSize: typography.fontSize.sm, color: colors.text.secondary },
  cardActions: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.lg },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionText: { fontSize: typography.fontSize.sm, color: colors.primary[600], fontWeight: typography.fontWeight.medium as any },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary },
  modalBody: { padding: spacing.lg },
  fieldLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium as any, color: colors.text.primary, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, padding: spacing.md, fontSize: typography.fontSize.base, color: colors.text.primary },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, padding: spacing.md },
  dateButtonText: { fontSize: typography.fontSize.base, color: colors.text.primary },
  saveButton: { backgroundColor: colors.primary[600], margin: spacing.lg, paddingVertical: spacing.lg, borderRadius: borderRadius.lg, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: colors.gray[300] },
  saveButtonText: { color: colors.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any },
  datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  datePickerContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingBottom: spacing.xl },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  datePickerTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary },
  datePickerCancel: { fontSize: typography.fontSize.base, color: colors.gray[500] },
  datePickerDone: { fontSize: typography.fontSize.base, color: colors.primary[600], fontWeight: typography.fontWeight.semibold as any },
});

export default ImmunizationsTab;
