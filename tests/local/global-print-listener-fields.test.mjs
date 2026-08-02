import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src', 'components', 'caisse', 'GlobalPrintListener.jsx');
const source = readFileSync(filePath, 'utf8');

const fieldsMatch = source.match(/const pendingOrderFields = \[([\s\S]*?)\];/);
if (!fieldsMatch) {
  throw new Error('Unable to locate pendingOrderFields in GlobalPrintListener.');
}

const fields = fieldsMatch[1]
  .split(',')
  .map((field) => field.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);

if (fields.includes('payment_method')) {
  throw new Error('pendingOrderFields must not include payment_method.');
}

if (!fields.includes('mode_paiement')) {
  throw new Error('pendingOrderFields must include mode_paiement.');
}

console.log(JSON.stringify({
  ok: true,
  fields,
  usesModePaiement: true,
  usesPaymentMethod: false,
}, null, 2));
