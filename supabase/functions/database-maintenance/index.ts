import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MaintenanceConfig {
  vacuum_analyze: boolean
  reindex: boolean
  cleanup_old_data: boolean
  update_statistics: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
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

    // Parse request body
    const config: MaintenanceConfig = await req.json()

    console.log('Starting database maintenance with config:', config)

    const results = {
      vacuum_analyze: null as any,
      reindex: null as any,
      cleanup: null as any,
      statistics: null as any,
      started_at: new Date().toISOString(),
      completed_at: null as string | null,
      errors: [] as string[]
    }

    try {
      // 1. VACUUM ANALYZE for better query performance
      if (config.vacuum_analyze) {
        console.log('Running VACUUM ANALYZE...')
        
        const tables = ['players', 'games', 'scores', 'sync_cursor']
        const vacuumResults = []
        
        for (const table of tables) {
          try {
            const { error } = await supabaseClient.rpc('execute_maintenance_query', {
              query: `VACUUM ANALYZE ${table};`
            })
            
            if (error) {
              throw error
            }
            
            vacuumResults.push(`${table}: success`)
          } catch (error) {
            const errorMsg = `${table}: ${error.message}`
            vacuumResults.push(errorMsg)
            results.errors.push(errorMsg)
          }
        }
        
        results.vacuum_analyze = {
          status: 'completed',
          tables_processed: vacuumResults
        }
      }

      // 2. REINDEX for index optimization
      if (config.reindex) {
        console.log('Running REINDEX...')
        
        const indexes = [
          'idx_players_hash',
          'idx_games_player_id',
          'idx_games_site_date',
          'idx_scores_game_id',
          'idx_scores_suspicion_level',
          'idx_sync_cursor_updated_at'
        ]
        
        const reindexResults = []
        
        for (const index of indexes) {
          try {
            const { error } = await supabaseClient.rpc('execute_maintenance_query', {
              query: `REINDEX INDEX ${index};`
            })
            
            if (error) {
              throw error
            }
            
            reindexResults.push(`${index}: success`)
          } catch (error) {
            const errorMsg = `${index}: ${error.message}`
            reindexResults.push(errorMsg)
            results.errors.push(errorMsg)
          }
        }
        
        results.reindex = {
          status: 'completed',
          indexes_processed: reindexResults
        }
      }

      // 3. Cleanup old data
      if (config.cleanup_old_data) {
        console.log('Cleaning up old data...')
        
        try {
          // Clean up old sync cursors (90+ days old with no imports)
          const { data: cleanupResult, error: cleanupError } = await supabaseClient
            .rpc('cleanup_old_sync_cursors', { days_old: 90 })
          
          if (cleanupError) {
            throw cleanupError
          }
          
          results.cleanup = {
            status: 'completed',
            sync_cursors_deleted: cleanupResult,
            description: 'Removed old sync cursors with no imports'
          }
          
        } catch (error) {
          const errorMsg = `Cleanup failed: ${error.message}`
          results.cleanup = { status: 'failed', error: errorMsg }
          results.errors.push(errorMsg)
        }
      }

      // 4. Update table statistics
      if (config.update_statistics) {
        console.log('Updating table statistics...')
        
        try {
          const { data: statsData, error: statsError } = await supabaseClient
            .rpc('get_table_statistics')
          
          if (statsError) {
            throw statsError
          }
          
          results.statistics = {
            status: 'completed',
            table_stats: statsData,
            updated_at: new Date().toISOString()
          }
          
        } catch (error) {
          const errorMsg = `Statistics update failed: ${error.message}`
          results.statistics = { status: 'failed', error: errorMsg }
          results.errors.push(errorMsg)
        }
      }

      results.completed_at = new Date().toISOString()
      
      console.log('Database maintenance completed')
      console.log('Results:', results)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Database maintenance completed',
          results,
          errors_count: results.errors.length
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (error) {
      console.error('Database maintenance error:', error)
      
      results.completed_at = new Date().toISOString()
      results.errors.push(error.message)

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Database maintenance failed',
          results,
          error: error.message
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error) {
    console.error('Maintenance function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})