import { CANONICAL_DATASET } from './data/canonicalDataset.mjs';
import { STAGE2_TARGETS } from './stage2Baseline.mjs';
import { computeProvisioningChecksum } from './stage2Checksum.mjs';
import { PROVISIONING_REGISTRY_TABLE } from './stage2Registry.mjs';
import { getStage2TargetIds } from './stage2Ids.mjs';

const OWNER_AUTH_SEED_KEY = 'strasyk-pos-test:user:owner';

const buildOperation = ({
  order,
  entityType,
  tableName,
  seedKey,
  dependency = null,
  targetIdentifiers = {},
  payloadPreview = {},
}) => {
  const operation = {
    order,
    entityType,
    tableName,
    seedKey,
    dependency,
    targetIdentifiers,
    payloadPreview,
  };

  return {
    ...operation,
    checksum: computeProvisioningChecksum(operation),
  };
};

const buildOrderArticlesPreview = (articles) => articles.map((article) => ({
  product_seed_key: article.productSeedKey || null,
  product_id: article.product_id || null,
  nom_produit: article.nom_produit,
  quantite: article.quantite,
  prix_unitaire: article.prix_unitaire,
  total_ligne: article.total_ligne,
  tva: article.tva,
  options: (article.options || []).map((option) => ({
    option_item_seed_key: option.optionItemSeedKey || null,
    id: option.id || null,
    nom: option.nom,
    price_surcharge: option.price_surcharge,
  })),
  exclusions: (article.exclusions || []).map((ingredient) => ({
    ingredient_seed_key: ingredient.ingredientSeedKey || null,
    id: ingredient.id || null,
    nom: ingredient.nom,
  })),
  notes: article.notes || null,
  size: article.size || null,
}));

