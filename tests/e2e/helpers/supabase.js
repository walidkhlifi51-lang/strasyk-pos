import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { STAGE2_BASELINE, STAGE2_TARGETS } from '../../../scripts/test-provisioning/stage2Baseline.mjs';
import { readCurrentGitBranch } from './env.js';

const ROOT_DIR = process.cwd();
const FRONT_ENV_PATH = path.join(ROOT_DIR, '.env.local');
const PROVISIONING_ENV_PATH = path.join(ROOT_DIR, '.env.test-provisioning.local');

const parseEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    throw new Error(`Missing env file: ${path.basename(filePath)}`);
  }

  const content = readFileSync(filePath, 'utf8');
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }

  return entries;
};

const frontEnv = parseEnvFile(FRONT_ENV_PATH);
const provisioningEnv = parseEnvFile(PROVISIONING_ENV_PATH);

const supabaseUrl = frontEnv.VITE_SUPABASE_URL;
const anonKey = frontEnv.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = provisioningEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error('Supabase front env is incomplete for E2E verification.');
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for read-only E2E verification.');
}

export const demoTenantId = STAGE2_TARGETS.tenantId;
export const protectedTenantIds = STAGE2_BASELINE.protectedSnapshot.tenants.map((tenant) => tenant.id);
export const E2E_NAME_PREFIX = 'E2E_';

const assertSafeMutationScope = () => {
  const branch = readCurrentGitBranch();
  if (branch === 'main') {
    throw new Error('E2E cleanup is blocked on branch main.');
  }
};

export const createAnonSupabaseClient = () => createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const createAdminSupabaseClient = () => createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const requireRows = async (query, tableName, context) => {
  const { data, error } = await query;
  if (error) {
    throw new Error(`[${context}] ${tableName}: ${error.message}`);
  }
  return data || [];
};

const requireMutation = async (query, tableName, context) => {
  const { error, count } = await query;
  if (error) {
    throw new Error(`[${context}] ${tableName}: ${error.message}`);
  }
  return count ?? 0;
};

const uniq = (values) => [...new Set((values || []).filter(Boolean))];

const fetchE2ENamedRows = async (supabaseAdmin, tableName) => requireRows(
  supabaseAdmin
    .from(tableName)
    .select('*')
    .eq('tenant_id', demoTenantId)
    .like('nom', `${E2E_NAME_PREFIX}%`),
  tableName,
  'fetch-e2e-rows'
);

export const fetchProtectedTenantSnapshots = async (supabaseAdmin) => {
  const tables = ['categories', 'ingredients', 'products', 'product_ingredients', 'option_groups', 'option_items'];
  const snapshot = {};

  for (const tableName of tables) {
    const rows = await requireRows(
      supabaseAdmin
        .from(tableName)
        .select('id,tenant_id')
        .in('tenant_id', protectedTenantIds),
      tableName,
      'protected-snapshot'
    );

    snapshot[tableName] = {
      count: rows.length,
      ids: rows.map((row) => row.id).sort(),
    };
  }

  return snapshot;
};

export const fetchE2ESnapshot = async (supabaseAdmin) => {
  const [categories, ingredients, products, optionGroups, optionItems] = await Promise.all([
    fetchE2ENamedRows(supabaseAdmin, 'categories'),
    fetchE2ENamedRows(supabaseAdmin, 'ingredients'),
    fetchE2ENamedRows(supabaseAdmin, 'products'),
    fetchE2ENamedRows(supabaseAdmin, 'option_groups'),
    fetchE2ENamedRows(supabaseAdmin, 'option_items'),
  ]);

  const productIds = products.map((row) => row.id);
  const ingredientIds = ingredients.map((row) => row.id);
  const optionGroupIds = optionGroups.map((row) => row.id);

  const productIngredients = productIds.length > 0
    ? await requireRows(
      supabaseAdmin
        .from('product_ingredients')
        .select('*')
        .eq('tenant_id', demoTenantId)
        .in('product_id', productIds),
      'product_ingredients',
      'fetch-e2e-product-ingredients'
    )
    : [];

  return {
    categories,
    ingredients,
    products,
    productIngredients,
    optionGroups,
    optionItems,
    ids: {
      categoryIds: categories.map((row) => row.id),
      ingredientIds,
      productIds,
      productIngredientIds: productIngredients.map((row) => row.id),
      optionGroupIds,
      optionItemIds: optionItems.map((row) => row.id),
    },
  };
};

