import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Trophy, ExternalLink } from 'lucide-react';

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

  const toggleGame = (gameId: string) => {
    setExpandedGame(expandedGame === gameId ? null : gameId);
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

  return (
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
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">PGN Preview</h4>
                  <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{game.pgn}</pre>
                  </div>
                  <button className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm">
                    <ExternalLink className="w-4 h-4" />
                    <span>View Full PGN</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default GameHistoryAccordion;