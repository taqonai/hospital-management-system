import { ExtractedDoctorData } from './types';

interface DoctorFieldsProps {
  data: ExtractedDoctorData;
  onChange: (data: ExtractedDoctorData) => void;
}

const DEPARTMENTS = [
  'Cardiology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Dermatology',
  'Ophthalmology',
  'ENT',
  'Psychiatry',
  'Internal Medicine',
  'General Surgery',
  'Oncology',
  'Gastroenterology',
  'Pulmonology',
  'Nephrology',
  'Urology',
  'Endocrinology',
  'Rheumatology',
  'Emergency Medicine',
];

const SPECIALIZATIONS = [
  'Cardiologist',
  'Neurologist',
  'Orthopedic Surgeon',
  'Pediatrician',
  'Dermatologist',
  'Ophthalmologist',
  'ENT Specialist',
  'Psychiatrist',
  'Internist',
  'General Surgeon',
  'Oncologist',
  'Gastroenterologist',
  'Pulmonologist',
  'Nephrologist',
  'Urologist',
  'Endocrinologist',
  'Rheumatologist',
  'Emergency Physician',
];

export default function DoctorFields({ data, onChange }: DoctorFieldsProps) {
  const handleChange = (field: keyof ExtractedDoctorData, value: string | number) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
          <input
            type="text"
            value={data.firstName || ''}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Emily"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
          <input
            type="text"
            value={data.lastName || ''}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Wilson"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
        <input
          type="email"
          value={data.email || ''}
          onChange={(e) => handleChange('email', e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="dr.wilson@hospital.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Specialization *</label>
          <select
            value={data.specialization || ''}
            onChange={(e) => handleChange('specialization', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select Specialization</option>
            {SPECIALIZATIONS.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Department *</label>
          <select
            value={data.department || ''}
            onChange={(e) => handleChange('department', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select Department</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">License Number</label>
          <input
            type="text"
            value={data.licenseNumber || ''}
            onChange={(e) => handleChange('licenseNumber', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="MD12345"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Experience (years)</label>
          <input
            type="number"
            min="0"
            value={data.experience || ''}
            onChange={(e) => handleChange('experience', parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="10"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Consultation Fee ($)</label>
        <input
          type="number"
          min="0"
          value={data.consultationFee || ''}
          onChange={(e) => handleChange('consultationFee', parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="150"
        />
      </div>
    </div>
  );
}
