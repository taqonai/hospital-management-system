import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  UserPlusIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { patientApi } from '../services/api';
import { Patient } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Patients() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const limit = 10;
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', { page, search }],
    queryFn: async () => {
      const response = await patientApi.getAll({ page, limit, search });
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Patient deleted successfully');
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error('Failed to delete patient');
    },
  });

  const patients = data?.data || [];
  const pagination = data?.pagination;

  const stats = [
    { label: 'Total Patients', value: pagination?.total || 0, icon: UsersIcon, color: 'bg-blue-500' },
    { label: 'New This Month', value: 24, icon: UserPlusIcon, color: 'bg-green-500' },
    { label: 'Active Cases', value: 156, icon: ChartBarIcon, color: 'bg-purple-500' },
  ];

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 mt-1">Manage patient records and medical information</p>
        </div>
        <Link
          to="/patients/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Patient
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search patients by name, MRN, or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-16">
            <UsersIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
            <p className="text-gray-500 mb-6">
              {search ? `No results for "${search}"` : 'Get started by adding your first patient.'}
            </p>
            <Link
              to="/patients/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5" />
              Add Patient
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Patient</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">MRN</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Gender</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Age</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Phone</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Registered</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {patients.map((patient: Patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                            {patient.firstName[0]}{patient.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{patient.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm px-2 py-1 rounded bg-gray-100 text-gray-700">
                          {patient.mrn}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-sm ${
                          patient.gender === 'MALE' ? 'text-blue-600' : 'text-pink-600'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            patient.gender === 'MALE' ? 'bg-blue-500' : 'bg-pink-500'
                          }`} />
                          {patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {Math.floor(
                          (new Date().getTime() - new Date(patient.dateOfBirth).getTime()) /
                          (365.25 * 24 * 60 * 60 * 1000)
                        )} yrs
                      </td>
                      <td className="px-6 py-4 text-gray-700">{patient.phone}</td>
                      <td className="px-6 py-4 text-gray-500">
                        {format(new Date(patient.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        {patient.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/patients/${patient.id}`}
                            className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                            title="View"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </Link>
                          <Link
                            to={`/patients/${patient.id}/edit`}
                            className="p-2 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </Link>
                          <button
                            onClick={() => setDeleteConfirm(patient.id)}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} patients
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={!pagination.hasPrev}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-700">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={!pagination.hasNext}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Patient</h3>
            <p className="text-gray-500 mb-6">
              Are you sure you want to delete this patient? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
