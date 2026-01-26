import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { procurementApi } from '../../services/procurementApi';

// ==================== Interfaces ====================
interface GRNItem {
  id?: string;
  itemName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unit: string;
  batchNumber: string;
  expiryDate: string;
  inspectionStatus: string;
  inspectionNotes: string;
}

interface GoodsReceipt {
  id: string;
  grnNumber: string;
  purchaseOrder: { id: string; poNumber: string };
  supplier: { companyName: string };
  status: string;
  receiptDate: string;
  receivedBy: string;
  items: GRNItem[];
  notes: string;
  createdAt: string;
}

interface PurchaseOrderRef {
  id: string;
  poNumber: string;
  supplier: { companyName: string };
  items: Array<{
    itemName: string;
    quantity: number;
    receivedQuantity: number;
    unit: string;
  }>;
}

const grnStatuses = ['PENDING_INSPECTION', 'INSPECTED', 'APPROVED', 'REJECTED', 'PARTIAL'];

const statusConfig: Record<string, { bg: string; text: string }> = {
  PENDING_INSPECTION: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  INSPECTED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700' },
  PARTIAL: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const inspectionConfig: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-gray-100', text: 'text-gray-600' },
  PASSED: { bg: 'bg-green-100', text: 'text-green-700' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-700' },
  CONDITIONAL: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

export default function GoodsReceipt() {
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [availablePOs, setAvailablePOs] = useState<PurchaseOrderRef[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [grnItems, setGRNItems] = useState<GRNItem[]>([]);
  const [grnNotes, setGRNNotes] = useState('');

  // Detail view
  const [selectedGRN, setSelectedGRN] = useState<GoodsReceipt | null>(null);

  useEffect(() => {
    fetchGoodsReceipts();
  }, [filterStatus]);

  const fetchGoodsReceipts = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      const response = await procurementApi.getGoodsReceipts(params);
      const d = response.data.data;
      setGoodsReceipts(Array.isArray(d) ? d : d?.grns || []);
    } catch (error) {
      console.error('Failed to fetch goods receipts:', error);
      toast.error('Failed to load goods receipts');
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = async () => {
    try {
      const response = await procurementApi.getPurchaseOrders({ status: 'SENT' });
      const pd = response.data.data;
      setAvailablePOs(Array.isArray(pd) ? pd : pd?.orders || []);
    } catch (error) {
      toast.error('Failed to load purchase orders');
      return;
    }
    setSelectedPOId('');
    setGRNItems([]);
    setGRNNotes('');
    setShowCreate(true);
  };

  const handlePOSelect = (poId: string) => {
    setSelectedPOId(poId);
    const po = availablePOs.find((p) => p.id === poId);
    if (po) {
      setGRNItems(
        (po.items || []).map((item) => ({
          itemName: item.itemName,
          orderedQuantity: item.quantity,
          receivedQuantity: 0,
          unit: item.unit,
          batchNumber: '',
          expiryDate: '',
          inspectionStatus: 'PENDING',
          inspectionNotes: '',
        }))
      );
    } else {
      setGRNItems([]);
    }
  };

  const updateGRNItem = (index: number, field: keyof GRNItem, value: any) => {
    const updated = [...grnItems];
    (updated[index] as any)[field] = value;
    setGRNItems(updated);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOId) {
      toast.error('Please select a Purchase Order');
      return;
    }
    if (grnItems.every((item) => item.receivedQuantity <= 0)) {
      toast.error('At least one item must have a received quantity');
      return;
    }
    setSubmitting(true);
    try {
      await procurementApi.createGoodsReceipt({
        purchaseOrderId: selectedPOId,
        items: grnItems,
        notes: grnNotes,
      });
      toast.success('Goods Receipt created successfully');
      setShowCreate(false);
      fetchGoodsReceipts();
    } catch (error) {
      toast.error('Failed to create goods receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await procurementApi.approveGoodsReceipt(id);
      toast.success('GRN approved — inventory updated');
      fetchGoodsReceipts();
      if (selectedGRN?.id === id) setSelectedGRN(null);
    } catch (error) {
      toast.error('Failed to approve GRN');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    try {
      await procurementApi.rejectGoodsReceipt(id, reason);
      toast.success('GRN rejected');
      fetchGoodsReceipts();
      if (selectedGRN?.id === id) setSelectedGRN(null);
    } catch (error) {
      toast.error('Failed to reject GRN');
    }
  };

  const filteredGRNs = goodsReceipts.filter((g) => {
    return (
      g.grnNumber?.toLowerCase().includes(search.toLowerCase()) ||
      g.purchaseOrder?.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
      g.supplier?.companyName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Detail View
  if (selectedGRN) {
    const g = selectedGRN;
    const style = statusConfig[g.status] || statusConfig.PENDING_INSPECTION;
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedGRN(null)} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
          ← Back to Goods Receipts
        </button>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{g.grnNumber}</h2>
              <p className="text-sm text-gray-500 mt-1">PO: {g.purchaseOrder?.poNumber} • Supplier: {g.supplier?.companyName}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                  {g.status?.replace(/_/g, ' ')}
                </span>
                <span className="text-sm text-gray-500">
                  Received: {new Date(g.receiptDate || g.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            {(g.status === 'PENDING_INSPECTION' || g.status === 'INSPECTED') && (
              <div className="flex items-center gap-2">
                <button onClick={() => handleApprove(g.id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4" /> Approve GRN
                </button>
                <button onClick={() => handleReject(g.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium flex items-center gap-2">
                  <XCircleIcon className="h-4 w-4" /> Reject
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Received Items</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ordered</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(g.items || []).map((item, idx) => {
                const iStyle = inspectionConfig[item.inspectionStatus] || inspectionConfig.PENDING;
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.itemName}</td>
                    <td className="px-4 py-3 text-sm text-right">{item.orderedQuantity} {item.unit}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      <span className={item.receivedQuantity < item.orderedQuantity ? 'text-orange-600' : 'text-green-600'}>
                        {item.receivedQuantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.batchNumber || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${iStyle.bg} ${iStyle.text}`}>
                        {item.inspectionStatus}
                      </span>
                      {item.inspectionNotes && (
                        <p className="text-xs text-gray-500 mt-1">{item.inspectionNotes}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {g.notes && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
            <p className="text-sm text-gray-700">{g.notes}</p>
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
            placeholder="Search goods receipts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          {grnStatuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button
          onClick={openCreateForm}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5" />
          Create GRN
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-500">Loading goods receipts...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GRN #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredGRNs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No goods receipts found</td></tr>
                ) : (
                  filteredGRNs.map((g) => {
                    const style = statusConfig[g.status] || statusConfig.PENDING_INSPECTION;
                    return (
                      <tr key={g.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{g.grnNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.purchaseOrder?.poNumber || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.supplier?.companyName || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                            {g.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(g.receiptDate || g.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setSelectedGRN(g)} className="text-blue-600 hover:text-blue-800" title="View">
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            {(g.status === 'PENDING_INSPECTION' || g.status === 'INSPECTED') && (
                              <button onClick={() => handleApprove(g.id)} className="text-green-600 hover:text-green-800" title="Approve">
                                <CheckCircleIcon className="h-5 w-5" />
                              </button>
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

      {/* Create GRN Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Create Goods Receipt Note</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase Order *</label>
                <select
                  value={selectedPOId}
                  onChange={(e) => handlePOSelect(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select PO</option>
                  {availablePOs.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.poNumber} — {po.supplier?.companyName}
                    </option>
                  ))}
                </select>
              </div>

              {grnItems.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Receive Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ordered</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Received *</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Inspection</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {grnItems.map((item, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.itemName}</td>
                            <td className="px-3 py-2 text-sm text-right">{item.orderedQuantity} {item.unit}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max={item.orderedQuantity}
                                value={item.receivedQuantity}
                                onChange={(e) => updateGRNItem(index, 'receivedQuantity', Number(e.target.value))}
                                className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={item.batchNumber}
                                onChange={(e) => updateGRNItem(index, 'batchNumber', e.target.value)}
                                className="w-28 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Batch #"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={item.expiryDate}
                                onChange={(e) => updateGRNItem(index, 'expiryDate', e.target.value)}
                                className="w-36 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.inspectionStatus}
                                onChange={(e) => updateGRNItem(index, 'inspectionStatus', e.target.value)}
                                className="w-28 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="PENDING">Pending</option>
                                <option value="PASSED">Passed</option>
                                <option value="FAILED">Failed</option>
                                <option value="CONDITIONAL">Conditional</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={item.inspectionNotes}
                                onChange={(e) => updateGRNItem(index, 'inspectionNotes', e.target.value)}
                                className="w-32 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Notes"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">General Notes</label>
                <textarea
                  value={grnNotes}
                  onChange={(e) => setGRNNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes about this delivery..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                  {submitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Create GRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
