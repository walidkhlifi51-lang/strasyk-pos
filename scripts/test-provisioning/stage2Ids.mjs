import { createHash } from 'node:crypto';
import { CANONICAL_DATASET } from './data/canonicalDataset.mjs';
import { SEED_KEYS } from './seedKeys.mjs';
import { STAGE2_TARGETS } from './stage2Baseline.mjs';

const toStableUuid = (seedKey) => {
  const hex = createHash('sha256').update(seedKey).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  return [
    hex.slice(0, 8).join(''),
    hex.slice(8, 12).join(''),
    hex.slice(12, 16).join(''),
    hex.slice(16, 20).join(''),
    hex.slice(20, 32).join(''),
  ].join('-');
};

export const getStage2TargetIds = () => {
  return {
    [SEED_KEYS.tenant.canonical]: STAGE2_TARGETS.tenantId,
    [SEED_KEYS.profiles.restaurant]: STAGE2_TARGETS.restaurantProfileId,
    [SEED_KEYS.userAccess.owner]: STAGE2_TARGETS.userAccessId,
    ...Object.fromEntries(CANONICAL_DATASET.categories.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.products.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.ingredients.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.productIngredients.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.optionGroups.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.optionItems.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.customers.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.tables.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.loyaltyRules.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.cagnotteRules.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.deliveryPeople.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
    ...Object.fromEntries(CANONICAL_DATASET.orders.map((item) => [item.seedKey, toStableUuid(item.seedKey)])),
  };
};
