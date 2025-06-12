import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  tcn: string;
  uuid: string;
  initial_setup: string;
  fen: string;
  time_class: string;
  rules: string;
  white: {
    rating: number;
    result: string;
    '@id': string;
    username: string;
    uuid: string;
  };
  black: {
    rating: number;
    result: string;
    '@id': string;
    username: string;
    uuid: string;
  };
}

export interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  perf: string;
  createdAt: number;
  lastMoveAt: number;
  status: string;
  players: {
    white: {
      user: {
        name: string;
        id: string;
      };
      rating: number;
      ratingDiff?: number;
    };
    black: {
      user: {
        name: string;
        id: string;
      };
      rating: number;
      ratingDiff?: number;
    };
  };
  opening?: {
    eco: string;
    name: string;
    ply: number;
  };
  moves: string;
  pgn: string;
}

export interface ProcessedGame {
  playerHash: string;
  site: 'Chess.com' | 'Lichess';
  extUid: string; // External game ID
  pgn: string;
  date: string;
  result: string;
  elo: number;
  timeControl: string;
  opening?: string;
  timestamp: number; // Unix timestamp for cursor tracking
}

export interface SyncCursor {
  site: string;
  username: string;
  lastTs: string;
  lastGameId?: string;
  totalImported: number;
}

