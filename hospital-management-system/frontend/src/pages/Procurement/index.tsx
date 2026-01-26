import { useState } from 'react';
import {
  ChartBarSquareIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  TruckIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

import ProcurementDashboard from './Dashboard';
import Suppliers from './Suppliers';
import Requisitions from './Requisitions';
import PurchaseOrders from './PurchaseOrders';
import GoodsReceipt from './GoodsReceipt';
import Invoices from './Invoices';

type TabId = 'dashboard' | 'suppliers' | 'requisitions' | 'purchase-orders' | 'receiving' | 'invoices';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBarSquareIcon },
  { id: 'suppliers', label: 'Suppliers', icon: UserGroupIcon },
  { id: 'requisitions', label: 'Requisitions', icon: ClipboardDocumentListIcon },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCartIcon },
  { id: 'receiving', label: 'Receiving', icon: TruckIcon },
  { id: 'invoices', label: 'Invoices', icon: DocumentTextIcon },
];

export default function Procurement() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <ProcurementDashboard />;
      case 'suppliers':
        return <Suppliers />;
      case 'requisitions':
        return <Requisitions />;
      case 'purchase-orders':
        return <PurchaseOrders />;
      case 'receiving':
        return <GoodsReceipt />;
      case 'invoices':
        return <Invoices />;
      default:
        return <ProcurementDashboard />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-3">
            <ShoppingCartIcon className="h-4 w-4" />
            Supply Chain Management
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Procurement</h1>
          <p className="text-blue-100">Manage suppliers, purchase orders, receiving, and invoices</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative">
        <div className="flex space-x-1 p-1 rounded-xl bg-gray-100 border border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              {activeTab === tab.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/25" />
              )}
              <span className="relative flex items-center gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}