export const buildStage2WriteOperations = () => {
  const operations = [];
  let order = 1;
  const targetIds = getStage2TargetIds();

  operations.push(buildOperation({
    order: order++,
    entityType: 'auth_user',
    tableName: 'auth.users',
    seedKey: OWNER_AUTH_SEED_KEY,
    targetIdentifiers: {
      email: CANONICAL_DATASET.identity.ownerEmail,
    },
    payloadPreview: {
      email: CANONICAL_DATASET.identity.ownerEmail,
      email_confirm: true,
      user_metadata: {
        full_name: CANONICAL_DATASET.identity.ownerFullName,
      },
    },
  }));

  operations.push(buildOperation({
    order: order++,
    entityType: 'tenant',
    tableName: 'tenants',
    seedKey: CANONICAL_DATASET.tenant.seedKey,
    dependency: OWNER_AUTH_SEED_KEY,
    targetIdentifiers: {
      id: STAGE2_TARGETS.tenantId,
      slug: CANONICAL_DATASET.tenant.slug,
    },
    payloadPreview: {
      id: STAGE2_TARGETS.tenantId,
      nom_commercial: CANONICAL_DATASET.tenant.displayName,
      slug: CANONICAL_DATASET.tenant.slug,
      owner_email: CANONICAL_DATASET.identity.ownerEmail,
      active: CANONICAL_DATASET.tenant.active,
      metadata: {
        markers: CANONICAL_DATASET.tenant.markers,
        seed_key: CANONICAL_DATASET.tenant.seedKey,
      },
    },
  }));

  operations.push(buildOperation({
    order: order++,
    entityType: 'restaurant_profile',
    tableName: 'restaurant_profiles',
    seedKey: CANONICAL_DATASET.profile.seedKey,
    dependency: CANONICAL_DATASET.tenant.seedKey,
    targetIdentifiers: {
      id: STAGE2_TARGETS.restaurantProfileId,
      tenant_id: STAGE2_TARGETS.tenantId,
    },
    payloadPreview: {
      id: STAGE2_TARGETS.restaurantProfileId,
      tenant_id: STAGE2_TARGETS.tenantId,
      nom_etablissement: CANONICAL_DATASET.profile.nom_etablissement,
      adresse: CANONICAL_DATASET.profile.adresse,
      telephone: CANONICAL_DATASET.profile.telephone,
      frais_livraison: CANONICAL_DATASET.profile.frais_livraison,
      montant_minimum_livraison: CANONICAL_DATASET.profile.montant_minimum_livraison,
      zone_livraison_km: CANONICAL_DATASET.profile.zone_livraison_km,
    },
  }));

  operations.push(buildOperation({
    order: order++,
    entityType: 'user_access',
    tableName: 'user_access',
    seedKey: CANONICAL_DATASET.userAccess.seedKey,
    dependency: CANONICAL_DATASET.tenant.seedKey,
    targetIdentifiers: {
      id: STAGE2_TARGETS.userAccessId,
      tenant_id: STAGE2_TARGETS.tenantId,
      user_email: CANONICAL_DATASET.identity.ownerEmail,
    },
    payloadPreview: {
      id: STAGE2_TARGETS.userAccessId,
      tenant_id: STAGE2_TARGETS.tenantId,
      user_email: CANONICAL_DATASET.identity.ownerEmail,
      role: CANONICAL_DATASET.userAccess.role,
      is_active: CANONICAL_DATASET.userAccess.is_active,
    },
  }));

  for (const category of CANONICAL_DATASET.categories) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'category',
      tableName: 'categories',
      seedKey: category.seedKey,
      dependency: CANONICAL_DATASET.tenant.seedKey,
      targetIdentifiers: {
        id: targetIds[category.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        nom: category.nom,
        sort_order: category.sort_order,
        disponible: category.disponible,
      },
    }));
  }

  for (const product of CANONICAL_DATASET.products) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'product',
      tableName: 'products',
      seedKey: product.seedKey,
      dependency: product.categorySeedKey,
      targetIdentifiers: {
        id: targetIds[product.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        nom: product.nom,
        type: product.type,
        category_seed_key: product.categorySeedKey,
        prix: product.prix ?? null,
        base_price: product.base_price ?? null,
        size_prices: product.size_prices || [],
        tva: product.tva,
      },
    }));
  }

  for (const ingredient of CANONICAL_DATASET.ingredients) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'ingredient',
      tableName: 'ingredients',
      seedKey: ingredient.seedKey,
      dependency: CANONICAL_DATASET.tenant.seedKey,
      targetIdentifiers: {
        id: targetIds[ingredient.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        nom: ingredient.nom,
      },
    }));
  }

  for (const relation of CANONICAL_DATASET.productIngredients) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'product_ingredient',
      tableName: 'product_ingredients',
      seedKey: relation.seedKey,
      dependency: relation.productSeedKey,
      targetIdentifiers: {
        id: targetIds[relation.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        product_seed_key: relation.productSeedKey,
        ingredient_seed_key: relation.ingredientSeedKey,
        quantite: relation.quantite,
        retirable: relation.retirable,
      },
    }));
  }

  for (const group of CANONICAL_DATASET.optionGroups) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'option_group',
      tableName: 'option_groups',
      seedKey: group.seedKey,
      dependency: group.dependency,
      targetIdentifiers: {
        id: targetIds[group.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        product_seed_key: group.dependency,
        nom: group.nom,
      },
    }));
  }

  for (const item of CANONICAL_DATASET.optionItems) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'option_item',
      tableName: 'option_items',
      seedKey: item.seedKey,
      dependency: item.dependency,
      targetIdentifiers: {
        id: targetIds[item.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        option_group_seed_key: item.dependency,
        nom: item.nom,
      },
    }));
  }

  for (const customer of CANONICAL_DATASET.customers) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'customer',
      tableName: 'customers',
      seedKey: customer.seedKey,
      dependency: CANONICAL_DATASET.tenant.seedKey,
      targetIdentifiers: {
        id: targetIds[customer.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        nom: customer.nom,
        prenom: customer.prenom,
      },
    }));
  }

  for (const tableItem of CANONICAL_DATASET.tables) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'table',
      tableName: 'tables',
      seedKey: tableItem.seedKey,
      dependency: CANONICAL_DATASET.tenant.seedKey,
      targetIdentifiers: {
        id: targetIds[tableItem.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        nom: tableItem.nom,
        statut: 'disponible',
      },
    }));
  }

  for (const rule of CANONICAL_DATASET.loyaltyRules) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'loyalty_rule',
      tableName: 'loyalty_rules',
      seedKey: rule.seedKey,
      dependency: CANONICAL_DATASET.tenant.seedKey,
      targetIdentifiers: {
        id: targetIds[rule.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        nom: rule.nom,
        active: rule.active,
      },
    }));
  }

  for (const rule of CANONICAL_DATASET.cagnotteRules) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'cagnotte_rule',
      tableName: 'cagnotte_rules',
      seedKey: rule.seedKey,
      dependency: CANONICAL_DATASET.tenant.seedKey,
      targetIdentifiers: {
        id: targetIds[rule.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        nom: rule.nom,
        accumulation_rate: rule.accumulation_rate,
        active: rule.active,
      },
    }));
  }

  for (const deliveryPerson of CANONICAL_DATASET.deliveryPeople) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'delivery_person',
      tableName: 'delivery_people',
      seedKey: deliveryPerson.seedKey,
      dependency: CANONICAL_DATASET.tenant.seedKey,
      targetIdentifiers: {
        id: targetIds[deliveryPerson.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
        user_email: deliveryPerson.user_email,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        nom: deliveryPerson.nom,
        prenom: deliveryPerson.prenom,
        user_email: deliveryPerson.user_email,
        username: deliveryPerson.username,
        disponible: deliveryPerson.disponible,
        vehicule: deliveryPerson.vehicule,
      },
    }));
  }

  for (const orderItem of CANONICAL_DATASET.orders) {
    operations.push(buildOperation({
      order: order++,
      entityType: 'order',
      tableName: 'orders',
      seedKey: orderItem.seedKey,
      dependency: CANONICAL_DATASET.tenant.seedKey,
      targetIdentifiers: {
        id: targetIds[orderItem.seedKey],
        tenant_id: STAGE2_TARGETS.tenantId,
        numero_commande: orderItem.numero_commande,
        numero_caisse: orderItem.numero_caisse,
      },
      payloadPreview: {
        tenant_id: STAGE2_TARGETS.tenantId,
        numero_commande: orderItem.numero_commande,
        numero_caisse: orderItem.numero_caisse,
        type_commande: orderItem.type_commande,
        customer_seed_key: orderItem.customerSeedKey,
        table_seed_key: orderItem.tableSeedKey,
        delivery_person_seed_key: orderItem.deliverySeedKey,
        delivery_address: orderItem.delivery_address,
        statut: orderItem.statut,
        payee: orderItem.payee,
        mode_paiement: orderItem.mode_paiement,
        mode_paiement_prevu: orderItem.mode_paiement_prevu,
        numero_bipeur: orderItem.numero_bipeur,
        notes: orderItem.notes,
        cagnotte_spent: orderItem.cagnotte_spent,
        scratch_reduction: orderItem.scratch_reduction,
        print_at_counter: orderItem.print_at_counter,
        from_kiosk: orderItem.from_kiosk,
        from_web: orderItem.from_web,
        total_ht: orderItem.total_ht,
        total_tva: orderItem.total_tva,
        total_ttc: orderItem.total_ttc,
        articles: buildOrderArticlesPreview(orderItem.articles),
      },
    }));
  }

  return operations;
};

