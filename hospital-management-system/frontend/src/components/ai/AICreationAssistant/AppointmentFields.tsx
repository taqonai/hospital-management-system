import { ExtractedAppointmentData } from './types';

interface AppointmentFieldsProps {
  data: ExtractedAppointmentData;
  onChange: (data: ExtractedAppointmentData) => void;
}

const APPOINTMENT_TYPES = [
  'Consultation',
  'Follow-up',
  'Checkup',
  'Emergency',
  'Vaccination',
  'Lab Test',
  'Imaging',
  'Surgery',
  'Therapy',
];

export default function AppointmentFields({ data, onChange }: AppointmentFieldsProps) {
  const handleChange = (field: keyof ExtractedAppointmentData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  // Get today's date for min date in date picker
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Patient Name *</label>
        <input
          type="text"
          value={data.patientName || ''}
          onChange={(e) => handleChange('patientName', e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="John Smith"
        />
        <p className="text-xs text-gray-400 mt-1">Search by name or enter new patient</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Doctor Name *</label>
        <input
          type="text"
          value={data.doctorName || ''}
          onChange={(e) => handleChange('doctorName', e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Dr. Wilson"
        />
        <p className="text-xs text-gray-400 mt-1">Search by name or department</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
          <input
            type="date"
            min={today}
            value={data.date || ''}
            onChange={(e) => handleChange('date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Time *</label>
          <input
            type="time"
            value={data.time || ''}
            onChange={(e) => handleChange('time', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Appointment Type</label>
        <select
          value={data.appointmentType || ''}
          onChange={(e) => handleChange('appointmentType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select Type</option>
          {APPOINTMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Reason / Chief Complaint</label>
        <textarea
          value={data.reason || ''}
          onChange={(e) => handleChange('reason', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          placeholder="Describe symptoms or reason for visit..."
        />
      </div>
    </div>
  );
}
