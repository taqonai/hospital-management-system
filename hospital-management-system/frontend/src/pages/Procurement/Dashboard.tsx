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
  DocumentTextIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { procurementApi } from '../../services/procurementApi';
import { useAuth } from '../../hooks/useAuth';

// ==================== Interfaces ====================
interface DashboardMetrics {
  suppliers: { total: number; active: number };
  requisitions: { pendingApproval: number };
  purchaseOrders: { pendingApproval: number; open: number; overdueDeliveries: number };
  invoices: { pendingMatch: number; overduePayments: number };
  spend: { monthly: number; yearly: number };
}

interface POStatusBreakdown {
  status: string;
  count: number;
}

interface RecentPO {
  id: string;
  poNumber: string;
  supplier: { companyName: string; code: string };
  status: string;
  totalAmount: number;
  orderDate: string;
  expectedDate: string;
}

interface PendingItem {
  id: string;
  prNumber: string;
  urgency: string;
  totalEstimated: number;
  createdAt: string;
  requestedBy: { firstName: string; lastName: string };
  department: { name: string };
}

interface SpendCategory {
  category: string;
  total: number;
  count: number;
}

interface LowStockAlert {
  id: string;
  name: string;
  code: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
}

interface MyPR {
  id: string;
  prNumber: string;
  status: string;
  urgency: string;
  totalEstimated: number;
  createdAt: string;
  department: { name: string; code: string };
}

interface RecentGRN {
  id: string;
  grnNumber: string;
  status: string;
  receiptDate: string;
  inspectionStatus: string;
  purchaseOrder: {
    poNumber: string;
    supplier: { companyName: string };
  };
  receivedBy: { firstName: string; lastName: string };
}

// ==================== Status Config ====================
const poStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT_PO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  PENDING_APPROVAL_PO: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  APPROVED_PO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Approved' },
  SENT_TO_SUPPLIER: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Sent' },
  PARTIALLY_RECEIVED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Partial' },
  FULLY_RECEIVED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Received' },
  CANCELLED_PO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
  CLOSED_PO: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Closed' },
  AMENDED: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Amended' },
};

const prStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT_PR: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Submitted' },
  PENDING_APPROVAL: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  APPROVED_PR: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
  REJECTED_PR: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  CANCELLED_PR: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cancelled' },
  PARTIALLY_ORDERED: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Partial Order' },
  FULLY_ORDERED: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Fully Ordered' },
  CLOSED_PR: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Closed' },
};

