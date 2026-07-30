import { CANONICAL_DATASET } from './data/canonicalDataset.mjs';
import { getStage2TargetIds } from './stage2Ids.mjs';

export const CANONICAL_TENANT_SUBSCRIPTION_PLAN = 'basic';

const KNOWN_NON_NULL_FIELDS = {
  tenants: ['id', 'nom_commercial', 'slug', 'owner_email', 'active', 'subscription_plan', 'pos_suspended'],
  restaurant_profiles: ['id', 'tenant_id', 'nom_etablissement', 'adresse', 'telephone'],
  user_access: ['id', 'tenant_id', 'user_email', 'role', 'is_active'],
  categories: ['id', 'tenant_id', 'nom', 'disponible', 'sort_order'],
  products: ['id', 'tenant_id', 'category_id', 'nom', 'disponible', 'tva', 'prix'],
  ingredients: ['id', 'tenant_id', 'nom', 'unite', 'cout_unitaire', 'quantite_stock'],
  product_ingredients: ['id', 'tenant_id', 'product_id', 'ingredient_id', 'quantite', 'retirable'],
  option_groups: ['id', 'tenant_id', 'product_id', 'nom', 'selection_type', 'min_selections', 'max_selections', 'required', 'manages_sizes'],
  option_items: ['id', 'tenant_id', 'option_group_id', 'nom', 'price_surcharge'],
  customers: ['id', 'tenant_id', 'nom', 'prenom', 'telephone', 'adresse', 'code_postal', 'ville', 'adresses', 'cagnotte_balance'],
  tables: ['id', 'tenant_id', 'nom', 'capacite', 'forme', 'statut', 'zone'],
  loyalty_rules: ['id', 'tenant_id', 'nom', 'active', 'canaux', 'modes_commande', 'type_recompense', 'valeur_recompense', 'produit_offert_ids'],
  cagnotte_rules: ['id', 'tenant_id', 'nom', 'active', 'canaux', 'accumulation_rate'],
  delivery_people: ['id', 'tenant_id', 'nom', 'prenom', 'telephone', 'user_email', 'username', 'vehicule', 'disponible', 'app_access_enabled', 'en_livraison', 'nb_livraisons_jour', 'total_encaisse'],
  orders: ['id', 'tenant_id', 'numero_commande', 'numero_caisse', 'type_commande', 'articles', 'total_ht', 'total_tva', 'total_ttc', 'statut', 'mode_paiement', 'payee', 'print_at_counter', 'from_kiosk', 'from_web'],
};

const isMissingRequiredValue = (value) => value === null || value === undefined;

export const getKnownNonNullFields = (tableName) => KNOWN_NON_NULL_FIELDS[tableName] || [];

export const validateTenantPayload = (payload) => {
  if (payload.subscription_plan !== CANONICAL_TENANT_SUBSCRIPTION_PLAN) {
    return [{
      seedKey: CANONICAL_DATASET.tenant.seedKey,
      tableName: 'tenants',
      field: 'subscription_plan',
      code: 'UNSUPPORTED_SUBSCRIPTION_PLAN',
      expected: CANONICAL_TENANT_SUBSCRIPTION_PLAN,
      actual: payload.subscription_plan ?? null,
      message: 'Tenant payload validation failed: unsupported subscription_plan.',
    }];
  }

  return [];
};

export const validateProductPayload = ({ seedKey, payload }) => {
  const issues = [];
  const sizePrices = Array.isArray(payload.size_prices) ? payload.size_prices : [];

  if (payload.prix === null || payload.prix === undefined) {
    issues.push({
      seedKey,
      tableName: 'products',
      field: 'prix',
      code: 'REQUIRED_NON_NULL_FIELD',
      message: 'products.prix is required and cannot be null.',
    });
  }

  if (sizePrices.length > 0) {
    const positiveSizePrices = sizePrices
      .map((entry) => Number(entry?.price))
      .filter((price) => Number.isFinite(price) && price > 0);
    const expectedLegacyPrice = positiveSizePrices.length > 0 ? Math.min(...positiveSizePrices) : null;

    if (!Number.isFinite(Number(payload.prix)) || Number(payload.prix) <= 0) {
      issues.push({
        seedKey,
        tableName: 'products',
        field: 'prix',
        code: 'INVALID_SIZED_PRODUCT_PRICE',
        message: 'Sized products require a positive legacy prix derived from size_prices.',
      });
    } else if (expectedLegacyPrice !== null && Number(payload.prix) !== expectedLegacyPrice) {
      issues.push({
        seedKey,
        tableName: 'products',
        field: 'prix',
        code: 'INCONSISTENT_SIZED_PRODUCT_PRICE',
        expected: expectedLegacyPrice,
        actual: Number(payload.prix),
        message: 'Sized product prix must match the smallest positive size price used by the POS.',
      });
    }
  }

  return issues;
};

export const validateCanonicalPayloads = (payloadsBySeedKey, operations = []) => {
  const issues = [];

  for (const operation of operations) {
    if (operation.tableName === 'auth.users') continue;

    const payload = payloadsBySeedKey[operation.seedKey];
    if (!payload) {
      issues.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        field: null,
        code: 'MISSING_CANONICAL_PAYLOAD',
        message: `Missing canonical payload for ${operation.seedKey}.`,
      });
      continue;
    }

    for (const field of getKnownNonNullFields(operation.tableName)) {
      if (isMissingRequiredValue(payload[field])) {
        issues.push({
          seedKey: operation.seedKey,
          tableName: operation.tableName,
          field,
          code: 'REQUIRED_NON_NULL_FIELD',
          message: `${operation.tableName}.${field} is required and cannot be null.`,
        });
      }
    }

    if (operation.tableName === 'tenants') {
      issues.push(...validateTenantPayload(payload));
    }

    if (operation.tableName === 'products') {
      issues.push(...validateProductPayload({ seedKey: operation.seedKey, payload }));
    }

    if (operation.tableName === 'delivery_people' && Object.prototype.hasOwnProperty.call(payload, 'password')) {
      issues.push({
        seedKey: operation.seedKey,
        tableName: operation.tableName,
        field: 'password',
        code: 'DELIVERY_PASSWORD_FORBIDDEN',
        message: 'delivery_people.password write is forbidden.',
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

export const buildCanonicalPayloadsBySeedKey = () => {
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
      statut: order.statut === 'payÃƒÂ©' ? 'payÃ©' : order.statut,
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
