import { useState, useEffect } from 'react';
import { useMutation } from '@tantml:invoke name="@tanstack/react-query">
import { XMarkIcon } from '@heroicons/react/24/outline';
import { insuranceProviderApi } from '../../services/api';
import toast from 'react-hot-toast';

interface InsuranceProvider {
  id: string;
  name: string;
  licenseNumber: string;
  tpaName?: string;
  contactPhone?: string;
  email?: string;
  emirate?: string;
  isActive: boolean;
}

interface Props {
  provider: InsuranceProvider | null;
  onClose: () => void;
  onSuccess: () => void;
}

const UAE_EMIRATES = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
];

export default function InsuranceProviderModal({ provider, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    licenseNumber: '',
    tpaName: '',
    contactPhone: '',
    email: '',
    emirate: '',
    isActive: true,
  });

  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name,
        licenseNumber: provider.licenseNumber,
        tpaName: provider.tpaName || '',
        contactPhone: provider.contactPhone || '',
        email: provider.email || '',
        emirate: provider.emirate || '',
        isActive: provider.isActive,
      });
    }
  }, [provider]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (provider) {
        return insuranceProviderApi.update(provider.id, data);
      } else {
        return insuranceProviderApi.create(data);
      }
    },
    onSuccess: () => {
      toast.success(provider ? 'Provider updated successfully' : 'Provider created successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save provider');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {provider ? 'Edit Insurance Provider' : 'Add Insurance Provider'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Provider Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Provider Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Daman - National Health Insurance Company"
            />
          </div>

          {/* License Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              License Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="DHA/HAAD regulatory license number"
            />
            <p className="mt-1 text-sm text-gray-500">
              Unique regulatory ID (e.g., DHA license number)
            </p>
          </div>

          {/* TPA Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Third Party Administrator (TPA)
            </label>
            <input
              type="text"
              name="tpaName"
              value={formData.tpaName}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., NAS, NextCare, etc."
            />
          </div>

          {/* Emirate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Emirate
            </label>
            <select
              name="emirate"
              value={formData.emirate}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Emirate</option>
              {UAE_EMIRATES.map(emirate => (
                <option key={emirate} value={emirate}>
                  {emirate}
                </option>
              ))}
            </select>
          </div>

          {/* Contact Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Phone
            </label>
            <input
              type="tel"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+971 4 123 4567"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="contact@provider.ae"
            />
          </div>

          {/* Active Status */}
          {provider && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label className="text-sm font-medium text-gray-700">
                Active (visible in patient insurance dropdowns)
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : provider ? 'Update Provider' : 'Create Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
