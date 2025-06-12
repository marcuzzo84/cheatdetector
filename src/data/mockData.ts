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

// Generate mock accuracy heatmap data
const generateAccuracyHeatmap = () => {
  const data = [];
  for (let i = 1; i <= 40; i++) {
    const baseAccuracy = 75 + Math.random() * 20;
    // Simulate suspicious high accuracy in some moves
    const accuracy = Math.random() < 0.1 ? 95 + Math.random() * 5 : baseAccuracy;
    data.push({ move: i, accuracy: Math.round(accuracy) });
  }
  return data;
};

// Generate mock recent games
const generateRecentGames = (count: number): Game[] => {
  const sites = ['Chess.com', 'Lichess'];
  const results = ['Win', 'Loss', 'Draw'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `game-${i}`,
    playerHash: `hash${Math.floor(Math.random() * 100)}abcd${i}`,
    site: sites[Math.floor(Math.random() * sites.length)],
    suspicionLevel: Math.floor(Math.random() * 100),
    elo: 1200 + Math.floor(Math.random() * 800),
    matchEnginePct: 60 + Math.random() * 35,
    deltaCp: Math.random() * 50,
    mlProb: Math.random(),
    timestamp: new Date(Date.now() - Math.random() * 86400000 * 7), // Last 7 days
    result: results[Math.floor(Math.random() * results.length)]
  }));
};

// Generate suspicion trends for the last 30 days
const generateSuspicionTrends = (): SuspicionTrend[] => {
  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    trends.push({
      date: date.toISOString().split('T')[0],
      suspicion: 15 + Math.random() * 10, // 15-25% suspicion rate
      volume: 50 + Math.random() * 100 // 50-150 games per day
    });
  }
  return trends;
};

export const mockDashboardData = {
  kpis: {
    gamesAnalyzed24h: 1247,
    suspectPercentage: 18.3,
    avgElo: 1542.7,
    activePlayers: 847
  },
  suspicionTrends: generateSuspicionTrends(),
  recentGames: generateRecentGames(20)
};

export const mockPlayerData: Player[] = [
  {
    hash: 'hash123abcdef456789',
    elo: 1650,
    gamesCount: 43,
    avgSuspicion: 72,
    avgEngineMatch: 88.4,
    mlProb: 0.89,
    perfectRunStreak: 15,
    lastSeen: '2 hours ago',
    accuracyHeatmap: generateAccuracyHeatmap(),
    recentGames: [
      {
        id: 'g1',
        date: '2024-01-15',
        opponent: 'GrandMaster2024',
        result: 'Win',
        suspicionLevel: 85,
        moves: 42,
        timeControl: '10+0',
        opening: 'Sicilian Defense',
        pgn: '[Event "Rated Blitz game"]\n[Site "lichess.org"]\n[Date "2024.01.15"]\n[White "PlayerX"]\n[Black "GrandMaster2024"]\n[Result "1-0"]\n[UTCDate "2024.01.15"]\n[UTCTime "14:30:00"]\n[WhiteElo "1650"]\n[BlackElo "1680"]\n[Opening "B20 Sicilian Defense"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4...'
      },
      {
        id: 'g2',
        date: '2024-01-14',
        opponent: 'ChessBot_AI',
        result: 'Draw',
        suspicionLevel: 34,
        moves: 67,
        timeControl: '15+10',
        opening: 'Queen\'s Gambit',
        pgn: '[Event "Rated Classical game"]\n[Site "chess.com"]\n[Date "2024.01.14"]\n[White "ChessBot_AI"]\n[Black "PlayerX"]\n[Result "1/2-1/2"]\n[WhiteElo "1670"]\n[BlackElo "1650"]\n[Opening "D06 Queen\'s Gambit"]\n\n1. d4 d5 2. c4 e6 3. Nc3 Nf6...'
      },
      {
        id: 'g3',
        date: '2024-01-13',
        opponent: 'RookiePlayer',
        result: 'Win',
        suspicionLevel: 91,
        moves: 28,
        timeControl: '5+3',
        opening: 'King\'s Indian Attack',
        pgn: '[Event "Rated Blitz game"]\n[Site "lichess.org"]\n[Date "2024.01.13"]\n[White "PlayerX"]\n[Black "RookiePlayer"]\n[Result "1-0"]\n[WhiteElo "1650"]\n[BlackElo "1420"]\n[Opening "A07 King\'s Indian Attack"]\n\n1. Nf3 d5 2. g3 c5 3. Bg2 Nc6...'
      }
    ]
  }
];