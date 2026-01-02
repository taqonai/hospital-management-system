import { useState, useEffect } from 'react';
import {
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  SpeakerWaveIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface TicketStatus {
  id: string;
  ticketNumber: string;
  tokenDisplay: string;
  patientName: string;
  serviceType: string;
  priority: string;
  status: string;
  queuePosition: number;
  estimatedWaitTime: number;
  issuedAt: string;
  calledAt?: string;
  waitingSince: number;
  counter?: {
    counterNumber: number;
    counterName: string;
    location?: string;
  };
}

export default function PatientQueueStatus() {
  const [ticketId, setTicketId] = useState('');
  const [phone, setPhone] = useState('');
  const [searchType, setSearchType] = useState<'ticket' | 'phone'>('ticket');
  const [ticket, setTicket] = useState<TicketStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Get hospital ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const hospitalId = urlParams.get('hospitalId') || 'default';

  const fetchTicketStatus = async () => {
    if (searchType === 'ticket' && !ticketId.trim()) {
      setError('Please enter your ticket ID');
      return;
    }
    if (searchType === 'phone' && !phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (searchType === 'ticket') {
        params.set('ticketId', ticketId.trim());
      } else {
        params.set('phone', phone.trim());
      }

      const response = await fetch(
        `${API_URL}/queue/public/ticket-status/${hospitalId}?${params}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.ok) {
        const data = await response.json();
        setTicket(data.data);
        if (data.data.status === 'WAITING' || data.data.status === 'CALLED') {
          setAutoRefresh(true);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Ticket not found');
        setTicket(null);
      }
    } catch (err) {
      setError('Failed to fetch ticket status');
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh when ticket is in waiting/called status
  useEffect(() => {
    if (!autoRefresh || !ticket) return;

    const interval = setInterval(() => {
      fetchTicketStatus();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, ticket]);

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bgColor: string; icon: React.ComponentType<any>; label: string }> = {
      WAITING: {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        icon: ClockIcon,
        label: 'Waiting',
      },
      CALLED: {
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        icon: SpeakerWaveIcon,
        label: 'Called! Please proceed to counter',
      },
      SERVING: {
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: CheckCircleIcon,
        label: 'Being Served',
      },
      COMPLETED: {
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        icon: CheckCircleIcon,
        label: 'Completed',
      },
      NO_SHOW: {
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        icon: XCircleIcon,
        label: 'No Show',
      },
      CANCELLED: {
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        icon: XCircleIcon,
        label: 'Cancelled',
      },
    };
    return configs[status] || configs.WAITING;
  };

  const formatServiceType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <TicketIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Check Your Queue Status</h1>
          <p className="text-gray-600 mt-2">Enter your ticket ID or phone number to check your position</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          {/* Search Type Toggle */}
          <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
            <button
              onClick={() => setSearchType('ticket')}
              className={clsx(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                searchType === 'ticket'
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Ticket ID
            </button>
            <button
              onClick={() => setSearchType('phone')}
              className={clsx(
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                searchType === 'phone'
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Phone Number
            </button>
          </div>

          {/* Input Field */}
          <div className="relative mb-4">
            {searchType === 'ticket' ? (
              <input
                type="text"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value.toUpperCase())}
                placeholder="Enter Ticket ID (e.g., C-001)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              />
            ) : (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter Phone Number"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              />
            )}
          </div>

          <button
            onClick={fetchTicketStatus}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="h-5 w-5" />
                Check Status
              </>
            )}
          </button>

          {error && (
            <p className="mt-4 text-center text-red-600 text-sm">{error}</p>
          )}
        </div>

        {/* Ticket Status Display */}
        {ticket && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Status Header */}
            {(() => {
              const config = getStatusConfig(ticket.status);
              const StatusIcon = config.icon;
              return (
                <div className={clsx('p-6 text-center', config.bgColor)}>
                  <StatusIcon className={clsx('h-12 w-12 mx-auto mb-2', config.color)} />
                  <p className={clsx('text-lg font-bold', config.color)}>{config.label}</p>
                </div>
              );
            })()}

            {/* Ticket Info */}
            <div className="p-6">
              <div className="text-center mb-6">
                <p className="text-gray-500 text-sm mb-1">Your Token Number</p>
                <p className="text-5xl font-bold text-gray-900">
                  {ticket.tokenDisplay || ticket.ticketNumber}
                </p>
              </div>

              <div className="space-y-4">
                {/* Queue Position */}
                {(ticket.status === 'WAITING' || ticket.status === 'CALLED') && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold">#</span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Position in Queue</p>
                        <p className="text-xl font-bold text-gray-900">{ticket.queuePosition}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Estimated Wait Time */}
                {ticket.status === 'WAITING' && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        <ClockIcon className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Estimated Wait</p>
                        <p className="text-xl font-bold text-gray-900">~{ticket.estimatedWaitTime} min</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Counter Info (when called) */}
                {(ticket.status === 'CALLED' || ticket.status === 'SERVING') && ticket.counter && (
                  <div className="p-4 bg-green-50 border-2 border-green-500 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <MapPinIcon className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-green-600">Please proceed to</p>
                        <p className="text-xl font-bold text-green-700">{ticket.counter.counterName}</p>
                        {ticket.counter.location && (
                          <p className="text-sm text-green-600">{ticket.counter.location}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Service Info */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm text-gray-500">Service</p>
                    <p className="font-medium text-gray-900">{formatServiceType(ticket.serviceType)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Waiting Since</p>
                    <p className="font-medium text-gray-900">{ticket.waitingSince} min</p>
                  </div>
                </div>
              </div>

              {/* Auto-refresh indicator */}
              {autoRefresh && (ticket.status === 'WAITING' || ticket.status === 'CALLED') && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Auto-refreshing every 10 seconds
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 text-center text-gray-600 text-sm">
          <p>Keep this page open to receive real-time updates</p>
          <p className="mt-1">You will be notified when your turn comes</p>
        </div>
      </div>
    </div>
  );
}
