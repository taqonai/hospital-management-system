import { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Charge {
  id: string;
  hospitalId: string;
  code: string;
  description: string;
  category: string;
  defaultPrice: number;
  currency: string;
  unit: string;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
}

interface FeeSchedule {
  id: string;
  hospitalId: string;
  chargeId: string;
  payerId: string | null;
  price: number;
  discount: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

const CATEGORIES = [
  'CONSULTATION',
  'PROCEDURE',
  'LAB',
  'IMAGING',
  'PHARMACY',
  'ROOM',
  'SUPPLY',
  'OTHER',
];

export default function ChargeMaster() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Form state
  const [form, setForm] = useState({
    code: '',
    description: '',
    category: 'CONSULTATION',
    defaultPrice: '',
    currency: 'AED',
    unit: 'each',
  });

  const fetchCharges = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/v1/charge-management/charges?${params}`);
      const data = await res.json();
      setCharges(data.data || []);
    } catch (err) {
      toast.error('Failed to load charges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharges();
  }, [categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCharges();
  };

  const handleSeed = async () => {
    try {
      setSeeding(true);
      const res = await fetch('/api/v1/charge-management/seed', { method: 'POST' });
      const data = await res.json();
      toast.success(`Seeded ${data.data?.created || 0} charges`);
      fetchCharges();
    } catch (err) {
      toast.error('Failed to seed charges');
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        defaultPrice: parseFloat(form.defaultPrice),
      };

      if (editingCharge) {
        await fetch(`/api/v1/charge-management/charges/${editingCharge.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Charge updated');
      } else {
        await fetch('/api/v1/charge-management/charges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Charge created');
      }
      setShowAddModal(false);
      setEditingCharge(null);
      setForm({ code: '', description: '', category: 'CONSULTATION', defaultPrice: '', currency: 'AED', unit: 'each' });
      fetchCharges();
    } catch (err) {
      toast.error('Failed to save charge');
    }
  };

  const openEdit = (charge: Charge) => {
    setEditingCharge(charge);
    setForm({
      code: charge.code,
      description: charge.description,
      category: charge.category,
      defaultPrice: String(charge.defaultPrice),
      currency: charge.currency,
      unit: charge.unit,
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingCharge(null);
    setForm({ code: '', description: '', category: 'CONSULTATION', defaultPrice: '', currency: 'AED', unit: 'each' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Charge Master</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage billing codes and pricing for all services
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ArrowPathIcon className={clsx('w-4 h-4', seeding && 'animate-spin')} />
            {seeding ? 'Seeding...' : 'Seed Default Charges'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <PlusIcon className="w-4 h-4" />
            Add Charge
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search charges by code or description..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </form>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TagIcon className="w-4 h-4" />
            Total Charges
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{charges.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            Active
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {charges.filter((c) => c.isActive).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CurrencyDollarIcon className="w-4 h-4" />
            Categories
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {new Set(charges.map((c) => c.category)).size}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading charges...</div>
        ) : charges.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No charges found. Click "Seed Default Charges" to populate.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {charges.map((charge) => (
                <tr key={charge.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-indigo-600">
                    {charge.code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{charge.description}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {charge.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {charge.currency} {Number(charge.defaultPrice).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {charge.isActive ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                    ) : (
                      <XCircleIcon className="w-5 h-5 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openEdit(charge)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editingCharge ? 'Edit Charge' : 'Add New Charge'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  placeholder="e.g., CONS-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  placeholder="e.g., General Consultation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.defaultPrice}
                    onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  {editingCharge ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
