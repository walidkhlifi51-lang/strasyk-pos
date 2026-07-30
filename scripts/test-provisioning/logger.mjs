const SECRET_PATTERNS = [
  /(SUPABASE_SERVICE_ROLE_KEY=)([^\s]+)/gi,
  /(SUPABASE_ANON_KEY=)([^\s]+)/gi,
  /(token=)([^\s]+)/gi,
  /(password=)([^\s]+)/gi,
  /(apikey=)([^\s]+)/gi,
  /(Bearer\s+)([A-Za-z0-9._-]+)/gi,
  /\beyJ[A-Za-z0-9._-]+\b/g,
  /\b(?:sbp|sb_secret|sk_live|sk_test|pk_live|pk_test)_[A-Za-z0-9._-]+\b/g,
];

export const maskSecretValue = (value, visibleStart = 4, visibleEnd = 2) => {
  const stringValue = `${value ?? ''}`;
  if (!stringValue) return '';
  if (stringValue.length <= visibleStart + visibleEnd) return '[REDACTED]';
  return `${stringValue.slice(0, visibleStart)}***${stringValue.slice(-visibleEnd)}`;
};

export const redactSecrets = (value) => {
  if (value == null) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, itemValue]) => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('secret')
          || lowerKey.includes('password')
          || lowerKey.includes('token')
          || lowerKey.includes('service_role')
          || lowerKey.includes('apikey')
        ) {
          return [key, itemValue ? maskSecretValue(itemValue) : itemValue];
        }
        return [key, redactSecrets(itemValue)];
      }),
    );
  }

  if (typeof value === 'string') {
    return SECRET_PATTERNS.reduce((current, pattern) => (
      current.replace(pattern, (_match, prefix, secret) => {
        if (secret === undefined) return '[REDACTED]';
        return `${prefix}${maskSecretValue(secret)}`;
      })
    ), value);
  }

  return value;
};

const printLine = (level, message, details) => {
  const payload = details === undefined ? message : `${message} ${JSON.stringify(redactSecrets(details))}`;
  if (level === 'error') {
    console.error(payload);
    return;
  }
  console.log(payload);
};

export const createLogger = ({ verbose = false } = {}) => ({
  info(message, details) {
    printLine('info', `[info] ${message}`, details);
  },
  warn(message, details) {
    printLine('info', `[warn] ${message}`, details);
  },
  error(message, details) {
    printLine('error', `[error] ${message}`, details);
  },
  debug(message, details) {
    if (!verbose) return;
    printLine('info', `[debug] ${message}`, details);
  },
  section(title) {
    console.log(`\n== ${title} ==`);
  },
  writeJson(value) {
    console.log(JSON.stringify(redactSecrets(value), null, 2));
  },
});