export const buildRegistryInsertOperations = (operations) => operations.map((operation, index) => ({
  order: index + 1,
  dependency: operation.seedKey,
  entityType: `${operation.entityType}_registry`,
  tableName: PROVISIONING_REGISTRY_TABLE,
  seedKey: operation.seedKey,
  recordTable: operation.tableName,
  checksum: operation.checksum,
}));

const buildProtectedIdSets = (protectedSnapshot) => ({
  authUserIds: new Set((protectedSnapshot.authUsers || []).map((item) => item.id).filter(Boolean)),
  tenantIds: new Set((protectedSnapshot.tenants || []).map((item) => item.id).filter(Boolean)),
  restaurantProfileIds: new Set((protectedSnapshot.restaurantProfiles || []).map((item) => item.id).filter(Boolean)),
  userAccessIds: new Set((protectedSnapshot.userAccess || []).map((item) => item.id).filter(Boolean)),
});

const buildProtectedSnapshotSummary = (protectedSnapshot) => ({
  capturedAt: protectedSnapshot.capturedAt,
  authUsers: protectedSnapshot.authUsers || [],
  tenants: protectedSnapshot.tenants || [],
  restaurantProfiles: protectedSnapshot.restaurantProfiles || [],
  userAccess: protectedSnapshot.userAccess || [],
});

const buildChecksumPolicy = (operations) => ({
  algorithm: 'sha256',
  source: 'stable JSON serialization of entity type, table name, seed key, target identifiers and payload preview',
  registryField: 'checksum',
  driftBehavior: 'refuse_with_diagnostic',
  existingSeedKeysChecked: (operations || []).map((operation) => operation.seedKey),
  rules: [
    'A registry row and the live row must both resolve from the exact STRASYK seed key.',
    'If the stored checksum differs from the recomputed checksum, the provisioning must stop.',
    'No automatic repair or overwrite is allowed during the initial write stage.',
  ],
});

const buildMutationSummary = ({ operations, registryInserts }) => ({
  creationsAuth: operations.filter((operation) => operation.tableName === 'auth.users').length,
  insertionsMetier: operations.filter((operation) => operation.tableName !== 'auth.users').length,
  insertionsRegistre: registryInserts.length,
  misesAJour: 0,
  suppressionsCompensatoiresPossibles: {
    auth: operations.filter((operation) => operation.tableName === 'auth.users').length,
    metier: operations.filter((operation) => operation.tableName !== 'auth.users').length,
    registre: registryInserts.length,
    totalMaximum: operations.length + registryInserts.length,
  },
  totalMutationsPrevues: operations.length + registryInserts.length,
});

