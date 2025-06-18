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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { site, username, limit }: ImportRequest = await req.json()

    if (!site || !username || !limit) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: site, username, limit' }),
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
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported site. Use chess.com or lichess' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Fetched ${games.length} games, processing...`)

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
    } else {
      const { data: newPlayer, error: playerError } = await supabaseClient
        .from('players')
        .insert({
          hash: playerHash,
          elo: games[0]?.white?.rating || games[0]?.black?.rating || 1500
        })
        .select('id')
        .single()

      if (playerError) {
        throw new Error(`Failed to create player: ${playerError.message}`)
      }
      playerId = newPlayer.id
    }

    // Process games
    let imported = 0
    const gameErrors: string[] = []

    for (const game of games) {
      try {
        // Extract game data based on site
        let gameData: any
        let playerRating: number
        let opponentRating: number
        let result: string

        if (site === 'chess.com') {
          const isWhite = game.white.username.toLowerCase() === username.toLowerCase()
          playerRating = isWhite ? game.white.rating : game.black.rating
          opponentRating = isWhite ? game.black.rating : game.white.rating
          result = isWhite ? game.white.result : game.black.result

          gameData = {
            player_id: playerId,
            site: 'Chess.com',
            date: new Date(game.end_time * 1000).toISOString().split('T')[0],
            result: result,
            ext_uid: game.uuid
          }
        } else {
          // Lichess format would go here
          gameData = {
            player_id: playerId,
            site: 'Lichess',
            date: new Date().toISOString().split('T')[0],
            result: '*',
            ext_uid: `lichess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
          gameErrors.push(`Failed to insert game: ${gameError.message}`)
          continue
        }

        // Generate analysis score
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
          gameErrors.push(`Failed to create score: ${scoreError.message}`)
          continue
        }

        imported++
      } catch (error) {
        gameErrors.push(`Error processing game: ${error.message}`)
      }
    }

    // Update sync cursor
    await supabaseClient
      .from('sync_cursor')
      .upsert({
        site: site === 'chess.com' ? 'Chess.com' : 'Lichess',
        username: username,
        last_ts: new Date().toISOString(),
        total_imported: imported,
        last_game_id: games[0]?.uuid || games[0]?.id || null
      })

    const allErrors = [...errors, ...gameErrors]

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total_fetched: games.length,
        errors: allErrors.slice(0, 10) // Limit error messages
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
        details: error.stack
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
    // Get player's archives
    const archivesResponse = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`)
    
    if (!archivesResponse.ok) {
      throw new Error(`Chess.com API error: ${archivesResponse.status}`)
    }

    const archivesData = await archivesResponse.json()
    const archives = archivesData.archives || []

    if (archives.length === 0) {
      return { games: [], errors: ['No game archives found for this player'] }
    }

    // Get games from the most recent archive
    const latestArchive = archives[archives.length - 1]
    console.log(`Fetching games from: ${latestArchive}`)

    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000))

    const gamesResponse = await fetch(latestArchive)
    
    if (!gamesResponse.ok) {
      throw new Error(`Failed to fetch games: ${gamesResponse.status}`)
    }

    const gamesData: ChessComArchive = await gamesResponse.json()
    
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
    // Lichess API endpoint for user games
    const url = `https://lichess.org/api/games/user/${username}?max=${limit}&format=json`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/x-ndjson'
      }
    })

    if (!response.ok) {
      throw new Error(`Lichess API error: ${response.status}`)
    }

    const text = await response.text()
    const lines = text.trim().split('\n')

    for (const line of lines) {
      if (line.trim()) {
        try {
          const game = JSON.parse(line)
          games.push(game)
        } catch (parseError) {
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