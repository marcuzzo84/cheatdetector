import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SignUpForm from '../components/auth/SignUpForm';

const SignUp: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // If user is already authenticated, redirect to dashboard
  if (user) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <SignUpForm />;
};

export default SignUp;