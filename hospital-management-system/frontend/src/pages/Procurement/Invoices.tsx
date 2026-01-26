import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  EyeIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { procurementApi } from '../../services/procurementApi';

// ==================== Interfaces ====================
interface Invoice {
  id: string;
  invoiceNumber: string;
  supplier: { id: string; companyName: string };
  purchaseOrder: { id: string; poNumber: string };
  amount: number;
  taxAmount: number;
  totalAmount: number;
  matchStatus: string;
  paymentStatus: string;
  dueDate: string;
  invoiceDate: string;
  notes: string;
  createdAt: string;
}

interface ThreeWayMatch {
  poData: {
    poNumber: string;
    items: Array<{ itemName: string; quantity: number; unitPrice: number; total: number }>;
    totalAmount: number;
  };
  grnData: {
    grnNumber: string;
    items: Array<{ itemName: string; receivedQuantity: number }>;
  };
  invoiceData: {
    invoiceNumber: string;
    items: Array<{ itemName: string; quantity: number; unitPrice: number; total: number }>;
    totalAmount: number;
  };
  matchResult: {
    quantityMatch: boolean;
    priceMatch: boolean;
    overallMatch: boolean;
    discrepancies: string[];
  };
}

interface Supplier {
  id: string;
  companyName: string;
}

