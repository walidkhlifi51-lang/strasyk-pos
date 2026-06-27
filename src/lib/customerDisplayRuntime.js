export const CUSTOMER_DISPLAY_MODES = ['auto', 'tv', 'monitor', 'compact', 'portrait'];
export const CUSTOMER_DISPLAY_THEMES = ['default', 'contrast', 'soft'];

export const DEFAULT_CUSTOMER_DISPLAY_SETTINGS = {
  mode: 'auto',
  theme: 'default',
  zoom: 1,
};

const clampZoom = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_CUSTOMER_DISPLAY_SETTINGS.zoom;
  return Math.min(1.4, Math.max(0.8, Math.round(numeric * 100) / 100));
};

const normalizeMode = (value) => (
  CUSTOMER_DISPLAY_MODES.includes(value) ? value : DEFAULT_CUSTOMER_DISPLAY_SETTINGS.mode
);

const normalizeTheme = (value) => (
  CUSTOMER_DISPLAY_THEMES.includes(value) ? value : DEFAULT_CUSTOMER_DISPLAY_SETTINGS.theme
);

export const normalizeCustomerDisplaySettings = (rawSettings) => ({
  mode: normalizeMode(rawSettings?.mode),
  theme: normalizeTheme(rawSettings?.theme),
  zoom: clampZoom(rawSettings?.zoom),
});

const computeRatioLabel = (width, height) => {
  if (!width || !height) return 'unknown';
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.08) return '4:3';
  if (ratio >= 2) return 'ultrawide';
  if (ratio <= 0.8) return 'portrait';
  return 'standard';
};

export const detectCustomerDisplayEnvironment = (currentWindow = window) => {
  const width = Math.max(currentWindow?.innerWidth || 0, 0);
  const height = Math.max(currentWindow?.innerHeight || 0, 0);
  const orientation = height > width ? 'portrait' : 'landscape';
  const devicePixelRatio = currentWindow?.devicePixelRatio || 1;
  const touchCapable = Boolean(
    currentWindow?.navigator?.maxTouchPoints > 0
    || currentWindow?.matchMedia?.('(pointer: coarse)')?.matches
  );
  const ratioLabel = computeRatioLabel(width, height);

  let detectedMode = 'monitor';
  if (orientation === 'portrait') detectedMode = 'portrait';
  else if (width >= 1600 || ratioLabel === 'ultrawide') detectedMode = 'tv';
  else if (width <= 1024) detectedMode = 'compact';

  return {
    width,
    height,
    orientation,
    devicePixelRatio,
    touchCapable,
    ratio: height > 0 ? Number((width / height).toFixed(3)) : 0,
    ratioLabel,
    detectedMode,
  };
};

export const resolveCustomerDisplayMode = (settings, runtime) => (
  settings?.mode && settings.mode !== 'auto'
    ? settings.mode
    : runtime?.detectedMode || DEFAULT_CUSTOMER_DISPLAY_SETTINGS.mode
);

