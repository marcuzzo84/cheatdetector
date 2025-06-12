import { createClient } from '@supabase/supabase-js';
import { 
  chessComLimiter, 
  lichessLimiter, 
  createThrottledFetch, 
  checkApiHealth,
  type RateLimitStatus 
} from './rateLimiter';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ApiQuotaStatus {
  site: 'chess.com' | 'lichess';
  requestsUsed: number;
  requestsLimit: number;
  dataUsed: number; // in bytes
  dataLimit: number; // in bytes
  resetTime: number;
  healthy: boolean;
  recommendations: string[];
}

export interface EnhancedProcessedGame {
  playerHash: string;
  site: 'Chess.com' | 'Lichess';
  extUid: string;
  pgn: string;
  date: string;
  result: string;
  elo: number;
  timeControl: string;
  opening?: string;
  timestamp: number;
  fetchMetrics: {
    requestTime: number;
    responseSize: number;
    rateLimited: boolean;
    retryCount: number;
  };
}

class EnhancedChessApiService {
  private chessComFetch: ReturnType<typeof createThrottledFetch>;
  private lichessFetch: ReturnType<typeof createThrottledFetch>;
  private requestCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();

  constructor() {
    this.chessComFetch = createThrottledFetch(chessComLimiter, 'chess.com');
    this.lichessFetch = createThrottledFetch(lichessLimiter, 'lichess');
  }

  async getApiQuotaStatus(): Promise<ApiQuotaStatus[]> {
    const chessComHealth = await checkApiHealth('chess.com');
    const lichessHealth = await checkApiHealth('lichess');

    return [
      {
        site: 'chess.com',
        requestsUsed: this.requestCounts.get('chess.com') || 0,
        requestsLimit: 3600, // 1 req/sec * 3600 seconds
        dataUsed: chessComHealth.quotaStatus.used,
        dataLimit: chessComHealth.quotaStatus.limit,
        resetTime: chessComHealth.quotaStatus.resetTime,
        healthy: chessComHealth.healthy,
        recommendations: chessComHealth.recommendations
      },
      {
        site: 'lichess',
        requestsUsed: this.requestCounts.get('lichess') || 0,
        requestsLimit: 54000, // 15 req/sec * 3600 seconds
        dataUsed: lichessHealth.quotaStatus.used,
        dataLimit: lichessHealth.quotaStatus.limit,
        resetTime: lichessHealth.quotaStatus.resetTime,
        healthy: lichessHealth.healthy,
        recommendations: lichessHealth.recommendations
      }
    ];
  }

