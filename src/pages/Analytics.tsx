import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, PieChart, Activity, Calendar, Users, Target, Zap, AlertTriangle, CheckCircle, Download, RefreshCw, Filter, Eye, ExternalLink } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface AnalyticsData {
  totalGames: number;
  totalPlayers: number;
  suspiciousGames: number;
  cleanGames: number;
  avgSuspicionRate: number;
  topSuspiciousPlayers: Array<{
    hash: string;
    suspicion_level: number;
    games_count: number;
    site: string;
  }>;
  suspicionByTimeOfDay: Array<{
    hour: number;
    suspicion_rate: number;
    game_count: number;
  }>;
  suspicionBySite: Array<{
    site: string;
    suspicion_rate: number;
    game_count: number;
  }>;
  weeklyTrends: Array<{
    week: string;
    suspicion_rate: number;
    game_count: number;
  }>;
  engineMatchDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
}

const Analytics: React.FC = () => {
  const { userProfile, isAdmin } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('suspicion');

  // Check if user has premium access
  const hasPremiumAccess = isAdmin || userProfile?.role === 'premium' || userProfile?.role === 'pro';

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      startDate.setDate(endDate.getDate() - days);

      // Fetch basic statistics
      const { data: gamesData, error: gamesError } = await supabase
        .from('scores')
        .select(`
          suspicion_level,
          match_engine_pct,
          created_at,
          games!inner (
            site,
            players!inner (
              hash
            )
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (gamesError) {
        throw new Error(`Failed to fetch games data: ${gamesError.message}`);
      }

      if (!gamesData || gamesData.length === 0) {
        // Return empty analytics data
        setAnalyticsData({
          totalGames: 0,
          totalPlayers: 0,
          suspiciousGames: 0,
          cleanGames: 0,
          avgSuspicionRate: 0,
          topSuspiciousPlayers: [],
          suspicionByTimeOfDay: generateEmptyHourlyData(),
          suspicionBySite: [],
          weeklyTrends: [],
          engineMatchDistribution: []
        });
        setLoading(false);
        return;
      }

      // Process the data
      const totalGames = gamesData.length;
      const uniquePlayers = new Set(gamesData.map(g => g.games.players.hash)).size;
      const suspiciousGames = gamesData.filter(g => g.suspicion_level >= 70).length;
      const cleanGames = totalGames - suspiciousGames;
      const avgSuspicionRate = gamesData.reduce((sum, g) => sum + g.suspicion_level, 0) / totalGames;

      // Top suspicious players
      const playerSuspicion = new Map();
      gamesData.forEach(game => {
        const hash = game.games.players.hash;
        const site = game.games.site;
        if (!playerSuspicion.has(hash)) {
          playerSuspicion.set(hash, {
            hash,
            site,
            suspicion_levels: [],
            games_count: 0
          });
        }
        const player = playerSuspicion.get(hash);
        player.suspicion_levels.push(game.suspicion_level);
        player.games_count++;
      });

      const topSuspiciousPlayers = Array.from(playerSuspicion.values())
        .map(player => ({
          ...player,
          suspicion_level: player.suspicion_levels.reduce((a, b) => a + b, 0) / player.suspicion_levels.length
        }))
        .sort((a, b) => b.suspicion_level - a.suspicion_level)
        .slice(0, 10);

      // Suspicion by time of day
      const hourlyData = new Array(24).fill(0).map((_, hour) => ({
        hour,
        suspicion_levels: [],
        game_count: 0
      }));

      gamesData.forEach(game => {
        const hour = new Date(game.created_at).getHours();
        hourlyData[hour].suspicion_levels.push(game.suspicion_level);
        hourlyData[hour].game_count++;
      });

      const suspicionByTimeOfDay = hourlyData.map(data => ({
        hour: data.hour,
        suspicion_rate: data.suspicion_levels.length > 0 
          ? data.suspicion_levels.reduce((a, b) => a + b, 0) / data.suspicion_levels.length 
          : 0,
        game_count: data.game_count
      }));

      // Suspicion by site
      const siteData = new Map();
      gamesData.forEach(game => {
        const site = game.games.site;
        if (!siteData.has(site)) {
          siteData.set(site, { suspicion_levels: [], game_count: 0 });
        }
        const data = siteData.get(site);
        data.suspicion_levels.push(game.suspicion_level);
        data.game_count++;
      });

      const suspicionBySite = Array.from(siteData.entries()).map(([site, data]) => ({
        site,
        suspicion_rate: data.suspicion_levels.reduce((a, b) => a + b, 0) / data.suspicion_levels.length,
        game_count: data.game_count
      }));

      // Weekly trends (simplified for demo)
      const weeklyTrends = [];
      for (let i = 0; i < Math.min(days / 7, 4); i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const weekGames = gamesData.filter(g => {
          const gameDate = new Date(g.created_at);
          return gameDate >= weekStart && gameDate < weekEnd;
        });

        if (weekGames.length > 0) {
          weeklyTrends.push({
            week: `Week ${i + 1}`,
            suspicion_rate: weekGames.reduce((sum, g) => sum + g.suspicion_level, 0) / weekGames.length,
            game_count: weekGames.length
          });
        }
      }

      // Engine match distribution
      const engineRanges = [
        { min: 0, max: 60, label: '0-60%' },
        { min: 60, max: 70, label: '60-70%' },
        { min: 70, max: 80, label: '70-80%' },
        { min: 80, max: 90, label: '80-90%' },
        { min: 90, max: 100, label: '90-100%' }
      ];

      const engineMatchDistribution = engineRanges.map(range => {
        const count = gamesData.filter(g => 
          g.match_engine_pct >= range.min && g.match_engine_pct < range.max
        ).length;
        return {
          range: range.label,
          count,
          percentage: totalGames > 0 ? (count / totalGames) * 100 : 0
        };
      });

      setAnalyticsData({
        totalGames,
        totalPlayers: uniquePlayers,
        suspiciousGames,
        cleanGames,
        avgSuspicionRate,
        topSuspiciousPlayers,
        suspicionByTimeOfDay,
        suspicionBySite,
        weeklyTrends,
        engineMatchDistribution
      });

    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateEmptyHourlyData = () => {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      suspicion_rate: 0,
      game_count: 0
    }));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const renderTimeOfDayChart = () => {
    if (!analyticsData) return null;

    const maxRate = Math.max(...analyticsData.suspicionByTimeOfDay.map(d => d.suspicion_rate));
    const maxCount = Math.max(...analyticsData.suspicionByTimeOfDay.map(d => d.game_count));

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Suspicion Rate by Hour</h4>
          <div className="text-sm text-gray-500">24-hour format</div>
        </div>
        <div className="h-64 flex items-end justify-between space-x-1">
          {analyticsData.suspicionByTimeOfDay.map((data, index) => (
            <div key={index} className="flex-1 flex flex-col items-center space-y-1">
              <div
                className="w-full bg-gradient-to-t from-red-500 to-orange-400 rounded-t opacity-75 hover:opacity-90 transition-opacity cursor-pointer relative group"
                style={{ 
                  height: `${maxRate > 0 ? (data.suspicion_rate / maxRate) * 200 : 0}px`,
                  minHeight: data.game_count > 0 ? '4px' : '0px'
                }}
                title={`${data.hour}:00 - ${data.suspicion_rate.toFixed(1)}% avg suspicion, ${data.game_count} games`}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {data.hour}:00<br />
                  {data.suspicion_rate.toFixed(1)}%<br />
                  {data.game_count} games
                </div>
              </div>
              <span className="text-xs text-gray-500 transform -rotate-45 origin-top">
                {data.hour}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEngineMatchDistribution = () => {
    if (!analyticsData) return null;

    return (
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Engine Match Distribution</h4>
        <div className="space-y-3">
          {analyticsData.engineMatchDistribution.map((data, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-20 text-sm text-gray-600">{data.range}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${data.percentage}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                  {data.count > 0 && `${data.count} (${data.percentage.toFixed(1)}%)`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600">Loading advanced analytics and insights...</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <BarChart3 className="w-8 h-8 mx-auto text-gray-400 animate-pulse mb-2" />
            <p className="text-gray-500">Loading analytics data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link to="/dashboard" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Advanced insights and reporting for chess game analysis</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Premium Access Banner */}
      {!hasPremiumAccess && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <BarChart3 className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-purple-900">Advanced Analytics</h4>
              <p className="text-sm text-purple-700 mt-1">
                You're viewing basic analytics. Upgrade to <strong>Premium</strong> or <strong>Pro</strong> to unlock advanced reporting, custom date ranges, and detailed player insights.
              </p>
              <button className="mt-2 inline-flex items-center px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm">
                <Zap className="w-3 h-3 mr-1" />
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {analyticsData && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                  <Activity className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.totalGames.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Total Games</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-green-50 text-green-600">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.totalPlayers.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Unique Players</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-red-50 text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.suspiciousGames.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Suspicious Games</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                  <Target className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{analyticsData.avgSuspicionRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-500">Avg Suspicion</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Time of Day Analysis */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {renderTimeOfDayChart()}
            </div>

            {/* Engine Match Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {renderEngineMatchDistribution()}
            </div>
          </div>

          {/* Site Comparison */}
          {analyticsData.suspicionBySite.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analyticsData.suspicionBySite.map((site, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">{site.site}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        site.site === 'Chess.com' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {site.game_count} games
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Avg Suspicion Rate</span>
                        <span className="font-medium">{site.suspicion_rate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            site.suspicion_rate >= 30 ? 'bg-red-500' : 
                            site.suspicion_rate >= 20 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(site.suspicion_rate * 2, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Suspicious Players */}
          {analyticsData.topSuspiciousPlayers.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Top Suspicious Players</h3>
                <div className="text-sm text-gray-500">Highest average suspicion rates</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Player Hash
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Site
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Suspicion
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Games
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyticsData.topSuspiciousPlayers.map((player, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 font-mono">
                            {player.hash.substring(0, 16)}...
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            player.site === 'Chess.com' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {player.site}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div className="w-full bg-gray-200 rounded-full h-2 w-16">
                              <div 
                                className="h-2 rounded-full bg-red-500"
                                style={{ width: `${player.suspicion_level}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-900 min-w-8 font-bold text-red-600">
                              {player.suspicion_level.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {player.games_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Link
                              to={`/players/${player.hash}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <a
                              href={`https://www.chess.com/member/${player.hash.substring(0, 8)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Weekly Trends */}
          {analyticsData.weeklyTrends.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Trends</h3>
              <div className="h-64 flex items-end justify-between space-x-4">
                {analyticsData.weeklyTrends.map((week, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center space-y-2">
                    <div className="text-sm text-gray-600">{week.week}</div>
                    <div className="w-full bg-gray-100 rounded-t relative group cursor-pointer h-48">
                      {/* Game count bar (background) */}
                      <div 
                        className="absolute bottom-0 w-full bg-blue-200 rounded-t"
                        style={{ 
                          height: `${Math.min((week.game_count / Math.max(...analyticsData.weeklyTrends.map(w => w.game_count))) * 100, 100)}%` 
                        }}
                      />
                      {/* Suspicion rate bar (overlay) */}
                      <div 
                        className="absolute bottom-0 w-full bg-gradient-to-t from-red-500 to-orange-400 rounded-t opacity-75 group-hover:opacity-90 transition-all"
                        style={{ 
                          height: `${Math.min((week.suspicion_rate / 100) * 100, 100)}%` 
                        }}
                      />
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        <div className="text-center">
                          <div className="font-medium">{week.week}</div>
                          <div className="text-orange-300">{week.suspicion_rate.toFixed(1)}% suspicion rate</div>
                          <div className="text-blue-300">{week.game_count} games analyzed</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-900">{week.suspicion_rate.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-200 rounded"></div>
                  <span>Game volume</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gradient-to-t from-red-500 to-orange-400 rounded"></div>
                  <span>Suspicion rate</span>
                </div>
              </div>
            </div>
          )}

          {/* Export Options */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Export Analytics</h3>
              <div className="text-sm text-gray-500">Download reports for offline analysis</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export as CSV</span>
              </button>
              <button className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export as Excel</span>
              </button>
              <button className="flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <Download className="w-4 h-4" />
                <span>Export as PDF</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* No Data State */}
      {analyticsData && analyticsData.totalGames === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data Available</h3>
          <p className="text-gray-600 mb-6">
            Import some chess games to start seeing analytics and insights.
          </p>
          <Link
            to="/import"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Import Games</span>
          </Link>
        </div>
      )}
    </div>
  );
};

export default Analytics;