const buildRuntimeExecutionSteps = (operations) => {
  const steps = [];
  let sequence = 1;

  for (const operation of operations) {
    steps.push({
      order: sequence++,
      phase: 'create',
      entityType: operation.entityType,
      tableName: operation.tableName,
      seedKey: operation.seedKey,
      dependency: operation.dependency,
      checksum: operation.checksum,
      targetIdentifiers: operation.targetIdentifiers,
    });

    steps.push({
      order: sequence++,
      phase: 'register',
      entityType: `${operation.entityType}_registry`,
      tableName: PROVISIONING_REGISTRY_TABLE,
      seedKey: operation.seedKey,
      dependency: operation.seedKey,
      recordTable: operation.tableName,
      checksum: operation.checksum,
    });
  }

  return steps;
};

const buildCompensationDeleteOrder = (executionJournal) => {
  const registryDeletes = executionJournal
    .filter((entry) => entry.registryRegistered && entry.registryEntryId)
    .slice()
    .reverse()
    .map((entry) => ({
      entityType: `${entry.entityType}_registry`,
      tableName: PROVISIONING_REGISTRY_TABLE,
      createdId: entry.registryEntryId,
      seedKey: entry.seedKey,
      deleteStrategy: 'delete_exact_registry_entry_id_from_current_run_journal_only',
      creationOrder: entry.creationOrder,
    }));

  const businessDeletes = executionJournal
    .slice()
    .reverse()
    .map((entry) => ({
      entityType: entry.entityType,
      tableName: entry.tableName,
      createdId: entry.createdId,
      seedKey: entry.seedKey,
      deleteStrategy: entry.tableName === 'auth.users'
        ? 'delete_exact_auth_user_id_from_current_run_journal_only'
        : 'delete_exact_record_id_from_current_run_journal_only',
      creationOrder: entry.creationOrder,
    }));

  return [
    ...registryDeletes,
    ...businessDeletes,
  ];
};

export const simulateStage2FailureCompensation = ({
  operations = buildStage2WriteOperations(),
  protectedSnapshot = {},
  failureAfterBusinessSeedKey = null,
  failureAfterRegistrySeedKey = null,
} = {}) => {
  const protectedIdSets = buildProtectedIdSets(protectedSnapshot);
  const executionJournal = [];
  const successfulCreations = [];
  const failedCompensations = [];
  const runtimeSteps = buildRuntimeExecutionSteps(operations);
  let registryCounter = 1;
  let failure = null;

  const createRegistryId = (entry) => `registry-${String(registryCounter++).padStart(3, '0')}-${entry.seedKey}`;
  const createEntityId = (operation) => {
    if (operation.targetIdentifiers.id) return operation.targetIdentifiers.id;
    if (operation.tableName === 'auth.users') return `auth:${operation.seedKey}`;
    if (operation.tableName === PROVISIONING_REGISTRY_TABLE) return `registry:${operation.seedKey}`;
    return `${operation.tableName}:${operation.seedKey}`;
  };

  const isProtectedId = (tableName, id) => {
    if (!id) return false;
    if (tableName === 'auth.users') return protectedIdSets.authUserIds.has(id);
    if (tableName === 'tenants') return protectedIdSets.tenantIds.has(id);
    if (tableName === 'restaurant_profiles') return protectedIdSets.restaurantProfileIds.has(id);
    if (tableName === 'user_access') return protectedIdSets.userAccessIds.has(id);
    return false;
  };

  for (const step of runtimeSteps) {
    if (step.phase === 'create') {
      const createdId = createEntityId(step);
      const entry = {
        entityType: step.entityType,
        tableName: step.tableName,
        createdId,
        seedKey: step.seedKey,
        registryRegistered: false,
        registryEntryId: null,
        creationOrder: step.order,
      };
      executionJournal.push(entry);
      successfulCreations.push({
        ...entry,
        status: 'created',
      });

      if (failureAfterBusinessSeedKey === step.seedKey) {
        failure = {
          phase: 'create',
          seedKey: step.seedKey,
          tableName: step.tableName,
          message: `Simulated failure after creating ${step.tableName} (${step.seedKey}).`,
        };
        break;
      }
    }

    if (step.phase === 'register') {
      const journalEntry = executionJournal.find((entry) => entry.seedKey === step.seedKey);
      if (!journalEntry) {
        failure = {
          phase: 'register',
          seedKey: step.seedKey,
          tableName: step.tableName,
          message: `Registry step reached without prior business create for ${step.seedKey}.`,
        };
        break;
      }

      if (failureAfterRegistrySeedKey === step.seedKey) {
        failure = {
          phase: 'register',
          seedKey: step.seedKey,
          tableName: step.tableName,
          message: `Simulated failure before registering ${step.seedKey} in ${PROVISIONING_REGISTRY_TABLE}.`,
        };
        break;
      }

      journalEntry.registryRegistered = true;
      journalEntry.registryEntryId = createRegistryId(journalEntry);
    }
  }

  const compensations = [];

  if (failure) {
    for (const deletion of buildCompensationDeleteOrder(executionJournal)) {
      if (deletion.tableName !== PROVISIONING_REGISTRY_TABLE && isProtectedId(deletion.tableName, deletion.createdId)) {
        const blocked = {
          ...deletion,
          status: 'blocked_protected_id',
        };
        failedCompensations.push(blocked);
        continue;
      }

      compensations.push({
        ...deletion,
        status: 'deleted',
      });
    }
  }

  return {
    baselineRestored: Boolean(failure) && failedCompensations.length === 0,
    writesAttempted: failure ? successfulCreations.length : 0,
    failure,
    executionJournal,
    successfulCreations,
    compensations,
    failedCompensations,
    remainingCreatedEntriesAfterCompensation: failedCompensations.length === 0 ? [] : executionJournal,
  };
};

