import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

interface TimelineStep {
  key: string;
  label: string;
  timestamp?: string | null;
  completed: boolean;
  current: boolean;
}

interface BookingStatusTimelineProps {
  status: string;
  checkedInAt: string | null;
  vitalsRecordedAt: string | null;
  consultationStarted: boolean;
  className?: string;
}

export function BookingStatusTimeline({
  status,
  checkedInAt,
  vitalsRecordedAt,
  consultationStarted,
  className,
}: BookingStatusTimelineProps) {
  const steps: TimelineStep[] = [
    {
      key: 'scheduled',
      label: 'Scheduled',
      completed: true,
      current: status === 'SCHEDULED' || status === 'CONFIRMED',
    },
    {
      key: 'checked_in',
      label: 'Checked In',
      timestamp: checkedInAt,
      completed: !!checkedInAt,
      current: status === 'CHECKED_IN' && !vitalsRecordedAt,
    },
    {
      key: 'vitals',
      label: 'Vitals',
      timestamp: vitalsRecordedAt,
      completed: !!vitalsRecordedAt,
      current: !!vitalsRecordedAt && !consultationStarted,
    },
    {
      key: 'consultation',
      label: 'Consultation',
      completed: consultationStarted || status === 'COMPLETED',
      current: status === 'IN_PROGRESS',
    },
    {
      key: 'completed',
      label: 'Completed',
      completed: status === 'COMPLETED',
      current: status === 'COMPLETED',
    },
  ];

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  step.completed
                    ? 'bg-green-500 text-white'
                    : step.current
                    ? 'bg-blue-500 text-white animate-pulse'
                    : 'bg-gray-200 text-gray-400'
                )}
              >
                {step.completed ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : step.current ? (
                  <ClockIcon className="w-5 h-5" />
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>
              <span
                className={clsx(
                  'mt-1 text-xs font-medium',
                  step.completed
                    ? 'text-green-600'
                    : step.current
                    ? 'text-blue-600'
                    : 'text-gray-400'
                )}
              >
                {step.label}
              </span>
              {step.timestamp && (
                <span className="text-[10px] text-gray-400">
                  {new Date(step.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={clsx(
                  'flex-1 h-0.5 mx-2',
                  steps[index + 1].completed || steps[index + 1].current
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BookingStatusTimeline;
