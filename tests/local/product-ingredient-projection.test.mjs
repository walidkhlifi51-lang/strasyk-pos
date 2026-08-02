import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appClientPath = path.join(root, 'src', 'api', 'supabase', 'appClient.js');
const productFormPath = path.join(root, 'src', 'components', 'parametres', 'ProductForm.jsx');

const appClientSource = readFileSync(appClientPath, 'utf8');
const productFormSource = readFileSync(productFormPath, 'utf8');

const productIngredientProjectionMatch = appClientSource.match(/ProductIngredient:\s*\[([^\]]+)\]/s);
if (!productIngredientProjectionMatch) {
  throw new Error('LEGACY_ENTITY_FIELDS must declare a ProductIngredient projection.');
}

const projectionFields = productIngredientProjectionMatch[1]
  .split(',')
  .map((field) => field.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);

const requiredFields = [
  'id',
  'tenant_id',
  'product_id',
  'ingredient_id',
  'quantite',
  'retirable',
  'created_date',
  'updated_date',
];

for (const field of requiredFields) {
  if (!projectionFields.includes(field)) {
    throw new Error(`ProductIngredient projection is missing required field: ${field}`);
  }
}

if (!productFormSource.includes('appClient.entities.ProductIngredient.filter({')) {
  throw new Error('ProductForm must keep using the generic ProductIngredient entity API.');
}

if (!productFormSource.includes('const ingredientData = ingredients.find(ing => ing.id === pi.ingredient_id);')) {
  throw new Error('ProductForm must still map product ingredients by ingredient_id.');
}

if (productFormSource.includes('[ProductIngredientsDiagnostic]')) {
  throw new Error('Temporary ProductIngredientsDiagnostic logs must not remain in ProductForm.');
}

console.log(JSON.stringify({
  ok: true,
  projectionFields,
  requiredFields,
  productFormUsesGenericEntityApi: true,
  temporaryDiagnosticsRemoved: true,
}, null, 2));
