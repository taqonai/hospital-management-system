import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  StarIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,

  PencilIcon,
  TrashIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { doctorApi } from '../services/api';
import DirhamSymbol from '../components/common/DirhamSymbol';
import { Doctor } from '../types';
import toast from 'react-hot-toast';

export default function Doctors() {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const limit = 12;
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['doctors', { search, departmentFilter, page }],
    queryFn: async () => {
      const response = await doctorApi.getAll({
        search,
        departmentId: departmentFilter || undefined,
        page,
        limit,
      });
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => doctorApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      toast.success('Doctor deleted successfully');
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error('Failed to delete doctor');
    },
  });

  const doctors = data?.data || [];
  const pagination = data?.pagination;

  const stats = [
    { label: 'Total Doctors', value: pagination?.total || doctors.length || 0, icon: UserGroupIcon, color: 'bg-emerald-500' },
    { label: 'Available Now', value: doctors.filter((d: Doctor) => d.isAvailable).length, icon: ClockIcon, color: 'bg-blue-500' },
    { label: 'Departments', value: 12, icon: BuildingOfficeIcon, color: 'bg-purple-500' },
    { label: 'Avg. Rating', value: '4.8', icon: StarIcon, color: 'bg-amber-500' },
  ];

  const specializations = [
    'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'General Medicine',
    'Dermatology', 'Ophthalmology', 'Psychiatry', 'Oncology', 'Radiology'
  ];

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-gray-500 mt-1">Manage doctors, schedules, and specializations</p>
        </div>
        <Link
          to="/doctors/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Doctor
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          {/* Search Input */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search doctors by name or specialization..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <BuildingOfficeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="appearance-none w-full sm:w-48 pl-10 pr-8 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-700 cursor-pointer"
            >
              <option value="">All Departments</option>
              {specializations.map(spec => (
                <option key={spec} value={spec.toLowerCase()}>{spec}</option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Doctors Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 text-center py-16 px-4">
          <UserGroupIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No doctors found</h3>
          <p className="text-gray-500 mb-6">
            {search ? `No results for "${search}"` : 'Get started by adding your first doctor.'}
          </p>
          <Link
            to="/doctors/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <PlusIcon className="h-5 w-5" />
            Add Doctor
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doctor: Doctor) => (
              <div
                key={doctor.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Status indicator */}
                <div className="px-6 pt-5 flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">
                      {doctor.user?.avatar ? (
                        <img
                          src={doctor.user.avatar}
                          alt={doctor.user.firstName}
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                      ) : (
                        <span>
                          {doctor.user?.firstName?.[0] || 'D'}{doctor.user?.lastName?.[0] || 'R'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Dr. {doctor.user?.firstName} {doctor.user?.lastName}
                      </h3>
                      <p className="text-sm font-medium text-emerald-600">
                        {doctor.specialization}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    doctor.isAvailable
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${doctor.isAvailable ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {doctor.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                <div className="px-6 py-4">
                  {/* Department */}
                  <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-3">
                    <BuildingOfficeIcon className="h-4 w-4" />
                    {doctor.department?.name || 'General Department'}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                      <AcademicCapIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        <span className="font-semibold">{doctor.experience || 0}</span> yrs exp
                      </span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          star <= Math.floor(doctor.rating || 0) ? (
                            <StarIconSolid key={star} className="h-3.5 w-3.5 text-amber-400" />
                          ) : (
                            <StarIcon key={star} className="h-3.5 w-3.5 text-gray-300" />
                          )
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        {doctor.rating || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Available Days */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <CalendarDaysIcon className="h-3.5 w-3.5" />
                      Available Days
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {doctor.availableDays?.slice(0, 5).map((day: string) => (
                        <span
                          key={day}
                          className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 text-emerald-600 border border-emerald-200"
                        >
                          {day.slice(0, 3)}
                        </span>
                      ))}
                      {(doctor.availableDays?.length || 0) > 5 && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-500">
                          +{(doctor.availableDays?.length || 0) - 5}
                        </span>
                      )}
                      {(!doctor.availableDays || doctor.availableDays.length === 0) && (
                        <span className="text-xs text-gray-400">Not set</span>
                      )}
                    </div>
                  </div>

                  {/* Contact & Fee */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${doctor.user?.phone}`}
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Call"
                        >
                          <PhoneIcon className="h-4 w-4" />
                        </a>
                        <a
                          href={`mailto:${doctor.user?.email}`}
                          className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          title="Email"
                        >
                          <EnvelopeIcon className="h-4 w-4" />
                        </a>
                      </div>
                      <div className="flex items-center gap-1">
                        <DirhamSymbol size="1.25em" className="text-emerald-500" />
                        <span className="text-xl font-bold text-gray-900">
                          {doctor.consultationFee || 0}
                        </span>
                        <span className="text-xs text-gray-500">/visit</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/doctors/${doctor.id}`}
                      className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="View"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </Link>
                    <Link
                      to={`/doctors/${doctor.id}/edit`}
                      className="p-2 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </Link>
                    <button
                      onClick={() => setDeleteConfirm(doctor.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <Link
                    to={`/appointments/new?doctorId=${doctor.id}`}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                  >
                    Book Appointment
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 px-6 py-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} doctors
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Doctor</h3>
            <p className="text-gray-500 mb-6">
              Are you sure you want to delete this doctor? This action cannot be undone.
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
