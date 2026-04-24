export const USER_ACCESS_PERMISSIONS = [
  {
    key: 'can_access_pos',
    label: 'Caisse',
    description: 'Autorise l acces a la caisse.',
  },
  {
    key: 'can_access_delivery_management',
    label: 'Livraisons',
    description: 'Autorise la gestion des commandes livraison et des encaissements livraison.',
  },
  {
    key: 'can_access_settings',
    label: 'Parametres',
    description: 'Autorise l acces a la page Parametres.',
  },
  {
    key: 'can_access_kiosk',
    label: 'Borne',
    description: 'Autorise l acces au lien de la borne et a sa configuration.',
  },
  {
    key: 'can_access_delivery_app',
    label: 'Gestion livreurs',
    description: 'Autorise la gestion du module livreurs, des comptes livreurs et de leurs acces.',
  },
  {
    key: 'can_access_web_ordering',
    label: 'Site commerce',
    description: 'Autorise l acces aux reglages commande en ligne.',
  },
  {
    key: 'can_access_site_admin',
    label: 'Admin site',
    description: 'Autorise l acces a l administration du site du commerce.',
  },
];

const ROLE_DEFAULTS = {
  employee: {
    can_access_pos: true,
    can_access_delivery_management: true,
    can_access_settings: false,
    can_access_kiosk: false,
    can_access_delivery_app: false,
    can_access_web_ordering: false,
    can_access_site_admin: false,
  },
  manager: {
    can_access_pos: true,
    can_access_delivery_management: true,
    can_access_settings: true,
    can_access_kiosk: true,
    can_access_delivery_app: false,
    can_access_web_ordering: true,
    can_access_site_admin: false,
  },
};

export const getDefaultAccessPermissions = (role = 'employee') => ({
  ...(ROLE_DEFAULTS.employee || {}),
  ...(ROLE_DEFAULTS[role] || {}),
});

export const normalizeUserAccess = (access) => {
  if (!access) return null;
  return {
    ...getDefaultAccessPermissions(access.role),
    ...access,
  };
};

export const hasUserPermission = (userAccess, permission) => {
  if (!permission) return true;
  const normalized = normalizeUserAccess(userAccess);
  if (!normalized) return false;
  return normalized[permission] !== false;
};
