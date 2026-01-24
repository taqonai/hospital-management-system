import { useState, useEffect } from 'react';
import {
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  BeakerIcon,
  ArrowPathIcon,
  PlusIcon,
  XMarkIcon,
  CalculatorIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  BeakerIcon as FlaskIcon,
  ClipboardDocumentCheckIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { useAIHealth } from '../../hooks/useAI';
import { pharmacyApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Advanced Pharmacy AI Components
import TDMMonitoring from '../../components/pharmacy/TDMMonitoring';
import CostAlternatives from '../../components/pharmacy/CostAlternatives';
import PolypharmacyRisk from '../../components/pharmacy/PolypharmacyRisk';
import IVCompatibility from '../../components/pharmacy/IVCompatibility';

// Drug Management Modals
import AddDrugModal from './AddDrugModal';
import DrugCSVImportModal from './DrugCSVImportModal';
import DrugManagement from './DrugManagement';

interface Prescription {
  id: string;
  prescriptionNumber: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  prescribedBy: {
    firstName: string;
    lastName: string;
  };
  medications: Array<{
    id: string;
    drugName: string;
    dosage: string;
    quantity: number;
    status: string;
  }>;
  status: string;
  createdAt: string;
}

interface LowStockItem {
  id: string;
  drug: {
    name: string;
  };
  quantity: number;
  reorderLevel: number;
}

interface PharmacyStats {
  pendingPrescriptions: number;
  dispensedToday: number;
  lowStockItems: number;
  expiringSoon: number;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  description: string;
  recommendation: string;
}

interface InteractionResult {
  interactions: DrugInteraction[];
  summary: { critical: number; high: number; moderate: number; low: number; total: number };
  overallRisk: string;
}

interface DosageResult {
  recommendedDose: string;
  frequency: string;
  maxDailyDose: string;
  adjustments: string[];
  warnings: string[];
  calculations: string[];
}

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  DISPENSING: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20', dot: 'bg-blue-500 animate-pulse' },
  DISPENSED: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  INTERACTION_ALERT: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/20', dot: 'bg-red-500 animate-pulse' },
};

export default function Pharmacy() {
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'inventory' | 'interactions' | 'dosage' | 'tdm' | 'alternatives' | 'polypharmacy' | 'iv-compatibility'>('prescriptions');
  const [search, setSearch] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [stats, setStats] = useState<PharmacyStats>({
    pendingPrescriptions: 0,
    dispensedToday: 0,
    lowStockItems: 0,
    expiringSoon: 0,
  });
  const [loading, setLoading] = useState(true);

  const [drugList, setDrugList] = useState<{ name: string; genericName: string }[]>([
    { name: '', genericName: '' },
    { name: '', genericName: '' },
  ]);
  const [interactionResult, setInteractionResult] = useState<InteractionResult | null>(null);
  const [checkingInteractions, setCheckingInteractions] = useState(false);

  const [dosageForm, setDosageForm] = useState({
    drugName: '',
    indication: '',
    patientWeight: '',
    patientAge: '',
    renalFunction: 'normal' as 'normal' | 'mild' | 'moderate' | 'severe' | 'dialysis',
    hepaticFunction: 'normal' as 'normal' | 'mild' | 'moderate' | 'severe',
    isPregnant: false,
    isBreastfeeding: false,
  });
  const [dosageResult, setDosageResult] = useState<DosageResult | null>(null);
  const [calculatingDosage, setCalculatingDosage] = useState(false);

  // Modal states
  const [showAddDrugModal, setShowAddDrugModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const { data: healthStatus } = useAIHealth();
  const isAIOnline = healthStatus?.status === 'connected';

  useEffect(() => {
    const fetchPrescriptions = async () => {
      try {
        setLoading(true);
        const response = await pharmacyApi.getPendingPrescriptions();
        setPrescriptions(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch prescriptions:', error);
        toast.error('Failed to load prescriptions');
      } finally {
        setLoading(false);
      }
    };
    fetchPrescriptions();
  }, []);

  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const response = await pharmacyApi.getLowStock();
        setLowStock(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch low stock:', error);
      }
    };
    fetchLowStock();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await pharmacyApi.getStats();
        setStats(response.data.data || { pendingPrescriptions: 0, dispensedToday: 0, lowStockItems: 0, expiringSoon: 0 });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();
  }, []);

  const refreshData = async () => {
    try {
      const [lowStockRes, statsRes] = await Promise.all([
        pharmacyApi.getLowStock(),
        pharmacyApi.getStats(),
      ]);
      setLowStock(lowStockRes.data.data || []);
      setStats(statsRes.data.data || { pendingPrescriptions: 0, dispensedToday: 0, lowStockItems: 0, expiringSoon: 0 });
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  const handleAddDrug = () => setDrugList([...drugList, { name: '', genericName: '' }]);
  const handleRemoveDrug = (index: number) => { if (drugList.length > 2) setDrugList(drugList.filter((_, i) => i !== index)); };
  const handleDrugChange = (index: number, field: 'name' | 'genericName', value: string) => {
    const updated = [...drugList];
    updated[index][field] = value;
    setDrugList(updated);
  };

  const handleCheckInteractions = async () => {
    const validDrugs = drugList.filter(d => d.name.trim() || d.genericName.trim());
    if (validDrugs.length < 2) { toast.error('Please enter at least 2 medications'); return; }
    setCheckingInteractions(true);
    try {
      const response = await pharmacyApi.analyzeInteractions(validDrugs.map(d => ({ name: d.name.trim() || d.genericName.trim(), genericName: d.genericName.trim() || d.name.trim() })));
      setInteractionResult(response.data.data);
    } catch (error) { toast.error('Failed to check interactions'); } finally { setCheckingInteractions(false); }
  };

  const handleCalculateDosage = async () => {
    if (!dosageForm.drugName) { toast.error('Please enter a drug name'); return; }
    setCalculatingDosage(true);
    try {
      const response = await pharmacyApi.calculateDosage({
        drugName: dosageForm.drugName, indication: dosageForm.indication || 'general',
        patientWeight: dosageForm.patientWeight ? Number(dosageForm.patientWeight) : undefined,
        patientAge: dosageForm.patientAge ? Number(dosageForm.patientAge) : undefined,
        renalFunction: dosageForm.renalFunction, hepaticFunction: dosageForm.hepaticFunction,
        isPregnant: dosageForm.isPregnant, isBreastfeeding: dosageForm.isBreastfeeding,
      });
      setDosageResult(response.data.data);
    } catch (error) { toast.error('Failed to calculate dosage'); } finally { setCalculatingDosage(false); }
  };

  const handleDispense = async (prescriptionId: string) => {
    try {
      await pharmacyApi.dispensePrescription(prescriptionId);
      toast.success('Prescription dispensed successfully');
      const response = await pharmacyApi.getPendingPrescriptions();
      setPrescriptions(response.data.data || []);
    } catch (error) { toast.error('Failed to dispense prescription'); }
  };

  const filteredPrescriptions = prescriptions.filter(rx => {
    const patientName = `${rx.patient?.firstName || ''} ${rx.patient?.lastName || ''}`.toLowerCase();
    return patientName.includes(search.toLowerCase()) || rx.prescriptionNumber?.toLowerCase().includes(search.toLowerCase());
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'HIGH': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'MODERATE': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'LOW': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const tabs = [
    { id: 'prescriptions', label: 'Prescriptions', count: prescriptions.length },
    { id: 'inventory', label: 'Inventory', count: stats.lowStockItems },
    { id: 'interactions', label: 'Interactions', icon: SparklesIcon },
    { id: 'dosage', label: 'Dosage', icon: BeakerIcon },
    { id: 'tdm', label: 'TDM', icon: ChartBarIcon },
    { id: 'alternatives', label: 'Alternatives', icon: CurrencyDollarIcon },
    { id: 'polypharmacy', label: 'Polypharmacy', icon: ClipboardDocumentCheckIcon },
    { id: 'iv-compatibility', label: 'IV Compat', icon: FlaskIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-3">
              <BuildingStorefrontIcon className="h-4 w-4" />
              Pharmacy Management
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Pharmacy</h1>
            <p className="text-green-100">Manage prescriptions, dispensing, and drug inventory</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowImportModal(true)} className="group relative px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-xl text-white font-medium transition-all duration-300 flex items-center gap-2 border border-white/20 hover:border-white/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/25">
              <ArrowUpTrayIcon className="h-5 w-5" />
              Import CSV
            </button>
            <button onClick={() => setShowAddDrugModal(true)} className="group relative px-4 py-2.5 bg-white hover:bg-green-50 backdrop-blur-xl rounded-xl text-green-700 font-medium transition-all duration-300 flex items-center gap-2 border border-white/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/25">
              <PlusIcon className="h-5 w-5" />
              Add Medicine
            </button>
            {isAIOnline && (
              <>
                <button onClick={() => setActiveTab('interactions')} className="group relative px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-xl text-white font-medium transition-all duration-300 flex items-center gap-2 border border-white/20 hover:border-white/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/25">
                  <ShieldExclamationIcon className="h-5 w-5" />
                  Interactions
                </button>
                <button onClick={() => setActiveTab('dosage')} className="group relative px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-xl text-white font-medium transition-all duration-300 flex items-center gap-2 border border-white/20 hover:border-white/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/25">
                  <CalculatorIcon className="h-5 w-5" />
                  Dosage Calculator
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-orange-500/10 border border-orange-500/30 p-4 animate-fade-in-up">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-amber-500/5" />
          <div className="relative flex items-start gap-3">
            <div className="p-2 rounded-xl bg-orange-500/20"><ExclamationTriangleIcon className="h-6 w-6 text-orange-600 animate-pulse" /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-700">{lowStock.length} Medications Low in Stock</h3>
              <p className="text-sm text-orange-600 mt-1">{lowStock.slice(0, 5).map(d => d.drug?.name).join(', ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: stats.pendingPrescriptions, color: 'amber', icon: '' },
          { label: 'Dispensed Today', value: stats.dispensedToday, color: 'emerald', icon: '' },
          { label: 'Low Stock', value: stats.lowStockItems, color: 'orange', icon: '' },
          { label: 'Expiring Soon', value: stats.expiringSoon, color: 'red', icon: '' },
        ].map((stat, index) => (
          <div key={stat.label} className="group relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className={clsx('absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300', stat.color === 'amber' && 'bg-gradient-to-r from-amber-500 to-yellow-500', stat.color === 'emerald' && 'bg-gradient-to-r from-emerald-500 to-green-500', stat.color === 'orange' && 'bg-gradient-to-r from-orange-500 to-amber-500', stat.color === 'red' && 'bg-gradient-to-r from-red-500 to-rose-500')} />
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-gray-500">{stat.label}</p><p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p></div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="relative">
        <div className="flex space-x-1 p-1 rounded-xl bg-gray-100 backdrop-blur-xl border border-gray-200">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} className={clsx('relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300', activeTab === tab.id ? 'text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50')}>
              {activeTab === tab.id && <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-lg shadow-green-500/25" />}
              <span className="relative flex items-center gap-2">{tab.icon && <tab.icon className="h-4 w-4" />}{tab.label}{tab.count !== undefined && <span className={clsx('px-2 py-0.5 rounded-full text-xs', activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600')}>{tab.count}</span>}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      {(activeTab === 'prescriptions' || activeTab === 'inventory') && (
        <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg animate-fade-in-up">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Search prescriptions, drugs, or patients..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500/50 transition-all text-gray-900 placeholder-gray-400" />
          </div>
        </div>
      )}

      {/* Prescriptions Tab */}
      {activeTab === 'prescriptions' && (
        <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-xl animate-fade-in-up">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          {loading ? (
            <div className="p-12 text-center"><div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/10 mb-4"><ArrowPathIcon className="h-6 w-6 text-green-600 animate-spin" /></div><p className="text-gray-500">Loading prescriptions...</p></div>
          ) : filteredPrescriptions.length === 0 ? (
            <div className="p-12 text-center"><div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4"><BuildingStorefrontIcon className="h-8 w-8 text-gray-400" /></div><p className="text-gray-500">No pending prescriptions found</p></div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPrescriptions.map((rx, index) => {
                const config = statusConfig[rx.status] || statusConfig.PENDING;
                return (
                  <div key={rx.id} className={clsx('p-4 hover:bg-gray-50 transition-all duration-300 animate-fade-in-up', rx.status === 'INTERACTION_ALERT' && 'bg-red-50')} style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">{rx.prescriptionNumber}</span>
                          <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', config.bg, config.text, config.border)}><span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />{rx.status?.replace('_', ' ')}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900">{rx.patient?.firstName} {rx.patient?.lastName}</h3>
                        <div className="mt-3 flex flex-wrap gap-2">{rx.medications?.map((med) => (<span key={med.id} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg border border-gray-200">{med.drugName} - {med.dosage} (x{med.quantity})</span>))}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gray-600">Dr. {rx.prescribedBy?.firstName} {rx.prescribedBy?.lastName}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(rx.createdAt).toLocaleString()}</p>
                        {rx.status === 'PENDING' && (<button onClick={() => handleDispense(rx.id)} className="mt-3 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 transition-all duration-300 hover:-translate-y-0.5">Dispense</button>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="animate-fade-in-up">
          <DrugManagement
            onAddDrug={() => setShowAddDrugModal(true)}
            onImportCSV={() => setShowImportModal(true)}
          />
        </div>
      )}

      {/* Drug Interaction Checker Tab */}
      {activeTab === 'interactions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-purple-500/10"><ShieldExclamationIcon className="h-6 w-6 text-purple-600" /></div><h3 className="font-semibold text-lg text-gray-900">Drug Interaction Checker</h3></div>
            <p className="text-sm text-gray-500 mb-4">Enter medications to check for potential drug-drug interactions.</p>
            <div className="space-y-3">{drugList.map((drug, index) => (<div key={index} className="flex gap-2 animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}><input type="text" placeholder={`Drug ${index + 1} name`} value={drug.name} onChange={(e) => handleDrugChange(index, 'name', e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all text-gray-900 placeholder-gray-400" /><input type="text" placeholder="Generic (optional)" value={drug.genericName} onChange={(e) => handleDrugChange(index, 'genericName', e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all text-gray-900 placeholder-gray-400" />{drugList.length > 2 && (<button onClick={() => handleRemoveDrug(index)} className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"><XMarkIcon className="h-5 w-5" /></button>)}</div>))}</div>
            <div className="mt-4 flex gap-2"><button onClick={handleAddDrug} className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 font-medium transition-all duration-300 flex items-center gap-2"><PlusIcon className="h-4 w-4" />Add Drug</button><button onClick={handleCheckInteractions} disabled={checkingInteractions} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50">{checkingInteractions ? (<><ArrowPathIcon className="h-5 w-5 animate-spin" />Checking...</>) : (<><SparklesIcon className="h-5 w-5" />Check Interactions</>)}</button></div>
          </div>

          <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <h3 className="font-semibold text-lg text-gray-900 mb-4">Interaction Results</h3>
            {!interactionResult ? (
              <div className="text-center py-12"><div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4"><ShieldExclamationIcon className="h-8 w-8 text-gray-400" /></div><p className="text-gray-500">Enter medications and click "Check Interactions"</p></div>
            ) : (
              <div className="space-y-4">
                <div className={clsx('p-4 rounded-xl border-2', interactionResult.overallRisk.includes('CRITICAL') ? 'bg-red-500/10 border-red-500/30' : interactionResult.overallRisk.includes('HIGH') ? 'bg-orange-500/10 border-orange-500/30' : interactionResult.overallRisk.includes('MODERATE') ? 'bg-yellow-500/10 border-yellow-500/30' : interactionResult.overallRisk.includes('NO INTERACTIONS') ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-blue-500/10 border-blue-500/30')}><div className="flex items-center gap-2">{interactionResult.overallRisk.includes('NO INTERACTIONS') ? (<CheckCircleIcon className="h-6 w-6 text-emerald-600" />) : (<ExclamationTriangleIcon className="h-6 w-6" />)}<span className="font-semibold text-gray-900">{interactionResult.overallRisk}</span></div></div>
                {interactionResult.summary.total > 0 && (<div className="grid grid-cols-4 gap-2"><div className="bg-red-500/10 p-3 rounded-xl text-center"><span className="text-2xl font-bold text-red-600">{interactionResult.summary.critical}</span><p className="text-xs text-red-600 mt-1">Critical</p></div><div className="bg-orange-500/10 p-3 rounded-xl text-center"><span className="text-2xl font-bold text-orange-600">{interactionResult.summary.high}</span><p className="text-xs text-orange-600 mt-1">High</p></div><div className="bg-yellow-500/10 p-3 rounded-xl text-center"><span className="text-2xl font-bold text-yellow-600">{interactionResult.summary.moderate}</span><p className="text-xs text-yellow-600 mt-1">Moderate</p></div><div className="bg-blue-500/10 p-3 rounded-xl text-center"><span className="text-2xl font-bold text-blue-600">{interactionResult.summary.low}</span><p className="text-xs text-blue-600 mt-1">Low</p></div></div>)}
                {interactionResult.interactions.length > 0 && (<div className="space-y-3 max-h-72 overflow-y-auto pr-2">{interactionResult.interactions.map((int, idx) => (<div key={idx} className={clsx('p-4 rounded-xl border', getSeverityColor(int.severity))}><div className="flex items-center justify-between mb-2"><span className="font-medium text-gray-900">{int.drug1} + {int.drug2}</span><span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', int.severity === 'CRITICAL' && 'bg-red-500 text-white', int.severity === 'HIGH' && 'bg-orange-500 text-white', int.severity === 'MODERATE' && 'bg-yellow-500 text-white', int.severity === 'LOW' && 'bg-blue-500 text-white')}>{int.severity}</span></div><p className="text-sm text-gray-700">{int.description}</p><p className="text-sm mt-2 italic text-gray-500">{int.recommendation}</p></div>))}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dosage Calculator Tab */}
      {activeTab === 'dosage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-purple-500/10"><CalculatorIcon className="h-6 w-6 text-purple-600" /></div><h3 className="font-semibold text-lg text-gray-900">Dosage Calculator</h3></div>
            <p className="text-sm text-gray-500 mb-4">Calculate patient-specific dosing with renal/hepatic adjustments.</p>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Drug Name *</label><input type="text" placeholder="e.g., Amoxicillin, Metformin" value={dosageForm.drugName} onChange={(e) => setDosageForm({ ...dosageForm, drugName: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all text-gray-900 placeholder-gray-400" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Indication</label><input type="text" placeholder="e.g., Infection, Diabetes" value={dosageForm.indication} onChange={(e) => setDosageForm({ ...dosageForm, indication: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all text-gray-900 placeholder-gray-400" /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label><input type="number" placeholder="e.g., 70" value={dosageForm.patientWeight} onChange={(e) => setDosageForm({ ...dosageForm, patientWeight: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all text-gray-900 placeholder-gray-400" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Age (years)</label><input type="number" placeholder="e.g., 45" value={dosageForm.patientAge} onChange={(e) => setDosageForm({ ...dosageForm, patientAge: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all text-gray-900 placeholder-gray-400" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-gray-700 mb-1">Renal Function</label><select value={dosageForm.renalFunction} onChange={(e) => setDosageForm({ ...dosageForm, renalFunction: e.target.value as typeof dosageForm.renalFunction })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all text-gray-900"><option value="normal">Normal</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="dialysis">Dialysis</option></select></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Hepatic Function</label><select value={dosageForm.hepaticFunction} onChange={(e) => setDosageForm({ ...dosageForm, hepaticFunction: e.target.value as typeof dosageForm.hepaticFunction })} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all text-gray-900"><option value="normal">Normal</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></div></div>
              <div className="flex gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={dosageForm.isPregnant} onChange={(e) => setDosageForm({ ...dosageForm, isPregnant: e.target.checked })} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" /><span className="text-sm text-gray-700">Pregnant</span></label><label className="flex items-center gap-2"><input type="checkbox" checked={dosageForm.isBreastfeeding} onChange={(e) => setDosageForm({ ...dosageForm, isBreastfeeding: e.target.checked })} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" /><span className="text-sm text-gray-700">Breastfeeding</span></label></div>
              <button onClick={handleCalculateDosage} disabled={calculatingDosage} className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50">{calculatingDosage ? (<><ArrowPathIcon className="h-5 w-5 animate-spin" />Calculating...</>) : (<><BeakerIcon className="h-5 w-5" />Calculate Dosage</>)}</button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 p-6 shadow-xl animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <h3 className="font-semibold text-lg text-gray-900 mb-4">Dosage Recommendation</h3>
            {!dosageResult ? (
              <div className="text-center py-12"><div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-4"><BeakerIcon className="h-8 w-8 text-gray-400" /></div><p className="text-gray-500">Enter drug and patient info to calculate dosage</p></div>
            ) : (
              <div className="space-y-4">
                <div className="bg-purple-500/10 p-4 rounded-xl border border-purple-500/20"><h4 className="font-semibold text-purple-700 mb-3">Recommended Dosing</h4><div className="grid grid-cols-3 gap-4"><div><p className="text-xs text-purple-600">Dose</p><p className="text-lg font-bold text-purple-900">{dosageResult.recommendedDose}</p></div><div><p className="text-xs text-purple-600">Frequency</p><p className="text-lg font-bold text-purple-900">{dosageResult.frequency}</p></div><div><p className="text-xs text-purple-600">Max Daily</p><p className="text-lg font-bold text-purple-900">{dosageResult.maxDailyDose}</p></div></div></div>
                {dosageResult.calculations.length > 0 && (<div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20"><h4 className="font-semibold text-blue-700 mb-2">Calculation Details</h4><ul className="text-sm text-blue-700 space-y-1">{dosageResult.calculations.map((calc, idx) => (<li key={idx}>{calc}</li>))}</ul></div>)}
                {dosageResult.adjustments.length > 0 && (<div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20"><h4 className="font-semibold text-yellow-700 mb-2">Dose Adjustments</h4><ul className="text-sm text-yellow-700 space-y-1">{dosageResult.adjustments.map((adj, idx) => (<li key={idx} className="flex items-start gap-2"><span className="text-yellow-500">*</span>{adj}</li>))}</ul></div>)}
                {dosageResult.warnings.length > 0 && (<div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20"><h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2"><ExclamationTriangleIcon className="h-5 w-5" />Warnings</h4><ul className="text-sm text-red-700 space-y-1">{dosageResult.warnings.map((warn, idx) => (<li key={idx} className="flex items-start gap-2"><span className="text-red-500">!</span>{warn}</li>))}</ul></div>)}
                <p className="text-xs text-gray-500 italic">* Always verify dosing with official drug references. This calculator is for guidance only.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TDM Monitoring Tab */}
      {activeTab === 'tdm' && (
        <div className="animate-fade-in-up">
          <TDMMonitoring />
        </div>
      )}

      {/* Cost Alternatives Tab */}
      {activeTab === 'alternatives' && (
        <div className="animate-fade-in-up">
          <CostAlternatives />
        </div>
      )}

      {/* Polypharmacy Risk Tab */}
      {activeTab === 'polypharmacy' && (
        <div className="animate-fade-in-up">
          <PolypharmacyRisk />
        </div>
      )}

      {/* IV Compatibility Tab */}
      {activeTab === 'iv-compatibility' && (
        <div className="animate-fade-in-up">
          <IVCompatibility />
        </div>
      )}

      {/* Add Drug Modal */}
      <AddDrugModal
        isOpen={showAddDrugModal}
        onClose={() => setShowAddDrugModal(false)}
        onSuccess={refreshData}
      />

      {/* CSV Import Modal */}
      <DrugCSVImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={refreshData}
      />
    </div>
  );
}
