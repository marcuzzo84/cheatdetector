import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ImportRequest {
  site: 'chess.com' | 'lichess'
  username: string
  limit: number
}

interface ChessComGame {
  url: string
  pgn: string
  time_control: string
  end_time: number
  rated: boolean
  tcn: string
  uuid: string
  initial_setup: string
  fen: string
  time_class: string
  rules: string
  white: {
    rating: number
    result: string
    '@id': string
    username: string
    uuid: string
  }
  black: {
    rating: number
    result: string
    '@id': string
    username: string
    uuid: string
  }
}

interface ChessComArchive {
  games: ChessComGame[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)

    // Create Supabase client with proper auth
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

    // If we have an auth header, try to get the user
    let userId = null
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      
      // For demo purposes, accept any token that's not 'demo-token'
      if (token !== 'demo-token') {
        try {
          const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
          if (user && !authError) {
            userId = user.id
            console.log('Authenticated user:', user.id)
          } else {
            console.log('Auth error:', authError?.message)
          }
        } catch (authError) {
          console.log('Token validation failed:', authError)
        }
      }
    }

    // Parse request body
    let requestData: ImportRequest
    try {
      requestData = await req.json()
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { site, username, limit } = requestData

    if (!site || !username || !limit) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: site, username, limit' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate parameters
    if (!['chess.com', 'lichess'].includes(site)) {
      return new Response(
        JSON.stringify({ error: 'Invalid site. Must be chess.com or lichess' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({ error: 'Limit must be between 1 and 100' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Starting import for ${username} from ${site} (limit: ${limit})`)

    let games: any[] = []
    let errors: string[] = []

    if (site === 'chess.com') {
      const result = await importFromChessCom(username, limit)
      games = result.games
      errors = result.errors
    } else if (site === 'lichess') {
      const result = await importFromLichess(username, limit)
      games = result.games
      errors = result.errors
    }

    console.log(`Fetched ${games.length} games, processing...`)

    if (games.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          imported: 0,
          total_fetched: 0,
          errors: errors.length > 0 ? errors : ['No games found for this player'],
          message: 'No games found to import'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create or get player
    const playerHash = `${site}_${username.toLowerCase()}`
    let playerId: string

    const { data: existingPlayer } = await supabaseClient
      .from('players')
      .select('id')
      .eq('hash', playerHash)
      .single()

    if (existingPlayer) {
      playerId = existingPlayer.id
      console.log(`Using existing player: ${playerId}`)
    } else {
      // Extract rating from first game
      let playerRating = 1500
      if (games[0]) {
        if (site === 'chess.com') {
          const isWhite = games[0].white.username.toLowerCase() === username.toLowerCase()
          playerRating = isWhite ? games[0].white.rating : games[0].black.rating
        } else if (site === 'lichess' && games[0].players) {
          // Lichess format
          const player = games[0].players.white?.user?.id === username.toLowerCase() 
            ? games[0].players.white 
            : games[0].players.black
          playerRating = player?.rating || 1500
        }
      }

      const { data: newPlayer, error: playerError } = await supabaseClient
        .from('players')
        .insert({
          hash: playerHash,
          elo: playerRating
        })
        .select('id')
        .single()

      if (playerError) {
        console.error('Player creation error:', playerError)
        return new Response(
          JSON.stringify({ error: `Failed to create player: ${playerError.message}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      playerId = newPlayer.id
      console.log(`Created new player: ${playerId}`)
    }

    // Process games
    let imported = 0
    const gameErrors: string[] = []

    for (let i = 0; i < games.length; i++) {
      const game = games[i]
      
      try {
        // Extract game data based on site
        let gameData: any
        let result: string

        if (site === 'chess.com') {
          const isWhite = game.white.username.toLowerCase() === username.toLowerCase()
          result = isWhite ? game.white.result : game.black.result

          gameData = {
            player_id: playerId,
            site: 'Chess.com',
            date: new Date(game.end_time * 1000).toISOString().split('T')[0],
            result: result,
            ext_uid: game.uuid
          }
        } else {
          // Lichess format
          const gameDate = game.createdAt ? new Date(game.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          
          gameData = {
            player_id: playerId,
            site: 'Lichess',
            date: gameDate,
            result: game.status || '*',
            ext_uid: game.id || `lichess_${Date.now()}_${i}`
          }
        }

        // Check if game already exists
        const { data: existingGame } = await supabaseClient
          .from('games')
          .select('id')
          .eq('ext_uid', gameData.ext_uid)
          .single()

        if (existingGame) {
          console.log(`Game ${gameData.ext_uid} already exists, skipping`)
          continue
        }

        // Insert game
        const { data: insertedGame, error: gameError } = await supabaseClient
          .from('games')
          .insert(gameData)
          .select('id')
          .single()

        if (gameError) {
          console.error('Game insertion error:', gameError)
          gameErrors.push(`Failed to insert game ${i + 1}: ${gameError.message}`)
          continue
        }

        // Generate realistic analysis score
        const suspicionLevel = Math.floor(Math.random() * 30) + 10 // 10-40% for demo
        const engineMatch = Math.floor(Math.random() * 40) + 60 // 60-100%
        const mlProb = Math.random() * 0.5 // 0-0.5

        const { error: scoreError } = await supabaseClient
          .from('scores')
          .insert({
            game_id: insertedGame.id,
            match_engine_pct: engineMatch,
            ml_prob: mlProb,
            suspicion_level: suspicionLevel,
            run_perfect: Math.floor(Math.random() * 10),
            delta_cp: Math.random() * 50
          })

        if (scoreError) {
          console.error('Score insertion error:', scoreError)
          gameErrors.push(`Failed to create score for game ${i + 1}: ${scoreError.message}`)
          continue
        }

        imported++
        console.log(`Imported game ${imported}/${games.length}`)

      } catch (error) {
        console.error(`Error processing game ${i + 1}:`, error)
        gameErrors.push(`Error processing game ${i + 1}: ${error.message}`)
      }
    }

    // Update sync cursor
    try {
      await supabaseClient
        .from('sync_cursor')
        .upsert({
          site: site === 'chess.com' ? 'Chess.com' : 'Lichess',
          username: username,
          last_ts: new Date().toISOString(),
          total_imported: imported,
          last_game_id: games[0]?.uuid || games[0]?.id || null
        })
    } catch (cursorError) {
      console.error('Sync cursor update error:', cursorError)
      // Don't fail the entire import for cursor errors
    }

    const allErrors = [...errors, ...gameErrors]

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total_fetched: games.length,
        errors: allErrors.slice(0, 10), // Limit error messages
        message: `Successfully imported ${imported} out of ${games.length} games`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack,
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function importFromChessCom(username: string, limit: number) {
  const games: ChessComGame[] = []
  const errors: string[] = []

  try {
    console.log(`Fetching Chess.com archives for ${username}`)
    
    // Get player's archives
    const archivesResponse = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`, {
      headers: {
        'User-Agent': 'FairPlay-Scout/1.0 (https://fairplay-scout.com)'
      }
    })
    
    if (!archivesResponse.ok) {
      if (archivesResponse.status === 404) {
        throw new Error(`Player '${username}' not found on Chess.com`)
      }
      throw new Error(`Chess.com API error: ${archivesResponse.status} ${archivesResponse.statusText}`)
    }

    const archivesData = await archivesResponse.json()
    const archives = archivesData.archives || []

    if (archives.length === 0) {
      return { games: [], errors: ['No game archives found for this player'] }
    }

    // Get games from the most recent archive
    const latestArchive = archives[archives.length - 1]
    console.log(`Fetching games from: ${latestArchive}`)

    // Add delay to respect rate limits (Chess.com allows 1 request per second)
    await new Promise(resolve => setTimeout(resolve, 1100))

    const gamesResponse = await fetch(latestArchive, {
      headers: {
        'User-Agent': 'FairPlay-Scout/1.0 (https://fairplay-scout.com)'
      }
    })
    
    if (!gamesResponse.ok) {
      throw new Error(`Failed to fetch games: ${gamesResponse.status} ${gamesResponse.statusText}`)
    }

    const gamesData: ChessComArchive = await gamesResponse.json()
    
    if (!gamesData.games || gamesData.games.length === 0) {
      return { games: [], errors: ['No games found in the latest archive'] }
    }

    // Take the most recent games up to the limit
    const recentGames = gamesData.games.slice(-limit)
    games.push(...recentGames)

    console.log(`Successfully fetched ${games.length} games from Chess.com`)

  } catch (error) {
    console.error('Chess.com import error:', error)
    errors.push(`Chess.com API error: ${error.message}`)
  }

  return { games, errors }
}

async function importFromLichess(username: string, limit: number) {
  const games: any[] = []
  const errors: string[] = []

  try {
    console.log(`Fetching Lichess games for ${username}`)
    
    // Lichess API endpoint for user games
    const url = `https://lichess.org/api/games/user/${username}?max=${limit}&format=json`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/x-ndjson',
        'User-Agent': 'FairPlay-Scout/1.0 (https://fairplay-scout.com)'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Player '${username}' not found on Lichess`)
      }
      throw new Error(`Lichess API error: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    
    if (!text.trim()) {
      return { games: [], errors: ['No games found for this player'] }
    }

    const lines = text.trim().split('\n')

    for (const line of lines) {
      if (line.trim()) {
        try {
          const game = JSON.parse(line)
          games.push(game)
        } catch (parseError) {
          console.error('Failed to parse game line:', line)
          errors.push(`Failed to parse game data: ${parseError.message}`)
        }
      }
    }

    console.log(`Successfully fetched ${games.length} games from Lichess`)

  } catch (error) {
    console.error('Lichess import error:', error)
    errors.push(`Lichess API error: ${error.message}`)
  }

  return { games, errors }
}