import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { appClient } from "@/api/appClient";
import { useQuery } from '@tanstack/react-query';
import { useTenant } from './TenantContext';

const SecurityContext = createContext(null);

export const SecurityProvider = ({ children }) => {
  const { currentTenant, filterByTenant } = useTenant();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['restaurantProfile', currentTenant?.id],
    queryFn: async () => {
      const profiles = await appClient.entities.RestaurantProfile.filter(filterByTenant());
      return profiles[0] || null;
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const [unlockedPages, setUnlockedPages] = useState({});
  const [pinError, setPinError] = useState('');
  
  const location = useLocation();
  const [previousPath, setPreviousPath] = useState(location.pathname);

  useEffect(() => {
    if (location.pathname !== previousPath) {
      setUnlockedPages({}); 
      setPreviousPath(location.pathname);
    }
  }, [location, previousPath]);

  const pagePins = useMemo(() => profile?.page_pins || {}, [profile]);

  const isPageProtected = useCallback((pageName) => {
    return !!(pagePins && pagePins[pageName]);
  }, [pagePins]);

  const isPageUnlocked = useCallback((pageName) => {
    return !!unlockedPages[pageName];
  }, [unlockedPages]);

  const verifyPin = useCallback((pageName, enteredPin) => {
    if (pagePins[pageName] === enteredPin) {
      setUnlockedPages(prev => ({ ...prev, [pageName]: true }));
      setPinError('');
      return true;
    } else {
      setPinError('Code PIN incorrect.');
      return false;
    }
  }, [pagePins]);

  const value = useMemo(() => ({
    profile: profile || {},
    isLoading,
    pagePins,
    isPageProtected,
    isPageUnlocked,
    verifyPin,
    unlockedPages,
    pinError,
    setPinError,
  }), [profile, isLoading, pagePins, isPageProtected, isPageUnlocked, verifyPin, unlockedPages, pinError]);

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
