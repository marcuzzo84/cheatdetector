import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Activity, Calendar, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import AccuracyHeatmap from '../components/AccuracyHeatmap';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LivePlayerDetail {
  id: string;
  hash: string;
  elo: number;
  created_at: string;
  games: {
    id: string;
    site: string;
    date: string;
    result: string;
    scores: {
      id: string;
      suspicion_level: number;
      match_engine_pct: number;
      ml_prob: number;
      run_perfect: number;
      created_at: string;
    }[];
  }[];
}

const PlayerDetail: React.FC = () => {
  const { hash } = useParams<{ hash: string }>();
  const [player, setPlayer] = useState<LivePlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pgnModalOpen, setPgnModalOpen] = useState(false);
  const [selectedPgn, setSelectedPgn] = useState('');

  const fetchPlayerDetail = async () => {
    if (!hash) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          games (
            id,
            site,
            date,
            result,
            scores (
              id,
              suspicion_level,
              match_engine_pct,
              ml_prob,
              run_perfect,
              created_at
            )
          )
        `)
        .eq('hash', hash)
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      setPlayer(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayerDetail();

    // Set up realtime subscription
    const channel = supabase
      .channel('player-detail-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayerDetail();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        fetchPlayerDetail();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hash]);

  const getSuspicionColor = (level: number) => {
    if (level >= 70) return 'text-red-600 bg-red-50';
    if (level >= 40) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getSuspicionIcon = (level: number) => {
    if (level >= 70) return TrendingUp;
    if (level >= 40) return Activity;
    return TrendingDown;
  };

  const getChessComUrl = (playerHash: string) => {
    return `https://www.chess.com/member/${playerHash.substring(0, 8)}`;
  };

  const getLichessUrl = (playerHash: string) => {
    return `https://lichess.org/@/${playerHash.substring(0, 8)}`;
  };

  const openPgnModal = (pgn: string) => {
    setSelectedPgn(pgn);
    setPgnModalOpen(true);
  };

  const closePgnModal = () => {
    setPgnModalOpen(false);
    setSelectedPgn('');
  };

  // Sample PGN for demonstration
  const samplePgn = `[Event "Rated Blitz game"]
[Site "lichess.org"]
[Date "2024.01.15"]
[Round "-"]
[White "PlayerX"]
[Black "Opponent"]
[Result "1-0"]
[UTCDate "2024.01.15"]
[UTCTime "14:30:00"]
[WhiteElo "1650"]
[BlackElo "1680"]
[WhiteRatingDiff "+12"]
[BlackRatingDiff "-12"]
[Variant "Standard"]
[TimeControl "300+3"]
[ECO "B20"]
[Opening "Sicilian Defense"]
[Termination "Normal"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e6 7. f3 b5 8. Qd2 Bb7 9. O-O-O Nbd7 10. h4 Rc8 11. Kb1 Qc7 12. g4 b4 13. Nce2 d5 14. exd5 Nxd5 15. Bg5 Be7 16. Bxe7 Qxe7 17. g5 O-O 18. h5 Rfd8 19. g6 hxg6 20. hxg6 f6 21. Rh7 Kf8 22. Qh2 Ke8 23. Qh8+ Kd7 24. Qxg7 Qxg7 25. Rxg7+ Kc6 26. Rxb7 Kxb7 27. Nf5 exf5 28. Rxd5 Rxd5 29. Nf4 Rd1+ 30. Ka2 Ra1+ 31. Kb3 Rb1+ 32. Kc4 Rc1+ 33. Kd3 Rd1+ 34. Ke2 Re1+ 35. Kf2 Re7 36. g7 Rxg7 37. Nxf5 Rg2+ 38. Ke3 Rxb2 39. Nxd6+ Kc6 40. Nf5 Rxa2 41. Ne7+ Kd7 42. Nf5 Ra3+ 43. Kf4 a5 44. Kg4 a4 45. Kh5 a3 46. Kg6 a2 47. Kxf6 a1=Q 48. Ne3 Qf1 49. Kg5 Qxf3 50. Ng4 Qf4+ 51. Kh5 Ra5+ 52. Ng5 Qf5 53. Kh4 Rxg5 54. Kh3 Qf3+ 55. Kh2 Rg2+ 56. Kh1 Qf1# 0-1`;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            to="/players"
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Player Analysis</h1>
            <p className="text-gray-600">Loading player details...</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
            <p className="text-gray-500">Loading player data from database...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            to="/players"
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Player Analysis</h1>
            <p className="text-gray-600">Error loading player details</p>
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">
              {error || 'Player not found'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Calculate aggregated statistics
  const allScores = player.games.flatMap(game => game.scores);
  const avgSuspicion = allScores.length > 0 
    ? allScores.reduce((sum, score) => sum + score.suspicion_level, 0) / allScores.length 
    : 0;
  const avgEngineMatch = allScores.length > 0 
    ? allScores.reduce((sum, score) => sum + (score.match_engine_pct || 0), 0) / allScores.length 
    : 0;
  const avgMlProb = allScores.length > 0 
    ? allScores.reduce((sum, score) => sum + (score.ml_prob || 0), 0) / allScores.length 
    : 0;
  const perfectRunStreak = allScores.length > 0 
    ? Math.max(...allScores.map(score => score.run_perfect || 0))
    : 0;

  // Generate accuracy heatmap from real data
  const accuracyHeatmap = allScores.slice(0, 40).map((score, index) => ({
    move: index + 1,
    accuracy: score.match_engine_pct || 75
  }));

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    return 'Recently';
  };

  const lastSeen = allScores.length > 0 
    ? formatTimeAgo(allScores.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at)
    : formatTimeAgo(player.created_at);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link
            to="/players"
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Player Analysis</h1>
            <p className="text-gray-600">Detailed performance and suspicion metrics</p>
          </div>
        </div>

        {/* Player Info Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Player Hash</h2>
                <p className="text-lg text-gray-600 font-mono bg-gray-50 px-3 py-1 rounded">{player.hash}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <span className="text-sm text-gray-500">Current Elo</span>
                  <p className="text-2xl font-bold text-gray-900">{player.elo}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Games Analyzed</span>
                  <p className="text-2xl font-bold text-gray-900">{player.games.length}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Avg Suspicion</span>
                  <div className="flex items-center space-x-2">
                    <span className={`text-2xl font-bold ${getSuspicionColor(avgSuspicion).split(' ')[0]}`}>
                      {Math.round(avgSuspicion)}%
                    </span>
                    {React.createElement(getSuspicionIcon(avgSuspicion), {
                      className: `w-5 h-5 ${getSuspicionColor(avgSuspicion).split(' ')[0]}`
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <a
                href={getChessComUrl(player.hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View on Chess.com</span>
              </a>
              <a
                href={getLichessUrl(player.hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View on Lichess</span>
              </a>
              <button
                onClick={() => openPgnModal(samplePgn)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>View Sample PGN</span>
              </button>
            </div>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Average Engine Match</span>
                <span className="font-medium">{avgEngineMatch.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(avgEngineMatch, 100)}%` }}></div>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">ML Probability</span>
                <span className="font-medium">{(avgMlProb * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${avgMlProb * 100}%` }}></div>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Perfect Run Streak</span>
                <span className="font-medium">{perfectRunStreak} moves</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Last analyzed: {lastSeen}</span>
              </div>
              <div className="flex items-center space-x-3">
                <Activity className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Active on {[...new Set(player.games.map(g => g.site))].join(', ')}
                </span>
              </div>
              <div className="pt-2">
                <span className="text-sm text-gray-500">Sites:</span>
                <div className="flex space-x-2 mt-1">
                  {[...new Set(player.games.map(g => g.site))].map(site => (
                    <span 
                      key={site}
                      className={`px-2 py-1 text-xs rounded ${
                        site === 'Chess.com' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {site}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Accuracy Heatmap */}
        {accuracyHeatmap.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Accuracy vs Move Number</h3>
            <AccuracyHeatmap data={accuracyHeatmap} />
          </div>
        )}

        {/* Recent Games */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Games ({player.games.length})</h3>
          {player.games.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No games found for this player</p>
          ) : (
            <div className="space-y-4">
              {player.games.slice(0, 10).map((game) => (
                <div key={game.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        game.site === 'Chess.com' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {game.site}
                      </span>
                      <span className="text-sm text-gray-600">{game.date}</span>
                      <span className="text-sm font-medium">{game.result}</span>
                    </div>
                    {game.scores.length > 0 && (
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        game.scores[0].suspicion_level >= 70 ? 'bg-red-500 text-white' :
                        game.scores[0].suspicion_level >= 40 ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
                      }`}>
                        {game.scores[0].suspicion_level}% suspicious
                      </span>
                    )}
                  </div>
                  {game.scores.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>Engine Match: {game.scores[0].match_engine_pct?.toFixed(1)}%</div>
                      <div>ML Prob: {game.scores[0].ml_prob?.toFixed(3)}</div>
                      <div>Perfect Run: {game.scores[0].run_perfect}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PGN Modal */}
      {pgnModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Sample PGN</h3>
                <button
                  onClick={closePgnModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                <pre className="text-sm font-mono whitespace-pre-wrap">{selectedPgn}</pre>
              </div>
              
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={() => navigator.clipboard.writeText(selectedPgn)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Copy PGN
                </button>
                <button
                  onClick={closePgnModal}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PlayerDetail;