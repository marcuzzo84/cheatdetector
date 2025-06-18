import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Home, Users, GamepadIcon, Settings, Menu, X, User, Moon, Sun, ChevronDown, LogOut, Download, Calendar, Power, Crown, Star, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showForceLogoutConfirm, setShowForceLogoutConfirm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, isAdmin, signOut, forceSignOut } = useAuth();

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

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // In a real app, this would persist to localStorage and apply dark mode classes
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
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          {/* Left: Logo and Mobile Menu */}
          <div className="flex items-center space-x-4">
            <button
              type="button"
              className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-gray-900">FairPlay-Scout</h1>
                <p className="text-xs text-gray-500">Dashboard</p>
              </div>
            </div>
          </div>

          {/* Right: Profile and Dark Mode */}
          <div className="flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center space-x-2 p-2 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  roleInfo.color === 'purple' ? 'bg-purple-600' :
                  roleInfo.color === 'gold' ? 'bg-yellow-500' :
                  roleInfo.color === 'blue' ? 'bg-blue-600' : 'bg-gray-600'
                }`}>
                  <span className="text-xs font-medium text-white">{getUserInitials()}</span>
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium">{getUserDisplayName()}</div>
                  <div className={`text-xs flex items-center space-x-1 ${
                    roleInfo.color === 'purple' ? 'text-purple-600' :
                    roleInfo.color === 'gold' ? 'text-yellow-600' :
                    roleInfo.color === 'blue' ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    <roleInfo.icon className="w-3 h-3" />
                    <span>{roleInfo.tier}</span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <div className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                      <p className="font-medium">{getUserDisplayName()}</p>
                      <p className="text-gray-500">{user?.email}</p>
                      <div className="flex items-center mt-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          roleInfo.color === 'purple' ? 'bg-purple-100 text-purple-800' :
                          roleInfo.color === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                          roleInfo.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          <roleInfo.icon className="w-3 h-3 mr-1" />
                          {roleInfo.display}
                        </span>
                      </div>
                    </div>

                    {/* Subscription Status */}
                    {roleInfo.tier === 'Free' && (
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-2">
                            <Star className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Upgrade Available</span>
                          </div>
                          <p className="text-xs text-blue-700 mb-2">
                            Unlock live API imports and advanced features
                          </p>
                          <button className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors">
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
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setProfileOpen(false)}
                        >
                          <div className="flex items-center">
                            <Settings className="w-4 h-4 mr-2" />
                            Admin Settings
                          </div>
                        </Link>
                        <Link
                          to="/scheduler"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setProfileOpen(false)}
                        >
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            Scheduler Dashboard
                          </div>
                        </Link>
                        <hr className="my-1" />
                      </>
                    )}
                    
                    {/* Regular Sign Out */}
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        handleSignOut();
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
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
                        ? 'bg-blue-100 text-blue-900 border-r-2 border-blue-600'
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
          <div className="flex flex-1 flex-col bg-white shadow-sm border-r border-gray-200">
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActiveRoute(item.href)
                        ? 'bg-blue-100 text-blue-900 border-r-2 border-blue-600'
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
            <div className="p-4 border-t border-gray-200">
              <div className={`flex items-center space-x-2 p-2 rounded-lg ${
                roleInfo.color === 'purple' ? 'bg-purple-50' :
                roleInfo.color === 'gold' ? 'bg-yellow-50' :
                roleInfo.color === 'blue' ? 'bg-blue-50' : 'bg-gray-50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  roleInfo.color === 'purple' ? 'bg-purple-500' :
                  roleInfo.color === 'gold' ? 'bg-yellow-500' :
                  roleInfo.color === 'blue' ? 'bg-blue-500' : 'bg-gray-500'
                }`}></div>
                <span className={`text-xs font-medium ${
                  roleInfo.color === 'purple' ? 'text-purple-700' :
                  roleInfo.color === 'gold' ? 'text-yellow-700' :
                  roleInfo.color === 'blue' ? 'text-blue-700' : 'text-gray-700'
                }`}>
                  {roleInfo.display}
                </span>
              </div>
              
              {/* Upgrade prompt for free users */}
              {roleInfo.tier === 'Free' && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <Star className="w-3 h-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-900">Upgrade Available</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Get live imports & more
                  </p>
                  <button className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors w-full">
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
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Power className="w-6 h-6 text-red-600" />
                </div>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                Force Logout
              </h3>
              
              <p className="text-sm text-gray-600 text-center mb-6">
                This will immediately sign you out and clear all session data. 
                You'll need to sign in again to access the dashboard.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                <div className="flex items-start space-x-2">
                  <div className="w-4 h-4 bg-yellow-400 rounded-full mt-0.5"></div>
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">Warning</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Use this option if you're experiencing authentication issues or need to completely reset your session.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowForceLogoutConfirm(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowForceLogoutConfirm(false);
                    handleForceSignOut();
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
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