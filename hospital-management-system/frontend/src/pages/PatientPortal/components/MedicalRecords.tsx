import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Transition } from '@headlessui/react';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ShieldCheckIcon,
  PrinterIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  BeakerIcon,
  ClipboardDocumentListIcon,
  HeartIcon,
  ArrowPathIcon,
  FunnelIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';

interface MedicalRecord {
  id: string;
  title: string;
  type: 'CONSULTATION' | 'LAB_REPORT' | 'IMAGING' | 'PRESCRIPTION' | 'DISCHARGE_SUMMARY' | 'VACCINATION' | 'HOSPITALIZATION' | 'PROCEDURE' | 'DIAGNOSIS' | 'OTHER';
  date: string;
  provider: string;
  department?: string;
  description?: string;
  summary?: string;
  fileUrl?: string;
  fileSize?: string;
  isVerified: boolean;
  details?: {
    diagnosis?: string[];
    medications?: Array<{ name: string; dosage: string; frequency: string; duration?: string }>;
    procedures?: string[];
    vitals?: Record<string, string>;
    notes?: string;
    results?: any;
    attachments?: Array<{ id: string; name: string; type: string; size?: string }>;
    labResults?: Array<{ test: string; result: string; unit?: string; normalRange?: string; status?: 'normal' | 'abnormal' | 'critical' }>;
  };
}

const recordTypeConfig: Record<string, { icon: React.ComponentType<any>; color: string; bg: string; bgGradient: string; label: string }> = {
  CONSULTATION: {
    icon: UserIcon,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    bgGradient: 'from-blue-500 to-blue-600',
    label: 'Consultation',
  },
  LAB_REPORT: {
    icon: BeakerIcon,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    bgGradient: 'from-purple-500 to-purple-600',
    label: 'Lab Report',
  },
  IMAGING: {
    icon: FolderIcon,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
    bgGradient: 'from-indigo-500 to-indigo-600',
    label: 'Imaging',
  },
  PRESCRIPTION: {
    icon: DocumentTextIcon,
    color: 'text-green-600',
    bg: 'bg-green-100',
    bgGradient: 'from-green-500 to-green-600',
    label: 'Prescription',
  },
  DISCHARGE_SUMMARY: {
    icon: ClipboardDocumentListIcon,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    bgGradient: 'from-amber-500 to-amber-600',
    label: 'Discharge Summary',
  },
  VACCINATION: {
    icon: ShieldCheckIcon,
    color: 'text-teal-600',
    bg: 'bg-teal-100',
    bgGradient: 'from-teal-500 to-teal-600',
    label: 'Vaccination',
  },
  HOSPITALIZATION: {
    icon: BuildingOffice2Icon,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    bgGradient: 'from-orange-500 to-orange-600',
    label: 'Hospitalization',
  },
  PROCEDURE: {
    icon: ClipboardDocumentListIcon,
    color: 'text-pink-600',
    bg: 'bg-pink-100',
    bgGradient: 'from-pink-500 to-pink-600',
    label: 'Procedure',
  },
  DIAGNOSIS: {
    icon: HeartIcon,
    color: 'text-red-600',
    bg: 'bg-red-100',
    bgGradient: 'from-red-500 to-red-600',
    label: 'Diagnosis',
  },
  OTHER: {
    icon: FolderIcon,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    bgGradient: 'from-gray-500 to-gray-600',
    label: 'Other',
  },
};

const recordTypes = [
  { id: 'all', label: 'All Records' },
  { id: 'CONSULTATION', label: 'Consultations' },
  { id: 'LAB_REPORT', label: 'Lab Reports' },
  { id: 'IMAGING', label: 'Imaging' },
  { id: 'PRESCRIPTION', label: 'Prescriptions' },
  { id: 'DISCHARGE_SUMMARY', label: 'Discharge Summaries' },
  { id: 'VACCINATION', label: 'Vaccinations' },
  { id: 'HOSPITALIZATION', label: 'Hospitalizations' },
  { id: 'PROCEDURE', label: 'Procedures' },
  { id: 'DIAGNOSIS', label: 'Diagnoses' },
];

