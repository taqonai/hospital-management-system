import { useState, useEffect } from 'react';
import {
  ShieldCheckIcon,
  QrCodeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BeakerIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CalculatorIcon,
  ArrowsRightLeftIcon,
  MagnifyingGlassIcon,
  BellAlertIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { medSafetyApi, patientApi } from '../../services/api';
import BarcodeScanner from '../../components/nursing/BarcodeScanner';
import MedSchedule from '../../components/nursing/MedSchedule';
import MedVerification from '../../components/nursing/MedVerification';
import MedAdminRecord from '../../components/nursing/MedAdminRecord';

const statsCards = [
  {
    name: 'Medications Due',
    value: '12',
    subtext: '3 overdue',
    icon: ClockIcon,
    color: 'amber',
    urgent: true,
  },
  {
    name: 'Administered Today',
    value: '47',
    subtext: '+8 from yesterday',
    icon: CheckCircleIcon,
    color: 'green',
  },
  {
    name: 'Active Alerts',
    value: '5',
    subtext: '2 critical',
    icon: ExclamationTriangleIcon,
    color: 'red',
  },
  {
    name: 'High-Alert Meds',
    value: '8',
    subtext: 'Require double-check',
    icon: ShieldExclamationIcon,
    color: 'purple',
  },
];

export default function MedSafety() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'scanner' | 'calculator' | 'compatibility' | 'alerts'>('schedule');
  const [showScanner, setShowScanner] = useState(false);
  const [scannerType, setScannerType] = useState<'patient' | 'medication' | 'any'>('patient');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientMedications, setPatientMedications] = useState<any>(null);
  const [selectedMedication, setSelectedMedication] = useState<any>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [showAdminRecord, setShowAdminRecord] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [highAlertDrugs, setHighAlertDrugs] = useState<any>(null);

  // IV Compatibility state
  const [ivDrug1, setIvDrug1] = useState('');
  const [ivDrug2, setIvDrug2] = useState('');
  const [ivCompatResult, setIvCompatResult] = useState<any>(null);
  const [checkingCompat, setCheckingCompat] = useState(false);

  // Dose Calculator state
  const [calcMedName, setCalcMedName] = useState('');
  const [calcWeight, setCalcWeight] = useState('');
  const [calcAge, setCalcAge] = useState('');
  const [calcDosePerKg, setCalcDosePerKg] = useState('');
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    loadHighAlertDrugs();
  }, []);

  const loadHighAlertDrugs = async () => {
    try {
      const response = await medSafetyApi.getHighAlertDrugs();
      setHighAlertDrugs(response.data);
    } catch (error) {
      console.error('Error loading high-alert drugs:', error);
    }
  };

  const handlePatientSearch = async () => {
    if (!patientSearch.trim()) return;

    setLoading(true);
    try {
      const response = await patientApi.getAll({ search: patientSearch });
      setSearchResults(response.data.data || response.data || []);
    } catch (error) {
      console.error('Error searching patients:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = async (patient: any) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setPatientSearch('');
    await loadPatientMedications(patient.id);
  };

  const loadPatientMedications = async (patientId: string) => {
    setLoading(true);
    try {
      const response = await medSafetyApi.getPatientMedications(patientId);
      setPatientMedications(response.data);
    } catch (error) {
      console.error('Error loading medications:', error);
      // Mock data for demo
      setPatientMedications({
        patient: selectedPatient,
        overdue: [
          {
            id: 'med1',
            prescriptionId: 'presc1',
            name: 'Heparin',
            genericName: 'heparin sodium',
            dose: '5000 units',
            unit: 'units',
            route: 'SC',
            frequency: 'Q12H',
            scheduledTime: new Date(Date.now() - 90 * 60000).toISOString(),
            status: 'OVERDUE',
            isPRN: false,
            isHighAlert: true,
            overdueMinutes: 90,
            prescribedBy: 'Dr. Smith',
          },
        ],
        dueNow: [
          {
            id: 'med2',
            prescriptionId: 'presc1',
            name: 'Metformin',
            genericName: 'metformin hcl',
            dose: '500 mg',
            unit: 'mg',
            route: 'PO',
            frequency: 'BID',
            scheduledTime: new Date().toISOString(),
            status: 'DUE_NOW',
            isPRN: false,
            isHighAlert: false,
            minutesFromNow: 0,
            prescribedBy: 'Dr. Johnson',
          },
        ],
        upcoming: [
          {
            id: 'med3',
            prescriptionId: 'presc2',
            name: 'Insulin Glargine',
            genericName: 'insulin glargine',
            dose: '20 units',
            unit: 'units',
            route: 'SC',
            frequency: 'Daily',
            scheduledTime: new Date(Date.now() + 60 * 60000).toISOString(),
            status: 'UPCOMING',
            isPRN: false,
            isHighAlert: true,
            minutesFromNow: 60,
            prescribedBy: 'Dr. Smith',
          },
        ],
        prnAvailable: [
          {
            id: 'med4',
            prescriptionId: 'presc3',
            name: 'Morphine',
            genericName: 'morphine sulfate',
            dose: '2-4 mg',
            unit: 'mg',
            route: 'IV',
            frequency: 'Q4H PRN',
            status: 'PRN_AVAILABLE',
            isPRN: true,
            isHighAlert: true,
            instructions: 'For moderate to severe pain',
            prescribedBy: 'Dr. Smith',
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false);
    try {
      const response = await medSafetyApi.scanBarcode(barcode, scannerType);
      if (response.data.type === 'PATIENT' && response.data.patient) {
        handleSelectPatient(response.data.patient);
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
    }
  };

  const handleSelectMedication = (medication: any) => {
    setSelectedMedication(medication);
    setShowVerification(true);
  };

  const handleVerificationComplete = (result: any) => {
    setVerificationResult(result);
    setShowVerification(false);
    setShowAdminRecord(true);
  };

  const handleAdminComplete = () => {
    setShowAdminRecord(false);
    setSelectedMedication(null);
    setVerificationResult(null);
    if (selectedPatient) {
      loadPatientMedications(selectedPatient.id);
    }
  };

  const handleCheckIVCompatibility = async () => {
    if (!ivDrug1.trim() || !ivDrug2.trim()) return;

    setCheckingCompat(true);
    try {
      const response = await medSafetyApi.checkIVCompatibility({ drug1: ivDrug1, drug2: ivDrug2 });
      setIvCompatResult(response.data);
    } catch (error) {
      console.error('IV compatibility check error:', error);
      setIvCompatResult({
        compatible: null,
        message: 'Unable to check compatibility. Please consult pharmacy.',
        recommendation: 'Contact pharmacy for verification.',
      });
    } finally {
      setCheckingCompat(false);
    }
  };

  const handleCalculateDose = async () => {
    if (!calcMedName.trim() || !calcWeight || !calcAge) return;

    setCalculating(true);
    try {
      const response = await medSafetyApi.calculateDose({
        medicationName: calcMedName,
        patientWeight: parseFloat(calcWeight),
        patientAge: parseInt(calcAge),
        dosePerKg: calcDosePerKg ? parseFloat(calcDosePerKg) : undefined,
      });
      setCalcResult(response.data);
    } catch (error) {
      console.error('Dose calculation error:', error);
    } finally {
      setCalculating(false);
    }
  };

  const getAllMedications = () => {
    if (!patientMedications) return [];
    return [
      ...(patientMedications.overdue || []),
      ...(patientMedications.dueNow || []),
      ...(patientMedications.upcoming || []),
      ...(patientMedications.prnAvailable || []),
    ];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            Medication Safety
          </h1>
          <p className="mt-1 text-gray-500">
            5 Rights verification and safe medication administration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setScannerType('patient');
              setShowScanner(true);
            }}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <QrCodeIcon className="h-5 w-5" />
            Scan Wristband
          </button>
          <button
            onClick={() => {
              setScannerType('medication');
              setShowScanner(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
          >
            <BeakerIcon className="h-5 w-5" />
            Scan Medication
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <div
            key={stat.name}
            className={`p-4 rounded-2xl backdrop-blur-xl bg-white border shadow-lg ${
              stat.urgent ? 'border-amber-200 ring-2 ring-amber-100' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.subtext}</p>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  stat.color === 'amber'
                    ? 'bg-amber-100 text-amber-600'
                    : stat.color === 'green'
                    ? 'bg-green-100 text-green-600'
                    : stat.color === 'red'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-purple-100 text-purple-600'
                }`}
              >
                <stat.icon className={`h-6 w-6 ${stat.urgent ? 'animate-pulse' : ''}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Patient Search / Selection */}
      {!selectedPatient && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-gray-500" />
            Select Patient
          </h3>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePatientSearch()}
                placeholder="Search by name or MRN..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handlePatientSearch}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Search
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
              {searchResults.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => handleSelectPatient(patient)}
                  className="w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
                  </div>
                  <span className="text-blue-600 text-sm">Select</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Patient Header */}
      {selectedPatient && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {selectedPatient.firstName?.[0]}{selectedPatient.lastName?.[0]}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </h3>
                <p className="text-sm text-gray-600">
                  MRN: {selectedPatient.mrn} | DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                </p>
                {patientMedications?.patient?.allergies?.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">
                      Allergies: {patientMedications.patient.allergies.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedPatient(null);
                setPatientMedications(null);
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Change Patient
            </button>
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'schedule', label: 'Med Schedule', icon: ClockIcon },
            { id: 'scanner', label: 'Barcode Scan', icon: QrCodeIcon },
            { id: 'calculator', label: 'Dose Calculator', icon: CalculatorIcon },
            { id: 'compatibility', label: 'IV Compatibility', icon: ArrowsRightLeftIcon },
            { id: 'alerts', label: 'High-Alert Drugs', icon: ShieldExclamationIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div>
              {selectedPatient ? (
                <MedSchedule
                  medications={getAllMedications()}
                  onSelectMedication={handleSelectMedication}
                  onRefresh={() => loadPatientMedications(selectedPatient.id)}
                  loading={loading}
                />
              ) : (
                <div className="text-center py-12">
                  <UserGroupIcon className="h-12 w-12 text-gray-300 mx-auto" />
                  <p className="mt-4 text-gray-500">Select a patient to view medication schedule</p>
                </div>
              )}
            </div>
          )}

          {/* Scanner Tab */}
          {activeTab === 'scanner' && (
            <div className="text-center py-8">
              <QrCodeIcon className="h-16 w-16 text-gray-300 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Barcode Scanner</h3>
              <p className="mt-2 text-gray-500 max-w-md mx-auto">
                Scan patient wristband or medication barcode for quick verification
              </p>
              <div className="mt-6 flex justify-center gap-4">
                <button
                  onClick={() => {
                    setScannerType('patient');
                    setShowScanner(true);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <UserGroupIcon className="h-5 w-5" />
                  Scan Patient
                </button>
                <button
                  onClick={() => {
                    setScannerType('medication');
                    setShowScanner(true);
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <BeakerIcon className="h-5 w-5" />
                  Scan Medication
                </button>
              </div>
            </div>
          )}

          {/* Calculator Tab */}
          {activeTab === 'calculator' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medication Name
                  </label>
                  <input
                    type="text"
                    value={calcMedName}
                    onChange={(e) => setCalcMedName(e.target.value)}
                    placeholder="e.g., Amoxicillin"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dose per kg (optional)
                  </label>
                  <input
                    type="number"
                    value={calcDosePerKg}
                    onChange={(e) => setCalcDosePerKg(e.target.value)}
                    placeholder="mg/kg"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(e.target.value)}
                    placeholder="kg"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Age (years)
                  </label>
                  <input
                    type="number"
                    value={calcAge}
                    onChange={(e) => setCalcAge(e.target.value)}
                    placeholder="years"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleCalculateDose}
                disabled={calculating || !calcMedName || !calcWeight || !calcAge}
                className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CalculatorIcon className="h-5 w-5" />
                {calculating ? 'Calculating...' : 'Calculate Dose'}
              </button>

              {calcResult && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-semibold text-blue-900">Calculation Result</h4>
                  {calcResult.recommendedDose && (
                    <div className="text-lg font-bold text-blue-700">
                      Recommended: {calcResult.recommendedDose.value} {calcResult.recommendedDose.unit}
                    </div>
                  )}
                  {calcResult.calculations?.map((calc: any, idx: number) => (
                    <div key={idx} className="text-sm text-blue-600">
                      {calc.step}: {calc.formula} = {calc.result}
                    </div>
                  ))}
                  {calcResult.warnings?.map((warning: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                      <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      {warning.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* IV Compatibility Tab */}
          {activeTab === 'compatibility' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Drug 1
                  </label>
                  <input
                    type="text"
                    value={ivDrug1}
                    onChange={(e) => setIvDrug1(e.target.value)}
                    placeholder="e.g., Morphine"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Drug 2
                  </label>
                  <input
                    type="text"
                    value={ivDrug2}
                    onChange={(e) => setIvDrug2(e.target.value)}
                    placeholder="e.g., Ondansetron"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleCheckIVCompatibility}
                disabled={checkingCompat || !ivDrug1 || !ivDrug2}
                className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ArrowsRightLeftIcon className="h-5 w-5" />
                {checkingCompat ? 'Checking...' : 'Check Compatibility'}
              </button>

              {ivCompatResult && (
                <div className={`rounded-xl p-4 border-2 ${
                  ivCompatResult.compatible === true
                    ? 'bg-green-50 border-green-200'
                    : ivCompatResult.compatible === false
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {ivCompatResult.compatible === true ? (
                      <CheckCircleIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
                    ) : ivCompatResult.compatible === false ? (
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-500 flex-shrink-0" />
                    ) : (
                      <ExclamationTriangleIcon className="h-6 w-6 text-amber-500 flex-shrink-0" />
                    )}
                    <div>
                      <h4 className={`font-semibold ${
                        ivCompatResult.compatible === true
                          ? 'text-green-800'
                          : ivCompatResult.compatible === false
                          ? 'text-red-800'
                          : 'text-amber-800'
                      }`}>
                        {ivCompatResult.message}
                      </h4>
                      <p className="text-sm mt-1 text-gray-600">
                        {ivCompatResult.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* High-Alert Drugs Tab */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              {highAlertDrugs?.categories && Object.entries(highAlertDrugs.categories).map(([category, drugs]: [string, any]) => (
                <div key={category} className="border border-red-200 rounded-xl overflow-hidden">
                  <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                    <h4 className="font-semibold text-red-800 flex items-center gap-2">
                      <ShieldExclamationIcon className="h-5 w-5" />
                      {category}
                    </h4>
                  </div>
                  <div className="divide-y divide-red-100">
                    {drugs.map((drug: any, idx: number) => (
                      <div key={idx} className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{drug.name}</p>
                            <p className="text-sm text-red-600 mt-1">Risk: {drug.risk}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {drug.specialChecks?.map((check: string, checkIdx: number) => (
                            <span
                              key={checkIdx}
                              className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full"
                            >
                              {check}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        expectedType={scannerType}
      />

      {/* Verification Modal */}
      {showVerification && selectedMedication && selectedPatient && (
        <MedVerification
          medication={selectedMedication}
          patient={{
            ...selectedPatient,
            ...patientMedications?.patient,
          }}
          onVerificationComplete={handleVerificationComplete}
          onCancel={() => {
            setShowVerification(false);
            setSelectedMedication(null);
          }}
        />
      )}

      {/* Admin Record Modal */}
      {showAdminRecord && selectedMedication && selectedPatient && (
        <MedAdminRecord
          medication={selectedMedication}
          patient={{
            ...selectedPatient,
            ...patientMedications?.patient,
          }}
          verificationResult={verificationResult}
          onComplete={handleAdminComplete}
          onCancel={() => {
            setShowAdminRecord(false);
            setSelectedMedication(null);
            setVerificationResult(null);
          }}
        />
      )}
    </div>
  );
}
