import { useState, useEffect, useCallback } from 'react';
import { emergencyApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  ClockIcon,
  ArrowPathIcon,
  WrenchScrewdriverIcon,
  UserPlusIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface EDBed {
  id: string;
  bedNumber: string;
  bedType: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';
  ward?: string;
  currentPatient?: {
    firstName: string;
    lastName: string;
  };
  esiLevel?: number;
  timeOccupied?: string;
}

interface WaitingPatient {
  id: string;
  patient: {
    firstName: string;
    lastName: string;
  };
  esiLevel: number;
  chiefComplaint: string;
  arrivalTime: string;
  waitTime: number;
}

interface BedStats {
  beds: EDBed[];
  occupancyRate: number;
  availableCount: number;
  occupiedCount: number;
  cleaningCount: number;
  totalBeds: number;
}

const defaultBedStats: BedStats = {
  beds: [],
  occupancyRate: 0,
  availableCount: 0,
  occupiedCount: 0,
  cleaningCount: 0,
  totalBeds: 0,
};

const bedTypeLabels: Record<string, string> = {
  STANDARD: 'Standard',
  ICU: 'ICU',
  ELECTRIC: 'Electric',
  PEDIATRIC: 'Pediatric',
  BARIATRIC: 'Bariatric',
};

const bedTypeBadgeColors: Record<string, string> = {
  STANDARD: 'bg-gray-200 text-gray-700',
  ICU: 'bg-purple-100 text-purple-700',
  ELECTRIC: 'bg-cyan-100 text-cyan-700',
  PEDIATRIC: 'bg-pink-100 text-pink-700',
  BARIATRIC: 'bg-amber-100 text-amber-700',
};

export default function EDBeds() {
  const [bedStats, setBedStats] = useState<BedStats>(defaultBedStats);
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBed, setSelectedBed] = useState<EDBed | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBedDetail, setShowBedDetail] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchBeds = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setRefreshing(true);

      const [bedsResult, waitingResult] = await Promise.allSettled([
        emergencyApi.getEDBeds(),
        emergencyApi.getWaitingPatients(),
      ]);

      if (bedsResult.status === 'fulfilled') {
        setBedStats(bedsResult.value.data.data || defaultBedStats);
      } else {
        console.error('Failed to fetch ED beds:', bedsResult.reason);
        if (!isBackground) toast.error('Failed to load ED beds');
      }

      if (waitingResult.status === 'fulfilled') {
        setWaitingPatients(waitingResult.value.data.data || []);
      } else {
        console.error('Failed to fetch waiting patients:', waitingResult.reason);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch ED beds:', error);
      if (!isBackground) toast.error('Failed to load ED beds');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBeds();
    const interval = setInterval(() => fetchBeds(true), 30000);
    return () => clearInterval(interval);
  }, [fetchBeds]);

  const handleBedClick = (bed: EDBed) => {
    setSelectedBed(bed);
    if (bed.status === 'AVAILABLE') {
      setShowAssignModal(true);
    } else {
      setShowBedDetail(true);
    }
  };

  const handleAssignPatient = async (patientId: string) => {
    if (!selectedBed) return;

    try {
      await emergencyApi.assignPatientToBed(selectedBed.id, patientId);
      toast.success(`Patient assigned to bed ${selectedBed.bedNumber}`);
      setShowAssignModal(false);
      setSelectedBed(null);
      await fetchBeds();
    } catch (error: any) {
      console.error('Failed to assign patient:', error);
      toast.error(error.response?.data?.message || 'Failed to assign patient');
    }
  };

  const handleUpdateBedStatus = async (bedId: string, status: string) => {
    try {
      await emergencyApi.updateBedStatus(bedId, status);
      toast.success('Bed status updated');
      setShowBedDetail(false);
      setSelectedBed(null);
      await fetchBeds();
    } catch (error: any) {
      console.error('Failed to update bed status:', error);
      toast.error(error.response?.data?.message || 'Failed to update bed status');
    }
  };

  const getBedStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-gradient-to-br from-green-50 to-green-100 border-green-300 text-green-800';
      case 'OCCUPIED':
        return 'bg-gradient-to-br from-red-50 to-red-100 border-red-300 text-red-800';
      case 'CLEANING':
        return 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300 text-yellow-800';
      case 'MAINTENANCE':
        return 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 text-gray-600';
      default:
        return 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return '🟢';
      case 'OCCUPIED':
        return '🔴';
      case 'CLEANING':
        return '🟡';
      case 'MAINTENANCE':
        return '⚙️';
      default:
        return '⚪';
    }
  };

  const getESIColor = (level?: number) => {
    if (!level) return 'bg-gray-500';
    switch (level) {
      case 1: return 'bg-red-600';
      case 2: return 'bg-orange-500';
      case 3: return 'bg-yellow-500';
      case 4: return 'bg-green-500';
      case 5: return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const calculateTimeOccupied = (timeOccupied?: string) => {
    if (!timeOccupied) return '';
    const time = new Date(timeOccupied);
    if (isNaN(time.getTime())) return '';
    const now = new Date();
    const minutes = Math.round((now.getTime() - time.getTime()) / (1000 * 60));
    if (minutes < 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Get unique bed types for filter
  const bedTypes = ['ALL', ...new Set(bedStats.beds.map(b => b.bedType).filter(Boolean))];

  // Filter beds
  const filteredBeds = filterType === 'ALL'
    ? bedStats.beds
    : bedStats.beds.filter(b => b.bedType === filterType);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        <p className="text-gray-500 text-sm">Loading ED beds...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="backdrop-blur-xl rounded-2xl p-4 border border-gray-200 bg-white/60 shadow-lg">
          <p className="text-sm text-gray-600 mb-1">Total Beds</p>
          <p className="text-3xl font-bold text-gray-900">{bedStats.totalBeds}</p>
        </div>
        <div className="backdrop-blur-xl rounded-2xl p-4 border border-green-200 bg-green-50/60 shadow-lg">
          <p className="text-sm text-green-600 mb-1">Available</p>
          <p className="text-3xl font-bold text-green-700">{bedStats.availableCount}</p>
        </div>
        <div className="backdrop-blur-xl rounded-2xl p-4 border border-red-200 bg-red-50/60 shadow-lg">
          <p className="text-sm text-red-600 mb-1">Occupied</p>
          <p className="text-3xl font-bold text-red-700">{bedStats.occupiedCount}</p>
        </div>
        <div className="backdrop-blur-xl rounded-2xl p-4 border border-yellow-200 bg-yellow-50/60 shadow-lg">
          <p className="text-sm text-yellow-600 mb-1">Cleaning</p>
          <p className="text-3xl font-bold text-yellow-700">{bedStats.cleaningCount}</p>
        </div>
        <div className="backdrop-blur-xl rounded-2xl p-4 border border-blue-200 bg-blue-50/60 shadow-lg">
          <p className="text-sm text-blue-600 mb-1">Occupancy</p>
          <p className="text-3xl font-bold text-blue-700">{bedStats.occupancyRate}%</p>
          {/* Progress bar */}
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={clsx(
                'h-2 rounded-full transition-all duration-500',
                bedStats.occupancyRate > 85 ? 'bg-red-500' : bedStats.occupancyRate > 60 ? 'bg-yellow-500' : 'bg-blue-500'
              )}
              style={{ width: `${Math.min(bedStats.occupancyRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Toolbar: Filter + Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {bedTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                filterType === type
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {type === 'ALL' ? 'All Types' : bedTypeLabels[type] || type}
              {type !== 'ALL' && (
                <span className="ml-1.5 text-xs opacity-75">
                  ({bedStats.beds.filter(b => b.bedType === type).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchBeds()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <ArrowPathIcon className={clsx('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Beds Grid */}
      {filteredBeds.length === 0 ? (
        <div className="backdrop-blur-xl rounded-2xl p-12 border border-gray-200 bg-white/60 text-center">
          <WrenchScrewdriverIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            {bedStats.beds.length === 0
              ? 'No ED beds configured'
              : `No ${bedTypeLabels[filterType] || filterType} beds found`}
          </p>
          {bedStats.beds.length === 0 && (
            <p className="text-gray-400 text-sm mt-2">
              Contact your administrator to set up Emergency Department beds
            </p>
          )}
        </div>
      ) : (
        <div className="backdrop-blur-xl rounded-2xl p-6 border border-gray-200 bg-white/60 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              ED Bed Layout
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({filteredBeds.length} {filterType !== 'ALL' ? bedTypeLabels[filterType] : ''} beds)
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredBeds.map((bed) => (
              <div
                key={bed.id}
                onClick={() => handleBedClick(bed)}
                className={clsx(
                  'relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-xl group',
                  getBedStatusColor(bed.status)
                )}
              >
                {/* Bed Type Badge */}
                {bed.bedType && bed.bedType !== 'STANDARD' && (
                  <span className={clsx(
                    'absolute -top-2 -right-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm',
                    bedTypeBadgeColors[bed.bedType] || 'bg-gray-200 text-gray-700'
                  )}>
                    {bedTypeLabels[bed.bedType] || bed.bedType}
                  </span>
                )}

                {/* Bed Number + ESI */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{bed.bedNumber}</span>
                  </div>
                  {bed.esiLevel && (
                    <span className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm',
                      getESIColor(bed.esiLevel)
                    )}>
                      {bed.esiLevel}
                    </span>
                  )}
                </div>

                {/* Patient Info or Status */}
                {bed.currentPatient ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold truncate">
                      {bed.currentPatient.firstName} {bed.currentPatient.lastName}
                    </p>
                    {bed.timeOccupied && (
                      <div className="flex items-center gap-1 text-xs opacity-75">
                        <ClockIcon className="h-3 w-3" />
                        <span>{calculateTimeOccupied(bed.timeOccupied)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {getStatusIcon(bed.status)}{' '}
                      {bed.status === 'AVAILABLE' && 'Available'}
                      {bed.status === 'CLEANING' && 'Cleaning'}
                      {bed.status === 'MAINTENANCE' && 'Maintenance'}
                    </p>
                    {bed.bedType && (
                      <p className="text-xs opacity-60">{bedTypeLabels[bed.bedType] || bed.bedType}</p>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                {bed.status === 'CLEANING' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateBedStatus(bed.id, 'AVAILABLE');
                    }}
                    className="mt-2 w-full text-xs py-1.5 px-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    ✓ Mark Clean
                  </button>
                )}

                {bed.status === 'OCCUPIED' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateBedStatus(bed.id, 'CLEANING');
                    }}
                    className="mt-2 w-full text-xs py-1.5 px-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                  >
                    🧹 Discharge & Clean
                  </button>
                )}

                {bed.status === 'AVAILABLE' && (
                  <div className="mt-2 w-full text-xs py-1.5 px-2 bg-green-600/10 text-green-700 rounded-lg text-center font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <UserPlusIcon className="h-3 w-3 inline mr-1" />
                    Click to Assign
                  </div>
                )}

                {bed.status === 'MAINTENANCE' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateBedStatus(bed.id, 'AVAILABLE');
                    }}
                    className="mt-2 w-full text-xs py-1.5 px-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    ✓ End Maintenance
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting Patients */}
      <div className="backdrop-blur-xl rounded-2xl p-6 border border-gray-200 bg-white/60 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Waiting for Bed Assignment
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({waitingPatients.length} patient{waitingPatients.length !== 1 ? 's' : ''})
          </span>
        </h3>
        {waitingPatients.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No patients currently waiting for bed assignment</p>
          </div>
        ) : (
          <div className="space-y-3">
            {waitingPatients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm',
                    getESIColor(patient.esiLevel)
                  )}>
                    {patient.esiLevel}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {patient.patient.firstName} {patient.patient.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{patient.chiefComplaint}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <ClockIcon className="h-3 w-3" />
                      Waiting: {patient.waitTime} minutes
                    </p>
                  </div>
                </div>
                {bedStats.availableCount > 0 && (
                  <button
                    onClick={() => {
                      // Find first available bed and show assign modal
                      const availableBed = bedStats.beds.find(b => b.status === 'AVAILABLE');
                      if (availableBed) {
                        setSelectedBed(availableBed);
                        setShowAssignModal(true);
                      }
                    }}
                    className="px-3 py-1.5 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Assign Bed
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Patient Modal */}
      {showAssignModal && selectedBed && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowAssignModal(false); setSelectedBed(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Assign Patient to Bed {selectedBed.bedNumber}
              </h3>
              <button
                onClick={() => { setShowAssignModal(false); setSelectedBed(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Bed info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Bed:</span> {selectedBed.bedNumber}
                {selectedBed.bedType && (
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-full',
                    bedTypeBadgeColors[selectedBed.bedType] || 'bg-gray-200 text-gray-700'
                  )}>
                    {bedTypeLabels[selectedBed.bedType] || selectedBed.bedType}
                  </span>
                )}
              </div>
              {selectedBed.ward && (
                <p className="text-gray-500 mt-1">Ward: {selectedBed.ward}</p>
              )}
            </div>

            {waitingPatients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No patients waiting for bed assignment</p>
                <button
                  onClick={() => { setShowAssignModal(false); setSelectedBed(null); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                  {waitingPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleAssignPatient(patient.id)}
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-all text-left"
                    >
                      <span className={clsx(
                        'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0',
                        getESIColor(patient.esiLevel)
                      )}>
                        {patient.esiLevel}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {patient.patient.firstName} {patient.patient.lastName}
                        </p>
                        <p className="text-sm text-gray-600 truncate">{patient.chiefComplaint}</p>
                        <p className="text-xs text-gray-500">Waiting: {patient.waitTime} min</p>
                      </div>
                      <span className="text-xs text-blue-500 font-medium">Select →</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setShowAssignModal(false); setSelectedBed(null); }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bed Detail Modal (for occupied/cleaning/maintenance beds) */}
      {showBedDetail && selectedBed && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowBedDetail(false); setSelectedBed(null); }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Bed {selectedBed.bedNumber}
              </h3>
              <button
                onClick={() => { setShowBedDetail(false); setSelectedBed(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Bed Info */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className={clsx(
                    'text-sm font-medium px-2 py-0.5 rounded-full',
                    selectedBed.status === 'OCCUPIED' && 'bg-red-100 text-red-700',
                    selectedBed.status === 'CLEANING' && 'bg-yellow-100 text-yellow-700',
                    selectedBed.status === 'MAINTENANCE' && 'bg-gray-200 text-gray-700',
                    selectedBed.status === 'AVAILABLE' && 'bg-green-100 text-green-700',
                  )}>
                    {selectedBed.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Type</span>
                  <span className="text-sm font-medium">{bedTypeLabels[selectedBed.bedType] || selectedBed.bedType}</span>
                </div>
                {selectedBed.ward && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Ward</span>
                    <span className="text-sm font-medium">{selectedBed.ward}</span>
                  </div>
                )}
              </div>

              {/* Patient Info (if occupied) */}
              {selectedBed.currentPatient && (
                <div className="p-4 bg-blue-50 rounded-xl space-y-2">
                  <h4 className="font-semibold text-gray-900">Current Patient</h4>
                  <p className="text-sm text-gray-700">
                    {selectedBed.currentPatient.firstName} {selectedBed.currentPatient.lastName}
                  </p>
                  {selectedBed.esiLevel && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">ESI Level:</span>
                      <span className={clsx(
                        'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold',
                        getESIColor(selectedBed.esiLevel)
                      )}>
                        {selectedBed.esiLevel}
                      </span>
                    </div>
                  )}
                  {selectedBed.timeOccupied && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      Duration: {calculateTimeOccupied(selectedBed.timeOccupied)}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 text-sm">Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedBed.status === 'OCCUPIED' && (
                    <>
                      <button
                        onClick={() => handleUpdateBedStatus(selectedBed.id, 'CLEANING')}
                        className="px-3 py-2 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                      >
                        🧹 Mark Cleaning
                      </button>
                      <button
                        onClick={() => handleUpdateBedStatus(selectedBed.id, 'AVAILABLE')}
                        className="px-3 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        ✓ Mark Available
                      </button>
                    </>
                  )}
                  {selectedBed.status === 'CLEANING' && (
                    <button
                      onClick={() => handleUpdateBedStatus(selectedBed.id, 'AVAILABLE')}
                      className="col-span-2 px-3 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    >
                      ✓ Mark Clean & Available
                    </button>
                  )}
                  {selectedBed.status === 'MAINTENANCE' && (
                    <button
                      onClick={() => handleUpdateBedStatus(selectedBed.id, 'AVAILABLE')}
                      className="col-span-2 px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      ✓ End Maintenance
                    </button>
                  )}
                  {selectedBed.status !== 'MAINTENANCE' && selectedBed.status !== 'OCCUPIED' && (
                    <button
                      onClick={() => handleUpdateBedStatus(selectedBed.id, 'MAINTENANCE')}
                      className={clsx(
                        'px-3 py-2 text-sm font-medium bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors',
                        selectedBed.status === 'CLEANING' ? 'col-span-2 mt-2' : 'col-span-2'
                      )}
                    >
                      ⚙️ Set Maintenance
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="backdrop-blur-xl rounded-2xl p-4 border border-gray-200 bg-white/60 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Status</h4>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-sm text-gray-600">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span className="text-sm text-gray-600">Cleaning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-500"></div>
                <span className="text-sm text-gray-600">Maintenance</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Bed Types</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(bedTypeLabels).map(([type, label]) => (
                <span key={type} className={clsx('text-xs px-2 py-0.5 rounded-full', bedTypeBadgeColors[type])}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