export const cleanupE2EData = async (supabaseAdmin) => {
  assertSafeMutationScope();

  const snapshot = await fetchE2ESnapshot(supabaseAdmin);
  const optionItemGroupIds = snapshot.optionItems.map((row) => row.option_group_id).filter(Boolean);
  const optionGroupIds = uniq([...snapshot.ids.optionGroupIds, ...optionItemGroupIds]);

  const counts = {
    option_items: 0,
    product_ingredients: 0,
    option_groups: 0,
    products: 0,
    ingredients: 0,
    categories: 0,
  };

  if (snapshot.ids.optionItemIds.length > 0) {
    counts.option_items += await requireMutation(
      supabaseAdmin
        .from('option_items')
        .delete({ count: 'exact' })
        .in('id', snapshot.ids.optionItemIds),
      'option_items',
      'cleanup-e2e'
    );
  }

  if (snapshot.ids.productIngredientIds.length > 0) {
    counts.product_ingredients += await requireMutation(
      supabaseAdmin
        .from('product_ingredients')
        .delete({ count: 'exact' })
        .in('id', snapshot.ids.productIngredientIds),
      'product_ingredients',
      'cleanup-e2e'
    );
  }

  if (optionGroupIds.length > 0) {
    counts.option_groups += await requireMutation(
      supabaseAdmin
        .from('option_groups')
        .delete({ count: 'exact' })
        .in('id', optionGroupIds),
      'option_groups',
      'cleanup-e2e'
    );
  }

  if (snapshot.ids.productIds.length > 0) {
    counts.products += await requireMutation(
      supabaseAdmin
        .from('products')
        .delete({ count: 'exact' })
        .in('id', snapshot.ids.productIds),
      'products',
      'cleanup-e2e'
    );
  }

  if (snapshot.ids.ingredientIds.length > 0) {
    counts.ingredients += await requireMutation(
      supabaseAdmin
        .from('ingredients')
        .delete({ count: 'exact' })
        .in('id', snapshot.ids.ingredientIds),
      'ingredients',
      'cleanup-e2e'
    );
  }

  if (snapshot.ids.categoryIds.length > 0) {
    counts.categories += await requireMutation(
      supabaseAdmin
        .from('categories')
        .delete({ count: 'exact' })
        .in('id', snapshot.ids.categoryIds),
      'categories',
      'cleanup-e2e'
    );
  }

  return {
    deleted: counts,
    snapshot,
  };
};

export const fetchByNames = async (supabaseAdmin, tableName, names) => {
  const rows = await requireRows(
    supabaseAdmin
      .from(tableName)
      .select('*')
      .in('nom', names),
    tableName,
    'fetch-by-name'
  );

  return rows;
};

export const fetchProductByName = async (supabaseAdmin, name) => {
  const rows = await requireRows(
    supabaseAdmin
      .from('products')
      .select('*')
      .eq('nom', name),
    'products',
    'fetch-product'
  );

  return rows;
};

export const fetchProductIngredients = async (supabaseAdmin, productId) => requireRows(
  supabaseAdmin
    .from('product_ingredients')
    .select('*')
    .eq('product_id', productId),
  'product_ingredients',
  'fetch-product-ingredients'
);

export const fetchOptionGroups = async (supabaseAdmin, names) => requireRows(
  supabaseAdmin
    .from('option_groups')
    .select('*')
    .in('nom', names),
  'option_groups',
  'fetch-option-groups'
);

export const fetchOptionItems = async (supabaseAdmin, names) => requireRows(
  supabaseAdmin
    .from('option_items')
    .select('*')
    .in('nom', names),
  'option_items',
  'fetch-option-items'
);

export const fetchProductOptionGroups = async (supabaseAdmin, productId) => requireRows(
  supabaseAdmin
    .from('option_groups')
    .select('*')
    .eq('tenant_id', demoTenantId)
    .eq('product_id', productId),
  'option_groups',
  'fetch-product-option-groups'
);

export const fetchOptionItemsByGroupIds = async (supabaseAdmin, groupIds) => {
  if (!groupIds?.length) return [];

  return requireRows(
    supabaseAdmin
      .from('option_items')
      .select('*')
      .eq('tenant_id', demoTenantId)
      .in('option_group_id', groupIds),
    'option_items',
    'fetch-option-items-by-group-ids'
  );
};