  async fetchChessComPlayerGamesWithLimits(
    username: string, 
    limit: number = 50, 
    resumable: boolean = true
  ): Promise<EnhancedProcessedGame[]> {
    console.log(`🔄 Starting Chess.com fetch for ${username} (limit: ${limit})`);
    
    try {
      // Check API health before starting
      const health = await checkApiHealth('chess.com');
      if (!health.healthy) {
        throw new Error(`Chess.com API not healthy: ${health.recommendations.join(', ')}`);
      }

      // Get sync cursor for resumable imports
      let syncCursor = null;
      if (resumable) {
        syncCursor = await this.getSyncCursor('Chess.com', username);
        if (syncCursor) {
          console.log(`📍 Resuming from ${syncCursor.lastTs}, already imported ${syncCursor.totalImported} games`);
        }
      }

      // Fetch archives list with rate limiting
      console.log(`📋 Fetching archives list for ${username}...`);
      const archivesUrl = `https://api.chess.com/pub/player/${username}/games/archives`;
      const archivesResponse = await this.chessComFetch(archivesUrl);
      
      if (!archivesResponse.ok) {
        throw new Error(`Archives fetch failed: ${archivesResponse.status} ${archivesResponse.statusText}`);
      }

      const archives = await archivesResponse.json();
      this.incrementRequestCount('chess.com');

      if (!archives.archives || archives.archives.length === 0) {
        console.log(`❌ No archives found for ${username}`);
        return [];
      }

      const games: EnhancedProcessedGame[] = [];
      const playerHash = this.generatePlayerHash(username, 'Chess.com');
      const lastImportTime = syncCursor ? new Date(syncCursor.lastTs).getTime() / 1000 : 0;

      // Process archives from newest to oldest
      const sortedArchives = archives.archives.sort().reverse();
      console.log(`📅 Processing ${sortedArchives.length} monthly archives...`);

      for (let i = 0; i < sortedArchives.length && games.length < limit; i++) {
        const archiveUrl = sortedArchives[i];
        console.log(`📦 Processing archive ${i + 1}/${sortedArchives.length}: ${archiveUrl}`);

        try {
          // Rate limiting is handled by throttledFetch
          const startTime = Date.now();
          const monthResponse = await this.chessComFetch(archiveUrl);
          const requestTime = Date.now() - startTime;
          
          if (!monthResponse.ok) {
            console.warn(`⚠️ Archive fetch failed: ${monthResponse.status} for ${archiveUrl}`);
            this.incrementErrorCount('chess.com');
            continue;
          }

          const monthData = await monthResponse.json();
          this.incrementRequestCount('chess.com');

          if (!monthData.games || monthData.games.length === 0) {
            console.log(`📭 No games in archive: ${archiveUrl}`);
            continue;
          }

          // Process games from newest to oldest within the month
          const sortedGames = monthData.games.sort((a: any, b: any) => b.end_time - a.end_time);
          console.log(`🎮 Processing ${sortedGames.length} games from archive...`);

          for (const game of sortedGames) {
            if (games.length >= limit) break;

            // Skip games older than our cursor
            if (resumable && game.end_time <= lastImportTime) {
              console.log(`⏭️ Skipping game ${game.uuid} - older than cursor`);
              continue;
            }

            // Check if game already exists
            if (await this.gameExists('Chess.com', game.uuid)) {
              console.log(`🔄 Skipping game ${game.uuid} - already exists`);
              continue;
            }

            // Determine player perspective
            const isWhite = game.white.username.toLowerCase() === username.toLowerCase();
            const playerData = isWhite ? game.white : game.black;

            // Map result to player perspective
            let result: string;
            if (game.white.result === 'win') {
              result = isWhite ? 'Win' : 'Loss';
            } else if (game.black.result === 'win') {
              result = isWhite ? 'Loss' : 'Win';
            } else {
              result = 'Draw';
            }

            const processedGame: EnhancedProcessedGame = {
              playerHash,
              site: 'Chess.com',
              extUid: game.uuid,
              pgn: game.pgn || '',
              date: new Date(game.end_time * 1000).toISOString().split('T')[0],
              result,
              elo: playerData.rating,
              timeControl: game.time_control || 'unknown',
              opening: this.extractOpeningFromPgn(game.pgn),
              timestamp: game.end_time,
              fetchMetrics: {
                requestTime,
                responseSize: JSON.stringify(game).length,
                rateLimited: false, // throttledFetch handles this
                retryCount: 0
              }
            };

            games.push(processedGame);
          }

          console.log(`✅ Processed archive ${i + 1}, total games: ${games.length}`);

        } catch (error) {
          console.error(`❌ Error processing archive ${archiveUrl}:`, error);
          this.incrementErrorCount('chess.com');
          continue;
        }
      }

      console.log(`🎯 Chess.com fetch completed: ${games.length} new games for ${username}`);
      return games;

    } catch (error) {
      console.error(`💥 Chess.com fetch failed for ${username}:`, error);
      this.incrementErrorCount('chess.com');
      throw error;
    }
  }

