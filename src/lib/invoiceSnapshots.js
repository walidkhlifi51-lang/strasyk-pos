export const PLATFORM_ISSUER_SNAPSHOT = {
  type: 'platform',
  legal_name: 'Strasyk',
  display_name: 'Strasyk',
  tagline: 'Conseil et solutions technologiques',
  email: 'contact@strasyk.com',
  website: 'www.strasyk.com',
};

export const buildTenantRecipientSnapshot = (tenant = {}) => ({
  type: 'tenant',
  recipient_name: tenant.nom_commercial || '',
  contact_email: tenant.owner_email || '',
  address: tenant.profile?.adresse || '',
  phone: tenant.profile?.telephone || '',
});

export const buildResellerIssuerSnapshot = ({ reseller = {}, branding = null } = {}) => ({
  type: 'reseller',
  legal_name: reseller.name || '',
  display_name: branding?.brand_name || reseller.name || '',
  email: branding?.support_email || reseller.contact_email || '',
  phone: branding?.support_phone || reseller.contact_phone || '',
  website: branding?.custom_domain || '',
  primary_color: branding?.primary_color || '#f97316',
  secondary_color: branding?.secondary_color || '#1d4ed8',
  logo_url: branding?.logo_url || '',
});

export const buildResellerRecipientSnapshot = (reseller = {}) => ({
  type: 'reseller',
  recipient_name: reseller.name || '',
  contact_email: reseller.contact_email || '',
  phone: reseller.contact_phone || '',
});
