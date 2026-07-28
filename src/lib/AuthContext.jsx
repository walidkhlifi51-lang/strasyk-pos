import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '@/services/auth/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [canAccessTechnicalRoutes, setCanAccessTechnicalRoutes] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ local: true });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(false);
      setAuthError(null);
      setAppPublicSettings({ local: true });
      await checkUserAuth();
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        setUser(null);
        setCanAccessTechnicalRoutes(false);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
        return;
      }
      const hasTechnicalAccess = await authService.getTechnicalPageAccess(currentUser);
      setUser(currentUser);
      setCanAccessTechnicalRoutes(hasTechnicalAccess);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setCanAccessTechnicalRoutes(false);
      setIsAuthenticated(false);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setCanAccessTechnicalRoutes(false);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      authService.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      authService.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    authService.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      canAccessTechnicalRoutes,
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

