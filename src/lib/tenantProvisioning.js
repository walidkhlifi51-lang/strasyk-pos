import { appClient } from '@/api/appClient';
import { buildAbsoluteAppUrl } from '@/lib/appUrls';

export const normalizeEmail = (value) => (value || '').trim().toLowerCase();

export const buildRestaurantProfilePayload = ({ tenantId, nomCommercial, adresse, telephone }) => ({
  tenant_id: tenantId,
  nom_etablissement: nomCommercial,
  adresse: adresse || '',
  telephone: telephone || '',
  frais_livraison: 2.5,
  montant_minimum_livraison: 15,
  zone_livraison_km: 5,
  impression_auto: true,
  manages_deliveries: true,
  manages_table_plan: false,
  delivery_app_allowed: false,
  manages_delivery_app: false,
});

export const buildTenantSlug = (value) => (value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const buildTenantOwnerInviteLink = ({ tenantId, email, label = '' }) => (
  `${buildAbsoluteAppUrl('/InviteSignup')}?tenant=${encodeURIComponent(tenantId)}&email=${encodeURIComponent(email)}&role=owner&label=${encodeURIComponent(label)}`
);

export const buildTenantOwnerInviteMessage = ({ tenantId, email, label = '' }) => {
  const inviteLink = buildTenantOwnerInviteLink({ tenantId, email, label });
  return `Bonjour,

Votre espace ${label || 'commerce'} est pret sur Strasyk POS.

Lien d activation :
${inviteLink}

Etapes :
1. Ouvrez le lien
2. Definissez votre mot de passe
3. Connectez-vous avec votre email

A bientot.`;
};

export const resolveTenantByOwnerEmail = async (ownerEmail) => {
  const normalizedEmail = normalizeEmail(ownerEmail);
  const tenants = await appClient.entities.Tenant.filter({ owner_email: normalizedEmail }, '-created_date', 5);
  return tenants.find((tenant) => normalizeEmail(tenant.owner_email) === normalizedEmail) || null;
};

export const ensureRestaurantProfile = async ({ tenantId, nomCommercial, adresse, telephone }) => {
  const existingProfiles = await appClient.entities.RestaurantProfile.filter({ tenant_id: tenantId }, '-created_date', 5);
  if (existingProfiles[0]) {
    return existingProfiles[0];
  }

  await appClient.entities.RestaurantProfile.create(buildRestaurantProfilePayload({
    tenantId,
    nomCommercial,
    adresse,
    telephone,
  }));

  const createdProfiles = await appClient.entities.RestaurantProfile.filter({ tenant_id: tenantId }, '-created_date', 5);
  if (!createdProfiles[0]) {
    throw new Error('Le profil restaurant est introuvable apres creation.');
  }

  return createdProfiles[0];
};

export const createTenantAndResolve = async ({
  nomCommercial,
  ownerEmail,
  subscriptionPlan,
  adresse,
  telephone,
}) => {
  const normalizedEmail = normalizeEmail(ownerEmail);
  const createdTenant = await appClient.entities.Tenant.create({
    nom_commercial: nomCommercial,
    slug: buildTenantSlug(nomCommercial),
    owner_email: normalizedEmail,
    subscription_plan: subscriptionPlan,
    active: true,
  });

  const resolvedTenant = createdTenant?.id
    ? createdTenant
    : await resolveTenantByOwnerEmail(normalizedEmail);

  if (!resolvedTenant?.id) {
    throw new Error('Le commerce a peut-etre ete cree, mais il n a pas pu etre relu apres creation. Verifiez les policies RLS Supabase sur tenants.');
  }

  try {
    const profile = await ensureRestaurantProfile({
      tenantId: resolvedTenant.id,
      nomCommercial,
      adresse,
      telephone,
    });

    return { tenant: resolvedTenant, profile };
  } catch (profileError) {
    if (createdTenant?.id) {
      await appClient.entities.Tenant.delete(createdTenant.id).catch(() => null);
    }
    throw profileError;
  }
};
