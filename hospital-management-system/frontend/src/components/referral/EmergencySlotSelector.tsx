import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { XMarkIcon, ClockIcon, CalendarIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { referralApi } from '../../services/api';

interface Slot {
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface EmergencySlotSelectorProps {
  referralId: string;
  doctorName: string;
  departmentName: string;
  onSelectSlot: (slot: { slotDate: string; startTime: string; endTime: string }) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export default function EmergencySlotSelector({
  referralId,
  doctorName,
  departmentName,
  onSelectSlot,
  onClose,
  isLoading = false,
}: EmergencySlotSelectorProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Fetch available slots
  const { data: slotsData, isLoading: slotsLoading, error } = useQuery({
    queryKey: ['referral-slots', referralId],
    queryFn: async () => {
      const response = await referralApi.getSlots(referralId);
      return response.data.data;
    },
  });

  // Get list of dates with available slots
  const availableDates = useMemo(() => {
    if (!slotsData?.slotsByDate) return [];
    return Object.keys(slotsData.slotsByDate).sort();
  }, [slotsData]);

  // Get slots for selected date
  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate || !slotsData?.slotsByDate) return [];
    return slotsData.slotsByDate[selectedDate] || [];
  }, [selectedDate, slotsData]);

  // Auto-select first date if available
  useMemo(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleConfirm = () => {
    if (selectedSlot) {
      onSelectSlot({
        slotDate: selectedSlot.slotDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              <div>
                <h2 className="text-lg font-semibold text-white">Emergency Appointment</h2>
                <p className="text-red-100 text-sm">Select an available slot for the patient</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Doctor Info */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 font-semibold text-lg">
                  {doctorName.charAt(4).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{doctorName}</h3>
                <p className="text-sm text-gray-600">{departmentName}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[50vh]">
            {slotsLoading ? (
              <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-gray-600">Failed to load available slots</p>
                <p className="text-sm text-gray-500 mt-2">Please try again or close and schedule later.</p>
              </div>
            ) : availableDates.length === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No available slots found</p>
                <p className="text-sm text-gray-500 mt-2">
                  No slots available in the next 48 hours. The receptionist can schedule this referral later.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    <CalendarIcon className="h-4 w-4 inline mr-2" />
                    Select Date
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {availableDates.map((date) => (
                      <button
                        key={date}
                        onClick={() => {
                          setSelectedDate(date);
                          setSelectedSlot(null);
                        }}
                        className={clsx(
                          'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all whitespace-nowrap',
                          selectedDate === date
                            ? 'bg-red-100 border-red-300 text-red-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        {formatDate(date)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <ClockIcon className="h-4 w-4 inline mr-2" />
                      Select Time ({slotsForSelectedDate.length} slots available)
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slotsForSelectedDate.map((slot: Slot) => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          disabled={!slot.isAvailable}
                          className={clsx(
                            'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                            !slot.isAvailable
                              ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                              : selectedSlot?.id === slot.id
                                ? 'bg-red-100 border-red-400 text-red-700'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50'
                          )}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Slot Summary */}
                {selectedSlot && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-800">
                      <span className="font-semibold">Selected Appointment:</span>{' '}
                      {formatDate(selectedSlot.slotDate)} at {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedSlot || isLoading}
              className={clsx(
                'px-6 py-2 rounded-lg font-medium text-white transition-all flex items-center gap-2',
                !selectedSlot || isLoading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              )}
            >
              {isLoading ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Confirm Emergency Appointment'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
