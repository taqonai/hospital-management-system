interface ChartSkeletonProps {
  height?: string;
  type?: 'line' | 'bar' | 'doughnut' | 'default';
}

export default function ChartSkeleton({ height = 'h-80', type = 'default' }: ChartSkeletonProps) {
  if (type === 'doughnut') {
    return (
      <div className={`${height} flex items-center justify-center animate-pulse`}>
        <div className="relative">
          <div className="w-48 h-48 rounded-full bg-gray-200" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-28 h-28 rounded-full bg-white" />
          </div>
        </div>
        <div className="ml-8 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-200" />
            <div className="w-20 h-3 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-200" />
            <div className="w-16 h-3 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-200" />
            <div className="w-24 h-3 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'bar') {
    return (
      <div className={`${height} flex items-end justify-center gap-3 px-4 pb-8 animate-pulse`}>
        {[65, 85, 45, 95, 70, 55, 80].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200 rounded-t-lg transition-all"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    );
  }

  if (type === 'line') {
    return (
      <div className={`${height} flex flex-col justify-center px-4 animate-pulse`}>
        <svg className="w-full h-3/4" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path
            d="M 0 150 Q 50 100, 100 120 T 200 80 T 300 100 T 400 60"
            fill="none"
            stroke="rgb(229, 231, 235)"
            strokeWidth="3"
          />
          <path
            d="M 0 150 Q 50 100, 100 120 T 200 80 T 300 100 T 400 60 V 200 H 0 Z"
            fill="rgba(229, 231, 235, 0.3)"
          />
        </svg>
        <div className="flex justify-between mt-4">
          {Array(7)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="w-8 h-3 bg-gray-200 rounded" />
            ))}
        </div>
      </div>
    );
  }

  // Default skeleton
  return (
    <div className={`${height} flex flex-col items-center justify-center animate-pulse`}>
      <div className="w-full max-w-md">
        <div className="flex justify-between items-end gap-2 mb-4">
          {[40, 60, 35, 80, 55, 70, 45].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-gray-200 rounded"
              style={{ height: `${h * 2}px` }}
            />
          ))}
        </div>
        <div className="flex justify-between">
          {Array(7)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="w-6 h-2 bg-gray-200 rounded" />
            ))}
        </div>
      </div>
    </div>
  );
}
