import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  EyeIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  TrashIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { procurementApi } from '../../services/procurementApi';

// ==================== Interfaces ====================
interface POItem {
  id?: string;
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity?: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: { id: string; companyName: string };
  status: string;
  totalAmount: number;
  orderDate: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  paymentTerms: string;
  notes: string;
  items: POItem[];
  linkedPRs: string[];
  linkedGRNs: Array<{ id: string; grnNumber: string; status: string }>;
  linkedInvoices: Array<{ id: string; invoiceNumber: string; status: string }>;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

interface Supplier {
  id: string;
  companyName: string;
  supplierCode: string;
}

const poStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED'];

const statusConfig: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
  PENDING_APPROVAL: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  SENT: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  PARTIALLY_RECEIVED: { bg: 'bg-orange-100', text: 'text-orange-700' },
  RECEIVED: { bg: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const timelineSteps = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'];

const emptyItem: POItem = {
  itemName: '', description: '', quantity: 1, unit: 'PCS', unitPrice: 0, totalPrice: 0,
};

export default function PurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    expectedDeliveryDate: '',
    deliveryAddress: '',
    paymentTerms: 'NET_30',
    notes: '',
    items: [{ ...emptyItem }],
  });

  // Detail view
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchPurchaseOrders();
    fetchSuppliers();
  }, [filterStatus, filterSupplier]);

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterSupplier) params.supplierId = filterSupplier;
      const response = await procurementApi.getPurchaseOrders(params);
      const d = response.data.data;
      setPurchaseOrders(Array.isArray(d) ? d : d?.orders || []);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await procurementApi.getSuppliers({ status: 'APPROVED' });
      const sd = response.data.data;
      setSuppliers(Array.isArray(sd) ? sd : sd?.suppliers || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const viewPODetail = async (po: PurchaseOrder) => {
    setLoadingDetail(true);
    try {
      const response = await procurementApi.getPurchaseOrderById(po.id);
      setSelectedPO(response.data.data || response.data);
    } catch (error) {
      setSelectedPO(po);
    } finally {
      setLoadingDetail(false);
    }
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { ...emptyItem }] });
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    const updated = [...formData.items];
    (updated[index] as any)[field] = value;
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].totalPrice = Number(updated[index].quantity) * Number(updated[index].unitPrice);
    }
    setFormData({ ...formData, items: updated });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierId) {
      toast.error('Supplier is required');
      return;
    }
    if (formData.items.some((item) => !item.itemName)) {
      toast.error('All items must have a name');
      return;
    }
    setSubmitting(true);
    try {
      await procurementApi.createPurchaseOrder(formData);
      toast.success('Purchase Order created');
      setShowCreate(false);
      setFormData({ supplierId: '', expectedDeliveryDate: '', deliveryAddress: '', paymentTerms: 'NET_30', notes: '', items: [{ ...emptyItem }] });
      fetchPurchaseOrders();
    } catch (error) {
      toast.error('Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async (id: string) => {
    try {
      await procurementApi.sendPurchaseOrder(id);
      toast.success('Purchase order sent to supplier');
      fetchPurchaseOrders();
      if (selectedPO?.id === id) {
        viewPODetail(selectedPO);
      }
    } catch (error) {
      toast.error('Failed to send purchase order');
    }
  };

  const handleCancel = async (id: string) => {
    const reason = prompt('Cancellation reason:');
    if (reason === null) return;
    try {
      await procurementApi.cancelPurchaseOrder(id, reason);
      toast.success('Purchase order cancelled');
      fetchPurchaseOrders();
      if (selectedPO?.id === id) setSelectedPO(null);
    } catch (error) {
      toast.error('Failed to cancel purchase order');
    }
  };

  const filteredPOs = purchaseOrders.filter((po) => {
    return (
      po.poNumber?.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier?.companyName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalFormAmount = formData.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);

  // Detail View
  if (selectedPO) {
    const po = selectedPO;
    const style = statusConfig[po.status] || statusConfig.DRAFT;
    const currentStepIndex = timelineSteps.indexOf(po.status);

    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedPO(null)} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
          ← Back to Purchase Orders
        </button>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{po.poNumber}</h2>
                  <p className="text-sm text-gray-500 mt-1">Supplier: {po.supplier?.companyName || '—'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                      {po.status?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-500">
                      Order: {new Date(po.orderDate || po.createdAt).toLocaleDateString()}
                    </span>
                    {po.expectedDeliveryDate && (
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        Expected: {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {po.status === 'APPROVED' && (
                    <button onClick={() => handleSend(po.id)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium flex items-center gap-2">
                      <PaperAirplaneIcon className="h-4 w-4" /> Send to Supplier
                    </button>
                  )}
                  {['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(po.status) && (
                    <button onClick={() => handleCancel(po.id)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Status Timeline</h3>
              <div className="flex items-center">
                {timelineSteps.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          isCompleted ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                        } ${isCurrent ? 'ring-4 ring-blue-200' : ''}`}>
                          {isCompleted ? <CheckCircleIcon className="h-5 w-5" /> : index + 1}
                        </div>
                        <span className={`text-xs mt-1 ${isCompleted ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                          {step.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {index < timelineSteps.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 ${index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Items</h3>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ordered</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(po.items || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.itemName}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.receivedQuantity ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                      <td className="px-4 py-3 text-sm text-right">${Number(item.unitPrice || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">${Number(item.totalPrice || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={5} className="px-4 py-3 text-sm text-right">Total:</td>
                    <td className="px-4 py-3 text-sm text-right">${Number(po.totalAmount || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Linked Documents */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Linked GRNs */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Linked GRNs</h3>
                {(po.linkedGRNs || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No goods receipts yet</p>
                ) : (
                  <div className="space-y-2">
                    {po.linkedGRNs.map((grn) => (
                      <div key={grn.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{grn.grnNumber}</span>
                        <span className="text-xs text-gray-500">{grn.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Invoices */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Linked Invoices</h3>
                {(po.linkedInvoices || []).length === 0 ? (
                  <p className="text-sm text-gray-500">No invoices yet</p>
                ) : (
                  <div className="space-y-2">
                    {po.linkedInvoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{inv.invoiceNumber}</span>
                        <span className="text-xs text-gray-500">{inv.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {po.notes && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
                <p className="text-sm text-gray-700">{po.notes}</p>
              </div>
            )}
          </>
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
            placeholder="Search purchase orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          {poStatuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.companyName}</option>)}
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5" />
          Create PO
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-500">Loading purchase orders...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPOs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No purchase orders found</td></tr>
                ) : (
                  filteredPOs.map((po) => {
                    const style = statusConfig[po.status] || statusConfig.DRAFT;
                    return (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{po.poNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{po.supplier?.companyName || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                            {po.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">${Number(po.totalAmount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(po.orderDate || po.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => viewPODetail(po)} className="text-blue-600 hover:text-blue-800" title="View">
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            {po.status === 'APPROVED' && (
                              <button onClick={() => handleSend(po.id)} className="text-indigo-600 hover:text-indigo-800" title="Send">
                                <PaperAirplaneIcon className="h-5 w-5" />
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

      {/* Create PO Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Create Purchase Order</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.companyName} ({s.supplierCode})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NET_15">Net 15</option>
                    <option value="NET_30">Net 30</option>
                    <option value="NET_45">Net 45</option>
                    <option value="NET_60">Net 60</option>
                    <option value="COD">Cash on Delivery</option>
                    <option value="PREPAID">Prepaid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={formData.deliveryAddress}
                    onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Delivery address"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Order Items</h3>
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
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price</label>}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>}
                        <span className="block px-2 py-1.5 text-sm font-medium text-gray-700">
                          ${Number(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                      </div>
                      <div className="col-span-1">
                        {index === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">&nbsp;</label>}
                        <button type="button" onClick={() => removeItem(index)} disabled={formData.items.length <= 1} className="text-red-500 hover:text-red-700 disabled:opacity-30 p-1">
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
                  Create Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
