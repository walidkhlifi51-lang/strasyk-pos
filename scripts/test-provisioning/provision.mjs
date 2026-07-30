import { ProvisioningError } from './errors.mjs';
import { createSupabaseAdminClient } from './supabaseAdmin.mjs';
import { buildStage2DryRunPlan } from './stage2Planner.mjs';
import { collectReadOnlyMetrics } from './readOnlyMetrics.mjs';
import { collectStage2ReadModel } from './stage2ReadModel.mjs';
import { CANONICAL_DATASET } from './data/canonicalDataset.mjs';
import { getStage2TargetIds } from './stage2Ids.mjs';
import { PROVISIONING_REGISTRY_TABLE } from './stage2Registry.mjs';
import {
  CANONICAL_TENANT_SUBSCRIPTION_PLAN,
  validateCanonicalPayloads,
} from './canonicalPayloads.mjs';

const OWNER_AUTH_SEED_KEY = 'strasyk-pos-test:user:owner';
const ROOT_BUSINESS_TABLES = new Set(['tenants']);

export const toValueType = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

export const describePayloadShape = (payload) => {
  const entries = Object.entries(payload || {});
  return {
    columnNames: entries.map(([key]) => key),
    valueTypes: Object.fromEntries(entries.map(([key, value]) => [key, toValueType(value)])),
    nullFields: entries.filter(([, value]) => value === null).map(([key]) => key),
    absentOptionalFields: [
      'name',
      'status',
      'owner_id',
      'created_by',
      'subscription_status',
      'plan',
      'settings',
      'created_at',
      'updated_at',
    ].filter((key) => !Object.prototype.hasOwnProperty.call(payload || {}, key)),
  };
};

export const buildSupabaseErrorDetails = ({ operation, payload, error }) => ({
  operation: operation.seedKey,
  table: operation.tableName,
  message: error?.message || null,
  code: error?.code || null,
  details: error?.details || null,
  hint: error?.hint || null,
  status: error?.status ?? null,
  statusText: error?.statusText ?? null,
  payloadColumns: describePayloadShape(payload).columnNames,
  payloadTypes: describePayloadShape(payload).valueTypes,
  nullFields: describePayloadShape(payload).nullFields,
  absentExpectedFields: describePayloadShape(payload).absentOptionalFields,
});

export const getProvisioningReadbackFields = (tableName) => (
  ROOT_BUSINESS_TABLES.has(tableName) ? ['id'] : ['id', 'tenant_id']
);

export const getProvisioningRecordId = ({ operation, payload }) => (
  payload?.id ?? operation?.targetIdentifiers?.id ?? null
);

export const insertProvisioningBusinessRow = async ({ supabaseAdmin, operation, payload }) => {
  const recordId = getProvisioningRecordId({ operation, payload });
  const { error: insertError } = await supabaseAdmin
    .from(operation.tableName)
    .insert(payload);

  if (insertError) {
    throw new ProvisioningError(`Insert failed for ${operation.tableName}.`, {
      code: 'BUSINESS_INSERT_FAILED',
      details: buildSupabaseErrorDetails({ operation, payload, error: insertError }),
      cause: insertError,
    });
  }

  if (!recordId) {
    throw new ProvisioningError(`Insert succeeded but record id is unavailable for ${operation.tableName}.`, {
      code: 'BUSINESS_READBACK_ID_UNAVAILABLE',
      details: {
        operation: operation.seedKey,
        table: operation.tableName,
        message: 'Insert completed but no stable record id is available for readback.',
        code: null,
        details: null,
        hint: null,
        status: null,
        statusText: null,
        payloadColumns: describePayloadShape(payload).columnNames,
        payloadTypes: describePayloadShape(payload).valueTypes,
        nullFields: describePayloadShape(payload).nullFields,
        absentExpectedFields: describePayloadShape(payload).absentOptionalFields,
      },
    });
  }

  const readbackFields = getProvisioningReadbackFields(operation.tableName);
  const { data: readbackData, error: readbackError } = await supabaseAdmin
    .from(operation.tableName)
    .select(readbackFields.join(','))
    .eq('id', recordId)
    .single();

  if (readbackError || !readbackData?.id) {
    throw new ProvisioningError(`Insert succeeded but readback failed for ${operation.tableName}.`, {
      code: 'BUSINESS_READBACK_FAILED',
      details: {
        ...(readbackError
          ? buildSupabaseErrorDetails({ operation, payload, error: readbackError })
          : {
            operation: operation.seedKey,
            table: operation.tableName,
            message: 'Readback returned no id.',
            code: null,
            details: null,
            hint: null,
            status: null,
            statusText: null,
            payloadColumns: describePayloadShape(payload).columnNames,
            payloadTypes: describePayloadShape(payload).valueTypes,
            nullFields: describePayloadShape(payload).nullFields,
            absentExpectedFields: describePayloadShape(payload).absentOptionalFields,
          }),
        recordId,
        readbackFields,
      },
      cause: readbackError,
    });
  }

  return readbackData;
};

