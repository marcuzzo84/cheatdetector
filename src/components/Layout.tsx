import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Home, Users, GamepadIcon, Settings, Menu, X, User, Moon, Sun, ChevronDown, LogOut, Download, Calendar, Power, Crown, Star, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showForceLogoutConfirm, setShowForceLogoutConfirm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, isAdmin, signOut, forceSignOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Base navigation items available to all users
  const baseNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Players', href: '/players', icon: Users },
    { name: 'Games', href: '/games', icon: GamepadIcon },
    { name: 'Import', href: '/import', icon: Download },
  ];

  // Admin-only navigation items
  const adminNavigation = [
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  // Combine navigation based on user role
  const navigation = isAdmin 
    ? [...baseNavigation, ...adminNavigation]
    : baseNavigation;

  const isActiveRoute = (href: string) => {
    return location.pathname === href || (href === '/dashboard' && location.pathname === '/');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleForceSignOut = async () => {
    try {
      await forceSignOut();
      // forceSignOut handles the redirect
    } catch (error) {
      console.error('Error during force sign out:', error);
      // Force redirect even if there's an error
      window.location.href = '/signin';
    }
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name;
    }
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    const name = getUserDisplayName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get user role display and tier info
  const getUserRoleInfo = () => {
    const role = userProfile?.role || 'user';
    
    switch (role) {
      case 'admin':
      case 'administrator':
        return {
          display: 'Administrator',
          tier: 'Admin',
          color: 'purple',
          icon: Crown
        };
      case 'premium':
        return {
          display: 'Premium User',
          tier: 'Premium',
          color: 'gold',
          icon: Star
        };
      case 'pro':
        return {
          display: 'Pro User',
          tier: 'Pro',
          color: 'blue',
          icon: Zap
        };
      default:
        return {
          display: 'Free User',
          tier: 'Free',
          color: 'gray',
          icon: User
        };
    }
  };

  const roleInfo = getUserRoleInfo();

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Top Navigation Bar */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm`}>
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          {/* Left: Logo and Mobile Menu */}
          <div className="flex items-center space-x-4">
            <button
              type="button"
              className={`lg:hidden p-2 rounded-md ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div className="hidden sm:block">
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>FairPlay-Scout</h1>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Dashboard</p>
              </div>
            </div>
          </div>

          {/* Right: Profile and Dark Mode */}
          <div className="flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${
                isDark 
                  ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              } transition-colors`}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className={`flex items-center space-x-2 p-2 rounded-lg ${
                  isDark 
                    ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-700' 
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                } transition-colors`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  roleInfo.color === 'purple' ? 'bg-purple-600' :
                  roleInfo.color === 'gold' ? 'bg-yellow-500' :
                  roleInfo.color === 'blue' ? 'bg-blue-600' : 'bg-gray-600'
                }`}>
                  <span className="text-xs font-medium text-white">{getUserInitials()}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{getUserDisplayName()}</div>
                  <div className={`text-xs flex items-center space-x-1 ${
                    roleInfo.color === 'purple' ? 'text-purple-400' :
                    roleInfo.color === 'gold' ? 'text-yellow-400' :
                    roleInfo.color === 'blue' ? 'text-blue-400' : 'text-gray-400'
                  }`}>
                    <roleInfo.icon className="w-3 h-3" />
                    <span>{roleInfo.tier}</span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4" />
              </button>

              {profileOpen && (
                <div className={`absolute right-0 mt-2 w-64 rounded-md shadow-lg border ${
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                } z-50`}>
                  <div className="py-1">
                    <div className={`px-4 py-3 text-sm ${isDark ? 'text-gray-300 border-gray-700' : 'text-gray-700 border-gray-100'} border-b`}>
                      <p className="font-medium">{getUserDisplayName()}</p>
                      <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>{user?.email}</p>
                      <div className="flex items-center mt-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          roleInfo.color === 'purple' ? 'bg-purple-900 text-purple-200' :
                          roleInfo.color === 'gold' ? 'bg-yellow-900 text-yellow-200' :
                          roleInfo.color === 'blue' ? 'bg-blue-900 text-blue-200' :
                          'bg-gray-700 text-gray-200'
                        }`}>
                          <roleInfo.icon className="w-3 h-3 mr-1" />
                          {roleInfo.display}
                        </span>
                      </div>
                    </div>

                    {/* Subscription Status */}
                    {roleInfo.tier === 'Free' && (
                      <div className={`px-4 py-3 ${isDark ? 'border-gray-700' : 'border-gray-100'} border-b`}>
                        <div className={`${isDark ? 'bg-blue-900' : 'bg-blue-50'} rounded-lg p-3`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <Star className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <span className={`text-sm font-medium ${isDark ? 'text-blue-200' : 'text-blue-900'}`}>Upgrade Available</span>
                          </div>
                          <p className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-700'} mb-2`}>
                            Unlock live API imports and advanced features
                          </p>
                          <button className={`text-xs ${isDark ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-2 py-1 rounded transition-colors`}>
                            View Plans
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Show Settings link only for admins */}
                    {isAdmin && (
                      <>
                        <Link
                          to="/settings"
                          className={`block px-4 py-2 text-sm ${
                            isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          onClick={() => setProfileOpen(false)}
                        >
                          <div className="flex items-center">
                            <Settings className="w-4 h-4 mr-2" />
                            Admin Settings
                          </div>
                        </Link>
                        <Link
                          to="/scheduler"
                          className={`block px-4 py-2 text-sm ${
                            isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                          onClick={() => setProfileOpen(false)}
                        >
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            Scheduler Dashboard
                          </div>
                        </Link>
                        <hr className={`my-1 ${isDark ? 'border-gray-700' : 'border-gray-200'}`} />
                      </>
                    )}
                    
                    {/* Regular Sign Out */}
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        handleSignOut();
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </div>
                    </button>

                    {/* Force Sign Out */}
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setShowForceLogoutConfirm(true);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        isDark ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <Power className="w-4 h-4 mr-2" />
                        Force Logout
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Mobile sidebar */}
        <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className={`relative flex w-full max-w-xs flex-1 flex-col ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <nav className="mt-5 flex-1 space-y-1 px-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors ${
                      isActiveRoute(item.href)
                        ? isDark 
                          ? 'bg-gray-900 text-white border-r-2 border-blue-500'
                          : 'bg-blue-100 text-blue-900 border-r-2 border-blue-600'
                        : isDark
                          ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="mr-4 h-6 w-6 flex-shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:top-16">
          <div className={`flex flex-1 flex-col shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r`}>
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActiveRoute(item.href)
                        ? isDark 
                          ? 'bg-gray-900 text-white border-r-2 border-blue-500'
                          : 'bg-blue-100 text-blue-900 border-r-2 border-blue-600'
                        : isDark
                          ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            
            {/* Role indicator in sidebar */}
            <div className={`p-4 ${isDark ? 'border-gray-700' : 'border-gray-200'} border-t`}>
              <div className={`flex items-center space-x-2 p-2 rounded-lg ${
                roleInfo.color === 'purple' ? isDark ? 'bg-purple-900' : 'bg-purple-50' :
                roleInfo.color === 'gold' ? isDark ? 'bg-yellow-900' : 'bg-yellow-50' :
                roleInfo.color === 'blue' ? isDark ? 'bg-blue-900' : 'bg-blue-50' : 
                isDark ? 'bg-gray-700' : 'bg-gray-50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  roleInfo.color === 'purple' ? 'bg-purple-500' :
                  roleInfo.color === 'gold' ? 'bg-yellow-500' :
                  roleInfo.color === 'blue' ? 'bg-blue-500' : 'bg-gray-500'
                }`}></div>
                <span className={`text-xs font-medium ${
                  roleInfo.color === 'purple' ? isDark ? 'text-purple-300' : 'text-purple-700' :
                  roleInfo.color === 'gold' ? isDark ? 'text-yellow-300' : 'text-yellow-700' :
                  roleInfo.color === 'blue' ? isDark ? 'text-blue-300' : 'text-blue-700' : 
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {roleInfo.display}
                </span>
              </div>
              
              {/* Upgrade prompt for free users */}
              {roleInfo.tier === 'Free' && (
                <div className={`mt-2 p-2 ${isDark ? 'bg-blue-900' : 'bg-blue-50'} rounded-lg`}>
                  <div className="flex items-center space-x-2 mb-1">
                    <Star className={`w-3 h-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className={`text-xs font-medium ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>Upgrade Available</span>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-700'} mb-2`}>
                    Get live imports & more
                  </p>
                  <button className={`text-xs ${isDark ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-2 py-1 rounded transition-colors w-full`}>
                    View Plans
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 lg:pl-64">
          <main className="pt-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Click outside to close profile dropdown */}
      {profileOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setProfileOpen(false)}
        />
      )}

      {/* Force Logout Confirmation Modal */}
      {showForceLogoutConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className={`relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
            <div className="mt-3">
              <div className="flex items-center justify-center mb-4">
                <div className={`w-12 h-12 ${isDark ? 'bg-red-900' : 'bg-red-100'} rounded-full flex items-center justify-center`}>
                  <Power className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                </div>
              </div>
              
              <h3 className={`text-lg font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'} text-center mb-2`}>
                Force Logout
              </h3>
              
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} text-center mb-6`}>
                This will immediately sign you out and clear all session data. 
                You'll need to sign in again to access the dashboard.
              </p>
              
              <div className={`${isDark ? 'bg-yellow-900 border-yellow-800' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-3 mb-6`}>
                <div className="flex items-start space-x-2">
                  <div className={`w-4 h-4 ${isDark ? 'bg-yellow-600' : 'bg-yellow-400'} rounded-full mt-0.5`}></div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-800'} font-medium`}>Warning</p>
                    <p className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-700'} mt-1`}>
                      Use this option if you're experiencing authentication issues or need to completely reset your session.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowForceLogoutConfirm(false)}
                  className={`px-4 py-2 ${
                    isDark 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  } rounded-md transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowForceLogoutConfirm(false);
                    handleForceSignOut();
                  }}
                  className={`px-4 py-2 ${
                    isDark 
                      ? 'bg-red-700 text-white hover:bg-red-600' 
                      : 'bg-red-600 text-white hover:bg-red-700'
                  } rounded-md transition-colors`}
                >
                  Force Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;