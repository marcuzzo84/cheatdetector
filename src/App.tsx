import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
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

function App() {
  return (
    <AuthProvider>
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
          <Route path="/import" element={
            <ProtectedRoute>
              <Layout>
                <Import />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/scheduler" element={
            <ProtectedRoute>
              <Layout>
                <SchedulerDashboard />
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
          <Route path="/settings" element={
            <ProtectedRoute>
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } />
          
          {/* Catch all route - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;