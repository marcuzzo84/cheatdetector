import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm';

const ForgotPassword: React.FC = () => {
  const { user } = useAuth();

  // If user is already authenticated, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <ForgotPasswordForm />;
};

export default ForgotPassword;