import { useState, useEffect } from 'react';
import { emergencyApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  HeartIcon,
  UserIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

interface ResuscitationPatient {
  id: string;
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
  chiefComplaint: string;
  esiLevel: number;
  arrivalTime: string;
  status: string;
  triageNotes?: string;
  doctor?: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  vitals?: Array<{
    temperature?: string;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: string;
    recordedAt: string;
  }>;
}

export default function ResuscitationDashboard() {
  const [patients, setPatients] = useState<ResuscitationPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchResuscitationPatients = async () => {
    try {
      const response = await emergencyApi.getResuscitation();
      setPatients(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch resuscitation patients:', error);
      toast.error('Failed to load critical patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResuscitationPatients();

    // Auto-refresh every 10 seconds (faster than main board for critical patients)
    const interval = setInterval(fetchResuscitationPatients, 10000);
    return () => clearInterval(interval);
  }, []);

  // Update current time every second for live timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const calculateTimeSinceArrival = (arrivalTime: string) => {
    if (!arrivalTime) return '0:00';
    const arrival = new Date(arrivalTime);
    if (isNaN(arrival.getTime())) return '0:00';
    const diff = currentTime.getTime() - arrival.getTime();
    const totalMinutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const getVitalStatus = (vital: string, value: number | string | undefined) => {
    if (value === undefined || value === null) return 'normal';
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    switch (vital) {
      case 'hr':
        if (numValue < 40 || numValue > 150) return 'critical';
        if (numValue < 50 || numValue > 120) return 'warning';
        return 'normal';
      case 'spo2':
        if (numValue < 90) return 'critical';
        if (numValue < 95) return 'warning';
        return 'normal';
      case 'sbp':
        if (numValue < 80 || numValue > 200) return 'critical';
        if (numValue < 90 || numValue > 180) return 'warning';
        return 'normal';
      case 'rr':
        if (numValue < 8 || numValue > 30) return 'critical';
        if (numValue < 10 || numValue > 25) return 'warning';
        return 'normal';
      case 'temp':
        if (numValue > 40) return 'critical';
        if (numValue > 38.5) return 'warning';
        return 'normal';
      default:
        return 'normal';
    }
  };

  const getVitalColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-300';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-300';
      default: return 'text-green-600 bg-green-50 border-green-300';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="backdrop-blur-xl rounded-2xl p-12 border border-gray-200 bg-white/60 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
          <HeartIcon className="h-10 w-10 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">No Critical Patients</h3>
        <p className="text-gray-500">All clear in the resuscitation room</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      <div className="backdrop-blur-xl rounded-2xl p-4 border-2 border-red-300 bg-red-50/80 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center animate-pulse">
            <ExclamationTriangleIcon className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900">
              {patients.length} Critical Patient{patients.length > 1 ? 's' : ''} in Resuscitation
            </h3>
            <p className="text-sm text-red-700">ESI Level 1-2 - Requires immediate attention</p>
          </div>
        </div>
      </div>

      {/* Patient Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {patients.map((patient) => {
          const latestVitals = patient.vitals && patient.vitals.length > 0 ? patient.vitals[0] : null;
          const age = patient.patient?.dateOfBirth ? calculateAge(patient.patient.dateOfBirth) : null;

          return (
            <div
              key={patient.id}
              className={clsx(
                'relative overflow-hidden backdrop-blur-xl rounded-2xl border-2 shadow-2xl transition-all duration-300 hover:scale-[1.02]',
                patient.esiLevel === 1
                  ? 'border-red-500 bg-gradient-to-br from-red-50 to-red-100/80'
                  : 'border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100/80'
              )}
            >
              {/* Animated background pulse for Level 1 */}
              {patient.esiLevel === 1 && (
                <div className="absolute inset-0 animate-pulse bg-red-500/5"></div>
              )}

              <div className="relative p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={clsx(
                      'w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-xl',
                      patient.esiLevel === 1 ? 'bg-red-600 animate-pulse' : 'bg-orange-600'
                    )}>
                      {patient.esiLevel}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {patient.patient?.firstName} {patient.patient?.lastName}
                      </h3>
                      {age && (
                        <p className="text-lg text-gray-600">{age} years old</p>
                      )}
                    </div>
                  </div>

                  {/* Time Since Arrival */}
                  <div className="text-right">
                    <div className={clsx(
                      'inline-flex items-center gap-2 px-4 py-3 rounded-xl font-mono text-2xl font-bold',
                      patient.esiLevel === 1 ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'
                    )}>
                      <ClockIcon className="h-6 w-6" />
                      {calculateTimeSinceArrival(patient.arrivalTime)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Time in ED</p>
                  </div>
                </div>

                {/* Chief Complaint */}
                <div className="p-4 bg-white/60 rounded-xl border border-gray-300">
                  <p className="text-sm font-semibold text-gray-600 mb-1">Chief Complaint</p>
                  <p className="text-lg font-bold text-gray-900">{patient.chiefComplaint || 'N/A'}</p>
                </div>

                {/* Vitals */}
                {latestVitals ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-600 mb-3">Latest Vitals</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Heart Rate */}
                      {latestVitals.heartRate && (
                        <div className={clsx(
                          'p-3 rounded-xl border-2 transition-all',
                          getVitalColor(getVitalStatus('hr', latestVitals.heartRate))
                        )}>
                          <p className="text-xs font-medium mb-1">HR</p>
                          <p className="text-2xl font-bold">{latestVitals.heartRate}</p>
                          <p className="text-xs opacity-75">bpm</p>
                        </div>
                      )}

                      {/* SpO2 */}
                      {latestVitals.oxygenSaturation && (
                        <div className={clsx(
                          'p-3 rounded-xl border-2 transition-all',
                          getVitalColor(getVitalStatus('spo2', latestVitals.oxygenSaturation))
                        )}>
                          <p className="text-xs font-medium mb-1">SpO2</p>
                          <p className="text-2xl font-bold">{latestVitals.oxygenSaturation}</p>
                          <p className="text-xs opacity-75">%</p>
                        </div>
                      )}

                      {/* Blood Pressure */}
                      {latestVitals.bloodPressureSys && latestVitals.bloodPressureDia && (
                        <div className={clsx(
                          'p-3 rounded-xl border-2 transition-all',
                          getVitalColor(getVitalStatus('sbp', latestVitals.bloodPressureSys))
                        )}>
                          <p className="text-xs font-medium mb-1">BP</p>
                          <p className="text-2xl font-bold">
                            {latestVitals.bloodPressureSys}/{latestVitals.bloodPressureDia}
                          </p>
                          <p className="text-xs opacity-75">mmHg</p>
                        </div>
                      )}

                      {/* Respiratory Rate */}
                      {latestVitals.respiratoryRate && (
                        <div className={clsx(
                          'p-3 rounded-xl border-2 transition-all',
                          getVitalColor(getVitalStatus('rr', latestVitals.respiratoryRate))
                        )}>
                          <p className="text-xs font-medium mb-1">RR</p>
                          <p className="text-2xl font-bold">{latestVitals.respiratoryRate}</p>
                          <p className="text-xs opacity-75">/min</p>
                        </div>
                      )}

                      {/* Temperature */}
                      {latestVitals.temperature && (
                        <div className={clsx(
                          'p-3 rounded-xl border-2 transition-all',
                          getVitalColor(getVitalStatus('temp', latestVitals.temperature))
                        )}>
                          <p className="text-xs font-medium mb-1">Temp</p>
                          <p className="text-2xl font-bold">{latestVitals.temperature}</p>
                          <p className="text-xs opacity-75">°C</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-300 text-center">
                    <BeakerIcon className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                    <p className="text-sm text-yellow-700 font-medium">No vitals recorded</p>
                  </div>
                )}

                {/* Assigned Doctor */}
                {patient.doctor && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-300">
                    <UserIcon className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-xs font-medium text-blue-600">Assigned Doctor</p>
                      <p className="text-sm font-bold text-blue-900">
                        Dr. {patient.doctor.user.firstName} {patient.doctor.user.lastName}
                      </p>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <span className={clsx(
                      'inline-block px-4 py-2 rounded-lg text-sm font-semibold',
                      patient.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    )}>
                      {patient.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
