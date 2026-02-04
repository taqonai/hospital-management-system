import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  UserIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { MedicalRecord } from './types';
import { visitTypeConfig, diagnosisTypeConfig, mockRecords } from './constants';
import RecordDetailModal from './RecordDetailModal';

export default function VisitHistoryTab() {
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

  const { data: doctors } = useQuery({
    queryKey: ['patient-portal-doctors-filter'],
    queryFn: async () => {
      const response = await patientPortalApi.getDoctors({});
      return response.data?.data || response.data || [];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['patient-portal-departments-filter'],
    queryFn: async () => {
      const response = await patientPortalApi.getDepartments();
      return response.data?.data || response.data || [];
    },
  });

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

  const clearFilters = () => {
    setSearchTerm('');
    setVisitTypeFilter('');
    setDoctorFilter('');
    setDepartmentFilter('');
    setDateRange({ startDate: '', endDate: '' });
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || visitTypeFilter || doctorFilter || departmentFilter || dateRange.startDate || dateRange.endDate;

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
            <div className="flex-shrink-0 text-center min-w-[70px] p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
              <div className="text-xl font-bold">{format(parseISO(record.visitDate), 'd')}</div>
              <div className="text-xs opacity-90">{format(parseISO(record.visitDate), 'MMM yyyy')}</div>
            </div>

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
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
        <div className="space-y-4">
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
          <p className="text-sm text-gray-500 px-1">
            Showing {paginatedRecords.length} of {filteredRecords.length} records
          </p>

          {paginatedRecords.map((record) => renderRecordCard(record))}

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

      {/* Detail Modal */}
      <RecordDetailModal
        show={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        record={selectedRecord}
      />
    </div>
  );
}
