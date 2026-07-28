import { appClient } from '@/api/appClient';
import { ENABLE_TECHNICAL_ROUTES } from '@/config/env';
import { normalizeEmail, tenantService } from '@/services/tenant/tenantService';

const importMetaEnv = /** @type {any} */ (import.meta);
const PLATFORM_ADMIN_ACCESS_FIELDS = ['id', 'user_email', 'is_active'];

export const TECHNICAL_PAGE_KEYS = new Set([
  'AuditTenant',
  'CleanupTenant',
  'DebugTenant',
  'DiagnosticClients',
  'DiagnosticTenant',
  'TenantDebug',
  'TenantFix',
  'TenantSetup',
]);

export const isTechnicalRoutesEnabled = () => {
  if (typeof import.meta !== 'undefined' && importMetaEnv.env?.DEV) return true;
  return ENABLE_TECHNICAL_ROUTES;
};

export const canAccessTechnicalPages = (user = null) => {
  if (isTechnicalRoutesEnabled()) return true;
  return user?.isPlatformAdmin === true;
};

export const authService = {
  isAuthenticated() {
    return appClient.auth.isAuthenticated();
  },
  getCurrentUser() {
    return appClient.auth.me();
  },
  updateCurrentUser(data = {}) {
    return appClient.auth.updateMe(data);
  },
  updateCurrentUserTenant(tenantId) {
    return appClient.auth.updateMe({ tenant_id: tenantId });
  },
  logout() {
    return appClient.auth.logout();
  },
  redirectToLogin(redirectTo) {
    return appClient.auth.redirectToLogin(redirectTo);
  },
  login(credentials) {
    return appClient.auth.login(credentials);
  },
  getSession() {
    return appClient.auth.getSession?.();
  },
  setSession(session) {
    return appClient.auth.setSession?.(session);
  },
  exchangeCodeForSession(code) {
    return appClient.auth.exchangeCodeForSession?.(code);
  },
  verifyOtp(payload) {
    return appClient.auth.verifyOtp?.(payload);
  },
  requestPasswordReset(payload) {
    return appClient.auth.requestPasswordReset(payload);
  },
  updatePassword(payload) {
    return appClient.auth.updatePassword?.(payload);
  },
  onAuthStateChange(callback) {
    return appClient.auth.onAuthStateChange?.(callback);
  },
  async getTechnicalPageAccess(user = null) {
    if (isTechnicalRoutesEnabled()) return true;
    if (!user?.email) return false;

    if (user?.role === 'admin') {
      const platformAdmins = await tenantService.listPlatformAdminAccess({
        user_email: user.email,
        is_active: true,
      }, '-created_date', 5, { fields: PLATFORM_ADMIN_ACCESS_FIELDS });
      return platformAdmins.some((entry) => normalizeEmail(entry.user_email) === normalizeEmail(user.email));
    }

    return false;
  },
};
