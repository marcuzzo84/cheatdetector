import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Filter, RefreshCw, Download, Plus, Trash2, Edit, Eye, ExternalLink, Users, AlertTriangle, CheckCircle, Clock, Loader2, Database, Star, Lock } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import DataImportModal from '../components/DataImportModal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PlayerGroup {
  id: string;
  name: string;
  description: string;
  player_count: number;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  owner_id: string;
}

interface TrackedPlayer {
  id: string;
  hash: string;
  elo: number;
  site: string;
  username: string;
  group_id: string;
  last_import: string;
  games_count: number;
  avg_suspicion: number;
  created_at: string;
}

const PlayerManagement: React.FC = () => {
  const { userProfile, isAdmin } = useAuth();
  const [playerGroups, setPlayerGroups] = useState<PlayerGroup[]>([]);
  const [trackedPlayers, setTrackedPlayers] = useState<TrackedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PlayerGroup | null>(null);
  
  // Form states
  const [newPlayerForm, setNewPlayerForm] = useState({
    username: '',
    site: 'chess.com' as 'chess.com' | 'lichess',
    group_id: '',
    notes: ''
  });
  
  const [newGroupForm, setNewGroupForm] = useState({
    name: '',
    description: '',
    is_public: false
  });

  // Check if user has premium access
  const hasPremiumAccess = isAdmin || userProfile?.role === 'premium' || userProfile?.role === 'pro';

  useEffect(() => {
    fetchPlayerGroups();
    fetchTrackedPlayers();
  }, []);

  const fetchPlayerGroups = async () => {
    try {
      setError(null);
      
      // Set a timeout for the query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 15000)
      );
      
      // Fetch player groups
      const queryPromise = supabase
        .from('player_groups')
        .select('*')
        .order('name', { ascending: true });

      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('Error fetching player groups:', error);
        setError(error.message);
        return;
      }

      // If no data, create mock data for demonstration
      if (!data || data.length === 0) {
        const mockGroups: PlayerGroup[] = [
          {
            id: '1',
            name: 'Top GMs',
            description: 'World\'s top grandmasters',
            player_count: 8,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_public: true,
            owner_id: userProfile?.id || ''
          },
          {
            id: '2',
            name: 'Suspicious Players',
            description: 'Players with high suspicion rates',
            player_count: 12,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_public: false,
            owner_id: userProfile?.id || ''
          },
          {
            id: '3',
            name: 'Tournament Participants',
            description: 'Players from recent tournaments',
            player_count: 24,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_public: true,
            owner_id: userProfile?.id || ''
          }
        ];
        setPlayerGroups(mockGroups);
      } else {
        setPlayerGroups(data);
      }
    } catch (err) {
      console.error('Error in fetchPlayerGroups:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTrackedPlayers = async () => {
    try {
      setError(null);
      
      // Set a timeout for the query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 15000)
      );
      
      // Fetch tracked players
      const queryPromise = supabase
        .from('tracked_players')
        .select(`
          *,
          player_groups (
            id,
            name
          )
        `)
        .order('username', { ascending: true });

      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('Error fetching tracked players:', error);
        setError(error.message);
        return;
      }

      // If no data, create mock data for demonstration
      if (!data || data.length === 0) {
        const mockPlayers: TrackedPlayer[] = [
          {
            id: '1',
            hash: 'chess.com_magnuscarlsen',
            elo: 2850,
            site: 'Chess.com',
            username: 'MagnusCarlsen',
            group_id: '1',
            last_import: new Date().toISOString(),
            games_count: 156,
            avg_suspicion: 12.4,
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            hash: 'lichess_drnykterstein',
            elo: 2863,
            site: 'Lichess',
            username: 'DrNykterstein',
            group_id: '1',
            last_import: new Date().toISOString(),
            games_count: 203,
            avg_suspicion: 10.8,
            created_at: new Date().toISOString()
          },
          {
            id: '3',
            hash: 'chess.com_hikaru',
            elo: 2810,
            site: 'Chess.com',
            username: 'Hikaru',
            group_id: '1',
            last_import: new Date().toISOString(),
            games_count: 178,
            avg_suspicion: 14.2,
            created_at: new Date().toISOString()
          },
          {
            id: '4',
            hash: 'chess.com_suspicious_player1',
            elo: 2150,
            site: 'Chess.com',
            username: 'SuspiciousPlayer1',
            group_id: '2',
            last_import: new Date().toISOString(),
            games_count: 42,
            avg_suspicion: 82.7,
            created_at: new Date().toISOString()
          },
          {
            id: '5',
            hash: 'lichess_suspicious_player2',
            elo: 2320,
            site: 'Lichess',
            username: 'SuspiciousPlayer2',
            group_id: '2',
            last_import: new Date().toISOString(),
            games_count: 67,
            avg_suspicion: 78.3,
            created_at: new Date().toISOString()
          }
        ];
        setTrackedPlayers(mockPlayers);
      } else {
        setTrackedPlayers(data);
      }
    } catch (err) {
      console.error('Error in fetchTrackedPlayers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPlayerGroups(), fetchTrackedPlayers()]);
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPlayerForm.username.trim() || !newPlayerForm.group_id) {
      setError('Username and group are required');
      return;
    }
    
    try {
      setLoading(true);
      
      // In a real implementation, this would create a tracked player record
      // and potentially trigger an initial import
      
      // For demo purposes, we'll just add to our local state
      const newPlayer: TrackedPlayer = {
        id: `new-${Date.now()}`,
        hash: `${newPlayerForm.site}_${newPlayerForm.username.toLowerCase()}`,
        elo: 1500, // Default until we get real data
        site: newPlayerForm.site === 'chess.com' ? 'Chess.com' : 'Lichess',
        username: newPlayerForm.username,
        group_id: newPlayerForm.group_id,
        last_import: 'Never',
        games_count: 0,
        avg_suspicion: 0,
        created_at: new Date().toISOString()
      };
      
      setTrackedPlayers([...trackedPlayers, newPlayer]);
      
      // Reset form
      setNewPlayerForm({
        username: '',
        site: 'chess.com',
        group_id: '',
        notes: ''
      });
      
      setShowAddPlayerModal(false);
    } catch (err) {
      console.error('Error adding player:', err);
      setError(err instanceof Error ? err.message : 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newGroupForm.name.trim()) {
      setError('Group name is required');
      return;
    }
    
    try {
      setLoading(true);
      
      // In a real implementation, this would create a player group record
      
      // For demo purposes, we'll just add to our local state
      const newGroup: PlayerGroup = {
        id: `new-${Date.now()}`,
        name: newGroupForm.name,
        description: newGroupForm.description,
        player_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_public: newGroupForm.is_public,
        owner_id: userProfile?.id || ''
      };
      
      setPlayerGroups([...playerGroups, newGroup]);
      
      // Reset form
      setNewGroupForm({
        name: '',
        description: '',
        is_public: false
      });
      
      setShowAddGroupModal(false);
    } catch (err) {
      console.error('Error adding group:', err);
      setError(err instanceof Error ? err.message : 'Failed to add group');
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingGroup || !editingGroup.name.trim()) {
      setError('Group name is required');
      return;
    }
    
    try {
      setLoading(true);
      
      // In a real implementation, this would update the player group record
      
      // For demo purposes, we'll just update our local state
      const updatedGroups = playerGroups.map(group => 
        group.id === editingGroup.id ? editingGroup : group
      );
      
      setPlayerGroups(updatedGroups);
      setShowEditGroupModal(false);
      setEditingGroup(null);
    } catch (err) {
      console.error('Error updating group:', err);
      setError(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to remove this player from tracking?')) {
      return;
    }
    
    try {
      // In a real implementation, this would delete the tracked player record
      
      // For demo purposes, we'll just update our local state
      setTrackedPlayers(trackedPlayers.filter(player => player.id !== playerId));
    } catch (err) {
      console.error('Error deleting player:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete player');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? All player associations will be removed.')) {
      return;
    }
    
    try {
      // In a real implementation, this would delete the player group record
      
      // For demo purposes, we'll just update our local state
      setPlayerGroups(playerGroups.filter(group => group.id !== groupId));
      
      // Also update any players that were in this group
      setTrackedPlayers(trackedPlayers.map(player => 
        player.group_id === groupId 
          ? { ...player, group_id: '' } 
          : player
      ));
    } catch (err) {
      console.error('Error deleting group:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    }
  };

  const getSuspicionBadge = (level: number) => {
    if (level >= 70) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          High Risk
        </span>
      );
    }
    if (level >= 40) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <Clock className="w-3 h-3 mr-1" />
          Suspicious
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Clean
      </span>
    );
  };

  const filteredPlayers = trackedPlayers.filter(player => {
    const matchesSearch = player.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          player.hash.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = selectedGroup ? player.group_id === selectedGroup : true;
    
    return matchesSearch && matchesGroup;
  });

  if (loading && playerGroups.length === 0 && trackedPlayers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Player Management</h1>
            <p className="text-gray-600">Loading player tracking system...</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
            <p className="text-gray-500">Loading player data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link to="/dashboard" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Player Management</h1>
          <p className="text-gray-600">Track and organize players across different chess platforms</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Import Games</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Premium Access Banner */}
      {!hasPremiumAccess && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Star className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-900">Premium Feature</h4>
              <p className="text-sm text-blue-700 mt-1">
                Player management is a premium feature. Upgrade to <strong>Premium</strong> or <strong>Pro</strong> to create custom player groups, track specific players, and get advanced analytics.
              </p>
              <button className="mt-2 inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm">
                <Star className="w-3 h-3 mr-1" />
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Player Groups Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Player Groups</h3>
              <button
                onClick={() => setShowAddGroupModal(true)}
                className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                title="Add Group"
                disabled={!hasPremiumAccess}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => setSelectedGroup(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  selectedGroup === null
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>All Players</span>
                </div>
                <span className="text-sm bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                  {trackedPlayers.length}
                </span>
              </button>
              
              {playerGroups.map(group => (
                <div key={group.id} className="relative group">
                  <button
                    onClick={() => setSelectedGroup(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                      selectedGroup === group.id
                        ? 'bg-blue-100 text-blue-800'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${group.is_public ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                      <span>{group.name}</span>
                    </div>
                    <span className="text-sm bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                      {trackedPlayers.filter(p => p.group_id === group.id).length}
                    </span>
                  </button>
                  
                  {/* Hover actions */}
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 hidden group-hover:flex items-center space-x-1 pr-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingGroup(group);
                        setShowEditGroupModal(true);
                      }}
                      className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                      title="Edit Group"
                      disabled={!hasPremiumAccess}
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                      title="Delete Group"
                      disabled={!hasPremiumAccess}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {playerGroups.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <p>No player groups yet</p>
                <p className="text-sm">Create groups to organize players</p>
              </div>
            )}
          </div>
          
          {/* Group Details */}
          {selectedGroup && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Group Details</h3>
              
              {playerGroups.filter(g => g.id === selectedGroup).map(group => (
                <div key={group.id} className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500">Name:</span>
                    <p className="font-medium text-gray-900">{group.name}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">Description:</span>
                    <p className="text-gray-700">{group.description || 'No description'}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">Visibility:</span>
                    <p className="flex items-center space-x-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        group.is_public ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {group.is_public ? 'Public' : 'Private'}
                      </span>
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">Created:</span>
                    <p className="text-gray-700">{new Date(group.created_at).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="pt-2 flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingGroup(group);
                        setShowEditGroupModal(true);
                      }}
                      className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors text-sm"
                      disabled={!hasPremiumAccess}
                    >
                      <Edit className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors text-sm"
                      disabled={!hasPremiumAccess}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Players List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">Tracked Players</h3>
                <p className="text-sm text-gray-600">
                  {selectedGroup 
                    ? `Players in ${playerGroups.find(g => g.id === selectedGroup)?.name || 'selected group'}`
                    : 'All tracked players'
                  }
                </p>
              </div>
              
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <button
                  onClick={() => setShowAddPlayerModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  disabled={!hasPremiumAccess}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Player</span>
                </button>
              </div>
            </div>
            
            {/* Players Table */}
            {filteredPlayers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Site
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Elo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Group
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Games
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Suspicion
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Import
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {player.username}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            player.site === 'Chess.com' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {player.site}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {player.elo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {playerGroups.find(g => g.id === player.group_id)?.name || 'None'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {player.games_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getSuspicionBadge(player.avg_suspicion)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {player.last_import === 'Never' 
                            ? 'Never' 
                            : new Date(player.last_import).toLocaleDateString()
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Link
                              to={`/players/${player.hash}`}
                              className="text-blue-600 hover:text-blue-800"
                              title="View Player"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <a
                              href={`https://${player.site.toLowerCase().replace('.com', '')}.org/@/${player.username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                              title="View on Site"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDeletePlayer(player.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Remove from Tracking"
                              disabled={!hasPremiumAccess}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                {searchTerm ? (
                  <div>
                    <Search className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">No players match your search</p>
                  </div>
                ) : selectedGroup ? (
                  <div>
                    <Users className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">No players in this group</p>
                    <button
                      onClick={() => setShowAddPlayerModal(true)}
                      className="mt-2 inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                      disabled={!hasPremiumAccess}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Player
                    </button>
                  </div>
                ) : (
                  <div>
                    <Database className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600">No players are being tracked</p>
                    <button
                      onClick={() => setShowAddPlayerModal(true)}
                      className="mt-2 inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                      disabled={!hasPremiumAccess}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Start Tracking Players
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Feature Description */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Users className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Player Tracking System</h4>
                <p className="text-sm text-blue-700 mt-1">
                  The player management system allows you to organize players into groups and track them over time. 
                  You can set up automatic imports, monitor specific players, and get alerts when suspicious activity is detected.
                </p>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-blue-700">Organize players into groups</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-blue-700">Track players across platforms</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-blue-700">Schedule automatic imports</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-blue-700">Get alerts for suspicious activity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add Player to Track</h3>
                <button
                  onClick={() => setShowAddPlayerModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleAddPlayer} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={newPlayerForm.username}
                    onChange={(e) => setNewPlayerForm({...newPlayerForm, username: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., MagnusCarlsen"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="site" className="block text-sm font-medium text-gray-700 mb-1">
                    Chess Platform
                  </label>
                  <select
                    id="site"
                    value={newPlayerForm.site}
                    onChange={(e) => setNewPlayerForm({...newPlayerForm, site: e.target.value as 'chess.com' | 'lichess'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="chess.com">Chess.com</option>
                    <option value="lichess">Lichess</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="group" className="block text-sm font-medium text-gray-700 mb-1">
                    Player Group
                  </label>
                  <select
                    id="group"
                    value={newPlayerForm.group_id}
                    onChange={(e) => setNewPlayerForm({...newPlayerForm, group_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a group</option>
                    {playerGroups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    value={newPlayerForm.notes}
                    onChange={(e) => setNewPlayerForm({...newPlayerForm, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Add any notes about this player..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddPlayerModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Add Player
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create Player Group</h3>
                <button
                  onClick={() => setShowAddGroupModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleAddGroup} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newGroupForm.name}
                    onChange={(e) => setNewGroupForm({...newGroupForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Top GMs"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={newGroupForm.description}
                    onChange={(e) => setNewGroupForm({...newGroupForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Describe this group..."
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={newGroupForm.is_public}
                    onChange={(e) => setNewGroupForm({...newGroupForm, is_public: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_public" className="ml-2 block text-sm text-gray-700">
                    Make this group public
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddGroupModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Create Group
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && editingGroup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Player Group</h3>
                <button
                  onClick={() => {
                    setShowEditGroupModal(false);
                    setEditingGroup(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleEditGroup} className="space-y-4">
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    id="edit-name"
                    value={editingGroup.name}
                    onChange={(e) => setEditingGroup({...editingGroup, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    value={editingGroup.description}
                    onChange={(e) => setEditingGroup({...editingGroup, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-is_public"
                    checked={editingGroup.is_public}
                    onChange={(e) => setEditingGroup({...editingGroup, is_public: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="edit-is_public" className="ml-2 block text-sm text-gray-700">
                    Make this group public
                  </label>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditGroupModal(false);
                      setEditingGroup(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <DataImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          handleRefresh();
        }}
      />
    </div>
  );
};

export default PlayerManagement;