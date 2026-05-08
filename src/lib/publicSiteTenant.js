import { appClient } from '@/api/appClient';
import { PUBLIC_SITE_PROFILE_FIELDS, PUBLIC_SITE_TENANT_FIELDS } from '@/lib/publicSiteCatalogCache';

export const normalizeCustomDomain = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '');

export const getPublicHostname = () => normalizeCustomDomain(window.location.hostname);

const isLocalHostname = (hostname) => !hostname || hostname === 'localhost' || hostname === '127.0.0.1';

export async function resolvePublicTenantContext({ slug, hostname } = {}) {
  const normalizedHostname = normalizeCustomDomain(hostname || window.location.hostname);
  let tenant = null;
  let profile = null;
  let resolvedBy = null;

  if (slug) {
    const tenants = await appClient.entities.Tenant.filter({ slug }, undefined, 1, { fields: PUBLIC_SITE_TENANT_FIELDS });
    tenant = tenants[0] || null;
    resolvedBy = tenant ? 'slug' : null;
  }

  if (!tenant && !isLocalHostname(normalizedHostname)) {
    const hostnameCandidates = Array.from(new Set([
      normalizedHostname,
      normalizedHostname.replace(/^www\./, ''),
      normalizedHostname.startsWith('www.') ? normalizedHostname.slice(4) : `www.${normalizedHostname}`,
    ].filter(Boolean)));

    for (const candidate of hostnameCandidates) {
      const profiles = await appClient.entities.RestaurantProfile.filter({ custom_domain: candidate }, undefined, 1, { fields: PUBLIC_SITE_PROFILE_FIELDS });
      profile = profiles[0] || null;
      if (profile) break;
    }

    if (profile?.tenant_id) {
      const tenants = await appClient.entities.Tenant.filter({ id: profile.tenant_id }, undefined, 1, { fields: PUBLIC_SITE_TENANT_FIELDS });
      tenant = tenants[0] || null;
      resolvedBy = tenant ? 'domain' : null;
    }
  }

  if (tenant && !profile) {
    const profiles = await appClient.entities.RestaurantProfile.filter({ tenant_id: tenant.id }, undefined, 1, { fields: PUBLIC_SITE_PROFILE_FIELDS });
    profile = profiles[0] || null;
  }

  return {
    tenant,
    profile,
    resolvedBy,
    hostname: normalizedHostname,
    slug: tenant?.slug || slug || null,
    customDomain: profile?.custom_domain || null,
  };
}

export function buildPublicPageUrl(pageName, { slug, customDomain } = {}) {
  const path = `/${pageName}`;
  if (customDomain) {
    return `${window.location.origin}${path}`;
  }

  const safeSlug = slug ? `?slug=${encodeURIComponent(slug)}` : '';
  return `${window.location.origin}${path}${safeSlug}`;
}
