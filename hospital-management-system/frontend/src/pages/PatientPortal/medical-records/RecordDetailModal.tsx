import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import {
  ArrowDownTrayIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CalendarDaysIcon,
  BeakerIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import { MedicalRecord } from './types';
import { visitTypeConfig, diagnosisTypeConfig } from './constants';

interface RecordDetailModalProps {
  show: boolean;
  onClose: () => void;
  record: MedicalRecord | null;
}

export default function RecordDetailModal({ show, onClose, record }: RecordDetailModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleDownload = async () => {
    if (!record) return;
    setIsDownloading(true);
    try {
      await patientPortalApi.downloadMedicalRecord(record.id);
      toast.success('Medical record downloaded successfully');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download medical record');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Transition appear show={show} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all max-h-[90vh] flex flex-col">
                {record && (
                  <>
                    {/* Modal Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-white">Medical Record</h3>
                          <p className="text-indigo-100 text-sm mt-1">
                            {formatDateTime(record.visitDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handlePrint}
                            className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                            title="Print"
                          >
                            <PrinterIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                            title="Download PDF"
                          >
                            {isDownloading ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                            ) : (
                              <ArrowDownTrayIcon className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            onClick={onClose}
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
                          visitTypeConfig[record.visitType]?.bg || 'bg-gray-100'
                        } ${visitTypeConfig[record.visitType]?.color || 'text-gray-700'}`}>
                          {visitTypeConfig[record.visitType]?.label || record.visitType}
                        </span>
                        {record.department && (
                          <span className="flex items-center gap-1.5 text-gray-600">
                            <BuildingOfficeIcon className="h-4 w-4" />
                            {record.department.name}
                          </span>
                        )}
                      </div>

                      {/* Doctor Info */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                            {(record.doctor?.user?.firstName || 'D')[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              Dr. {record.doctor?.user?.firstName} {record.doctor?.user?.lastName}
                            </p>
                            <p className="text-gray-600">{record.doctor?.specialization}</p>
                          </div>
                        </div>
                      </div>

                      {/* Chief Complaint */}
                      {record.chiefComplaint && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Chief Complaint
                          </h4>
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-gray-700">{record.chiefComplaint}</p>
                          </div>
                        </div>
                      )}

                      {/* History of Present Illness */}
                      {record.historyOfPresentIllness && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            History of Present Illness
                          </h4>
                          <p className="text-gray-700">{record.historyOfPresentIllness}</p>
                        </div>
                      )}

                      {/* Vital Signs */}
                      {record.vitalSigns && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <HeartIcon className="h-4 w-4 text-red-500" />
                            Vital Signs
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {record.vitalSigns.bloodPressureSystolic && (
                              <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500 uppercase">Blood Pressure</p>
                                <p className="text-lg font-bold text-gray-900">
                                  {record.vitalSigns.bloodPressureSystolic}/{record.vitalSigns.bloodPressureDiastolic}
                                </p>
                                <p className="text-xs text-gray-500">mmHg</p>
                              </div>
                            )}
                            {record.vitalSigns.heartRate && (
                              <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500 uppercase">Heart Rate</p>
                                <p className="text-lg font-bold text-gray-900">{record.vitalSigns.heartRate}</p>
                                <p className="text-xs text-gray-500">bpm</p>
                              </div>
                            )}
                            {record.vitalSigns.temperature && (
                              <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500 uppercase">Temperature</p>
                                <p className="text-lg font-bold text-gray-900">{record.vitalSigns.temperature}</p>
                                <p className="text-xs text-gray-500">F</p>
                              </div>
                            )}
                            {record.vitalSigns.respiratoryRate && (
                              <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500 uppercase">Resp Rate</p>
                                <p className="text-lg font-bold text-gray-900">{record.vitalSigns.respiratoryRate}</p>
                                <p className="text-xs text-gray-500">/min</p>
                              </div>
                            )}
                            {record.vitalSigns.oxygenSaturation && (
                              <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500 uppercase">SpO2</p>
                                <p className="text-lg font-bold text-gray-900">{record.vitalSigns.oxygenSaturation}%</p>
                              </div>
                            )}
                            {record.vitalSigns.weight && (
                              <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500 uppercase">Weight</p>
                                <p className="text-lg font-bold text-gray-900">{record.vitalSigns.weight}</p>
                                <p className="text-xs text-gray-500">lbs</p>
                              </div>
                            )}
                            {record.vitalSigns.height && (
                              <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500 uppercase">Height</p>
                                <p className="text-lg font-bold text-gray-900">{record.vitalSigns.height}</p>
                                <p className="text-xs text-gray-500">inches</p>
                              </div>
                            )}
                            {record.vitalSigns.bmi && (
                              <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <p className="text-xs text-gray-500 uppercase">BMI</p>
                                <p className="text-lg font-bold text-gray-900">{Number(record.vitalSigns.bmi).toFixed(1)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Allergies */}
                      {record.allergies && record.allergies.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                            Allergies
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {record.allergies.map((allergy, idx) => (
                              <span key={idx} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium border border-red-200">
                                {allergy}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Physical Examination */}
                      {record.physicalExamination && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Physical Examination
                          </h4>
                          <p className="text-gray-700">{record.physicalExamination}</p>
                        </div>
                      )}

                      {/* Diagnoses */}
                      {record.diagnoses.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <DocumentDuplicateIcon className="h-4 w-4" />
                            Diagnoses
                          </h4>
                          <div className="space-y-3">
                            {record.diagnoses.map((diagnosis) => (
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
                      {record.procedures && record.procedures.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <BeakerIcon className="h-4 w-4" />
                            Procedures
                          </h4>
                          <div className="space-y-2">
                            {record.procedures.map((procedure) => (
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
                      {record.treatmentPlan && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Treatment Plan
                          </h4>
                          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <p className="text-gray-700">{record.treatmentPlan}</p>
                          </div>
                        </div>
                      )}

                      {/* Instructions */}
                      {record.instructions && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <InformationCircleIcon className="h-4 w-4 text-blue-500" />
                            Patient Instructions
                          </h4>
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-gray-700">{record.instructions}</p>
                          </div>
                        </div>
                      )}

                      {/* Follow-up */}
                      {record.followUpDate && (
                        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                          <CalendarDaysIcon className="h-6 w-6 text-amber-600" />
                          <div>
                            <p className="text-sm text-amber-700 font-medium">Follow-up Scheduled</p>
                            <p className="text-amber-900 font-semibold">{formatDate(record.followUpDate)}</p>
                          </div>
                        </div>
                      )}

                      {/* Attachments */}
                      {record.attachments && record.attachments.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Attachments
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {record.attachments.map((attachment) => (
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
                      {record.notes && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Additional Notes
                          </h4>
                          <p className="text-gray-600 italic">{record.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                      <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isDownloading ? (
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
  );
}
