import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, ExternalLink, Trash2, AlertTriangle, CheckCircle, Clock, Download } from 'lucide-react';

interface TrackedPlayerRowProps {
  id: string;
  hash: string;
  username: string;
  site: string;
  elo: number;
  groupName: string;
  gamesCount: number;
  avgSuspicion: number;
  lastImport: string;
  onDelete: (id: string) => void;
  onImport: (id: string, username: string, site: string) => void;
}

const TrackedPlayerRow: React.FC<TrackedPlayerRowProps> = ({
  id,
  hash,
  username,
  site,
  elo,
  groupName,
  gamesCount,
  avgSuspicion,
  lastImport,
  onDelete,
  onImport
}) => {
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

  const formatLastImport = (dateString: string) => {
    if (dateString === 'Never') return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {username}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          site === 'Chess.com' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
        }`}>
          {site}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {elo}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-900">
          {groupName || 'None'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {gamesCount}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getSuspicionBadge(avgSuspicion)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatLastImport(lastImport)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          <Link
            to={`/players/${hash}`}
            className="text-blue-600 hover:text-blue-800"
            title="View Player"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <a
            href={`https://${site.toLowerCase().replace('.com', '')}.org/@/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800"
            title="View on Site"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={() => onImport(id, username, site)}
            className="text-green-600 hover:text-green-800"
            title="Import Games"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(id)}
            className="text-red-600 hover:text-red-800"
            title="Remove from Tracking"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default TrackedPlayerRow;