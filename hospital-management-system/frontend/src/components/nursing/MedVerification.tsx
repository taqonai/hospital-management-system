import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  BeakerIcon,
  ScaleIcon,
  ArrowPathIcon,
  ClockIcon,
  ShieldExclamationIcon,
  InformationCircleIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { medSafetyApi } from '../../services/api';

interface MedVerificationProps {
  medication: any;
  patient: any;
  scannedPatientId?: string;
  scannedMedicationBarcode?: string;
  onVerificationComplete: (result: any) => void;
  onCancel: () => void;
}

interface VerificationRight {
  name: string;
  icon: any;
  status: 'pending' | 'verified' | 'warning' | 'failed';
  message: string;
  details?: any;
}

export default function MedVerification({
  medication,
  patient,
  scannedPatientId,
  scannedMedicationBarcode,
  onVerificationComplete,
  onCancel,
}: MedVerificationProps) {
  const [verifying, setVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [rights, setRights] = useState<VerificationRight[]>([
    { name: 'Right Patient', icon: UserIcon, status: 'pending', message: 'Verifying patient identity...' },
    { name: 'Right Drug', icon: BeakerIcon, status: 'pending', message: 'Verifying medication...' },
    { name: 'Right Dose', icon: ScaleIcon, status: 'pending', message: 'Checking dose range...' },
    { name: 'Right Route', icon: ArrowPathIcon, status: 'pending', message: 'Verifying route...' },
    { name: 'Right Time', icon: ClockIcon, status: 'pending', message: 'Checking schedule...' },
  ]);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    verifyMedication();
  }, []);

  const verifyMedication = async () => {
    try {
      // Simulate progressive verification for better UX
      const updateRight = (index: number, status: 'verified' | 'warning' | 'failed', message: string, details?: any) => {
        setRights(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], status, message, details };
          return updated;
        });
      };

      // Call API for verification
      const response = await medSafetyApi.verifyFiveRights({
        patientId: patient.id,
        patientName: patient.name || `${patient.firstName} ${patient.lastName}`,
        patientDob: patient.dateOfBirth || patient.dob,
        scannedPatientId: scannedPatientId || patient.id,
        medicationName: medication.name || medication.genericName,
        scannedBarcode: scannedMedicationBarcode,
        orderedDose: parseFloat(medication.dose) || 0,
        orderedUnit: medication.unit || 'mg',
        orderedRoute: medication.route || 'PO',
        scheduledTime: medication.scheduledTime,
        currentTime: new Date().toISOString(),
        patientWeight: patient.weight,
        patientAge: patient.age,
        allergies: patient.allergies || [],
        currentMedications: patient.currentMedications || [],
        renalFunction: patient.renalFunction,
      });

      const result = response.data;
      setVerificationResult(result);

      // Update rights based on result
      if (result.rights) {
        const rightsData = result.rights;

        // Right Patient
        updateRight(
          0,
          rightsData.patient?.status === 'VERIFIED' ? 'verified' : rightsData.patient?.status === 'WARNING' ? 'warning' : 'failed',
          rightsData.patient?.message || 'Patient verification complete',
          rightsData.patient
        );

        await new Promise(r => setTimeout(r, 200));

        // Right Drug
        updateRight(
          1,
          rightsData.drug?.status === 'VERIFIED' ? 'verified' : rightsData.drug?.status === 'WARNING' ? 'warning' : 'failed',
          rightsData.drug?.status === 'VERIFIED' ? 'Medication verified' : rightsData.drug?.message || 'Check drug alerts',
          rightsData.drug
        );

        await new Promise(r => setTimeout(r, 200));

        // Right Dose
        updateRight(
          2,
          rightsData.dose?.status === 'VERIFIED' ? 'verified' : rightsData.dose?.status === 'WARNING' ? 'warning' : 'failed',
          rightsData.dose?.status === 'VERIFIED' ? 'Dose within range' : rightsData.dose?.message || 'Check dose alerts',
          rightsData.dose
        );

        await new Promise(r => setTimeout(r, 200));

        // Right Route
        updateRight(
          3,
          rightsData.route?.status === 'VERIFIED' ? 'verified' : rightsData.route?.status === 'WARNING' ? 'warning' : 'failed',
          rightsData.route?.status === 'VERIFIED' ? 'Route appropriate' : rightsData.route?.message || 'Check route',
          rightsData.route
        );

        await new Promise(r => setTimeout(r, 200));

        // Right Time
        updateRight(
          4,
          rightsData.time?.status === 'VERIFIED' ? 'verified' : rightsData.time?.status === 'WARNING' ? 'warning' : 'failed',
          rightsData.time?.status === 'VERIFIED' ? 'Within scheduled window' : rightsData.time?.message || 'Check timing',
          rightsData.time
        );
      }

      setVerifying(false);
    } catch (error) {
      console.error('Verification error:', error);
      // Simulate offline verification
      setRights(prev => prev.map(r => ({
        ...r,
        status: 'warning' as const,
        message: 'Offline verification - manual check required',
      })));
      setVerifying(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />;
      case 'failed':
        return <XCircleIcon className="h-6 w-6 text-red-500" />;
      default:
        return <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />;
    }
  };

  const getStatusBg = (status: string) => {
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

  const overallStatus = verificationResult?.overallStatus || 'PENDING';
  const hasWarnings = rights.some(r => r.status === 'warning');
  const hasFailed = rights.some(r => r.status === 'failed');
  const isHighAlert = verificationResult?.isHighAlertMedication;

  const handleProceed = () => {
    if (hasFailed) {
      setShowOverrideDialog(true);
    } else {
      onVerificationComplete({
        ...verificationResult,
        verified: true,
        verifiedAt: new Date().toISOString(),
      });
    }
  };

  const handleOverride = async () => {
    if (!overrideReason.trim()) return;

    try {
      await medSafetyApi.recordOverride({
        patientId: patient.id,
        medicationId: medication.id,
        alertType: 'VERIFICATION_OVERRIDE',
        overrideReason: overrideReason,
        verificationData: verificationResult,
      });

      onVerificationComplete({
        ...verificationResult,
        verified: true,
        overridden: true,
        overrideReason,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Override error:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`p-4 text-white ${
          hasFailed ? 'bg-gradient-to-r from-red-600 to-red-700' :
          hasWarnings ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
          'bg-gradient-to-r from-green-600 to-emerald-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldExclamationIcon className="h-8 w-8" />
              <div>
                <h2 className="text-xl font-bold">5 Rights Verification</h2>
                <p className="text-sm opacity-90">{medication.name || medication.genericName}</p>
              </div>
            </div>
            {!verifying && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                hasFailed ? 'bg-red-800' :
                hasWarnings ? 'bg-amber-600' :
                'bg-green-800'
              }`}>
                {hasFailed ? 'FAILED' : hasWarnings ? 'WARNING' : 'VERIFIED'}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* High Alert Warning */}
          {isHighAlert && (
            <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ShieldExclamationIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-800">HIGH-ALERT MEDICATION</h4>
                  <p className="text-sm text-red-700 mt-1">
                    {verificationResult?.highAlertInfo?.category}: {verificationResult?.highAlertInfo?.risk}
                  </p>
                  <div className="mt-2 space-y-1">
                    {verificationResult?.highAlertInfo?.special_checks?.map((check: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-red-700">
                        <CheckIcon className="h-4 w-4" />
                        <span>{check}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LASA Alert */}
          {verificationResult?.lasaAlert && (
            <div className="bg-amber-100 border-2 border-amber-300 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-800">LOOK-ALIKE/SOUND-ALIKE ALERT</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    This medication can be confused with: {verificationResult.lasaAlert.similar_drugs?.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5 Rights Checklist */}
          <div className="space-y-2">
            {rights.map((right, index) => (
              <div
                key={right.name}
                className={`p-3 rounded-xl border transition-all ${getStatusBg(right.status)}`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white shadow-sm">
                    <right.icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">{right.name}</h4>
                      {getStatusIcon(right.status)}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{right.message}</p>
                  </div>
                </div>
                {/* Show details for warnings/failures */}
                {right.status !== 'pending' && right.status !== 'verified' && right.details?.alerts?.length > 0 && (
                  <div className="mt-2 ml-12 space-y-1">
                    {right.details.alerts.map((alert: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-red-600">
                        <XCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {right.status !== 'pending' && right.details?.warnings?.length > 0 && (
                  <div className="mt-2 ml-12 space-y-1">
                    {right.details.warnings.map((warning: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-amber-600">
                        <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{warning.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {verificationResult?.recommendations?.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-medium text-blue-800 flex items-center gap-2 mb-2">
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
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleProceed}
              disabled={verifying}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 ${
                hasFailed
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : hasWarnings
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {verifying
                ? 'Verifying...'
                : hasFailed
                ? 'Override & Proceed'
                : hasWarnings
                ? 'Acknowledge & Proceed'
                : 'Proceed to Administer'}
            </button>
          </div>
        </div>
      </div>

      {/* Override Dialog */}
      {showOverrideDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-red-100">
                <ShieldExclamationIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Override Required</h3>
                <p className="text-sm text-gray-500">Please provide a reason for overriding safety alerts</p>
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Enter override reason (required)..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
              />

              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> You are about to override safety alerts. This action will be logged and may require review.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowOverrideDialog(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverride}
                  disabled={!overrideReason.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
