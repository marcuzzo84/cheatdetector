import React from 'react';
import { Users, Eye, Lock, Edit, Trash2, UserPlus, Calendar, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PlayerGroupCardProps {
  id: string;
  name: string;
  description: string;
  playerCount: number;
  isPublic: boolean;
  lastUpdated: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAddPlayer: (groupId: string) => void;
}

const PlayerGroupCard: React.FC<PlayerGroupCardProps> = ({
  id,
  name,
  description,
  playerCount,
  isPublic,
  lastUpdated,
  onEdit,
  onDelete,
  onAddPlayer
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                isPublic ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
              }`}>
                {isPublic ? (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Public
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 mr-1" />
                    Private
                  </>
                )}
              </span>
              <span className="text-xs text-gray-500">
                Updated {new Date(lastUpdated).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => onEdit(id)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit Group"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(id)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete Group"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        {description || 'No description provided'}
      </p>
      
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <span className="text-gray-500">Players</span>
          <p className="font-semibold text-gray-900">{playerCount}</p>
        </div>
        <div>
          <span className="text-gray-500">Status</span>
          <p className="flex items-center space-x-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>Active</span>
          </p>
        </div>
      </div>
      
      <div className="flex space-x-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => onAddPlayer(id)}
          className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors text-sm"
        >
          <UserPlus className="w-3 h-3" />
          <span>Add Player</span>
        </button>
        <Link
          to={`/player-management?group=${id}`}
          className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors text-sm"
        >
          <Eye className="w-3 h-3" />
          <span>View Players</span>
        </Link>
      </div>
    </div>
  );
};

export default PlayerGroupCard;