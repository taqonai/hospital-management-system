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
  ChevronUpIcon,
  ChevronDownIcon,
  FunnelIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { patientApi } from '../services/api';
import { Patient } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const bloodGroupDisplay: Record<string, string> = {
  A_POSITIVE: 'A+', A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+', B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+', AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+', O_NEGATIVE: 'O-',
};

type SortField = 'firstName' | 'mrn' | 'gender' | 'dateOfBirth' | 'phone' | 'createdAt' | 'isActive';
type SortOrder = 'asc' | 'desc';

export default function Patients() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [filterMRN, setFilterMRN] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const limit = 12;
  const queryClient = useQueryClient();

  const hasActiveFilters = filterMRN || filterGender || filterStatus || filterPhone;

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setFilterMRN('');
    setFilterGender('');
    setFilterStatus('');
    setFilterPhone('');
    setPage(1);
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', { page, search, sortBy, sortOrder, filterMRN, filterGender, filterStatus, filterPhone }],
    queryFn: async () => {
      const response = await patientApi.getAll({
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        ...(filterMRN && { mrn: filterMRN }),
        ...(filterGender && { gender: filterGender }),
        ...(filterStatus && { isActive: filterStatus === 'active' }),
        ...(filterPhone && { phone: filterPhone }),
      });
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
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
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
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="h-5 w-5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                {[filterMRN, filterGender, filterStatus, filterPhone].filter(Boolean).length}
              </span>
            )}
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Advanced Filters</h4>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Patient ID / MRN</label>
                <input
                  type="text"
                  placeholder="e.g. MRN-00123"
                  value={filterMRN}
                  onChange={(e) => { setFilterMRN(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Gender</label>
                <select
                  value={filterGender}
                  onChange={(e) => { setFilterGender(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="e.g. +971..."
                  value={filterPhone}
                  onChange={(e) => { setFilterPhone(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Patient Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {patients.map((patient: Patient) => {
              const age = Math.floor(
                (new Date().getTime() - new Date(patient.dateOfBirth).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
              );
              return (
                <div
                  key={patient.id}
                  className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Card Header - Avatar, Name, Status */}
                  <div className="p-5 pb-4">
                    <div className="flex items-start gap-3">
                      {patient.photo ? (
                        <img src={patient.photo} alt={`${patient.firstName} ${patient.lastName}`} className="flex-shrink-0 h-12 w-12 rounded-full object-cover border-2 border-blue-100" />
                      ) : (
                        <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">{patient.firstName[0]}{patient.lastName[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/patients/${patient.id}`}
                            className="text-lg font-semibold text-gray-900 hover:text-blue-600 truncate"
                          >
                            {patient.firstName} {patient.lastName}
                          </Link>
                          {patient.isActive ? (
                            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              Active
                            </span>
                          ) : (
                            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {age} years • {patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="px-5 pb-4 space-y-2.5">
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <PhoneIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{patient.phone}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <EnvelopeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{patient.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <MapPinIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{patient.address ? `${patient.address}, ${patient.city}` : 'No address'}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="mx-5 border-t border-gray-100" />

                  {/* Footer - Blood Group, Last Visit, Actions */}
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-medium">Blood Group</p>
                        <p className="text-sm font-semibold text-gray-900">{patient.bloodGroup ? (bloodGroupDisplay[patient.bloodGroup] || patient.bloodGroup) : '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase font-medium">Registered</p>
                        <p className="text-sm font-semibold text-gray-900">{format(new Date(patient.createdAt), 'yyyy-MM-dd')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/patients/${patient.id}/edit`}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                      </Link>
                      <Link
                        to={`/patients/${patient.id}`}
                        className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                        title="View"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setDeleteConfirm(patient.id)}
                        className="inline-flex items-center justify-center p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-white rounded-xl border border-gray-200">
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
