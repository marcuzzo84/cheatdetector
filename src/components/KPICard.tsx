import React from 'react';
import { DivideIcon as LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface KPICardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  color: 'blue' | 'green' | 'orange' | 'purple';
  sparklineData?: number[];
}

const KPICard: React.FC<KPICardProps> = ({ title, value, icon: Icon, trend, color, sparklineData }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const colorClasses = {
    blue: isDark 
      ? 'bg-blue-900/50 text-blue-400 border-blue-800' 
      : 'bg-blue-50 text-blue-600 border-blue-200',
    green: isDark 
      ? 'bg-green-900/50 text-green-400 border-green-800' 
      : 'bg-green-50 text-green-600 border-green-200',
    orange: isDark 
      ? 'bg-orange-900/50 text-orange-400 border-orange-800' 
      : 'bg-orange-50 text-orange-600 border-orange-200',
    purple: isDark 
      ? 'bg-purple-900/50 text-purple-400 border-purple-800' 
      : 'bg-purple-50 text-purple-600 border-purple-200',
  };

  const trendColor = trend && trend > 0 
    ? isDark ? 'text-green-400' : 'text-green-600' 
    : isDark ? 'text-red-400' : 'text-red-600';
  const TrendIcon = trend && trend > 0 ? TrendingUp : TrendingDown;

  // Simple sparkline SVG
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length === 0) return null;
    
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;
    
    const points = sparklineData.map((value, index) => {
      const x = (index / (sparklineData.length - 1)) * 60;
      const y = 20 - ((value - min) / range) * 20;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="60" height="20" className="opacity-60">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={`flex items-center space-x-1 ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3 className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</h3>
        <div className="flex items-end justify-between mt-1">
          <p className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{value}</p>
          {sparklineData && (
            <div className={colorClasses[color].split(' ')[1]}>
              {renderSparkline()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KPICard;