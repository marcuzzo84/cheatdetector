import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SignInForm from '../components/auth/SignInForm';

const SignIn: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // If user is already authenticated, redirect to dashboard or intended page
  if (user) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <SignInForm />;
};

export default SignIn;