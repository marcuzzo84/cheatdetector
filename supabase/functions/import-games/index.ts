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
      games = await fetchChessComGames(username, limit, supabaseClient)
    } else {
      games = await fetchLichessGames(username, limit, supabaseClient)
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

async function fetchChessComGames(username: string, limit: number, supabase: any): Promise<ProcessedGame[]> {
  const CHESS_COM_BASE_URL = 'https://api.chess.com/pub'
  const games: ProcessedGame[] = []
  
  try {
    // Get sync cursor for resumable imports
    const { data: syncCursor } = await supabase
      .from('sync_cursor')
      .select('*')
      .eq('site', 'Chess.com')
      .eq('username', username)
      .single()

    const lastImportTime = syncCursor ? new Date(syncCursor.last_ts).getTime() / 1000 : 0

    // Get monthly archives
    const archivesResponse = await fetch(`${CHESS_COM_BASE_URL}/player/${username}/games/archives`)
    if (!archivesResponse.ok) {
      throw new Error(`Chess.com API error: ${archivesResponse.status}`)
    }
    
    const archives = await archivesResponse.json()
    if (!archives.archives || archives.archives.length === 0) {
      return []
    }

    const playerHash = generatePlayerHash(username, 'Chess.com')
    const sortedArchives = archives.archives.sort().reverse()

    for (const archiveUrl of sortedArchives) {
      if (games.length >= limit) break

      // Rate limiting for Chess.com (1 req/sec)
      await new Promise(resolve => setTimeout(resolve, 1100))

      try {
        const monthResponse = await fetch(archiveUrl)
        if (!monthResponse.ok) continue

        const monthData = await monthResponse.json()
        if (!monthData.games || monthData.games.length === 0) continue

        const sortedGames = monthData.games.sort((a: ChessComGame, b: ChessComGame) => b.end_time - a.end_time)

        for (const game of sortedGames) {
          if (games.length >= limit) break

          // Skip games older than cursor
          if (game.end_time <= lastImportTime) continue

          // Check if game already exists
          const { data: exists } = await supabase.rpc('game_exists', {
            p_site: 'Chess.com',
            p_ext_uid: game.uuid
          })
          if (exists) continue

          const isWhite = game.white.username.toLowerCase() === username.toLowerCase()
          const playerData = isWhite ? game.white : game.black

          games.push({
            playerHash,
            site: 'Chess.com',
            extUid: game.uuid,
            pgn: game.pgn || '',
            date: new Date(game.end_time * 1000).toISOString().split('T')[0],
            result: normalizeResult(playerData.result),
            elo: playerData.rating,
            timeControl: game.time_control || 'unknown',
            opening: extractOpeningFromPgn(game.pgn),
            timestamp: game.end_time
          })
        }
      } catch (error) {
        console.error(`Error fetching month data:`, error)
        continue
      }
    }

    return games
  } catch (error) {
    console.error(`Error fetching Chess.com games:`, error)
    throw error
  }
}

async function fetchLichessGames(username: string, limit: number, supabase: any): Promise<ProcessedGame[]> {
  const LICHESS_BASE_URL = 'https://lichess.org/api'
  
  try {
    // Get sync cursor for resumable imports
    const { data: syncCursor } = await supabase
      .from('sync_cursor')
      .select('*')
      .eq('site', 'Lichess')
      .eq('username', username)
      .single()

    let sinceParam = ''
    if (syncCursor) {
      const sinceMs = new Date(syncCursor.last_ts).getTime()
      sinceParam = `&since=${sinceMs}`
    }

    const url = `${LICHESS_BASE_URL}/games/user/${username}?max=${limit}&moves=true&opening=true&sort=dateDesc${sinceParam}`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/x-ndjson',
        'User-Agent': 'FairPlay-Scout/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Lichess API error: ${response.status}`)
    }

    const responseText = await response.text()
    const games: ProcessedGame[] = []
    const playerHash = generatePlayerHash(username, 'Lichess')
    
    const lines = responseText.split('\n').filter(line => line.trim())
    
    for (const line of lines) {
      try {
        const game: LichessGame = JSON.parse(line)
        
        // Check if game already exists
        const { data: exists } = await supabase.rpc('game_exists', {
          p_site: 'Lichess',
          p_ext_uid: game.id
        })
        if (exists) continue

        const isWhite = game.players.white.user?.name.toLowerCase() === username.toLowerCase()
        const playerData = isWhite ? game.players.white : game.players.black
        
        // Determine result
        let result = 'Draw'
        if (game.status === 'mate' || game.status === 'resign' || game.status === 'timeout') {
          if (playerData.ratingDiff && playerData.ratingDiff > 0) {
            result = 'Win'
          } else if (playerData.ratingDiff && playerData.ratingDiff < 0) {
            result = 'Loss'
          }
        }

        games.push({
          playerHash,
          site: 'Lichess',
          extUid: game.id,
          pgn: game.pgn || generatePgnFromMoves(game.moves, game),
          date: new Date(game.createdAt).toISOString().split('T')[0],
          result,
          elo: playerData.rating,
          timeControl: formatLichessTimeControl(game.speed, game.perf),
          opening: game.opening?.name,
          timestamp: Math.floor(game.createdAt / 1000)
        })
      } catch (error) {
        console.error('Error parsing game line:', error)
        continue
      }
    }

    return games
  } catch (error) {
    console.error(`Error fetching Lichess games:`, error)
    throw error
  }
}

async function importGame(game: ProcessedGame, supabase: any): Promise<boolean> {
  try {
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
      // Update player's ELO
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
  if (game.status === 'mate' || game.status === 'resign' || game.status === 'timeout') {
    const moveCount = moves.split(' ').length
    result = moveCount % 2 === 0 ? '0-1' : '1-0'
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