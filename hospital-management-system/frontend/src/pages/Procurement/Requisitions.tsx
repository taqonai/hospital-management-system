import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { procurementApi } from '../../services/procurementApi';

// ==================== Interfaces ====================
interface RequisitionItem {
  id?: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  totalPrice: number;
}

interface Requisition {
  id: string;
  prNumber: string;
  department: string;
  requestedBy: string;
  urgency: string;
  status: string;
  totalAmount: number;
  justification: string;
  items: RequisitionItem[];
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

const urgencies = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const prStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED'];
const departments = ['Administration', 'Emergency', 'ICU', 'Laboratory', 'OPD', 'Pharmacy', 'Radiology', 'Surgery', 'Nursing', 'IT', 'Maintenance'];

const statusConfig: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
  PENDING_APPROVAL: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-500' },
  CONVERTED: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

const urgencyConfig: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'bg-gray-100', text: 'text-gray-600' },
  MEDIUM: { bg: 'bg-blue-100', text: 'text-blue-700' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-700' },
};

const emptyItem: RequisitionItem = {
  itemName: '', description: '', quantity: 1, unit: 'PCS', estimatedUnitPrice: 0, totalPrice: 0,
};

export default function Requisitions() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    department: '',
    urgency: 'MEDIUM',
    justification: '',
    items: [{ ...emptyItem }],
  });

  // Detail view
  const [selectedPR, setSelectedPR] = useState<Requisition | null>(null);

  useEffect(() => {
    fetchRequisitions();
  }, [filterStatus, filterDepartment, filterUrgency]);

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterDepartment) params.department = filterDepartment;
      if (filterUrgency) params.urgency = filterUrgency;
      const response = await procurementApi.getRequisitions(params);
      const d = response.data.data;
      setRequisitions(Array.isArray(d) ? d : d?.requisitions || []);
    } catch (error) {
      console.error('Failed to fetch requisitions:', error);
      toast.error('Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { ...emptyItem }] });
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const updateItem = (index: number, field: keyof RequisitionItem, value: any) => {
    const updated = [...formData.items];
    (updated[index] as any)[field] = value;
    if (field === 'quantity' || field === 'estimatedUnitPrice') {
      updated[index].totalPrice = Number(updated[index].quantity) * Number(updated[index].estimatedUnitPrice);
    }
    setFormData({ ...formData, items: updated });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department) {
      toast.error('Department is required');
      return;
    }
    if (formData.items.some((item) => !item.itemName)) {
      toast.error('All items must have a name');
      return;
    }
    setSubmitting(true);
    try {
      await procurementApi.createRequisition(formData);
      toast.success('Purchase Requisition created');
      setShowCreate(false);
      setFormData({ department: '', urgency: 'MEDIUM', justification: '', items: [{ ...emptyItem }] });
      fetchRequisitions();
    } catch (error) {
      toast.error('Failed to create requisition');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await procurementApi.approveRequisition(id);
      toast.success('Requisition approved');
      fetchRequisitions();
      if (selectedPR?.id === id) setSelectedPR(null);
    } catch (error) {
      toast.error('Failed to approve requisition');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    try {
      await procurementApi.rejectRequisition(id, { reason });
      toast.success('Requisition rejected');
      fetchRequisitions();
      if (selectedPR?.id === id) setSelectedPR(null);
    } catch (error) {
      toast.error('Failed to reject requisition');
    }
  };

  const filteredRequisitions = requisitions.filter((r) => {
    return (
      r.prNumber?.toLowerCase().includes(search.toLowerCase()) ||
      r.department?.toLowerCase().includes(search.toLowerCase()) ||
      r.requestedBy?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalFormAmount = formData.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.estimatedUnitPrice)), 0);

  // Detail View
  if (selectedPR) {
    const r = selectedPR;
    const style = statusConfig[r.status] || statusConfig.DRAFT;
    const uStyle = urgencyConfig[r.urgency] || urgencyConfig.MEDIUM;
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedPR(null)} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
          ← Back to Requisitions
        </button>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{r.prNumber}</h2>
              <div className="flex items-center gap-3 mt-2">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                  {r.status?.replace(/_/g, ' ')}
                </span>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${uStyle.bg} ${uStyle.text}`}>
                  {r.urgency}
                </span>
                <span className="text-sm text-gray-500">{r.department}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">Requested by: {r.requestedBy} • {new Date(r.createdAt).toLocaleDateString()}</p>
              {r.justification && <p className="text-sm text-gray-600 mt-2 italic">"{r.justification}"</p>}
            </div>
            {r.status === 'PENDING_APPROVAL' && (
              <div className="flex items-center gap-2">
                <button onClick={() => handleApprove(r.id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4" /> Approve
                </button>
                <button onClick={() => handleReject(r.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium flex items-center gap-2">
                  <XCircleIcon className="h-4 w-4" /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Items</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(r.items || []).map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.itemName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.description || '—'}</td>
                  <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3 text-sm text-right">${Number(item.estimatedUnitPrice || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">${Number(item.totalPrice || 0).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={5} className="px-4 py-3 text-sm text-right">Total:</td>
                <td className="px-4 py-3 text-sm text-right">${Number(r.totalAmount || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {r.rejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
            <p className="text-sm text-red-700 mt-1">{r.rejectionReason}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search requisitions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          {prStatuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Urgencies</option>
          {urgencies.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5" />
          Create PR
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-500">Loading requisitions...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PR #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urgency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRequisitions.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No requisitions found</td></tr>
                ) : (
                  filteredRequisitions.map((r) => {
                    const style = statusConfig[r.status] || statusConfig.DRAFT;
                    const uStyle = urgencyConfig[r.urgency] || urgencyConfig.MEDIUM;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.prNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.department}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{r.requestedBy}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${uStyle.bg} ${uStyle.text}`}>
                            {r.urgency}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                            {r.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">${Number(r.totalAmount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setSelectedPR(r)} className="text-blue-600 hover:text-blue-800" title="View">
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            {r.status === 'PENDING_APPROVAL' && (
                              <>
                                <button onClick={() => handleApprove(r.id)} className="text-green-600 hover:text-green-800" title="Approve">
                                  <CheckCircleIcon className="h-5 w-5" />
                                </button>
                                <button onClick={() => handleReject(r.id)} className="text-red-600 hover:text-red-800" title="Reject">
                                  <XCircleIcon className="h-5 w-5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create PR Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Create Purchase Requisition</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                  <select
                    value={formData.urgency}
                    onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {urgencies.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Justification</label>
                  <input
                    type="text"
                    value={formData.justification}
                    onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Reason for request"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Items</h3>
                  <button type="button" onClick={addItem} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
                    <PlusIcon className="h-4 w-4" /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end bg-gray-50 p-3 rounded-lg">
                      <div className="col-span-3">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Item Name *</label>}
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Item name"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>}
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Description"
                        />
                      </div>
                      <div className="col-span-1">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>}
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-1">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>}
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="PCS">PCS</option>
                          <option value="BOX">BOX</option>
                          <option value="PACK">PACK</option>
                          <option value="KG">KG</option>
                          <option value="LTR">LTR</option>
                          <option value="SET">SET</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Est. Price</label>}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.estimatedUnitPrice}
                          onChange={(e) => updateItem(index, 'estimatedUnitPrice', Number(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>}
                        <span className="block px-2 py-1.5 text-sm font-medium text-gray-700">
                          ${Number(item.quantity * item.estimatedUnitPrice).toFixed(2)}
                        </span>
                      </div>
                      <div className="col-span-1">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">&nbsp;</label>}
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length <= 1}
                          className="text-red-500 hover:text-red-700 disabled:opacity-30 p-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-right">
                  <span className="text-sm font-semibold text-gray-900">Total: ${Number(totalFormAmount).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                  {submitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Create Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
