import { useState } from 'react';
import {
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { medSafetyApi } from '../../services/api';

interface MedAdminRecordProps {
  medication: any;
  patient: any;
  verificationResult?: any;
  onComplete: () => void;
  onCancel: () => void;
}

export default function MedAdminRecord({
  medication,
  patient,
  verificationResult,
  onComplete,
  onCancel,
}: MedAdminRecordProps) {
  const [notes, setNotes] = useState('');
  const [administeredTime, setAdministeredTime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await medSafetyApi.recordAdministration({
        patientId: patient.id,
        prescriptionId: medication.prescriptionId,
        medicationId: medication.id,
        dose: parseFloat(medication.dose) || 0,
        unit: medication.unit || 'mg',
        route: medication.route,
        scheduledTime: medication.scheduledTime,
        administeredTime: new Date(administeredTime).toISOString(),
        notes: notes || undefined,
        overrideReason: verificationResult?.overrideReason,
        verificationResult,
      });

      onComplete();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record administration');
    } finally {
      setSubmitting(false);
    }
  };

  const isHighAlert = medication.isHighAlert || verificationResult?.isHighAlertMedication;
  const hasOverride = verificationResult?.overridden;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-8 w-8" />
              <div>
                <h2 className="text-xl font-bold">Record Administration</h2>
                <p className="text-sm opacity-90">{medication.name}</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* High Alert Warning */}
          {isHighAlert && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <ShieldExclamationIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <strong>High-Alert Medication:</strong> Independent double-check completed
              </div>
            </div>
          )}

          {/* Override Warning */}
          {hasOverride && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <strong>Override Applied:</strong> {verificationResult.overrideReason}
              </div>
            </div>
          )}

          {/* Patient Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Patient</h4>
            <p className="font-semibold text-gray-900">{patient.name}</p>
            <p className="text-sm text-gray-600">MRN: {patient.mrn}</p>
          </div>

          {/* Medication Details */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-blue-600 mb-2">Medication Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Drug:</span>
                <p className="font-medium text-gray-900">{medication.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Dose:</span>
                <p className="font-medium text-gray-900">{medication.dose}</p>
              </div>
              <div>
                <span className="text-gray-500">Route:</span>
                <p className="font-medium text-gray-900">{medication.route}</p>
              </div>
              <div>
                <span className="text-gray-500">Frequency:</span>
                <p className="font-medium text-gray-900">{medication.frequency}</p>
              </div>
            </div>
          </div>

          {/* Administration Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <ClockIcon className="h-4 w-4 inline mr-1" />
              Administration Time
            </label>
            <input
              type="datetime-local"
              value={administeredTime}
              onChange={(e) => setAdministeredTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <DocumentTextIcon className="h-4 w-4 inline mr-1" />
              Administration Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any relevant notes..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
            />
          </div>

          {/* Verification Summary */}
          {verificationResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircleIcon className="h-5 w-5" />
                <span>
                  5 Rights Verified at{' '}
                  {new Date(verificationResult.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                Confirm Administration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
