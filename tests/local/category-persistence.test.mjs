import { saveCategoryAndRefresh } from '../../src/components/parametres/categoryPersistence.js';

const calls = {
  create: 0,
  update: 0,
  onUpdate: 0,
};

const fullPayload = {
  nom: 'E2E_LOCAL_CATEGORY',
  tenant_id: 'tenant-demo',
  parent_id: null,
  color: '#cccccc',
  disponible: true,
  manages_sizes: true,
  size_template: ['Junior', 'Senior', 'Mega'],
  image_url: '',
  image_display: ['caisse', 'borne'],
};

const categoryEntity = {
  async create(payload) {
    calls.create += 1;
    if (JSON.stringify(payload) !== JSON.stringify(fullPayload)) {
      throw new Error(`Unexpected create payload: ${JSON.stringify(payload)}`);
    }
    return { id: 'cat-created', ...payload };
  },
  async update() {
    calls.update += 1;
    return { id: 'cat-updated' };
  },
};

const formData = {
  nom: 'E2E_LOCAL_CATEGORY',
  parent_id: null,
  color: '#cccccc',
  disponible: true,
  manages_sizes: true,
  size_template: ['Junior', 'Senior', 'Mega'],
  image_url: '',
  image_display: ['caisse', 'borne'],
};

let thrownMessage = null;

try {
  await saveCategoryAndRefresh({
    editingCategory: null,
    formData,
    withTenant: (data) => ({ ...data, tenant_id: 'tenant-demo' }),
    buildCategoryPayload: () => fullPayload,
    categoryEntity,
    onUpdate: async () => {
      calls.onUpdate += 1;
      throw new Error('Post-insert refresh failed.');
    },
  });
} catch (error) {
  thrownMessage = error?.message || null;
}

if (thrownMessage !== 'Post-insert refresh failed.') {
  throw new Error(`Expected post-insert failure to be rethrown, got: ${thrownMessage}`);
}

if (calls.create !== 1) {
  throw new Error(`Expected a single create() call, got ${calls.create}`);
}

if (calls.update !== 0) {
  throw new Error(`Expected no update() call, got ${calls.update}`);
}

if (calls.onUpdate !== 1) {
  throw new Error(`Expected onUpdate() to run once, got ${calls.onUpdate}`);
}

console.log(JSON.stringify({
  ok: true,
  singleCreateGuaranteed: true,
  postInsertFailureRethrown: true,
  calls,
}, null, 2));
