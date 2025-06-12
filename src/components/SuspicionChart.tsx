import React from 'react';

interface SuspicionTrend {
  date: string;
  suspicion: number;
  volume: number;
}

interface SuspicionChartProps {
  data: SuspicionTrend[];
}

const SuspicionChart: React.FC<SuspicionChartProps> = ({ data }) => {
  const maxSuspicion = Math.max(...data.map(d => d.suspicion));
  const maxVolume = Math.max(...data.map(d => d.volume));

  return (
    <div className="h-64 relative">
      <div className="absolute inset-0 flex items-end justify-between space-x-1">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center space-y-1">
            {/* Volume bar (background) */}
            <div
              className="w-full bg-gray-100 rounded-t relative"
              style={{ height: `${(item.volume / maxVolume) * 200}px` }}
            >
              {/* Suspicion bar (overlay) */}
              <div
                className="absolute bottom-0 w-full bg-gradient-to-t from-red-500 to-orange-400 rounded-t opacity-75"
                style={{ height: `${(item.suspicion / maxSuspicion) * 200}px` }}
              />
            </div>
            <span className="text-xs text-gray-500 transform -rotate-45 origin-top">
              {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
      
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8">
        <span>{maxSuspicion}%</span>
        <span>{Math.round(maxSuspicion * 0.75)}%</span>
        <span>{Math.round(maxSuspicion * 0.5)}%</span>
        <span>{Math.round(maxSuspicion * 0.25)}%</span>
        <span>0%</span>
      </div>
    </div>
  );
};

export default SuspicionChart;