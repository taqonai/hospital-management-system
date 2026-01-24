import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CubeIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { pharmacyApi } from '../../services/api';

interface Drug {
  id: string;
  name: string;
  genericName: string;
  brandName?: string;
  code: string;
  category: string;
  dosageForm: string;
  strength: string;
  manufacturer?: string;
  price: number;
  reorderLevel: number;
  requiresPrescription: boolean;
  isControlled: boolean;
  isActive: boolean;
  sideEffects: string[];
  contraindications: string[];
  interactions: string[];
  inventory?: Array<{
    id: string;
    batchNumber: string;
    quantity: number;
    expiryDate: string;
  }>;
}

interface DrugManagementProps {
  onAddDrug: () => void;
  onImportCSV: () => void;
}

const DRUG_CATEGORIES = [
  'ANALGESIC', 'ANTIBIOTIC', 'ANTIVIRAL', 'ANTIFUNGAL', 'ANTIHISTAMINE',
  'ANTIHYPERTENSIVE', 'ANTIDIABETIC', 'ANTIDEPRESSANT', 'ANTICONVULSANT',
  'ANTICOAGULANT', 'BRONCHODILATOR', 'CARDIOVASCULAR', 'CORTICOSTEROID',
  'DIURETIC', 'GASTROINTESTINAL', 'HORMONE', 'IMMUNOSUPPRESSANT',
  'MUSCLE_RELAXANT', 'NSAID', 'OPIOID', 'SEDATIVE', 'STATIN', 'VITAMIN', 'OTHER',
];

const DOSAGE_FORMS = [
  'TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM',
  'OINTMENT', 'GEL', 'DROPS', 'INHALER', 'PATCH', 'SUPPOSITORY',
  'POWDER', 'SOLUTION', 'SPRAY', 'LOTION', 'OTHER',
];

