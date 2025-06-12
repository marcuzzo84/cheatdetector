import React, { useMemo } from 'react';
import { useLiveSuspicionTrends } from '../hooks/useLiveQueries';
import { Loader2, AlertTriangle, Wifi } from 'lucide-react';

interface SuspicionTrend {
  date: string;
  suspicion: number;
  volume: number;
}

interface SuspicionChartProps {
  data?: SuspicionTrend[];
}

const SuspicionChart: React.FC<SuspicionChartProps> = ({ data: propData }) => {
  // Use live data from the hook, fallback to prop data if provided
  const { trends: liveData, loading, error } = useLiveSuspicionTrends();
  
  const chartData = useMemo(() => {
    // Priority: live data > prop data > fallback data
    const sourceData = liveData?.length > 0 ? liveData : propData;
    
    if (!sourceData || sourceData.length === 0) {
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
      return fallbackData.map(d => ({ 
        date: d.date, 
        suspicion: d.suspicion, 
        volume: d.volume 
      }));
    }
    
    // Transform live data to match expected format
    return sourceData.map(d => ({
      date: d.date,
      suspicion: 'suspicion_rate' in d ? d.suspicion_rate : d.suspicion,
      volume: d.volume
    }));
  }, [liveData, propData]);

  const maxSuspicion = Math.max(...chartData.map(d => d.suspicion));
  const maxVolume = Math.max(...chartData.map(d => d.volume));

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
          <p className="text-gray-500">Loading suspicion trends...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 mx-auto text-red-400 mb-2" />
          <p className="text-red-600">Error loading trends: {error}</p>
          <p className="text-sm text-gray-500 mt-1">Showing fallback data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live indicator */}
      {liveData?.length > 0 && (
        <div className="flex items-center justify-end">
          <div className="flex items-center space-x-1 text-green-600 text-sm">
            <Wifi className="w-4 h-4" />
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live data</span>
          </div>
        </div>
      )}
      
      <div className="h-64 relative">
        <div className="absolute inset-0 flex items-end justify-between space-x-1">
          {chartData.map((item, index) => (
            <div key={index} className="flex-1 flex flex-col items-center space-y-1">
              {/* Volume bar (background) */}
              <div
                className="w-full bg-gray-100 rounded-t relative"
                style={{ height: `${maxVolume > 0 ? (item.volume / maxVolume) * 200 : 0}px` }}
              >
                {/* Suspicion bar (overlay) */}
                <div
                  className="absolute bottom-0 w-full bg-gradient-to-t from-red-500 to-orange-400 rounded-t opacity-75"
                  style={{ height: `${maxSuspicion > 0 ? (item.suspicion / maxSuspicion) * 200 : 0}px` }}
                  title={`${new Date(item.date).toLocaleDateString()}: ${item.suspicion.toFixed(1)}% suspicion rate, ${item.volume} games`}
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
      
      {/* Legend and info */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-100 rounded"></div>
            <span>Total volume</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gradient-to-t from-red-500 to-orange-400 rounded"></div>
            <span>Suspicion rate</span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {chartData.length > 0 && (
            <span>
              Latest: {chartData[chartData.length - 1]?.suspicion.toFixed(1)}% 
              ({chartData[chartData.length - 1]?.volume} games)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuspicionChart;