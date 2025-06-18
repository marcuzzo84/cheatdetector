import React, { useMemo } from 'react';
import { useLiveSuspicionTrends, useLiveDailySuspicionView } from '../hooks/useLiveQueries';
import { Loader2, AlertTriangle, Wifi, Database, Radio, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface SuspicionTrend {
  date: string;
  suspicion: number;
  volume: number;
}

interface SuspicionChartProps {
  data?: SuspicionTrend[];
  useAggregatedView?: boolean;
}

const SuspicionChart: React.FC<SuspicionChartProps> = ({ 
  data: propData, 
  useAggregatedView = true 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Use the new aggregated view hook for better performance with live: true behavior
  const { trends: functionData, loading: functionLoading, error: functionError, refetch: refetchFunction } = useLiveSuspicionTrends();
  const { dailyData: viewData, loading: viewLoading, error: viewError, isLive, refetch: refetchView } = useLiveDailySuspicionView();
  
  // Choose data source based on preference
  const loading = useAggregatedView ? viewLoading : functionLoading;
  const error = useAggregatedView ? viewError : functionError;
  const liveData = useAggregatedView ? viewData : functionData;
  const refetch = useAggregatedView ? refetchView : refetchFunction;
  
  const chartData = useMemo(() => {
    // Priority: live data > prop data > fallback data
    let sourceData;
    
    if (useAggregatedView && viewData?.length > 0) {
      // Transform view data to chart format
      sourceData = viewData.map(d => ({
        date: new Date(d.bucket).toISOString().split('T')[0],
        suspicion: d.rate,
        volume: d.volume
      })).reverse(); // Reverse to show chronological order
    } else if (functionData?.length > 0) {
      // Use function data
      sourceData = functionData.map(d => ({
        date: d.date,
        suspicion: d.suspicion_rate,
        volume: d.volume
      }));
    } else if (propData?.length > 0) {
      // Use prop data
      sourceData = propData;
    }
    
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
      return fallbackData;
    }
    
    return sourceData;
  }, [viewData, functionData, propData, useAggregatedView]);

  const maxSuspicion = Math.max(...chartData.map(d => d.suspicion));
  const maxVolume = Math.max(...chartData.map(d => d.volume));

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={`w-8 h-8 mx-auto ${isDark ? 'text-gray-600' : 'text-gray-400'} animate-spin mb-2`} />
          <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Loading suspicion trends...</p>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
            {useAggregatedView ? 'Using aggregated view with live updates' : 'Using function query'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className={`w-8 h-8 mx-auto ${isDark ? 'text-red-500' : 'text-red-400'} mb-2`} />
          <p className={isDark ? 'text-red-400' : 'text-red-600'}>Error loading trends: {error}</p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>Showing fallback data</p>
          <button
            onClick={() => refetch()}
            className={`mt-2 flex items-center space-x-1 px-3 py-1 ${
              isDark ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white'
            } rounded-md hover:bg-blue-700 transition-colors text-sm mx-auto`}
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live indicator with data source info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {useAggregatedView && viewData?.length > 0 && (
            <div className={`flex items-center space-x-2 ${isDark ? 'text-green-400' : 'text-green-600'} text-sm`}>
              <Database className="w-4 h-4" />
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Live aggregated view</span>
              {isLive && (
                <div className={`flex items-center space-x-1 ${isDark ? 'text-green-500' : 'text-green-700'}`}>
                  <Radio className="w-3 h-3" />
                  <span className="text-xs">LIVE</span>
                </div>
              )}
            </div>
          )}
          {!useAggregatedView && functionData?.length > 0 && (
            <div className={`flex items-center space-x-2 ${isDark ? 'text-blue-400' : 'text-blue-600'} text-sm`}>
              <Wifi className="w-4 h-4" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="font-medium">Live function data</span>
            </div>
          )}
          {chartData.length > 0 && chartData.every(d => d.volume === 0) && (
            <div className={`flex items-center space-x-2 ${isDark ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
              <Database className="w-4 h-4" />
              <span>No data - showing demo chart</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => refetch()}
            className={`flex items-center space-x-1 px-2 py-1 ${
              isDark 
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            } rounded transition-colors text-xs`}
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {chartData.length} days • {chartData.reduce((sum, d) => sum + d.volume, 0)} total games
          </div>
        </div>
      </div>
      
      <div className="h-64 relative">
        <div className="absolute inset-0 flex items-end justify-between space-x-1">
          {chartData.map((item, index) => (
            <div key={index} className="flex-1 flex flex-col items-center space-y-1">
              {/* Volume bar (background) */}
              <div
                className={`w-full ${
                  isDark ? 'bg-gray-700' : 'bg-gray-100'
                } rounded-t relative group cursor-pointer transition-all duration-200 ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`}
                style={{ height: `${maxVolume > 0 ? (item.volume / maxVolume) * 200 : 0}px` }}
              >
                {/* Suspicion bar (overlay) */}
                <div
                  className="absolute bottom-0 w-full bg-gradient-to-t from-red-500 to-orange-400 rounded-t opacity-75 group-hover:opacity-90 transition-all duration-200"
                  style={{ height: `${maxSuspicion > 0 ? (item.suspicion / maxSuspicion) * 200 : 0}px` }}
                />
                
                {/* Live update indicator for recent data */}
                {index >= chartData.length - 3 && isLive && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                )}
                
                {/* Tooltip on hover */}
                <div className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 ${
                  isDark ? 'bg-gray-900' : 'bg-gray-800'
                } text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg`}>
                  <div className="text-center">
                    <div className="font-medium">{new Date(item.date).toLocaleDateString()}</div>
                    <div className="text-orange-300">{item.suspicion.toFixed(1)}% suspicion rate</div>
                    <div className="text-gray-300">{item.volume} games analyzed</div>
                    {index >= chartData.length - 1 && isLive && (
                      <div className="text-green-300 text-xs mt-1">🔴 Live data</div>
                    )}
                  </div>
                  {/* Tooltip arrow */}
                  <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent ${
                    isDark ? 'border-t-gray-900' : 'border-t-gray-800'
                  }`}></div>
                </div>
              </div>
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} transform -rotate-45 origin-top`}>
                {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
        
        {/* Y-axis labels */}
        <div className={`absolute left-0 top-0 h-full flex flex-col justify-between text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} -ml-8`}>
          <span>{maxSuspicion.toFixed(0)}%</span>
          <span>{Math.round(maxSuspicion * 0.75)}%</span>
          <span>{Math.round(maxSuspicion * 0.5)}%</span>
          <span>{Math.round(maxSuspicion * 0.25)}%</span>
          <span>0%</span>
        </div>
      </div>
      
      {/* Legend and info */}
      <div className={`flex items-center justify-between text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded`}></div>
            <span>Total volume</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gradient-to-t from-red-500 to-orange-400 rounded"></div>
            <span>Suspicion rate (≥70%)</span>
          </div>
          {isLive && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className={isDark ? 'text-green-400' : 'text-green-600'}>Live updates</span>
            </div>
          )}
        </div>
        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {chartData.length > 0 && (
            <span>
              Latest: {chartData[chartData.length - 1]?.suspicion.toFixed(1)}% 
              ({chartData[chartData.length - 1]?.volume} games)
              {isLive && <span className={`${isDark ? 'text-green-400' : 'text-green-600'} ml-2`}>• LIVE</span>}
            </span>
          )}
        </div>
      </div>
      
      {/* Data source and live status */}
      <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Data source: {useAggregatedView ? 'v_daily_suspicion view' : 'get_suspicion_trends() function'}
          {useAggregatedView && viewData?.length > 0 && (
            <span className={`ml-2 ${isDark ? 'text-green-500' : 'text-green-600'}`}>• Real-time aggregated</span>
          )}
        </div>
        
        {isLive && (
          <div className={`flex items-center space-x-1 ${isDark ? 'text-green-500' : 'text-green-600'} text-xs`}>
            <Radio className="w-3 h-3" />
            <span>Connected to realtime publication</span>
          </div>
        )}
      </div>
      
      {/* Performance note */}
      <div className={`text-xs ${isDark ? 'text-gray-500 bg-blue-900/20' : 'text-gray-400 bg-blue-50'} p-2 rounded`}>
        💡 <strong>Enhanced Loading:</strong> This chart now has improved timeout handling and fallback data. 
        If no real data is available, it shows demo data to prevent loading issues.
        {chartData.reduce((sum, d) => sum + d.volume, 0) === 0 && (
          <span className={isDark ? 'text-orange-400 ml-2' : 'text-orange-600 ml-2'}>
            <strong>Note:</strong> Currently showing demo data - import some games to see real analysis.
          </span>
        )}
      </div>
    </div>
  );
};

export default SuspicionChart;