const buildProtectedIdSets = (protectedSnapshot) => ({
  authUserIds: new Set((protectedSnapshot.authUsers || []).map((item) => item.id).filter(Boolean)),
  tenantIds: new Set((protectedSnapshot.tenants || []).map((item) => item.id).filter(Boolean)),
  restaurantProfileIds: new Set((protectedSnapshot.restaurantProfiles || []).map((item) => item.id).filter(Boolean)),
  userAccessIds: new Set((protectedSnapshot.userAccess || []).map((item) => item.id).filter(Boolean)),
});

const selectRows = async (supabaseAdmin, tableName, queryBuilder) => {
  const { data, error } = await queryBuilder(supabaseAdmin.from(tableName));
  if (error) {
    throw new ProvisioningError(`Unable to read ${tableName} during verification.`, {
      code: 'POST_WRITE_VERIFICATION_FAILED',
      details: { tableName, message: error.message },
      cause: error,
    });
  }
  return data || [];
};

const buildPayloadsBySeedKey = () => {
  const ids = getStage2TargetIds();
  const tenantId = CANONICAL_DATASET.tenant.targetId;
  const productIds = Object.fromEntries(CANONICAL_DATASET.products.map((item) => [item.seedKey, ids[item.seedKey]]));
  const ingredientIds = Object.fromEntries(CANONICAL_DATASET.ingredients.map((item) => [item.seedKey, ids[item.seedKey]]));
  const customerIds = Object.fromEntries(CANONICAL_DATASET.customers.map((item) => [item.seedKey, ids[item.seedKey]]));
  const tableIds = Object.fromEntries(CANONICAL_DATASET.tables.map((item) => [item.seedKey, ids[item.seedKey]]));
  const deliveryIds = Object.fromEntries(CANONICAL_DATASET.deliveryPeople.map((item) => [item.seedKey, ids[item.seedKey]]));
  const optionItemIds = Object.fromEntries(CANONICAL_DATASET.optionItems.map((item) => [item.seedKey, ids[item.seedKey]]));
  const ingredientResolvedIds = Object.fromEntries(CANONICAL_DATASET.ingredients.map((item) => [item.seedKey, ids[item.seedKey]]));

  const payloads = {
    [CANONICAL_DATASET.tenant.seedKey]: {
      id: tenantId,
      nom_commercial: CANONICAL_DATASET.tenant.displayName,
      slug: CANONICAL_DATASET.tenant.slug,
      owner_email: CANONICAL_DATASET.identity.ownerEmail,
      active: CANONICAL_DATASET.tenant.active,
      subscription_plan: CANONICAL_TENANT_SUBSCRIPTION_PLAN,
      pos_suspended: false,
    },
    [CANONICAL_DATASET.profile.seedKey]: {
      id: CANONICAL_DATASET.profile.targetId,
      tenant_id: tenantId,
      nom_etablissement: CANONICAL_DATASET.profile.nom_etablissement,
      adresse: CANONICAL_DATASET.profile.adresse,
      telephone: CANONICAL_DATASET.profile.telephone,
      frais_livraison: CANONICAL_DATASET.profile.frais_livraison,
      montant_minimum_livraison: CANONICAL_DATASET.profile.montant_minimum_livraison,
      zone_livraison_km: CANONICAL_DATASET.profile.zone_livraison_km,
      impression_auto: CANONICAL_DATASET.profile.impression_auto,
      manages_deliveries: CANONICAL_DATASET.profile.manages_deliveries,
      manages_table_plan: CANONICAL_DATASET.profile.manages_table_plan,
      table_plan_allowed: CANONICAL_DATASET.profile.manages_table_plan,
      manages_web_ordering: CANONICAL_DATASET.profile.manages_web_ordering,
      delivery_app_allowed: CANONICAL_DATASET.profile.manages_deliveries,
      manages_delivery_app: CANONICAL_DATASET.profile.manages_deliveries,
      tva_rates: CANONICAL_DATASET.tenant.vatRates.map((rate) => ({ rate, label: `TVA ${rate}` })),
      scratch_tickets_enabled: false,
    },
    [CANONICAL_DATASET.userAccess.seedKey]: {
      id: CANONICAL_DATASET.userAccess.targetId,
      tenant_id: tenantId,
      user_email: CANONICAL_DATASET.identity.ownerEmail,
      role: CANONICAL_DATASET.userAccess.role,
      is_active: CANONICAL_DATASET.userAccess.is_active,
    },
  };

  for (const category of CANONICAL_DATASET.categories) {
    payloads[category.seedKey] = {
      id: ids[category.seedKey],
      tenant_id: tenantId,
      nom: category.nom,
      disponible: category.disponible,
      sort_order: category.sort_order,
    };
  }

  for (const [index, product] of CANONICAL_DATASET.products.entries()) {
    payloads[product.seedKey] = {
      id: ids[product.seedKey],
      tenant_id: tenantId,
      category_id: ids[product.categorySeedKey],
      nom: product.nom,
      description: product.nom,
      disponible: true,
      sort_order: index + 1,
      tva: product.tva,
      prix: product.prix ?? null,
      base_price: product.base_price ?? null,
      size_prices: product.size_prices || [],
      prix_par_mode: product.prix_par_mode || {},
      size_prix_par_mode: product.size_prix_par_mode || [],
      web_price: product.web_price ?? null,
      web_size_prices: product.web_size_prices || [],
    };
  }

  for (const ingredient of CANONICAL_DATASET.ingredients) {
    payloads[ingredient.seedKey] = {
      id: ids[ingredient.seedKey],
      tenant_id: tenantId,
      nom: ingredient.nom,
      unite: 'piece',
      cout_unitaire: 0,
      quantite_stock: 0,
    };
  }

  for (const relation of CANONICAL_DATASET.productIngredients) {
    payloads[relation.seedKey] = {
      id: ids[relation.seedKey],
      tenant_id: tenantId,
      product_id: productIds[relation.productSeedKey],
      ingredient_id: ingredientIds[relation.ingredientSeedKey],
      quantite: relation.quantite,
      retirable: relation.retirable,
    };
  }

  for (const group of CANONICAL_DATASET.optionGroups) {
    payloads[group.seedKey] = {
      id: ids[group.seedKey],
      tenant_id: tenantId,
      product_id: productIds[group.dependency],
      nom: group.nom,
      selection_type: 'single',
      min_selections: 1,
      max_selections: 1,
      required: true,
      manages_sizes: true,
    };
  }

  for (const item of CANONICAL_DATASET.optionItems) {
    payloads[item.seedKey] = {
      id: ids[item.seedKey],
      tenant_id: tenantId,
      option_group_id: ids[item.dependency],
      nom: item.nom,
      price_surcharge: item.nom === 'Grande' ? 2 : 0,
      size_surcharges: null,
    };
  }

  for (const [index, customer] of CANONICAL_DATASET.customers.entries()) {
    payloads[customer.seedKey] = {
      id: ids[customer.seedKey],
      tenant_id: tenantId,
      nom: customer.nom,
      prenom: customer.prenom,
      telephone: `060000000${index + 1}`,
      email: `${customer.prenom.toLowerCase()}.${customer.nom.toLowerCase()}@test.invalid`,
      adresse: index === 1 ? '25 avenue du Test, 75011 Paris' : '10 rue de la Demonstration, 75000 Paris',
      code_postal: index === 1 ? '75011' : '75000',
      ville: 'Paris',
      etage: null,
      interphone: null,
      adresses: [],
      cagnotte_balance: index === 1 ? 12.5 : 0,
    };
  }

  for (const [index, tableItem] of CANONICAL_DATASET.tables.entries()) {
    payloads[tableItem.seedKey] = {
      id: ids[tableItem.seedKey],
      tenant_id: tenantId,
      nom: tableItem.nom,
      capacite: index === 0 ? 2 : 4,
      forme: index === 0 ? 'carree' : 'rectangulaire',
      statut: 'disponible',
      zone: 'salle',
    };
  }

  for (const rule of CANONICAL_DATASET.loyaltyRules) {
    payloads[rule.seedKey] = {
      id: ids[rule.seedKey],
      tenant_id: tenantId,
      nom: rule.nom,
      description: 'Reduction fixe de demonstration',
      numero_commande: 10,
      active: rule.active,
      canaux: ['caisse'],
      modes_commande: ['sur_place', 'emporter', 'livraison'],
      type_recompense: 'fixed_discount',
      valeur_recompense: 5,
      produit_offert_ids: [],
    };
  }

  for (const rule of CANONICAL_DATASET.cagnotteRules) {
    payloads[rule.seedKey] = {
      id: ids[rule.seedKey],
      tenant_id: tenantId,
      nom: rule.nom,
      active: rule.active,
      canaux: ['caisse'],
      accumulation_rate: rule.accumulation_rate,
    };
  }

  for (const deliveryPerson of CANONICAL_DATASET.deliveryPeople) {
    payloads[deliveryPerson.seedKey] = {
      id: ids[deliveryPerson.seedKey],
      tenant_id: tenantId,
      nom: deliveryPerson.nom,
      prenom: deliveryPerson.prenom,
      telephone: deliveryPerson.telephone,
      user_email: deliveryPerson.user_email,
      username: deliveryPerson.username,
      vehicule: deliveryPerson.vehicule,
      disponible: deliveryPerson.disponible,
      app_access_enabled: true,
      en_livraison: false,
      nb_livraisons_jour: 0,
      total_encaisse: 0,
    };
  }

  const buildOrderArticles = (articles) => articles.map((article) => ({
    product_id: article.productSeedKey ? productIds[article.productSeedKey] : article.product_id,
    nom_produit: article.nom_produit,
    quantite: article.quantite,
    prix_unitaire: article.prix_unitaire,
    total_ligne: article.total_ligne,
    tva: article.tva,
    options: (article.options || []).map((option) => ({
      id: option.optionItemSeedKey ? optionItemIds[option.optionItemSeedKey] : option.id,
      nom: option.nom,
      price_surcharge: option.price_surcharge,
    })),
    exclusions: (article.exclusions || []).map((ingredient) => ({
      id: ingredient.ingredientSeedKey ? ingredientResolvedIds[ingredient.ingredientSeedKey] : ingredient.id,
      nom: ingredient.nom,
    })),
    notes: article.notes || null,
    size: article.size || null,
  }));

  for (const order of CANONICAL_DATASET.orders) {
    const customerId = order.customerSeedKey ? customerIds[order.customerSeedKey] : null;
    payloads[order.seedKey] = {
      id: ids[order.seedKey],
      tenant_id: tenantId,
      numero_commande: order.numero_commande,
      numero_caisse: order.numero_caisse,
      type_commande: order.type_commande,
      customer_id: customerId,
      customer_name: customerId ? `${payloads[order.customerSeedKey].prenom} ${payloads[order.customerSeedKey].nom}` : null,
      table_id: order.tableSeedKey ? tableIds[order.tableSeedKey] : null,
      delivery_person_id: order.deliverySeedKey ? deliveryIds[order.deliverySeedKey] : null,
      delivery_address: order.delivery_address,
      articles: buildOrderArticles(order.articles),
      total_ht: order.total_ht,
      total_tva: order.total_tva,
      total_ttc: order.total_ttc,
      statut: order.statut === 'payÃ©' ? 'payé' : order.statut,
      mode_paiement: order.mode_paiement,
      mode_paiement_prevu: order.mode_paiement_prevu,
      numero_bipeur: order.numero_bipeur,
      numero_table: order.tableSeedKey ? payloads[order.tableSeedKey].nom : null,
      payee: order.payee,
      notes: order.notes,
      cagnotte_spent: order.cagnotte_spent,
      scratch_reduction: order.scratch_reduction,
      print_at_counter: order.print_at_counter,
      from_kiosk: order.from_kiosk,
      from_web: order.from_web,
    };
  }

  return payloads;
};

