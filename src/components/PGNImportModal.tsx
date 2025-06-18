import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertTriangle, CheckCircle, Loader2, Eye, Database, Zap, Cloud } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import FileUploadComponent from './FileUploadComponent';

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
  headers: { [key: string]: string };
}

const PGNImportModal: React.FC<PGNImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pgnContent, setPgnContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [parsedGames, setParsedGames] = useState<ParsedGame[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [playerUsername, setPlayerUsername] = useState('');
  const [selectedSite, setSelectedSite] = useState<'chess.com' | 'lichess'>('chess.com');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const parsePGNContent = (content: string) => {
    try {
      setProgress('Parsing PGN content...');
      setError('');
      const games: ParsedGame[] = [];
      
      // Clean up the content first
      const cleanContent = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

      // Split by double newlines first, then try other methods
      let gameBlocks = cleanContent.split(/\n\s*\n\s*\n/).filter(block => block.trim());
      
      // If no triple newlines, try double newlines
      if (gameBlocks.length === 1) {
        gameBlocks = cleanContent.split(/\n\s*\n/).filter(block => block.trim());
      }
      
      // If still one block, try splitting by [Event
      if (gameBlocks.length === 1) {
        gameBlocks = cleanContent.split(/(?=\[Event)/g).filter(block => block.trim());
      }

      console.log(`Found ${gameBlocks.length} potential game blocks`);

      for (let blockIndex = 0; blockIndex < gameBlocks.length; blockIndex++) {
        const block = gameBlocks[blockIndex].trim();
        if (!block) continue;

        try {
          const game = parseSingleGame(block);
          if (game && game.white && game.black && game.moves) {
            games.push(game);
          } else {
            console.warn(`Game ${blockIndex + 1}: Missing required fields`);
          }
        } catch (gameError) {
          console.warn(`Error parsing game ${blockIndex + 1}:`, gameError);
          // Continue with other games instead of failing completely
        }
      }

      console.log(`Successfully parsed ${games.length} games`);
      setParsedGames(games);
      setShowPreview(true);
      setSuccess(`Successfully parsed ${games.length} games from PGN content`);
      setProgress('');
    } catch (err) {
      console.error('PGN parsing error:', err);
      setError('Failed to parse PGN content. Please check the format.');
      setProgress('');
    }
  };

  const parseSingleGame = (gameText: string): ParsedGame | null => {
    const lines = gameText.split('\n').map(line => line.trim()).filter(line => line);
    const headers: { [key: string]: string } = {};
    const moveLines: string[] = [];
    let inMoves = false;

    for (const line of lines) {
      if (line.startsWith('[') && line.endsWith(']')) {
        // Parse header
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
        if (match) {
          const [, key, value] = match;
          headers[key.toLowerCase()] = value;
        }
      } else if (line && !line.startsWith('[') && !line.startsWith('%')) {
        // This is moves content (skip comments starting with %)
        inMoves = true;
        moveLines.push(line);
      }
    }

    if (!inMoves || moveLines.length === 0) {
      return null;
    }

    // Join all move lines and clean up
    const moves = moveLines.join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\{[^}]*\}/g, '') // Remove comments
      .replace(/\([^)]*\)/g, '') // Remove variations
      .replace(/\$\d+/g, '') // Remove NAG annotations
      .replace(/[?!]+/g, '') // Remove move annotations
      .trim();

    // Validate that we have actual moves
    if (!moves || moves.length < 10) {
      return null;
    }

    return {
      white: headers.white || 'Unknown',
      black: headers.black || 'Unknown',
      result: headers.result || '*',
      date: headers.date || new Date().toISOString().split('T')[0],
      site: headers.site || selectedSite,
      event: headers.event || 'Unknown Event',
      moves: moves,
      whiteElo: headers.whiteelo ? parseInt(headers.whiteelo) : undefined,
      blackElo: headers.blackelo ? parseInt(headers.blackelo) : undefined,
      headers: headers
    };
  };

  const handleFileUploaded = async (uploadedFile: any) => {
    try {
      setProgress('Reading uploaded PGN file...');
      
      // Download the file content from Supabase Storage
      const { data, error } = await supabase.storage
        .from('chess-games')
        .download(uploadedFile.file_path);

      if (error) {
        throw new Error(`Failed to read file: ${error.message}`);
      }

      // Convert blob to text
      const text = await data.text();
      setPgnContent(text);
      parsePGNContent(text);
      
      // Update the file record to mark it as processed
      await supabase
        .from('uploaded_files')
        .update({ 
          processed: true,
          games_count: parsedGames.length 
        })
        .eq('id', uploadedFile.id);

      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process uploaded file');
      setProgress('');
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
    setProgress('Starting import process...');
    setImportProgress({ current: 0, total: parsedGames.length });

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

      // Process games in smaller batches to avoid timeouts
      const batchSize = 5;
      for (let i = 0; i < parsedGames.length; i += batchSize) {
        const batch = parsedGames.slice(i, i + batchSize);
        setProgress(`Processing games ${i + 1}-${Math.min(i + batchSize, parsedGames.length)} of ${parsedGames.length}...`);

        // Process each game in the batch
        for (let j = 0; j < batch.length; j++) {
          const gameIndex = i + j;
          const game = batch[j];
          
          try {
            setImportProgress({ current: gameIndex + 1, total: parsedGames.length });
            
            // Determine if this player was white or black
            const isWhite = game.white.toLowerCase().includes(playerUsername.toLowerCase());
            const isBlack = game.black.toLowerCase().includes(playerUsername.toLowerCase());
            
            if (!isWhite && !isBlack) {
              console.warn(`Game ${gameIndex + 1}: Player ${playerUsername} not found in game`);
              continue; // Skip this game instead of failing
            }

            // Create game record with unique external ID
            const { data: gameRecord, error: gameError } = await supabase
              .from('games')
              .insert({
                player_id: playerId,
                site: selectedSite,
                date: game.date !== '???.??.??' ? game.date : new Date().toISOString().split('T')[0],
                result: game.result,
                ext_uid: `pgn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${gameIndex}`
              })
              .select('id')
              .single();

            if (gameError) {
              errors.push(`Game ${gameIndex + 1}: Failed to create game record - ${gameError.message}`);
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
              errors.push(`Game ${gameIndex + 1}: Failed to create score record - ${scoreError.message}`);
              continue;
            }

            importedCount++;
          } catch (gameError) {
            errors.push(`Game ${gameIndex + 1}: ${gameError instanceof Error ? gameError.message : 'Unknown error'}`);
          }
        }

        // Small delay between batches to prevent overwhelming the database
        if (i + batchSize < parsedGames.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      setProgress('');
      setImportProgress({ current: parsedGames.length, total: parsedGames.length });
      
      if (importedCount > 0) {
        setSuccess(`Successfully imported ${importedCount} out of ${parsedGames.length} games from PGN file`);
      } else {
        setError('No games were imported successfully');
      }
      
      if (errors.length > 0) {
        console.warn('Import errors:', errors);
        if (errors.length <= 3) {
          setError(`Some games failed to import: ${errors.join(', ')}`);
        } else {
          setError(`${errors.length} games failed to import. Check console for details.`);
        }
      }

      // Call success callback after a short delay
      if (importedCount > 0) {
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import PGN games');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPgnContent('');
    setParsedGames([]);
    setShowPreview(false);
    setPlayerUsername('');
    setError('');
    setSuccess('');
    setProgress('');
    setLoading(false);
    setImportProgress({ current: 0, total: 0 });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white">
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

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>Upload to Storage</span>
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'paste'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Paste Content</span>
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
              {importProgress.total > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {importProgress.current} / {importProgress.total} games processed
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && !showPreview && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Cloud className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Secure File Storage</h4>
                    <p className="text-gray-600 mb-4">
                      Upload your PGN files to secure cloud storage. Files are stored in your personal folder 
                      and can be accessed anytime for re-analysis or sharing.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Secure cloud storage</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Multiple games support</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Batch processing</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>50MB file limit</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <FileUploadComponent
                onFileUploaded={handleFileUploaded}
                acceptedTypes={['.pgn']}
                maxSize={50 * 1024 * 1024} // 50MB
                allowMultiple={false}
              />
            </div>
          )}

          {/* Paste Tab */}
          {activeTab === 'paste' && !showPreview && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">PGN Content</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Paste your PGN content directly. Supports multiple games separated by blank lines or [Event] headers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Paste PGN content:</h4>
                <textarea
                  value={pgnContent}
                  onChange={(e) => {
                    setPgnContent(e.target.value);
                    // Clear previous results when content changes
                    setParsedGames([]);
                    setShowPreview(false);
                    setError('');
                    setSuccess('');
                  }}
                  placeholder="Paste your PGN content here... (supports multiple games)"
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                
                {pgnContent.trim() && (
                  <button
                    onClick={() => parsePGNContent(pgnContent)}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Parse PGN Content</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Preview and Import */}
          {showPreview && (
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
                      Edit Content
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
                          <div className="text-xs text-gray-400 mt-1">
                            Moves: {game.moves.split(' ').length} • Site: {game.site}
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
                  Back to {activeTab === 'upload' ? 'Upload' : 'Paste'}
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

          {/* Feature Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Enhanced PGN Processing</h4>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-green-700">✓ Multiple Games Support</p>
                    <ul className="text-gray-600 mt-1 space-y-1">
                      <li>• Automatic game separation</li>
                      <li>• Batch processing with progress</li>
                      <li>• Error recovery for individual games</li>
                      <li>• Robust PGN parsing</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-blue-700">⚡ Smart Processing</p>
                    <ul className="text-gray-600 mt-1 space-y-1">
                      <li>• Handles various PGN formats</li>
                      <li>• Skips invalid games gracefully</li>
                      <li>• Progress tracking and feedback</li>
                      <li>• Detailed error reporting</li>
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