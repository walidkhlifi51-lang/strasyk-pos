import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authService } from '@/services/auth/authService';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [canAccessTechnicalRoutes, setCanAccessTechnicalRoutes] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const identityId = useRef(null);
  const requestId = useRef(0);

  const clearIdentity = useCallback(() => {
    queryClientInstance.clear();
    identityId.current = null;
    setUser(null);
    setCanAccessTechnicalRoutes(false);
  }, []);

  const checkUserAuth = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setIsLoadingAuth(true);
    try {
      const currentUser = await authService.getCurrentUser();
      if (currentRequest !== requestId.current) return;
      if (identityId.current !== (currentUser?.id || null)) {
        queryClientInstance.clear();
        setUser(null);
        setCanAccessTechnicalRoutes(false);
      }
      identityId.current = currentUser?.id || null;
      if (!currentUser) {
        clearIdentity();
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        return;
      }
      const technicalAccess = await authService.getTechnicalPageAccess(currentUser);
      if (currentRequest !== requestId.current) return;
      setUser(currentUser);
      setCanAccessTechnicalRoutes(technicalAccess);
      setAuthError(null);
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      clearIdentity();
      const noSession = error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403;
      setAuthError({ type: noSession ? 'auth_required' : 'unknown', message: noSession ? 'Authentication required' : 'Authentication unavailable' });
    } finally {
      if (currentRequest === requestId.current) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    }
  }, [clearIdentity]);

  useEffect(() => {
    let disposed = false;
    let refreshTimer;
    checkUserAuth();
    const unsubscribe = authService.onAuthStateChange((event) => {
      if (disposed) return;
      if (event === 'SIGNED_OUT') {
        clearTimeout(refreshTimer);
        ++requestId.current;
        clearIdentity();
        setIsLoadingAuth(false);
        setAuthChecked(true);
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
        return;
      }
      // Use a new task so Supabase has released its auth notification lock.
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { if (!disposed) checkUserAuth(); }, 0);
    });
    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      ++requestId.current;
      unsubscribe?.();
    };
  }, [checkUserAuth, clearIdentity]);

  const logout = async (shouldRedirect = true) => {
    ++requestId.current;
    clearIdentity();
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
    await authService.logout();
    if (shouldRedirect) authService.redirectToLogin('/');
  };

  return (
    <AuthContext.Provider value={{
      user, canAccessTechnicalRoutes, isAuthenticated: Boolean(user),
      isLoadingAuth, authChecked, isLoadingPublicSettings: false, authError,
      appPublicSettings: {}, logout,
      navigateToLogin: () => authService.redirectToLogin(window.location.href),
      checkAppState: checkUserAuth, checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
