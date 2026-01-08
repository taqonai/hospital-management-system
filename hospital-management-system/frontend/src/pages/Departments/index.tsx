import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  AcademicCapIcon,
  PencilIcon,
  TrashIcon,
  ChevronRightIcon,
  TagIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { departmentApi } from '../../services/api';
import toast from 'react-hot-toast';

interface Specialization {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  floor?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  doctorCount: number;
  nurseCount: number;
  specializationCount: number;
  specializations: Specialization[];
}

export default function Departments() {
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await departmentApi.getAll();
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department deactivated successfully');
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete department');
      setDeleteConfirm(null);
    },
  });

  const departments: Department[] = data?.data || [];
  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(search.toLowerCase()) ||
    dept.code.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Total Departments', value: departments.length, icon: BuildingOfficeIcon, color: 'bg-blue-500' },
    { label: 'Active Departments', value: departments.filter(d => d.isActive).length, icon: BuildingOfficeIcon, color: 'bg-emerald-500' },
    { label: 'Total Specializations', value: departments.reduce((acc, d) => acc + d.specializationCount, 0), icon: AcademicCapIcon, color: 'bg-purple-500' },
    { label: 'Total Doctors', value: departments.reduce((acc, d) => acc + d.doctorCount, 0), icon: UserGroupIcon, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-500 mt-1">Manage departments and their specializations</p>
        </div>
        <Link
          to="/departments/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Department
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

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Departments List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BuildingOfficeIcon className="h-12 w-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No departments found</h3>
          <p className="mt-2 text-gray-500">Get started by creating a new department.</p>
          <Link
            to="/departments/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5" />
            Add Department
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDepartments.map((dept) => (
            <div
              key={dept.id}
              className={`bg-white rounded-xl border ${dept.isActive ? 'border-gray-200' : 'border-orange-300 bg-orange-50'} overflow-hidden`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${dept.isActive ? 'bg-blue-100' : 'bg-orange-100'}`}>
                        <BuildingOfficeIcon className={`h-6 w-6 ${dept.isActive ? 'text-blue-600' : 'text-orange-600'}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          {dept.name}
                          {!dept.isActive && (
                            <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-700 rounded-full">Inactive</span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500">Code: {dept.code}</p>
                      </div>
                    </div>
                    {dept.description && (
                      <p className="mt-2 text-gray-600 text-sm">{dept.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <UserGroupIcon className="h-4 w-4" />
                        {dept.doctorCount} Doctors
                      </span>
                      <span className="flex items-center gap-1">
                        <TagIcon className="h-4 w-4" />
                        {dept.specializationCount} Specializations
                      </span>
                      {dept.floor && <span>Floor: {dept.floor}</span>}
                      {dept.phone && <span>Phone: {dept.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/departments/${dept.id}/edit`}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Department"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </Link>
                    {deleteConfirm === dept.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteMutation.mutate(dept.id)}
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
                        onClick={() => setDeleteConfirm(dept.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Deactivate Department"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                      className={`p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-all ${expandedDept === dept.id ? 'rotate-90' : ''}`}
                      title="View Specializations"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Specializations Expansion */}
              {expandedDept === dept.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                      <AcademicCapIcon className="h-5 w-5 text-purple-600" />
                      Specializations
                    </h4>
                    <Link
                      to={`/departments/${dept.id}/edit`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Manage Specializations
                    </Link>
                  </div>
                  {dept.specializations.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      No specializations defined. Click "Manage Specializations" to add some.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {dept.specializations.map((spec) => (
                        <div
                          key={spec.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                            spec.isActive ? 'bg-white border border-gray-200' : 'bg-orange-100 border border-orange-300'
                          }`}
                        >
                          <TagIcon className={`h-4 w-4 ${spec.isActive ? 'text-purple-600' : 'text-orange-600'}`} />
                          <span className={`text-sm ${spec.isActive ? 'text-gray-900' : 'text-orange-700'}`}>
                            {spec.name}
                          </span>
                          <span className="text-xs text-gray-400">({spec.code})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <ExclamationTriangleIcon className="h-8 w-8" />
              <h3 className="text-lg font-semibold">Deactivate Department?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              This will deactivate the department. Departments with assigned doctors or nurses cannot be deactivated.
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
    </div>
  );
}
