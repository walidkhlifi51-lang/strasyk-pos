import { APP_PUBLIC_URL } from '@/config/env';

const trimTrailingSlash = (value) => (value || '').replace(/\/+$/, '');
const isLocalHostname = (hostname) => hostname === 'localhost' || hostname === '127.0.0.1';

export const getAppBaseUrl = () => {
  const configuredBaseUrl = trimTrailingSlash(APP_PUBLIC_URL);

  if (typeof window !== 'undefined' && window.location?.origin) {
    const runtimeOrigin = trimTrailingSlash(window.location.origin);

    if (configuredBaseUrl) {
      try {
        const configuredUrl = new URL(configuredBaseUrl);
        const runtimeUrl = new URL(runtimeOrigin);

        // If a stale env var still points to localhost in production, prefer the real origin.
        if (isLocalHostname(configuredUrl.hostname) && !isLocalHostname(runtimeUrl.hostname)) {
          return runtimeOrigin;
        }
      } catch {
        return runtimeOrigin;
      }

      return configuredBaseUrl;
    }

    return runtimeOrigin;
  }

  return configuredBaseUrl;
};

export const buildAbsoluteAppUrl = (path = '') => {
  const baseUrl = getAppBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};
