import { appClient } from '@/api/appClient';

const entityApi = /** @type {any} */ (appClient.entities);

export const catalogService = {
  listProducts(query, sort, limit, options) {
    return entityApi.Product.filter(query, sort, limit, options);
  },
  listCategories(query, sort, limit, options) {
    return entityApi.Category.filter(query, sort, limit, options);
  },
  listOptionGroups(query, sort, limit, options) {
    return entityApi.OptionGroup.filter(query, sort, limit, options);
  },
  listOptionItems(query, sort, limit, options) {
    return entityApi.OptionItem.filter(query, sort, limit, options);
  },
  listIngredients(query, sort, limit, options) {
    return entityApi.Ingredient.filter(query, sort, limit, options);
  },
  listProductIngredients(query, sort, limit, options) {
    return entityApi.ProductIngredient.filter(query, sort, limit, options);
  },
  listMenuFormulas(query, sort, limit, options) {
    return entityApi.MenuFormula.filter(query, sort, limit, options);
  },
  listMenuFormulaItems(query, sort, limit, options) {
    return entityApi.MenuFormulaItem.filter(query, sort, limit, options);
  },
  listOffers(query, sort, limit, options) {
    return entityApi.Offer.filter(query, sort, limit, options);
  },
  listPromoCodes(query, sort, limit, options) {
    return entityApi.PromoCode.filter(query, sort, limit, options);
  },
  listTables(query, sort, limit, options) {
    return entityApi.Table.filter(query, sort, limit, options);
  },
  listCustomerDisplayCarts(query, sort, limit, options) {
    return entityApi.CustomerDisplayCart.filter(query, sort, limit, options);
  },
  updateCustomerDisplayCart(id, payload) {
    return entityApi.CustomerDisplayCart.update(id, payload);
  },
  createCustomerDisplayCart(payload) {
    return entityApi.CustomerDisplayCart.create(payload);
  },
  listClotureCaisse(query, sort, limit, options) {
    return entityApi.ClotureCaisse.filter(query, sort, limit, options);
  },
};
