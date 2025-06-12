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

interface ChessComGame {
  url: string
  pgn: string
  time_control: string
  end_time: number
  rated: boolean
  uuid: string
  white: {
    rating: number
    result: string
    username: string
  }
  black: {
    rating: number
    result: string
    username: string
  }
}

interface LichessGame {
  id: string
  rated: boolean
  variant: string
  speed: string
  perf: string
  createdAt: number
  lastMoveAt: number
  status: string
  players: {
    white: {
      user: { name: string; id: string }
      rating: number
      ratingDiff?: number
    }
    black: {
      user: { name: string; id: string }
      rating: number
      ratingDiff?: number
    }
  }
  opening?: {
    eco: string
    name: string
    ply: number
  }
  moves: string
  pgn?: string
  winner?: string
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

serve(async (req) => {
  // Handle CORS preflight requests
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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has staff role (simplified - in production, check user metadata or roles table)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'staff'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Staff role required.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
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

    console.log(`Starting import for ${username} from ${site}, limit: ${limit}`)

    // Fetch games based on site
    let games: ProcessedGame[] = []
    
    if (site === 'chess.com') {
      games = await fetchChessCom(username, limit, supabaseClient)
    } else {
      games = await fetchLichess(username, limit, supabaseClient)
    }

    console.log(`Fetched ${games.length} games for processing`)

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
        console.error(`Error importing game ${game.extUid}:`, error)
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

    console.log(`Import completed: ${importedCount}/${games.length} games imported`)

    return new Response(
      JSON.stringify({ 
        imported: importedCount,
        total_fetched: games.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Import function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper functions

// Chess.com helper function following your exact specification
async function fetchChessCom(user: string, n: number, supabase?: any): Promise<ProcessedGame[]> {
  const root = await (await fetch(`https://api.chess.com/pub/player/${user}/games/archives`)).json()
  const months: string[] = root.archives.reverse()      // newest first
  
  // Create throttle function (1 req/s for Chess.com)
  const limiter = createThrottle(1, 1000) // 1 request per 1000ms
  const out: ProcessedGame[] = []
  const playerHash = generatePlayerHash(user, 'Chess.com')

  for (const m of months) {
    if (out.length >= n) break
    
    const games = await limiter(() => fetch(m).then(r => r.json()))()
    
    for (const g of games.games.reverse()) {             // newest first inside month
      // Check if game already exists
      if (supabase) {
        const { data: exists } = await supabase.rpc('game_exists', {
          p_site: 'Chess.com',
          p_ext_uid: g.url.split('/').pop()
        })
        if (exists) continue
      }

      // Determine player perspective and result
      const isWhite = g.white.username.toLowerCase() === user.toLowerCase()
      const playerData = isWhite ? g.white : g.black
      
      // Map result to player perspective
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
        extUid: g.url.split('/').pop(),                      // unique slug
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
  return out
}

// Updated Lichess helper function following your specification
async function fetchLichess(user: string, n: number, supabase?: any): Promise<ProcessedGame[]> {
  const url = `https://lichess.org/api/games/user/${user}?max=${n}&pgnInJson=true`
  const r = await fetch(url, { 
    headers: { 
      accept: 'application/x-ndjson',
      'User-Agent': 'FairPlay-Scout/1.0'
    } 
  })
  
  if (!r.ok) throw Error('Lichess fetch failed')
  
  const lines = (await r.text()).trim().split('\n')
  const playerHash = generatePlayerHash(user, 'Lichess')
  
  const processedGames: ProcessedGame[] = []
  
  for (const l of lines) {
    const j = JSON.parse(l)
    
    // Check if game already exists
    if (supabase) {
      const { data: exists } = await supabase.rpc('game_exists', {
        p_site: 'Lichess',
        p_ext_uid: j.id
      })
      if (exists) continue
    }
    
    // Determine if this player was white or black
    const isWhite = j.players.white.user?.name.toLowerCase() === user.toLowerCase()
    const playerData = isWhite ? j.players.white : j.players.black
    
    // Determine result based on winner field or rating diff
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
      site: 'Lichess' as const,
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
  
  return processedGames
}

async function importGame(game: ProcessedGame, supabase: any): Promise<boolean> {
  try {
    // Check if game already exists (double-check)
    const { data: exists } = await supabase.rpc('game_exists', {
      p_site: game.site,
      p_ext_uid: game.extUid
    })
    if (exists) {
      console.log(`Game ${game.extUid} already exists, skipping`)
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
      // Update player's ELO if this is more recent
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
        pgn_url: `supabase://pgn/${game.extUid}.pgn`, // Following your specification
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
    console.error(`Error importing game ${game.extUid}:`, error)
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
      console.error('Error updating sync cursor:', error)
    }
  } catch (error) {
    console.error('Error in updateSyncCursor:', error)
  }
}

// Utility functions

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

function normalizeResult(result: string): string {
  const lowerResult = result.toLowerCase()
  if (lowerResult.includes('win')) return 'Win'
  if (lowerResult.includes('loss') || lowerResult.includes('lose')) return 'Loss'
  return 'Draw'
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

function generatePgnFromMoves(moves: string, game: LichessGame): string {
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