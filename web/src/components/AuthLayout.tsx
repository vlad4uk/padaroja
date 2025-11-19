import React from 'react';
import './AuthLayout.css';

interface AuthLayoutProps {
  children: React.ReactNode;
  illustration: React.ReactNode; // Для иллюстрации слева
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, illustration }) => {
  return (
    <div className="auth-container">
      <header className="auth-header">
      </header>
      
      <div className="auth-card-wrapper">
        <div className="auth-illustration">
          {illustration}
        </div>
        
        <div className="auth-form-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;