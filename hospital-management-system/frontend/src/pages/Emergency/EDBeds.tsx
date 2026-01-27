import { useState, useEffect } from 'react';
import { emergencyApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

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

export default function EDBeds() {
  const [bedStats, setBedStats] = useState<BedStats>({
    beds: [],
    occupancyRate: 0,
    availableCount: 0,
    occupiedCount: 0,
    cleaningCount: 0,
    totalBeds: 0,
  });
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState<EDBed | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const fetchBeds = async () => {
    try {
      setLoading(true);
      const [bedsResponse, waitingResponse] = await Promise.all([
        emergencyApi.getEDBeds(),
        emergencyApi.getWaitingPatients(),
      ]);
      setBedStats(bedsResponse.data.data);
      setWaitingPatients(waitingResponse.data.data);
    } catch (error) {
      console.error('Failed to fetch ED beds:', error);
      toast.error('Failed to load ED beds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeds();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBeds, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleBedClick = (bed: EDBed) => {
    setSelectedBed(bed);
    if (bed.status === 'AVAILABLE') {
      setShowAssignModal(true);
    }
  };

  const handleAssignPatient = async (patientId: string) => {
    if (!selectedBed) return;

    try {
      await emergencyApi.assignPatientToBed(selectedBed.id, patientId);
      toast.success('Patient assigned to bed');
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
      await fetchBeds();
    } catch (error: any) {
      console.error('Failed to update bed status:', error);
      toast.error(error.response?.data?.message || 'Failed to update bed status');
    }
  };

  const getBedStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'OCCUPIED':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'CLEANING':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'MAINTENANCE':
        return 'bg-gray-100 border-gray-300 text-gray-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
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
    const now = new Date();
    const minutes = Math.round((now.getTime() - time.getTime()) / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
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
        </div>
      </div>

      {/* Beds Grid */}
      {bedStats.beds.length === 0 ? (
        <div className="backdrop-blur-xl rounded-2xl p-12 border border-gray-200 bg-white/60 text-center">
          <p className="text-gray-500 text-lg">No ED beds configured</p>
          <p className="text-gray-400 text-sm mt-2">Contact your administrator to set up Emergency Department beds</p>
        </div>
      ) : (
        <div className="backdrop-blur-xl rounded-2xl p-6 border border-gray-200 bg-white/60 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">ED Bed Layout</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {bedStats.beds.map((bed) => (
              <div
                key={bed.id}
                onClick={() => handleBedClick(bed)}
                className={clsx(
                  'relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl',
                  getBedStatusColor(bed.status)
                )}
              >
                {/* Bed Number */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold">{bed.bedNumber}</span>
                  {bed.esiLevel && (
                    <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold', getESIColor(bed.esiLevel))}>
                      {bed.esiLevel}
                    </span>
                  )}
                </div>

                {/* Patient Info */}
                {bed.currentPatient ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold truncate">
                      {bed.currentPatient.firstName} {bed.currentPatient.lastName}
                    </p>
                    {bed.timeOccupied && (
                      <div className="flex items-center gap-1 text-xs">
                        <ClockIcon className="h-3 w-3" />
                        <span>{calculateTimeOccupied(bed.timeOccupied)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm font-medium">
                    {bed.status === 'AVAILABLE' && 'Available'}
                    {bed.status === 'CLEANING' && 'Cleaning'}
                    {bed.status === 'MAINTENANCE' && 'Maintenance'}
                  </div>
                )}

                {/* Status Actions (for cleaning beds) */}
                {bed.status === 'CLEANING' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateBedStatus(bed.id, 'AVAILABLE');
                    }}
                    className="mt-2 w-full text-xs py-1 px-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  >
                    Mark Clean
                  </button>
                )}

                {/* Occupied bed action */}
                {bed.status === 'OCCUPIED' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateBedStatus(bed.id, 'CLEANING');
                    }}
                    className="mt-2 w-full text-xs py-1 px-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    Mark Cleaning
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting Patients */}
      {waitingPatients.length > 0 && (
        <div className="backdrop-blur-xl rounded-2xl p-6 border border-gray-200 bg-white/60 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Waiting for Bed Assignment ({waitingPatients.length})
          </h3>
          <div className="space-y-3">
            {waitingPatients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold', getESIColor(patient.esiLevel))}>
                    {patient.esiLevel}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {patient.patient.firstName} {patient.patient.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{patient.chiefComplaint}</p>
                    <p className="text-xs text-gray-500">Waiting: {patient.waitTime} minutes</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign Patient Modal */}
      {showAssignModal && selectedBed && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Assign Patient to Bed {selectedBed.bedNumber}
            </h3>

            {waitingPatients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No patients waiting for bed assignment</p>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedBed(null);
                  }}
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
                      className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all text-left"
                    >
                      <span className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0', getESIColor(patient.esiLevel))}>
                        {patient.esiLevel}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {patient.patient.firstName} {patient.patient.lastName}
                        </p>
                        <p className="text-sm text-gray-600 truncate">{patient.chiefComplaint}</p>
                        <p className="text-xs text-gray-500">Waiting: {patient.waitTime} min</p>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedBed(null);
                  }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="backdrop-blur-xl rounded-2xl p-4 border border-gray-200 bg-white/60 shadow-lg">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Legend</h4>
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
    </div>
  );
}
