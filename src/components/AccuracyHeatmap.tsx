import React from 'react';

interface AccuracyData {
  move: number;
  accuracy: number;
}

interface AccuracyHeatmapProps {
  data: AccuracyData[];
}

const AccuracyHeatmap: React.FC<AccuracyHeatmapProps> = ({ data }) => {
  const getHeatmapColor = (accuracy: number) => {
    if (accuracy >= 95) return 'bg-red-500';
    if (accuracy >= 90) return 'bg-red-400';
    if (accuracy >= 85) return 'bg-orange-400';
    if (accuracy >= 80) return 'bg-yellow-400';
    if (accuracy >= 75) return 'bg-green-300';
    return 'bg-green-500';
  };

  const getIntensity = (accuracy: number) => {
    return Math.min(accuracy / 100, 1);
  };

  // Group data into rows of 10 moves each
  const rows = [];
  for (let i = 0; i < data.length; i += 10) {
    rows.push(data.slice(i, i + 10));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-600">Move Number</span>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>Low Accuracy</span>
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <div className="w-3 h-3 bg-green-300 rounded"></div>
            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
            <div className="w-3 h-3 bg-orange-400 rounded"></div>
            <div className="w-3 h-3 bg-red-400 rounded"></div>
            <div className="w-3 h-3 bg-red-500 rounded"></div>
          </div>
          <span>High Accuracy</span>
        </div>
      </div>
      
      <div className="space-y-1">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex space-x-1">
            {row.map((cell) => (
              <div
                key={cell.move}
                className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium text-white cursor-pointer hover:scale-110 transition-transform ${getHeatmapColor(cell.accuracy)}`}
                style={{ opacity: getIntensity(cell.accuracy) }}
                title={`Move ${cell.move}: ${cell.accuracy}% accuracy`}
              >
                {cell.move}
              </div>
            ))}
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Hover over cells to see detailed accuracy for each move.</p>
        <p>Red cells indicate suspiciously high accuracy (95%+)</p>
      </div>
    </div>
  );
};

export default AccuracyHeatmap;