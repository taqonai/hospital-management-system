import { BeakerIcon } from '@heroicons/react/24/outline';

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string | null;
}

interface Prescription {
  medications: Medication[];
}

interface PrescriptionCardProps {
  prescriptions: Prescription[];
}

export function PrescriptionCard({ prescriptions }: PrescriptionCardProps) {
  // Check if there are any prescriptions with medications
  const hasPrescriptions = prescriptions && prescriptions.length > 0;
  const allMedications: Medication[] = hasPrescriptions
    ? prescriptions.flatMap((p) => p.medications || [])
    : [];

  if (!hasPrescriptions || allMedications.length === 0) {
    return null; // Don't render anything if no prescriptions
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-2 border-b flex items-center gap-2">
        <BeakerIcon className="w-5 h-5 text-purple-600" />
        <span className="font-medium text-gray-900">Prescriptions</span>
        <span className="ml-auto text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-medium">
          {allMedications.length} {allMedications.length === 1 ? 'Medication' : 'Medications'}
        </span>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {allMedications.map((medication, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg p-3 hover:border-purple-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900 text-base">
                    {idx + 1}. {medication.name}
                  </h4>
                </div>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                  Rx
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 font-medium min-w-[80px]">Dosage:</span>
                  <span className="text-gray-900">{medication.dosage}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 font-medium min-w-[80px]">Frequency:</span>
                  <span className="text-gray-900">{medication.frequency}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 font-medium min-w-[80px]">Duration:</span>
                  <span className="text-gray-900">{medication.duration}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 font-medium min-w-[80px]">Quantity:</span>
                  <span className="text-gray-900">{medication.quantity}</span>
                </div>
              </div>

              {medication.instructions && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-500 uppercase">Instructions:</span>
                  <p className="text-sm text-gray-700 mt-1 italic">{medication.instructions}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PrescriptionCard;
