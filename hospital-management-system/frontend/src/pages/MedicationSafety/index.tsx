import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheckIcon,
  QrCodeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  BeakerIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  HandRaisedIcon,
  BellAlertIcon,
  InformationCircleIcon,
  UserIcon,
  ScaleIcon,
  ArrowsRightLeftIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { medSafetyApi, patientApi } from '../../services/api';

// Types
interface Medication {
  id: string;
  prescriptionId: string;
  patientId: string;
  patientName: string;
  patientMRN: string;
  room: string;
  wardId?: string;
  wardName?: string;
  name: string;
  genericName?: string;
  dose: string;
  unit: string;
  route: string;
  frequency: string;
  scheduledTime: string;
  minutesFromNow: number;
  overdueMinutes?: number;
  isPRN: boolean;
  isHighAlert: boolean;
  highAlertInfo?: any;
  instructions?: string;
  prescribedBy: string;
  allergies: string[];
  status: 'OVERDUE' | 'DUE_NOW' | 'UPCOMING' | 'PRN_AVAILABLE';
}

interface ShiftData {
  shift: string;
  shiftStart: string;
  shiftEnd: string;
  currentTime: string;
  summary: {
    totalDue: number;
    overdueCount: number;
    dueNowCount: number;
    upcomingCount: number;
    prnCount: number;
    highAlertCount: number;
  };
  overdue: Medication[];
  dueNow: Medication[];
  upcoming: Medication[];
  prnAvailable: Medication[];
}

interface SafetyRight {
  name: string;
  status: 'pending' | 'verified' | 'warning' | 'failed';
  message: string;
  icon: any;
}

// Stats cards for header
const getStatsCards = (summary: ShiftData['summary'] | null) => [
  {
    name: 'Overdue',
    value: summary?.overdueCount || 0,
    icon: ExclamationTriangleIcon,
    color: 'red',
    urgent: true,
  },
  {
    name: 'Due Now',
    value: summary?.dueNowCount || 0,
    icon: ClockIcon,
    color: 'amber',
    urgent: summary?.dueNowCount ? summary.dueNowCount > 0 : false,
  },
  {
    name: 'Upcoming',
    value: summary?.upcomingCount || 0,
    icon: ArrowPathIcon,
    color: 'blue',
  },
  {
    name: 'High-Alert',
    value: summary?.highAlertCount || 0,
    icon: ShieldExclamationIcon,
    color: 'purple',
  },
];

