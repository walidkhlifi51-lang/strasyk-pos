import { APP_PUBLIC_URL } from '@/config/env';

const trimTrailingSlash = (value) => (value || '').replace(/\/+$/, '');

export const getAppBaseUrl = () => {
  if (APP_PUBLIC_URL) return trimTrailingSlash(APP_PUBLIC_URL);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }
  return '';
};

export const buildAbsoluteAppUrl = (path = '') => {
  const baseUrl = getAppBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};