class ChessApiService {
  private readonly CHESS_COM_BASE_URL = 'https://api.chess.com/pub';
  private readonly LICHESS_BASE_URL = 'https://lichess.org/api';
  private readonly REQUEST_DELAY = 1100; // Chess.com rate limit: 1 req/sec

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generatePlayerHash(username: string, site: string): string {
    // Create a consistent hash for the player
    const combined = `${site.toLowerCase()}_${username.toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'FairPlay-Scout/1.0 (Chess Analysis Tool)',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error(`Request failed for ${url}:`, error);
      throw error;
    }
  }

  // Get sync cursor for resumable imports
  private async getSyncCursor(site: string, username: string): Promise<SyncCursor | null> {
    try {
      const { data, error } = await supabase
        .from('sync_cursor')
        .select('*')
        .eq('site', site)
        .eq('username', username)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error fetching sync cursor:', error);
        return null;
      }

      return data ? {
        site: data.site,
        username: data.username,
        lastTs: data.last_ts,
        lastGameId: data.last_game_id,
        totalImported: data.total_imported
      } : null;
    } catch (error) {
      console.error('Error in getSyncCursor:', error);
      return null;
    }
  }

  // Update sync cursor
  private async updateSyncCursor(site: string, username: string, lastTs: Date, lastGameId?: string, incrementCount: number = 1): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_sync_cursor', {
        p_site: site,
        p_username: username,
        p_last_ts: lastTs.toISOString(),
        p_last_game_id: lastGameId,
        p_increment_count: incrementCount
      });

      if (error) {
        console.error('Error updating sync cursor:', error);
      }
    } catch (error) {
      console.error('Error in updateSyncCursor:', error);
    }
  }

  // Check if game already exists
  private async gameExists(site: string, extUid: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('game_exists', {
        p_site: site,
        p_ext_uid: extUid
      });

      if (error) {
        console.error('Error checking game existence:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error in gameExists:', error);
      return false;
    }
  }

  async fetchChessComPlayerGames(username: string, limit: number = 50, resumable: boolean = true): Promise<ProcessedGame[]> {
    try {
      console.log(`Fetching Chess.com games for ${username}...`);
      
      // Get sync cursor for resumable imports
      let syncCursor: SyncCursor | null = null;
      if (resumable) {
        syncCursor = await this.getSyncCursor('Chess.com', username);
        if (syncCursor) {
          console.log(`Resuming from ${syncCursor.lastTs}, already imported ${syncCursor.totalImported} games`);
        }
      }

      // Get monthly archives
      const archivesUrl = `${this.CHESS_COM_BASE_URL}/player/${username}/games/archives`;
      const archives = await this.makeRequest(archivesUrl);
      
      if (!archives.archives || archives.archives.length === 0) {
        console.log(`No archives found for ${username}`);
        return [];
      }

      const games: ProcessedGame[] = [];
      const playerHash = this.generatePlayerHash(username, 'Chess.com');
      const lastImportTime = syncCursor ? new Date(syncCursor.lastTs).getTime() / 1000 : 0;

      // Start from the most recent month and work backwards
      const sortedArchives = archives.archives.sort().reverse();
      
      for (const archiveUrl of sortedArchives) {
        if (games.length >= limit) break;

        await this.delay(this.REQUEST_DELAY);
        
        try {
          const monthData = await this.makeRequest(archiveUrl);
          
          if (monthData.games && monthData.games.length > 0) {
            // Sort games by end_time (most recent first)
            const sortedGames = monthData.games.sort((a: ChessComGame, b: ChessComGame) => b.end_time - a.end_time);
            
            for (const game of sortedGames) {
              if (games.length >= limit) break;

              // Skip games older than our cursor
              if (resumable && game.end_time <= lastImportTime) {
                console.log(`Skipping game ${game.uuid} - older than cursor`);
                continue;
              }

              // Check if game already exists
              if (await this.gameExists('Chess.com', game.uuid)) {
                console.log(`Skipping game ${game.uuid} - already exists`);
                continue;
              }

              // Determine if this player was white or black
              const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
              const playerData = isWhite ? game.white : game.black;

              const processedGame: ProcessedGame = {
                playerHash,
                site: 'Chess.com',
                extUid: game.uuid,
                pgn: game.pgn || '',
                date: new Date(game.end_time * 1000).toISOString().split('T')[0],
                result: this.normalizeResult(playerData.result),
                elo: playerData.rating,
                timeControl: game.time_control || 'unknown',
                opening: this.extractOpeningFromPgn(game.pgn),
                timestamp: game.end_time
              };

              games.push(processedGame);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch month data from ${archiveUrl}:`, error);
          continue;
        }
      }

      console.log(`Fetched ${games.length} new Chess.com games for ${username}`);
      return games;
    } catch (error) {
      console.error(`Error fetching Chess.com games for ${username}:`, error);
      return [];
    }
  }

  async fetchLichessPlayerGames(username: string, limit: number = 50, resumable: boolean = true): Promise<ProcessedGame[]> {
    try {
      console.log(`Fetching Lichess games for ${username}...`);
      
      // Get sync cursor for resumable imports
      let syncCursor: SyncCursor | null = null;
      let sinceParam = '';
      if (resumable) {
        syncCursor = await this.getSyncCursor('Lichess', username);
        if (syncCursor) {
          const sinceMs = new Date(syncCursor.lastTs).getTime();
          sinceParam = `&since=${sinceMs}`;
          console.log(`Resuming from ${syncCursor.lastTs}, already imported ${syncCursor.totalImported} games`);
        }
      }
      
      const url = `${this.LICHESS_BASE_URL}/games/user/${username}?max=${limit}&moves=true&opening=true&sort=dateDesc${sinceParam}`;
      
      const response = await this.makeRequest(url, {
        headers: {
          'Accept': 'application/x-ndjson'
        }
      });

      const games: ProcessedGame[] = [];
      const playerHash = this.generatePlayerHash(username, 'Lichess');
      
      // Parse NDJSON response
      const lines = response.split('\n').filter((line: string) => line.trim());
      
      for (const line of lines) {
        try {
          const game: LichessGame = JSON.parse(line);
          
          // Check if game already exists
          if (await this.gameExists('Lichess', game.id)) {
            console.log(`Skipping game ${game.id} - already exists`);
            continue;
          }
          
          // Determine if this player was white or black
          const isWhite = game.players.white.user?.name.toLowerCase() === username.toLowerCase();
          const playerData = isWhite ? game.players.white : game.players.black;
          
          // Determine result
          let result = 'Draw';
          if (game.status === 'mate' || game.status === 'resign' || game.status === 'timeout') {
            const winner = game.status === 'mate' ? 
              (game.moves.split(' ').length % 2 === 0 ? 'black' : 'white') :
              (isWhite ? (playerData.ratingDiff && playerData.ratingDiff > 0 ? 'white' : 'black') : 
               (playerData.ratingDiff && playerData.ratingDiff > 0 ? 'black' : 'white'));
            
            if ((isWhite && winner === 'white') || (!isWhite && winner === 'black')) {
              result = 'Win';
            } else {
              result = 'Loss';
            }
          }

          const processedGame: ProcessedGame = {
            playerHash,
            site: 'Lichess',
            extUid: game.id,
            pgn: game.pgn || this.generatePgnFromMoves(game.moves, game),
            date: new Date(game.createdAt).toISOString().split('T')[0],
            result,
            elo: playerData.rating,
            timeControl: this.formatLichessTimeControl(game.speed, game.perf),
            opening: game.opening?.name,
            timestamp: Math.floor(game.createdAt / 1000)
          };

          games.push(processedGame);
        } catch (error) {
          console.error('Error parsing game line:', error);
          continue;
        }
      }

      console.log(`Fetched ${games.length} new Lichess games for ${username}`);
      return games;
    } catch (error) {
      console.error(`Error fetching Lichess games for ${username}:`, error);
      return [];
    }
  }

  private normalizeResult(result: string): string {
    const lowerResult = result.toLowerCase();
    if (lowerResult.includes('win')) return 'Win';
    if (lowerResult.includes('loss') || lowerResult.includes('lose')) return 'Loss';
    return 'Draw';
  }

  private extractOpeningFromPgn(pgn: string): string | undefined {
    if (!pgn) return undefined;
    
    const openingMatch = pgn.match(/\[Opening "([^"]+)"\]/);
    if (openingMatch) return openingMatch[1];
    
    const ecoMatch = pgn.match(/\[ECO "([^"]+)"\]/);
    if (ecoMatch) return ecoMatch[1];
    
    return undefined;
  }

  private formatLichessTimeControl(speed: string, perf: string): string {
    const speedMap: { [key: string]: string } = {
      'bullet': '1+0',
      'blitz': '5+0',
      'rapid': '10+0',
      'classical': '30+0',
      'correspondence': 'Daily'
    };
    
    return speedMap[speed] || perf || speed;
  }

  private generatePgnFromMoves(moves: string, game: LichessGame): string {
    const date = new Date(game.createdAt).toISOString().split('T')[0];
    const whitePlayer = game.players.white.user?.name || 'Unknown';
    const blackPlayer = game.players.black.user?.name || 'Unknown';
    const whiteElo = game.players.white.rating;
    const blackElo = game.players.black.rating;
    
    let result = '1/2-1/2';
    if (game.status === 'mate' || game.status === 'resign' || game.status === 'timeout') {
      const moveCount = moves.split(' ').length;
      result = moveCount % 2 === 0 ? '0-1' : '1-0';
    }

    return `[Event "Rated ${game.perf} game"]
[Site "lichess.org"]
[Date "${date}"]
[White "${whitePlayer}"]
[Black "${blackPlayer}"]
[Result "${result}"]
[WhiteElo "${whiteElo}"]
[BlackElo "${blackElo}"]
[TimeControl "${this.formatLichessTimeControl(game.speed, game.perf)}"]
[Termination "${game.status}"]
${game.opening ? `[Opening "${game.opening.name}"]` : ''}
${game.opening ? `[ECO "${game.opening.eco}"]` : ''}

${moves} ${result}`;
  }

  async saveGamesToDatabase(games: ProcessedGame[]): Promise<void> {
    try {
      console.log(`Saving ${games.length} games to database...`);
      let savedCount = 0;
      
      for (const game of games) {
        // Check if game already exists (double-check)
        if (await this.gameExists(game.site, game.extUid)) {
          console.log(`Skipping duplicate game ${game.extUid}`);
          continue;
        }

        // First, ensure player exists
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('hash', game.playerHash)
          .single();

        let playerId = existingPlayer?.id;

        if (!existingPlayer) {
          // Create new player
          const { data: newPlayer, error: playerError } = await supabase
            .from('players')
            .insert({
              hash: game.playerHash,
              elo: game.elo
            })
            .select('id')
            .single();

          if (playerError) {
            console.error('Error creating player:', playerError);
            continue;
          }
          playerId = newPlayer.id;
        } else {
          // Update player's ELO if this game is more recent
          await supabase
            .from('players')
            .update({ elo: game.elo })
            .eq('id', playerId);
        }

        // Create game record with external UID
        const { data: newGame, error: gameError } = await supabase
          .from('games')
          .insert({
            player_id: playerId,
            site: game.site,
            ext_uid: game.extUid,
            pgn_url: null, // We have the PGN content, not a URL
            date: game.date,
            result: game.result
          })
          .select('id')
          .single();

        if (gameError) {
          console.error('Error creating game:', gameError);
          continue;
        }

        // Generate analysis scores (simulated for now)
        const analysisScore = this.generateAnalysisScore(game);
        
        const { error: scoreError } = await supabase
          .from('scores')
          .insert({
            game_id: newGame.id,
            match_engine_pct: analysisScore.matchEnginePct,
            delta_cp: analysisScore.deltaCp,
            run_perfect: analysisScore.runPerfect,
            ml_prob: analysisScore.mlProb,
            suspicion_level: analysisScore.suspicionLevel
          });

        if (scoreError) {
          console.error('Error creating score:', scoreError);
        } else {
          savedCount++;
        }
      }

      console.log(`Successfully saved ${savedCount} games to database`);

      // Update sync cursor if we saved any games
      if (savedCount > 0 && games.length > 0) {
        const latestGame = games.reduce((latest, current) => 
          current.timestamp > latest.timestamp ? current : latest
        );
        
        await this.updateSyncCursor(
          latestGame.site,
          this.extractUsernameFromHash(latestGame.playerHash, latestGame.site),
          new Date(latestGame.timestamp * 1000),
          latestGame.extUid,
          savedCount
        );
      }
    } catch (error) {
      console.error('Error saving games to database:', error);
      throw error;
    }
  }

  private extractUsernameFromHash(playerHash: string, site: string): string {
    // This is a simplified approach - in a real implementation, you'd want to store the username
    // For now, we'll use the hash as a fallback
    return `player_${playerHash}`;
  }

  private generateAnalysisScore(game: ProcessedGame) {
    // Simulate chess engine analysis
    // In a real implementation, this would use Stockfish or another engine
    
    const baseAccuracy = 75 + Math.random() * 20; // 75-95% base accuracy
    const eloFactor = Math.min(game.elo / 2000, 1.2); // Higher ELO = potentially higher accuracy
    const matchEnginePct = Math.min(baseAccuracy * eloFactor, 98);
    
    // Generate suspicion based on accuracy patterns
    let suspicionLevel = 0;
    if (matchEnginePct > 95) suspicionLevel += 40;
    if (matchEnginePct > 90) suspicionLevel += 20;
    if (game.elo > 2200 && matchEnginePct > 92) suspicionLevel += 15;
    
    // Add some randomness
    suspicionLevel += Math.random() * 20 - 10;
    suspicionLevel = Math.max(0, Math.min(100, suspicionLevel));
    
    return {
      matchEnginePct: Math.round(matchEnginePct * 10) / 10,
      deltaCp: Math.round((Math.random() * 50 - 25) * 10) / 10,
      runPerfect: Math.floor(Math.random() * 15),
      mlProb: Math.round((suspicionLevel / 100) * 1000) / 1000,
      suspicionLevel: Math.round(suspicionLevel)
    };
  }

  async fetchAndStorePlayerData(username: string, site: 'chess.com' | 'lichess' | 'both' = 'both', limit: number = 50, resumable: boolean = true): Promise<number> {
    let totalGames = 0;
    
    try {
      if (site === 'chess.com' || site === 'both') {
        const chessComGames = await this.fetchChessComPlayerGames(username, limit, resumable);
        if (chessComGames.length > 0) {
          await this.saveGamesToDatabase(chessComGames);
          totalGames += chessComGames.length;
        }
      }

      if (site === 'lichess' || site === 'both') {
        const lichessGames = await this.fetchLichessPlayerGames(username, limit, resumable);
        if (lichessGames.length > 0) {
          await this.saveGamesToDatabase(lichessGames);
          totalGames += lichessGames.length;
        }
      }

      return totalGames;
    } catch (error) {
      console.error('Error in fetchAndStorePlayerData:', error);
      throw error;
    }
  }

  // Batch fetch multiple players
  async fetchMultiplePlayersData(players: Array<{username: string, site: 'chess.com' | 'lichess' | 'both'}>, limit: number = 25, resumable: boolean = true): Promise<void> {
    console.log(`Starting batch fetch for ${players.length} players...`);
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      console.log(`Processing player ${i + 1}/${players.length}: ${player.username} (${player.site})`);
      
      try {
        const gameCount = await this.fetchAndStorePlayerData(player.username, player.site, limit, resumable);
        console.log(`✓ Fetched ${gameCount} games for ${player.username}`);
        
        // Add delay between players to respect rate limits
        if (i < players.length - 1) {
          await this.delay(this.REQUEST_DELAY);
        }
      } catch (error) {
        console.error(`✗ Failed to fetch data for ${player.username}:`, error);
        continue;
      }
    }
    
    console.log('Batch fetch completed!');
  }

  // Get import statistics
  async getImportStats(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('v_import_stats')
        .select('*');

      if (error) {
        console.error('Error fetching import stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getImportStats:', error);
      return null;
    }
  }
}

export const chessApiService = new ChessApiService();