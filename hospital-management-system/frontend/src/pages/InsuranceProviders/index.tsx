import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ShieldCheckIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  BuildingOffice2Icon,
  PhoneIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { insuranceProviderApi } from '../../services/api';
import toast from 'react-hot-toast';
import InsuranceProviderModal from './InsuranceProviderModal';

interface InsuranceProvider {
  id: string;
  name: string;
  licenseNumber: string;
  tpaName?: string;
  contactPhone?: string;
  email?: string;
  emirate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function InsuranceProviders() {
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<InsuranceProvider | null>(null);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['insurance-providers', page, search],
    queryFn: async () => {
      const response = await insuranceProviderApi.getAll({ page, limit: 50, search });
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => insuranceProviderApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-providers'] });
      toast.success('Insurance provider deactivated successfully');
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to deactivate provider');
      setDeleteConfirm(null);
    },
  });

  // Handle nested response: { success, data: { data: [...], pagination: {...} } }
  const responseData = data?.data || data;
  const providers: InsuranceProvider[] = responseData?.data || responseData || [];
  const pagination = responseData?.pagination || data?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 };

  const stats = [
    { label: 'Total Providers', value: pagination.total, icon: ShieldCheckIcon, color: 'bg-blue-500' },
    { label: 'Active Providers', value: providers.filter(p => p.isActive).length, icon: ShieldCheckIcon, color: 'bg-emerald-500' },
    { label: 'With TPA', value: providers.filter(p => p.tpaName).length, icon: BuildingOffice2Icon, color: 'bg-purple-500' },
  ];

  const handleEdit = (provider: InsuranceProvider) => {
    setEditingProvider(provider);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingProvider(null);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['insurance-providers'] });
    handleCloseModal();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Providers</h1>
          <p className="text-gray-500 mt-1">Manage insurance provider master data</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Provider
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, license number, TPA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Providers List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : providers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShieldCheckIcon className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No providers found</h3>
          <p className="mt-2 text-gray-500">Get started by adding a new insurance provider.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5" />
            Add Provider
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className={`bg-white rounded-xl border ${provider.isActive ? 'border-gray-200' : 'border-orange-300 bg-orange-50'} overflow-hidden`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${provider.isActive ? 'bg-blue-100' : 'bg-orange-100'}`}>
                        <ShieldCheckIcon className={`h-6 w-6 ${provider.isActive ? 'text-blue-600' : 'text-orange-600'}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          {provider.name}
                          {!provider.isActive && (
                            <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-700 rounded-full">Inactive</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500">License: {provider.licenseNumber}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {provider.tpaName && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <BuildingOffice2Icon className="h-4 w-4" />
                          <span>TPA: {provider.tpaName}</span>
                        </div>
                      )}
                      {provider.emirate && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <span className="font-medium">Emirate:</span>
                          <span>{provider.emirate}</span>
                        </div>
                      )}
                      {provider.contactPhone && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <PhoneIcon className="h-4 w-4" />
                          <span>{provider.contactPhone}</span>
                        </div>
                      )}
                      {provider.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <EnvelopeIcon className="h-4 w-4" />
                          <span>{provider.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(provider)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Provider"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    {deleteConfirm === provider.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteMutation.mutate(provider.id)}
                          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(provider.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deactivate Provider"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 bg-white border border-gray-200 rounded-lg">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <ExclamationTriangleIcon className="h-8 w-8" />
              <h3 className="text-lg font-semibold">Deactivate Insurance Provider?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              This will deactivate the insurance provider. It will no longer appear in dropdowns for new patients.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <InsuranceProviderModal
          provider={editingProvider}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
