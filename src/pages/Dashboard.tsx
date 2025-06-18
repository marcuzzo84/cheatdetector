import React, { useState } from 'react';
import { Eye, Download, Database, Loader2, Star, Lock } from 'lucide-react';
import SuspicionChart from '../components/SuspicionChart';
import RealtimeScoreStream from '../components/RealtimeScoreStream';
import LiveKPICards from '../components/LiveKPICards';
import LiveSuspiciousScoresTable from '../components/LiveSuspiciousScoresTable';
import DataImportModal from '../components/DataImportModal';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showChartDetails, setShowChartDetails] = useState(false);
  const { userProfile, isAdmin } = useAuth();

  // Check if user has premium access
  const hasPremiumAccess = isAdmin || userProfile?.role === 'premium' || userProfile?.role === 'pro';
  const userTier = userProfile?.role || 'free';

  const handleImportSuccess = () => {
    setRefreshing(true);
    // Refresh the page or trigger data reload
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleRefreshData = () => {
    setRefreshing(true);
    // Force refresh all components
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleViewChartDetails = () => {
    setShowChartDetails(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            {userTier !== 'free' && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                userTier === 'premium' ? 'bg-yellow-100 text-yellow-800' :
                userTier === 'pro' ? 'bg-blue-100 text-blue-800' :
                userTier === 'admin' || userTier === 'administrator' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                <Star className="w-4 h-4 mr-1" />
                {userTier === 'premium' ? 'Premium' : 
                 userTier === 'pro' ? 'Pro' : 
                 userTier === 'admin' || userTier === 'administrator' ? 'Admin' : 'Free'}
              </span>
            )}
          </div>
          <p className="mt-2 text-gray-600">Real-time chess game analysis and suspicion monitoring</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefreshData}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Import Game Data</span>
          </button>
          {!hasPremiumAccess && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-colors shadow-md"
            >
              <Star className="w-4 h-4" />
              <span>Upgrade</span>
            </button>
          )}
        </div>
      </div>

      {/* Subscription Banner for Free Users */}
      {!hasPremiumAccess && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Star className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900">You're using the Free plan</h4>
              <p className="text-sm text-blue-700 mt-1">
                Upgrade to <strong>Premium</strong> or <strong>Pro</strong> to unlock live API imports, real-time updates, and advanced analytics.
              </p>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Star className="w-3 h-3 inline mr-1" />
                  View Plans
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-md hover:bg-green-200 transition-colors"
                >
                  Upload PGN Files
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Import Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Database className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Get Started with Real Data</h4>
            <p className="text-sm text-blue-700 mt-1">
              Import chess games from Chess.com and Lichess to populate your dashboard with real analysis data. 
              Use the "Import Game Data" button to fetch games from top players or upload your own PGN files.
            </p>
            <div className="mt-2 flex space-x-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-md hover:bg-blue-200 transition-colors"
              >
                Import via API
                {!hasPremiumAccess && <Lock className="w-3 h-3 inline ml-1 text-orange-500" />}
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-md hover:bg-green-200 transition-colors"
              >
                Upload PGN Files
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live KPI Cards */}
      <LiveKPICards />

      {/* Real-time Score Stream */}
      <RealtimeScoreStream />

      {/* Suspicion Rate Chart - Now using live data */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900">📈 Suspicion rate last 30 days</h3>
            {!hasPremiumAccess && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                <Lock className="w-3 h-3 mr-1" />
                Limited in Free Plan
              </span>
            )}
          </div>
          <Link 
            to="/games"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center transition-colors"
          >
            <Eye className="w-4 h-4 mr-1" />
            View All Games
          </Link>
        </div>
        {/* No need to pass data prop - component will use live data automatically */}
        <SuspicionChart />
      </div>

      {/* Live High-Risk Games Table */}
      <LiveSuspiciousScoresTable />

      {/* Data Import Modal */}
      <DataImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Chart Details Modal */}
      {showChartDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Suspicion Trends Details</h3>
                    <p className="text-sm text-gray-600">Detailed analysis of suspicion patterns over time</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChartDetails(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Enhanced Chart */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">30-Day Suspicion Trends</h4>
                  <SuspicionChart />
                </div>

                {/* Analysis Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-blue-900 mb-2">Average Suspicion Rate</h5>
                    <p className="text-2xl font-bold text-blue-700">18.5%</p>
                    <p className="text-sm text-blue-600 mt-1">Last 30 days</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-orange-900 mb-2">Peak Suspicion Day</h5>
                    <p className="text-2xl font-bold text-orange-700">34.2%</p>
                    <p className="text-sm text-orange-600 mt-1">3 days ago</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-green-900 mb-2">Total Games Analyzed</h5>
                    <p className="text-2xl font-bold text-green-700">2,847</p>
                    <p className="text-sm text-green-600 mt-1">Last 30 days</p>
                  </div>
                </div>

                {/* Insights */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Key Insights</h4>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Trend Analysis</p>
                        <p className="text-sm text-gray-600">Suspicion rates have increased by 12% over the past week, indicating heightened detection activity.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Peak Activity</p>
                        <p className="text-sm text-gray-600">Highest suspicion rates typically occur on weekends when more competitive games are played.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Detection Accuracy</p>
                        <p className="text-sm text-gray-600">Our ML models show 94.2% accuracy in identifying suspicious gameplay patterns.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <Link
                    to="/games"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    onClick={() => setShowChartDetails(false)}
                  >
                    View All Games
                  </Link>
                  <Link
                    to="/players"
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    onClick={() => setShowChartDetails(false)}
                  >
                    View Players
                  </Link>
                  <button
                    onClick={() => setShowChartDetails(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <Star className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Upgrade Your Plan</h3>
                    <p className="text-sm text-gray-600">Unlock premium features and advanced analytics</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Free Plan */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="text-center">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Free</h4>
                    <div className="text-3xl font-bold text-gray-900 mb-4">$0<span className="text-sm font-normal text-gray-500">/month</span></div>
                    <div className="space-y-3 text-sm text-gray-600">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>PGN file uploads</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Basic analysis</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Up to 100 games/month</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Live API imports</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Advanced analytics</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <span className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium">
                        Current Plan
                      </span>
                    </div>
                  </div>
                </div>

                {/* Premium Plan */}
                <div className="border-2 border-blue-500 rounded-lg p-6 relative">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">Most Popular</span>
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Premium</h4>
                    <div className="text-3xl font-bold text-gray-900 mb-4">$9<span className="text-sm font-normal text-gray-500">/month</span></div>
                    <div className="space-y-3 text-sm text-gray-600">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Everything in Free</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Live API imports</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Up to 1,000 games/month</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Advanced analytics</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Priority support</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium">
                        Upgrade to Premium
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pro Plan */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <div className="text-center">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Pro</h4>
                    <div className="text-3xl font-bold text-gray-900 mb-4">$19<span className="text-sm font-normal text-gray-500">/month</span></div>
                    <div className="space-y-3 text-sm text-gray-600">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Everything in Premium</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Unlimited games</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Custom analysis models</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>API access</span>
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>White-label options</span>
                      </div>
                    </div>
                    <div className="mt-6">
                      <button className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors font-medium">
                        Upgrade to Pro
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  All plans include a 14-day free trial. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;