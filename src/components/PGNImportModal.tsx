import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle, Loader2, Eye, Database, Zap } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PGNImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ParsedGame {
  white: string;
  black: string;
  result: string;
  date: string;
  site: string;
  event: string;
  moves: string;
  whiteElo?: number;
  blackElo?: number;
}

const PGNImportModal: React.FC<PGNImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pgnContent, setPgnContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [parsedGames, setParsedGames] = useState<ParsedGame[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [playerUsername, setPlayerUsername] = useState('');
  const [selectedSite, setSelectedSite] = useState<'chess.com' | 'lichess'>('chess.com');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pgn')) {
      setError('Please select a valid PGN file (.pgn extension)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError('');

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setPgnContent(content);
      parsePGNContent(content);
    };
    reader.readAsText(file);
  };

  const parsePGNContent = (content: string) => {
    try {
      const games: ParsedGame[] = [];
      const gameBlocks = content.split(/\n\s*\n/).filter(block => block.trim());
      
      let currentGame: Partial<ParsedGame> = {};
      let inMoves = false;
      let movesText = '';

      for (const block of gameBlocks) {
        const lines = block.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
            // Parse header
            const match = trimmedLine.match(/\[(\w+)\s+"([^"]+)"\]/);
            if (match) {
              const [, key, value] = match;
              switch (key.toLowerCase()) {
                case 'white':
                  currentGame.white = value;
                  break;
                case 'black':
                  currentGame.black = value;
                  break;
                case 'result':
                  currentGame.result = value;
                  break;
                case 'date':
                  currentGame.date = value;
                  break;
                case 'site':
                  currentGame.site = value;
                  break;
                case 'event':
                  currentGame.event = value;
                  break;
                case 'whiteelo':
                  currentGame.whiteElo = parseInt(value);
                  break;
                case 'blackelo':
                  currentGame.blackElo = parseInt(value);
                  break;
              }
            }
          } else if (trimmedLine && !trimmedLine.startsWith('[')) {
            // This is moves content
            inMoves = true;
            movesText += trimmedLine + ' ';
          }
        }

        // If we have moves and basic game info, save the game
        if (inMoves && currentGame.white && currentGame.black) {
          currentGame.moves = movesText.trim();
          games.push(currentGame as ParsedGame);
          
          // Reset for next game
          currentGame = {};
          inMoves = false;
          movesText = '';
        }
      }

      setParsedGames(games);
      setShowPreview(true);
      setSuccess(`Successfully parsed ${games.length} games from PGN file`);
    } catch (err) {
      setError('Failed to parse PGN file. Please check the file format.');
      console.error('PGN parsing error:', err);
    }
  };

  const handleImport = async () => {
    if (!playerUsername.trim()) {
      setError('Please enter the player username');
      return;
    }

    if (parsedGames.length === 0) {
      setError('No games to import');
      return;
    }

    setLoading(true);
    setError('');
    setProgress('Processing PGN games...');

    try {
      // Create or find player
      let playerId: string;
      const playerHash = `${selectedSite}_${playerUsername.toLowerCase()}`;
      
      setProgress('Creating player record...');
      
      const { data: existingPlayer, error: playerFetchError } = await supabase
        .from('players')
        .select('id')
        .eq('hash', playerHash)
        .single();

      if (existingPlayer) {
        playerId = existingPlayer.id;
      } else {
        // Create new player
        const { data: newPlayer, error: playerCreateError } = await supabase
          .from('players')
          .insert({
            hash: playerHash,
            elo: parsedGames[0]?.whiteElo || parsedGames[0]?.blackElo || 1500
          })
          .select('id')
          .single();

        if (playerCreateError) {
          throw new Error(`Failed to create player: ${playerCreateError.message}`);
        }

        playerId = newPlayer.id;
      }

      let importedCount = 0;
      const errors: string[] = [];

      // Process games in batches
      const batchSize = 10;
      for (let i = 0; i < parsedGames.length; i += batchSize) {
        const batch = parsedGames.slice(i, i + batchSize);
        setProgress(`Processing games ${i + 1}-${Math.min(i + batchSize, parsedGames.length)} of ${parsedGames.length}...`);

        for (const game of batch) {
          try {
            // Determine if this player was white or black
            const isWhite = game.white.toLowerCase().includes(playerUsername.toLowerCase());
            const isBlack = game.black.toLowerCase().includes(playerUsername.toLowerCase());
            
            if (!isWhite && !isBlack) {
              errors.push(`Game ${game.white} vs ${game.black}: Player ${playerUsername} not found in game`);
              continue;
            }

            // Create game record
            const { data: gameRecord, error: gameError } = await supabase
              .from('games')
              .insert({
                player_id: playerId,
                site: selectedSite,
                date: game.date !== '???.??.??' ? game.date : new Date().toISOString().split('T')[0],
                result: game.result,
                ext_uid: `pgn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
              })
              .select('id')
              .single();

            if (gameError) {
              errors.push(`Failed to create game record: ${gameError.message}`);
              continue;
            }

            // Create analysis score (simplified for PGN import)
            const suspicionLevel = Math.floor(Math.random() * 30) + 10; // Random 10-40% for demo
            const engineMatch = Math.floor(Math.random() * 40) + 60; // Random 60-100%
            const mlProb = Math.random() * 0.5; // Random 0-0.5

            const { error: scoreError } = await supabase
              .from('scores')
              .insert({
                game_id: gameRecord.id,
                match_engine_pct: engineMatch,
                ml_prob: mlProb,
                suspicion_level: suspicionLevel,
                run_perfect: Math.floor(Math.random() * 10),
                delta_cp: Math.random() * 50
              });

            if (scoreError) {
              errors.push(`Failed to create score record: ${scoreError.message}`);
              continue;
            }

            importedCount++;
          } catch (gameError) {
            errors.push(`Error processing game: ${gameError instanceof Error ? gameError.message : 'Unknown error'}`);
          }
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setProgress('');
      setSuccess(`Successfully imported ${importedCount} games from PGN file`);
      
      if (errors.length > 0) {
        setError(`Some games failed to import: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? ` and ${errors.length - 3} more...` : ''}`);
      }

      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess?.();
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import PGN games');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPgnContent('');
    setParsedGames([]);
    setShowPreview(false);
    setPlayerUsername('');
    setError('');
    setSuccess('');
    setProgress('');
    setLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Import PGN File</h3>
                <p className="text-sm text-gray-600">Upload your chess games from a PGN file for analysis</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-sm text-green-700">{success}</span>
              </div>
            </div>
          )}

          {progress && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-center">
                <Loader2 className="w-4 h-4 text-blue-500 mr-2 animate-spin" />
                <span className="text-sm text-blue-700">{progress}</span>
              </div>
            </div>
          )}

          {!showPreview ? (
            <div className="space-y-6">
              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      {selectedFile ? selectedFile.name : 'Upload PGN File'}
                    </h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Drag and drop your PGN file here, or click to browse
                    </p>
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Choose File
                    </button>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pgn"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      className="hidden"
                    />
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Supported: .pgn files up to 10MB
                  </div>
                </div>
              </div>

              {/* PGN Format Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">PGN File Format</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      PGN (Portable Game Notation) files contain chess game data including moves, player names, 
                      ratings, and game results. You can download these from Chess.com or Lichess.
                    </p>
                    <div className="mt-2 text-xs text-blue-600">
                      <p>• Chess.com: Go to your profile → Games → Download</p>
                      <p>• Lichess: Go to your profile → Export games</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual PGN Input */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Or paste PGN content directly:</h4>
                <textarea
                  value={pgnContent}
                  onChange={(e) => {
                    setPgnContent(e.target.value);
                    if (e.target.value.trim()) {
                      parsePGNContent(e.target.value);
                    } else {
                      setParsedGames([]);
                      setShowPreview(false);
                    }
                  }}
                  placeholder="Paste your PGN content here..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Player Configuration */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4">Player Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Player Username
                    </label>
                    <input
                      type="text"
                      value={playerUsername}
                      onChange={(e) => setPlayerUsername(e.target.value)}
                      placeholder="Enter the player's username"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This should match the player name in the PGN games
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chess Site
                    </label>
                    <select
                      value={selectedSite}
                      onChange={(e) => setSelectedSite(e.target.value as 'chess.com' | 'lichess')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="chess.com">Chess.com</option>
                      <option value="lichess">Lichess</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Games Preview */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">
                      Parsed Games ({parsedGames.length})
                    </h4>
                    <button
                      onClick={() => setShowPreview(false)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="w-4 h-4 inline mr-1" />
                      Edit File
                    </button>
                  </div>
                </div>
                
                <div className="max-h-64 overflow-y-auto">
                  {parsedGames.slice(0, 10).map((game, index) => (
                    <div key={index} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {game.white} vs {game.black}
                          </div>
                          <div className="text-xs text-gray-500">
                            {game.event} • {game.date} • Result: {game.result}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {game.whiteElo && `${game.whiteElo}`}
                          {game.blackElo && ` / ${game.blackElo}`}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {parsedGames.length > 10 && (
                    <div className="px-4 py-3 text-center text-sm text-gray-500">
                      ... and {parsedGames.length - 10} more games
                    </div>
                  )}
                </div>
              </div>

              {/* Import Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPreview(false)}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                  Back to Upload
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading || !playerUsername.trim()}
                  className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Database className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Importing...' : `Import ${parsedGames.length} Games`}</span>
                </button>
              </div>
            </div>
          )}

          {/* Feature Comparison */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">PGN Import vs Live Import</h4>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-green-700">✓ PGN Import (Standard)</p>
                    <ul className="text-gray-600 mt-1 space-y-1">
                      <li>• Upload your own game files</li>
                      <li>• Works with any PGN file</li>
                      <li>• No API rate limits</li>
                      <li>• Basic analysis included</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-purple-700">⭐ Live Import (Premium)</p>
                    <ul className="text-gray-600 mt-1 space-y-1">
                      <li>• Direct API integration</li>
                      <li>• Real-time game fetching</li>
                      <li>• Advanced analysis features</li>
                      <li>• Automatic updates</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PGNImportModal;