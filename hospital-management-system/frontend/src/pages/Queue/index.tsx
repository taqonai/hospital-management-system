import { useState, useEffect } from 'react';
import {
  TicketIcon,
  ComputerDesktopIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PlusIcon,
  PlayIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClockIcon,
  UserGroupIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface Counter {
  id: string;
  counterNumber: number;
  counterName: string;
  counterType: string;
  location?: string;
  isActive: boolean;
  currentTicketId?: string;
  tickets: QueueTicket[];
}

interface QueueTicket {
  id: string;
  ticketNumber: string;
  tokenDisplay: string;
  patientName: string;
  patientPhone?: string;
  serviceType: string;
  priority: string;
  status: string;
  queuePosition: number;
  estimatedWaitTime: number;
  issuedAt: string;
  calledAt?: string;
  aiPriorityScore: number;
}

interface QueueStatus {
  summary: {
    waiting: number;
    called: number;
    serving: number;
    completed: number;
    noShow: number;
    cancelled: number;
    total: number;
  };
  avgWaitTime: number;
  currentlyServing: QueueTicket[];
  estimatedWaitForNew: number;
}

const serviceTypes = [
  { value: 'registration', label: 'Registration', prefix: 'R' },
  { value: 'consultation', label: 'Consultation', prefix: 'C' },
  { value: 'billing', label: 'Billing', prefix: 'B' },
  { value: 'pharmacy', label: 'Pharmacy', prefix: 'P' },
  { value: 'laboratory', label: 'Laboratory', prefix: 'L' },
  { value: 'radiology', label: 'Radiology', prefix: 'X' },
  { value: 'vaccination', label: 'Vaccination', prefix: 'V' },
  { value: 'blood_collection', label: 'Blood Collection', prefix: 'BC' },
  { value: 'opd', label: 'OPD', prefix: 'O' },
];

const priorities = [
  { value: 'EMERGENCY', label: 'Emergency', color: 'bg-red-600' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-500' },
  { value: 'VIP', label: 'VIP', color: 'bg-purple-600' },
  { value: 'PREGNANT', label: 'Pregnant', color: 'bg-pink-500' },
  { value: 'DISABLED', label: 'Disabled', color: 'bg-blue-600' },
  { value: 'SENIOR_CITIZEN', label: 'Senior Citizen', color: 'bg-teal-600' },
  { value: 'CHILD', label: 'Child', color: 'bg-cyan-500' },
  { value: 'NORMAL', label: 'Normal', color: 'bg-gray-600' },
];

export default function QueueManagement() {
  const [activeTab, setActiveTab] = useState<'tickets' | 'counters' | 'analytics' | 'config'>('tickets');
  const [counters, setCounters] = useState<Counter[]>([]);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [counterModalOpen, setCounterModalOpen] = useState(false);

  // Issue ticket form
  const [ticketForm, setTicketForm] = useState({
    patientName: '',
    patientPhone: '',
    serviceType: 'consultation',
    priority: 'NORMAL',
    notes: '',
  });

  // Counter form
  const [counterForm, setCounterForm] = useState({
    counterNumber: 1,
    counterName: '',
    counterType: 'CONSULTATION',
    location: '',
    servicesOffered: [] as string[],
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  };

  // Fetch counters
  const fetchCounters = async () => {
    try {
      const response = await fetch(`${API_URL}/queue/counters`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setCounters(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch counters:', error);
    }
  };

  // Fetch queue status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/queue/status`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounters();
    fetchStatus();

    const interval = setInterval(() => {
      fetchCounters();
      fetchStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Issue new ticket
  const handleIssueTicket = async () => {
    if (!ticketForm.patientName.trim()) {
      toast.error('Please enter patient name');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/queue/tickets`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(ticketForm),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Ticket ${data.data.tokenDisplay} issued! Position: ${data.data.queuePosition}`);
        setIssueModalOpen(false);
        setTicketForm({
          patientName: '',
          patientPhone: '',
          serviceType: 'consultation',
          priority: 'NORMAL',
          notes: '',
        });
        fetchStatus();
        fetchCounters();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to issue ticket');
      }
    } catch (error) {
      toast.error('Failed to issue ticket');
    }
  };

  // Call next patient
  const handleCallNext = async (counterId: string) => {
    try {
      const response = await fetch(`${API_URL}/queue/call-next`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ counterId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          toast.success(`Called ${data.data.tokenDisplay} - ${data.data.patientName}`);
        } else {
          toast('No patients waiting', { icon: 'i' });
        }
        fetchCounters();
        fetchStatus();
      }
    } catch (error) {
      toast.error('Failed to call next patient');
    }
  };

  // Complete ticket
  const handleCompleteTicket = async (ticketId: string) => {
    try {
      const response = await fetch(`${API_URL}/queue/tickets/${ticketId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        toast.success('Ticket completed');
        fetchCounters();
        fetchStatus();
      }
    } catch (error) {
      toast.error('Failed to complete ticket');
    }
  };

  // Mark no-show
  const handleNoShow = async (ticketId: string) => {
    try {
      const response = await fetch(`${API_URL}/queue/tickets/${ticketId}/no-show`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        toast.success('Marked as no-show');
        fetchCounters();
        fetchStatus();
      }
    } catch (error) {
      toast.error('Failed to mark as no-show');
    }
  };

  // Create counter
  const handleCreateCounter = async () => {
    if (!counterForm.counterName.trim()) {
      toast.error('Please enter counter name');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/queue/counters`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(counterForm),
      });

      if (response.ok) {
        toast.success('Counter created');
        setCounterModalOpen(false);
        setCounterForm({
          counterNumber: counters.length + 1,
          counterName: '',
          counterType: 'CONSULTATION',
          location: '',
          servicesOffered: [],
        });
        fetchCounters();
      }
    } catch (error) {
      toast.error('Failed to create counter');
    }
  };

  const getPriorityColor = (priority: string) => {
    const p = priorities.find((pr) => pr.value === priority);
    return p?.color || 'bg-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Queue Management</h1>
          <p className="text-gray-500">Manage patient queues and counters</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/queue/display"
            target="_blank"
            className="btn bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
          >
            <ComputerDesktopIcon className="h-5 w-5" />
            Open Display Board
          </a>
          <button
            onClick={() => setIssueModalOpen(true)}
            className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Issue Ticket
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="card p-4 bg-yellow-50 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">Waiting</p>
                <p className="text-2xl font-bold text-yellow-700">{status.summary.waiting}</p>
              </div>
              <ClockIcon className="h-8 w-8 text-yellow-500" />
            </div>
          </div>

          <div className="card p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Called</p>
                <p className="text-2xl font-bold text-blue-700">{status.summary.called}</p>
              </div>
              <SpeakerWaveIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="card p-4 bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Serving</p>
                <p className="text-2xl font-bold text-green-700">{status.summary.serving}</p>
              </div>
              <UserGroupIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="card p-4 bg-gray-50 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-700">{status.summary.completed}</p>
              </div>
              <CheckIcon className="h-8 w-8 text-gray-500" />
            </div>
          </div>

          <div className="card p-4 bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">No-Show</p>
                <p className="text-2xl font-bold text-red-700">{status.summary.noShow}</p>
              </div>
              <XMarkIcon className="h-8 w-8 text-red-500" />
            </div>
          </div>

          <div className="card p-4 bg-purple-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Avg Wait</p>
                <p className="text-2xl font-bold text-purple-700">{status.avgWaitTime} min</p>
              </div>
              <ClockIcon className="h-8 w-8 text-purple-500" />
            </div>
          </div>

          <div className="card p-4 bg-indigo-50 border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-600">Total Today</p>
                <p className="text-2xl font-bold text-indigo-700">{status.summary.total}</p>
              </div>
              <TicketIcon className="h-8 w-8 text-indigo-500" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'tickets', label: 'Counters & Tickets', icon: TicketIcon },
            { id: 'counters', label: 'Manage Counters', icon: ComputerDesktopIcon },
            { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
            { id: 'config', label: 'Configuration', icon: Cog6ToothIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Counters & Tickets Tab */}
      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {counters.map((counter) => (
            <div
              key={counter.id}
              className={clsx(
                'card p-6 border-2 transition-all',
                counter.isActive
                  ? 'border-green-500'
                  : 'border-gray-300 opacity-60'
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {counter.counterName}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Counter #{counter.counterNumber} - {counter.counterType}
                  </p>
                  {counter.location && (
                    <p className="text-xs text-gray-400">{counter.location}</p>
                  )}
                </div>
                <span
                  className={clsx(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    counter.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {counter.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Current Ticket */}
              {counter.tickets.filter((t) => t.status === 'CALLED' || t.status === 'SERVING').length > 0 && (
                <div className="bg-green-100 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-600 mb-1">Now Serving</p>
                  {counter.tickets
                    .filter((t) => t.status === 'CALLED' || t.status === 'SERVING')
                    .map((ticket) => (
                      <div key={ticket.id} className="flex justify-between items-center">
                        <div>
                          <p className="text-2xl font-bold text-green-700">
                            {ticket.tokenDisplay}
                          </p>
                          <p className="text-sm text-green-600">{ticket.patientName}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCompleteTicket(ticket.id)}
                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                            title="Complete"
                          >
                            <CheckIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleNoShow(ticket.id)}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                            title="No Show"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Queue for this counter */}
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {counter.tickets
                  .filter((t) => t.status === 'WAITING')
                  .slice(0, 5)
                  .map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{ticket.tokenDisplay}</span>
                        <span className={clsx('px-1.5 py-0.5 rounded text-xs text-white', getPriorityColor(ticket.priority))}>
                          {ticket.priority}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">#{ticket.queuePosition}</span>
                    </div>
                  ))}
                {counter.tickets.filter((t) => t.status === 'WAITING').length === 0 && (
                  <p className="text-center text-gray-400 py-2">No waiting patients</p>
                )}
              </div>

              {/* Call Next Button */}
              <button
                onClick={() => handleCallNext(counter.id)}
                disabled={!counter.isActive}
                className={clsx(
                  'w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors',
                  counter.isActive
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                <PlayIcon className="h-5 w-5" />
                Call Next Patient
              </button>
            </div>
          ))}

          {/* Add Counter Card */}
          <button
            onClick={() => setCounterModalOpen(true)}
            className="card p-6 border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors flex flex-col items-center justify-center min-h-[300px]"
          >
            <PlusIcon className="h-12 w-12 text-gray-400 mb-2" />
            <p className="text-gray-500">Add New Counter</p>
          </button>
        </div>
      )}

      {/* Manage Counters Tab */}
      {activeTab === 'counters' && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-bold">All Counters</h2>
            <button
              onClick={() => setCounterModalOpen(true)}
              className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Add Counter
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Counter</th>
                <th>Type</th>
                <th>Location</th>
                <th>Status</th>
                <th>Queue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {counters.map((counter) => (
                <tr key={counter.id}>
                  <td>
                    <div>
                      <p className="font-medium">{counter.counterName}</p>
                      <p className="text-sm text-gray-500">#{counter.counterNumber}</p>
                    </div>
                  </td>
                  <td>{counter.counterType}</td>
                  <td>{counter.location || '-'}</td>
                  <td>
                    <span
                      className={clsx(
                        'px-2 py-1 rounded-full text-xs',
                        counter.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {counter.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{counter.tickets.filter((t) => t.status === 'WAITING').length} waiting</td>
                  <td>
                    <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">Queue Analytics</h2>
          <p className="text-gray-500">Analytics dashboard coming soon...</p>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">Queue Configuration</h2>
          <p className="text-gray-500">Configuration options coming soon...</p>
        </div>
      )}

      {/* Issue Ticket Modal */}
      {issueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Issue New Ticket</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name *
                </label>
                <input
                  type="text"
                  value={ticketForm.patientName}
                  onChange={(e) => setTicketForm({ ...ticketForm, patientName: e.target.value })}
                  className="input w-full"
                  placeholder="Enter patient name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={ticketForm.patientPhone}
                  onChange={(e) => setTicketForm({ ...ticketForm, patientPhone: e.target.value })}
                  className="input w-full"
                  placeholder="For SMS notifications"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Type
                </label>
                <select
                  value={ticketForm.serviceType}
                  onChange={(e) => setTicketForm({ ...ticketForm, serviceType: e.target.value })}
                  className="input w-full"
                >
                  {serviceTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} ({type.prefix})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                  className="input w-full"
                >
                  {priorities.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={ticketForm.notes}
                  onChange={(e) => setTicketForm({ ...ticketForm, notes: e.target.value })}
                  className="input w-full"
                  rows={2}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIssueModalOpen(false)}
                className="btn flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueTicket}
                className="btn flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Issue Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Counter Modal */}
      {counterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Create New Counter</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Counter Number
                </label>
                <input
                  type="number"
                  value={counterForm.counterNumber}
                  onChange={(e) => setCounterForm({ ...counterForm, counterNumber: parseInt(e.target.value) })}
                  className="input w-full"
                  min={1}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Counter Name *
                </label>
                <input
                  type="text"
                  value={counterForm.counterName}
                  onChange={(e) => setCounterForm({ ...counterForm, counterName: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., Registration Counter 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Counter Type
                </label>
                <select
                  value={counterForm.counterType}
                  onChange={(e) => setCounterForm({ ...counterForm, counterType: e.target.value })}
                  className="input w-full"
                >
                  <option value="REGISTRATION">Registration</option>
                  <option value="CONSULTATION">Consultation</option>
                  <option value="BILLING">Billing</option>
                  <option value="PHARMACY">Pharmacy</option>
                  <option value="LABORATORY">Laboratory</option>
                  <option value="RADIOLOGY">Radiology</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={counterForm.location}
                  onChange={(e) => setCounterForm({ ...counterForm, location: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., Ground Floor, Main Building"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCounterModalOpen(false)}
                className="btn flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCounter}
                className="btn flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create Counter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