export default function DrugManagement({ onAddDrug, onImportCSV }: DrugManagementProps) {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Drug>>({});
  const [stockForm, setStockForm] = useState({
    batchNumber: '',
    quantity: '',
    expiryDate: '',
    costPrice: '',
    sellingPrice: '',
    location: 'Main Pharmacy',
  });

  useEffect(() => {
    fetchDrugs();
  }, []);

  const fetchDrugs = async () => {
    try {
      setLoading(true);
      const response = await pharmacyApi.getDrugs();
      setDrugs(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch drugs:', error);
      toast.error('Failed to load drugs');
    } finally {
      setLoading(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => pharmacyApi.updateDrug(id, data),
    onSuccess: () => {
      toast.success('Drug updated successfully');
      fetchDrugs();
      setShowEditModal(false);
      setSelectedDrug(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update drug');
    },
  });

  const addStockMutation = useMutation({
    mutationFn: (data: any) => pharmacyApi.addInventory(data),
    onSuccess: () => {
      toast.success('Stock added successfully');
      fetchDrugs();
      setShowAddStockModal(false);
      setStockForm({
        batchNumber: '',
        quantity: '',
        expiryDate: '',
        costPrice: '',
        sellingPrice: '',
        location: 'Main Pharmacy',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add stock');
    },
  });

  const filteredDrugs = drugs.filter(drug => {
    const matchesSearch = !search ||
      drug.name.toLowerCase().includes(search.toLowerCase()) ||
      drug.genericName.toLowerCase().includes(search.toLowerCase()) ||
      drug.code.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || drug.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getTotalStock = (drug: Drug) => {
    return drug.inventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0;
  };

  const getStockStatus = (drug: Drug) => {
    const total = getTotalStock(drug);
    if (total === 0) return { status: 'out', label: 'Out of Stock', color: 'red' };
    if (total <= drug.reorderLevel) return { status: 'low', label: 'Low Stock', color: 'orange' };
    return { status: 'ok', label: 'In Stock', color: 'green' };
  };

  const handleViewDetails = (drug: Drug) => {
    setSelectedDrug(drug);
    setShowDetailModal(true);
  };

  const handleEdit = (drug: Drug) => {
    setSelectedDrug(drug);
    setEditForm({
      name: drug.name,
      genericName: drug.genericName,
      brandName: drug.brandName || '',
      category: drug.category,
      dosageForm: drug.dosageForm,
      strength: drug.strength,
      manufacturer: drug.manufacturer || '',
      price: drug.price,
      reorderLevel: drug.reorderLevel,
      requiresPrescription: drug.requiresPrescription,
      isControlled: drug.isControlled,
      isActive: drug.isActive,
    });
    setShowEditModal(true);
  };

  const handleAddStock = (drug: Drug) => {
    setSelectedDrug(drug);
    setStockForm({
      ...stockForm,
      sellingPrice: String(drug.price),
      costPrice: String(Number(drug.price) * 0.7), // Default 30% margin
    });
    setShowAddStockModal(true);
  };

  const handleSaveEdit = () => {
    if (!selectedDrug) return;
    updateMutation.mutate({ id: selectedDrug.id, data: editForm });
  };

  const handleSaveStock = () => {
    if (!selectedDrug) return;
    if (!stockForm.batchNumber || !stockForm.quantity || !stockForm.expiryDate) {
      toast.error('Please fill all required fields');
      return;
    }
    addStockMutation.mutate({
      drugId: selectedDrug.id,
      batchNumber: stockForm.batchNumber,
      quantity: Number(stockForm.quantity),
      expiryDate: new Date(stockForm.expiryDate),
      costPrice: Number(stockForm.costPrice) || 0,
      sellingPrice: Number(stockForm.sellingPrice) || selectedDrug.price,
      location: stockForm.location,
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, generic name, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500/50 text-gray-900 placeholder-gray-400"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/30 text-gray-900"
        >
          <option value="">All Categories</option>
          {DRUG_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button
          onClick={fetchDrugs}
          className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
        >
          <ArrowPathIcon className={clsx('h-5 w-5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Drug Count */}
      <div className="text-sm text-gray-500">
        Showing {filteredDrugs.length} of {drugs.length} medicines
      </div>

      {/* Drug List */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        {loading ? (
          <div className="p-12 text-center">
            <ArrowPathIcon className="h-8 w-8 text-green-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading medicines...</p>
          </div>
        ) : filteredDrugs.length === 0 ? (
          <div className="p-12 text-center">
            <BeakerIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No medicines found</p>
            <button
              onClick={onAddDrug}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
            >
              Add First Medicine
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Medicine</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Form</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Strength</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDrugs.map((drug) => {
                  const stockStatus = getStockStatus(drug);
                  const totalStock = getTotalStock(drug);
                  return (
                    <tr key={drug.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{drug.name}</p>
                          <p className="text-sm text-gray-500">{drug.genericName}</p>
                          <p className="text-xs text-gray-400 font-mono">{drug.code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-lg bg-blue-100 text-blue-700">
                          {drug.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{drug.dosageForm}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{drug.strength}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        AED {Number(drug.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'font-medium',
                          stockStatus.color === 'red' && 'text-red-600',
                          stockStatus.color === 'orange' && 'text-orange-600',
                          stockStatus.color === 'green' && 'text-green-600',
                        )}>
                          {totalStock}
                        </span>
                        <span className="text-gray-400 text-sm"> / {drug.reorderLevel}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium',
                          stockStatus.color === 'red' && 'bg-red-100 text-red-700',
                          stockStatus.color === 'orange' && 'bg-orange-100 text-orange-700',
                          stockStatus.color === 'green' && 'bg-green-100 text-green-700',
                        )}>
                          {stockStatus.color === 'red' && <ExclamationTriangleIcon className="h-3 w-3" />}
                          {stockStatus.color === 'orange' && <ExclamationTriangleIcon className="h-3 w-3" />}
                          {stockStatus.color === 'green' && <CheckCircleIcon className="h-3 w-3" />}
                          {stockStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDetails(drug)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(drug)}
                            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit Medicine"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAddStock(drug)}
                            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Add Stock"
                          >
                            <PlusCircleIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedDrug && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDetailModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedDrug.name}</h2>
                  <p className="text-sm text-gray-500">{selectedDrug.genericName} - {selectedDrug.code}</p>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="font-medium">{selectedDrug.category.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Dosage Form</p>
                    <p className="font-medium">{selectedDrug.dosageForm}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Strength</p>
                    <p className="font-medium">{selectedDrug.strength}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Manufacturer</p>
                    <p className="font-medium">{selectedDrug.manufacturer || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Price</p>
                    <p className="font-medium">AED {Number(selectedDrug.price).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Reorder Level</p>
                    <p className="font-medium">{selectedDrug.reorderLevel} units</p>
                  </div>
                </div>

                {/* Flags */}
                <div className="flex gap-4">
                  <span className={clsx(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    selectedDrug.requiresPrescription ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  )}>
                    {selectedDrug.requiresPrescription ? 'Prescription Required' : 'OTC'}
                  </span>
                  {selectedDrug.isControlled && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
                      Controlled Substance
                    </span>
                  )}
                </div>

                {/* Side Effects */}
                {selectedDrug.sideEffects?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Side Effects</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDrug.sideEffects.map((effect, i) => (
                        <span key={i} className="px-2 py-1 bg-yellow-50 text-yellow-700 text-sm rounded-lg">
                          {effect}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contraindications */}
                {selectedDrug.contraindications?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Contraindications</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDrug.contraindications.map((item, i) => (
                        <span key={i} className="px-2 py-1 bg-red-50 text-red-700 text-sm rounded-lg">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactions */}
                {selectedDrug.interactions?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Drug Interactions</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDrug.interactions.map((item, i) => (
                        <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 text-sm rounded-lg">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inventory */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Current Inventory</p>
                  {selectedDrug.inventory && selectedDrug.inventory.length > 0 ? (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left">Batch</th>
                            <th className="px-3 py-2 text-left">Quantity</th>
                            <th className="px-3 py-2 text-left">Expiry</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedDrug.inventory.map((inv) => (
                            <tr key={inv.id}>
                              <td className="px-3 py-2 font-mono">{inv.batchNumber}</td>
                              <td className="px-3 py-2">{inv.quantity}</td>
                              <td className="px-3 py-2">{new Date(inv.expiryDate).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No inventory records</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={() => { setShowDetailModal(false); handleAddStock(selectedDrug); }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700"
                >
                  Add Stock
                </button>
                <button
                  onClick={() => { setShowDetailModal(false); handleEdit(selectedDrug); }}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
                >
                  Edit Medicine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedDrug && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowEditModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-xl font-bold text-gray-900">Edit Medicine</h2>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-green-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name</label>
                    <input
                      type="text"
                      value={editForm.genericName || ''}
                      onChange={(e) => setEditForm({ ...editForm, genericName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-green-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={editForm.category || ''}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-green-500/30"
                    >
                      {DRUG_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dosage Form</label>
                    <select
                      value={editForm.dosageForm || ''}
                      onChange={(e) => setEditForm({ ...editForm, dosageForm: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-green-500/30"
                    >
                      {DOSAGE_FORMS.map(form => (
                        <option key={form} value={form}>{form}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Strength</label>
                    <input
                      type="text"
                      value={editForm.strength || ''}
                      onChange={(e) => setEditForm({ ...editForm, strength: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-green-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={editForm.manufacturer || ''}
                      onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-green-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.price || ''}
                      onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-green-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                    <input
                      type="number"
                      value={editForm.reorderLevel || ''}
                      onChange={(e) => setEditForm({ ...editForm, reorderLevel: Number(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-green-500/30"
                    />
                  </div>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.requiresPrescription || false}
                      onChange={(e) => setEditForm({ ...editForm, requiresPrescription: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Requires Prescription</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.isControlled || false}
                      onChange={(e) => setEditForm({ ...editForm, isControlled: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Controlled Substance</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.isActive !== false}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && selectedDrug && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddStockModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Add Stock</h2>
                  <p className="text-sm text-gray-500">{selectedDrug.name}</p>
                </div>
                <button onClick={() => setShowAddStockModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Batch Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={stockForm.batchNumber}
                    onChange={(e) => setStockForm({ ...stockForm, batchNumber: e.target.value })}
                    placeholder="e.g., BATCH-2024-001"
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={stockForm.quantity}
                    onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                    placeholder="e.g., 100"
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={stockForm.expiryDate}
                    onChange={(e) => setStockForm({ ...stockForm, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={stockForm.costPrice}
                      onChange={(e) => setStockForm({ ...stockForm, costPrice: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={stockForm.sellingPrice}
                      onChange={(e) => setStockForm({ ...stockForm, sellingPrice: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={stockForm.location}
                    onChange={(e) => setStockForm({ ...stockForm, location: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={() => setShowAddStockModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStock}
                  disabled={addStockMutation.isPending}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50"
                >
                  {addStockMutation.isPending ? 'Adding...' : 'Add Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
