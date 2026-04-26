export const PLATFORM_ISSUER_SNAPSHOT = {
  type: 'platform',
  legal_name: 'Strasyk',
  display_name: 'Strasyk',
  tagline: 'Conseil et solutions technologiques',
  email: 'contact@strasyk.com',
  website: 'www.strasyk.com',
};

export const buildTenantRecipientSnapshot = (tenant) => {
  const safeTenant = tenant || {};
  return ({
  type: 'tenant',
  recipient_name: safeTenant.nom_commercial || '',
  contact_email: safeTenant.owner_email || '',
  address: safeTenant.profile?.adresse || '',
  phone: safeTenant.profile?.telephone || '',
});
};

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

export const buildResellerRecipientSnapshot = (reseller) => {
  const safeReseller = reseller || {};
  return ({
  type: 'reseller',
  recipient_name: safeReseller.name || '',
  contact_email: safeReseller.contact_email || '',
  phone: safeReseller.contact_phone || '',
});
};
