export const parseSupabaseDate = (value) => {
  if (!value) return null;
  const normalized = String(value).replace(' ', 'T');
  const withTimezone = normalized.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const parsed = new Date(withTimezone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toParisDate = (value) => {
  const parsed = value instanceof Date ? value : parseSupabaseDate(value);
  if (!parsed) return null;
  return new Date(parsed.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
};

export const getDateKey = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const parsed = parseSupabaseDate(value);
  if (!parsed) return null;
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
