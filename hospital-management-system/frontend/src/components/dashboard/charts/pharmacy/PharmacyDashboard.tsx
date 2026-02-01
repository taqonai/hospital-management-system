import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { PrescriptionIcon, MedicalShieldIcon, NotificationBellIcon, IVDripIcon } from '../../../icons/HMSIcons';
import { usePharmacyDashboard } from '../../../../hooks/usePharmacyDashboard';
import KPICard from '../shared/KPICard';
import OccupancyGauge from '../shared/OccupancyGauge';

export default function PharmacyDashboard() {
  const {
    pharmacyStats,
    pendingPrescriptions,
    lowStock,
    expiring,
    isLoading,
  } = usePharmacyDashboard();

  const dispensingRate = pharmacyStats?.dispensedToday && pharmacyStats?.pendingPrescriptions
    ? (pharmacyStats.dispensedToday / (pharmacyStats.dispensedToday + pharmacyStats.pendingPrescriptions)) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Pending Rx"
          value={pharmacyStats?.pendingPrescriptions || pendingPrescriptions?.length || 0}
          icon={PrescriptionIcon}
          color="amber"
          subtitle="Awaiting dispensing"
          isLoading={isLoading}
        />
        <KPICard
          title="Dispensed Today"
          value={pharmacyStats?.dispensedToday || 0}
          icon={MedicalShieldIcon}
          color="emerald"
          subtitle="Completed"
          isLoading={isLoading}
        />
        <KPICard
          title="Low Stock"
          value={pharmacyStats?.lowStockCount || lowStock?.length || 0}
          icon={NotificationBellIcon}
          color="red"
          subtitle="Items below threshold"
          isLoading={isLoading}
        />
        <KPICard
          title="Expiring Soon"
          value={pharmacyStats?.expiringCount || expiring?.length || 0}
          icon={IVDripIcon}
          color="orange"
          subtitle="Within 30 days"
          isLoading={isLoading}
        />
      </div>

      {/* Alerts Section */}
      {(lowStock?.length > 0 || expiring?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Alert */}
          {lowStock?.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-500">
                    <NotificationBellIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-900">Low Stock Alert</h3>
                    <p className="text-sm text-red-700">{lowStock.length} items need reordering</p>
                  </div>
                </div>
                <Link to="/pharmacy/inventory?filter=low-stock" className="text-sm text-red-600 font-medium">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {lowStock.slice(0, 3).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-white">
                    <div>
                      <p className="font-medium text-gray-900">{item.drugName || item.drug?.name}</p>
                      <p className="text-sm text-gray-500">
                        Stock: {item.quantity} (Min: {item.minStock})
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                      Reorder
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiring Alert */}
          {expiring?.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500">
                    <IVDripIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-900">Expiring Soon</h3>
                    <p className="text-sm text-amber-700">{expiring.length} items expiring within 30 days</p>
                  </div>
                </div>
                <Link to="/pharmacy/inventory?filter=expiring" className="text-sm text-amber-600 font-medium">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {expiring.slice(0, 3).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-white">
                    <div>
                      <p className="font-medium text-gray-900">{item.drugName || item.drug?.name}</p>
                      <p className="text-sm text-gray-500">
                        Batch: {item.batchNumber} • Qty: {item.quantity}
                      </p>
                    </div>
                    <span className="text-sm text-amber-700 font-medium">{item.expiryDate}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dispensing Progress */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Progress</h3>
          <div className="flex justify-center">
            <OccupancyGauge
              percentage={dispensingRate}
              label="Dispensing Rate"
              sublabel={`${pharmacyStats?.dispensedToday || 0} completed`}
              size="lg"
              color="green"
            />
          </div>
        </div>

        {/* Pending Prescriptions */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pending Prescriptions</h3>
            <Link
              to="/pharmacy/prescriptions"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Patient</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Medications</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Doctor</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingPrescriptions?.slice(0, 5).map((rx: any) => (
                  <tr key={rx.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{rx.patientName}</p>
                      <p className="text-xs text-gray-500">{rx.mrn}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {rx.medicationCount || rx.medications?.length || 0} items
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      Dr. {rx.doctorName}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/pharmacy/dispense/${rx.id}`}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        Dispense
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!pendingPrescriptions || pendingPrescriptions.length === 0) && (
              <div className="text-center py-8">
                <MedicalShieldIcon className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-500">No pending prescriptions</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/pharmacy/prescriptions"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-blue-500 group-hover:scale-110 transition-transform">
            <PrescriptionIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Dispense Rx</p>
            <p className="text-xs text-gray-500">Process prescription</p>
          </div>
        </Link>
        <Link
          to="/drug-interactions"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-purple-500 group-hover:scale-110 transition-transform">
            <BeakerIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Check Interactions</p>
            <p className="text-xs text-gray-500">Drug safety</p>
          </div>
        </Link>
        <Link
          to="/pharmacy/inventory"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-amber-500 group-hover:scale-110 transition-transform">
            <NotificationBellIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Inventory</p>
            <p className="text-xs text-gray-500">Stock levels</p>
          </div>
        </Link>
        <Link
          to="/pharmacy/orders"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <div className="p-3 rounded-xl bg-emerald-500 group-hover:scale-110 transition-transform">
            <MedicalShieldIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Place Order</p>
            <p className="text-xs text-gray-500">Restock items</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
