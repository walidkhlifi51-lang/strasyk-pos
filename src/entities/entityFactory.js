import { appClient } from '@/api/appClient';

const defaultSchema = {
  type: 'object',
  additionalProperties: true,
};

export const createEntity = (name, schema = defaultSchema) => ({
  list: (...args) => appClient.entities[name].list(...args),
  filter: (...args) => appClient.entities[name].filter(...args),
  create: (...args) => appClient.entities[name].create(...args),
  bulkCreate: (...args) => appClient.entities[name].bulkCreate(...args),
  update: (...args) => appClient.entities[name].update(...args),
  delete: (...args) => appClient.entities[name].delete(...args),
  subscribe: (...args) => appClient.entities[name].subscribe(...args),
  schema: () => schema,
});

