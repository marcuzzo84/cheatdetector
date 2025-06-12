import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient, User, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  forceSignOut: () => Promise<void>;
  cancelAuth: () => void;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authCancelled, setAuthCancelled] = useState(false);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  const clearAuthState = () => {
    setUser(null);
    setUserProfile(null);
    setSession(null);
    setLoading(false);
    setAuthCancelled(false);
  };

  const cancelAuth = () => {
    console.log('🚫 Authentication cancelled by user');
    setAuthCancelled(true);
    clearAuthState();
  };

  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        // Don't proceed if auth was cancelled
        if (authCancelled) {
          clearAuthState();
          return;
        }

        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted || authCancelled) return;
        
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user && !authCancelled) {
          const profile = await fetchUserProfile(session.user.id);
          if (mounted && !authCancelled) {
            setUserProfile(profile);
          }
        }
        
        if (mounted && !authCancelled) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initialize auth
    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || authCancelled) return;
      
      console.log('Auth state changed:', event);
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user && !authCancelled) {
        const profile = await fetchUserProfile(session.user.id);
        if (mounted && !authCancelled) {
          setUserProfile(profile);
        }
      } else {
        setUserProfile(null);
      }
      
      if (mounted && !authCancelled) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [authCancelled]);

  const signIn = async (email: string, password: string) => {
    try {
      setAuthCancelled(false); // Reset cancel state
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setAuthCancelled(false); // Reset cancel state
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      clearAuthState();
    } catch (error) {
      console.error('Error signing out:', error);
      // Force clear state even if API call fails
      clearAuthState();
    }
  };

  const forceSignOut = async () => {
    try {
      console.log('🔄 Force sign out initiated');
      
      // Clear local state immediately
      clearAuthState();
      
      // Clear any stored tokens/sessions
      try {
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
        sessionStorage.clear();
      } catch (e) {
        console.warn('Error clearing storage:', e);
      }
      
      // Attempt to sign out from Supabase
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (e) {
        console.warn('Error signing out from Supabase:', e);
      }
      
      // Force reload the page to ensure complete cleanup
      setTimeout(() => {
        window.location.href = '/signin';
      }, 100);
    } catch (error) {
      console.error('Error during force sign out:', error);
      // Even if there's an error, force redirect to sign in
      window.location.href = '/signin';
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  // Check if user is admin
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'administrator';

  const value = {
    user,
    userProfile,
    session,
    loading: loading && !authCancelled,
    isAdmin,
    signIn,
    signUp,
    signOut,
    forceSignOut,
    cancelAuth,
    resetPassword,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { supabase };