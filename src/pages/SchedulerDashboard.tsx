import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Play, Pause, RotateCcw, Activity, AlertTriangle, CheckCircle, Calendar, Database, Settings, Zap, TrendingUp, Users, Download } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SchedulerStatus {
  active_jobs: number;
  jobs_24h: number;
  successful_jobs_24h: number;
  failed_jobs_24h: number;
  games_imported_24h: number;
  recent_jobs: RecentJob[];
  last_updated: string;
}

interface RecentJob {
  job_name: string;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  started_at: string;
  completed_at?: string;
  games_imported: number;
  duration_seconds: number;
}

interface JobConfig {
  name: string;
  description: string;
  cron: string;
  enabled: boolean;
  next_run: string;
  last_run?: string;
}

const SchedulerDashboard: React.FC = () => {
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [jobConfigs, setJobConfigs] = useState<JobConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedulerData();
    
    // Set up real-time updates
    const channel = supabase
      .channel('scheduler-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduler_jobs' }, () => {
        fetchSchedulerData();
      })
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchSchedulerData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchSchedulerData = async () => {
    try {
      setLoading(true);
      
      // Fetch scheduler status
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_scheduler_status');

      if (statusError) {
        throw statusError;
      }

      setSchedulerStatus(statusData);

      // Fetch job configurations (this would come from the scheduler service)
      const mockJobConfigs: JobConfig[] = [
        {
          name: 'nightly-sync',
          description: 'Daily sync of all tracked players from Chess.com and Lichess',
          cron: '15 04 * * *',
          enabled: true,
          next_run: 'Tomorrow at 04:15 UTC',
          last_run: 'Today at 04:15 UTC'
        },
        {
          name: 'weekly-top-players',
          description: 'Weekly comprehensive sync for top-rated players',
          cron: '0 02 * * 0',
          enabled: true,
          next_run: 'Sunday at 02:00 UTC',
          last_run: 'Last Sunday at 02:00 UTC'
        },
        {
          name: 'hourly-priority-sync',
          description: 'Hourly sync for players with recent suspicious activity',
          cron: '0 * * * *',
          enabled: false,
          next_run: 'Disabled',
          last_run: 'Never'
        }
      ];

      setJobConfigs(mockJobConfigs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scheduler data');
    } finally {
      setLoading(false);
    }
  };

  const triggerJob = async (jobName: string) => {
    try {
      setTriggeringJob(jobName);
      
      const response = await fetch(`${supabaseUrl}/functions/v1/scheduler/jobs/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ job_name: jobName })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger job');
      }

      // Refresh data after triggering
      setTimeout(fetchSchedulerData, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger job');
    } finally {
      setTriggeringJob(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 text-blue-600 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'timeout':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link to="/settings" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Scheduler Dashboard</h1>
            <p className="text-gray-600">Loading scheduler status...</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Activity className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
            <p className="text-gray-500">Loading scheduler data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link to="/settings" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Scheduler Dashboard</h1>
          <p className="text-gray-600">Monitor and manage automated chess game imports</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 text-green-600">
            <Activity className="w-4 h-4" />
            <span className="text-sm font-medium">Scheduler Active</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
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

      {/* KPI Cards */}
      {schedulerStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                <Activity className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500">Active Jobs</h3>
              <p className="text-2xl font-bold text-gray-900">{schedulerStatus.active_jobs}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-green-50 text-green-600">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500">Jobs 24h</h3>
              <p className="text-2xl font-bold text-gray-900">{schedulerStatus.jobs_24h}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
              <p className="text-2xl font-bold text-gray-900">
                {schedulerStatus.jobs_24h > 0 
                  ? Math.round((schedulerStatus.successful_jobs_24h / schedulerStatus.jobs_24h) * 100)
                  : 0}%
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-orange-50 text-orange-600">
                <Download className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500">Games 24h</h3>
              <p className="text-2xl font-bold text-gray-900">{schedulerStatus.games_imported_24h || 0}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-lg bg-red-50 text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500">Failed Jobs</h3>
              <p className="text-2xl font-bold text-gray-900">{schedulerStatus.failed_jobs_24h}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Configurations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Scheduled Jobs</h3>
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Configuration</span>
            </div>
          </div>

          <div className="space-y-4">
            {jobConfigs.map((job) => (
              <div key={job.name} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${job.enabled ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <h4 className="font-medium text-gray-900">{job.name}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      job.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {job.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <button
                    onClick={() => triggerJob(job.name)}
                    disabled={triggeringJob === job.name || !job.enabled}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {triggeringJob === job.name ? (
                      <Activity className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    <span>{triggeringJob === job.name ? 'Triggering...' : 'Trigger'}</span>
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-3">{job.description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Schedule:</span>
                    <p className="font-medium font-mono">{job.cron}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Next Run:</span>
                    <p className="font-medium">{job.next_run}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Last Run:</span>
                    <p className="font-medium">{job.last_run || 'Never'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Job Executions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Executions</h3>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Last 24 hours</span>
            </div>
          </div>

          {schedulerStatus?.recent_jobs && schedulerStatus.recent_jobs.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {schedulerStatus.recent_jobs.map((job, index) => (
                <div key={index} className={`p-3 rounded-lg border ${getStatusColor(job.status)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(job.status)}
                      <span className="font-medium">{job.job_name}</span>
                    </div>
                    <span className="text-xs">
                      {new Date(job.started_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <p className="font-medium capitalize">{job.status}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Duration:</span>
                      <p className="font-medium">{formatDuration(job.duration_seconds)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Games:</span>
                      <p className="font-medium">{job.games_imported}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No recent job executions</p>
              <p className="text-sm">Jobs will appear here once they start running</p>
            </div>
          )}
        </div>
      </div>

      {/* YAML Configuration Display */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Scheduler Configuration</h3>
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">bolt.schedule.yaml</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <pre className="text-sm text-gray-700 overflow-x-auto">
{`# FairPlay-Scout Automated Import Scheduler
settings:
  timezone: "UTC"
  max_concurrent_jobs: 3
  retry_attempts: 3

jobs:
  - name: nightly-sync
    cron: "15 04 * * *"          # 04:15 UTC daily
    function: import-games
    enabled: true
    
    targets:
      - query: |
          SELECT username, site FROM sync_cursor
          WHERE total_imported > 0
            AND updated_at > now() - interval '30 days'
    
    config:
      limit: 50
      batch_size: 5
      delay_between_batches: "30s"`}
          </pre>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Automated Scheduling</h4>
              <p className="text-sm text-blue-700 mt-1">
                The scheduler automatically imports games from tracked players using the configuration above. 
                Jobs run based on cron expressions and can be triggered manually for testing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulerDashboard;