import { appClient } from '@/api/appClient';
import { ENABLE_TECHNICAL_ROUTES } from '@/config/env';

const importMetaEnv = /** @type {any} */ (import.meta);

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
  return user?.role === 'admin';
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
};