const buildFailureCompensationPlan = (operations) => ({
  enabledForRealExecution: false,
  strategy: 'current_run_exact_ids_only',
  journalRequirement: {
    requiredFields: [
      'entityType',
      'tableName',
      'createdId',
      'seedKey',
      'registryRegistered',
      'creationOrder',
    ],
    rule: 'Every successful write must be appended immediately to the execution journal before the next write starts.',
  },
  failureHandlingRules: [
    'Stop immediately on the first failed write or failed registry insert.',
    'Delete in reverse order only the objects created during the current execution.',
    'Never delete a protected snapshot ID.',
    'Never delete by visible name, slug or email.',
    'Always report successful creates, the failing step, and each compensation result.',
  ],
  rollbackOrder: [
    'delete_registry_entries_for_current_run_in_reverse_order',
    'delete_business_rows_for_current_run_in_reverse_order_with_tenant_last_among_business_rows',
    'delete_auth_user_for_current_run_last',
  ],
  scenarioAuthThenTenantFailure: [
    {
      step: 1,
      action: 'create_auth_user',
      recordedArtifact: 'auth.users.id returned by Supabase Auth during the current run only',
    },
    {
      step: 2,
      action: 'tenant_insert_fails',
      reaction: 'stop immediately and do not continue with profile, user_access, registry or catalog writes',
    },
    {
      step: 3,
      action: 'compensate_auth_user',
      deleteStrategy: 'delete_exact_auth_user_id_from_current_run_journal_only',
    },
    {
      step: 4,
      action: 'report_failure',
      outcome: 'surface a diagnostic showing which exact current-run IDs were deleted during compensation',
    },
  ],
});

const buildRollbackPlan = (operations) => ({
  enabled: false,
  blockedReason: `Rollback requires ${PROVISIONING_REGISTRY_TABLE} and is limited to rows explicitly registered by STRASYK provisioning seed keys created during the current run.`,
  deleteOrder: [
    ...buildRegistryInsertOperations(operations)
      .slice()
      .reverse()
      .map((entry) => ({
        entityType: entry.entityType,
        tableName: entry.tableName,
        seedKey: entry.seedKey,
        deleteStrategy: 'delete_by_registry_record_id_only',
      })),
    ...operations
      .slice()
      .reverse()
      .filter((operation) => operation.tableName !== 'auth.users')
      .map((operation) => ({
        entityType: operation.entityType,
        tableName: operation.tableName,
        seedKey: operation.seedKey,
        deleteStrategy: operation.tableName === 'tenants'
          ? 'delete_tenant_last_among_business_rows_by_exact_record_id_only'
          : 'delete_by_exact_record_id_only',
      })),
  ],
  authCleanup: {
    tableName: 'auth.users',
    seedKey: OWNER_AUTH_SEED_KEY,
    deleteStrategy: 'delete_by_exact_auth_user_id_recorded_in_current_run_only_after_registry_cleanup',
  },
});

const buildProtectedIdRefusals = ({ operations, protectedIdSets }) => {
  const refusals = [];

  for (const operation of operations) {
    const targetId = operation.targetIdentifiers.id || null;
    if (!targetId) continue;

    if (operation.tableName === 'tenants' && protectedIdSets.tenantIds.has(targetId)) {
      refusals.push({
        reason: 'protected_tenant_id_collision',
        details: { seedKey: operation.seedKey, targetId },
      });
    }

    if (operation.tableName === 'restaurant_profiles' && protectedIdSets.restaurantProfileIds.has(targetId)) {
      refusals.push({
        reason: 'protected_restaurant_profile_id_collision',
        details: { seedKey: operation.seedKey, targetId },
      });
    }

    if (operation.tableName === 'user_access' && protectedIdSets.userAccessIds.has(targetId)) {
      refusals.push({
        reason: 'protected_user_access_id_collision',
        details: { seedKey: operation.seedKey, targetId },
      });
    }
  }

  return refusals;
};

