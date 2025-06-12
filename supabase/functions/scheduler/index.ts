import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cron } from 'https://deno.land/x/deno_cron@v1.0.0/cron.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface SchedulerConfig {
  settings: {
    timezone: string
    max_concurrent_jobs: number
    retry_attempts: number
    retry_delay: string
    notification_webhook?: string
  }
  jobs: ScheduledJob[]
  maintenance: MaintenanceJob[]
  monitoring: MonitoringConfig
  environments?: { [key: string]: any }
}

interface ScheduledJob {
  name: string
  description: string
  cron: string
  function: string
  enabled: boolean
  timeout: string
  targets: JobTarget[]
  config: JobConfig
  on_error?: ErrorHandling
  notifications?: NotificationConfig
}

interface JobTarget {
  username?: string
  site?: string
  normalized_site?: string
  query?: string
}

interface JobConfig {
  limit: number
  resumable: boolean
  batch_size: number
  delay_between_batches: string
}

interface ErrorHandling {
  action: 'continue' | 'stop' | 'retry'
  max_failures_per_batch: number
}

interface NotificationConfig {
  on_start: boolean
  on_complete: boolean
  on_error: boolean
}

interface MaintenanceJob {
  name: string
  description: string
  cron: string
  function: string
  enabled: boolean
  config: any
}

interface MonitoringConfig {
  health_check: {
    endpoint: string
    interval: string
  }
  metrics: MetricConfig[]
  alerts: AlertConfig[]
}

interface MetricConfig {
  name: string
  type: 'counter' | 'histogram' | 'gauge'
}

interface AlertConfig {
  name: string
  condition: string
  severity: 'info' | 'warning' | 'critical'
  action?: string
}

interface JobExecution {
  id: string
  job_name: string
  status: 'running' | 'completed' | 'failed' | 'timeout'
  started_at: string
  completed_at?: string
  targets_processed: number
  targets_total: number
  games_imported: number
  errors: string[]
  metadata: any
}

