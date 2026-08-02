export const extractTenantIdFromStoredSession = (storage) => {
  if (!storage) return null;

  for (const value of Object.values(storage)) {
    if (typeof value !== 'string' || !value.includes('access_token')) continue;

    try {
      const parsed = JSON.parse(value);
      const sessionCandidate = Array.isArray(parsed) ? parsed[0] : parsed;
      const tenantId = sessionCandidate?.user?.user_metadata?.tenant_id;
      if (tenantId) return tenantId;
    } catch {
      continue;
    }
  }

  return null;
};