const deleteCreatedEntity = async ({ supabaseAdmin, entry }) => {
  if (entry.tableName === 'auth.users') {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(entry.createdId);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from(entry.tableName).delete().eq('id', entry.createdId);
  if (error) throw error;
};

const compensateFailure = async ({ supabaseAdmin, executionJournal, protectedIdSets, failure }) => {
  const compensations = [];
  const blockedCompensations = [];

  for (const entry of executionJournal.slice().reverse()) {
    if (entry.registryEntryId) {
      try {
        const { error } = await supabaseAdmin.from(PROVISIONING_REGISTRY_TABLE).delete().eq('id', entry.registryEntryId);
        if (error) throw error;
        compensations.push({
          phase: 'registry_delete',
          tableName: PROVISIONING_REGISTRY_TABLE,
          seedKey: entry.seedKey,
          id: entry.registryEntryId,
          status: 'deleted',
        });
      } catch (error) {
        blockedCompensations.push({
          phase: 'registry_delete',
          tableName: PROVISIONING_REGISTRY_TABLE,
          seedKey: entry.seedKey,
          id: entry.registryEntryId,
          status: 'failed',
          message: error.message,
        });
      }
    }

    const isProtected = (
      (entry.tableName === 'auth.users' && protectedIdSets.authUserIds.has(entry.createdId))
      || (entry.tableName === 'tenants' && protectedIdSets.tenantIds.has(entry.createdId))
      || (entry.tableName === 'restaurant_profiles' && protectedIdSets.restaurantProfileIds.has(entry.createdId))
      || (entry.tableName === 'user_access' && protectedIdSets.userAccessIds.has(entry.createdId))
    );

    if (isProtected) {
      blockedCompensations.push({
        phase: 'entity_delete',
        tableName: entry.tableName,
        seedKey: entry.seedKey,
        id: entry.createdId,
        status: 'blocked_protected_id',
      });
      continue;
    }

    try {
      await deleteCreatedEntity({ supabaseAdmin, entry });
      compensations.push({
        phase: 'entity_delete',
        tableName: entry.tableName,
        seedKey: entry.seedKey,
        id: entry.createdId,
        status: 'deleted',
      });
    } catch (error) {
      blockedCompensations.push({
        phase: 'entity_delete',
        tableName: entry.tableName,
        seedKey: entry.seedKey,
        id: entry.createdId,
        status: 'failed',
        message: error.message,
      });
    }
  }

  return {
    failure: {
      message: failure.message,
      code: failure.code || 'PROVISION_WRITE_FAILED',
    },
    compensations,
    blockedCompensations,
    baselineRestored: blockedCompensations.length === 0,
  };
};

export const executeProvision = async ({ config, schemaReport, logger }) => {
  if (!config.ownerPassword) {
    throw new ProvisioningError('STRASYK_TEST_OWNER_PASSWORD is required for real provisioning.', {
      code: 'MISSING_OWNER_PASSWORD',
    });
  }

  const beforeMetrics = await collectReadOnlyMetrics({ config, schemaReport });
  const readModel = await collectStage2ReadModel({ config, schemaReport, metrics: beforeMetrics });
  const preflightPlan = buildStage2DryRunPlan({ readModel, metrics: beforeMetrics });

  if (!preflightPlan.realExecutionAllowed || preflightPlan.executionState !== 'provision_ready') {
    throw new ProvisioningError('Provisioning preflight failed; real execution is blocked.', {
      code: 'PRE_FLIGHT_BLOCKED',
      details: {
        executionState: preflightPlan.executionState,
        wouldRefuse: preflightPlan.wouldRefuse,
      },
    });
  }

  logger.info('Provisioning preflight accepted.', {
    executionState: preflightPlan.executionState,
    totalMutationsPrevues: preflightPlan.mutationSummary.totalMutationsPrevues,
  });

  const supabaseAdmin = createSupabaseAdminClient(config);
  const protectedIdSets = buildProtectedIdSets(readModel.protectedSnapshot);
  const operations = preflightPlan.futureWriteOrder;
  const payloadsBySeedKey = buildPayloadsBySeedKey();
  const payloadValidation = validateCanonicalPayloads(payloadsBySeedKey, operations);
  if (!payloadValidation.valid) {
    throw new ProvisioningError('Canonical payload validation failed before provisioning writes.', {
      code: 'CANONICAL_PAYLOAD_VALIDATION_FAILED',
      details: {
        issues: payloadValidation.issues,
      },
    });
  }
  const executionJournal = [];
  const createdAuthIdsBefore = new Set((readModel.protectedSnapshot.authUsers || []).map((item) => item.id));

  try {
    for (const operation of operations) {
      if (operation.tableName === 'auth.users') {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: CANONICAL_DATASET.identity.ownerEmail,
          password: config.ownerPassword,
          email_confirm: true,
          user_metadata: {
            full_name: CANONICAL_DATASET.identity.ownerFullName,
            provisioning_seed_key: OWNER_AUTH_SEED_KEY,
          },
        });
        if (error || !data?.user?.id) {
          throw new ProvisioningError('Auth user creation failed.', {
            code: 'AUTH_USER_CREATE_FAILED',
            details: { message: error?.message || 'No auth user id returned.' },
            cause: error,
          });
        }

        executionJournal.push({
          entityType: operation.entityType,
          tableName: operation.tableName,
          createdId: data.user.id,
          seedKey: operation.seedKey,
          registryRegistered: false,
          registryEntryId: null,
          creationOrder: operation.order,
        });
      } else {
        const payload = payloadsBySeedKey[operation.seedKey];
        if (!payload) {
          throw new ProvisioningError(`Missing canonical payload for ${operation.seedKey}.`, {
            code: 'MISSING_CANONICAL_PAYLOAD',
          });
        }

        const data = await insertProvisioningBusinessRow({ supabaseAdmin, operation, payload });

        executionJournal.push({
          entityType: operation.entityType,
          tableName: operation.tableName,
          createdId: data.id,
          seedKey: operation.seedKey,
          registryRegistered: false,
          registryEntryId: null,
          creationOrder: operation.order,
        });
      }

      const latestEntry = executionJournal.at(-1);
      const registryInsert = {
        project_ref: config.projectRef,
        tenant_id: operation.tableName === 'auth.users' ? null : CANONICAL_DATASET.tenant.targetId,
        entity_type: operation.entityType,
        seed_key: operation.seedKey,
        record_table: operation.tableName,
        record_id: latestEntry.createdId,
        checksum: operation.checksum,
      };
      const { data: registryRow, error: registryError } = await supabaseAdmin
        .from(PROVISIONING_REGISTRY_TABLE)
        .insert(registryInsert)
        .select('id')
        .single();
      if (registryError || !registryRow?.id) {
        throw new ProvisioningError(`Registry insert failed for ${operation.seedKey}.`, {
          code: 'REGISTRY_INSERT_FAILED',
          details: { seedKey: operation.seedKey, message: registryError?.message || 'No registry id returned.' },
          cause: registryError,
        });
      }

      latestEntry.registryRegistered = true;
      latestEntry.registryEntryId = registryRow.id;
    }
  } catch (error) {
    const compensation = await compensateFailure({
      supabaseAdmin,
      executionJournal,
      protectedIdSets,
      failure: error,
    });
    throw new ProvisioningError('Provisioning failed and compensation was triggered.', {
      code: 'PROVISIONING_FAILED_WITH_COMPENSATION',
      details: {
        compensation,
        baselineRestored: compensation.baselineRestored,
        journal: executionJournal,
        createdRecords: executionJournal.map((entry) => ({
          tableName: entry.tableName,
          seedKey: entry.seedKey,
          createdId: entry.createdId,
          registryEntryId: entry.registryEntryId,
          registryRegistered: entry.registryRegistered,
          creationOrder: entry.creationOrder,
        })),
        deletedRecords: compensation.compensations,
        blockedCompensations: compensation.blockedCompensations,
      },
      cause: error,
    });
  }

  const afterMetrics = await collectReadOnlyMetrics({ config, schemaReport });
  const afterReadModel = await collectStage2ReadModel({ config, schemaReport, metrics: afterMetrics });
  const afterPlan = buildStage2DryRunPlan({ readModel: afterReadModel, metrics: afterMetrics });
  const authUsersAfter = afterReadModel.protectedSnapshot.authUsers || [];
  const protectedAuthUsersStillPresent = [...createdAuthIdsBefore].every((id) => authUsersAfter.some((item) => item.id === id));
  const protectedTenantsStillPresent = (readModel.protectedSnapshot.tenants || []).every(
    (tenant) => (afterReadModel.protectedSnapshot.tenants || []).some((item) => item.id === tenant.id),
  );
  const protectedProfilesStillPresent = (readModel.protectedSnapshot.restaurantProfiles || []).every(
    (profile) => (afterReadModel.protectedSnapshot.restaurantProfiles || []).some((item) => item.id === profile.id),
  );
  const deliveryPasswords = await selectRows(supabaseAdmin, 'delivery_people', (query) => query
    .select('id,password')
    .eq('tenant_id', CANONICAL_DATASET.tenant.targetId)
    .limit(10));
  const newOrders = await selectRows(supabaseAdmin, 'orders', (query) => query
    .select('id,numero_commande,tenant_id')
    .eq('tenant_id', CANONICAL_DATASET.tenant.targetId)
    .order('numero_caisse', { ascending: true }));

  return {
    mode: 'provision',
    writesPerformed: true,
    preflight: {
      executionState: preflightPlan.executionState,
      realExecutionAllowed: preflightPlan.realExecutionAllowed,
      mutationSummary: preflightPlan.mutationSummary,
      wouldRefuse: preflightPlan.wouldRefuse,
    },
    executionJournal,
    compensationTriggered: false,
    beforeMetrics,
    afterMetrics,
    afterPlan,
    createdIds: executionJournal.map((entry) => ({
      seedKey: entry.seedKey,
      tableName: entry.tableName,
      createdId: entry.createdId,
      registryEntryId: entry.registryEntryId,
    })),
    verification: {
      protectedAuthUsersStillPresent,
      protectedTenantsStillPresent,
      protectedProfilesStillPresent,
      deliveryPasswordsNull: deliveryPasswords.every((item) => item.password == null),
      canonicalOrderIds: newOrders.map((item) => item.id),
    },
  };
};