export default function MedicalRecords() {
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const { data: records, isLoading, refetch, error } = useQuery({
    queryKey: ['patient-medical-records', selectedType, searchTerm, dateRange],
    queryFn: async () => {
      const response = await patientPortalApi.getMedicalRecords({
        type: selectedType !== 'all' ? selectedType : undefined,
        search: searchTerm || undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      return response.data?.data || response.data || [];
    },
  });

  const getTypeConfig = (type: MedicalRecord['type']) => {
    return recordTypeConfig[type] || recordTypeConfig.OTHER;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMMM d, yyyy');
    } catch {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  const formatShortDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const handleToggleExpand = (recordId: string) => {
    setExpandedRecord(expandedRecord === recordId ? null : recordId);
  };

  const handleViewDetails = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const handleDownload = async (recordId: string, fileName?: string) => {
    try {
      toast.loading('Preparing download...', { id: 'download' });
      const response = await patientPortalApi.downloadMedicalRecord(recordId);

      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || `medical-record-${recordId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Download started', { id: 'download' });
    } catch (err) {
      toast.error('Failed to download record', { id: 'download' });
    }
  };

  const handlePrint = (record: MedicalRecord) => {
    const config = getTypeConfig(record.type);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Medical Record - ${record.title}</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 40px;
                color: #1f2937;
                line-height: 1.6;
              }
              .header {
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 20px;
                margin-bottom: 30px;
              }
              .header h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
              .header .meta { color: #6b7280; font-size: 14px; }
              .badge {
                display: inline-block;
                padding: 4px 12px;
                background: #f3f4f6;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: 500;
                margin-top: 8px;
              }
              .section { margin-bottom: 24px; }
              .section-title {
                font-size: 14px;
                font-weight: 600;
                color: #374151;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #e5e7eb;
              }
              .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
              .grid-item label { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
              .grid-item value { display: block; font-weight: 500; color: #111827; }
              .content-box {
                background: #f9fafb;
                padding: 16px;
                border-radius: 8px;
                white-space: pre-wrap;
              }
              .list { list-style: none; }
              .list li {
                padding: 8px 0;
                border-bottom: 1px solid #f3f4f6;
              }
              .list li:last-child { border-bottom: none; }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 12px;
                color: #9ca3af;
                text-align: center;
              }
              @media print {
                body { padding: 20px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${record.title}</h1>
              <div class="meta">
                ${formatDate(record.date)} | ${record.provider}
                ${record.department ? ` | ${record.department}` : ''}
              </div>
              <span class="badge">${config.label}</span>
            </div>

            ${record.description || record.summary ? `
              <div class="section">
                <div class="section-title">Summary</div>
                <div class="content-box">${record.description || record.summary}</div>
              </div>
            ` : ''}

            <div class="section">
              <div class="section-title">Record Details</div>
              <div class="grid">
                <div class="grid-item">
                  <label>Provider</label>
                  <value>${record.provider}</value>
                </div>
                <div class="grid-item">
                  <label>Department</label>
                  <value>${record.department || 'N/A'}</value>
                </div>
                <div class="grid-item">
                  <label>Record Type</label>
                  <value>${config.label}</value>
                </div>
                <div class="grid-item">
                  <label>Status</label>
                  <value>${record.isVerified ? 'Verified' : 'Pending Verification'}</value>
                </div>
              </div>
            </div>

            ${record.details?.diagnosis && record.details.diagnosis.length > 0 ? `
              <div class="section">
                <div class="section-title">Diagnosis</div>
                <ul class="list">
                  ${record.details.diagnosis.map(d => `<li>${d}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${record.details?.medications && record.details.medications.length > 0 ? `
              <div class="section">
                <div class="section-title">Medications</div>
                <ul class="list">
                  ${record.details.medications.map(m => `
                    <li>
                      <strong>${m.name}</strong><br>
                      ${m.dosage} - ${m.frequency}${m.duration ? ` for ${m.duration}` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}

            ${record.details?.procedures && record.details.procedures.length > 0 ? `
              <div class="section">
                <div class="section-title">Procedures</div>
                <ul class="list">
                  ${record.details.procedures.map(p => `<li>${p}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${record.details?.vitals && Object.keys(record.details.vitals).length > 0 ? `
              <div class="section">
                <div class="section-title">Vital Signs</div>
                <div class="grid">
                  ${Object.entries(record.details.vitals).map(([key, value]) => `
                    <div class="grid-item">
                      <label>${key}</label>
                      <value>${value}</value>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${record.details?.labResults && record.details.labResults.length > 0 ? `
              <div class="section">
                <div class="section-title">Lab Results</div>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f3f4f6;">
                      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Test</th>
                      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Result</th>
                      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Normal Range</th>
                      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${record.details.labResults.map(r => `
                      <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${r.test}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${r.result} ${r.unit || ''}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${r.normalRange || '-'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: ${r.status === 'critical' ? '#dc2626' : r.status === 'abnormal' ? '#d97706' : '#059669'};">
                          ${r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '-'}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            ${record.details?.notes ? `
              <div class="section">
                <div class="section-title">Clinical Notes</div>
                <div class="content-box">${record.details.notes}</div>
              </div>
            ` : ''}

            <div class="footer">
              Printed on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')} | For medical reference only
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  const filteredRecords = (records || []).filter((record: MedicalRecord) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      record.title.toLowerCase().includes(searchLower) ||
      record.provider.toLowerCase().includes(searchLower) ||
      (record.department && record.department.toLowerCase().includes(searchLower)) ||
      (record.description && record.description.toLowerCase().includes(searchLower))
    );
  });

  const renderRecordCard = (record: MedicalRecord) => {
    const config = getTypeConfig(record.type);
    const IconComponent = config.icon;
    const isExpanded = expandedRecord === record.id;
    const hasDetails = record.details && (
      record.details.diagnosis?.length ||
      record.details.medications?.length ||
      record.details.procedures?.length ||
      record.details.vitals ||
      record.details.notes ||
      record.details.labResults?.length
    );

    return (
      <div
        key={record.id}
        className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl"
      >
        {/* Card Header */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Type Icon */}
            <div className={`flex-shrink-0 p-3 rounded-xl ${config.bg}`}>
              <IconComponent className={`h-6 w-6 ${config.color}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{record.title}</h3>
                    <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                    {record.isVerified && (
                      <span className="flex items-center gap-1 text-green-600" title="Verified">
                        <ShieldCheckIcon className="h-4 w-4" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap mt-2">
                    <div className="flex items-center gap-1.5">
                      <CalendarDaysIcon className="h-4 w-4" />
                      <span>{formatShortDate(record.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="h-4 w-4" />
                      <span>{record.provider}</span>
                    </div>
                    {record.department && (
                      <div className="flex items-center gap-1.5">
                        <BuildingOffice2Icon className="h-4 w-4" />
                        <span>{record.department}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleViewDetails(record)}
                    className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="View Details"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDownload(record.id)}
                    className="p-2 rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handlePrint(record)}
                    className="p-2 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    title="Print"
                  >
                    <PrinterIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Summary */}
              {(record.description || record.summary) && (
                <p className="mt-3 text-gray-600 text-sm line-clamp-2">
                  {record.description || record.summary}
                </p>
              )}

              {/* Expand/Collapse Button */}
              {hasDetails && (
                <button
                  onClick={() => handleToggleExpand(record.id)}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUpIcon className="h-4 w-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon className="h-4 w-4" />
                      Show More Details
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        <Transition
          show={isExpanded && !!hasDetails}
          enter="transition-all duration-300 ease-out"
          enterFrom="max-h-0 opacity-0"
          enterTo="max-h-[2000px] opacity-100"
          leave="transition-all duration-200 ease-in"
          leaveFrom="max-h-[2000px] opacity-100"
          leaveTo="max-h-0 opacity-0"
        >
          <div className="border-t border-gray-100 bg-gray-50/50 p-6 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Diagnosis */}
              {record.details?.diagnosis && record.details.diagnosis.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <HeartIcon className="h-5 w-5" />
                    Diagnosis
                  </h4>
                  <ul className="space-y-2">
                    {record.details.diagnosis.map((d, i) => (
                      <li key={i} className="text-sm text-red-800 flex items-start gap-2">
                        <span className="text-red-400 mt-1">-</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Medications */}
              {record.details?.medications && record.details.medications.length > 0 && (
                <div className="bg-green-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5" />
                    Medications
                  </h4>
                  <ul className="space-y-3">
                    {record.details.medications.map((med, i) => (
                      <li key={i} className="text-sm text-green-800">
                        <span className="font-medium">{med.name}</span>
                        <br />
                        <span className="text-green-700">
                          {med.dosage} - {med.frequency}
                          {med.duration && ` for ${med.duration}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Procedures */}
              {record.details?.procedures && record.details.procedures.length > 0 && (
                <div className="bg-purple-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <ClipboardDocumentListIcon className="h-5 w-5" />
                    Procedures
                  </h4>
                  <ul className="space-y-2">
                    {record.details.procedures.map((proc, i) => (
                      <li key={i} className="text-sm text-purple-800 flex items-start gap-2">
                        <span className="text-purple-400 mt-1">-</span>
                        {proc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Vitals */}
              {record.details?.vitals && Object.keys(record.details.vitals).length > 0 && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-3">Vital Signs</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(record.details.vitals).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-xs text-blue-600">{key}</p>
                        <p className="text-sm font-medium text-blue-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab Results */}
              {record.details?.labResults && record.details.labResults.length > 0 && (
                <div className="md:col-span-2 bg-amber-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                    <BeakerIcon className="h-5 w-5" />
                    Lab Results
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-amber-700">
                          <th className="pb-2 font-medium">Test</th>
                          <th className="pb-2 font-medium">Result</th>
                          <th className="pb-2 font-medium">Normal Range</th>
                          <th className="pb-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-amber-900">
                        {record.details.labResults.map((result, i) => (
                          <tr key={i} className="border-t border-amber-200">
                            <td className="py-2">{result.test}</td>
                            <td className="py-2">
                              {result.result} {result.unit}
                            </td>
                            <td className="py-2">{result.normalRange || '-'}</td>
                            <td className="py-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  result.status === 'critical'
                                    ? 'bg-red-100 text-red-700'
                                    : result.status === 'abnormal'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {result.status
                                  ? result.status.charAt(0).toUpperCase() + result.status.slice(1)
                                  : 'Normal'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes */}
              {record.details?.notes && (
                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Clinical Notes</h4>
                  <div className="bg-white rounded-xl p-4 text-sm text-gray-600 whitespace-pre-wrap border border-gray-200">
                    {record.details.notes}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {record.details?.attachments && record.details.attachments.length > 0 && (
                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Attachments</h4>
                  <div className="flex flex-wrap gap-2">
                    {record.details.attachments.map((attachment) => (
                      <button
                        key={attachment.id}
                        onClick={() => handleDownload(attachment.id, attachment.name)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                      >
                        <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                        <span className="truncate max-w-[150px]">{attachment.name}</span>
                        {attachment.size && (
                          <span className="text-gray-400 text-xs">({attachment.size})</span>
                        )}
                        <ArrowDownTrayIcon className="h-4 w-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Transition>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Medical Records</h2>
            <p className="text-gray-500 mt-1">Access and download your complete medical history</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <DocumentTextIcon className="h-5 w-5" />
            <span>{filteredRecords.length} records found</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search records by title, provider, or department..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Record Type Filter */}
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="pl-9 pr-8 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none min-w-[160px]"
              >
                {recordTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Start Date"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="End Date"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              className="p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
              <p className="mt-4 text-gray-500">Loading medical records...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
            <div className="text-center">
              <ExclamationCircleIcon className="h-16 w-16 mx-auto text-red-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Records</h3>
              <p className="text-gray-500 mb-6">
                There was an error loading your medical records. Please try again.
              </p>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                <ArrowPathIcon className="h-5 w-5" />
                Retry
              </button>
            </div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12">
            <div className="text-center">
              <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Records Found</h3>
              <p className="text-gray-500">
                {searchTerm || selectedType !== 'all' || dateRange.startDate || dateRange.endDate
                  ? 'No records match your search criteria. Try adjusting your filters.'
                  : 'Your medical records will appear here.'}
              </p>
            </div>
          </div>
        ) : (
          filteredRecords.map((record: MedicalRecord) => renderRecordCard(record))
        )}
      </div>

      {/* Detail Modal */}
      <Transition appear show={showDetailModal} as={Fragment}>
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowDetailModal(false)}
              />
            </Transition.Child>

            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="relative w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {selectedRecord && (
                  <>
                    {/* Modal Header */}
                    <div className="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-start justify-between z-10">
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-3 rounded-xl ${getTypeConfig(selectedRecord.type).bg}`}
                        >
                          {(() => {
                            const IconComp = getTypeConfig(selectedRecord.type).icon;
                            return (
                              <IconComp
                                className={`h-6 w-6 ${getTypeConfig(selectedRecord.type).color}`}
                              />
                            );
                          })()}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{selectedRecord.title}</h3>
                          <p className="text-sm text-gray-500">
                            {formatDate(selectedRecord.date)} - {selectedRecord.provider}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDetailModal(false)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <XMarkIcon className="h-6 w-6 text-gray-500" />
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                      {/* Summary */}
                      {(selectedRecord.description || selectedRecord.summary) && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Summary</h4>
                          <p className="text-gray-600 bg-gray-50 rounded-xl p-4">
                            {selectedRecord.description || selectedRecord.summary}
                          </p>
                        </div>
                      )}

                      {/* Record Info Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs text-gray-500 mb-1">Provider</p>
                          <p className="font-medium text-gray-900">{selectedRecord.provider}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs text-gray-500 mb-1">Department</p>
                          <p className="font-medium text-gray-900">
                            {selectedRecord.department || 'N/A'}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs text-gray-500 mb-1">Record Type</p>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              getTypeConfig(selectedRecord.type).bg
                            } ${getTypeConfig(selectedRecord.type).color}`}
                          >
                            {getTypeConfig(selectedRecord.type).label}
                          </span>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs text-gray-500 mb-1">Status</p>
                          <div className="flex items-center gap-1">
                            {selectedRecord.isVerified ? (
                              <>
                                <ShieldCheckIcon className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-green-600">Verified</span>
                              </>
                            ) : (
                              <span className="font-medium text-amber-600">Pending</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detailed Information */}
                      {selectedRecord.details && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Diagnosis */}
                          {selectedRecord.details.diagnosis &&
                            selectedRecord.details.diagnosis.length > 0 && (
                              <div className="bg-red-50 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
                                  <HeartIcon className="h-5 w-5" />
                                  Diagnosis
                                </h4>
                                <ul className="space-y-2">
                                  {selectedRecord.details.diagnosis.map((d, i) => (
                                    <li key={i} className="text-sm text-red-800">
                                      {d}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {/* Medications */}
                          {selectedRecord.details.medications &&
                            selectedRecord.details.medications.length > 0 && (
                              <div className="bg-green-50 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                                  <DocumentTextIcon className="h-5 w-5" />
                                  Medications
                                </h4>
                                <ul className="space-y-2">
                                  {selectedRecord.details.medications.map((med, i) => (
                                    <li key={i} className="text-sm text-green-800">
                                      <span className="font-medium">{med.name}</span>
                                      <br />
                                      <span className="text-green-700">
                                        {med.dosage} - {med.frequency}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {/* Vitals */}
                          {selectedRecord.details.vitals &&
                            Object.keys(selectedRecord.details.vitals).length > 0 && (
                              <div className="bg-blue-50 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-blue-900 mb-3">
                                  Vital Signs
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                  {Object.entries(selectedRecord.details.vitals).map(
                                    ([key, value]) => (
                                      <div key={key}>
                                        <p className="text-xs text-blue-600">{key}</p>
                                        <p className="text-sm font-medium text-blue-900">{value}</p>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Procedures */}
                          {selectedRecord.details.procedures &&
                            selectedRecord.details.procedures.length > 0 && (
                              <div className="bg-purple-50 rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                                  <ClipboardDocumentListIcon className="h-5 w-5" />
                                  Procedures
                                </h4>
                                <ul className="space-y-2">
                                  {selectedRecord.details.procedures.map((proc, i) => (
                                    <li key={i} className="text-sm text-purple-800">
                                      {proc}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                        </div>
                      )}

                      {/* Notes */}
                      {selectedRecord.details?.notes && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">
                            Clinical Notes
                          </h4>
                          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 whitespace-pre-wrap">
                            {selectedRecord.details.notes}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Modal Actions */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6 flex justify-end gap-3">
                      <button
                        onClick={() => handlePrint(selectedRecord)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                      >
                        <PrinterIcon className="h-5 w-5" />
                        Print
                      </button>
                      <button
                        onClick={() => handleDownload(selectedRecord.id)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-colors"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5" />
                        Download PDF
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Transition.Child>
          </div>
        </div>
      </Transition>
    </div>
  );
}
