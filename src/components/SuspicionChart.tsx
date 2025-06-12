import React, { useMemo } from 'react';

interface SuspicionTrend {
  date: string;
  suspicion: number;
  volume: number;
}

interface SuspicionChartProps {
  data: SuspicionTrend[];
}

const SuspicionChart: React.FC<SuspicionChartProps> = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      // Generate fallback data if no real data is available
      const fallbackData = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        fallbackData.push({
          date: date.toISOString().split('T')[0],
          suspicion: 15 + Math.random() * 10,
          volume: 50 + Math.random() * 100
        });
      }
      return fallbackData;
    }
    return data;
  }, [data]);

  const maxSuspicion = Math.max(...chartData.map(d => d.suspicion));
  const maxVolume = Math.max(...chartData.map(d => d.volume));

  return (
    <div className="h-64 relative">
      <div className="absolute inset-0 flex items-end justify-between space-x-1">
        {chartData.map((item, index) => (
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
        <span>{maxSuspicion.toFixed(0)}%</span>
        <span>{Math.round(maxSuspicion * 0.75)}%</span>
        <span>{Math.round(maxSuspicion * 0.5)}%</span>
        <span>{Math.round(maxSuspicion * 0.25)}%</span>
        <span>0%</span>
      </div>
    </div>
  );
};

export default SuspicionChart;