import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Games from './pages/Games';
import PlayerDetail from './pages/PlayerDetail';
import Settings from './pages/Settings';
import Import from './pages/Import';
import SchedulerDashboard from './pages/SchedulerDashboard';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Analytics from './pages/Analytics';
import PlayerManagement from './pages/PlayerManagement';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/dashboard" replace />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/players" element={
              <ProtectedRoute>
                <Layout>
                  <Players />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/games" element={
              <ProtectedRoute>
                <Layout>
                  <Games />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <Layout>
                  <Analytics />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/import" element={
              <ProtectedRoute>
                <Layout>
                  <Import />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/players/:hash" element={
              <ProtectedRoute>
                <Layout>
                  <PlayerDetail />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/player-management" element={
              <ProtectedRoute>
                <Layout>
                  <PlayerManagement />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Admin-only routes */}
            <Route path="/settings" element={
              <AdminRoute>
                <Layout>
                  <Settings />
                </Layout>
              </AdminRoute>
            } />
            <Route path="/scheduler" element={
              <AdminRoute>
                <Layout>
                  <SchedulerDashboard />
                </Layout>
              </AdminRoute>
            } />
            
            {/* Catch all route - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;