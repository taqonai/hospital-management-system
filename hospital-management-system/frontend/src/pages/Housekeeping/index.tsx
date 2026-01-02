import { useState, useEffect } from 'react';
import {
  ClipboardDocumentListIcon,
  MapPinIcon,
  ArchiveBoxIcon,
  ClipboardDocumentCheckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  PlayIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { housekeepingApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Zone {
  id: string;
  name: string;
  description?: string;
  zoneType: string;
  floor?: string;
  building?: string;
  isActive: boolean;
}

interface Task {
  id: string;
  taskNumber: string;
  taskType: string;
  description?: string;
  zone: {
    name: string;
    zoneType: string;
  };
  location?: string;
  priority: string;
  status: string;
  assignedTo?: {
    firstName: string;
    lastName: string;
  };
  scheduledDate: string;
  estimatedDuration?: number;
  isInfectionControl: boolean;
  isDischargeClean: boolean;
  createdAt: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  isActive: boolean;
}

interface Audit {
  id: string;
  zone: {
    name: string;
  };
  auditor: {
    firstName: string;
    lastName: string;
  };
  overallScore: number;
  status: string;
  auditDate: string;
  issues?: string;
}

interface HousekeepingStats {
  pendingTasks: number;
  inProgressTasks: number;
  completedToday: number;
  overdueTasks: number;
  lowStockItems: number;
  averageQualityScore: number;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  VERIFIED: 'bg-emerald-100 text-emerald-800',
  NEEDS_RECLEAN: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  PASSED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  RESOLVED: 'bg-blue-100 text-blue-800',
};

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
  EMERGENCY: 'bg-red-200 text-red-800',
};

const taskTypeLabels: Record<string, string> = {
  ROUTINE: 'Routine Cleaning',
  DEEP: 'Deep Cleaning',
  DISCHARGE: 'Discharge Clean',
  TERMINAL: 'Terminal Clean',
  SPOT: 'Spot Cleaning',
  SPECIALIZED: 'Specialized',
  BIOHAZARD: 'Biohazard',
};

const zoneTypeLabels: Record<string, string> = {
  PATIENT_ROOM: 'Patient Room',
  ICU: 'ICU',
  OPERATING_THEATER: 'Operating Theater',
  EMERGENCY: 'Emergency',
  LOBBY: 'Lobby',
  CORRIDOR: 'Corridor',
  RESTROOM: 'Restroom',
  CAFETERIA: 'Cafeteria',
  OFFICE: 'Office',
  LABORATORY: 'Laboratory',
  PHARMACY: 'Pharmacy',
  STORAGE: 'Storage',
  OUTDOOR: 'Outdoor',
};

export default function Housekeeping() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'zones' | 'inventory' | 'audits'>('tasks');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [aiTasks, setAITasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<HousekeepingStats>({
    pendingTasks: 0,
    inProgressTasks: 0,
    completedToday: 0,
    overdueTasks: 0,
    lowStockItems: 0,
    averageQualityScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAIPriority, setShowAIPriority] = useState(false);

  // Fetch tasks
  useEffect(() => {
    if (activeTab !== 'tasks') return;

    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await housekeepingApi.getTasks({
          page,
          limit: 20,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        });
        setTasks(response.data.data?.tasks || []);
        if (response.data.data?.pagination) {
          setTotalPages(response.data.data.pagination.totalPages);
        }
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
        toast.error('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [activeTab, page, statusFilter, priorityFilter]);

  // Fetch zones
  useEffect(() => {
    if (activeTab !== 'zones') return;

    const fetchZones = async () => {
      try {
        setLoading(true);
        const response = await housekeepingApi.getZones();
        setZones(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch zones:', error);
        toast.error('Failed to load zones');
      } finally {
        setLoading(false);
      }
    };

    fetchZones();
  }, [activeTab]);

  // Fetch inventory
  useEffect(() => {
    if (activeTab !== 'inventory') return;

    const fetchInventory = async () => {
      try {
        setLoading(true);
        const response = await housekeepingApi.getInventory({
          lowStock: statusFilter === 'low_stock' || undefined,
        });
        setInventory(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
        toast.error('Failed to load inventory');
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, [activeTab, statusFilter]);

  // Fetch audits
  useEffect(() => {
    if (activeTab !== 'audits') return;

    const fetchAudits = async () => {
      try {
        setLoading(true);
        const response = await housekeepingApi.getAudits({
          page,
          limit: 20,
          status: statusFilter || undefined,
        });
        setAudits(response.data.data?.audits || []);
        if (response.data.data?.pagination) {
          setTotalPages(response.data.data.pagination.totalPages);
        }
      } catch (error) {
        console.error('Failed to fetch audits:', error);
        toast.error('Failed to load audits');
      } finally {
        setLoading(false);
      }
    };

    fetchAudits();
  }, [activeTab, page, statusFilter]);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await housekeepingApi.getDashboard();
        setStats(response.data.data || {
          pendingTasks: 0,
          inProgressTasks: 0,
          completedToday: 0,
          overdueTasks: 0,
          lowStockItems: 0,
          averageQualityScore: 0,
        });
      } catch (error) {
        console.error('Failed to fetch housekeeping stats:', error);
      }
    };

    fetchStats();
  }, []);

  const handleGetAIPrioritizedTasks = async () => {
    try {
      setLoading(true);
      const response = await housekeepingApi.getAIPrioritizedTasks();
      setAITasks(response.data.data || []);
      setShowAIPriority(true);
      toast.success('AI prioritization complete');
    } catch (error) {
      console.error('Failed to get AI prioritized tasks:', error);
      toast.error('Failed to get AI prioritization');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async (id: string) => {
    try {
      await housekeepingApi.startTask(id);
      toast.success('Task started');
      // Refresh tasks
      const response = await housekeepingApi.getTasks({ page, limit: 20, status: statusFilter || undefined, priority: priorityFilter || undefined });
      setTasks(response.data.data?.tasks || []);
    } catch (error) {
      console.error('Failed to start task:', error);
      toast.error('Failed to start task');
    }
  };

  const handleCompleteTask = async (id: string) => {
    try {
      await housekeepingApi.completeTask(id, { notes: 'Completed via dashboard' });
      toast.success('Task completed');
      // Refresh tasks
      const response = await housekeepingApi.getTasks({ page, limit: 20, status: statusFilter || undefined, priority: priorityFilter || undefined });
      setTasks(response.data.data?.tasks || []);
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error('Failed to complete task');
    }
  };

  const handleVerifyTask = async (id: string, score: number) => {
    try {
      await housekeepingApi.verifyTask(id, score);
      toast.success('Task verified');
      // Refresh tasks
      const response = await housekeepingApi.getTasks({ page, limit: 20, status: statusFilter || undefined, priority: priorityFilter || undefined });
      setTasks(response.data.data?.tasks || []);
    } catch (error) {
      console.error('Failed to verify task:', error);
      toast.error('Failed to verify task');
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= item.minStock) return { label: 'Critical', color: 'text-red-600 bg-red-50' };
    if (item.currentStock <= item.reorderPoint) return { label: 'Low', color: 'text-orange-600 bg-orange-50' };
    return { label: 'OK', color: 'text-green-600 bg-green-50' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Housekeeping</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage cleaning tasks, zones, inventory, and quality audits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGetAIPrioritizedTasks}
            className="btn-outline flex items-center gap-2 text-purple-600 border-purple-300 hover:bg-purple-50"
          >
            <SparklesIcon className="h-5 w-5" />
            AI Priority
          </button>
          {activeTab === 'tasks' && (
            <button className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              New Task
            </button>
          )}
          {activeTab === 'zones' && (
            <button className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Zone
            </button>
          )}
          {activeTab === 'inventory' && (
            <button className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Item
            </button>
          )}
          {activeTab === 'audits' && (
            <button className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              New Audit
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card p-4 bg-yellow-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pendingTasks}</p>
            </div>
            <ClockIcon className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="card p-4 bg-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-700">{stats.inProgressTasks}</p>
            </div>
            <ArrowPathIcon className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="card p-4 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Completed</p>
              <p className="text-2xl font-bold text-green-700">{stats.completedToday}</p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="card p-4 bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Overdue</p>
              <p className="text-2xl font-bold text-red-700">{stats.overdueTasks}</p>
            </div>
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="card p-4 bg-orange-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Low Stock</p>
              <p className="text-2xl font-bold text-orange-700">{stats.lowStockItems}</p>
            </div>
            <ArchiveBoxIcon className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        <div className="card p-4 bg-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Quality Score</p>
              <p className="text-2xl font-bold text-purple-700">{stats.averageQualityScore?.toFixed(1) || 0}%</p>
            </div>
            <ClipboardDocumentCheckIcon className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* AI Priority Tasks Modal */}
      {showAIPriority && aiTasks.length > 0 && (
        <div className="card border-2 border-purple-200 bg-purple-50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-6 w-6 text-purple-600" />
              <h3 className="font-semibold text-purple-900">AI Prioritized Tasks</h3>
            </div>
            <button onClick={() => setShowAIPriority(false)} className="text-purple-600 hover:text-purple-800">
              Close
            </button>
          </div>
          <div className="space-y-2">
            {aiTasks.slice(0, 5).map((task, index) => (
              <div key={task.id} className="flex items-center gap-3 bg-white rounded-lg p-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-sm flex items-center justify-center font-bold">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{task.zone?.name} - {taskTypeLabels[task.taskType] || task.taskType}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className={clsx('badge', priorityColors[task.priority])}>{task.priority}</span>
                    {task.isInfectionControl && <span className="text-red-600">Infection Control</span>}
                    {task.isDischargeClean && <span className="text-orange-600">Discharge Clean</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleStartTask(task.id)}
                  className="btn-primary text-sm py-1"
                >
                  Start
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'tasks', label: 'Tasks', icon: ClipboardDocumentListIcon },
            { id: 'zones', label: 'Zones', icon: MapPinIcon },
            { id: 'inventory', label: 'Inventory', icon: ArchiveBoxIcon },
            { id: 'audits', label: 'Quality Audits', icon: ClipboardDocumentCheckIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                setPage(1);
                setStatusFilter('');
                setPriorityFilter('');
              }}
              className={clsx(
                'py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-auto"
            >
              <option value="">All Status</option>
              {activeTab === 'tasks' && (
                <>
                  <option value="PENDING">Pending</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="VERIFIED">Verified</option>
                </>
              )}
              {activeTab === 'inventory' && (
                <>
                  <option value="low_stock">Low Stock Only</option>
                </>
              )}
              {activeTab === 'audits' && (
                <>
                  <option value="PASSED">Passed</option>
                  <option value="FAILED">Failed</option>
                  <option value="RESOLVED">Resolved</option>
                </>
              )}
            </select>
            {activeTab === 'tasks' && (
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="input w-auto"
              >
                <option value="">All Priority</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card p-8 text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      ) : (
        <>
          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="card">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <ClipboardDocumentListIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No tasks found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {tasks.map((task) => (
                    <div key={task.id} className={clsx(
                      'p-4 hover:bg-gray-50',
                      task.isInfectionControl && 'bg-red-50 hover:bg-red-100',
                      task.isDischargeClean && 'bg-orange-50 hover:bg-orange-100'
                    )}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm text-gray-500">{task.taskNumber}</span>
                            <span className={clsx('badge', statusColors[task.status])}>
                              {task.status?.replace('_', ' ')}
                            </span>
                            <span className={clsx('badge', priorityColors[task.priority])}>
                              {task.priority}
                            </span>
                            {task.isInfectionControl && (
                              <span className="badge bg-red-200 text-red-800">Infection Control</span>
                            )}
                            {task.isDischargeClean && (
                              <span className="badge bg-orange-200 text-orange-800">Discharge</span>
                            )}
                          </div>
                          <h3 className="mt-2 font-medium text-gray-900">
                            {task.zone?.name} - {taskTypeLabels[task.taskType] || task.taskType}
                          </h3>
                          <p className="text-sm text-gray-500">{task.location || task.description}</p>
                          {task.assignedTo && (
                            <div className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                              <UserIcon className="h-4 w-4" />
                              {task.assignedTo.firstName} {task.assignedTo.lastName}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-500">
                            {new Date(task.scheduledDate).toLocaleDateString()}
                          </p>
                          {task.estimatedDuration && (
                            <p className="text-gray-400">{task.estimatedDuration} min</p>
                          )}
                          <div className="mt-3 flex gap-2 justify-end">
                            {task.status === 'ASSIGNED' && (
                              <button
                                onClick={() => handleStartTask(task.id)}
                                className="btn-outline text-sm py-1 flex items-center gap-1"
                              >
                                <PlayIcon className="h-4 w-4" />
                                Start
                              </button>
                            )}
                            {task.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => handleCompleteTask(task.id)}
                                className="btn-outline text-green-600 border-green-300 hover:bg-green-50 text-sm py-1 flex items-center gap-1"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                                Complete
                              </button>
                            )}
                            {task.status === 'COMPLETED' && (
                              <button
                                onClick={() => handleVerifyTask(task.id, 90)}
                                className="btn-outline text-purple-600 border-purple-300 hover:bg-purple-50 text-sm py-1"
                              >
                                Verify
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Zones Tab */}
          {activeTab === 'zones' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zones.length === 0 ? (
                <div className="col-span-full card p-8 text-center text-gray-500">
                  <MapPinIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No zones found</p>
                </div>
              ) : (
                zones.map((zone) => (
                  <div key={zone.id} className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{zone.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {zoneTypeLabels[zone.zoneType] || zone.zoneType}
                        </p>
                        {zone.floor && (
                          <p className="text-sm text-gray-400">
                            {zone.building && `${zone.building}, `}Floor {zone.floor}
                          </p>
                        )}
                      </div>
                      <span className={clsx(
                        'badge',
                        zone.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      )}>
                        {zone.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {zone.description && (
                      <p className="mt-2 text-sm text-gray-600">{zone.description}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button className="btn-outline text-sm py-1 flex-1">View Tasks</button>
                      <button className="btn-outline text-sm py-1">Edit</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="card">
              {inventory.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <ArchiveBoxIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No inventory items found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Current Stock
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Min / Max
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inventory.map((item) => {
                        const stockStatus = getStockStatus(item);
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{item.name}</div>
                              <div className="text-sm text-gray-500">{item.unit}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.category}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={clsx('text-lg font-semibold',
                                item.currentStock <= item.minStock ? 'text-red-600' :
                                item.currentStock <= item.reorderPoint ? 'text-orange-600' : 'text-gray-900'
                              )}>
                                {item.currentStock}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                              {item.minStock} / {item.maxStock}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={clsx('badge', stockStatus.color)}>
                                {stockStatus.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <button className="text-primary-600 hover:text-primary-900 mr-3">
                                Add Stock
                              </button>
                              <button className="text-gray-600 hover:text-gray-900">
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Audits Tab */}
          {activeTab === 'audits' && (
            <div className="card">
              {audits.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <ClipboardDocumentCheckIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No audits found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {audits.map((audit) => (
                    <div key={audit.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-gray-900">{audit.zone?.name}</h3>
                            <span className={clsx('badge', statusColors[audit.status])}>
                              {audit.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Audited by: {audit.auditor?.firstName} {audit.auditor?.lastName}
                          </p>
                          {audit.issues && (
                            <p className="mt-2 text-sm text-red-600">{audit.issues}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={clsx(
                            'text-2xl font-bold',
                            audit.overallScore >= 80 ? 'text-green-600' :
                            audit.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                          )}>
                            {audit.overallScore}%
                          </div>
                          <p className="text-sm text-gray-500">
                            {new Date(audit.auditDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {(activeTab === 'tasks' || activeTab === 'audits') && totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-outline text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-outline text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