// Global state for job executions
const activeJobs = new Map<string, JobExecution>()
const jobHistory: JobExecution[] = []

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Route handling
    if (path === '/scheduler/health') {
      return handleHealthCheck()
    } else if (path === '/scheduler/status') {
      return handleStatus()
    } else if (path === '/scheduler/jobs') {
      return handleJobsList()
    } else if (path === '/scheduler/jobs/trigger' && req.method === 'POST') {
      return await handleTriggerJob(req, supabaseClient)
    } else if (path === '/scheduler/config' && req.method === 'GET') {
      return handleGetConfig()
    } else if (path === '/scheduler/metrics') {
      return handleMetrics()
    } else {
      return new Response('Not Found', { status: 404, headers: corsHeaders })
    }

  } catch (error) {
    console.error('Scheduler error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Health check endpoint
function handleHealthCheck(): Response {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    active_jobs: activeJobs.size,
    uptime: Deno.env.get('DENO_DEPLOYMENT_ID') || 'unknown',
    version: '1.0.0'
  }

  return new Response(
    JSON.stringify(health),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

// Status endpoint
function handleStatus(): Response {
  const status = {
    active_jobs: Array.from(activeJobs.values()),
    recent_jobs: jobHistory.slice(-10),
    system_info: {
      memory_usage: Deno.memoryUsage(),
      platform: Deno.build.os,
      arch: Deno.build.arch
    }
  }

  return new Response(
    JSON.stringify(status),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

// Jobs list endpoint
function handleJobsList(): Response {
  const config = loadSchedulerConfig()
  const jobs = config.jobs.map(job => ({
    name: job.name,
    description: job.description,
    cron: job.cron,
    enabled: job.enabled,
    next_run: calculateNextRun(job.cron),
    last_run: getLastRun(job.name)
  }))

  return new Response(
    JSON.stringify({ jobs }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

// Trigger job manually
async function handleTriggerJob(req: Request, supabase: any): Promise<Response> {
  const { job_name } = await req.json()
  
  if (!job_name) {
    return new Response(
      JSON.stringify({ error: 'job_name is required' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  const config = loadSchedulerConfig()
  const job = config.jobs.find(j => j.name === job_name)
  
  if (!job) {
    return new Response(
      JSON.stringify({ error: 'Job not found' }),
      { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  // Execute job asynchronously
  executeJob(job, supabase).catch(error => {
    console.error(`Error executing job ${job_name}:`, error)
  })

  return new Response(
    JSON.stringify({ message: `Job ${job_name} triggered successfully` }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

// Get configuration
function handleGetConfig(): Response {
  const config = loadSchedulerConfig()
  
  return new Response(
    JSON.stringify(config),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

// Metrics endpoint
function handleMetrics(): Response {
  const metrics = {
    jobs_completed: jobHistory.filter(j => j.status === 'completed').length,
    jobs_failed: jobHistory.filter(j => j.status === 'failed').length,
    jobs_timeout: jobHistory.filter(j => j.status === 'timeout').length,
    games_imported_total: jobHistory.reduce((sum, j) => sum + j.games_imported, 0),
    average_job_duration: calculateAverageJobDuration(),
    active_jobs_count: activeJobs.size
  }

  return new Response(
    JSON.stringify(metrics),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

// Load scheduler configuration (in production, this would come from a config service)
function loadSchedulerConfig(): SchedulerConfig {
  // This would typically load from a configuration service or file
  // For now, we'll return a basic configuration
  return {
    settings: {
      timezone: 'UTC',
      max_concurrent_jobs: 3,
      retry_attempts: 3,
      retry_delay: '5m'
    },
    jobs: [
      {
        name: 'nightly-sync',
        description: 'Daily sync of all tracked players',
        cron: '15 04 * * *',
        function: 'import-games',
        enabled: true,
        timeout: '2h',
        targets: [],
        config: {
          limit: 50,
          resumable: true,
          batch_size: 5,
          delay_between_batches: '30s'
        },
        notifications: {
          on_start: true,
          on_complete: true,
          on_error: true
        }
      }
    ],
    maintenance: [],
    monitoring: {
      health_check: {
        endpoint: '/scheduler/health',
        interval: '5m'
      },
      metrics: [],
      alerts: []
    }
  }
}

// Execute a scheduled job
async function executeJob(job: ScheduledJob, supabase: any): Promise<void> {
  const executionId = crypto.randomUUID()
  const execution: JobExecution = {
    id: executionId,
    job_name: job.name,
    status: 'running',
    started_at: new Date().toISOString(),
    targets_processed: 0,
    targets_total: 0,
    games_imported: 0,
    errors: [],
    metadata: {}
  }

  activeJobs.set(executionId, execution)

  try {
    console.log(`Starting job execution: ${job.name}`)
    
    // Send start notification
    if (job.notifications?.on_start) {
      await sendNotification(job, 'started', execution)
    }

    // Resolve targets (either static or from query)
    const targets = await resolveJobTargets(job, supabase)
    execution.targets_total = targets.length

    console.log(`Job ${job.name}: Processing ${targets.length} targets`)

    // Process targets in batches
    const batchSize = job.config.batch_size
    let totalGamesImported = 0
    let processedCount = 0

    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize)
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(targets.length / batchSize)}`)

      // Process batch
      for (const target of batch) {
        try {
          const result = await callImportFunction(target, job.config, supabase)
          totalGamesImported += result.imported || 0
          processedCount++
          
          execution.targets_processed = processedCount
          execution.games_imported = totalGamesImported
          
        } catch (error) {
          console.error(`Error processing target ${target.username}:`, error)
          execution.errors.push(`${target.username}: ${error.message}`)
          
          // Handle error based on job configuration
          if (job.on_error?.action === 'stop') {
            throw error
          }
        }
      }

      // Delay between batches
      if (i + batchSize < targets.length) {
        const delayMs = parseDelayString(job.config.delay_between_batches)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    // Mark as completed
    execution.status = 'completed'
    execution.completed_at = new Date().toISOString()
    
    console.log(`Job ${job.name} completed: ${totalGamesImported} games imported`)

    // Send completion notification
    if (job.notifications?.on_complete) {
      await sendNotification(job, 'completed', execution)
    }

  } catch (error) {
    console.error(`Job ${job.name} failed:`, error)
    
    execution.status = 'failed'
    execution.completed_at = new Date().toISOString()
    execution.errors.push(error.message)

    // Send error notification
    if (job.notifications?.on_error) {
      await sendNotification(job, 'failed', execution)
    }
  } finally {
    // Move to history and remove from active jobs
    jobHistory.push({ ...execution })
    activeJobs.delete(executionId)
    
    // Keep only last 100 job executions in history
    if (jobHistory.length > 100) {
      jobHistory.splice(0, jobHistory.length - 100)
    }
  }
}

// Resolve job targets from queries or static lists
async function resolveJobTargets(job: ScheduledJob, supabase: any): Promise<any[]> {
  const targets = []

  for (const target of job.targets) {
    if (target.query) {
      // Execute query to get dynamic targets
      const { data, error } = await supabase.rpc('execute_query', {
        query: target.query
      })
      
      if (error) {
        console.error('Error executing target query:', error)
        continue
      }
      
      targets.push(...data)
    } else {
      // Static target
      targets.push(target)
    }
  }

  return targets
}

// Call the import-games function
async function callImportFunction(target: any, config: JobConfig, supabase: any): Promise<any> {
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/import-games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      site: target.normalized_site || target.site,
      username: target.username,
      limit: config.limit
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return await response.json()
}

// Send notifications (Discord webhook, email, etc.)
async function sendNotification(job: ScheduledJob, event: string, execution: JobExecution): Promise<void> {
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')
  if (!webhookUrl) return

  const color = event === 'completed' ? 0x00ff00 : event === 'failed' ? 0xff0000 : 0x0099ff
  const emoji = event === 'completed' ? '✅' : event === 'failed' ? '❌' : '🚀'

  const embed = {
    title: `${emoji} Scheduler Job ${event.charAt(0).toUpperCase() + event.slice(1)}`,
    description: job.description,
    color,
    fields: [
      { name: 'Job Name', value: job.name, inline: true },
      { name: 'Status', value: execution.status, inline: true },
      { name: 'Duration', value: calculateDuration(execution), inline: true },
      { name: 'Targets Processed', value: `${execution.targets_processed}/${execution.targets_total}`, inline: true },
      { name: 'Games Imported', value: execution.games_imported.toString(), inline: true },
      { name: 'Errors', value: execution.errors.length.toString(), inline: true }
    ],
    timestamp: new Date().toISOString()
  }

  if (execution.errors.length > 0) {
    embed.fields.push({
      name: 'Recent Errors',
      value: execution.errors.slice(-3).join('\n').substring(0, 1024),
      inline: false
    })
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    })
  } catch (error) {
    console.error('Failed to send notification:', error)
  }
}

// Utility functions
function calculateNextRun(cronExpression: string): string {
  // This would use a proper cron parser in production
  return 'Next run calculation not implemented'
}

function getLastRun(jobName: string): string | null {
  const lastExecution = jobHistory
    .filter(j => j.job_name === jobName)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  
  return lastExecution?.started_at || null
}

function calculateDuration(execution: JobExecution): string {
  if (!execution.completed_at) return 'Running...'
  
  const start = new Date(execution.started_at).getTime()
  const end = new Date(execution.completed_at).getTime()
  const durationMs = end - start
  
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)
  
  return `${minutes}m ${seconds}s`
}

function calculateAverageJobDuration(): number {
  const completedJobs = jobHistory.filter(j => j.status === 'completed' && j.completed_at)
  if (completedJobs.length === 0) return 0
  
  const totalDuration = completedJobs.reduce((sum, job) => {
    const start = new Date(job.started_at).getTime()
    const end = new Date(job.completed_at!).getTime()
    return sum + (end - start)
  }, 0)
  
  return totalDuration / completedJobs.length / 1000 // Return in seconds
}

function parseDelayString(delay: string): number {
  const match = delay.match(/^(\d+)([smh])$/)
  if (!match) return 0
  
  const value = parseInt(match[1])
  const unit = match[2]
  
  switch (unit) {
    case 's': return value * 1000
    case 'm': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    default: return 0
  }
}

// Initialize scheduler (this would run on startup)
function initializeScheduler(): void {
  console.log('Scheduler initialized')
  
  // In a real implementation, this would:
  // 1. Load the YAML configuration
  // 2. Parse cron expressions
  // 3. Set up timers for each job
  // 4. Handle job execution
  // 5. Monitor job health
  
  // For now, we'll just log that it's initialized
}

// Start the scheduler
initializeScheduler()