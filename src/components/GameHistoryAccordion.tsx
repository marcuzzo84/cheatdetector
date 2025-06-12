import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Trophy, ExternalLink, Eye } from 'lucide-react';

interface GameHistoryItem {
  id: string;
  date: string;
  opponent: string;
  result: string;
  suspicionLevel: number;
  moves: number;
  timeControl: string;
  opening: string;
  pgn: string;
}

interface GameHistoryAccordionProps {
  games: GameHistoryItem[];
}

const GameHistoryAccordion: React.FC<GameHistoryAccordionProps> = ({ games }) => {
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [pgnModalOpen, setPgnModalOpen] = useState(false);
  const [selectedPgn, setSelectedPgn] = useState('');

  const toggleGame = (gameId: string) => {
    setExpandedGame(expandedGame === gameId ? null : gameId);
  };

  const openPgnModal = (pgn: string) => {
    setSelectedPgn(pgn);
    setPgnModalOpen(true);
  };

  const closePgnModal = () => {
    setPgnModalOpen(false);
    setSelectedPgn('');
  };

  const getResultIcon = (result: string) => {
    if (result === 'Win') return <Trophy className="w-4 h-4 text-green-600" />;
    if (result === 'Loss') return <div className="w-4 h-4 rounded-full bg-red-600"></div>;
    return <div className="w-4 h-4 rounded-full border-2 border-gray-400"></div>;
  };

  const getSuspicionColor = (level: number) => {
    if (level >= 70) return 'text-red-600 bg-red-50';
    if (level >= 40) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getChessComUrl = (playerHash: string) => {
    // In a real implementation, you'd need the actual username
    return `https://www.chess.com/member/${playerHash.substring(0, 8)}`;
  };

  const getLichessUrl = (playerHash: string) => {
    // In a real implementation, you'd need the actual username
    return `https://lichess.org/@/${playerHash.substring(0, 8)}`;
  };

  return (
    <>
      <div className="space-y-2">
        {games.map((game) => (
          <div key={game.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleGame(game.id)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-4">
                {expandedGame === game.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                
                <div className="flex items-center space-x-2">
                  {getResultIcon(game.result)}
                  <span className="font-medium">{game.result}</span>
                </div>

                <span className="text-gray-600">vs {game.opponent}</span>
                
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{game.timeControl}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className={`px-2 py-1 rounded text-sm font-medium ${getSuspicionColor(game.suspicionLevel)}`}>
                  {game.suspicionLevel}% suspicious
                </span>
                <span className="text-sm text-gray-500">{game.date}</span>
              </div>
            </button>

            {expandedGame === game.id && (
              <div className="px-4 py-4 bg-white border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Game Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Opening:</span>
                        <span className="font-medium">{game.opening}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Moves:</span>
                        <span className="font-medium">{game.moves}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Time Control:</span>
                        <span className="font-medium">{game.timeControl}</span>
                      </div>
                    </div>

                    {/* External Links */}
                    <div className="pt-3 space-y-2">
                      <h5 className="text-sm font-medium text-gray-900">External Links</h5>
                      <div className="flex flex-col space-y-2">
                        <a
                          href={getChessComUrl('placeholder')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>View on Chess.com</span>
                        </a>
                        <a
                          href={getLichessUrl('placeholder')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 text-purple-600 hover:text-purple-800 text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>View on Lichess</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">PGN Preview</h4>
                    <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto max-h-32">
                      <pre className="whitespace-pre-wrap">{game.pgn.substring(0, 200)}...</pre>
                    </div>
                    <button 
                      onClick={() => openPgnModal(game.pgn)}
                      className="flex items-center space-x-2 text-green-600 hover:text-green-800 text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Full PGN</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* PGN Modal */}
      {pgnModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Full PGN</h3>
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

export default GameHistoryAccordion;