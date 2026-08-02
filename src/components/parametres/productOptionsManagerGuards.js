export const requireWithTenant = (withTenant, context = 'ProductOptionsManager') => {
  if (typeof withTenant === 'function') {
    return withTenant;
  }

  throw new Error(`${context} requires a withTenant prop.`);
};
