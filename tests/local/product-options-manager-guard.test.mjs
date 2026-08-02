import { readFileSync } from 'node:fs';
import path from 'node:path';
import { requireWithTenant } from '../../src/components/parametres/productOptionsManagerGuards.js';

const root = process.cwd();
const productManagerPath = path.join(root, 'src', 'components', 'parametres', 'ProductManager.jsx');
const productOptionsManagerPath = path.join(root, 'src', 'components', 'parametres', 'ProductOptionsManager.jsx');

const productManagerSource = readFileSync(productManagerPath, 'utf8');
const productOptionsManagerSource = readFileSync(productOptionsManagerPath, 'utf8');

if (!/export default function ProductManager\(\{[^}]*withTenant[^}]*\}\)/s.test(productManagerSource)) {
  throw new Error('ProductManager must accept a withTenant prop.');
}

if (!/<ProductOptionsManager\s+productId=\{productForOptions\.id\}\s+withTenant=\{withTenant\}/s.test(productManagerSource)) {
  throw new Error('ProductManager must pass withTenant to the product options dialog.');
}

if (!productOptionsManagerSource.includes('const safeWithTenant = requireWithTenant(withTenant);')) {
  throw new Error('ProductOptionsManager must guard the withTenant prop explicitly.');
}

const requiredLocalGuards = [
  "const safeWithTenant = requireWithTenant(withTenant, 'GroupForm');",
  "const safeWithTenant = requireWithTenant(withTenant, 'ItemForm');",
  "const safeWithTenant = requireWithTenant(withTenant, 'ProductGroupChoiceRulesForm');",
];

for (const guardLine of requiredLocalGuards) {
  if (!productOptionsManagerSource.includes(guardLine)) {
    throw new Error(`Missing local withTenant guard: ${guardLine}`);
  }
}

const passthrough = (value = {}) => value;
if (requireWithTenant(passthrough) !== passthrough) {
  throw new Error('requireWithTenant should return the provided function when valid.');
}

let missingPropMessage = null;
try {
  requireWithTenant(undefined);
} catch (error) {
  missingPropMessage = error?.message || null;
}

if (missingPropMessage !== 'ProductOptionsManager requires a withTenant prop.') {
  throw new Error(`Unexpected missing prop message: ${missingPropMessage}`);
}

const expectedContextMessages = {
  GroupForm: 'GroupForm requires a withTenant prop.',
  ItemForm: 'ItemForm requires a withTenant prop.',
  ProductGroupChoiceRulesForm: 'ProductGroupChoiceRulesForm requires a withTenant prop.',
};

for (const [context, expectedMessage] of Object.entries(expectedContextMessages)) {
  let actualMessage = null;
  try {
    requireWithTenant(undefined, context);
  } catch (error) {
    actualMessage = error?.message || null;
  }

  if (actualMessage !== expectedMessage) {
    throw new Error(`Unexpected missing prop message for ${context}: ${actualMessage}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  wiringChecked: true,
  guardChecked: true,
  localSubcomponentGuardsChecked: true,
  missingPropMessage,
}, null, 2));
