import { useState, Fragment, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Dialog, Transition } from '@headlessui/react';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  CalendarDaysIcon,
  UserIcon,
  BuildingOfficeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  BeakerIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  PrinterIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import toast from 'react-hot-toast';

interface Diagnosis {
  id: string;
  code: string;
  description: string;
  type: 'PRIMARY' | 'SECONDARY' | 'ADMITTING';
  notes?: string;
}

interface Procedure {
  id: string;
  code: string;
  name: string;
  date?: string;
  notes?: string;
}

interface VitalSigns {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
}

interface MedicalRecord {
  id: string;
  visitDate: string;
  visitType: 'OPD' | 'IPD' | 'EMERGENCY' | 'TELEMEDICINE' | 'HOME_VISIT';
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  allergies?: string[];
  medications?: string[];
  physicalExamination?: string;
  vitalSigns?: VitalSigns;
  diagnoses: Diagnosis[];
  procedures?: Procedure[];
  treatmentPlan?: string;
  instructions?: string;
  followUpDate?: string;
  notes?: string;
  doctor: {
    id: string;
    specialization: string;
    user?: {
      firstName: string;
      lastName: string;
    };
  };
  department?: {
    id: string;
    name: string;
  };
  attachments?: {
    id: string;
    name: string;
    type: string;
    url: string;
  }[];
  createdAt: string;
  updatedAt?: string;
}

const visitTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  OPD: { label: 'Outpatient', color: 'text-blue-700', bg: 'bg-blue-100' },
  IPD: { label: 'Inpatient', color: 'text-purple-700', bg: 'bg-purple-100' },
  EMERGENCY: { label: 'Emergency', color: 'text-red-700', bg: 'bg-red-100' },
  TELEMEDICINE: { label: 'Telemedicine', color: 'text-green-700', bg: 'bg-green-100' },
  HOME_VISIT: { label: 'Home Visit', color: 'text-amber-700', bg: 'bg-amber-100' },
};

const diagnosisTypeConfig: Record<string, { label: string; color: string }> = {
  PRIMARY: { label: 'Primary', color: 'bg-blue-500' },
  SECONDARY: { label: 'Secondary', color: 'bg-gray-400' },
  ADMITTING: { label: 'Admitting', color: 'bg-purple-500' },
};

