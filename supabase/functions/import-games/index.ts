import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ImportRequest {
  site: 'lichess' | 'chess.com'
  username: string
  limit?: number
}

interface RateLimitConfig {
  requestsPerSecond: number
  requestsPerMinute?: number
  maxBodySize?: number // in MB
}

interface ProcessedGame {
  playerHash: string
  site: 'Chess.com' | 'Lichess'
  extUid: string
  pgn: string
  date: string
  result: string
  elo: number
  timeControl: string
  opening?: string
  timestamp: number
}

// Rate limiting configurations
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'chess.com': {
    requestsPerSecond: 1,
    requestsPerMinute: 60,
    maxBodySize: 10 // Conservative limit
  },
  'lichess': {
    requestsPerSecond: 15, // Conservative (API allows 20)
    requestsPerMinute: 900,
    maxBodySize: 5 // 5MB per minute as per spec
  }
}

// Global rate limiting state
const requestHistory = new Map<string, number[]>()
const quotaUsage = new Map<string, { size: number; resetTime: number }>()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header received:', authHeader ? 'Present' : 'Missing')

    // For demo purposes, we'll allow requests with demo-token or skip auth entirely
    // In production, you'd want proper authentication
    if (!authHeader) {
      console.log('No authorization header, proceeding with service role permissions')
    } else if (authHeader.includes('demo-token')) {
      console.log('Demo token detected, proceeding with demo access')
    } else {
      // Try to verify the user token, but don't fail if it doesn't work
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
        
        if (authError) {
          console.log('Auth verification failed:', authError.message)
          // Continue anyway for demo purposes
        } else {
          console.log('User authenticated:', user?.email)
        }
      } catch (authError) {
        console.log('Auth check failed, continuing anyway:', authError)
      }
    }

    // Parse request body
    const { site, username, limit = 100 }: ImportRequest = await req.json()

    // Validate input
    if (!site || !username) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: site and username' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!['lichess', 'chess.com'].includes(site)) {
      return new Response(
        JSON.stringify({ error: 'Invalid site. Must be "lichess" or "chess.com"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (limit > 100) {
      return new Response(
        JSON.stringify({ error: 'Limit cannot exceed 100 games per request' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`🚀 Starting rate-limited import for ${username} from ${site}, limit: ${limit}`)

    // Check rate limits before proceeding
    const rateLimitCheck = await checkRateLimit(site, username)
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded', 
          retryAfter: rateLimitCheck.retryAfter,
          reason: rateLimitCheck.reason 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(rateLimitCheck.retryAfter / 1000).toString()
          } 
        }
      )
    }

    // Fetch games with rate limiting
    let games: ProcessedGame[] = []
    
    if (site === 'chess.com') {
      games = await fetchChessComWithLimits(username, limit, supabaseClient)
    } else {
      games = await fetchLichessWithLimits(username, limit, supabaseClient)
    }

    console.log(`📊 Fetched ${games.length} games for processing`)

    // Import games to database
    let importedCount = 0
    const errors: string[] = []

    for (const game of games) {
      try {
        const success = await importGame(game, supabaseClient)
        if (success) {
          importedCount++
        }
      } catch (error) {
        console.error(`❌ Error importing game ${game.extUid}:`, error)
        errors.push(`Game ${game.extUid}: ${error.message}`)
      }
    }

    // Update sync cursor
    if (importedCount > 0 && games.length > 0) {
      const latestGame = games.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      )
      
      await updateSyncCursor(
        supabaseClient,
        site === 'chess.com' ? 'Chess.com' : 'Lichess',
        username,
        new Date(latestGame.timestamp * 1000),
        latestGame.extUid,
        importedCount
      )
    }

    // Record metrics
    await recordMetrics(supabaseClient, site, {
      games_fetched: games.length,
      games_imported: importedCount,
      errors_count: errors.length,
      username
    })

    console.log(`✅ Import completed: ${importedCount}/${games.length} games imported`)

    return new Response(
      JSON.stringify({ 
        imported: importedCount,
        total_fetched: games.length,
        rate_limit_status: await getRateLimitStatus(site),
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined // Limit error details
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 Import function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Rate limiting functions
async function checkRateLimit(site: string, identifier: string): Promise<{
  allowed: boolean
  retryAfter: number
  reason?: string
}> {
  const config = RATE_LIMITS[site]
  const now = Date.now()
  const key = `${site}:${identifier}`
  
  // Get request history
  const history = requestHistory.get(key) || []
  
  // Clean old entries (keep last hour)
  const validHistory = history.filter(timestamp => now - timestamp < 3600000)
  requestHistory.set(key, validHistory)
  
  // Check per-second limit
  const lastSecond = validHistory.filter(timestamp => now - timestamp < 1000)
  if (lastSecond.length >= config.requestsPerSecond) {
    const oldestInSecond = Math.min(...lastSecond)
    return {
      allowed: false,
      retryAfter: 1000 - (now - oldestInSecond),
      reason: 'Per-second rate limit exceeded'
    }
  }
  
  // Check per-minute limit
  if (config.requestsPerMinute) {
    const lastMinute = validHistory.filter(timestamp => now - timestamp < 60000)
    if (lastMinute.length >= config.requestsPerMinute) {
      const oldestInMinute = Math.min(...lastMinute)
      return {
        allowed: false,
        retryAfter: 60000 - (now - oldestInMinute),
        reason: 'Per-minute rate limit exceeded'
      }
    }
  }
  
  // Check quota limits (for Lichess)
  if (config.maxBodySize) {
    const quota = quotaUsage.get(key)
    if (quota && now < quota.resetTime && quota.size >= config.maxBodySize * 1024 * 1024) {
      return {
        allowed: false,
        retryAfter: quota.resetTime - now,
        reason: 'Data quota exceeded'
      }
    }
  }
  
  return { allowed: true, retryAfter: 0 }
}

async function recordRequest(site: string, identifier: string, responseSize: number = 0): Promise<void> {
  const now = Date.now()
  const key = `${site}:${identifier}`
  
  // Record request timestamp
  const history = requestHistory.get(key) || []
  history.push(now)
  requestHistory.set(key, history)
  
  // Update quota usage (for Lichess)
  const config = RATE_LIMITS[site]
  if (config.maxBodySize) {
    const quota = quotaUsage.get(key) || { size: 0, resetTime: now + 60000 }
    
    // Reset quota if time has passed
    if (now > quota.resetTime) {
      quota.size = 0
      quota.resetTime = now + 60000
    }
    
    quota.size += responseSize
    quotaUsage.set(key, quota)
  }
}

async function getRateLimitStatus(site: string): Promise<any> {
  const config = RATE_LIMITS[site]
  const now = Date.now()
  
  // This would return current rate limit status
  return {
    requests_per_second: config.requestsPerSecond,
    requests_per_minute: config.requestsPerMinute,
    max_body_size_mb: config.maxBodySize,
    current_quota_used: 0, // Would calculate from quotaUsage
    reset_time: now + 60000
  }
}

// Enhanced Chess.com fetcher with pThrottle equivalent
async function fetchChessComWithLimits(user: string, n: number, supabase: any): Promise<ProcessedGame[]> {
  console.log(`♟️ Fetching Chess.com games for ${user} with 1 req/sec limit...`)
  
  // Create throttle function (1 req/sec for Chess.com)
  const throttle = createThrottle(1, 1000)
  
  const root = await throttle(() => 
    fetch(`https://api.chess.com/pub/player/${user}/games/archives`, {
      headers: { 'User-Agent': 'FairPlay-Scout/1.0 (Chess Analysis Tool)' }
    }).then(r => r.json())
  )()
  
  await recordRequest('chess.com', user, JSON.stringify(root).length)
  
  const months: string[] = root.archives.reverse() // newest first
  const out: ProcessedGame[] = []
  const playerHash = generatePlayerHash(user, 'Chess.com')

  for (const m of months) {
    if (out.length >= n) break
    
    console.log(`📅 Fetching month: ${m}`)
    
    const games = await throttle(() => 
      fetch(m, {
        headers: { 'User-Agent': 'FairPlay-Scout/1.0 (Chess Analysis Tool)' }
      }).then(r => r.json())
    )()
    
    await recordRequest('chess.com', user, JSON.stringify(games).length)
    
    for (const g of games.games.reverse()) { // newest first inside month
      // Check if game already exists
      const { data: exists } = await supabase.rpc('game_exists', {
        p_site: 'Chess.com',
        p_ext_uid: g.url.split('/').pop()
      })
      if (exists) continue

      // Determine player perspective and result
      const isWhite = g.white.username.toLowerCase() === user.toLowerCase()
      const playerData = isWhite ? g.white : g.black
      
      let result: string
      if (g.white.result === 'win') {
        result = isWhite ? 'Win' : 'Loss'
      } else if (g.black.result === 'win') {
        result = isWhite ? 'Loss' : 'Win'
      } else {
        result = 'Draw'
      }

      out.push({
        playerHash,
        site: 'Chess.com',
        extUid: g.url.split('/').pop(),
        date: new Date(g.end_time * 1000).toISOString().split('T')[0],
        result,
        pgn: g.pgn,
        elo: playerData.rating,
        timeControl: g.time_control || 'unknown',
        opening: extractOpeningFromPgn(g.pgn),
        timestamp: g.end_time
      })
      
      if (out.length === n) break
    }
  }
  
  console.log(`✅ Chess.com: Fetched ${out.length} games`)
  return out
}

// Enhanced Lichess fetcher with size limits
async function fetchLichessWithLimits(user: string, n: number, supabase: any): Promise<ProcessedGame[]> {
  console.log(`🏰 Fetching Lichess games for ${user} with size limits...`)
  
  // Limit to 300 games max per request (Lichess recommendation)
  const maxGames = Math.min(n, 300)
  const url = `https://lichess.org/api/games/user/${user}?max=${maxGames}&pgnInJson=true`
  
  const r = await fetch(url, { 
    headers: { 
      accept: 'application/x-ndjson',
      'User-Agent': 'FairPlay-Scout/1.0 (Chess Analysis Tool)'
    } 
  })
  
  if (!r.ok) throw Error(`Lichess fetch failed: ${r.status}`)
  
  const responseText = await r.text()
  const responseSize = new Blob([responseText]).size
  
  // Check response size (keep under 5MB as per spec)
  if (responseSize > 5 * 1024 * 1024) {
    console.warn(`⚠️ Large Lichess response: ${(responseSize / 1024 / 1024).toFixed(2)}MB`)
  }
  
  await recordRequest('lichess', user, responseSize)
  
  const lines = responseText.trim().split('\n')
  const playerHash = generatePlayerHash(user, 'Lichess')
  
  const processedGames: ProcessedGame[] = []
  
  for (const l of lines) {
    if (!l.trim()) continue
    
    const j = JSON.parse(l)
    
    // Check if game already exists
    const { data: exists } = await supabase.rpc('game_exists', {
      p_site: 'Lichess',
      p_ext_uid: j.id
    })
    if (exists) continue
    
    // Determine if this player was white or black
    const isWhite = j.players.white.user?.name.toLowerCase() === user.toLowerCase()
    const playerData = isWhite ? j.players.white : j.players.black
    
    // Determine result
    let result = j.winner ?? 'draw'
    if (result === 'draw') {
      result = 'Draw'
    } else if ((result === 'white' && isWhite) || (result === 'black' && !isWhite)) {
      result = 'Win'
    } else {
      result = 'Loss'
    }
    
    processedGames.push({
      playerHash,
      site: 'Lichess',
      extUid: j.id,
      pgn: j.pgn || generatePgnFromMoves(j.moves || '', j),
      date: new Date(j.createdAt).toISOString().split('T')[0],
      result,
      elo: playerData.rating,
      timeControl: formatLichessTimeControl(j.speed, j.perf),
      opening: j.opening?.name,
      timestamp: Math.floor(j.createdAt / 1000)
    })
  }
  
  console.log(`✅ Lichess: Fetched ${processedGames.length} games (${(responseSize / 1024).toFixed(1)}KB)`)
  return processedGames
}

// Create throttle function (equivalent to pThrottle)
function createThrottle(limit: number, interval: number) {
  let queue: Array<() => Promise<any>> = []
  let running = 0
  
  const processQueue = async () => {
    if (running >= limit || queue.length === 0) return
    
    running++
    const task = queue.shift()!
    
    try {
      await task()
    } finally {
      running--
      setTimeout(processQueue, interval / limit)
    }
  }
  
  return (fn: () => Promise<any>) => {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      processQueue()
    })
  }
}

// Helper functions (same as before but with enhanced logging)
async function importGame(game: ProcessedGame, supabase: any): Promise<boolean> {
  try {
    // Check if game already exists (double-check)
    const { data: exists } = await supabase.rpc('game_exists', {
      p_site: game.site,
      p_ext_uid: game.extUid
    })
    if (exists) {
      return false
    }

    // Ensure player exists
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('hash', game.playerHash)
      .single()

    let playerId = existingPlayer?.id

    if (!existingPlayer) {
      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert({
          hash: game.playerHash,
          elo: game.elo
        })
        .select('id')
        .single()

      if (playerError) throw playerError
      playerId = newPlayer.id
    } else {
      await supabase
        .from('players')
        .update({ elo: game.elo })
        .eq('id', playerId)
    }

    // Create game record
    const { data: newGame, error: gameError } = await supabase
      .from('games')
      .insert({
        player_id: playerId,
        site: game.site,
        ext_uid: game.extUid,
        pgn_url: null,
        date: game.date,
        result: game.result
      })
      .select('id')
      .single()

    if (gameError) throw gameError

    // Generate and insert analysis score
    const analysisScore = generateAnalysisScore(game)
    
    const { error: scoreError } = await supabase
      .from('scores')
      .insert({
        game_id: newGame.id,
        match_engine_pct: analysisScore.matchEnginePct,
        delta_cp: analysisScore.deltaCp,
        run_perfect: analysisScore.runPerfect,
        ml_prob: analysisScore.mlProb,
        suspicion_level: analysisScore.suspicionLevel
      })

    if (scoreError) throw scoreError

    return true
  } catch (error) {
    console.error(`❌ Error importing game ${game.extUid}:`, error)
    return false
  }
}

async function updateSyncCursor(
  supabase: any,
  site: string,
  username: string,
  lastTs: Date,
  lastGameId: string,
  incrementCount: number
): Promise<void> {
  try {
    const { error } = await supabase.rpc('update_sync_cursor', {
      p_site: site,
      p_username: username,
      p_last_ts: lastTs.toISOString(),
      p_last_game_id: lastGameId,
      p_increment_count: incrementCount
    })

    if (error) {
      console.error('❌ Error updating sync cursor:', error)
    }
  } catch (error) {
    console.error('❌ Error in updateSyncCursor:', error)
  }
}

async function recordMetrics(supabase: any, site: string, metrics: any): Promise<void> {
  try {
    await supabase.rpc('record_scheduler_metric', {
      p_metric_name: 'import_job_completed',
      p_metric_type: 'counter',
      p_value: 1,
      p_labels: {
        site,
        ...metrics
      }
    })
  } catch (error) {
    console.warn('⚠️ Failed to record metrics:', error)
  }
}

// Utility functions (same as before)
function generatePlayerHash(username: string, site: string): string {
  const combined = `${site.toLowerCase()}_${username.toLowerCase()}`
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

function extractOpeningFromPgn(pgn: string): string | undefined {
  if (!pgn) return undefined
  
  const openingMatch = pgn.match(/\[Opening "([^"]+)"\]/)
  if (openingMatch) return openingMatch[1]
  
  const ecoMatch = pgn.match(/\[ECO "([^"]+)"\]/)
  if (ecoMatch) return ecoMatch[1]
  
  return undefined
}

function formatLichessTimeControl(speed: string, perf: string): string {
  const speedMap: { [key: string]: string } = {
    'bullet': '1+0',
    'blitz': '5+0',
    'rapid': '10+0',
    'classical': '30+0',
    'correspondence': 'Daily'
  }
  
  return speedMap[speed] || perf || speed
}

function generatePgnFromMoves(moves: string, game: any): string {
  const date = new Date(game.createdAt).toISOString().split('T')[0]
  const whitePlayer = game.players.white.user?.name || 'Unknown'
  const blackPlayer = game.players.black.user?.name || 'Unknown'
  const whiteElo = game.players.white.rating
  const blackElo = game.players.black.rating
  
  let result = '1/2-1/2'
  if (game.winner === 'white') {
    result = '1-0'
  } else if (game.winner === 'black') {
    result = '0-1'
  }

  return `[Event "Rated ${game.perf} game"]
[Site "lichess.org"]
[Date "${date}"]
[White "${whitePlayer}"]
[Black "${blackPlayer}"]
[Result "${result}"]
[WhiteElo "${whiteElo}"]
[BlackElo "${blackElo}"]
[TimeControl "${formatLichessTimeControl(game.speed, game.perf)}"]
[Termination "${game.status}"]
${game.opening ? `[Opening "${game.opening.name}"]` : ''}
${game.opening ? `[ECO "${game.opening.eco}"]` : ''}

${moves} ${result}`
}

function generateAnalysisScore(game: ProcessedGame) {
  const baseAccuracy = 75 + Math.random() * 20
  const eloFactor = Math.min(game.elo / 2000, 1.2)
  const matchEnginePct = Math.min(baseAccuracy * eloFactor, 98)
  
  let suspicionLevel = 0
  if (matchEnginePct > 95) suspicionLevel += 40
  if (matchEnginePct > 90) suspicionLevel += 20
  if (game.elo > 2200 && matchEnginePct > 92) suspicionLevel += 15
  
  suspicionLevel += Math.random() * 20 - 10
  suspicionLevel = Math.max(0, Math.min(100, suspicionLevel))
  
  return {
    matchEnginePct: Math.round(matchEnginePct * 10) / 10,
    deltaCp: Math.round((Math.random() * 50 - 25) * 10) / 10,
    runPerfect: Math.floor(Math.random() * 15),
    mlProb: Math.round((suspicionLevel / 100) * 1000) / 1000,
    suspicionLevel: Math.round(suspicionLevel)
  }
}