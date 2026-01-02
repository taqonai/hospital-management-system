import { useState, useEffect, useRef } from 'react';
import {
  SpeakerWaveIcon,
  ArrowPathIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface QueueTicket {
  id: string;
  ticketNumber: string;
  tokenDisplay: string;
  patientName: string;
  serviceType: string;
  priority: string;
  queuePosition: number;
  estimatedWaitTime: number;
  status: string;
  issuedAt: string;
  counter?: {
    counterNumber: number;
    counterName: string;
    location?: string;
  };
}

interface QueueDisplay {
  waiting: QueueTicket[];
  serving: QueueTicket[];
  recentCompleted: { ticketNumber: string; tokenDisplay: string; completedAt: string }[];
  lastUpdated: string;
}

interface Announcement {
  id: string;
  ticketNumber: string;
  tokenDisplay?: string;
  counterNumber: number;
  counterName: string;
  patientName: string;
  announcementText: string;
}

export default function QueueDisplayBoard() {
  const [display, setDisplay] = useState<QueueDisplay | null>(null);
  const [, setAnnouncements] = useState<Announcement[]>([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Fetch display data
  const fetchDisplayData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/queue/display`, { headers });
      if (response.ok) {
        const data = await response.json();
        setDisplay(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch display:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch announcements
  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/queue/announcements/pending`, { headers });
      if (response.ok) {
        const data = await response.json();
        const newAnnouncements = data.data || [];
        if (newAnnouncements.length > 0 && soundEnabled) {
          playAnnouncement(newAnnouncements[0]);
        }
        setAnnouncements(newAnnouncements);
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    }
  };

  // Play announcement
  const playAnnouncement = (announcement: Announcement) => {
    setCurrentAnnouncement(announcement);

    // Play bell sound
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }

    // Use text-to-speech
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(announcement.announcementText);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.lang = 'en-US';

      utterance.onend = async () => {
        // Mark as played
        try {
          const token = localStorage.getItem('token');
          await fetch(`${API_URL}/queue/announcements/${announcement.id}/played`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          });
        } catch (error) {
          console.error('Failed to mark announcement as played:', error);
        }

        // Clear current announcement after 5 seconds
        setTimeout(() => {
          setCurrentAnnouncement(null);
        }, 5000);
      };

      speechSynthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Update time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data periodically
  useEffect(() => {
    fetchDisplayData();
    fetchAnnouncements();

    const dataInterval = setInterval(fetchDisplayData, 5000); // Every 5 seconds
    const announcementInterval = setInterval(fetchAnnouncements, 3000); // Every 3 seconds

    return () => {
      clearInterval(dataInterval);
      clearInterval(announcementInterval);
    };
  }, []);

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      EMERGENCY: 'bg-red-600 text-white',
      HIGH: 'bg-orange-500 text-white',
      VIP: 'bg-purple-600 text-white',
      PREGNANT: 'bg-pink-500 text-white',
      DISABLED: 'bg-blue-600 text-white',
      SENIOR_CITIZEN: 'bg-teal-600 text-white',
      CHILD: 'bg-cyan-500 text-white',
      NORMAL: 'bg-gray-600 text-white',
      LOW: 'bg-gray-400 text-white',
    };
    return colors[priority] || 'bg-gray-600 text-white';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl flex items-center gap-3">
          <ArrowPathIcon className="h-8 w-8 animate-spin" />
          Loading Queue Display...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
      {/* Hidden audio for bell sound */}
      <audio ref={audioRef} src="/sounds/bell.mp3" preload="auto" />

      {/* Announcement Banner */}
      {currentAnnouncement && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-6 px-8 shadow-lg animate-pulse">
          <div className="flex items-center justify-center gap-4">
            <SpeakerWaveIcon className="h-10 w-10 animate-bounce" />
            <div className="text-center">
              <p className="text-3xl font-bold">
                Token {currentAnnouncement.tokenDisplay || currentAnnouncement.ticketNumber}
              </p>
              <p className="text-xl mt-1">
                Please proceed to {currentAnnouncement.counterName}
              </p>
            </div>
            <SpeakerWaveIcon className="h-10 w-10 animate-bounce" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-white">Queue Display Board</h1>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={clsx(
              'p-2 rounded-full transition-colors',
              soundEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
            )}
          >
            <SpeakerWaveIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="text-right text-white">
          <p className="text-2xl font-mono">{formatTime(currentTime)}</p>
          <p className="text-sm text-gray-300">{formatDate(currentTime)}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
        {/* Now Serving Section - Left Side */}
        <div className="col-span-7 bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
            Now Serving
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {display?.serving && display.serving.length > 0 ? (
              display.serving.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 shadow-lg transform hover:scale-105 transition-transform"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-5xl font-bold text-white">
                      {ticket.tokenDisplay || ticket.ticketNumber}
                    </span>
                    <span className={clsx('px-3 py-1 rounded-full text-xs font-medium', getPriorityColor(ticket.priority))}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-green-100 text-lg">
                      Counter: <span className="font-bold text-white">{ticket.counter?.counterName || 'N/A'}</span>
                    </p>
                    <p className="text-green-200 text-sm mt-1">
                      {ticket.serviceType}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center text-gray-400 py-12">
                <UserGroupIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-xl">No patients currently being served</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Waiting Queue */}
        <div className="col-span-5 flex flex-col gap-4">
          {/* Waiting Queue */}
          <div className="flex-1 bg-gray-800/50 rounded-2xl p-6 border border-gray-700 overflow-hidden">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <ClockIcon className="h-8 w-8 text-yellow-500" />
              Waiting Queue
              {display?.waiting && (
                <span className="ml-2 bg-yellow-600 text-white px-3 py-1 rounded-full text-sm">
                  {display.waiting.length} waiting
                </span>
              )}
            </h2>

            <div className="space-y-2 max-h-[calc(100%-60px)] overflow-y-auto">
              {display?.waiting && display.waiting.length > 0 ? (
                display.waiting.map((ticket, index) => (
                  <div
                    key={ticket.id}
                    className={clsx(
                      'flex items-center justify-between p-4 rounded-lg transition-all',
                      index === 0
                        ? 'bg-yellow-600/30 border border-yellow-500'
                        : 'bg-gray-700/50 border border-gray-600'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-white w-20">
                        {ticket.tokenDisplay || ticket.ticketNumber}
                      </span>
                      <div>
                        <p className="text-gray-300 text-sm">{ticket.serviceType}</p>
                        <p className="text-gray-400 text-xs">
                          Est. wait: {ticket.estimatedWaitTime} min
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx('px-2 py-1 rounded text-xs font-medium', getPriorityColor(ticket.priority))}>
                        {ticket.priority}
                      </span>
                      <span className="bg-gray-600 text-white px-2 py-1 rounded text-xs">
                        #{ticket.queuePosition}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <p>No patients waiting</p>
                </div>
              )}
            </div>
          </div>

          {/* Recently Completed */}
          <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <XCircleIcon className="h-5 w-5 text-gray-400" />
              Recently Completed
            </h3>
            <div className="flex gap-2 flex-wrap">
              {display?.recentCompleted && display.recentCompleted.length > 0 ? (
                display.recentCompleted.map((ticket, index) => (
                  <span
                    key={index}
                    className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm line-through"
                  >
                    {ticket.tokenDisplay || ticket.ticketNumber}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-sm">No completed tickets yet</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 border-t border-gray-700 py-2 px-4">
        <div className="flex justify-between items-center text-gray-400 text-sm">
          <span>Hospital Queue Management System</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live - Last updated: {display?.lastUpdated ? new Date(display.lastUpdated).toLocaleTimeString() : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}