const buildRegistryState = ({ operations, readModel }) => {
  const registryRowsBySeedKey = new Map((readModel.registry.rows || []).map((row) => [row.seed_key, row]));
  const resolvedTargetsBySeedKey = new Map((readModel.resolvedTargets || []).map((item) => [item.seedKey, item]));
  const missingRegistrySeedKeys = [];
  const checksumDrift = [];
  const missingResolvedTargets = [];
  const recordIdMismatches = [];
  const objectWithoutRegistry = [];
  const operationStates = [];

  for (const operation of operations) {
    const registryRow = registryRowsBySeedKey.get(operation.seedKey);
    const resolvedTarget = resolvedTargetsBySeedKey.get(operation.seedKey);
    const objectExists = operation.tableName === 'auth.users'
      ? Boolean(resolvedTarget?.exists)
      : Boolean(resolvedTarget?.exists);

    if (!registryRow && !objectExists) {
      operationStates.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        status: 'absent',
        expectedId: resolvedTarget?.expectedId || operation.targetIdentifiers.id || null,
      });
      continue;
    }

    if (!registryRow && objectExists) {
      objectWithoutRegistry.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        expectedId: resolvedTarget?.expectedId || operation.targetIdentifiers.id || null,
        resolvedId: resolvedTarget?.resolvedId || null,
      });
      operationStates.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        status: 'object_without_registry',
        expectedId: resolvedTarget?.expectedId || operation.targetIdentifiers.id || null,
        resolvedId: resolvedTarget?.resolvedId || null,
      });
      continue;
    }

    if (!registryRow) {
      missingRegistrySeedKeys.push(operation.seedKey);
      operationStates.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        status: 'registry_missing',
      });
      continue;
    }

    if (registryRow.record_table !== operation.tableName) {
      recordIdMismatches.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        registryRecordTable: registryRow.record_table,
        expectedTable: operation.tableName,
      });
      operationStates.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        status: 'record_mismatch',
        registryRecordTable: registryRow.record_table,
        expectedTable: operation.tableName,
      });
      continue;
    }

    if (!objectExists) {
      missingResolvedTargets.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        expectedId: resolvedTarget?.expectedId || registryRow.record_id,
      });
      operationStates.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        status: 'registry_without_object',
        expectedId: resolvedTarget?.expectedId || registryRow.record_id,
      });
      continue;
    }

    if (registryRow.checksum !== operation.checksum) {
      checksumDrift.push({
        seedKey: operation.seedKey,
        registryChecksum: registryRow.checksum,
        expectedChecksum: operation.checksum,
      });
      operationStates.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        status: 'checksum_drift',
        registryChecksum: registryRow.checksum,
        expectedChecksum: operation.checksum,
      });
      continue;
    }

    if (operation.tableName === 'auth.users') {
      if (!resolvedTarget.registryIdMatch || !resolvedTarget.registryBackedUserExists) {
        recordIdMismatches.push({
          seedKey: operation.seedKey,
          tableName: operation.tableName,
          registryRecordId: registryRow.record_id,
          resolvedId: resolvedTarget.resolvedId,
        });
        operationStates.push({
          seedKey: operation.seedKey,
          tableName: operation.tableName,
          status: 'record_mismatch',
          registryRecordId: registryRow.record_id,
          resolvedId: resolvedTarget.resolvedId,
        });
        continue;
      }
      operationStates.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        status: 'provisioned_match',
        recordId: registryRow.record_id,
      });
      continue;
    }

    if (registryRow.record_id !== operation.targetIdentifiers.id || resolvedTarget.resolvedId !== operation.targetIdentifiers.id) {
      recordIdMismatches.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        registryRecordId: registryRow.record_id,
        expectedId: operation.targetIdentifiers.id,
        resolvedId: resolvedTarget.resolvedId,
      });
      operationStates.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        status: 'record_mismatch',
        registryRecordId: registryRow.record_id,
        expectedId: operation.targetIdentifiers.id,
        resolvedId: resolvedTarget.resolvedId,
      });
      continue;
    }

    operationStates.push({
      seedKey: operation.seedKey,
      tableName: operation.tableName,
      status: 'provisioned_match',
      recordId: registryRow.record_id,
    });
  }

  const isFullyProvisioned = readModel.registry.visible
    && (readModel.registry.rowCount ?? 0) === operations.length
    && missingRegistrySeedKeys.length === 0
    && checksumDrift.length === 0
    && missingResolvedTargets.length === 0
    && recordIdMismatches.length === 0
    && objectWithoutRegistry.length === 0
    && operationStates.every((state) => state.status === 'provisioned_match');

  const isVirgin = (readModel.registry.rowCount ?? 0) === 0
    && operationStates.every((state) => state.status === 'absent');

  return {
    isFullyProvisioned,
    isVirgin,
    missingRegistrySeedKeys,
    checksumDrift,
    missingResolvedTargets,
    recordIdMismatches,
    objectWithoutRegistry,
    operationStates,
    recognizedRegistryCount: operationStates.filter((state) => state.status === 'provisioned_match').length,
  };
};

