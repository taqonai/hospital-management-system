import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BuildingOfficeIcon,
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  TagIcon,
  AcademicCapIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { departmentApi } from '../../services/api';
import toast from 'react-hot-toast';

interface Specialization {
  id?: string;
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  isNew?: boolean;
  isEditing?: boolean;
}

interface DepartmentFormData {
  name: string;
  code: string;
  description: string;
  floor: string;
  phone: string;
  email: string;
}

export default function DepartmentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<DepartmentFormData>({
    name: '',
    code: '',
    description: '',
    floor: '',
    phone: '',
    email: '',
  });

  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [newSpec, setNewSpec] = useState({ name: '', code: '', description: '' });
  const [showNewSpecForm, setShowNewSpecForm] = useState(false);
  const [editingSpec, setEditingSpec] = useState<string | null>(null);
  const [editSpecData, setEditSpecData] = useState({ name: '', code: '', description: '' });

  // Fetch department data for edit
  const { data: departmentData, isLoading } = useQuery({
    queryKey: ['department', id],
    queryFn: async () => {
      const response = await departmentApi.getById(id!);
      return response.data;
    },
    enabled: isEdit,
  });

  // Populate form on edit
  useEffect(() => {
    if (departmentData?.data) {
      const dept = departmentData.data;
      setFormData({
        name: dept.name || '',
        code: dept.code || '',
        description: dept.description || '',
        floor: dept.floor || '',
        phone: dept.phone || '',
        email: dept.email || '',
      });
      setSpecializations(dept.specializations || []);
    }
  }, [departmentData]);

  // Create department mutation
  const createMutation = useMutation({
    mutationFn: (data: DepartmentFormData) => departmentApi.create(data),
    onSuccess: async (response) => {
      const newDeptId = response.data?.data?.id;
      // Create specializations for new department
      if (newDeptId && specializations.length > 0) {
        for (const spec of specializations) {
          if (spec.isNew) {
            try {
              await departmentApi.createSpecialization(newDeptId, {
                name: spec.name,
                code: spec.code,
                description: spec.description,
              });
            } catch (err) {
              console.error('Failed to create specialization:', err);
            }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department created successfully');
      navigate('/departments');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create department');
    },
  });

  // Update department mutation
  const updateMutation = useMutation({
    mutationFn: (data: DepartmentFormData) => departmentApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department', id] });
      toast.success('Department updated successfully');
      navigate('/departments');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update department');
    },
  });

  // Create specialization mutation
  const createSpecMutation = useMutation({
    mutationFn: (data: { name: string; code: string; description?: string }) =>
      departmentApi.createSpecialization(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', id] });
      toast.success('Specialization added');
      setShowNewSpecForm(false);
      setNewSpec({ name: '', code: '', description: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add specialization');
    },
  });

  // Update specialization mutation
  const updateSpecMutation = useMutation({
    mutationFn: ({ specId, data }: { specId: string; data: any }) =>
      departmentApi.updateSpecialization(id!, specId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', id] });
      toast.success('Specialization updated');
      setEditingSpec(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update specialization');
    },
  });

  // Delete specialization mutation
  const deleteSpecMutation = useMutation({
    mutationFn: (specId: string) => departmentApi.deleteSpecialization(id!, specId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department', id] });
      toast.success('Specialization deactivated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete specialization');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      toast.error('Name and Code are required');
      return;
    }
    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleAddNewSpec = () => {
    if (!newSpec.name || !newSpec.code) {
      toast.error('Specialization name and code are required');
      return;
    }
    if (isEdit && id) {
      // For existing department, create via API
      createSpecMutation.mutate(newSpec);
    } else {
      // For new department, add to local state
      setSpecializations([...specializations, { ...newSpec, isNew: true }]);
      setNewSpec({ name: '', code: '', description: '' });
      setShowNewSpecForm(false);
    }
  };

  const handleRemoveNewSpec = (index: number) => {
    setSpecializations(specializations.filter((_, i) => i !== index));
  };

  const handleEditSpec = (spec: Specialization) => {
    setEditingSpec(spec.id!);
    setEditSpecData({
      name: spec.name,
      code: spec.code,
      description: spec.description || '',
    });
  };

  const handleSaveEditSpec = (specId: string) => {
    if (!editSpecData.name || !editSpecData.code) {
      toast.error('Specialization name and code are required');
      return;
    }
    updateSpecMutation.mutate({ specId, data: editSpecData });
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/departments')}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Department' : 'New Department'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEdit ? 'Update department details and manage specializations' : 'Create a new department'}
          </p>
        </div>
      </div>

      {/* Department Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Department Details</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Cardiology"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., CARDIO"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Brief description of the department"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
            <input
              type="text"
              value={formData.floor}
              onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 2nd Floor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., +1 234 567 8900"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., cardiology@hospital.com"
            />
          </div>
        </div>

        {/* Submit Button for Department */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/departments')}
            className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : isEdit
              ? 'Update Department'
              : 'Create Department'}
          </button>
        </div>
      </form>

      {/* Specializations Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <AcademicCapIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Specializations</h2>
              <p className="text-sm text-gray-500">
                Define specializations available in this department
              </p>
            </div>
          </div>
          {!showNewSpecForm && (
            <button
              type="button"
              onClick={() => setShowNewSpecForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <PlusIcon className="h-4 w-4" />
              Add Specialization
            </button>
          )}
        </div>

        {/* New Specialization Form */}
        {showNewSpecForm && (
          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <h3 className="font-medium text-gray-900 mb-3">New Specialization</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSpec.name}
                  onChange={(e) => setNewSpec({ ...newSpec, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., Interventional Cardiology"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSpec.code}
                  onChange={(e) => setNewSpec({ ...newSpec, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g., INT_CARDIO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newSpec.description}
                  onChange={(e) => setNewSpec({ ...newSpec, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowNewSpecForm(false);
                  setNewSpec({ name: '', code: '', description: '' });
                }}
                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewSpec}
                disabled={createSpecMutation.isPending}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {createSpecMutation.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {/* Specializations List */}
        {specializations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <TagIcon className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p>No specializations defined yet.</p>
            <p className="text-sm">Click "Add Specialization" to create one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {specializations.map((spec, index) => (
              <div
                key={spec.id || `new-${index}`}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  spec.isNew
                    ? 'bg-green-50 border-green-200'
                    : spec.isActive === false
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {editingSpec === spec.id ? (
                  // Edit mode
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={editSpecData.name}
                      onChange={(e) => setEditSpecData({ ...editSpecData, name: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={editSpecData.code}
                      onChange={(e) => setEditSpecData({ ...editSpecData, code: e.target.value.toUpperCase() })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Code"
                    />
                    <input
                      type="text"
                      value={editSpecData.description}
                      onChange={(e) => setEditSpecData({ ...editSpecData, description: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Description"
                    />
                  </div>
                ) : (
                  // Display mode
                  <div className="flex items-center gap-3">
                    <TagIcon className={`h-5 w-5 ${spec.isNew ? 'text-green-600' : 'text-purple-600'}`} />
                    <div>
                      <span className="font-medium text-gray-900">{spec.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({spec.code})</span>
                      {spec.description && (
                        <p className="text-sm text-gray-500">{spec.description}</p>
                      )}
                      {spec.isNew && (
                        <span className="text-xs text-green-600 ml-2">(Will be created on save)</span>
                      )}
                      {spec.isActive === false && (
                        <span className="text-xs text-orange-600 ml-2">(Inactive)</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {editingSpec === spec.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSaveEditSpec(spec.id!)}
                        disabled={updateSpecMutation.isPending}
                        className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSpec(null)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </>
                  ) : spec.isNew ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveNewSpec(index)}
                      className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEditSpec(spec)}
                        className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSpecMutation.mutate(spec.id!)}
                        disabled={deleteSpecMutation.isPending}
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
