import crypto from 'node:crypto';

const stableNormalize = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = stableNormalize(value[key]);
        return accumulator;
      }, {});
  }

  return value;
};

export const buildChecksumPayload = (operation) => ({
  entityType: operation.entityType,
  tableName: operation.tableName,
  seedKey: operation.seedKey,
  targetIdentifiers: stableNormalize(operation.targetIdentifiers),
  payloadPreview: stableNormalize(operation.payloadPreview),
});

export const computeProvisioningChecksum = (operation) => {
  const payload = buildChecksumPayload(operation);
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
};
