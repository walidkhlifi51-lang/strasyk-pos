export const SEED_NAMESPACE = 'strasyk-pos-test';

export const SEED_KEYS = {
  tenant: {
    canonical: `${SEED_NAMESPACE}:tenant:canonical`,
  },
  profiles: {
    restaurant: `${SEED_NAMESPACE}:profile:restaurant`,
  },
  userAccess: {
    owner: `${SEED_NAMESPACE}:user-access:owner`,
  },
  categories: {
    pizzas: `${SEED_NAMESPACE}:category:pizzas`,
    drinks: `${SEED_NAMESPACE}:category:drinks`,
    desserts: `${SEED_NAMESPACE}:category:desserts`,
  },
  products: {
    pizzaMargherita: `${SEED_NAMESPACE}:product:pizza-margherita`,
    cocaCola: `${SEED_NAMESPACE}:product:coca-cola`,
    eauPlate: `${SEED_NAMESPACE}:product:eau-plate`,
    tiramisu: `${SEED_NAMESPACE}:product:tiramisu`,
  },
  optionGroups: {
    pizzaSizes: `${SEED_NAMESPACE}:option-group:pizza-sizes`,
  },
  optionItems: {
    sizeSmall: `${SEED_NAMESPACE}:option-item:size-small`,
    sizeLarge: `${SEED_NAMESPACE}:option-item:size-large`,
  },
  ingredients: {
    tomatoSauce: `${SEED_NAMESPACE}:ingredient:tomato-sauce`,
    olives: `${SEED_NAMESPACE}:ingredient:olives`,
    cheese: `${SEED_NAMESPACE}:ingredient:cheese`,
  },
  productIngredients: {
    pizzaMargheritaCheese: `${SEED_NAMESPACE}:product-ingredient:pizza-margherita-cheese`,
    pizzaMargheritaSauce: `${SEED_NAMESPACE}:product-ingredient:pizza-margherita-sauce`,
    pizzaMargheritaOlives: `${SEED_NAMESPACE}:product-ingredient:pizza-margherita-olives`,
  },
  tables: {
    t1: `${SEED_NAMESPACE}:table:t1`,
    t2: `${SEED_NAMESPACE}:table:t2`,
  },
  customers: {
    guest1: `${SEED_NAMESPACE}:customer:guest-1`,
    delivery: `${SEED_NAMESPACE}:customer:delivery`,
  },
  loyaltyRules: {
    loyalty10: `${SEED_NAMESPACE}:loyalty-rule:loyalty-10`,
  },
  cagnotteRules: {
    cagnotte5: `${SEED_NAMESPACE}:cagnotte-rule:cagnotte-5`,
  },
  deliveryPeople: {
    driver1: `${SEED_NAMESPACE}:delivery-person:driver-1`,
  },
  orders: {
    paidRoom: `${SEED_NAMESPACE}:order:paid-room`,
    pendingTable: `${SEED_NAMESPACE}:order:pending-table`,
    paidDelivery: `${SEED_NAMESPACE}:order:paid-delivery`,
  },
  users: {
    owner: `${SEED_NAMESPACE}:user:owner`,
  },
};