// ==================== Procurement Manager Dashboard ====================
function ProcurementManagerDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [poStatusBreakdown, setPOStatusBreakdown] = useState<POStatusBreakdown[]>([]);
  const [spendByCategory, setSpendByCategory] = useState<SpendCategory[]>([]);
  const [recentPOs, setRecentPOs] = useState<RecentPO[]>([]);
  const [pendingPRs, setPendingPRs] = useState<PendingItem[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, poStatusRes, spendRes, posRes, pendingRes, stockRes] = await Promise.allSettled([
        procurementApi.getDashboardStats(),
        procurementApi.getPOStatusBreakdown(),
        procurementApi.getSpendByCategory(),
        procurementApi.getRecentPOs(10),
        procurementApi.getPendingApprovals(),
        procurementApi.getLowStockAlerts(),
      ]);

      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value.data.data || metricsRes.value.data);
      }
      if (poStatusRes.status === 'fulfilled') {
        setPOStatusBreakdown(poStatusRes.value.data.data || poStatusRes.value.data || []);
      }
      if (spendRes.status === 'fulfilled') {
        setSpendByCategory(spendRes.value.data.data || spendRes.value.data || []);
      }
      if (posRes.status === 'fulfilled') {
        setRecentPOs(posRes.value.data.data || posRes.value.data || []);
      }
      if (pendingRes.status === 'fulfilled') {
        const pending = pendingRes.value.data.data || pendingRes.value.data;
        setPendingPRs(pending.pendingPRs || []);
      }
      if (stockRes.status === 'fulfilled') {
        setLowStockAlerts(stockRes.value.data.data || stockRes.value.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePR = async (prId: string) => {
    try {
      await procurementApi.approveRequisition(prId, {});
      toast.success('PR approved successfully');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to approve PR');
    }
  };

  const maxSpend = Math.max(...spendByCategory.map(s => s.total), 1);
  const totalPOCount = poStatusBreakdown.reduce((sum, item) => sum + item.count, 0);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total POs (This Month)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalPOCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <ClipboardDocumentCheckIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Approvals</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Number(metrics?.requisitions?.pendingApproval || 0) + Number(metrics?.purchaseOrders?.pendingApproval || 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-yellow-50">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Spend (Month)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${Number(metrics?.spend?.monthly || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Suppliers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics?.suppliers?.active || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50">
              <UserGroupIcon className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Category */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <ChartBarIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Spend by Category</h3>
          </div>
          {spendByCategory.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No spend data available</div>
          ) : (
            <div className="space-y-4">
              {spendByCategory.slice(0, 5).map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{cat.category}</span>
                    <span className="text-sm text-gray-500">${Number(cat.total || 0).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${(cat.total / maxSpend) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PO Status Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCartIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">PO Status Overview</h3>
          </div>
          {poStatusBreakdown.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No PO data available</div>
          ) : (
            <div className="space-y-3">
              {poStatusBreakdown.map((item) => {
                const statusStyle = poStatusConfig[item.status] || poStatusConfig.DRAFT_PO;
                const percentage = totalPOCount > 0 ? (item.count / totalPOCount) * 100 : 0;
                return (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </span>
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${statusStyle.bg.replace('100', '500')}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 ml-3">{item.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Pending PR Approvals</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {pendingPRs.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No pending approvals</div>
            ) : (
              pendingPRs.slice(0, 5).map((pr) => (
                <div key={pr.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{pr.prNumber}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          pr.urgency === 'HIGH' ? 'bg-red-100 text-red-700' :
                          pr.urgency === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {pr.urgency}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {pr.requestedBy.firstName} {pr.requestedBy.lastName} • {pr.department.name} • ${Number(pr.totalEstimated || 0).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApprovePR(pr.id)}
                      className="p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                      title="Approve"
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Purchase Orders */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Purchase Orders</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {recentPOs.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No recent purchase orders</div>
            ) : (
              recentPOs.map((po) => {
                const statusStyle = poStatusConfig[po.status] || poStatusConfig.DRAFT_PO;
                return (
                  <div key={po.id} className="px-6 py-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{po.poNumber}</span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{po.supplier?.companyName || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">${Number(po.totalAmount || 0).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{new Date(po.orderDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {lowStockAlerts.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">All stock levels are healthy</div>
          ) : (
            lowStockAlerts.slice(0, 8).map((item) => (
              <div key={item.id} className="px-6 py-3 hover:bg-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.code} • Reorder Level: {item.reorderLevel} {item.unit}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${item.quantity <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                    {item.quantity} {item.unit}
                  </span>
                  {item.quantity <= 0 && (
                    <p className="text-xs text-red-500 font-medium">OUT OF STOCK</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Procurement Staff Dashboard ====================
function ProcurementStaffDashboard() {
  const [myPRs, setMyPRs] = useState<MyPR[]>([]);
  const [poStatusBreakdown, setPOStatusBreakdown] = useState<POStatusBreakdown[]>([]);
  const [recentGRNs, setRecentGRNs] = useState<RecentGRN[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [myPRsRes, poStatusRes, grnsRes, stockRes] = await Promise.allSettled([
        procurementApi.getMyPRs(10),
        procurementApi.getPOStatusBreakdown(),
        procurementApi.getRecentGRNs(10),
        procurementApi.getLowStockAlerts(),
      ]);

      if (myPRsRes.status === 'fulfilled') {
        setMyPRs(myPRsRes.value.data.data || myPRsRes.value.data || []);
      }
      if (poStatusRes.status === 'fulfilled') {
        setPOStatusBreakdown(poStatusRes.value.data.data || poStatusRes.value.data || []);
      }
      if (grnsRes.status === 'fulfilled') {
        setRecentGRNs(grnsRes.value.data.data || grnsRes.value.data || []);
      }
      if (stockRes.status === 'fulfilled') {
        setLowStockAlerts(stockRes.value.data.data || stockRes.value.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const totalPOCount = poStatusBreakdown.reduce((sum, item) => sum + item.count, 0);
  const pendingPRs = myPRs.filter(pr => pr.status === 'SUBMITTED' || pr.status === 'PENDING_APPROVAL').length;
  const approvedPRs = myPRs.filter(pr => pr.status === 'APPROVED_PR').length;
  const grnsThisMonth = recentGRNs.length;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">My Pending PRs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{pendingPRs}</p>
            </div>
            <div className="p-3 rounded-lg bg-yellow-50">
              <DocumentTextIcon className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Approved PRs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{approvedPRs}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">GRNs This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{grnsThisMonth}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <TruckIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Recent Requisitions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">My Recent Requisitions</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {myPRs.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No requisitions found</div>
            ) : (
              myPRs.map((pr) => {
                const statusStyle = prStatusConfig[pr.status] || prStatusConfig.DRAFT_PR;
                return (
                  <div key={pr.id} className="px-6 py-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{pr.prNumber}</span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {pr.department.name} • {new Date(pr.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">${Number(pr.totalEstimated || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PO Status Overview */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCartIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">PO Status Overview</h3>
          </div>
          {poStatusBreakdown.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No PO data available</div>
          ) : (
            <div className="space-y-3">
              {poStatusBreakdown.map((item) => {
                const statusStyle = poStatusConfig[item.status] || poStatusConfig.DRAFT_PO;
                const percentage = totalPOCount > 0 ? (item.count / totalPOCount) * 100 : 0;
                return (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </span>
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${statusStyle.bg.replace('100', '500')}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 ml-3">{item.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent GRNs */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Goods Receipts</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {recentGRNs.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No recent GRNs</div>
            ) : (
              recentGRNs.map((grn) => (
                <div key={grn.id} className="px-6 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{grn.grnNumber}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {grn.purchaseOrder.supplier.companyName} • PO: {grn.purchaseOrder.poNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        grn.status === 'APPROVED_GRN' ? 'bg-green-100 text-green-700' :
                        grn.status === 'DRAFT_GRN' ? 'bg-gray-100 text-gray-700' :
                        grn.status === 'REJECTED_GRN' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {grn.status.replace(/_/g, ' ')}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">{new Date(grn.receiptDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {lowStockAlerts.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">All stock levels are healthy</div>
            ) : (
              lowStockAlerts.slice(0, 8).map((item) => (
                <div key={item.id} className="px-6 py-3 hover:bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.code} • Reorder: {item.reorderLevel} {item.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${item.quantity <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {item.quantity} {item.unit}
                    </span>
                    {item.quantity <= 0 && (
                      <p className="text-xs text-red-500 font-medium">OUT</p>
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

// ==================== Main Dashboard Component ====================
export default function ProcurementDashboard() {
  const { user } = useAuth();
  const userRole = user?.role;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {userRole === 'PROCUREMENT_MANAGER' ? 'Manager View' : 'Staff View'}
          </p>
        </div>
      </div>

      {/* Render role-specific dashboard */}
      {userRole === 'PROCUREMENT_MANAGER' || userRole === 'HOSPITAL_ADMIN' || userRole === 'SUPER_ADMIN' ? (
        <ProcurementManagerDashboard />
      ) : (
        <ProcurementStaffDashboard />
      )}
    </div>
  );
}
