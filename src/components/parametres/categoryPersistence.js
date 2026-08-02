export const persistCategoryRecord = async ({
  editingCategory,
  fullPayload,
  categoryEntity,
}) => {
  if (editingCategory?.id) {
    return categoryEntity.update(editingCategory.id, fullPayload);
  }

  return categoryEntity.create(fullPayload);
};

export const saveCategoryAndRefresh = async ({
  editingCategory,
  formData,
  withTenant,
  buildCategoryPayload,
  categoryEntity,
  onUpdate,
}) => {
  const dataWithTenant = withTenant(formData);
  const fullPayload = buildCategoryPayload(dataWithTenant, 'full');

  await persistCategoryRecord({
    editingCategory,
    fullPayload,
    categoryEntity,
  });

  await onUpdate();

  return fullPayload;
};
