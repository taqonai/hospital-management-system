import { useState, useEffect } from 'react';
import {
  ClipboardDocumentListIcon,
  SparklesIcon,
  ArrowPathIcon,
  PlusIcon,
  HeartIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { opdApi, patientApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export interface VitalsAppointment {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn?: string;
  };
  doctor?: {
    user: {
      firstName: string;
      lastName: string;
    };
    specialization?: string;
  };
  vitalsRecordedAt?: string;
}

interface CurrentMedication {
  name: string;
  dosage: string;
  frequency: string;
}

export interface VitalsModalProps {
  appointment: VitalsAppointment;
  onClose: () => void;
  onSuccess: () => void;
}

// Helper to calculate age from date of birth
const calculateAge = (dateOfBirth: string | undefined): number | null => {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export default function VitalsRecordingModal({ appointment, onClose, onSuccess }: VitalsModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [patientData, setPatientData] = useState<{ gender?: string; dateOfBirth?: string } | null>(null);
  const [vitals, setVitals] = useState({
    temperature: '',
    bloodPressureSys: '',
    bloodPressureDia: '',
    heartRate: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    bloodSugar: '',
    painLevel: '',
    notes: '',
    // New fields for pregnancy and medications
    isPregnant: undefined as boolean | undefined,
    expectedDueDate: '',
    currentMedications: [] as CurrentMedication[],
    currentTreatment: '',
  });

  // State for new medication input
  const [newMedication, setNewMedication] = useState<CurrentMedication>({
    name: '',
    dosage: '',
    frequency: '',
  });

  // State for detailed medical history (first consultation)
  const [showMedicalHistory, setShowMedicalHistory] = useState(false);
  const [pastSurgeries, setPastSurgeries] = useState<Array<{
    id?: string;
    isExisting?: boolean;
    surgeryName: string;
    surgeryDate: string;
    hospitalName: string;
    hospitalLocation: string;
    surgeonName: string;
    indication: string;
    complications: string;
    outcome: string;
    notes: string;
  }>>([]);
  const [immunizations, setImmunizations] = useState<Array<{
    id?: string;
    isExisting?: boolean;
    vaccineName: string;
    vaccineType: string;
    doseNumber: string;
    dateAdministered: string;
    administeredBy: string;
    lotNumber: string;
    nextDueDate: string;
    reactions: string;
    notes: string;
  }>>([]);
  const [deletedSurgeryIds, setDeletedSurgeryIds] = useState<string[]>([]);
  const [deletedImmunizationIds, setDeletedImmunizationIds] = useState<string[]>([]);

  // State for AI risk assessment display
  const [riskAssessment, setRiskAssessment] = useState<any>(null);
  const [showRiskAssessment, setShowRiskAssessment] = useState(false);

  // State for patient's booking notes (read-only display)
  const [patientBookingNotes, setPatientBookingNotes] = useState<string | null>(null);

  // State for patient medical summary (editable from MedicalHistory model)
  const [medicalSummary, setMedicalSummary] = useState<{
    medicalHistory: {
      chronicConditions: string[];
      pastSurgeries: string[];
      familyHistory: string[];
      currentMedications: string[];
      currentTreatment: string | null;
      isPregnant: boolean | null;
      expectedDueDate: string | null;
    } | null;
    allergies: Array<{
      id: string;
      allergen: string;
      type: string;
      severity: string;
      reaction: string | null;
      notes?: string | null;
    }>;
    detailedPastSurgeries?: Array<{
      id: string;
      surgeryName: string;
      surgeryDate: string;
      hospitalName: string;
      hospitalLocation: string | null;
      surgeonName: string | null;
      indication: string | null;
      complications: string | null;
      outcome: string | null;
      notes: string | null;
      verificationStatus: string;
    }>;
    detailedImmunizations?: Array<{
      id: string;
      vaccineName: string;
      vaccineType: string | null;
      doseNumber: number | null;
      dateAdministered: string;
      administeredBy: string | null;
      lotNumber: string | null;
      nextDueDate: string | null;
      reactions: string | null;
      notes: string | null;
      verificationStatus: string;
    }>;
  } | null>(null);
  const [loadingMedicalSummary, setLoadingMedicalSummary] = useState(false);

  // Editable medical records state
  const [editableChronicConditions, setEditableChronicConditions] = useState<string[]>([]);
  const [editableFamilyHistory, setEditableFamilyHistory] = useState<string[]>([]);
  const [newConditionInput, setNewConditionInput] = useState('');
  const [newFamilyHistoryInput, setNewFamilyHistoryInput] = useState('');
  const [editableAllergies, setEditableAllergies] = useState<Array<{
    id: string;
    allergen: string;
    type: string;
    severity: string;
    reaction: string;
    notes: string;
    isEditing?: boolean;
  }>>([]);
  const [showAddAllergyForm, setShowAddAllergyForm] = useState(false);
  const [newAllergy, setNewAllergy] = useState({ allergen: '', type: 'OTHER', severity: 'MILD', reaction: '', notes: '' });
  const [savingMedicalHistory, setSavingMedicalHistory] = useState(false);
  const [savingAllergy, setSavingAllergy] = useState(false);

  // Calculate if pregnancy question should be shown
  const patientAge = patientData?.dateOfBirth ? calculateAge(patientData.dateOfBirth) : null;
  const showPregnancyQuestion =
    patientData?.gender?.toUpperCase() === 'FEMALE' &&
    patientAge !== null &&
    patientAge >= 13 &&
    patientAge <= 51;

  // Fetch patient details for gender/DOB
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!appointment.patient?.id) return;

      setLoadingPatient(true);
      try {
        const response = await patientApi.getById(appointment.patient.id);
        const patient = response.data?.data;
        if (patient) {
          setPatientData({
            gender: patient.gender,
            dateOfBirth: patient.dateOfBirth,
          });
        }
      } catch (error) {
        console.error('Failed to fetch patient data:', error);
      } finally {
        setLoadingPatient(false);
      }
    };

    fetchPatientData();
  }, [appointment.patient?.id]);

  // Fetch patient medical summary (medical history + allergies from MedicalHistory model)
  useEffect(() => {
    const fetchMedicalSummary = async () => {
      if (!appointment.patient?.id) return;

      setLoadingMedicalSummary(true);
      try {
        const response = await opdApi.getPatientMedicalSummary(appointment.patient.id);
        const data = response.data?.data || null;
        setMedicalSummary(data);

        // Populate editable state from fetched data
        if (data) {
          setEditableChronicConditions(data.medicalHistory?.chronicConditions || []);
          setEditableFamilyHistory(data.medicalHistory?.familyHistory || []);
          setEditableAllergies((data.allergies || []).map((a: any) => ({
            id: a.id,
            allergen: a.allergen,
            type: a.type,
            severity: a.severity,
            reaction: a.reaction || '',
            notes: a.notes || '',
          })));

          // Helper to format date to YYYY-MM-DD for date input
          const formatDate = (dateValue: string | Date | null | undefined): string => {
            if (!dateValue) return '';
            try {
              const d = new Date(dateValue);
              if (isNaN(d.getTime())) return '';
              return d.toISOString().split('T')[0];
            } catch { return ''; }
          };

          // Pre-populate past surgeries from detailed records
          if (data.detailedPastSurgeries?.length > 0) {
            setPastSurgeries(data.detailedPastSurgeries.map((s: any) => ({
              id: s.id,
              isExisting: true,
              surgeryName: s.surgeryName || '',
              surgeryDate: formatDate(s.surgeryDate),
              hospitalName: s.hospitalName || '',
              hospitalLocation: s.hospitalLocation || '',
              surgeonName: s.surgeonName || '',
              indication: s.indication || '',
              complications: s.complications || '',
              outcome: s.outcome || '',
              notes: s.notes || '',
            })));
          }

          // Pre-populate immunizations from detailed records
          if (data.detailedImmunizations?.length > 0) {
            setImmunizations(data.detailedImmunizations.map((i: any) => ({
              id: i.id,
              isExisting: true,
              vaccineName: i.vaccineName || '',
              vaccineType: i.vaccineType || '',
              doseNumber: i.doseNumber?.toString() || '',
              dateAdministered: formatDate(i.dateAdministered),
              administeredBy: i.administeredBy || '',
              lotNumber: i.lotNumber || '',
              nextDueDate: formatDate(i.nextDueDate),
              reactions: i.reactions || '',
              notes: i.notes || '',
            })));
          }
        }
      } catch (error) {
        console.error('Failed to fetch patient medical summary:', error);
        setMedicalSummary(null);
      } finally {
        setLoadingMedicalSummary(false);
      }
    };

    fetchMedicalSummary();
  }, [appointment.patient?.id]);

  // Fetch existing vitals and patient status from previous appointments
  useEffect(() => {
    const fetchVitalsData = async () => {
      setLoadingExisting(true);
      try {
        let existingVitals = null;
        let patientStatus = null;

        // Always fetch booking ticket to get patient's booking notes
        const bookingResponse = await opdApi.getBookingTicket(appointment.id);
        const bookingData = bookingResponse.data?.data;

        // Store patient's additional notes from booking (read-only for nurse)
        if (bookingData?.appointment?.notes) {
          setPatientBookingNotes(bookingData.appointment.notes);
        }

        // 1. Get vitals from booking ticket if they exist
        if (appointment.vitalsRecordedAt && bookingData?.vitals) {
          existingVitals = bookingData.vitals;
        }

        // 2. Fetch patient's latest status from Medical History (single source of truth)
        // This will be used if current vitals don't have patient status data
        if (appointment.patient?.id) {
          try {
            const statusResponse = await opdApi.getPatientStatus(appointment.patient.id);
            patientStatus = statusResponse.data?.data;
          } catch (err) {
            // Patient may not have medical history yet, that's okay
            console.log('No patient medical history found');
          }
        }

        // Helper to format date to YYYY-MM-DD for date input
        const formatDateForInput = (dateValue: string | Date | null | undefined): string => {
          if (!dateValue) return '';
          try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
          } catch {
            return '';
          }
        };

        // 3. Merge the data - use current vitals for measurements, but fall back to
        // previous patient status for pregnancy/medications/treatment if not set in current
        // Check each field individually for proper carry-over
        const hasCurrentPregnancy = existingVitals?.isPregnant !== null && existingVitals?.isPregnant !== undefined;
        const hasCurrentMedications = existingVitals?.currentMedications && existingVitals.currentMedications.length > 0;
        const hasCurrentTreatment = existingVitals?.currentTreatment;

        setVitals({
          // Vital measurements from current appointment
          temperature: existingVitals?.temperature?.toString() || '',
          bloodPressureSys: existingVitals?.bloodPressureSys?.toString() || '',
          bloodPressureDia: existingVitals?.bloodPressureDia?.toString() || '',
          heartRate: existingVitals?.heartRate?.toString() || '',
          respiratoryRate: existingVitals?.respiratoryRate?.toString() || '',
          oxygenSaturation: existingVitals?.oxygenSaturation?.toString() || '',
          weight: existingVitals?.weight?.toString() || '',
          height: existingVitals?.height?.toString() || '',
          bloodSugar: existingVitals?.bloodSugar?.toString() || '',
          painLevel: existingVitals?.painLevel?.toString() || '',
          notes: existingVitals?.notes || '',
          // Patient status - check each field individually for carry-over
          isPregnant: hasCurrentPregnancy
            ? existingVitals?.isPregnant
            : patientStatus?.isPregnant ?? undefined,
          expectedDueDate: hasCurrentPregnancy
            ? formatDateForInput(existingVitals?.expectedDueDate)
            : formatDateForInput(patientStatus?.expectedDueDate),
          currentMedications: hasCurrentMedications
            ? (existingVitals?.currentMedications || [])
            : (patientStatus?.currentMedications || []),
          currentTreatment: hasCurrentTreatment
            ? (existingVitals?.currentTreatment || '')
            : (patientStatus?.currentTreatment || ''),
        });
      } catch (error) {
        console.error('Failed to fetch vitals data:', error);
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchVitalsData();
  }, [appointment.id, appointment.vitalsRecordedAt, appointment.patient?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setVitals((prev) => ({ ...prev, [name]: value }));
  };

  // Add medication to list
  const addMedication = () => {
    if (newMedication.name.trim()) {
      setVitals({
        ...vitals,
        currentMedications: [...vitals.currentMedications, { ...newMedication }],
      });
      setNewMedication({ name: '', dosage: '', frequency: '' });
    }
  };

  // Remove medication from list
  const removeMedication = (index: number) => {
    setVitals({
      ...vitals,
      currentMedications: vitals.currentMedications.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all primary vitals are filled
    const missingVitals: string[] = [];
    if (!vitals.temperature) missingVitals.push('Temperature');
    if (!vitals.bloodPressureSys) missingVitals.push('BP Systolic');
    if (!vitals.bloodPressureDia) missingVitals.push('BP Diastolic');
    if (!vitals.heartRate) missingVitals.push('Heart Rate');
    if (!vitals.respiratoryRate) missingVitals.push('Respiratory Rate');
    if (!vitals.oxygenSaturation) missingVitals.push('SpO2');
    if (missingVitals.length > 0) {
      toast.error(`Please fill all primary vitals: ${missingVitals.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const patientId = appointment.patient?.id;

      // Handle deleted existing surgeries
      if (patientId && deletedSurgeryIds.length > 0) {
        await Promise.all(deletedSurgeryIds.map(id =>
          opdApi.deletePastSurgery(patientId, id).catch(err => console.error('Failed to delete surgery:', err))
        ));
      }

      // Handle deleted existing immunizations
      if (patientId && deletedImmunizationIds.length > 0) {
        await Promise.all(deletedImmunizationIds.map(id =>
          opdApi.deleteImmunization(patientId, id).catch(err => console.error('Failed to delete immunization:', err))
        ));
      }

      // Handle updates to existing surgeries
      const existingSurgeries = pastSurgeries.filter(s => s.isExisting && s.id && s.surgeryName.trim());
      if (patientId && existingSurgeries.length > 0) {
        await Promise.all(existingSurgeries.map(s =>
          opdApi.updatePastSurgery(patientId, s.id!, {
            surgeryName: s.surgeryName,
            surgeryDate: s.surgeryDate,
            hospitalName: s.hospitalName,
            hospitalLocation: s.hospitalLocation || undefined,
            surgeonName: s.surgeonName || undefined,
            indication: s.indication || undefined,
            complications: s.complications || undefined,
            outcome: s.outcome || undefined,
            notes: s.notes || undefined,
          }).catch(err => console.error('Failed to update surgery:', err))
        ));
      }

      // Handle updates to existing immunizations
      const existingImmunizations = immunizations.filter(i => i.isExisting && i.id && i.vaccineName.trim());
      if (patientId && existingImmunizations.length > 0) {
        await Promise.all(existingImmunizations.map(i =>
          opdApi.updateImmunization(patientId, i.id!, {
            vaccineName: i.vaccineName,
            vaccineType: i.vaccineType || undefined,
            doseNumber: i.doseNumber ? parseInt(i.doseNumber) : undefined,
            dateAdministered: i.dateAdministered,
            administeredBy: i.administeredBy || undefined,
            lotNumber: i.lotNumber || undefined,
            nextDueDate: i.nextDueDate || undefined,
            reactions: i.reactions || undefined,
            notes: i.notes || undefined,
          }).catch(err => console.error('Failed to update immunization:', err))
        ));
      }

      // Only send NEW (non-existing) surgeries and immunizations via the vitals endpoint
      const newSurgeries = pastSurgeries.filter(s => !s.isExisting && s.surgeryName.trim() && s.surgeryDate);
      const newImmunizations = immunizations.filter(i => !i.isExisting && i.vaccineName.trim() && i.dateAdministered);

      const vitalsData = {
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
        bloodPressureSys: vitals.bloodPressureSys ? parseInt(vitals.bloodPressureSys) : undefined,
        bloodPressureDia: vitals.bloodPressureDia ? parseInt(vitals.bloodPressureDia) : undefined,
        heartRate: vitals.heartRate ? parseInt(vitals.heartRate) : undefined,
        respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate) : undefined,
        oxygenSaturation: vitals.oxygenSaturation ? parseFloat(vitals.oxygenSaturation) : undefined,
        weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
        height: vitals.height ? parseFloat(vitals.height) : undefined,
        bloodSugar: vitals.bloodSugar ? parseFloat(vitals.bloodSugar) : undefined,
        painLevel: vitals.painLevel ? parseInt(vitals.painLevel) : undefined,
        notes: vitals.notes || undefined,
        isPregnant: vitals.isPregnant,
        expectedDueDate: vitals.expectedDueDate || undefined,
        currentMedications: vitals.currentMedications.length > 0 ? vitals.currentMedications : undefined,
        currentTreatment: vitals.currentTreatment || undefined,
        pastSurgeries: newSurgeries.length > 0 ? newSurgeries.map(s => ({
          surgeryName: s.surgeryName,
          surgeryDate: s.surgeryDate,
          hospitalName: s.hospitalName,
          hospitalLocation: s.hospitalLocation || undefined,
          surgeonName: s.surgeonName || undefined,
          indication: s.indication || undefined,
          complications: s.complications || undefined,
          outcome: s.outcome || undefined,
          notes: s.notes || undefined,
        })) : undefined,
        immunizations: newImmunizations.length > 0 ? newImmunizations.map(i => ({
          vaccineName: i.vaccineName,
          vaccineType: i.vaccineType || undefined,
          doseNumber: i.doseNumber ? parseInt(i.doseNumber) : undefined,
          dateAdministered: i.dateAdministered,
          administeredBy: i.administeredBy || undefined,
          lotNumber: i.lotNumber || undefined,
          nextDueDate: i.nextDueDate || undefined,
          reactions: i.reactions || undefined,
          notes: i.notes || undefined,
        })) : undefined,
      };

      const response = await opdApi.recordVitals(appointment.id, vitalsData);

      // Safely extract and validate risk assessment data
      const responseData = response?.data?.data;
      const riskData = responseData?.riskAssessment;

      // Validate that riskData has the required structure before displaying
      const isValidRiskData = riskData &&
        typeof riskData === 'object' &&
        riskData.news2Score !== undefined &&
        riskData.riskLevel !== undefined;

      if (isValidRiskData) {
        // Ensure recommendedActions is always an array
        const sanitizedRiskData = {
          ...riskData,
          news2Score: Number(riskData.news2Score) || 0,
          riskLevel: String(riskData.riskLevel || 'LOW').toUpperCase(),
          deteriorationProbability: typeof riskData.deteriorationProbability === 'number'
            ? riskData.deteriorationProbability
            : undefined,
          sepsisRisk: riskData.sepsisRisk,
          fallRisk: riskData.fallRisk,
          recommendedActions: Array.isArray(riskData.recommendedActions)
            ? riskData.recommendedActions
            : [],
          escalationRequired: Boolean(riskData.escalationRequired),
        };

        setRiskAssessment(sanitizedRiskData);
        setShowRiskAssessment(true);
        toast.success('Vitals recorded - AI risk assessment generated');
      } else {
        // No valid risk assessment, just close
        toast.success('Vitals recorded successfully');
        onSuccess();
      }
    } catch (error: any) {
      console.error('Failed to record vitals:', error);
      toast.error(error?.response?.data?.message || 'Failed to record vitals');
    } finally {
      setLoading(false);
    }
  };

  // Handle continuing after viewing risk assessment
  const handleContinueAfterRiskAssessment = () => {
    setShowRiskAssessment(false);
    onSuccess();
  };

  // Medical history helpers
  const addPastSurgery = () => {
    setPastSurgeries([...pastSurgeries, {
      surgeryName: '',
      surgeryDate: '',
      hospitalName: '',
      hospitalLocation: '',
      surgeonName: '',
      indication: '',
      complications: '',
      outcome: '',
      notes: '',
    }]);
  };

  const removePastSurgery = (index: number) => {
    const surgery = pastSurgeries[index];
    if (surgery.isExisting && surgery.id) {
      setDeletedSurgeryIds(prev => [...prev, surgery.id!]);
    }
    setPastSurgeries(pastSurgeries.filter((_, i) => i !== index));
  };

  const updatePastSurgery = (index: number, field: string, value: string) => {
    const updated = [...pastSurgeries];
    updated[index] = { ...updated[index], [field]: value };
    setPastSurgeries(updated);
  };

  const addImmunization = () => {
    setImmunizations([...immunizations, {
      vaccineName: '',
      vaccineType: '',
      doseNumber: '',
      dateAdministered: '',
      administeredBy: '',
      lotNumber: '',
      nextDueDate: '',
      reactions: '',
      notes: '',
    }]);
  };

  const removeImmunization = (index: number) => {
    const imm = immunizations[index];
    if (imm.isExisting && imm.id) {
      setDeletedImmunizationIds(prev => [...prev, imm.id!]);
    }
    setImmunizations(immunizations.filter((_, i) => i !== index));
  };

  const updateImmunization = (index: number, field: string, value: string) => {
    const updated = [...immunizations];
    updated[index] = { ...updated[index], [field]: value };
    setImmunizations(updated);
  };

  // Editable medical records handlers
  const addChronicCondition = () => {
    if (newConditionInput.trim()) {
      setEditableChronicConditions(prev => [...prev, newConditionInput.trim()]);
      setNewConditionInput('');
    }
  };

  const removeChronicCondition = (index: number) => {
    setEditableChronicConditions(prev => prev.filter((_, i) => i !== index));
  };

  const addFamilyHistory = () => {
    if (newFamilyHistoryInput.trim()) {
      setEditableFamilyHistory(prev => [...prev, newFamilyHistoryInput.trim()]);
      setNewFamilyHistoryInput('');
    }
  };

  const removeFamilyHistory = (index: number) => {
    setEditableFamilyHistory(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveMedicalHistory = async () => {
    if (!appointment.patient?.id) return;
    setSavingMedicalHistory(true);
    try {
      await opdApi.updatePatientMedicalHistory(appointment.patient.id, {
        chronicConditions: editableChronicConditions,
        familyHistory: editableFamilyHistory,
      });
      toast.success('Medical history saved');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save medical history');
    } finally {
      setSavingMedicalHistory(false);
    }
  };

  const handleAddAllergy = async () => {
    if (!appointment.patient?.id || !newAllergy.allergen.trim()) return;
    setSavingAllergy(true);
    try {
      const response = await opdApi.addPatientAllergy(appointment.patient.id, {
        allergen: newAllergy.allergen,
        type: newAllergy.type,
        severity: newAllergy.severity,
        reaction: newAllergy.reaction || undefined,
        notes: newAllergy.notes || undefined,
      });
      const created = response.data?.data;
      if (created) {
        setEditableAllergies(prev => [...prev, {
          id: created.id,
          allergen: created.allergen,
          type: created.type,
          severity: created.severity,
          reaction: created.reaction || '',
          notes: created.notes || '',
        }]);
      }
      setNewAllergy({ allergen: '', type: 'OTHER', severity: 'MILD', reaction: '', notes: '' });
      setShowAddAllergyForm(false);
      toast.success('Allergy added');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to add allergy');
    } finally {
      setSavingAllergy(false);
    }
  };

  const handleUpdateAllergy = async (index: number) => {
    const allergy = editableAllergies[index];
    if (!appointment.patient?.id || !allergy.id) return;
    setSavingAllergy(true);
    try {
      await opdApi.updatePatientAllergy(appointment.patient.id, allergy.id, {
        allergen: allergy.allergen,
        type: allergy.type,
        severity: allergy.severity,
        reaction: allergy.reaction || undefined,
        notes: allergy.notes || undefined,
      });
      const updated = [...editableAllergies];
      updated[index] = { ...updated[index], isEditing: false };
      setEditableAllergies(updated);
      toast.success('Allergy updated');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update allergy');
    } finally {
      setSavingAllergy(false);
    }
  };

  const handleDeleteAllergy = async (index: number) => {
    const allergy = editableAllergies[index];
    if (!appointment.patient?.id || !allergy.id) return;
    setSavingAllergy(true);
    try {
      await opdApi.deletePatientAllergy(appointment.patient.id, allergy.id);
      setEditableAllergies(prev => prev.filter((_, i) => i !== index));
      toast.success('Allergy deleted');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete allergy');
    } finally {
      setSavingAllergy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <HeartIcon className="h-6 w-6" />
                  {appointment.vitalsRecordedAt ? 'Update' : 'Record'} Pre-Consultation Vitals
                </h2>
                <div className="text-white/90 text-sm mt-1 space-y-0.5">
                  <p className="font-medium">
                    {appointment.patient?.firstName} {appointment.patient?.lastName}
                  </p>
                  <p className="text-white/70 text-xs flex flex-wrap gap-x-3">
                    <span>Booking ID: {appointment.id.slice(0, 8)}...</span>
                    <span>Patient ID: {appointment.patient?.id?.slice(0, 8)}...</span>
                    {appointment.patient?.mrn && <span>MRN: {appointment.patient.mrn}</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto overflow-x-hidden">
            {/* Loading indicator when fetching existing vitals */}
            {loadingExisting && (
              <div className="flex items-center justify-center py-4 text-gray-500">
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                Loading existing vitals...
              </div>
            )}

            {/* Update notice */}
            {appointment.vitalsRecordedAt && !loadingExisting && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <HeartIconSolid className="h-5 w-5 text-amber-500" />
                <span>
                  Vitals previously recorded at{' '}
                  {new Date(appointment.vitalsRecordedAt).toLocaleTimeString()}
                  . You are updating existing values.
                </span>
              </div>
            )}

            {/* Primary Vitals */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-rose-500 rounded-full" />
                Primary Vitals
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Temperature (°C) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="temperature"
                    value={vitals.temperature}
                    onChange={handleChange}
                    step="0.1"
                    min="32"
                    max="42"
                    placeholder="37.0"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    BP Systolic (mmHg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="bloodPressureSys"
                    value={vitals.bloodPressureSys}
                    onChange={handleChange}
                    min="60"
                    max="250"
                    placeholder="120"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    BP Diastolic (mmHg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="bloodPressureDia"
                    value={vitals.bloodPressureDia}
                    onChange={handleChange}
                    min="40"
                    max="150"
                    placeholder="80"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Heart Rate (bpm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="heartRate"
                    value={vitals.heartRate}
                    onChange={handleChange}
                    min="30"
                    max="220"
                    placeholder="72"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Resp. Rate (/min) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="respiratoryRate"
                    value={vitals.respiratoryRate}
                    onChange={handleChange}
                    min="8"
                    max="40"
                    placeholder="16"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    SpO2 (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="oxygenSaturation"
                    value={vitals.oxygenSaturation}
                    onChange={handleChange}
                    step="0.1"
                    min="70"
                    max="100"
                    placeholder="98"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Patient Medical Records (Editable) */}
            {!loadingMedicalSummary && medicalSummary && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5" />
                  Patient Medical Records
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-normal">Editable</span>
                </h3>

                {/* Allergies - Safety-critical, immediate save */}
                <div className="mb-3 p-2.5 bg-red-100 border border-red-300 rounded-lg">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-red-700 uppercase font-semibold flex items-center gap-1">
                      <ExclamationTriangleIcon className="h-4 w-4" /> Allergies
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddAllergyForm(!showAddAllergyForm)}
                      className="flex items-center gap-1 px-2 py-0.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
                    >
                      <PlusIcon className="h-3 w-3" /> Add
                    </button>
                  </div>

                  {editableAllergies.length === 0 && !showAddAllergyForm && (
                    <p className="text-xs text-red-600 italic">No known allergies recorded.</p>
                  )}

                  {editableAllergies.map((allergy, i) => (
                    <div key={allergy.id} className="mb-1.5">
                      {allergy.isEditing ? (
                        <div className="bg-white p-2 rounded border border-red-200 space-y-1.5">
                          <div className="grid grid-cols-3 gap-1.5">
                            <input type="text" value={allergy.allergen} placeholder="Allergen"
                              onChange={(e) => { const u = [...editableAllergies]; u[i] = { ...u[i], allergen: e.target.value }; setEditableAllergies(u); }}
                              className="px-2 py-1 border border-gray-300 rounded text-sm" />
                            <select value={allergy.type}
                              onChange={(e) => { const u = [...editableAllergies]; u[i] = { ...u[i], type: e.target.value }; setEditableAllergies(u); }}
                              className="px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="DRUG">Drug</option><option value="FOOD">Food</option>
                              <option value="ENVIRONMENTAL">Environmental</option><option value="OTHER">Other</option>
                            </select>
                            <select value={allergy.severity}
                              onChange={(e) => { const u = [...editableAllergies]; u[i] = { ...u[i], severity: e.target.value }; setEditableAllergies(u); }}
                              className="px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="MILD">Mild</option><option value="MODERATE">Moderate</option>
                              <option value="SEVERE">Severe</option><option value="LIFE_THREATENING">Life-threatening</option>
                            </select>
                          </div>
                          <input type="text" value={allergy.reaction} placeholder="Reaction"
                            onChange={(e) => { const u = [...editableAllergies]; u[i] = { ...u[i], reaction: e.target.value }; setEditableAllergies(u); }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                          <div className="flex gap-1.5">
                            <button type="button" onClick={() => handleUpdateAllergy(i)} disabled={savingAllergy}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">Save</button>
                            <button type="button" onClick={() => { const u = [...editableAllergies]; u[i] = { ...u[i], isEditing: false }; setEditableAllergies(u); }}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 bg-red-200 text-red-900 rounded text-sm font-medium flex-1">
                            {allergy.allergen} ({allergy.severity.replace('_', ' ')})
                            {allergy.reaction && <span className="text-red-700 text-xs ml-1">- {allergy.reaction}</span>}
                          </span>
                          <button type="button" onClick={() => { const u = [...editableAllergies]; u[i] = { ...u[i], isEditing: true }; setEditableAllergies(u); }}
                            className="p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded transition-colors">
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteAllergy(i)} disabled={savingAllergy}
                            className="p-0.5 text-red-600 hover:text-red-800 hover:bg-red-200 rounded transition-colors disabled:opacity-50">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {showAddAllergyForm && (
                    <div className="bg-white p-2 rounded border border-red-200 mt-1.5 space-y-1.5">
                      <div className="grid grid-cols-3 gap-1.5">
                        <input type="text" value={newAllergy.allergen} placeholder="Allergen *"
                          onChange={(e) => setNewAllergy({ ...newAllergy, allergen: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm" />
                        <select value={newAllergy.type} onChange={(e) => setNewAllergy({ ...newAllergy, type: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm">
                          <option value="DRUG">Drug</option><option value="FOOD">Food</option>
                          <option value="ENVIRONMENTAL">Environmental</option><option value="OTHER">Other</option>
                        </select>
                        <select value={newAllergy.severity} onChange={(e) => setNewAllergy({ ...newAllergy, severity: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm">
                          <option value="MILD">Mild</option><option value="MODERATE">Moderate</option>
                          <option value="SEVERE">Severe</option><option value="LIFE_THREATENING">Life-threatening</option>
                        </select>
                      </div>
                      <input type="text" value={newAllergy.reaction} placeholder="Reaction (optional)"
                        onChange={(e) => setNewAllergy({ ...newAllergy, reaction: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                      <div className="flex gap-1.5">
                        <button type="button" onClick={handleAddAllergy} disabled={savingAllergy || !newAllergy.allergen.trim()}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50">
                          {savingAllergy ? 'Saving...' : 'Save Allergy'}
                        </button>
                        <button type="button" onClick={() => setShowAddAllergyForm(false)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chronic Conditions - Editable pills */}
                <div className="mb-3">
                  <span className="text-xs text-gray-500 uppercase font-medium">Chronic Conditions</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {editableChronicConditions.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-sm">
                        {c}
                        <button type="button" onClick={() => removeChronicCondition(i)}
                          className="text-rose-500 hover:text-rose-700"><XMarkIcon className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-1.5">
                    <input type="text" value={newConditionInput} placeholder="Add condition..."
                      onChange={(e) => setNewConditionInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChronicCondition(); } }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                    <button type="button" onClick={addChronicCondition} disabled={!newConditionInput.trim()}
                      className="px-2 py-1 bg-rose-600 text-white rounded text-xs hover:bg-rose-700 disabled:opacity-50">Add</button>
                  </div>
                </div>

                {/* Family History - Editable pills */}
                <div className="mb-3">
                  <span className="text-xs text-gray-500 uppercase font-medium">Family History</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {editableFamilyHistory.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-sm">
                        {f}
                        <button type="button" onClick={() => removeFamilyHistory(i)}
                          className="text-amber-500 hover:text-amber-700"><XMarkIcon className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-1.5">
                    <input type="text" value={newFamilyHistoryInput} placeholder="Add family history..."
                      onChange={(e) => setNewFamilyHistoryInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFamilyHistory(); } }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                    <button type="button" onClick={addFamilyHistory} disabled={!newFamilyHistoryInput.trim()}
                      className="px-2 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 disabled:opacity-50">Add</button>
                  </div>
                </div>

                {/* Save Medical History button (batch save for conditions + family history) */}
                <button type="button" onClick={handleSaveMedicalHistory} disabled={savingMedicalHistory}
                  className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 mb-3">
                  {savingMedicalHistory ? (
                    <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><CheckCircleIcon className="h-4 w-4" /> Save Medical History Changes</>
                  )}
                </button>

                {/* Past Surgeries summary */}
                {medicalSummary.medicalHistory?.pastSurgeries?.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs text-gray-500 uppercase font-medium">Past Surgeries (from summary)</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {medicalSummary.medicalHistory.pastSurgeries.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm">{s}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 italic">Edit detailed surgery records in the "Detailed Medical History" section below.</p>
                  </div>
                )}

                {/* Ongoing Treatment from MedicalHistory */}
                {medicalSummary.medicalHistory?.currentTreatment && (
                  <div className="mb-3">
                    <span className="text-xs text-gray-500 uppercase font-medium">Ongoing Treatment</span>
                    <p className="mt-1 text-sm text-gray-700 bg-cyan-50 px-2 py-1 rounded">
                      {medicalSummary.medicalHistory.currentTreatment}
                    </p>
                  </div>
                )}

                {/* Patient Medications from MedicalHistory */}
                {medicalSummary.medicalHistory?.currentMedications?.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs text-gray-500 uppercase font-medium">Current Medications (from Medical History)</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {medicalSummary.medicalHistory.currentMedications.map((m, i) => (
                        <span key={i} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-sm">{m}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pregnancy Status from MedicalHistory */}
                {medicalSummary.medicalHistory?.isPregnant === true && (
                  <div className="p-2 bg-pink-100 border border-pink-300 rounded-lg">
                    <div className="flex items-center gap-2 text-pink-800">
                      <span className="font-medium text-sm">Patient is Pregnant</span>
                      {medicalSummary.medicalHistory.expectedDueDate && (
                        <span className="text-xs text-pink-600">
                          (Due: {new Date(medicalSummary.medicalHistory.expectedDueDate).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Body Measurements */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Body Measurements
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    name="weight"
                    value={vitals.weight}
                    onChange={handleChange}
                    step="0.1"
                    min="1"
                    max="500"
                    placeholder="70"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    name="height"
                    value={vitals.height}
                    onChange={handleChange}
                    step="0.1"
                    min="30"
                    max="250"
                    placeholder="170"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Blood Sugar (mg/dL)
                  </label>
                  <input
                    type="number"
                    name="bloodSugar"
                    value={vitals.bloodSugar}
                    onChange={handleChange}
                    step="0.1"
                    min="20"
                    max="600"
                    placeholder="100"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Pain Level (0-10)
                  </label>
                  <input
                    type="number"
                    name="painLevel"
                    value={vitals.painLevel}
                    onChange={handleChange}
                    min="0"
                    max="10"
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Patient Details Section - Pregnancy, Medications, Treatment */}
            <div className="p-4 bg-pink-50 rounded-xl border border-pink-200">
              <h3 className="text-sm font-semibold text-pink-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-pink-500 rounded-full" />
                Patient Details
              </h3>

              {/* Loading indicator */}
              {loadingPatient && (
                <div className="flex items-center justify-center py-2 text-gray-500 text-sm">
                  <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                  Loading patient info...
                </div>
              )}

              {/* Pregnancy Check - Female aged 13-51 only */}
              {showPregnancyQuestion && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Is the patient pregnant? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    <label className={clsx(
                      'flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 transition-colors text-sm',
                      vitals.isPregnant === true ? 'bg-pink-100 border-pink-500 text-pink-700' : 'bg-white border-gray-200 hover:border-gray-300'
                    )}>
                      <input
                        type="radio"
                        name="pregnancy"
                        checked={vitals.isPregnant === true}
                        onChange={() => setVitals({ ...vitals, isPregnant: true })}
                        className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                      />
                      <span className="font-medium">Yes</span>
                    </label>
                    <label className={clsx(
                      'flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 transition-colors text-sm',
                      vitals.isPregnant === false ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-gray-200 hover:border-gray-300'
                    )}>
                      <input
                        type="radio"
                        name="pregnancy"
                        checked={vitals.isPregnant === false}
                        onChange={() => setVitals({ ...vitals, isPregnant: false, expectedDueDate: '' })}
                        className="w-4 h-4 text-green-600 focus:ring-green-500"
                      />
                      <span className="font-medium">No</span>
                    </label>
                  </div>

                  {/* Expected Due Date - shown only if pregnant */}
                  {vitals.isPregnant === true && (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Expected Due Date <span className="text-gray-400">(optional, max 42 weeks from today)</span>
                      </label>
                      <input
                        type="date"
                        value={vitals.expectedDueDate}
                        onChange={(e) => setVitals({ ...vitals, expectedDueDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        max={new Date(Date.now() + 294 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Due date must be within 42 weeks (9 months + 2 weeks) from today
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Current Medications */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Current Medications <span className="text-gray-400">(optional)</span>
                </label>

                {/* Medications List */}
                {vitals.currentMedications.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {vitals.currentMedications.map((med, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                        <div className="flex-1 text-sm">
                          <span className="font-medium text-gray-900">{med.name}</span>
                          {med.dosage && <span className="text-gray-600 ml-2">{med.dosage}</span>}
                          {med.frequency && <span className="text-gray-500 ml-2">({med.frequency})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMedication(index)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Medication */}
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-[120px]">
                    <input
                      type="text"
                      placeholder="Medication name"
                      value={newMedication.name}
                      onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="text"
                      placeholder="Dosage"
                      value={newMedication.dosage}
                      onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="text"
                      placeholder="Frequency"
                      value={newMedication.frequency}
                      onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addMedication}
                    disabled={!newMedication.name.trim()}
                    className="flex items-center gap-1 px-3 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              {/* Current Treatment */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Current Treatment / Ongoing Conditions <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={vitals.currentTreatment}
                  onChange={(e) => setVitals({ ...vitals, currentTreatment: e.target.value })}
                  placeholder="e.g., Undergoing chemotherapy, Dialysis 3x/week, Post-surgery recovery..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm resize-none"
                />
              </div>
            </div>

            {/* Patient's Booking Notes (Read-only) */}
            {patientBookingNotes && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <label className="block text-xs font-medium text-blue-700 mb-1">
                  Patient's Notes from Booking
                </label>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {patientBookingNotes}
                </div>
              </div>
            )}

            {/* Detailed Medical History (First Consultation) */}
            <div className="border border-purple-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMedicalHistory(!showMedicalHistory)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold text-purple-900">
                    Detailed Medical History
                  </span>
                  <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                    First Visit Collection
                  </span>
                </div>
                <span className="text-purple-600">
                  {showMedicalHistory ? '▼' : '▶'}
                </span>
              </button>

              {showMedicalHistory && (
                <div className="p-4 space-y-4 bg-white">
                  {/* Past Surgeries Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Past Surgeries <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={addPastSurgery}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Surgery
                      </button>
                    </div>

                    {pastSurgeries.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-3 bg-gray-50 rounded-lg">
                        No past surgeries recorded. Click "Add Surgery" to enter details.
                      </p>
                    )}

                    {pastSurgeries.map((surgery, index) => (
                      <div key={surgery.id || index} className="p-4 mb-3 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">Surgery #{index + 1}</span>
                            {surgery.isExisting ? (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">From patient records</span>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">New</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removePastSurgery(index)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Surgery Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., Appendectomy, Cesarean Section"
                              value={surgery.surgeryName}
                              onChange={(e) => updatePastSurgery(index, 'surgeryName', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Date <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={surgery.surgeryDate}
                              onChange={(e) => updatePastSurgery(index, 'surgeryDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Hospital Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Hospital name"
                              value={surgery.hospitalName}
                              onChange={(e) => updatePastSurgery(index, 'hospitalName', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Location (City/Country)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., Dubai, UAE"
                              value={surgery.hospitalLocation}
                              onChange={(e) => updatePastSurgery(index, 'hospitalLocation', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Surgeon Name
                            </label>
                            <input
                              type="text"
                              placeholder="Dr. name"
                              value={surgery.surgeonName}
                              onChange={(e) => updatePastSurgery(index, 'surgeonName', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Complications / Outcome
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., Successful, no complications"
                              value={surgery.complications}
                              onChange={(e) => updatePastSurgery(index, 'complications', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Immunizations Section */}
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Immunization Records <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={addImmunization}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Vaccine
                      </button>
                    </div>

                    {immunizations.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-3 bg-gray-50 rounded-lg">
                        No immunizations recorded. Click "Add Vaccine" to enter details.
                      </p>
                    )}

                    {immunizations.map((immunization, index) => (
                      <div key={immunization.id || index} className="p-4 mb-3 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">Vaccine #{index + 1}</span>
                            {immunization.isExisting ? (
                              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">From patient records</span>
                            ) : (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">New</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImmunization(index)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Vaccine Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., COVID-19, MMR, Hepatitis B"
                              value={immunization.vaccineName}
                              onChange={(e) => updateImmunization(index, 'vaccineName', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Brand/Type
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., Pfizer-BioNTech"
                              value={immunization.vaccineType}
                              onChange={(e) => updateImmunization(index, 'vaccineType', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Date Administered <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              value={immunization.dateAdministered}
                              onChange={(e) => updateImmunization(index, 'dateAdministered', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Dose Number
                            </label>
                            <input
                              type="number"
                              placeholder="1, 2, 3..."
                              value={immunization.doseNumber}
                              onChange={(e) => updateImmunization(index, 'doseNumber', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Healthcare Provider/Clinic
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., City Health Clinic"
                              value={immunization.administeredBy}
                              onChange={(e) => updateImmunization(index, 'administeredBy', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Lot Number
                            </label>
                            <input
                              type="text"
                              placeholder="For tracking"
                              value={immunization.lotNumber}
                              onChange={(e) => updateImmunization(index, 'lotNumber', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Next Due Date
                            </label>
                            <input
                              type="date"
                              value={immunization.nextDueDate}
                              onChange={(e) => updateImmunization(index, 'nextDueDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 italic">
                    💡 Tip: This detailed medical history is typically collected during the first consultation.
                    You can skip this section for repeat visits.
                  </p>
                </div>
              )}
            </div>

            {/* Nurse Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nurse Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={vitals.notes}
                onChange={handleChange}
                placeholder="Any additional observations from nurse assessment..."
                rows={2}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500/50 focus:border-gray-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold hover:from-rose-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-5 w-5" />
                    Save Vitals
                  </>
                )}
              </button>
            </div>
          </form>

          {/* AI Risk Assessment Display */}
          {showRiskAssessment && riskAssessment && (
            <div className="absolute inset-0 bg-white z-10 flex flex-col">
              {/* Risk Assessment Header */}
              <div className={clsx(
                'px-6 py-4',
                riskAssessment.riskLevel === 'CRITICAL' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                riskAssessment.riskLevel === 'HIGH' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                riskAssessment.riskLevel === 'MODERATE' ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                'bg-gradient-to-r from-emerald-500 to-emerald-600'
              )}>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <SparklesIcon className="h-6 w-6" />
                  AI Risk Assessment
                </h2>
                <p className="text-white/90 text-sm mt-1">
                  Early Warning Score Analysis for {appointment.patient?.firstName} {appointment.patient?.lastName}
                </p>
              </div>

              {/* Risk Assessment Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Main Score Card */}
                <div className={clsx(
                  'rounded-2xl p-6 border-2',
                  riskAssessment.riskLevel === 'CRITICAL' ? 'bg-red-50 border-red-200' :
                  riskAssessment.riskLevel === 'HIGH' ? 'bg-orange-50 border-orange-200' :
                  riskAssessment.riskLevel === 'MODERATE' ? 'bg-amber-50 border-amber-200' :
                  'bg-emerald-50 border-emerald-200'
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">NEWS2 Score</h3>
                      <p className="text-sm text-gray-600">National Early Warning Score</p>
                    </div>
                    <div className={clsx(
                      'text-5xl font-bold',
                      riskAssessment.riskLevel === 'CRITICAL' ? 'text-red-600' :
                      riskAssessment.riskLevel === 'HIGH' ? 'text-orange-600' :
                      riskAssessment.riskLevel === 'MODERATE' ? 'text-amber-600' :
                      'text-emerald-600'
                    )}>
                      {riskAssessment.news2Score || 0}
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className={clsx(
                      'inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold',
                      riskAssessment.riskLevel === 'CRITICAL' ? 'bg-red-200 text-red-800' :
                      riskAssessment.riskLevel === 'HIGH' ? 'bg-orange-200 text-orange-800' :
                      riskAssessment.riskLevel === 'MODERATE' ? 'bg-amber-200 text-amber-800' :
                      'bg-emerald-200 text-emerald-800'
                    )}>
                      {riskAssessment.riskLevel} Risk
                    </span>
                  </div>
                </div>

                {/* Escalation Warning */}
                {riskAssessment.escalationRequired && (
                  <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
                    <ExclamationCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-800">Escalation Required</h4>
                      <p className="text-sm text-red-700 mt-1">
                        This patient requires immediate clinical escalation. Please notify the senior medical team.
                      </p>
                    </div>
                  </div>
                )}

                {/* Additional Scores Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {riskAssessment.deteriorationProbability !== undefined && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-600">Deterioration Risk</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(riskAssessment.deteriorationProbability * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                  {riskAssessment.sepsisRisk !== undefined && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-600">Sepsis Risk (qSOFA)</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {typeof riskAssessment.sepsisRisk === 'number'
                          ? `${(riskAssessment.sepsisRisk * 100).toFixed(1)}%`
                          : typeof riskAssessment.sepsisRisk === 'object' && riskAssessment.sepsisRisk !== null
                            ? riskAssessment.sepsisRisk.riskLevel || `${((riskAssessment.sepsisRisk.probability || 0) * 100).toFixed(1)}%`
                            : String(riskAssessment.sepsisRisk || 'N/A')}
                      </p>
                    </div>
                  )}
                  {riskAssessment.fallRisk !== undefined && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-600">Fall Risk</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {typeof riskAssessment.fallRisk === 'number'
                          ? `${(riskAssessment.fallRisk * 100).toFixed(1)}%`
                          : typeof riskAssessment.fallRisk === 'object' && riskAssessment.fallRisk !== null
                            ? riskAssessment.fallRisk.riskLevel || 'N/A'
                            : String(riskAssessment.fallRisk || 'N/A')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                {riskAssessment.recommendedActions && riskAssessment.recommendedActions.length > 0 && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <ClipboardDocumentListIcon className="h-5 w-5" />
                      Recommended Actions
                    </h4>
                    <ul className="space-y-2">
                      {riskAssessment.recommendedActions.map((action: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                          <CheckCircleIcon className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Continue Button */}
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={handleContinueAfterRiskAssessment}
                  className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