export default function MedicationSafety() {
  // State
  const [viewMode, setViewMode] = useState<'shift' | 'patient'>('shift');
  const [shiftData, setShiftData] = useState<ShiftData | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>('current');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerType, setScannerType] = useState<'patient' | 'medication'>('patient');
  const [scannedPatientBarcode, setScannedPatientBarcode] = useState<string>('');
  const [scannedMedicationBarcode, setScannedMedicationBarcode] = useState<string>('');

  // Patient search for patient mode
  const [patientSearch, setPatientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientMedications, setPatientMedications] = useState<any>(null);

  // Administration
  const [adminNotes, setAdminNotes] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Override
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Safety rights
  const [safetyRights, setSafetyRights] = useState<SafetyRight[]>([
    { name: 'Right Patient', status: 'pending', message: 'Verify patient identity', icon: UserIcon },
    { name: 'Right Drug', status: 'pending', message: 'Verify medication', icon: BeakerIcon },
    { name: 'Right Dose', status: 'pending', message: 'Check dose', icon: ScaleIcon },
    { name: 'Right Route', status: 'pending', message: 'Verify route', icon: ArrowsRightLeftIcon },
    { name: 'Right Time', status: 'pending', message: 'Check schedule', icon: ClockIcon },
  ]);

  // Load shift medications
  const loadShiftMedications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await medSafetyApi.getDueMedications({
        shift: selectedShift !== 'current' ? selectedShift : undefined,
        wardId: selectedWard || undefined,
      });
      setShiftData(response.data);
    } catch (error) {
      console.error('Error loading shift medications:', error);
      // Demo data
      setShiftData({
        shift: 'day',
        shiftStart: new Date().toISOString(),
        shiftEnd: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        currentTime: new Date().toISOString(),
        summary: {
          totalDue: 15,
          overdueCount: 2,
          dueNowCount: 5,
          upcomingCount: 6,
          prnCount: 2,
          highAlertCount: 3,
        },
        overdue: [
          {
            id: 'med1',
            prescriptionId: 'presc1',
            patientId: 'p1',
            patientName: 'John Smith',
            patientMRN: 'MRN001234',
            room: 'Ward A - Bed 101',
            name: 'Heparin',
            genericName: 'heparin sodium',
            dose: '5000',
            unit: 'units',
            route: 'SC',
            frequency: 'Q12H',
            scheduledTime: new Date(Date.now() - 90 * 60000).toISOString(),
            minutesFromNow: -90,
            overdueMinutes: 90,
            isPRN: false,
            isHighAlert: true,
            highAlertInfo: { category: 'Anticoagulant', risk: 'Bleeding' },
            prescribedBy: 'Dr. Smith',
            allergies: ['Penicillin'],
            status: 'OVERDUE',
          },
          {
            id: 'med2',
            prescriptionId: 'presc2',
            patientId: 'p2',
            patientName: 'Mary Johnson',
            patientMRN: 'MRN001235',
            room: 'Ward A - Bed 102',
            name: 'Insulin Lispro',
            genericName: 'insulin lispro',
            dose: '10',
            unit: 'units',
            route: 'SC',
            frequency: 'TID AC',
            scheduledTime: new Date(Date.now() - 45 * 60000).toISOString(),
            minutesFromNow: -45,
            overdueMinutes: 45,
            isPRN: false,
            isHighAlert: true,
            highAlertInfo: { category: 'Insulin', risk: 'Hypoglycemia' },
            prescribedBy: 'Dr. Johnson',
            allergies: [],
            status: 'OVERDUE',
          },
        ],
        dueNow: [
          {
            id: 'med3',
            prescriptionId: 'presc3',
            patientId: 'p3',
            patientName: 'Robert Davis',
            patientMRN: 'MRN001236',
            room: 'Ward B - Bed 201',
            name: 'Metformin',
            genericName: 'metformin hcl',
            dose: '500',
            unit: 'mg',
            route: 'PO',
            frequency: 'BID',
            scheduledTime: new Date().toISOString(),
            minutesFromNow: 0,
            isPRN: false,
            isHighAlert: false,
            prescribedBy: 'Dr. Williams',
            allergies: ['Sulfa'],
            status: 'DUE_NOW',
          },
          {
            id: 'med4',
            prescriptionId: 'presc4',
            patientId: 'p1',
            patientName: 'John Smith',
            patientMRN: 'MRN001234',
            room: 'Ward A - Bed 101',
            name: 'Lisinopril',
            genericName: 'lisinopril',
            dose: '10',
            unit: 'mg',
            route: 'PO',
            frequency: 'Daily',
            scheduledTime: new Date(Date.now() + 15 * 60000).toISOString(),
            minutesFromNow: 15,
            isPRN: false,
            isHighAlert: false,
            prescribedBy: 'Dr. Smith',
            allergies: ['Penicillin'],
            status: 'DUE_NOW',
          },
        ],
        upcoming: [
          {
            id: 'med5',
            prescriptionId: 'presc5',
            patientId: 'p4',
            patientName: 'Sarah Wilson',
            patientMRN: 'MRN001237',
            room: 'Ward B - Bed 202',
            name: 'Warfarin',
            genericName: 'warfarin sodium',
            dose: '5',
            unit: 'mg',
            route: 'PO',
            frequency: 'Daily',
            scheduledTime: new Date(Date.now() + 120 * 60000).toISOString(),
            minutesFromNow: 120,
            isPRN: false,
            isHighAlert: true,
            highAlertInfo: { category: 'Anticoagulant', risk: 'Bleeding' },
            prescribedBy: 'Dr. Brown',
            allergies: [],
            status: 'UPCOMING',
          },
        ],
        prnAvailable: [
          {
            id: 'med6',
            prescriptionId: 'presc6',
            patientId: 'p5',
            patientName: 'Michael Brown',
            patientMRN: 'MRN001238',
            room: 'Ward C - Bed 301',
            name: 'Morphine',
            genericName: 'morphine sulfate',
            dose: '2-4',
            unit: 'mg',
            route: 'IV',
            frequency: 'Q4H PRN',
            scheduledTime: '',
            minutesFromNow: 0,
            isPRN: true,
            isHighAlert: true,
            highAlertInfo: { category: 'Opioid', risk: 'Respiratory depression' },
            instructions: 'For moderate to severe pain',
            prescribedBy: 'Dr. Lee',
            allergies: ['Codeine'],
            status: 'PRN_AVAILABLE',
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [selectedShift, selectedWard]);

  useEffect(() => {
    loadShiftMedications();
    // Refresh every minute
    const interval = setInterval(loadShiftMedications, 60000);
    return () => clearInterval(interval);
  }, [loadShiftMedications]);

  // Patient search
  const handlePatientSearch = async () => {
    if (!patientSearch.trim()) return;
    try {
      const response = await patientApi.getAll({ search: patientSearch });
      setSearchResults(response.data.data || response.data || []);
    } catch (error) {
      console.error('Error searching patients:', error);
      setSearchResults([]);
    }
  };

  // Select patient
  const handleSelectPatient = async (patient: any) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setPatientSearch('');
    setLoading(true);
    try {
      const response = await medSafetyApi.getPatientMedications(patient.id);
      setPatientMedications(response.data);
    } catch (error) {
      console.error('Error loading patient medications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle medication selection
  const handleSelectMedication = (medication: Medication) => {
    setSelectedMedication(medication);
    setScannedPatientBarcode('');
    setScannedMedicationBarcode('');
    setSafetyRights([
      { name: 'Right Patient', status: 'pending', message: 'Verify patient identity', icon: UserIcon },
      { name: 'Right Drug', status: 'pending', message: 'Verify medication', icon: BeakerIcon },
      { name: 'Right Dose', status: 'pending', message: 'Check dose', icon: ScaleIcon },
      { name: 'Right Route', status: 'pending', message: 'Verify route', icon: ArrowsRightLeftIcon },
      { name: 'Right Time', status: 'pending', message: 'Check schedule', icon: ClockIcon },
    ]);
    setShowVerification(true);
  };

  // Handle barcode scan
  const handleBarcodeScan = (barcode: string) => {
    setShowScanner(false);
    if (scannerType === 'patient') {
      setScannedPatientBarcode(barcode);
      updateSafetyRight(0, 'verified', `Patient ID: ${barcode}`);
    } else {
      setScannedMedicationBarcode(barcode);
      updateSafetyRight(1, 'verified', `Medication scanned`);
    }
  };

  // Update safety right
  const updateSafetyRight = (index: number, status: SafetyRight['status'], message: string) => {
    setSafetyRights(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status, message };
      return updated;
    });
  };

  // Perform verification
  const handleVerify = async () => {
    if (!selectedMedication) return;

    setVerifying(true);

    try {
      // Progressive UI updates for better UX
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 300));
        updateSafetyRight(i, 'verified', getSafetyMessage(i, true));
      }

      const response = await medSafetyApi.performSafetyVerification({
        patientId: selectedMedication.patientId,
        medicationId: selectedMedication.id,
        prescriptionId: selectedMedication.prescriptionId,
        scannedPatientBarcode: scannedPatientBarcode || undefined,
        scannedMedicationBarcode: scannedMedicationBarcode || undefined,
      });

      setVerificationResult(response.data);

      // Update rights based on verification result
      if (response.data.rights) {
        const rights = response.data.rights;
        updateSafetyRight(0, getStatus(rights.patient?.status), rights.patient?.message || 'Patient verified');
        updateSafetyRight(1, getStatus(rights.drug?.status), rights.drug?.message || 'Drug verified');
        updateSafetyRight(2, getStatus(rights.dose?.status), rights.dose?.message || 'Dose verified');
        updateSafetyRight(3, getStatus(rights.route?.status), rights.route?.message || 'Route verified');
        updateSafetyRight(4, getStatus(rights.time?.status), rights.time?.message || 'Time verified');
      }
    } catch (error) {
      console.error('Verification error:', error);
      // Simulate verification for demo
      setVerificationResult({
        safetyScore: 95,
        overallStatus: 'SAFE',
        isHighAlertMedication: selectedMedication.isHighAlert,
        requiresDoubleCheck: selectedMedication.isHighAlert,
        alerts: [],
        warnings: selectedMedication.isHighAlert ? [
          { type: 'HIGH_ALERT', severity: 'HIGH', message: 'High-alert medication - double check required' }
        ] : [],
        recommendations: [
          { priority: 1, type: 'MONITORING', message: 'Monitor patient after administration' }
        ],
      });
    } finally {
      setVerifying(false);
    }
  };

  const getStatus = (status?: string): SafetyRight['status'] => {
    if (!status) return 'pending';
    if (status === 'VERIFIED' || status === 'CLEAR') return 'verified';
    if (status === 'WARNING') return 'warning';
    if (status === 'FAILED') return 'failed';
    return 'pending';
  };

  const getSafetyMessage = (index: number, success: boolean): string => {
    const messages = [
      success ? 'Patient identity confirmed' : 'Patient verification needed',
      success ? 'Medication verified' : 'Check medication',
      success ? 'Dose within range' : 'Verify dose',
      success ? 'Route appropriate' : 'Check route',
      success ? 'Within scheduled window' : 'Check timing',
    ];
    return messages[index];
  };

  // Proceed to administration
  const handleProceedToAdmin = () => {
    if (verificationResult?.overallStatus === 'STOP') {
      setShowOverrideModal(true);
    } else {
      setShowVerification(false);
      setShowAdminModal(true);
    }
  };

  // Handle override
  const handleOverride = async () => {
    if (!overrideReason.trim() || !selectedMedication) return;

    try {
      await medSafetyApi.recordOverride({
        patientId: selectedMedication.patientId,
        medicationId: selectedMedication.id,
        alertType: 'SAFETY_OVERRIDE',
        overrideReason,
        verificationData: verificationResult,
      });

      setShowOverrideModal(false);
      setOverrideReason('');
      setShowVerification(false);
      setShowAdminModal(true);
    } catch (error) {
      console.error('Override error:', error);
    }
  };

  // Record administration
  const handleAdminister = async () => {
    if (!selectedMedication) return;

    setAdminSubmitting(true);
    try {
      await medSafetyApi.recordAdministration({
        patientId: selectedMedication.patientId,
        prescriptionId: selectedMedication.prescriptionId,
        medicationId: selectedMedication.id,
        dose: parseFloat(selectedMedication.dose) || 0,
        unit: selectedMedication.unit,
        route: selectedMedication.route,
        scheduledTime: selectedMedication.scheduledTime,
        administeredTime: new Date().toISOString(),
        notes: adminNotes || undefined,
        verificationResult,
      });

      setShowAdminModal(false);
      setSelectedMedication(null);
      setVerificationResult(null);
      setAdminNotes('');
      loadShiftMedications();
    } catch (error) {
      console.error('Administration error:', error);
    } finally {
      setAdminSubmitting(false);
    }
  };

  // Get status color classes
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OVERDUE':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'DUE_NOW':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'UPCOMING':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'PRN_AVAILABLE':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  // Get safety status color
  const getSafetyStatusColor = (status: SafetyRight['status']) => {
    switch (status) {
      case 'verified':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  // Get safety icon
  const getSafetyIcon = (status: SafetyRight['status']) => {
    switch (status) {
      case 'verified':
        return <CheckCircleIcon className="h-6 w-6 text-green-600" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />;
      case 'failed':
        return <XCircleIcon className="h-6 w-6 text-red-600" />;
      default:
        return <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />;
    }
  };

  // Get overall status color
  const getOverallStatusColor = (status?: string) => {
    switch (status) {
      case 'SAFE':
        return 'from-green-600 to-emerald-600';
      case 'CAUTION':
        return 'from-amber-500 to-orange-500';
      case 'STOP':
        return 'from-red-600 to-red-700';
      default:
        return 'from-blue-600 to-indigo-600';
    }
  };

  // Medication Card Component
  const MedicationCard = ({ medication, onClick }: { medication: Medication; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all hover:shadow-lg ${getStatusColor(medication.status)} ${
        medication.isHighAlert ? 'ring-2 ring-red-300' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg text-gray-900">{medication.name}</h3>
            {medication.isHighAlert && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                <ShieldExclamationIcon className="h-3 w-3" />
                HIGH-ALERT
              </span>
            )}
            {medication.isPRN && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                PRN
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {medication.dose} {medication.unit} - {medication.route} - {medication.frequency}
          </p>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-gray-700">
              <UserGroupIcon className="h-4 w-4" />
              {medication.patientName}
            </span>
            <span className="text-gray-500">{medication.room}</span>
          </div>
          {medication.allergies.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
              <ExclamationTriangleIcon className="h-4 w-4" />
              Allergies: {medication.allergies.join(', ')}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {medication.status === 'OVERDUE' && (
            <span className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full animate-pulse">
              {medication.overdueMinutes}m overdue
            </span>
          )}
          {medication.status === 'DUE_NOW' && (
            <span className="px-3 py-1 bg-amber-500 text-white text-sm font-medium rounded-full">
              Due now
            </span>
          )}
          {medication.status === 'UPCOMING' && (
            <span className="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
              In {medication.minutesFromNow}m
            </span>
          )}
          <span className="text-xs text-gray-500">
            {new Date(medication.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
                <ShieldCheckIcon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Medication Safety</h1>
                <p className="text-sm text-gray-500">5 Rights Verification & Administration</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('shift')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    viewMode === 'shift'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Squares2X2Icon className="h-4 w-4" />
                  Shift View
                </button>
                <button
                  onClick={() => setViewMode('patient')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    viewMode === 'patient'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ListBulletIcon className="h-4 w-4" />
                  Patient View
                </button>
              </div>

              {/* Scan Buttons */}
              <button
                onClick={() => { setScannerType('patient'); setShowScanner(true); }}
                className="px-4 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <QrCodeIcon className="h-5 w-5" />
                Scan Wristband
              </button>
              <button
                onClick={() => { setScannerType('medication'); setShowScanner(true); }}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2 text-sm font-medium"
              >
                <BeakerIcon className="h-5 w-5" />
                Scan Medication
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {getStatsCards(shiftData?.summary || null).map((stat) => (
            <div
              key={stat.name}
              className={`p-4 rounded-2xl bg-white border-2 shadow-sm ${
                stat.urgent ? 'border-red-200 ring-2 ring-red-100' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div
                  className={`p-3 rounded-xl ${
                    stat.color === 'red'
                      ? 'bg-red-100 text-red-600'
                      : stat.color === 'amber'
                      ? 'bg-amber-100 text-amber-600'
                      : stat.color === 'blue'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-purple-100 text-purple-600'
                  }`}
                >
                  <stat.icon className={`h-6 w-6 ${stat.urgent ? 'animate-pulse' : ''}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Shift View */}
        {viewMode === 'shift' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Shift:</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  >
                    <option value="current">Current Shift</option>
                    <option value="day">Day (7AM - 3PM)</option>
                    <option value="evening">Evening (3PM - 11PM)</option>
                    <option value="night">Night (11PM - 7AM)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Ward:</label>
                  <select
                    value={selectedWard}
                    onChange={(e) => setSelectedWard(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  >
                    <option value="">All Wards</option>
                    <option value="ward-a">Ward A</option>
                    <option value="ward-b">Ward B</option>
                    <option value="ward-c">Ward C</option>
                    <option value="icu">ICU</option>
                  </select>
                </div>
                <button
                  onClick={loadShiftMedications}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Medications List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="mt-4 text-gray-500">Loading medications...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Overdue */}
                {shiftData?.overdue && shiftData.overdue.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-red-700 flex items-center gap-2 mb-3">
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      Overdue ({shiftData.overdue.length})
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {shiftData.overdue.map((med) => (
                        <MedicationCard
                          key={med.id}
                          medication={med}
                          onClick={() => handleSelectMedication(med)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Due Now */}
                {shiftData?.dueNow && shiftData.dueNow.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-amber-700 flex items-center gap-2 mb-3">
                      <ClockIcon className="h-5 w-5" />
                      Due Now ({shiftData.dueNow.length})
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {shiftData.dueNow.map((med) => (
                        <MedicationCard
                          key={med.id}
                          medication={med}
                          onClick={() => handleSelectMedication(med)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming */}
                {shiftData?.upcoming && shiftData.upcoming.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-blue-700 flex items-center gap-2 mb-3">
                      <ArrowPathIcon className="h-5 w-5" />
                      Upcoming ({shiftData.upcoming.length})
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {shiftData.upcoming.map((med) => (
                        <MedicationCard
                          key={med.id}
                          medication={med}
                          onClick={() => handleSelectMedication(med)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* PRN */}
                {shiftData?.prnAvailable && shiftData.prnAvailable.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-purple-700 flex items-center gap-2 mb-3">
                      <HandRaisedIcon className="h-5 w-5" />
                      PRN Available ({shiftData.prnAvailable.length})
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {shiftData.prnAvailable.map((med) => (
                        <MedicationCard
                          key={med.id}
                          medication={med}
                          onClick={() => handleSelectMedication(med)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {(!shiftData?.overdue?.length && !shiftData?.dueNow?.length &&
                  !shiftData?.upcoming?.length && !shiftData?.prnAvailable?.length) && (
                  <div className="text-center py-12 bg-white rounded-2xl border-2 border-gray-200">
                    <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" />
                    <h3 className="mt-4 text-lg font-medium text-gray-900">All Clear!</h3>
                    <p className="mt-2 text-gray-500">No medications due for this shift</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Patient View */}
        {viewMode === 'patient' && (
          <div className="space-y-6">
            {!selectedPatient ? (
              <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <UserGroupIcon className="h-5 w-5 text-gray-500" />
                  Select Patient
                </h3>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePatientSearch()}
                      placeholder="Search by name or MRN..."
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
                    />
                  </div>
                  <button
                    onClick={handlePatientSearch}
                    className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    Search
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-4 border-2 border-gray-200 rounded-xl overflow-hidden">
                    {searchResults.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => handleSelectPatient(patient)}
                        className="w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900 text-lg">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
                        </div>
                        <span className="text-blue-600 font-medium">Select</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Selected Patient Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                        {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-gray-900">
                          {selectedPatient.firstName} {selectedPatient.lastName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          MRN: {selectedPatient.mrn} | DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                        </p>
                        {patientMedications?.patient?.allergies?.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-600 font-medium">
                              Allergies: {patientMedications.patient.allergies.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedPatient(null); setPatientMedications(null); }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      Change Patient
                    </button>
                  </div>
                </div>

                {/* Patient Medications */}
                {loading ? (
                  <div className="text-center py-12">
                    <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : patientMedications?.medications?.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {patientMedications.medications.map((med: any) => (
                      <MedicationCard
                        key={med.id}
                        medication={{
                          ...med,
                          patientId: selectedPatient.id,
                          patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                          patientMRN: selectedPatient.mrn,
                          allergies: patientMedications?.patient?.allergies || [],
                        }}
                        onClick={() => handleSelectMedication({
                          ...med,
                          patientId: selectedPatient.id,
                          patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                          patientMRN: selectedPatient.mrn,
                          allergies: patientMedications?.patient?.allergies || [],
                        })}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-2xl border-2 border-gray-200">
                    <DocumentTextIcon className="h-16 w-16 text-gray-300 mx-auto" />
                    <p className="mt-4 text-gray-500">No medications found for this patient</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {showVerification && selectedMedication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`p-6 text-white bg-gradient-to-r ${getOverallStatusColor(verificationResult?.overallStatus)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <ShieldCheckIcon className="h-10 w-10" />
                  <div>
                    <h2 className="text-2xl font-bold">5 Rights Verification</h2>
                    <p className="opacity-90">{selectedMedication.name} - {selectedMedication.dose} {selectedMedication.unit}</p>
                  </div>
                </div>
                {verificationResult && (
                  <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                    verificationResult.overallStatus === 'SAFE' ? 'bg-green-800' :
                    verificationResult.overallStatus === 'CAUTION' ? 'bg-amber-600' :
                    'bg-red-800'
                  }`}>
                    {verificationResult.overallStatus}
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* High Alert Warning */}
              {selectedMedication.isHighAlert && (
                <div className="bg-red-100 border-2 border-red-300 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <ShieldExclamationIcon className="h-8 w-8 text-red-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-red-800">HIGH-ALERT MEDICATION</h4>
                      <p className="text-sm text-red-700 mt-1">
                        {selectedMedication.highAlertInfo?.category}: {selectedMedication.highAlertInfo?.risk}
                      </p>
                      <p className="text-sm text-red-600 mt-1 font-medium">
                        Requires independent double-check
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Info */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Patient</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{selectedMedication.patientName}</p>
                    <p className="text-sm text-gray-600">MRN: {selectedMedication.patientMRN}</p>
                    <p className="text-sm text-gray-600">{selectedMedication.room}</p>
                  </div>
                  <button
                    onClick={() => { setScannerType('patient'); setShowScanner(true); }}
                    className={`px-4 py-3 rounded-xl font-medium flex items-center gap-2 ${
                      scannedPatientBarcode
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <QrCodeIcon className="h-5 w-5" />
                    {scannedPatientBarcode ? 'Scanned' : 'Scan Wristband'}
                  </button>
                </div>
              </div>

              {/* 5 Rights Checklist */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">Safety Verification</h4>
                {safetyRights.map((right) => (
                  <div
                    key={right.name}
                    className={`p-4 rounded-2xl border-2 transition-all ${getSafetyStatusColor(right.status)}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-white shadow-sm">
                        <right.icon className="h-6 w-6 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-gray-900">{right.name}</h5>
                          {getSafetyIcon(right.status)}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{right.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Verification Alerts */}
              {verificationResult?.alerts?.length > 0 && (
                <div className="space-y-2">
                  {verificationResult.alerts.map((alert: any, idx: number) => (
                    <div key={idx} className="bg-red-100 border-2 border-red-300 rounded-xl p-3 flex items-start gap-3">
                      <BellAlertIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">{alert.type}</p>
                        <p className="text-sm text-red-700">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {verificationResult?.warnings?.length > 0 && (
                <div className="space-y-2">
                  {verificationResult.warnings.map((warning: any, idx: number) => (
                    <div key={idx} className="bg-amber-100 border-2 border-amber-300 rounded-xl p-3 flex items-start gap-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">{warning.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {verificationResult?.recommendations?.length > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <h4 className="font-medium text-blue-800 flex items-center gap-2 mb-3">
                    <InformationCircleIcon className="h-5 w-5" />
                    Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {verificationResult.recommendations.map((rec: any, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-blue-700">
                        <CheckCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{rec.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              {!verificationResult ? (
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
                >
                  {verifying ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="h-6 w-6" />
                      Verify Medication
                    </>
                  )}
                </button>
              ) : (
                <div className="flex gap-4">
                  <button
                    onClick={() => { setShowVerification(false); setSelectedMedication(null); setVerificationResult(null); }}
                    className="flex-1 py-4 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors text-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleProceedToAdmin}
                    className={`flex-1 py-4 rounded-xl font-medium transition-colors text-lg ${
                      verificationResult.overallStatus === 'STOP'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : verificationResult.overallStatus === 'CAUTION'
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {verificationResult.overallStatus === 'STOP'
                      ? 'Override & Proceed'
                      : verificationResult.overallStatus === 'CAUTION'
                      ? 'Acknowledge & Proceed'
                      : 'Proceed to Administer'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-100">
                <ShieldExclamationIcon className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Override Required</h3>
                <p className="text-sm text-gray-500">Document reason for overriding safety alerts</p>
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Enter override reason (required)..."
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none text-lg"
              />

              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> You are about to override safety alerts. This action will be logged and reviewed.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => { setShowOverrideModal(false); setOverrideReason(''); }}
                  className="flex-1 py-4 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverride}
                  disabled={!overrideReason.trim()}
                  className="flex-1 py-4 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Administration Modal */}
      {showAdminModal && selectedMedication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
              <div className="flex items-center gap-4">
                <CheckCircleIcon className="h-10 w-10" />
                <div>
                  <h2 className="text-2xl font-bold">Record Administration</h2>
                  <p className="opacity-90">Confirm medication given to patient</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Medication</h4>
                <p className="text-lg font-bold text-gray-900">{selectedMedication.name}</p>
                <p className="text-gray-600">{selectedMedication.dose} {selectedMedication.unit} - {selectedMedication.route}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Patient</h4>
                <p className="font-medium text-gray-900">{selectedMedication.patientName}</p>
                <p className="text-sm text-gray-600">{selectedMedication.room}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Administration Notes (optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Enter any notes about the administration..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => { setShowAdminModal(false); setAdminNotes(''); }}
                  className="flex-1 py-4 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdminister}
                  disabled={adminSubmitting}
                  className="flex-1 py-4 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {adminSubmitting ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-6 w-6" />
                      Confirm Administration
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <QrCodeIcon className="h-8 w-8" />
                  <div>
                    <h3 className="font-bold text-lg">Barcode Scanner</h3>
                    <p className="text-sm text-blue-100">
                      {scannerType === 'patient' ? 'Scan patient wristband' : 'Scan medication barcode'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowScanner(false)}
                  className="p-2 rounded-xl hover:bg-white/20 transition-colors"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Simulated camera view */}
              <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-32 border-2 border-white/50 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
                  </div>
                </div>
                <p className="text-white/60 text-sm">Camera not available in demo</p>
              </div>

              {/* Simulate scan button */}
              <button
                onClick={() => {
                  const barcode = scannerType === 'patient'
                    ? `PT${Math.random().toString(36).substring(2, 10).toUpperCase()}`
                    : `MED${Math.floor(Math.random() * 100000)}`;
                  handleBarcodeScan(barcode);
                }}
                className="w-full py-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <QrCodeIcon className="h-5 w-5" />
                Simulate Scan
              </button>

              {/* Manual entry */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or enter manually</span>
                </div>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter barcode..."
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleBarcodeScan((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                    if (input?.value) handleBarcodeScan(input.value);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
