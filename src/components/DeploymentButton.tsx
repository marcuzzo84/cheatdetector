import React, { useState } from 'react';
import { Rocket, Loader2, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface DeploymentButtonProps {
  onSuccess?: (deployUrl: string) => void;
}

const DeploymentButton: React.FC<DeploymentButtonProps> = ({ onSuccess }) => {
  const { isAdmin } = useAuth();
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDeploy = async () => {
    if (!isAdmin) {
      setError('Only administrators can deploy the application');
      return;
    }

    setDeploying(true);
    setDeployStatus('deploying');
    setError(null);

    try {
      // This would be replaced with actual deployment logic
      // For now, we'll simulate a deployment process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate successful deployment
      const mockDeployUrl = 'https://fairplay-scout-dashboard.netlify.app';
      setDeployUrl(mockDeployUrl);
      setDeployStatus('success');
      
      if (onSuccess) {
        onSuccess(mockDeployUrl);
      }
    } catch (err) {
      console.error('Deployment error:', err);
      setDeployStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown deployment error');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleDeploy}
        disabled={deploying || !isAdmin}
        className="flex items-center justify-center space-x-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {deployStatus === 'deploying' ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Rocket className="w-5 h-5" />
        )}
        <span>
          {deployStatus === 'deploying' ? 'Deploying to Netlify...' : 'Deploy to Netlify'}
        </span>
      </button>

      {deployStatus === 'success' && deployUrl && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-green-800">Deployment Successful!</h4>
              <p className="text-sm text-green-700 mt-1">
                Your application has been successfully deployed to Netlify.
              </p>
              <a
                href={deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Deployed Site</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {deployStatus === 'error' && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Deployment Failed</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Admin Access Required</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Only administrators can deploy the application to Netlify.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentButton;