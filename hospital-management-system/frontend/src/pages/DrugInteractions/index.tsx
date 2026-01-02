import { useState } from 'react';
import {
  BeakerIcon,
  SparklesIcon,
  ClipboardDocumentListIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import DrugInteractionChecker from '../../components/ai/DrugInteractionChecker';

const statsCards = [
  {
    name: 'Checks Today',
    value: '234',
    change: '+18%',
    icon: BeakerIcon,
    color: 'emerald',
  },
  {
    name: 'Interactions Found',
    value: '89',
    change: '38%',
    icon: ExclamationTriangleIcon,
    color: 'orange',
  },
  {
    name: 'Critical Alerts',
    value: '12',
    change: '5%',
    icon: ShieldExclamationIcon,
    color: 'red',
  },
  {
    name: 'Safe Combinations',
    value: '145',
    change: '62%',
    icon: CheckCircleIcon,
    color: 'green',
  },
];

const commonInteractions = [
  {
    drugs: ['Warfarin', 'Aspirin'],
    severity: 'SEVERE',
    effect: 'Increased bleeding risk',
    frequency: '23%',
  },
  {
    drugs: ['Simvastatin', 'Clarithromycin'],
    severity: 'CONTRAINDICATED',
    effect: 'Rhabdomyolysis risk',
    frequency: '8%',
  },
  {
    drugs: ['Lisinopril', 'Potassium'],
    severity: 'SEVERE',
    effect: 'Hyperkalemia risk',
    frequency: '15%',
  },
  {
    drugs: ['Metformin', 'Contrast dye'],
    severity: 'SEVERE',
    effect: 'Lactic acidosis risk',
    frequency: '12%',
  },
  {
    drugs: ['Clopidogrel', 'Omeprazole'],
    severity: 'MODERATE',
    effect: 'Reduced antiplatelet effect',
    frequency: '18%',
  },
];

const drugCategories = [
  { name: 'Anticoagulants', count: 12, color: 'red' },
  { name: 'Cardiovascular', count: 45, color: 'blue' },
  { name: 'Antibiotics', count: 28, color: 'green' },
  { name: 'NSAIDs', count: 8, color: 'orange' },
  { name: 'Antidepressants', count: 15, color: 'purple' },
  { name: 'Antidiabetics', count: 10, color: 'cyan' },
];

export default function DrugInteractions() {
  const [activeTab, setActiveTab] = useState<'checker' | 'database' | 'alerts'>('checker');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CONTRAINDICATED':
        return 'bg-red-100 text-red-700';
      case 'SEVERE':
        return 'bg-red-50 text-red-600';
      case 'MODERATE':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
              <BeakerIcon className="h-6 w-6" />
            </div>
            Drug Interaction Checker
          </h1>
          <p className="mt-1 text-gray-500">
            AI-powered medication safety analysis with comprehensive interaction database
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
            <BookOpenIcon className="h-4 w-4" />
            Drug Reference
          </button>
          <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 transition-colors shadow-lg shadow-emerald-500/30 flex items-center gap-2">
            <ClipboardDocumentListIcon className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <div
            key={stat.name}
            className="p-4 rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stat.value}
                </p>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  stat.color === 'emerald'
                    ? 'bg-emerald-100 text-emerald-600'
                    : stat.color === 'orange'
                    ? 'bg-orange-100 text-orange-600'
                    : stat.color === 'red'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-600'
                }`}
              >
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-2">
              <span
                className={`text-sm font-medium ${
                  stat.color === 'red'
                    ? 'text-red-600'
                    : 'text-emerald-600'
                }`}
              >
                {stat.change}
              </span>
              <span className="text-sm text-gray-400 ml-1">
                {stat.color === 'red' ? 'of all checks' : 'vs yesterday'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'checker', name: 'Interaction Checker', icon: SparklesIcon },
            { id: 'database', name: 'Drug Database', icon: BookOpenIcon },
            { id: 'alerts', name: 'Recent Alerts', icon: ExclamationTriangleIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'checker' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Checker - Takes 2 columns */}
          <div className="xl:col-span-2">
            <DrugInteractionChecker />
          </div>

          {/* Common Interactions Sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
                  Common Interactions
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Frequently encountered in our system
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {commonInteractions.map((interaction, index) => (
                  <div key={index} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {interaction.drugs.join(' + ')}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {interaction.effect}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(
                          interaction.severity
                        )}`}
                      >
                        {interaction.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Seen in {interaction.frequency} of polypharmacy cases
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'database' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Search Drug Database
              </h3>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by drug name, brand, or class..."
                  className="w-full pl-12 pr-4 py-3 text-sm rounded-xl bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Drug Categories
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {drugCategories.map((category) => (
                    <button
                      key={category.name}
                      className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                        category.color === 'red'
                          ? 'border-red-200 bg-red-50 hover:bg-red-100'
                          : category.color === 'blue'
                          ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                          : category.color === 'green'
                          ? 'border-green-200 bg-green-50 hover:bg-green-100'
                          : category.color === 'orange'
                          ? 'border-orange-200 bg-orange-50 hover:bg-orange-100'
                          : category.color === 'purple'
                          ? 'border-purple-200 bg-purple-50 hover:bg-purple-100'
                          : 'border-cyan-200 bg-cyan-50 hover:bg-cyan-100'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{category.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {category.count} drugs
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Reference */}
          <div className="rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Reference
            </h3>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-red-50 border-l-4 border-red-500">
                <p className="font-medium text-red-700">Contraindicated</p>
                <p className="text-sm text-gray-600">
                  Never use together - potentially life-threatening
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-50/50 border-l-4 border-red-400">
                <p className="font-medium text-red-600">Severe</p>
                <p className="text-sm text-gray-600">
                  Serious interaction - consider alternatives
                </p>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 border-l-4 border-orange-400">
                <p className="font-medium text-orange-600">Moderate</p>
                <p className="text-sm text-gray-600">
                  Monitor closely - may need dose adjustment
                </p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-50 border-l-4 border-yellow-400">
                <p className="font-medium text-yellow-600">Minor</p>
                <p className="text-sm text-gray-600">
                  Minimal clinical significance
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Drugs
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  {
                    time: '2 min ago',
                    patient: 'John D.',
                    drugs: 'Warfarin + Aspirin',
                    severity: 'SEVERE',
                    status: 'Pending',
                  },
                  {
                    time: '15 min ago',
                    patient: 'Sarah M.',
                    drugs: 'Oxycodone + Alprazolam',
                    severity: 'CONTRAINDICATED',
                    status: 'Reviewed',
                  },
                  {
                    time: '1 hour ago',
                    patient: 'Robert K.',
                    drugs: 'Simvastatin + Clarithromycin',
                    severity: 'CONTRAINDICATED',
                    status: 'Resolved',
                  },
                  {
                    time: '2 hours ago',
                    patient: 'Emily T.',
                    drugs: 'Lisinopril + Potassium',
                    severity: 'SEVERE',
                    status: 'Reviewed',
                  },
                  {
                    time: '3 hours ago',
                    patient: 'Michael B.',
                    drugs: 'Metformin + Contrast',
                    severity: 'SEVERE',
                    status: 'Resolved',
                  },
                ].map((alert, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {alert.time}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{alert.patient}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {alert.drugs}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(
                          alert.severity
                        )}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          alert.status === 'Pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : alert.status === 'Reviewed'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Capabilities */}
      <div className="rounded-2xl backdrop-blur-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-emerald-500" />
          AI Drug Safety Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/50">
            <h4 className="font-medium text-emerald-700 mb-2">
              Drug-Drug Interactions
            </h4>
            <p className="text-sm text-gray-600">
              Comprehensive database with severity classification and clinical evidence
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/50">
            <h4 className="font-medium text-emerald-700 mb-2">
              Food Interactions
            </h4>
            <p className="text-sm text-gray-600">
              Identifies food-drug interactions with timing recommendations
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/50">
            <h4 className="font-medium text-emerald-700 mb-2">
              Allergy Cross-Reactivity
            </h4>
            <p className="text-sm text-gray-600">
              Detects potential allergic reactions and cross-sensitivities
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/50">
            <h4 className="font-medium text-emerald-700 mb-2">
              Clinical Recommendations
            </h4>
            <p className="text-sm text-gray-600">
              Evidence-based management suggestions for each interaction
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