export const buildStage2DryRunPlan = ({ readModel, metrics }) => {
  const operations = buildStage2WriteOperations();
  const registryInserts = buildRegistryInsertOperations(operations);
  const protectedIdSets = buildProtectedIdSets(readModel.protectedSnapshot || {});
  const wouldRefuse = [];
  const registryState = buildRegistryState({ operations, readModel });
  const alreadyProvisioned = registryState.isFullyProvisioned;
  const virginEnvironment = registryState.isVirgin;
  const baselineReady = virginEnvironment
    && readModel.baseline.matches
    && readModel.baseline.metricsSnapshotMatchesBaseline
    && readModel.protectedSnapshotMatchesBaseline
    && (readModel.registry.rowCount ?? 0) === 0;
  const initialProvisionAttempt = baselineReady;

  if (!readModel.registry.visible) {
    wouldRefuse.push({
      reason: 'registry_missing',
      details: `Real execution is blocked until ${PROVISIONING_REGISTRY_TABLE} exists and is readable.`,
    });
  }

  if (!alreadyProvisioned && virginEnvironment && !readModel.baseline.matches) {
    wouldRefuse.push({
      reason: 'baseline_counts_changed',
      details: {
        ...readModel.baseline,
        behavior: 'requires_new_diagnostic_before_any_write',
      },
    });
  }

  if (!alreadyProvisioned && virginEnvironment && !readModel.baseline.metricsSnapshotMatchesBaseline) {
    wouldRefuse.push({
      reason: 'baseline_metrics_snapshot_changed',
      details: {
        expected: readModel.baseline.expected.metricsSnapshot,
        actual: readModel.baseline.metricsSnapshot,
        behavior: 'requires_new_diagnostic_before_any_write',
      },
    });
  }

  if (!alreadyProvisioned && virginEnvironment && !readModel.protectedSnapshotMatchesBaseline) {
    wouldRefuse.push({
      reason: 'protected_snapshot_changed',
      details: {
        behavior: 'requires_new_diagnostic_before_any_write',
      },
    });
  }

  if (initialProvisionAttempt && readModel.collisions.authUser) {
    wouldRefuse.push({
      reason: 'auth_user_collision',
      details: readModel.collisions.authUser,
    });
  }

  if (initialProvisionAttempt && (readModel.collisions.tenantBySlug.rows || []).length > 0) {
    wouldRefuse.push({
      reason: 'tenant_slug_collision',
      details: readModel.collisions.tenantBySlug.rows,
    });
  }

  if (initialProvisionAttempt && (readModel.collisions.tenantById.rows || []).length > 0) {
    wouldRefuse.push({
      reason: 'tenant_id_collision',
      details: readModel.collisions.tenantById.rows,
    });
  }

  if (initialProvisionAttempt && (readModel.collisions.userAccessByEmail.rows || []).length > 0) {
    wouldRefuse.push({
      reason: 'user_access_email_collision',
      details: readModel.collisions.userAccessByEmail.rows,
    });
  }

  if (initialProvisionAttempt && (readModel.collisions.userAccessById.rows || []).length > 0) {
    wouldRefuse.push({
      reason: 'user_access_id_collision',
      details: readModel.collisions.userAccessById.rows,
    });
  }

  if (initialProvisionAttempt) {
    wouldRefuse.push(...buildProtectedIdRefusals({ operations, protectedIdSets }));
  }

  if (!alreadyProvisioned && registryState.objectWithoutRegistry.length > 0) {
    wouldRefuse.push({
      reason: 'object_present_but_registry_absent',
      details: registryState.objectWithoutRegistry,
    });
  }

  if (!alreadyProvisioned && registryState.missingResolvedTargets.length > 0) {
    wouldRefuse.push({
      reason: 'registry_present_but_object_absent',
      details: registryState.missingResolvedTargets,
    });
  }

  if (!alreadyProvisioned && registryState.checksumDrift.length > 0) {
    wouldRefuse.push({
      reason: 'checksum_drift',
      details: registryState.checksumDrift,
    });
  }

  if (!alreadyProvisioned && registryState.recordIdMismatches.length > 0) {
    wouldRefuse.push({
      reason: 'registry_record_mismatch',
      details: registryState.recordIdMismatches,
    });
  }

  if (!alreadyProvisioned && !virginEnvironment && (readModel.registry.rowCount ?? 0) > 0 && (
    registryState.missingRegistrySeedKeys.length > 0
    || registryState.objectWithoutRegistry.length > 0
    || registryState.missingResolvedTargets.length > 0
    || registryState.recordIdMismatches.length > 0
    || registryState.checksumDrift.length > 0
  )) {
    wouldRefuse.push({
      reason: 'partial_registry_state',
      details: {
        registryRowCount: readModel.registry.rowCount,
        missingRegistrySeedKeys: registryState.missingRegistrySeedKeys,
        checksumDrift: registryState.checksumDrift,
        missingResolvedTargets: registryState.missingResolvedTargets,
        recordIdMismatches: registryState.recordIdMismatches,
        objectWithoutRegistry: registryState.objectWithoutRegistry,
      },
    });
  }

  const deliveryPeoplePayloadSafe = !operations.some((operation) => (
    operation.tableName === 'delivery_people'
    && Object.prototype.hasOwnProperty.call(operation.payloadPreview, 'password')
  ));

  if (!deliveryPeoplePayloadSafe) {
    wouldRefuse.push({
      reason: 'delivery_password_write_forbidden',
      details: 'delivery_people.password must never be written by provisioning.',
    });
  }

  const canonicalTenantMarked = CANONICAL_DATASET.tenant.markers.includes('TEST')
    && CANONICAL_DATASET.tenant.markers.includes('DEMO');

  if (!canonicalTenantMarked) {
    wouldRefuse.push({
      reason: 'tenant_not_marked_canonical_test',
      details: CANONICAL_DATASET.tenant.markers,
    });
  }

  const noOp = alreadyProvisioned;
  const plannedOperations = baselineReady ? operations : [];
  const plannedRegistryInserts = baselineReady ? registryInserts : [];

  return {
    executionState: alreadyProvisioned
      ? 'already_provisioned'
      : baselineReady
        ? 'provision_ready'
        : 'blocked',
    realExecutionAllowed: baselineReady && wouldRefuse.length === 0,
    alreadyProvisioned,
    noOp,
    protectedExistingData: {
      expectedTenantCount: readModel.baseline.expected.expectedTenantCount,
      actualTenantCount: metrics.tenantCount,
      expectedAuthUserCount: readModel.baseline.expected.expectedAuthUserCount,
      actualAuthUserCount: metrics.authUserCount,
      protectedSnapshotMatchesBaseline: readModel.protectedSnapshotMatchesBaseline,
      metricsSnapshotMatchesBaseline: readModel.baseline.metricsSnapshotMatchesBaseline,
      protectedSnapshot: buildProtectedSnapshotSummary(readModel.protectedSnapshot || {}),
    },
    idempotence: {
      authority: 'provisioning_registry_seed_keys_only',
      executionRule: 'No update or delete is allowed unless the target row is explicitly resolved through provisioning_registry.',
      writeRule: 'Display names, product names, visible emails and tenant slugs are never sufficient as write selectors.',
      createRule: 'If a target seed key resolves to an existing row not registered in provisioning_registry, execution must stop.',
    },
    checksumPolicy: buildChecksumPolicy(operations),
    mutationSummary: buildMutationSummary({ operations: plannedOperations, registryInserts: plannedRegistryInserts }),
    plannedMutations: plannedOperations.length + plannedRegistryInserts.length,
    futureWriteOrder: plannedOperations.map((operation) => ({
      order: operation.order,
      entityType: operation.entityType,
      tableName: operation.tableName,
      seedKey: operation.seedKey,
      dependency: operation.dependency,
      checksum: operation.checksum,
    })),
    registryWriteOrder: plannedRegistryInserts,
    runtimeExecutionSteps: buildRuntimeExecutionSteps(plannedOperations),
    registryState,
    wouldCreate: plannedOperations,
    wouldUpdate: [],
    wouldDelete: [],
    wouldRefuse,
    rollbackPlan: buildRollbackPlan(operations),
    failureCompensationPlan: buildFailureCompensationPlan(operations),
    registryRequirement: {
      tableName: PROVISIONING_REGISTRY_TABLE,
      status: readModel.registry.visible ? 'present' : 'missing',
      blocking: !readModel.registry.visible,
    },
  };
};
