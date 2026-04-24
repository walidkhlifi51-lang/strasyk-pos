import React, { createContext, useContext } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { getDefaultAccessPermissions, hasUserPermission, normalizeUserAccess } from '@/lib/userAccess';

const TenantContext = createContext();
const normalizeEmail = (value) => (value || '').trim().toLowerCase();
const isSafeReadError = (error) => {
  if (!error) return false;
  const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return error.code === '42P01'
    || error.code === '42501'
    || message.includes('permission denied')
    || message.includes('row-level security')
    || message.includes('not exist');
};

const safeFilter = async (entityApi, query = {}, sort, limit) => {
  try {
    return await entityApi.filter(query, sort, limit);
  } catch (error) {
    if (isSafeReadError(error)) return [];
    throw error;
  }
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
};

export const TenantProvider = ({ children }) => {
  const { data: tenantData, isLoading, refetch } = useQuery({
    queryKey: ['tenantAccess'],
    queryFn: async () => {
      try {
        const isAuth = await appClient.auth.isAuthenticated();
        
        if (!isAuth) {
          return {
            user: null,
            tenant: null,
            isOwner: false,
            role: null,
            status: 'not_authenticated'
          };
        }

        const user = await appClient.auth.me();
        const userEmail = normalizeEmail(user?.email);
        const platformAdmins = await safeFilter(appClient.entities.PlatformAdminAccess, {
          user_email: user.email,
          is_active: true,
        });
        const platformAdminAccess = platformAdmins[0] || null;
        const isPlatformAdmin = user.role === 'admin' || !!platformAdminAccess;
        const resellerUsers = await safeFilter(appClient.entities.ResellerUser, {
          user_email: user.email,
          status: 'active',
        });
        const resellerUserAccess = resellerUsers.find((entry) => normalizeEmail(entry.user_email) === userEmail);
        const allResellers = resellerUserAccess
          ? await safeFilter(appClient.entities.Reseller, { id: resellerUserAccess.reseller_id }, '-created_date', 5)
          : [];
        const currentReseller = resellerUserAccess
          ? allResellers.find((entry) => entry.id === resellerUserAccess.reseller_id) || null
          : null;
        
        // 🔥 Vérifier invitation en attente
        const pendingInvite = localStorage.getItem('pending_tenant_invite');
        const pendingResellerInvite = localStorage.getItem('pending_reseller_invite');
        if (pendingInvite) {
          const invite = JSON.parse(pendingInvite);

          // STRICT: l'email doit correspondre exactement à l'invitation
          if (normalizeEmail(invite.expected_email) === userEmail) {
            await appClient.auth.updateMe({ tenant_id: invite.tenant_id });

            // Créer l'accès utilisateur (car ce n'est pas l'owner)
            await appClient.entities.UserAccess.create({
              tenant_id: invite.tenant_id,
              user_email: user.email,
              is_active: true,
              role: invite.role || 'employee',
              ...getDefaultAccessPermissions(invite.role || 'employee'),
            });

            localStorage.removeItem('pending_tenant_invite');

            const updatedUser = await appClient.auth.me();
            const invitedTenants = await safeFilter(appClient.entities.Tenant, { id: invite.tenant_id }, '-created_date', 5);
            const tenant = invitedTenants[0] || null;

            return {
              user: updatedUser,
              tenant,
              isOwner: false,
              role: invite.role || 'employee',
              isPlatformAdmin,
              userAccess: normalizeUserAccess({
                tenant_id: invite.tenant_id,
                user_email: user.email,
                is_active: true,
                role: invite.role || 'employee',
                ...getDefaultAccessPermissions(invite.role || 'employee'),
              }),
              status: 'active'
            };
          }
          // Email ne correspond pas - supprimer l'invitation invalide
          localStorage.removeItem('pending_tenant_invite');
        }

        if (pendingResellerInvite) {
          const invite = JSON.parse(pendingResellerInvite);
          if (normalizeEmail(invite.expected_email) === userEmail) {
            localStorage.removeItem('pending_reseller_invite');
          } else {
            localStorage.removeItem('pending_reseller_invite');
          }
        }
        
        const ownedTenants = await safeFilter(appClient.entities.Tenant, {
          owner_email: user.email,
        }, '-created_date', 5);
        const ownedTenant = ownedTenants.find((t) => normalizeEmail(t.owner_email) === userEmail);
        
        if (ownedTenant) {
          if (user.tenant_id !== ownedTenant.id) {
            await appClient.auth.updateMe({ tenant_id: ownedTenant.id });
          }

          if (ownedTenant.active === false) {
            return {
              user,
              tenant: ownedTenant,
              isOwner: true,
              role: 'owner',
              status: 'suspended'
            };
          }
          
          return {
            user: await appClient.auth.me(),
            tenant: ownedTenant,
            isOwner: true,
            role: 'owner',
            isPlatformAdmin,
            userAccess: null,
            status: 'active'
          };
        }
        
        // 🚚 Vérifier si l'utilisateur est un livreur AVANT de vérifier UserAccess
        const allDeliveryPersons = await safeFilter(appClient.entities.DeliveryPerson, {
          user_email: user.email,
        }, '-created_date', 20);
        const deliveryPerson = allDeliveryPersons.find((dp) => normalizeEmail(dp.user_email) === userEmail);
        
        if (deliveryPerson) {
          const deliveryTenants = await safeFilter(appClient.entities.Tenant, {
            id: deliveryPerson.tenant_id,
          }, '-created_date', 5);
          const deliveryTenant = deliveryTenants[0] || null;
          
          if (deliveryTenant) {
            if (user.tenant_id !== deliveryTenant.id) {
              await appClient.auth.updateMe({ tenant_id: deliveryTenant.id });
            }
            
            // Rediriger immédiatement vers DeliveryApp si on n'y est pas déjà
            if (!window.location.hash.includes('DeliveryApp')) {
              window.location.href = '/#/DeliveryApp';
            }
            
            return {
              user: await appClient.auth.me(),
              tenant: deliveryTenant,
              isOwner: false,
              role: 'delivery',
              isPlatformAdmin,
              userAccess: null,
              status: 'active'
            };
          }
        }

        if (currentReseller) {
          return {
            user,
            tenant: null,
            reseller: currentReseller,
            isOwner: false,
            role: `reseller_${resellerUserAccess.role}`,
            resellerRole: resellerUserAccess.role,
            isReseller: true,
            isPlatformAdmin,
            userAccess: null,
            status: currentReseller.status === 'suspended' ? 'suspended' : 'active',
          };
        }
        
        // Sinon vérifier les accès normaux
        const allAccess = await safeFilter(appClient.entities.UserAccess, {
          user_email: user.email,
          is_active: true,
        }, '-created_date', 20);
        const userAccess = allAccess.find((a) => normalizeEmail(a.user_email) === userEmail && a.is_active === true);
        
        if (!userAccess) {
          if (isPlatformAdmin) {
            return {
              user,
              tenant: null,
              isOwner: false,
              role: 'admin',
              isPlatformAdmin: true,
              userAccess: null,
              status: 'active'
            };
          }
          return {
            user,
            tenant: null,
            isOwner: false,
            role: null,
            status: 'no_access'
          };
        }
        
        const accessTenants = await safeFilter(appClient.entities.Tenant, {
          id: userAccess.tenant_id,
        }, '-created_date', 5);
        const accessTenant = accessTenants[0] || null;
        
        if (!accessTenant) {
          return {
            user,
            tenant: null,
            isOwner: false,
            role: null,
            status: 'no_access'
          };
        }
        
        if (user.tenant_id !== accessTenant.id) {
          await appClient.auth.updateMe({ tenant_id: accessTenant.id });
        }
        
        return {
          user: await appClient.auth.me(),
          tenant: accessTenant,
          isOwner: false,
          role: userAccess.role,
          isPlatformAdmin,
          userAccess: normalizeUserAccess(userAccess),
          status: 'active'
        };
        
      } catch (error) {
        if (error.message?.includes('not authenticated') || 
            error.message?.includes('unauthorized') ||
            error.message?.includes('JWT')) {
          return {
            user: null,
            tenant: null,
            isOwner: false,
            role: null,
            status: 'not_authenticated'
          };
        }
        
        return { 
          user: null, 
          tenant: null, 
          isOwner: false, 
          role: null,
          status: 'error', 
          message: error.message 
        };
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: 30 * 1000,
    retry: false,
  });

  // 🚚 Vérifier si l'utilisateur est un livreur
  const { data: deliveryPerson } = useQuery({
    queryKey: ['deliveryPerson', tenantData?.user?.email],
    queryFn: async () => {
      if (!tenantData?.user?.email) return null;
      const deliveryPersons = await appClient.entities.DeliveryPerson.filter({
        user_email: tenantData.user.email
      });
      return deliveryPersons.length > 0 ? deliveryPersons[0] : null;
    },
    enabled: !!tenantData?.user?.email,
  });

  const filterByTenant = (query = {}) => {
    if (!tenantData?.tenant?.id) return query;
    return { ...query, tenant_id: tenantData.tenant.id };
  };

  const withTenant = (data = {}) => {
    if (!tenantData?.tenant?.id) return data;
    return { ...data, tenant_id: tenantData.tenant.id };
  };

  return (
    <TenantContext.Provider value={{
      currentTenant: tenantData?.tenant || null,
      currentReseller: tenantData?.reseller || null,
      currentUser: tenantData?.user || null,
      userAccess: tenantData?.userAccess || null,
      deliveryPerson,
      isOwner: tenantData?.isOwner || false,
      isPlatformAdmin: tenantData?.isPlatformAdmin || false,
      isReseller: tenantData?.isReseller || false,
      resellerRole: tenantData?.resellerRole || null,
      userRole: tenantData?.role || null,
      status: tenantData?.status || 'loading',
      message: tenantData?.message || null,
      isLoading,
      filterByTenant,
      withTenant,
      hasModuleAccess: (permission) => {
        if (tenantData?.isOwner) return true;
        return hasUserPermission(tenantData?.userAccess, permission);
      },
      refreshTenant: refetch,
    }}>
      {children}
    </TenantContext.Provider>
  );
};