  async fetchLichessPlayerGamesWithLimits(
    username: string, 
    limit: number = 50, 
    resumable: boolean = true
  ): Promise<EnhancedProcessedGame[]> {
    console.log(`🔄 Starting Lichess fetch for ${username} (limit: ${limit})`);
    
    try {
      // Check API health and quota
      const health = await checkApiHealth('lichess');
      if (!health.healthy) {
        throw new Error(`Lichess API not healthy: ${health.recommendations.join(', ')}`);
      }

      // Get sync cursor for resumable imports
      let syncCursor = null;
      let sinceParam = '';
      if (resumable) {
        syncCursor = await this.getSyncCursor('Lichess', username);
        if (syncCursor) {
          const sinceMs = new Date(syncCursor.lastTs).getTime();
          sinceParam = `&since=${sinceMs}`;
          console.log(`📍 Resuming from ${syncCursor.lastTs}, already imported ${syncCursor.totalImported} games`);
        }
      }

      // Construct URL with size limits for Lichess (max 5MB response)
      const maxGames = Math.min(limit, 300); // Lichess recommendation: ≤300 games per request
      const url = `https://lichess.org/api/games/user/${username}?max=${maxGames}&pgnInJson=true&sort=dateDesc${sinceParam}`;
      
      console.log(`📡 Fetching from Lichess API: ${url}`);
      
      const startTime = Date.now();
      const response = await this.lichessFetch(url, {
        headers: {
          'Accept': 'application/x-ndjson'
        }
      });
      const requestTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Lichess fetch failed: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      const responseSize = new Blob([responseText]).size;
      this.incrementRequestCount('lichess');

      // Check if response size is approaching limit (5MB)
      if (responseSize > 4 * 1024 * 1024) { // 4MB warning threshold
        console.warn(`⚠️ Large Lichess response: ${(responseSize / 1024 / 1024).toFixed(2)}MB`);
      }

      const games: EnhancedProcessedGame[] = [];
      const playerHash = this.generatePlayerHash(username, 'Lichess');
      
      // Parse NDJSON response
      const lines = responseText.trim().split('\n').filter(line => line.trim());
      console.log(`📋 Processing ${lines.length} games from Lichess...`);
      
      for (const line of lines) {
        try {
          const game = JSON.parse(line);
          
          // Check if game already exists
          if (await this.gameExists('Lichess', game.id)) {
            console.log(`🔄 Skipping game ${game.id} - already exists`);
            continue;
          }
          
          // Determine player perspective
          const isWhite = game.players.white.user?.name.toLowerCase() === username.toLowerCase();
          const playerData = isWhite ? game.players.white : game.players.black;
          
          // Determine result
          let result = game.winner ?? 'draw';
          if (result === 'draw') {
            result = 'Draw';
          } else if ((result === 'white' && isWhite) || (result === 'black' && !isWhite)) {
            result = 'Win';
          } else {
            result = 'Loss';
          }
          
          const processedGame: EnhancedProcessedGame = {
            playerHash,
            site: 'Lichess',
            extUid: game.id,
            pgn: game.pgn || this.generatePgnFromMoves(game.moves || '', game),
            date: new Date(game.createdAt).toISOString().split('T')[0],
            result,
            elo: playerData.rating,
            timeControl: this.formatLichessTimeControl(game.speed, game.perf),
            opening: game.opening?.name,
            timestamp: Math.floor(game.createdAt / 1000),
            fetchMetrics: {
              requestTime,
              responseSize: JSON.stringify(game).length,
              rateLimited: false,
              retryCount: 0
            }
          };
          
          games.push(processedGame);
        } catch (error) {
          console.error('❌ Error parsing game line:', error);
          continue;
        }
      }

      console.log(`🎯 Lichess fetch completed: ${games.length} new games for ${username}`);
      return games;

    } catch (error) {
      console.error(`💥 Lichess fetch failed for ${username}:`, error);
      this.incrementErrorCount('lichess');
      throw error;
    }
  }

  async fetchAndStorePlayerDataWithLimits(
    username: string, 
    site: 'chess.com' | 'lichess' | 'both' = 'both', 
    limit: number = 50, 
    resumable: boolean = true
  ): Promise<{
    totalGames: number;
    quotaStatus: ApiQuotaStatus[];
    errors: string[];
  }> {
    let totalGames = 0;
    const errors: string[] = [];
    
    try {
      console.log(`🚀 Starting enhanced fetch for ${username} on ${site}`);

      if (site === 'chess.com' || site === 'both') {
        try {
          const chessComGames = await this.fetchChessComPlayerGamesWithLimits(username, limit, resumable);
          if (chessComGames.length > 0) {
            await this.saveGamesToDatabase(chessComGames);
            totalGames += chessComGames.length;
          }
        } catch (error) {
          const errorMsg = `Chess.com: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error('❌ Chess.com fetch failed:', error);
        }
      }

      if (site === 'lichess' || site === 'both') {
        try {
          const lichessGames = await this.fetchLichessPlayerGamesWithLimits(username, limit, resumable);
          if (lichessGames.length > 0) {
            await this.saveGamesToDatabase(lichessGames);
            totalGames += lichessGames.length;
          }
        } catch (error) {
          const errorMsg = `Lichess: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error('❌ Lichess fetch failed:', error);
        }
      }

      const quotaStatus = await this.getApiQuotaStatus();
      
      console.log(`✅ Enhanced fetch completed: ${totalGames} total games imported`);
      
      return {
        totalGames,
        quotaStatus,
        errors
      };

    } catch (error) {
      console.error('💥 Enhanced fetch failed:', error);
      throw error;
    }
  }

