export const STAGE2_BASELINE = {
  expectedAuthUserCount: 6,
  expectedTenantCount: 3,
  expectedRestaurantProfileCount: 3,
  expectedUserAccessCount: 0,
  expectedProvisioningRegistryCount: 0,
  metricsSnapshot: {
    categories: 2,
    products: 5,
    ingredients: 85,
    product_ingredients: 2,
    option_groups: 4,
    option_items: 79,
    customers: 1,
    tables: 3,
    loyalty_rules: 1,
    cagnotte_rules: 1,
    delivery_people: 1,
    orders: 139,
    user_access: 0,
    platform_admin_access: 1,
    provisioning_registry: 0,
  },
  protectedSnapshot: {
    authUsers: [
      { id: '0587a5e1-7e73-48e4-95b8-1c442bead0ee', email: null },
      { id: '883ae704-cb1d-48b2-b5e3-d13435bd02e1', email: null },
      { id: 'a1606598-88fa-4292-8909-bdf30029e71a', email: null },
      { id: 'b20f1604-9707-415a-bcb3-ce47ac2a07b4', email: null },
      { id: 'c99a8545-88d5-4e88-9b7b-09b7cf37408f', email: null },
      { id: 'fa729330-ce52-4bdb-8d51-161596525d2f', email: null },
    ],
    tenants: [
      { id: 'a337547b-bcf3-4623-8f0d-e9433ea8b6cd', slug: 'escale-food' },
      { id: '3dc7f600-03dd-4931-8330-04520abe8cc7', slug: 'lk-systeme' },
      { id: 'e10074ff-7036-40d3-a984-3535fbe5397a', slug: 'test1' },
    ],
    restaurantProfiles: [
      { id: 'a48dfcfe-bdda-4ea5-9f6b-53e47a21e7f6', tenant_id: 'a337547b-bcf3-4623-8f0d-e9433ea8b6cd' },
      { id: '1fa165d5-41f2-4b90-acf8-c8e670cc8322', tenant_id: '3dc7f600-03dd-4931-8330-04520abe8cc7' },
      { id: '712ba904-f6c8-48d4-8e96-361913504c42', tenant_id: 'e10074ff-7036-40d3-a984-3535fbe5397a' },
    ],
    userAccess: [],
  },
};

export const STAGE2_TARGETS = {
  tenantId: '5913d8ef-a36d-42d7-a0d1-d7494f6c5f9e',
  restaurantProfileId: '3e6d0ea7-13b9-4701-8850-e57de656a58f',
  userAccessId: 'f76cf1b6-8f75-4dc6-9f75-f6bfc1b8c5a0',
};
