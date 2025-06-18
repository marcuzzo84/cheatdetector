import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader2, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface SignInFormProps {
  onSuccess?: () => void;
}

const SignInForm: React.FC<SignInFormProps> = ({ onSuccess }) => {
  const { signIn } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError);
    } else {
      onSuccess?.();
    }

    setLoading(false);
  };

  const fillDemoCredentials = () => {
    setEmail('admin@fairplay-scout.com');
    setPassword('demo123456');
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${
      isDark 
        ? 'bg-gradient-to-br from-gray-900 to-gray-800' 
        : 'bg-gradient-to-br from-blue-50 to-indigo-100'
    } py-12 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className={`w-16 h-16 ${isDark ? 'bg-blue-700' : 'bg-blue-600'} rounded-full flex items-center justify-center`}>
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className={`mt-6 text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Sign in to FairPlay-Scout
          </h2>
          <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Monitor chess games for suspicious behavior
          </p>
        </div>

        <div className={`${isDark ? 'bg-gray-800 shadow-xl' : 'bg-white shadow-lg'} rounded-lg p-8`}>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className={`${
                isDark ? 'bg-red-900/50 border-red-800' : 'bg-red-50 border-red-200'
              } border rounded-md p-3`}>
                <div className="flex items-center">
                  <AlertCircle className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-500'} mr-2`} />
                  <span className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className={`h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border ${
                    isDark 
                      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500' 
                      : 'border-gray-300 bg-white placeholder-gray-500 focus:ring-blue-500 focus:border-transparent'
                  } rounded-md leading-5 focus:outline-none focus:placeholder-gray-400 focus:ring-2`}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`block w-full pl-10 pr-10 py-3 border ${
                    isDark 
                      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500' 
                      : 'border-gray-300 bg-white placeholder-gray-500 focus:ring-blue-500 focus:border-transparent'
                  } rounded-md leading-5 focus:outline-none focus:placeholder-gray-400 focus:ring-2`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className={`h-5 w-5 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} />
                  ) : (
                    <Eye className={`h-5 w-5 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={`h-4 w-4 ${
                    isDark 
                      ? 'text-blue-600 focus:ring-blue-500 border-gray-600 bg-gray-700' 
                      : 'text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                  }`}
                />
                <label htmlFor="remember-me" className={`ml-2 block text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className={`font-medium ${
                    isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
                  }`}
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  isDark 
                    ? 'bg-blue-700 hover:bg-blue-600 focus:ring-blue-500' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>

            <div className="text-center">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className={`font-medium ${
                    isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
                  }`}
                >
                  Sign up
                </Link>
              </span>
            </div>
          </form>

          {/* Demo Credentials */}
          <div className={`mt-6 pt-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`${isDark ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-lg p-4`}>
              <h4 className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-900'} mb-2`}>Demo Access</h4>
              <p className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-700'} mb-3`}>
                Use these credentials to explore the dashboard:
              </p>
              <button
                type="button"
                onClick={fillDemoCredentials}
                className={`w-full px-3 py-2 ${
                  isDark 
                    ? 'bg-blue-800 text-blue-200 hover:bg-blue-700' 
                    : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                } rounded-md transition-colors text-sm font-medium`}
              >
                Fill Demo Credentials
              </button>
              <div className={`mt-2 text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                <p>Email: admin@fairplay-scout.com</p>
                <p>Password: demo123456</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInForm;