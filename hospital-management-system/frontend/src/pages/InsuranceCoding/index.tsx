import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  AdjustmentsHorizontalIcon,
  BuildingOffice2Icon,
  LinkIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { GlassCard } from '../../components/ui/GlassCard';
import { insuranceCodingApi } from '../../services/api';
import ICD10Manager from './ICD10Manager';
import CPTManager from './CPTManager';
import ModifiersManager from './ModifiersManager';
import PayerManager from './PayerManager';
import MedicalNecessity from './MedicalNecessity';
import Analytics from './Analytics';
import clsx from 'clsx';

type TabType = 'icd10' | 'cpt' | 'modifiers' | 'payers' | 'necessity' | 'analytics';

interface TabConfig {
  id: TabType;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const tabs: TabConfig[] = [
  {
    id: 'icd10',
    name: 'ICD-10 Codes',
    icon: DocumentTextIcon,
    description: 'Diagnosis codes for billing and clinical documentation',
  },
  {
    id: 'cpt',
    name: 'CPT Codes',
    icon: ClipboardDocumentListIcon,
    description: 'Procedure codes with pricing and pre-authorization',
  },
  {
    id: 'modifiers',
    name: 'Modifiers',
    icon: AdjustmentsHorizontalIcon,
    description: 'Procedure modifiers affecting billing',
  },
  {
    id: 'payers',
    name: 'Payers',
    icon: BuildingOffice2Icon,
    description: 'Insurance payers and coverage rules',
  },
  {
    id: 'necessity',
    name: 'Medical Necessity',
    icon: LinkIcon,
    description: 'ICD-10 to CPT code mappings',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    icon: ChartBarIcon,
    description: 'Coding metrics and insights',
  },
];

export default function InsuranceCodingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('icd10');

  // Fetch stats for dashboard
  const { data: icd10Data } = useQuery({
    queryKey: ['icd10-codes', { limit: 1 }],
    queryFn: () => insuranceCodingApi.getICD10Codes({ limit: 1 }).then(r => r.data),
  });

  const { data: cptData } = useQuery({
    queryKey: ['cpt-codes', { limit: 1 }],
    queryFn: () => insuranceCodingApi.getCPTCodes({ limit: 1 }).then(r => r.data),
  });

  const { data: modifiersData } = useQuery({
    queryKey: ['cpt-modifiers'],
    queryFn: () => insuranceCodingApi.getModifiers().then(r => r.data),
  });

  const { data: payersData } = useQuery({
    queryKey: ['payers', { limit: 1 }],
    queryFn: () => insuranceCodingApi.getPayers({ limit: 1 }).then(r => r.data),
  });

  const { data: mappingsData } = useQuery({
    queryKey: ['icd-cpt-mappings', { limit: 1 }],
    queryFn: () => insuranceCodingApi.getICDCPTMappings({ limit: 1 }).then(r => r.data),
  });

  const stats = [
    {
      name: 'ICD-10 Codes',
      value: icd10Data?.pagination?.total || 0,
      icon: DocumentTextIcon,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      name: 'CPT Codes',
      value: cptData?.pagination?.total || 0,
      icon: ClipboardDocumentListIcon,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      name: 'Modifiers',
      value: modifiersData?.data?.length || 0,
      icon: AdjustmentsHorizontalIcon,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      name: 'Payers',
      value: payersData?.pagination?.total || 0,
      icon: BuildingOffice2Icon,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      name: 'ICD-CPT Mappings',
      value: mappingsData?.pagination?.total || 0,
      icon: LinkIcon,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Insurance Coding
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage ICD-10 diagnoses, CPT procedures, and modifiers for billing
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <GlassCard key={stat.name} className="p-4">
            <div className="flex items-center gap-4">
              <div className={clsx('p-3 rounded-lg', stat.bgColor)}>
                <stat.icon className={clsx('w-6 h-6', stat.color)} />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value.toLocaleString()}
                </p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Tabs */}
      <GlassCard>
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                )}
              >
                <tab.icon
                  className={clsx(
                    'mr-2 h-5 w-5',
                    activeTab === tab.id
                      ? 'text-primary-500'
                      : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
                  )}
                />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'icd10' && <ICD10Manager />}
          {activeTab === 'cpt' && <CPTManager />}
          {activeTab === 'modifiers' && <ModifiersManager />}
          {activeTab === 'payers' && <PayerManager />}
          {activeTab === 'necessity' && <MedicalNecessity />}
          {activeTab === 'analytics' && <Analytics />}
        </div>
      </GlassCard>
    </div>
  );
}
