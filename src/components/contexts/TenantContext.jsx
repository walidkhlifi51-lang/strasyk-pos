import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { hasUserPermission } from '@/lib/userAccess';
import { scopeToTenant } from '@/lib/identityAccess';
import { identityService } from '@/services/auth/identityService';

const TenantContext = createContext();
export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
};

export const TenantProvider = ({ children }) => {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isSelectingTenant, setIsSelectingTenant] = useState(false);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['tenantAccess', user?.id],
    queryFn: () => identityService.getAccess(),
    enabled: Boolean(user?.id) && !isLoadingAuth,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const tenantData = !error && data?.user?.id === user?.id ? data : null;

  useEffect(() => {
    if (tenantData?.role === 'delivery' && tenantData.status === 'active' && location.pathname !== '/DeliveryApp') {
      navigate('/DeliveryApp', { replace: true });
    }
  }, [tenantData?.role, tenantData?.status, location.pathname, navigate]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && user?.id) refetch();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [user?.id, refetch]);

  const tenantId = tenantData?.tenant?.id;
  return (
    <TenantContext.Provider value={{
      currentTenant: tenantData?.tenant || null,
      availableTenants: tenantData?.availableTenants || [],
      selectTenant: async (id) => {
        if (!tenantData?.availableTenants?.some((tenant) => tenant.id === id)) throw new Error('TENANT_SELECTION_DENIED');
        setIsSelectingTenant(true);
        try {
          await identityService.selectTenant(id);
          await queryClient.cancelQueries();
          queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'tenantAccess' });
          await refetch({ throwOnError: true });
        } finally {
          setIsSelectingTenant(false);
        }
      },
      currentReseller: tenantData?.reseller || null,
      currentUser: tenantData?.user || null,
      userAccess: tenantData?.userAccess || null,
      deliveryPerson: tenantData?.deliveryPerson || null,
      isOwner: tenantData?.isOwner === true,
      isPlatformAdmin: tenantData?.isPlatformAdmin === true,
      isReseller: tenantData?.isReseller === true,
      resellerRole: tenantData?.resellerRole || null,
      userRole: tenantData?.role || null,
      status: error ? 'error' : tenantData?.status || (isLoadingAuth ? 'loading' : user ? 'loading' : 'not_authenticated'),
      message: error?.message || null,
      isLoading: isSelectingTenant || isLoadingAuth || (Boolean(user?.id) && isLoading),
      filterByTenant: (query = {}) => scopeToTenant(tenantId, query),
      withTenant: (payload = {}) => scopeToTenant(tenantId, payload),
      hasModuleAccess: (permission) => tenantData?.status === 'active' && !tenantData.isReseller
        && (tenantData.isOwner === true || hasUserPermission(tenantData.userAccess, permission)),
      refreshTenant: refetch,
    }}>
      {children}
    </TenantContext.Provider>
  );
};