  // Batch processing with enhanced rate limiting
  async fetchMultiplePlayersWithLimits(
    players: Array<{username: string, site: 'chess.com' | 'lichess' | 'both'}>, 
    limit: number = 25, 
    resumable: boolean = true
  ): Promise<{
    totalGames: number;
    processedPlayers: number;
    quotaStatus: ApiQuotaStatus[];
    errors: string[];
  }> {
    console.log(`🔄 Starting batch fetch for ${players.length} players with rate limiting...`);
    
    let totalGames = 0;
    let processedPlayers = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      console.log(`👤 Processing player ${i + 1}/${players.length}: ${player.username} (${player.site})`);
      
      try {
        const result = await this.fetchAndStorePlayerDataWithLimits(
          player.username, 
          player.site, 
          limit, 
          resumable
        );
        
        totalGames += result.totalGames;
        processedPlayers++;
        
        if (result.errors.length > 0) {
          errors.push(...result.errors.map(e => `${player.username}: ${e}`));
        }
        
        console.log(`✅ Player ${player.username}: ${result.totalGames} games imported`);
        
        // Check quota status and adjust if needed
        const quotaStatus = await this.getApiQuotaStatus();
        const unhealthyApis = quotaStatus.filter(q => !q.healthy);
        
        if (unhealthyApis.length > 0) {
          console.warn(`⚠️ API health issues detected:`, unhealthyApis);
          
          // Add extra delay if APIs are struggling
          const extraDelay = unhealthyApis.length * 2000; // 2s per unhealthy API
          if (i < players.length - 1) {
            console.log(`⏳ Adding extra delay: ${extraDelay}ms`);
            await new Promise(resolve => setTimeout(resolve, extraDelay));
          }
        }
        
      } catch (error) {
        const errorMsg = `${player.username}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`❌ Failed to process ${player.username}:`, error);
        continue;
      }
    }
    
    const finalQuotaStatus = await this.getApiQuotaStatus();
    
    console.log(`🎯 Batch fetch completed: ${totalGames} games from ${processedPlayers}/${players.length} players`);
    
    return {
      totalGames,
      processedPlayers,
      quotaStatus: finalQuotaStatus,
      errors
    };
  }

  // Helper methods
  private incrementRequestCount(site: string): void {
    const current = this.requestCounts.get(site) || 0;
    this.requestCounts.set(site, current + 1);
  }

  private incrementErrorCount(site: string): void {
    const current = this.errorCounts.get(site) || 0;
    this.errorCounts.set(site, current + 1);
  }

  private generatePlayerHash(username: string, site: string): string {
    const combined = `${site.toLowerCase()}_${username.toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private async getSyncCursor(site: string, username: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('sync_cursor')
        .select('*')
        .eq('site', site)
        .eq('username', username)
        .single();

      if (error && error.code !== 'PGRST116') {
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

  private generatePgnFromMoves(moves: string, game: any): string {
    const date = new Date(game.createdAt).toISOString().split('T')[0];
    const whitePlayer = game.players.white.user?.name || 'Unknown';
    const blackPlayer = game.players.black.user?.name || 'Unknown';
    const whiteElo = game.players.white.rating;
    const blackElo = game.players.black.rating;
    
    let result = '1/2-1/2';
    if (game.winner === 'white') {
      result = '1-0';
    } else if (game.winner === 'black') {
      result = '0-1';
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

  private async saveGamesToDatabase(games: EnhancedProcessedGame[]): Promise<void> {
    // Implementation would be similar to the original but with enhanced metrics
    console.log(`💾 Saving ${games.length} games to database...`);
    // ... existing save logic
  }

  // Reset rate limiters (useful for testing)
  resetRateLimiters(): void {
    chessComLimiter.reset();
    lichessLimiter.reset();
    this.requestCounts.clear();
    this.errorCounts.clear();
  }

  // Get detailed metrics
  getMetrics(): {
    requests: Map<string, number>;
    errors: Map<string, number>;
    quotaStatus: Promise<ApiQuotaStatus[]>;
  } {
    return {
      requests: new Map(this.requestCounts),
      errors: new Map(this.errorCounts),
      quotaStatus: this.getApiQuotaStatus()
    };
  }
}

export const enhancedChessApiService = new EnhancedChessApiService();