import {
  HeartIcon,
  BeakerIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  UserIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface VitalsData {
  temperature: number | null;
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bloodSugar: number | null;
  painLevel: number | null;
  recordedBy: string;
  recordedAt: string;
  // Nurse notes
  notes?: string | null;
  // Patient status from nurse entry
  isPregnant?: boolean | null;
  expectedDueDate?: string | null;
  currentMedications?: Array<{ name: string; dosage?: string; frequency?: string }> | null;
  currentTreatment?: string | null;
}

interface RiskPrediction {
  riskScore: number;
  riskLevel: string;
  recommendations: string[];
}

interface PatientInfo {
  gender: string;
  dateOfBirth: string;
}

interface VitalsSummaryCardProps {
  vitals: VitalsData | null;
  riskPrediction: RiskPrediction | null;
  patient?: PatientInfo | null;
  appointmentNotes?: string | null; // Patient's additional notes from booking
  className?: string;
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function shouldShowPregnancyStatus(patient?: PatientInfo | null): boolean {
  if (!patient) return false;
  const isFemale = patient.gender?.toUpperCase() === 'FEMALE';
  const age = calculateAge(patient.dateOfBirth);
  // Only show pregnancy status for females of childbearing age (13-51)
  return isFemale && age >= 13 && age <= 51;
}

function VitalItem({
  label,
  value,
  unit,
  isAbnormal,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  isAbnormal?: boolean;
}) {
  if (value === null || value === undefined) return null;

  return (
    <div className={clsx('text-center p-2 rounded min-w-0', isAbnormal ? 'bg-red-50' : 'bg-gray-50')}>
      <div className={clsx('font-semibold', isAbnormal ? 'text-red-600' : 'text-gray-900')}>
        <span className="text-base sm:text-lg">{value}</span>
        {unit && <span className="text-[10px] sm:text-xs ml-0.5 text-gray-500">{unit}</span>}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function isVitalAbnormal(type: string, value: number | null): boolean {
  if (value === null) return false;

  switch (type) {
    case 'heartRate':
      return value < 60 || value > 100;
    case 'bloodPressureSys':
      return value < 90 || value > 140;
    case 'bloodPressureDia':
      return value < 60 || value > 90;
    case 'temperature':
      return value < 36 || value > 38;
    case 'oxygenSaturation':
      return value < 94;
    case 'respiratoryRate':
      return value < 12 || value > 20;
    default:
      return false;
  }
}

export function VitalsSummaryCard({ vitals, riskPrediction, patient, appointmentNotes, className }: VitalsSummaryCardProps) {
  // Determine if pregnancy status should be shown based on patient gender/age
  const showPregnancy = shouldShowPregnancyStatus(patient);

  // When vitals are not recorded yet, show warning + patient's booking notes (if any)
  if (!vitals) {
    return (
      <div className={clsx('space-y-3', className)}>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-700">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span className="font-medium">Vitals Not Recorded</span>
          </div>
          <p className="text-sm text-yellow-600 mt-1">
            Pre-consultation vitals have not been recorded for this booking.
          </p>
        </div>
        {/* Show patient's booking notes even before vitals are recorded */}
        {appointmentNotes && (
          <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-sm text-gray-800">Notes</span>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-xs font-medium text-blue-700 mb-1">Patient Notes (from booking)</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{appointmentNotes}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const getRiskLevelColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'MODERATE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={clsx('bg-white border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartIcon className="w-5 h-5 text-red-500" />
          <span className="font-medium text-gray-900">Vitals</span>
        </div>
        <div className="text-xs text-gray-500">
          Recorded {new Date(vitals.recordedAt).toLocaleString()}
        </div>
      </div>

      {/* Vitals Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-4">
          {/* BP gets special treatment - show value and unit on separate lines for clarity */}
          {vitals.bloodPressureSys && vitals.bloodPressureDia && (
            <div className={clsx(
              'text-center p-2 rounded',
              isVitalAbnormal('bloodPressureSys', vitals.bloodPressureSys) ||
              isVitalAbnormal('bloodPressureDia', vitals.bloodPressureDia)
                ? 'bg-red-50'
                : 'bg-gray-50'
            )}>
              <div className={clsx(
                'text-lg font-semibold',
                isVitalAbnormal('bloodPressureSys', vitals.bloodPressureSys) ||
                isVitalAbnormal('bloodPressureDia', vitals.bloodPressureDia)
                  ? 'text-red-600'
                  : 'text-gray-900'
              )}>
                {vitals.bloodPressureSys}/{vitals.bloodPressureDia}
              </div>
              <div className="text-xs text-gray-500">BP (mmHg)</div>
            </div>
          )}
          <VitalItem
            label="Heart Rate"
            value={vitals.heartRate}
            unit="bpm"
            isAbnormal={isVitalAbnormal('heartRate', vitals.heartRate)}
          />
          <VitalItem
            label="Temp"
            value={vitals.temperature ? Number(vitals.temperature).toFixed(1) : null}
            unit="°C"
            isAbnormal={isVitalAbnormal('temperature', vitals.temperature)}
          />
          <VitalItem
            label="SpO2"
            value={vitals.oxygenSaturation ? Number(vitals.oxygenSaturation).toFixed(0) : null}
            unit="%"
            isAbnormal={isVitalAbnormal('oxygenSaturation', vitals.oxygenSaturation)}
          />
          <VitalItem
            label="Resp Rate"
            value={vitals.respiratoryRate}
            unit="/min"
            isAbnormal={isVitalAbnormal('respiratoryRate', vitals.respiratoryRate)}
          />
          <VitalItem
            label="Pain"
            value={vitals.painLevel}
            unit="/10"
            isAbnormal={vitals.painLevel !== null && vitals.painLevel >= 7}
          />
        </div>

        {/* Secondary vitals */}
        {(vitals.weight || vitals.height || vitals.bloodSugar) && (
          <div className="grid grid-cols-3 gap-2 mb-4 pt-2 border-t">
            <VitalItem label="Weight" value={vitals.weight} unit="kg" />
            <VitalItem label="Height" value={vitals.height} unit="cm" />
            <VitalItem label="Blood Sugar" value={vitals.bloodSugar} unit="mg/dL" />
          </div>
        )}

        {/* Risk Assessment */}
        {riskPrediction && (
          <div
            className={clsx(
              'mt-3 p-3 rounded-lg border',
              getRiskLevelColor(riskPrediction.riskLevel)
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon className="w-4 h-4" />
                <span className="font-medium text-sm">Risk Assessment</span>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase">
                {riskPrediction.riskLevel}
              </span>
            </div>
            {riskPrediction.recommendations && riskPrediction.recommendations.length > 0 && (
              <div className="mt-2 text-xs">
                <span className="font-medium">Recommendations: </span>
                {riskPrediction.recommendations.slice(0, 2).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Patient Status - Pregnancy (for females only), Medications, Treatment */}
        {(showPregnancy && vitals.isPregnant !== null && vitals.isPregnant !== undefined) ||
         (vitals.currentMedications && vitals.currentMedications.length > 0) ||
         vitals.currentTreatment ? (
          <div className="mt-3 p-3 rounded-lg border border-purple-200 bg-purple-50">
            <div className="flex items-center gap-2 mb-3">
              <UserIcon className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-sm text-purple-800">Patient Status</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Pregnancy Status - Only show for females of childbearing age */}
              {showPregnancy && vitals.isPregnant !== null && vitals.isPregnant !== undefined && (
                <div className={clsx(
                  'p-2 rounded-lg border',
                  vitals.isPregnant ? 'bg-pink-50 border-pink-200' : 'bg-gray-50 border-gray-200'
                )}>
                  <div className="text-xs font-medium text-gray-500 mb-1">Pregnancy Status</div>
                  {vitals.isPregnant ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-pink-600 font-semibold">Pregnant</span>
                        <span className="text-pink-400">🤰</span>
                      </div>
                      {vitals.expectedDueDate && (
                        <div className="text-xs text-pink-600 mt-1">
                          Due: {new Date(vitals.expectedDueDate).toLocaleDateString()}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-600 text-sm">Not Pregnant</span>
                  )}
                </div>
              )}

              {/* Current Medications */}
              {vitals.currentMedications && vitals.currentMedications.length > 0 && (
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-xs font-medium text-gray-500 mb-1">Current Medications</div>
                  <div className="space-y-1">
                    {vitals.currentMedications.map((med, idx) => (
                      <div key={idx} className="text-sm text-blue-800">
                        <span className="font-medium">{med.name}</span>
                        {med.dosage && <span className="text-blue-600"> - {med.dosage}</span>}
                        {med.frequency && <span className="text-blue-500 text-xs"> ({med.frequency})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ongoing Treatment */}
              {vitals.currentTreatment && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-xs font-medium text-gray-500 mb-1">Ongoing Treatment</div>
                  <div className="text-sm text-amber-800">{vitals.currentTreatment}</div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Notes Section - Patient booking notes and Nurse notes */}
        {(appointmentNotes || vitals?.notes) && (
          <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-sm text-gray-800">Notes</span>
            </div>
            <div className="space-y-3">
              {/* Patient's Additional Notes from Booking */}
              {appointmentNotes && (
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="text-xs font-medium text-blue-700 mb-1">Patient Notes (from booking)</div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">{appointmentNotes}</div>
                </div>
              )}
              {/* Nurse Notes from Vital Recording */}
              {vitals?.notes && (
                <div className="p-2 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-xs font-medium text-green-700 mb-1">Nurse Notes (from vitals)</div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">{vitals.notes}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VitalsSummaryCard;