const matchStatusConfig: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-gray-100', text: 'text-gray-600' },
  MATCHED: { bg: 'bg-green-100', text: 'text-green-700' },
  PARTIAL_MATCH: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  MISMATCH: { bg: 'bg-red-100', text: 'text-red-700' },
  EXCEPTION: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const paymentStatusConfig: Record<string, { bg: string; text: string }> = {
  UNPAID: { bg: 'bg-red-100', text: 'text-red-700' },
  PARTIALLY_PAID: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  PAID: { bg: 'bg-green-100', text: 'text-green-700' },
  OVERDUE: { bg: 'bg-red-100', text: 'text-red-700' },
  VOIDED: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMatchStatus, setFilterMatchStatus] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formData, setFormData] = useState({
    supplierInvoiceNumber: '',
    supplierId: '',
    purchaseOrderId: '',
    amount: 0,
    taxAmount: 0,
    invoiceDate: '',
    dueDate: '',
    notes: '',
  });

  // 3-way match view
  const [showMatchView, setShowMatchView] = useState(false);
  const [matchData, setMatchData] = useState<ThreeWayMatch | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchSuppliers();
  }, [filterMatchStatus, filterPaymentStatus]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterMatchStatus) params.matchStatus = filterMatchStatus;
      if (filterPaymentStatus) params.paymentStatus = filterPaymentStatus;
      const response = await procurementApi.getInvoices(params);
      setInvoices(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await procurementApi.getSuppliers({ status: 'APPROVED' });
      setSuppliers(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierId || !formData.supplierInvoiceNumber) {
      toast.error('Supplier and invoice number are required');
      return;
    }
    setSubmitting(true);
    try {
      await procurementApi.createInvoice(formData);
      toast.success('Invoice recorded successfully');
      setShowCreate(false);
      setFormData({ supplierInvoiceNumber: '', supplierId: '', purchaseOrderId: '', amount: 0, taxAmount: 0, invoiceDate: '', dueDate: '', notes: '' });
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to record invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const viewThreeWayMatch = async (invoiceId: string) => {
    setLoadingMatch(true);
    setShowMatchView(true);
    try {
      const response = await procurementApi.getThreeWayMatch(invoiceId);
      setMatchData(response.data.data || response.data);
    } catch (error) {
      toast.error('Failed to load 3-way match data');
      setShowMatchView(false);
    } finally {
      setLoadingMatch(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await procurementApi.approveInvoice(id);
      toast.success('Invoice approved for payment');
      fetchInvoices();
    } catch (error) {
      toast.error('Failed to approve invoice');
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    return (
      inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      inv.supplier?.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      inv.purchaseOrder?.poNumber?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={filterMatchStatus} onChange={(e) => setFilterMatchStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Match Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="MATCHED">Matched</option>
          <option value="PARTIAL_MATCH">Partial Match</option>
          <option value="MISMATCH">Mismatch</option>
          <option value="EXCEPTION">Exception</option>
        </select>
        <select value={filterPaymentStatus} onChange={(e) => setFilterPaymentStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Payment Statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5" />
          Record Invoice
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-500">Loading invoices...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Ref</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No invoices found</td></tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const mStyle = matchStatusConfig[inv.matchStatus] || matchStatusConfig.PENDING;
                    const pStyle = paymentStatusConfig[inv.paymentStatus] || paymentStatusConfig.UNPAID;
                    const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.paymentStatus !== 'PAID';
                    return (
                      <tr key={inv.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{inv.supplier?.companyName || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{inv.purchaseOrder?.poNumber || '—'}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">${Number(inv.totalAmount || inv.amount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${mStyle.bg} ${mStyle.text}`}>
                            {inv.matchStatus?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${pStyle.bg} ${pStyle.text}`}>
                            {isOverdue ? 'OVERDUE' : inv.paymentStatus?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => viewThreeWayMatch(inv.id)} className="text-indigo-600 hover:text-indigo-800" title="3-Way Match">
                              <DocumentDuplicateIcon className="h-5 w-5" />
                            </button>
                            {inv.matchStatus === 'MATCHED' && inv.paymentStatus === 'UNPAID' && (
                              <button onClick={() => handleApprove(inv.id)} className="text-green-600 hover:text-green-800" title="Approve for Payment">
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

      {/* Record Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Record Invoice</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Invoice Number *</label>
                <input
                  type="text"
                  value={formData.supplierInvoiceNumber}
                  onChange={(e) => setFormData({ ...formData, supplierInvoiceNumber: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.companyName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.taxAmount}
                    onChange={(e) => setFormData({ ...formData, taxAmount: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">
                  Total: ${Number(formData.amount + formData.taxAmount).toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                  {submitting && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  Record Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-Way Match View Modal */}
      {showMatchView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">3-Way Match: PO vs GRN vs Invoice</h2>
              <button onClick={() => { setShowMatchView(false); setMatchData(null); }} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            {loadingMatch ? (
              <div className="flex items-center justify-center py-16">
                <ArrowPathIcon className="h-6 w-6 text-blue-600 animate-spin" />
                <span className="ml-2 text-gray-500">Loading match data...</span>
              </div>
            ) : matchData ? (
              <div className="p-6 space-y-6">
                {/* Match Result Banner */}
                <div className={`p-4 rounded-lg border-2 ${matchData.matchResult?.overallMatch ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                  <div className="flex items-center gap-2">
                    {matchData.matchResult?.overallMatch ? (
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    ) : (
                      <XMarkIcon className="h-6 w-6 text-red-600" />
                    )}
                    <span className={`font-semibold ${matchData.matchResult?.overallMatch ? 'text-green-800' : 'text-red-800'}`}>
                      {matchData.matchResult?.overallMatch ? 'All Documents Match' : 'Discrepancies Found'}
                    </span>
                  </div>
                  {(matchData.matchResult?.discrepancies || []).length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {matchData.matchResult.discrepancies.map((d, i) => (
                        <li key={i} className="text-sm text-red-700">• {d}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Side-by-side Comparison */}
                <div className="grid grid-cols-3 gap-4">
                  {/* PO Data */}
                  <div className="border border-gray-200 rounded-lg">
                    <div className="bg-blue-50 px-4 py-3 rounded-t-lg border-b">
                      <h4 className="font-semibold text-blue-800">Purchase Order</h4>
                      <p className="text-sm text-blue-600">{matchData.poData?.poNumber}</p>
                    </div>
                    <div className="p-4 space-y-2">
                      {(matchData.poData?.items || []).map((item, idx) => (
                        <div key={idx} className="text-sm border-b border-gray-100 pb-2">
                          <p className="font-medium text-gray-900">{item.itemName}</p>
                          <p className="text-gray-500">Qty: {item.quantity} • ${Number(item.unitPrice || 0).toFixed(2)} ea</p>
                          <p className="font-medium">Total: ${Number(item.total || 0).toFixed(2)}</p>
                        </div>
                      ))}
                      <div className="pt-2 font-semibold text-sm">
                        Total: ${Number(matchData.poData?.totalAmount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* GRN Data */}
                  <div className="border border-gray-200 rounded-lg">
                    <div className="bg-green-50 px-4 py-3 rounded-t-lg border-b">
                      <h4 className="font-semibold text-green-800">Goods Receipt</h4>
                      <p className="text-sm text-green-600">{matchData.grnData?.grnNumber}</p>
                    </div>
                    <div className="p-4 space-y-2">
                      {(matchData.grnData?.items || []).map((item, idx) => (
                        <div key={idx} className="text-sm border-b border-gray-100 pb-2">
                          <p className="font-medium text-gray-900">{item.itemName}</p>
                          <p className="text-gray-500">Received: {item.receivedQuantity}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Invoice Data */}
                  <div className="border border-gray-200 rounded-lg">
                    <div className="bg-purple-50 px-4 py-3 rounded-t-lg border-b">
                      <h4 className="font-semibold text-purple-800">Invoice</h4>
                      <p className="text-sm text-purple-600">{matchData.invoiceData?.invoiceNumber}</p>
                    </div>
                    <div className="p-4 space-y-2">
                      {(matchData.invoiceData?.items || []).map((item, idx) => (
                        <div key={idx} className="text-sm border-b border-gray-100 pb-2">
                          <p className="font-medium text-gray-900">{item.itemName}</p>
                          <p className="text-gray-500">Qty: {item.quantity} • ${Number(item.unitPrice || 0).toFixed(2)} ea</p>
                          <p className="font-medium">Total: ${Number(item.total || 0).toFixed(2)}</p>
                        </div>
                      ))}
                      <div className="pt-2 font-semibold text-sm">
                        Total: ${Number(matchData.invoiceData?.totalAmount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg ${matchData.matchResult?.quantityMatch ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <span className={`text-sm font-medium ${matchData.matchResult?.quantityMatch ? 'text-green-700' : 'text-red-700'}`}>
                      {matchData.matchResult?.quantityMatch ? '✓' : '✗'} Quantity Match
                    </span>
                  </div>
                  <div className={`p-3 rounded-lg ${matchData.matchResult?.priceMatch ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <span className={`text-sm font-medium ${matchData.matchResult?.priceMatch ? 'text-green-700' : 'text-red-700'}`}>
                      {matchData.matchResult?.priceMatch ? '✓' : '✗'} Price Match
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">No match data available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
