import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tab } from '@headlessui/react';
import {
  HeartIcon,
  ClockIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';

// Types
interface TimelineItem {
  id: string;
  type: 'appointment' | 'lab' | 'prescription' | 'vital';
  date: string;
  title: string;
  subtitle: string;
  status?: string;
  details?: any;
}

// Helpers
const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const typeColors: Record<string, { border: string; bg: string; text: string; label: string }> = {
  appointment: { border: 'border-l-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', label: 'Appointment' },
  lab: { border: 'border-l-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', label: 'Lab Result' },
  prescription: { border: 'border-l-green-500', bg: 'bg-green-50', text: 'text-green-700', label: 'Prescription' },
  vital: { border: 'border-l-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', label: 'Vitals' },
};

const vitalCellColor = (value: number | null, type: string): string => {
  if (value === null || value === undefined) return '';
  switch (type) {
    case 'hr':
      if (value >= 60 && value <= 100) return 'text-green-700 bg-green-50';
      if (value > 100 || value < 60) return 'text-amber-700 bg-amber-50';
      return 'text-red-700 bg-red-50';
    case 'spo2':
      if (value >= 95) return 'text-green-700 bg-green-50';
      if (value >= 90) return 'text-amber-700 bg-amber-50';
      return 'text-red-700 bg-red-50';
    case 'temp':
      if (value >= 36.1 && value <= 37.5) return 'text-green-700 bg-green-50';
      if (value > 38) return 'text-red-700 bg-red-50';
      return 'text-amber-700 bg-amber-50';
    case 'bmi':
      if (value >= 18.5 && value < 25) return 'text-green-700 bg-green-50';
      if (value >= 25 && value < 30) return 'text-amber-700 bg-amber-50';
      return 'text-red-700 bg-red-50';
    case 'bs':
      if (value >= 70 && value <= 100) return 'text-green-700 bg-green-50';
      if (value <= 125) return 'text-amber-700 bg-amber-50';
      return 'text-red-700 bg-red-50';
    default:
      return '';
  }
};

const tabNames = ['All', 'Appointments', 'Labs', 'Prescriptions', 'Vitals'];

export default function PatientFullHistory() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Fetch data based on active tab
  const fetchAppointments = selectedTab === 0 || selectedTab === 1;
  const fetchLabs = selectedTab === 0 || selectedTab === 2;
  const fetchPrescriptions = selectedTab === 0 || selectedTab === 3;
  const fetchVitals = selectedTab === 0 || selectedTab === 4;

  const { data: appointmentsData } = useQuery({
    queryKey: ['history-appointments'],
    queryFn: async () => {
      const res = await patientPortalApi.getAppointments({ type: 'past', limit: 50 });
      const raw = res.data?.data;
      return Array.isArray(raw) ? raw : (raw?.data || []);
    },
    enabled: fetchAppointments,
  });

  const { data: labsData } = useQuery({
    queryKey: ['history-labs'],
    queryFn: async () => {
      const res = await patientPortalApi.getLabResults({ status: 'all', limit: 50 });
      const raw = res.data?.data;
      return Array.isArray(raw) ? raw : (raw?.data || []);
    },
    enabled: fetchLabs,
  });

  const { data: prescriptionsData } = useQuery({
    queryKey: ['history-prescriptions'],
    queryFn: async () => {
      const res = await patientPortalApi.getPrescriptions({ status: 'all', limit: 50 });
      const raw = res.data?.data;
      return Array.isArray(raw) ? raw : (raw?.data || []);
    },
    enabled: fetchPrescriptions,
  });

  const { data: vitalsData } = useQuery({
    queryKey: ['history-vitals'],
    queryFn: async () => {
      const res = await patientPortalApi.getVitals({ limit: 50 });
      const raw = res.data?.data;
      return raw?.vitals || (Array.isArray(raw) ? raw : []);
    },
    enabled: fetchVitals,
  });

  const { data: medicalHistoryData } = useQuery({
    queryKey: ['history-medical'],
    queryFn: async () => {
      const res = await patientPortalApi.getMedicalHistory();
      return res.data?.data || res.data || {};
    },
  });

  const { data: allergiesData } = useQuery({
    queryKey: ['history-allergies'],
    queryFn: async () => {
      const res = await patientPortalApi.getAllergies();
      const raw = res.data?.data;
      return Array.isArray(raw) ? raw : [];
    },
  });

  // Build unified timeline
  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    if (appointmentsData) {
      for (const apt of appointmentsData) {
        const date = apt.appointmentDate || apt.date;
        items.push({
          id: `apt-${apt.id}`,
          type: 'appointment',
          date,
          title: apt.doctor?.user
            ? `Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`
            : apt.doctorName || 'Appointment',
          subtitle: apt.doctor?.specialization || apt.specialty || 'General',
          status: apt.status,
          details: apt,
        });
      }
    }

    if (labsData) {
      for (const lab of labsData) {
        items.push({
          id: `lab-${lab.id}`,
          type: 'lab',
          date: lab.testDate || lab.reportDate || lab.createdAt,
          title: lab.testName || 'Lab Test',
          subtitle: `Order #${lab.orderNumber || lab.id?.slice(0, 8)}`,
          status: lab.status,
          details: lab,
        });
      }
    }

    if (prescriptionsData) {
      for (const rx of prescriptionsData) {
        const medNames = rx.medications?.map((m: any) => m.name || m.drugName).filter(Boolean).join(', ') || 'Medication';
        items.push({
          id: `rx-${rx.id}`,
          type: 'prescription',
          date: rx.prescriptionDate || rx.createdAt,
          title: medNames,
          subtitle: rx.doctor?.user
            ? `Dr. ${rx.doctor.user.firstName} ${rx.doctor.user.lastName}`
            : 'Prescribed',
          status: rx.status,
          details: rx,
        });
      }
    }

    if (vitalsData) {
      for (const v of vitalsData) {
        const parts: string[] = [];
        if (v.bloodPressureSys && v.bloodPressureDia) parts.push(`BP ${v.bloodPressureSys}/${v.bloodPressureDia}`);
        if (v.heartRate) parts.push(`HR ${v.heartRate}`);
        if (v.oxygenSaturation) parts.push(`SpO2 ${Number(v.oxygenSaturation)}%`);
        if (v.temperature) parts.push(`${Number(v.temperature)}°C`);
        items.push({
          id: `vital-${v.id}`,
          type: 'vital',
          date: v.recordedAt,
          title: parts.join(' | ') || 'Vitals Recorded',
          subtitle: formatDateTime(v.recordedAt),
          details: v,
        });
      }
    }

    // Sort by date desc
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply date filter
    return items.filter((item) => {
      if (dateFrom && new Date(item.date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(item.date) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [appointmentsData, labsData, prescriptionsData, vitalsData, dateFrom, dateTo]);

  // Filter by tab
  const filteredItems = useMemo(() => {
    if (selectedTab === 0) return timelineItems;
    const typeMap = ['all', 'appointment', 'lab', 'prescription', 'vital'];
    return timelineItems.filter(i => i.type === typeMap[selectedTab]);
  }, [timelineItems, selectedTab]);

  const chronicConditions: string[] = medicalHistoryData?.chronicConditions || [];
  const allergies: any[] = allergiesData || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Health History</h1>
        <p className="text-sm text-gray-500 mt-0.5">Complete timeline of your medical history</p>
      </div>

      {/* Conditions & Allergies Strip */}
      {(chronicConditions.length > 0 || allergies.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex flex-wrap gap-4">
            {chronicConditions.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Conditions</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {chronicConditions.map((c, i) => (
                    <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {allergies.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Allergies</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {allergies.map((a: any, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                      {a.allergen || a.name || String(a)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Tabs + Date Filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Tab.List className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {tabNames.map((name) => (
                <Tab
                  key={name}
                  className={({ selected }) =>
                    `px-3 py-1.5 text-xs font-medium rounded-md transition-colors outline-none ${
                      selected
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`
                  }
                >
                  {name}
                </Tab>
              ))}
            </Tab.List>
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-700 outline-none focus:border-blue-400"
                placeholder="From"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-700 outline-none focus:border-blue-400"
                placeholder="To"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </Tab.Group>
      </div>

      {/* Content */}
      {selectedTab === 4 ? (
        /* Vitals Table */
        <VitalsTable vitals={vitalsData || []} dateFrom={dateFrom} dateTo={dateTo} />
      ) : (
        /* Timeline View */
        <div className="space-y-3">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const tc = typeColors[item.type];
              const isExpanded = expandedItems.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border border-gray-100 border-l-4 ${tc.border} overflow-hidden`}
                >
                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="w-full p-4 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tc.bg} ${tc.text}`}>
                          {tc.label}
                        </span>
                        {item.status && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-500">{formatDate(item.date)}</span>
                      {isExpanded ? (
                        <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <ExpandedDetails item={item} />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No records found</p>
              <p className="text-gray-400 text-sm mt-1">
                {dateFrom || dateTo ? 'Try adjusting the date range' : 'Your medical history will appear here'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Expanded Details
function ExpandedDetails({ item }: { item: TimelineItem }) {
  const d = item.details;
  if (!d) return null;

  switch (item.type) {
    case 'appointment': {
      return (
        <div className="pt-3 space-y-2 text-sm">
          <DetailRow label="Date" value={formatDate(d.appointmentDate || d.date)} />
          <DetailRow label="Time" value={d.startTime || d.time || 'N/A'} />
          <DetailRow label="Type" value={d.type || 'Consultation'} />
          <DetailRow label="Department" value={d.department?.name || d.department || 'N/A'} />
          <DetailRow label="Status" value={d.status?.replace(/_/g, ' ') || 'N/A'} />
          {d.consultation && (
            <>
              {d.consultation.diagnosis && <DetailRow label="Diagnosis" value={d.consultation.diagnosis} />}
              {d.consultation.notes && <DetailRow label="Notes" value={d.consultation.notes} />}
            </>
          )}
        </div>
      );
    }
    case 'lab': {
      const results = d.results || d.tests || [];
      return (
        <div className="pt-3 space-y-2 text-sm">
          <DetailRow label="Order #" value={d.orderNumber || d.id?.slice(0, 8)} />
          <DetailRow label="Status" value={d.status?.replace(/_/g, ' ') || 'N/A'} />
          {results.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-500 mb-2">Test Results</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Test</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Result</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Normal Range</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r: any, i: number) => {
                      const isAbnormal = r.isAbnormal || r.status === 'HIGH' || r.status === 'LOW' || r.status === 'CRITICAL_HIGH' || r.status === 'CRITICAL_LOW';
                      return (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-900">{r.testCode || r.testName || r.labTest?.name || 'Test'}</td>
                          <td className={`px-3 py-2 font-medium ${isAbnormal ? 'text-red-700' : 'text-gray-900'}`}>
                            {r.value || r.result || 'N/A'} {r.unit || ''}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{r.normalRange || 'N/A'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              isAbnormal ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {isAbnormal ? (r.status || 'Abnormal') : 'Normal'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'prescription': {
      const meds = d.medications || [];
      return (
        <div className="pt-3 space-y-2 text-sm">
          <DetailRow label="Status" value={d.status?.replace(/_/g, ' ') || 'N/A'} />
          <DetailRow label="Date" value={formatDate(d.prescriptionDate || d.createdAt)} />
          {meds.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-500 mb-2">Medications</p>
              <div className="space-y-2">
                {meds.map((m: any, i: number) => (
                  <div key={i} className="p-2.5 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900 text-xs">{m.name || m.drugName}</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      {[m.dosage, m.frequency, m.duration ? `for ${m.duration}` : ''].filter(Boolean).join(' - ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    case 'vital': {
      return (
        <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <VitalCell label="Blood Pressure" value={d.bloodPressureSys && d.bloodPressureDia ? `${d.bloodPressureSys}/${d.bloodPressureDia}` : null} unit="mmHg" />
          <VitalCell label="Heart Rate" value={d.heartRate} unit="bpm" colorType="hr" />
          <VitalCell label="SpO2" value={d.oxygenSaturation ? Number(d.oxygenSaturation) : null} unit="%" colorType="spo2" />
          <VitalCell label="Temperature" value={d.temperature ? Number(d.temperature) : null} unit="°C" colorType="temp" />
          <VitalCell label="Respiratory Rate" value={d.respiratoryRate} unit="/min" />
          <VitalCell label="Weight" value={d.weight ? Number(d.weight) : null} unit="kg" />
          <VitalCell label="BMI" value={d.bmi ? Number(d.bmi) : null} unit="kg/m²" colorType="bmi" />
          <VitalCell label="Blood Sugar" value={d.bloodSugar ? Number(d.bloodSugar) : null} unit="mg/dL" colorType="bs" />
        </div>
      );
    }
    default:
      return null;
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="text-gray-500 w-28 flex-shrink-0 text-xs">{label}</span>
      <span className="text-gray-900 text-xs">{value}</span>
    </div>
  );
}

function VitalCell({ label, value, unit, colorType }: { label: string; value: any; unit: string; colorType?: string }) {
  if (value === null || value === undefined) {
    return (
      <div className="p-2 bg-gray-50 rounded-lg">
        <p className="text-gray-400 text-[10px]">{label}</p>
        <p className="text-gray-300 font-medium">--</p>
      </div>
    );
  }
  const colorClass = colorType ? vitalCellColor(Number(value), colorType) : '';
  return (
    <div className={`p-2 rounded-lg ${colorClass || 'bg-gray-50'}`}>
      <p className="text-[10px] opacity-70">{label}</p>
      <p className="font-bold">{typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value} <span className="font-normal text-[10px]">{unit}</span></p>
    </div>
  );
}

// Vitals Table (for Vitals tab)
function VitalsTable({ vitals, dateFrom, dateTo }: { vitals: any[]; dateFrom: string; dateTo: string }) {
  const filtered = useMemo(() => {
    return vitals.filter((v) => {
      if (dateFrom && new Date(v.recordedAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(v.recordedAt) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [vitals, dateFrom, dateTo]);

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <HeartIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No vitals recorded</p>
        <p className="text-gray-400 text-sm mt-1">
          {dateFrom || dateTo ? 'Try adjusting the date range' : 'Your vital signs will appear here after visits'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-3 font-semibold text-gray-600">Date</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600">BP</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600">HR</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600">Temp</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600">SpO2</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600">RR</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600">Weight</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600">BMI</th>
              <th className="text-center px-3 py-3 font-semibold text-gray-600">Blood Sugar</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v: any) => (
              <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-900 font-medium whitespace-nowrap">
                  {formatDate(v.recordedAt)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {v.bloodPressureSys && v.bloodPressureDia ? (
                    <span className={`inline-block px-2 py-0.5 rounded ${
                      v.bloodPressureSys <= 120 && v.bloodPressureDia <= 80
                        ? 'bg-green-50 text-green-700'
                        : v.bloodPressureSys <= 140 && v.bloodPressureDia <= 90
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                    }`}>
                      {v.bloodPressureSys}/{v.bloodPressureDia}
                    </span>
                  ) : <span className="text-gray-300">--</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {v.heartRate ? (
                    <span className={`inline-block px-2 py-0.5 rounded ${vitalCellColor(v.heartRate, 'hr')}`}>
                      {v.heartRate}
                    </span>
                  ) : <span className="text-gray-300">--</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {v.temperature ? (
                    <span className={`inline-block px-2 py-0.5 rounded ${vitalCellColor(Number(v.temperature), 'temp')}`}>
                      {Number(v.temperature).toFixed(1)}
                    </span>
                  ) : <span className="text-gray-300">--</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {v.oxygenSaturation ? (
                    <span className={`inline-block px-2 py-0.5 rounded ${vitalCellColor(Number(v.oxygenSaturation), 'spo2')}`}>
                      {Number(v.oxygenSaturation)}%
                    </span>
                  ) : <span className="text-gray-300">--</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {v.respiratoryRate ? v.respiratoryRate : <span className="text-gray-300">--</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {v.weight ? `${Number(v.weight).toFixed(1)} kg` : <span className="text-gray-300">--</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {v.bmi ? (
                    <span className={`inline-block px-2 py-0.5 rounded ${vitalCellColor(Number(v.bmi), 'bmi')}`}>
                      {Number(v.bmi).toFixed(1)}
                    </span>
                  ) : <span className="text-gray-300">--</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {v.bloodSugar ? (
                    <span className={`inline-block px-2 py-0.5 rounded ${vitalCellColor(Number(v.bloodSugar), 'bs')}`}>
                      {Number(v.bloodSugar).toFixed(0)}
                    </span>
                  ) : <span className="text-gray-300">--</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { PatientFullHistory };