// Mock data for demonstration
const mockRecords: MedicalRecord[] = [
  {
    id: '1',
    visitDate: '2024-12-20T10:30:00Z',
    visitType: 'OPD',
    chiefComplaint: 'Persistent headache and mild fever for 3 days',
    historyOfPresentIllness: 'Patient reports gradual onset headache, mild fever (100.2F), and general malaise. No recent travel or sick contacts.',
    pastMedicalHistory: 'Hypertension - well controlled on medication. No known drug allergies.',
    allergies: ['Penicillin', 'Sulfa drugs'],
    medications: ['Lisinopril 10mg daily', 'Aspirin 81mg daily'],
    physicalExamination: 'Alert and oriented. Mild tenderness on frontal region. HEENT unremarkable. Lungs clear bilaterally.',
    vitalSigns: {
      bloodPressureSystolic: 128,
      bloodPressureDiastolic: 82,
      heartRate: 78,
      temperature: 100.2,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      weight: 175,
      height: 70,
      bmi: 25.1,
    },
    diagnoses: [
      { id: 'd1', code: 'R51', description: 'Headache, unspecified', type: 'PRIMARY', notes: 'Likely tension-type headache' },
      { id: 'd2', code: 'R50.9', description: 'Fever, unspecified', type: 'SECONDARY', notes: 'Low-grade, likely viral' },
    ],
    treatmentPlan: 'Symptomatic treatment with rest, hydration, and OTC analgesics. Monitor temperature.',
    instructions: 'Take acetaminophen 500mg every 6 hours as needed. Drink plenty of fluids. Rest for 2-3 days. Return if symptoms worsen or fever persists beyond 5 days.',
    followUpDate: '2024-12-27',
    notes: 'Patient counseled on warning signs. Appears to understand instructions.',
    doctor: {
      id: 'doc1',
      specialization: 'Internal Medicine',
      user: { firstName: 'Sarah', lastName: 'Johnson' },
    },
    department: { id: 'dept1', name: 'General Medicine' },
    attachments: [
      { id: 'att1', name: 'Lab Report - CBC', type: 'application/pdf', url: '/reports/cbc-123.pdf' },
    ],
    createdAt: '2024-12-20T11:00:00Z',
  },
  {
    id: '2',
    visitDate: '2024-11-15T14:00:00Z',
    visitType: 'OPD',
    chiefComplaint: 'Annual health checkup',
    historyOfPresentIllness: 'Patient here for routine annual physical examination. No acute complaints.',
    vitalSigns: {
      bloodPressureSystolic: 122,
      bloodPressureDiastolic: 78,
      heartRate: 72,
      temperature: 98.6,
      respiratoryRate: 14,
      oxygenSaturation: 99,
      weight: 170,
      height: 70,
      bmi: 24.4,
    },
    diagnoses: [
      { id: 'd3', code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings', type: 'PRIMARY' },
    ],
    procedures: [
      { id: 'p1', code: '36415', name: 'Venipuncture for blood collection', date: '2024-11-15' },
      { id: 'p2', code: '81001', name: 'Urinalysis', date: '2024-11-15' },
    ],
    treatmentPlan: 'Continue current medications. Follow up annually or as needed.',
    followUpDate: '2025-11-15',
    doctor: {
      id: 'doc1',
      specialization: 'Internal Medicine',
      user: { firstName: 'Sarah', lastName: 'Johnson' },
    },
    department: { id: 'dept1', name: 'General Medicine' },
    createdAt: '2024-11-15T15:30:00Z',
  },
  {
    id: '3',
    visitDate: '2024-10-05T09:00:00Z',
    visitType: 'EMERGENCY',
    chiefComplaint: 'Severe chest pain radiating to left arm',
    historyOfPresentIllness: 'Patient presented with sudden onset severe chest pain, diaphoresis, and nausea. Pain described as crushing, 8/10 severity.',
    physicalExamination: 'Patient appears distressed. Diaphoretic. Cardiac exam: S1S2 regular, no murmurs. Lungs clear.',
    vitalSigns: {
      bloodPressureSystolic: 160,
      bloodPressureDiastolic: 95,
      heartRate: 102,
      temperature: 98.8,
      respiratoryRate: 22,
      oxygenSaturation: 95,
    },
    diagnoses: [
      { id: 'd4', code: 'I21.0', description: 'ST elevation myocardial infarction (STEMI) of anterior wall', type: 'PRIMARY' },
      { id: 'd5', code: 'I10', description: 'Essential hypertension', type: 'SECONDARY' },
    ],
    procedures: [
      { id: 'p3', code: '92941', name: 'Percutaneous transluminal coronary angioplasty with stent', date: '2024-10-05' },
    ],
    treatmentPlan: 'Emergency PCI performed. Post-procedure monitoring in CCU. Start dual antiplatelet therapy.',
    doctor: {
      id: 'doc2',
      specialization: 'Cardiology',
      user: { firstName: 'Michael', lastName: 'Chen' },
    },
    department: { id: 'dept2', name: 'Cardiology' },
    createdAt: '2024-10-05T12:00:00Z',
  },
];

export default function MedicalRecords() {
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visitTypeFilter, setVisitTypeFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Fetch medical records
  const { data: recordsData, isLoading, error } = useQuery({
    queryKey: ['patient-medical-records', visitTypeFilter, doctorFilter, departmentFilter, dateRange],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getMedicalRecords({
          visitType: visitTypeFilter || undefined,
          doctorId: doctorFilter || undefined,
          departmentId: departmentFilter || undefined,
          startDate: dateRange.startDate || undefined,
          endDate: dateRange.endDate || undefined,
        });
        return response.data?.data || response.data || [];
      } catch {
        return mockRecords;
      }
    },
  });

  const records: MedicalRecord[] = Array.isArray(recordsData) ? recordsData : [];

  // Fetch doctors for filter
  const { data: doctors } = useQuery({
    queryKey: ['patient-portal-doctors-filter'],
    queryFn: async () => {
      const response = await patientPortalApi.getDoctors({});
      return response.data?.data || response.data || [];
    },
  });

  // Fetch departments for filter
  const { data: departments } = useQuery({
    queryKey: ['patient-portal-departments-filter'],
    queryFn: async () => {
      const response = await patientPortalApi.getDepartments();
      return response.data?.data || response.data || [];
    },
  });

  // Filter records based on search
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const doctorName = record.doctor?.user
          ? `${record.doctor.user.firstName} ${record.doctor.user.lastName}`.toLowerCase()
          : '';
        const deptName = record.department?.name?.toLowerCase() || '';
        const complaint = record.chiefComplaint?.toLowerCase() || '';
        const diagnoses = record.diagnoses.map(d => d.description.toLowerCase()).join(' ');

        if (!doctorName.includes(searchLower) &&
            !deptName.includes(searchLower) &&
            !complaint.includes(searchLower) &&
            !diagnoses.includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }, [records, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleViewRecord = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const handleDownloadRecord = async (record: MedicalRecord) => {
    setIsDownloading(record.id);
    try {
      await patientPortalApi.downloadMedicalRecord(record.id);
      toast.success('Medical record downloaded successfully');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download medical record');
    } finally {
      setIsDownloading(null);
    }
  };

  const handlePrintRecord = () => {
    window.print();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setVisitTypeFilter('');
    setDoctorFilter('');
    setDepartmentFilter('');
    setDateRange({ startDate: '', endDate: '' });
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || visitTypeFilter || doctorFilter || departmentFilter || dateRange.startDate || dateRange.endDate;

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMMM d, yyyy h:mm a');
    } catch {
      return dateStr;
    }
  };

  const renderRecordCard = (record: MedicalRecord) => {
    const visitConfig = visitTypeConfig[record.visitType] || visitTypeConfig.OPD;
    const doctorName = record.doctor?.user
      ? `Dr. ${record.doctor.user.firstName} ${record.doctor.user.lastName}`
      : 'Doctor';

    return (
      <div
        key={record.id}
        className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6 hover:shadow-xl transition-all duration-300"
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Date Block */}
            <div className="flex-shrink-0 text-center min-w-[70px] p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <div className="text-xl font-bold">{format(parseISO(record.visitDate), 'd')}</div>
              <div className="text-xs opacity-90">{format(parseISO(record.visitDate), 'MMM yyyy')}</div>
            </div>

            {/* Record Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${visitConfig.bg} ${visitConfig.color}`}>
                  {visitConfig.label}
                </span>
                <span className="text-sm text-gray-500">{record.department?.name}</span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                {record.chiefComplaint || 'Medical Visit'}
              </h3>

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-1.5">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  <span>{doctorName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <span>{format(parseISO(record.visitDate), 'h:mm a')}</span>
                </div>
              </div>

              {/* Diagnoses Preview */}
              <div className="flex flex-wrap gap-2">
                {record.diagnoses.slice(0, 3).map((diagnosis) => (
                  <span
                    key={diagnosis.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-700"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${diagnosisTypeConfig[diagnosis.type]?.color || 'bg-gray-400'}`} />
                    {diagnosis.code}: {diagnosis.description.substring(0, 30)}
                    {diagnosis.description.length > 30 ? '...' : ''}
                  </span>
                ))}
                {record.diagnoses.length > 3 && (
                  <span className="text-xs text-gray-500">+{record.diagnoses.length - 3} more</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 lg:flex-shrink-0">
            <button
              onClick={() => handleViewRecord(record)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              <EyeIcon className="h-4 w-4" />
              View
            </button>
            <button
              onClick={() => handleDownloadRecord(record)}
              disabled={isDownloading === record.id}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {isDownloading === record.id ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
              ) : (
                <ArrowDownTrayIcon className="h-4 w-4" />
              )}
              PDF
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg">
                <ClipboardDocumentListIcon className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Medical Records</h1>
                <p className="text-gray-500 mt-1">View your complete medical history</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search by doctor, department, complaint, or diagnosis..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-gray-500">
                <FunnelIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <select
                value={visitTypeFilter}
                onChange={(e) => { setVisitTypeFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-[140px]"
              >
                <option value="">All Visit Types</option>
                <option value="OPD">Outpatient</option>
                <option value="IPD">Inpatient</option>
                <option value="EMERGENCY">Emergency</option>
                <option value="TELEMEDICINE">Telemedicine</option>
              </select>

              <select
                value={doctorFilter}
                onChange={(e) => { setDoctorFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-[160px]"
              >
                <option value="">All Doctors</option>
                {(doctors || []).map((doc: any) => (
                  <option key={doc.id} value={doc.id}>
                    Dr. {doc.user?.firstName} {doc.user?.lastName}
                  </option>
                ))}
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-w-[160px]"
              >
                <option value="">All Departments</option>
                {(departments || []).map((dept: any) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => { setDateRange({ ...dateRange, startDate: e.target.value }); setCurrentPage(1); }}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => { setDateRange({ ...dateRange, endDate: e.target.value }); setCurrentPage(1); }}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Records List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
                <p className="mt-4 text-gray-500">Loading medical records...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                <div>
                  <h3 className="font-semibold text-red-800">Error Loading Records</h3>
                  <p className="text-red-600">Unable to load your medical records. Please try again later.</p>
                </div>
              </div>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
              <div className="text-center">
                <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Medical Records Found</h3>
                <p className="text-gray-500 mb-4">
                  {hasActiveFilters
                    ? 'No records match your current filters. Try adjusting or clearing the filters.'
                    : 'You do not have any medical records yet.'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Results count */}
              <p className="text-sm text-gray-500 px-1">
                Showing {paginatedRecords.length} of {filteredRecords.length} records
              </p>

              {paginatedRecords.map((record) => renderRecordCard(record))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRightIcon className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Modal */}
        <Transition appear show={showDetailModal} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowDetailModal(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all max-h-[90vh] flex flex-col">
                    {selectedRecord && (
                      <>
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex-shrink-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xl font-bold text-white">Medical Record</h3>
                              <p className="text-indigo-100 text-sm mt-1">
                                {formatDateTime(selectedRecord.visitDate)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handlePrintRecord}
                                className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                                title="Print"
                              >
                                <PrinterIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDownloadRecord(selectedRecord)}
                                disabled={isDownloading === selectedRecord.id}
                                className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                                title="Download PDF"
                              >
                                {isDownloading === selectedRecord.id ? (
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                ) : (
                                  <ArrowDownTrayIcon className="h-5 w-5" />
                                )}
                              </button>
                              <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                              >
                                <XMarkIcon className="h-6 w-6" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Modal Content */}
                        <div className="overflow-y-auto flex-1 p-6 space-y-6">
                          {/* Visit Info */}
                          <div className="flex flex-wrap items-center gap-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              visitTypeConfig[selectedRecord.visitType]?.bg || 'bg-gray-100'
                            } ${visitTypeConfig[selectedRecord.visitType]?.color || 'text-gray-700'}`}>
                              {visitTypeConfig[selectedRecord.visitType]?.label || selectedRecord.visitType}
                            </span>
                            {selectedRecord.department && (
                              <span className="flex items-center gap-1.5 text-gray-600">
                                <BuildingOfficeIcon className="h-4 w-4" />
                                {selectedRecord.department.name}
                              </span>
                            )}
                          </div>

                          {/* Doctor Info */}
                          <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                                {(selectedRecord.doctor?.user?.firstName || 'D')[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Dr. {selectedRecord.doctor?.user?.firstName} {selectedRecord.doctor?.user?.lastName}
                                </p>
                                <p className="text-gray-600">{selectedRecord.doctor?.specialization}</p>
                              </div>
                            </div>
                          </div>

                          {/* Chief Complaint */}
                          {selectedRecord.chiefComplaint && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Chief Complaint
                              </h4>
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-gray-700">{selectedRecord.chiefComplaint}</p>
                              </div>
                            </div>
                          )}

                          {/* History of Present Illness */}
                          {selectedRecord.historyOfPresentIllness && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                History of Present Illness
                              </h4>
                              <p className="text-gray-700">{selectedRecord.historyOfPresentIllness}</p>
                            </div>
                          )}

                          {/* Vital Signs */}
                          {selectedRecord.vitalSigns && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <HeartIcon className="h-4 w-4 text-red-500" />
                                Vital Signs
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {selectedRecord.vitalSigns.bloodPressureSystolic && (
                                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase">Blood Pressure</p>
                                    <p className="text-lg font-bold text-gray-900">
                                      {selectedRecord.vitalSigns.bloodPressureSystolic}/{selectedRecord.vitalSigns.bloodPressureDiastolic}
                                    </p>
                                    <p className="text-xs text-gray-500">mmHg</p>
                                  </div>
                                )}
                                {selectedRecord.vitalSigns.heartRate && (
                                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase">Heart Rate</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedRecord.vitalSigns.heartRate}</p>
                                    <p className="text-xs text-gray-500">bpm</p>
                                  </div>
                                )}
                                {selectedRecord.vitalSigns.temperature && (
                                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase">Temperature</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedRecord.vitalSigns.temperature}</p>
                                    <p className="text-xs text-gray-500">F</p>
                                  </div>
                                )}
                                {selectedRecord.vitalSigns.respiratoryRate && (
                                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase">Resp Rate</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedRecord.vitalSigns.respiratoryRate}</p>
                                    <p className="text-xs text-gray-500">/min</p>
                                  </div>
                                )}
                                {selectedRecord.vitalSigns.oxygenSaturation && (
                                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase">SpO2</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedRecord.vitalSigns.oxygenSaturation}%</p>
                                  </div>
                                )}
                                {selectedRecord.vitalSigns.weight && (
                                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase">Weight</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedRecord.vitalSigns.weight}</p>
                                    <p className="text-xs text-gray-500">lbs</p>
                                  </div>
                                )}
                                {selectedRecord.vitalSigns.height && (
                                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase">Height</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedRecord.vitalSigns.height}</p>
                                    <p className="text-xs text-gray-500">inches</p>
                                  </div>
                                )}
                                {selectedRecord.vitalSigns.bmi && (
                                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                                    <p className="text-xs text-gray-500 uppercase">BMI</p>
                                    <p className="text-lg font-bold text-gray-900">{selectedRecord.vitalSigns.bmi.toFixed(1)}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Allergies */}
                          {selectedRecord.allergies && selectedRecord.allergies.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                                Allergies
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {selectedRecord.allergies.map((allergy, idx) => (
                                  <span key={idx} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium border border-red-200">
                                    {allergy}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Physical Examination */}
                          {selectedRecord.physicalExamination && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Physical Examination
                              </h4>
                              <p className="text-gray-700">{selectedRecord.physicalExamination}</p>
                            </div>
                          )}

                          {/* Diagnoses */}
                          {selectedRecord.diagnoses.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <DocumentDuplicateIcon className="h-4 w-4" />
                                Diagnoses
                              </h4>
                              <div className="space-y-3">
                                {selectedRecord.diagnoses.map((diagnosis) => (
                                  <div key={diagnosis.id} className="bg-gray-50 rounded-xl p-4 border-l-4" style={{ borderLeftColor: diagnosisTypeConfig[diagnosis.type]?.color.replace('bg-', '#') || '#9CA3AF' }}>
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-mono text-sm bg-gray-200 px-2 py-0.5 rounded">{diagnosis.code}</span>
                                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                            diagnosis.type === 'PRIMARY' ? 'bg-blue-100 text-blue-700' :
                                            diagnosis.type === 'SECONDARY' ? 'bg-gray-100 text-gray-700' :
                                            'bg-purple-100 text-purple-700'
                                          }`}>
                                            {diagnosisTypeConfig[diagnosis.type]?.label || diagnosis.type}
                                          </span>
                                        </div>
                                        <p className="font-medium text-gray-900">{diagnosis.description}</p>
                                        {diagnosis.notes && (
                                          <p className="text-sm text-gray-600 mt-1">{diagnosis.notes}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Procedures */}
                          {selectedRecord.procedures && selectedRecord.procedures.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <BeakerIcon className="h-4 w-4" />
                                Procedures
                              </h4>
                              <div className="space-y-2">
                                {selectedRecord.procedures.map((procedure) => (
                                  <div key={procedure.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                                    <div>
                                      <span className="font-mono text-sm bg-gray-200 px-2 py-0.5 rounded mr-2">{procedure.code}</span>
                                      <span className="font-medium text-gray-900">{procedure.name}</span>
                                    </div>
                                    {procedure.date && (
                                      <span className="text-sm text-gray-500">{formatDate(procedure.date)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Treatment Plan */}
                          {selectedRecord.treatmentPlan && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Treatment Plan
                              </h4>
                              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <p className="text-gray-700">{selectedRecord.treatmentPlan}</p>
                              </div>
                            </div>
                          )}

                          {/* Instructions */}
                          {selectedRecord.instructions && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <InformationCircleIcon className="h-4 w-4 text-blue-500" />
                                Patient Instructions
                              </h4>
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-gray-700">{selectedRecord.instructions}</p>
                              </div>
                            </div>
                          )}

                          {/* Follow-up */}
                          {selectedRecord.followUpDate && (
                            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                              <CalendarDaysIcon className="h-6 w-6 text-amber-600" />
                              <div>
                                <p className="text-sm text-amber-700 font-medium">Follow-up Scheduled</p>
                                <p className="text-amber-900 font-semibold">{formatDate(selectedRecord.followUpDate)}</p>
                              </div>
                            </div>
                          )}

                          {/* Attachments */}
                          {selectedRecord.attachments && selectedRecord.attachments.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                Attachments
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {selectedRecord.attachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
                                  >
                                    <div className="p-2 bg-indigo-100 rounded-lg">
                                      <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{attachment.name}</p>
                                      <p className="text-xs text-gray-500">{attachment.type}</p>
                                    </div>
                                    <ArrowDownTrayIcon className="h-5 w-5 text-gray-400" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          {selectedRecord.notes && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Additional Notes
                              </h4>
                              <p className="text-gray-600 italic">{selectedRecord.notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                          <button
                            onClick={() => setShowDetailModal(false)}
                            className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => handleDownloadRecord(selectedRecord)}
                            disabled={isDownloading === selectedRecord.id}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {isDownloading === selectedRecord.id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                Downloading...
                              </>
                            ) : (
                              <>
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                Download PDF
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
}
