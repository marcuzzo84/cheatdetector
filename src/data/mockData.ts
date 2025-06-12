// This file is now deprecated - all data comes from live Supabase queries
// Keeping only type definitions that are still used by components

export interface Game {
  id: string;
  playerHash: string;
  site: string;
  suspicionLevel: number;
  elo: number;
  matchEnginePct: number;
  deltaCp: number;
  mlProb: number;
  timestamp: Date;
  result: string;
}

export interface SuspicionTrend {
  date: string;
  suspicion: number;
  volume: number;
}

export interface Player {
  hash: string;
  elo: number;
  gamesCount: number;
  avgSuspicion: number;
  avgEngineMatch: number;
  mlProb: number;
  perfectRunStreak: number;
  lastSeen: string;
  accuracyHeatmap: { move: number; accuracy: number }[];
  recentGames: {
    id: string;
    date: string;
    opponent: string;
    result: string;
    suspicionLevel: number;
    moves: number;
    timeControl: string;
    opening: string;
    pgn: string;
  }[];
}

// All mock data generators have been removed
// Components now use live data from Supabase via hooks in useLiveQueries.ts