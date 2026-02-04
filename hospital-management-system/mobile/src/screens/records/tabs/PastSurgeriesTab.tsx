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
import { PastSurgeryRecord } from '../../../types';

const PastSurgeriesTab: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [surgeries, setSurgeries] = useState<PastSurgeryRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PastSurgeryRecord | null>(null);

  // Form state
  const [surgeryName, setSurgeryName] = useState('');
  const [surgeryDate, setSurgeryDate] = useState(new Date());
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalLocation, setHospitalLocation] = useState('');
  const [surgeonName, setSurgeonName] = useState('');
  const [indication, setIndication] = useState('');
  const [complications, setComplications] = useState('');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadSurgeries = useCallback(async () => {
    try {
      const response = await patientPortalApi.getPastSurgeries();
      setSurgeries(response.data?.data || []);
    } catch (error) {
      console.error('Error loading past surgeries:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSurgeries();
  }, [loadSurgeries]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSurgeries();
  };

  const resetForm = () => {
    setSurgeryName('');
    setSurgeryDate(new Date());
    setHospitalName('');
    setHospitalLocation('');
    setSurgeonName('');
    setIndication('');
    setComplications('');
    setOutcome('');
    setNotes('');
    setEditingRecord(null);
  };

  const handleAddNew = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (record: PastSurgeryRecord) => {
    setEditingRecord(record);
    setSurgeryName(record.surgeryName);
    setSurgeryDate(record.surgeryDate ? new Date(record.surgeryDate) : new Date());
    setHospitalName(record.hospitalName);
    setHospitalLocation(record.hospitalLocation || '');
    setSurgeonName(record.surgeonName || '');
    setIndication(record.indication || '');
    setComplications(record.complications || '');
    setOutcome(record.outcome || '');
    setNotes(record.notes || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!surgeryName.trim() || !hospitalName.trim()) {
      Alert.alert('Error', 'Please enter the surgery name and hospital');
      return;
    }
    setIsSaving(true);
    try {
      const data: any = {
        surgeryName: surgeryName.trim(),
        surgeryDate: surgeryDate.toISOString(),
        hospitalName: hospitalName.trim(),
        hospitalLocation: hospitalLocation.trim() || undefined,
        surgeonName: surgeonName.trim() || undefined,
        indication: indication.trim() || undefined,
        complications: complications.trim() || undefined,
        outcome: outcome.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (editingRecord) {
        await patientPortalApi.updatePastSurgery(editingRecord.id, data);
        Alert.alert('Success', 'Surgery record updated');
      } else {
        await patientPortalApi.addPastSurgery(data);
        Alert.alert('Success', 'Surgery record added');
      }
      setShowModal(false);
      resetForm();
      loadSurgeries();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (record: PastSurgeryRecord) => {
    Alert.alert('Delete Surgery', `Are you sure you want to remove "${record.surgeryName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await patientPortalApi.deletePastSurgery(record.id);
            loadSurgeries();
          } catch {
            Alert.alert('Error', 'Failed to delete surgery record');
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
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed') { setShowDatePicker(false); return; }
    if (selectedDate) setSurgeryDate(selectedDate);
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
        <Text style={styles.addButtonText}>Add Surgery</Text>
      </TouchableOpacity>

      {surgeries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cut-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Past Surgeries Recorded</Text>
          <Text style={styles.emptyText}>Add your surgical history to keep your records complete.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {surgeries.map((record) => (
            <View key={record.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{record.surgeryName}</Text>
                {getVerificationBadge(record.verificationStatus)}
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.gray[400]} />
                  <Text style={styles.detailText}>{formatDate(record.surgeryDate)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="business-outline" size={14} color={colors.gray[400]} />
                  <Text style={styles.detailText}>{record.hospitalName}</Text>
                </View>
                {record.hospitalLocation && (
                  <View style={styles.detailItem}>
                    <Ionicons name="location-outline" size={14} color={colors.gray[400]} />
                    <Text style={styles.detailText}>{record.hospitalLocation}</Text>
                  </View>
                )}
                {record.surgeonName && (
                  <View style={styles.detailItem}>
                    <Ionicons name="person-outline" size={14} color={colors.gray[400]} />
                    <Text style={styles.detailText}>Dr. {record.surgeonName}</Text>
                  </View>
                )}
              </View>

              {(record.complications || record.outcome) && (
                <View style={styles.extraInfo}>
                  {record.complications && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Complications:</Text>
                      <Text style={styles.infoValue}>{record.complications}</Text>
                    </View>
                  )}
                  {record.outcome && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Outcome:</Text>
                      <Text style={styles.infoValue}>{record.outcome}</Text>
                    </View>
                  )}
                </View>
              )}

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
              <Text style={styles.modalTitle}>{editingRecord ? 'Edit Surgery' : 'Add Surgery'}</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Surgery Name *</Text>
              <TextInput style={styles.input} placeholder="e.g., Appendectomy, Knee Replacement" placeholderTextColor={colors.gray[400]} value={surgeryName} onChangeText={setSurgeryName} />

              <Text style={styles.fieldLabel}>Surgery Date *</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>{surgeryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.primary[600]} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Hospital Name *</Text>
              <TextInput style={styles.input} placeholder="Hospital where surgery was performed" placeholderTextColor={colors.gray[400]} value={hospitalName} onChangeText={setHospitalName} />

              <Text style={styles.fieldLabel}>Hospital Location</Text>
              <TextInput style={styles.input} placeholder="City, Country" placeholderTextColor={colors.gray[400]} value={hospitalLocation} onChangeText={setHospitalLocation} />

              <Text style={styles.fieldLabel}>Surgeon Name</Text>
              <TextInput style={styles.input} placeholder="Name of surgeon" placeholderTextColor={colors.gray[400]} value={surgeonName} onChangeText={setSurgeonName} />

              <Text style={styles.fieldLabel}>Indication</Text>
              <TextInput style={styles.input} placeholder="Reason for surgery" placeholderTextColor={colors.gray[400]} value={indication} onChangeText={setIndication} />

              <Text style={styles.fieldLabel}>Complications</Text>
              <TextInput style={styles.input} placeholder="Any complications" placeholderTextColor={colors.gray[400]} value={complications} onChangeText={setComplications} />

              <Text style={styles.fieldLabel}>Outcome</Text>
              <TextInput style={styles.input} placeholder="e.g., Successful, Partial" placeholderTextColor={colors.gray[400]} value={outcome} onChangeText={setOutcome} />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={[styles.input, styles.multilineInput]} placeholder="Additional notes" placeholderTextColor={colors.gray[400]} value={notes} onChangeText={setNotes} multiline />
            </ScrollView>
            <TouchableOpacity style={[styles.saveButton, (!surgeryName || !hospitalName || isSaving) && styles.saveButtonDisabled]} onPress={handleSave} disabled={!surgeryName || !hospitalName || isSaving}>
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : editingRecord ? 'Update' : 'Add Surgery'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContent}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={styles.datePickerCancel}>Cancel</Text></TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Surgery Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={styles.datePickerDone}>Done</Text></TouchableOpacity>
                </View>
                <DateTimePicker value={surgeryDate} mode="date" display="spinner" onChange={handleDateChange} maximumDate={new Date()} />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker value={surgeryDate} mode="date" display="default" onChange={handleDateChange} maximumDate={new Date()} />
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
  cardTitle: { flex: 1, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold as any, color: colors.text.primary },
  verificationBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, marginLeft: spacing.sm },
  verificationText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium as any },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  detailText: { fontSize: typography.fontSize.sm, color: colors.text.secondary },
  extraInfo: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray[100], gap: spacing.xs },
  infoRow: { flexDirection: 'row' },
  infoLabel: { fontSize: typography.fontSize.sm, color: colors.text.secondary, fontWeight: typography.fontWeight.medium as any, marginRight: spacing.xs },
  infoValue: { flex: 1, fontSize: typography.fontSize.sm, color: colors.text.primary },
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

export default PastSurgeriesTab;
