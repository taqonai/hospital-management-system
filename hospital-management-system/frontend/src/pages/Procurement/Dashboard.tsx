import { useState, useEffect } from 'react';
import {
  CurrencyDollarIcon,
  ClipboardDocumentCheckIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { procurementApi } from '../../services/procurementApi';

// ==================== Interfaces ====================
interface DashboardStats {
  totalSpend: number;
  openPOs: number;
  pendingApprovals: number;
  overdueDeliveries: number;
  activeSuppliers: number;
}

interface RecentPO {
  id: string;
  poNumber: string;
  supplier: { companyName: string };
  status: string;
  totalAmount: number;
  orderDate: string;
  expectedDeliveryDate: string;
}

interface PendingApproval {
  id: string;
  type: 'PR' | 'PO' | 'GRN' | 'INVOICE';
  referenceNumber: string;
  requestedBy: string;
  department: string;
  amount: number;
  date: string;
}

interface SpendCategory {
  category: string;
  amount: number;
  percentage: number;
}

interface LowStockAlert {
  id: string;
  itemName: string;
  currentStock: number;
  reorderLevel: number;
  unit: string;
}

// ==================== Status Config ====================
const poStatusConfig: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700' },
  PENDING_APPROVAL: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  SENT: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  PARTIALLY_RECEIVED: { bg: 'bg-orange-100', text: 'text-orange-700' },
  RECEIVED: { bg: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export default function ProcurementDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSpend: 0,
    openPOs: 0,
    pendingApprovals: 0,
    overdueDeliveries: 0,
    activeSuppliers: 0,
  });
  const [recentPOs, setRecentPOs] = useState<RecentPO[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [spendByCategory, setSpendByCategory] = useState<SpendCategory[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, posRes, approvalsRes, spendRes, stockRes] = await Promise.allSettled([
        procurementApi.getDashboardStats(),
        procurementApi.getRecentPOs(10),
        procurementApi.getPendingApprovals(),
        procurementApi.getSpendByCategory(),
        procurementApi.getLowStockAlerts(),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data.data || statsRes.value.data);
      if (posRes.status === 'fulfilled') setRecentPOs(posRes.value.data.data || posRes.value.data || []);
      if (approvalsRes.status === 'fulfilled') setPendingApprovals(approvalsRes.value.data.data || approvalsRes.value.data || []);
      if (spendRes.status === 'fulfilled') setSpendByCategory(spendRes.value.data.data || spendRes.value.data || []);
      if (stockRes.status === 'fulfilled') setLowStockAlerts(stockRes.value.data.data || stockRes.value.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (item: PendingApproval) => {
    try {
      if (item.type === 'PR') {
        await procurementApi.approveRequisition(item.id);
      } else if (item.type === 'PO') {
        await procurementApi.approvePurchaseOrder(item.id);
      } else if (item.type === 'GRN') {
        await procurementApi.approveGoodsReceipt(item.id);
      } else if (item.type === 'INVOICE') {
        await procurementApi.approveInvoice(item.id);
      }
      toast.success(`${item.type} ${item.referenceNumber} approved`);
      fetchDashboardData();
    } catch (error) {
      toast.error(`Failed to approve ${item.type}`);
    }
  };

  const handleReject = async (item: PendingApproval) => {
    try {
      if (item.type === 'PR') {
        await procurementApi.rejectRequisition(item.id, { reason: 'Rejected from dashboard' });
      } else if (item.type === 'GRN') {
        await procurementApi.rejectGoodsReceipt(item.id, 'Rejected from dashboard');
      }
      toast.success(`${item.type} ${item.referenceNumber} rejected`);
      fetchDashboardData();
    } catch (error) {
      toast.error(`Failed to reject ${item.type}`);
    }
  };

  const maxSpend = Math.max(...spendByCategory.map(s => s.amount), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-gray-500">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Spend', value: `$${Number(stats.totalSpend || 0).toFixed(2)}`, icon: CurrencyDollarIcon, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Open POs', value: stats.openPOs, icon: ClipboardDocumentCheckIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending Approvals', value: stats.pendingApprovals, icon: ExclamationTriangleIcon, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Overdue Deliveries', value: stats.overdueDeliveries, icon: TruckIcon, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Active Suppliers', value: stats.activeSuppliers, icon: UserGroupIcon, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent POs */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Purchase Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentPOs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No recent purchase orders</td>
                  </tr>
                ) : (
                  recentPOs.map((po) => {
                    const statusStyle = poStatusConfig[po.status] || poStatusConfig.DRAFT;
                    return (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{po.poNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{po.supplier?.companyName || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            {po.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          ${Number(po.totalAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Pending Approvals</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {pendingApprovals.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No pending approvals</div>
            ) : (
              pendingApprovals.map((item) => (
                <div key={item.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {item.type}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{item.referenceNumber}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {item.requestedBy} • {item.department} • ${Number(item.amount || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(item)}
                        className="p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                        title="Approve"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleReject(item)}
                        className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        title="Reject"
                      >
                        <XCircleIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Category (Simple Bar Chart) */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <ChartBarIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Spend by Category</h3>
          </div>
          {spendByCategory.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No spend data available</div>
          ) : (
            <div className="space-y-4">
              {spendByCategory.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{cat.category}</span>
                    <span className="text-sm text-gray-500">${Number(cat.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(cat.amount / maxSpend) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{Number(cat.percentage || 0).toFixed(1)}% of total</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
            {lowStockAlerts.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">All stock levels are healthy</div>
            ) : (
              lowStockAlerts.map((item) => (
                <div key={item.id} className="px-6 py-3 hover:bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                    <p className="text-xs text-gray-500">
                      Reorder Level: {item.reorderLevel} {item.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${item.currentStock <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {item.currentStock} {item.unit}
                    </span>
                    {item.currentStock <= 0 && (
                      <p className="text-xs text-red-500 font-medium">OUT OF STOCK</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
