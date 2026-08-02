import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src', 'pages', 'Parametres.jsx');
const source = readFileSync(filePath, 'utf8');

const fieldsMatch = source.match(/const PARAM_PROFILE_FIELDS = \[([\s\S]*?)\];/);
if (!fieldsMatch) {
  throw new Error('Unable to locate PARAM_PROFILE_FIELDS in Parametres.');
}

const fields = fieldsMatch[1]
  .split(',')
  .map((field) => field.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);

if (fields.includes('customer_display_settings')) {
  throw new Error('PARAM_PROFILE_FIELDS must not include customer_display_settings.');
}

if (/PARAM_PROFILE_FALLBACK_FIELDS/.test(source)) {
  throw new Error('Parametres must not keep the legacy fallback profile projection.');
}

if (/customer_display_settings/.test(source)) {
  throw new Error('Parametres must not request customer_display_settings in its profile loading flow.');
}

console.log(JSON.stringify({
  ok: true,
  fields,
  requestsCustomerDisplaySettings: false,
  legacyFallbackRemoved: true,
}, null, 2));
