import React, { useState, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, List, Search, X, Upload, Loader2, Wand2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { appClient } from "@/api/appClient";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { useTenant } from "../contexts/TenantContext";

const CategoryForm = ({ category, categories, onSave, onCancel, aiImageEnabled }) => {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const [formState, setFormState] = useState(() => {
    if (category) {
      return {
        nom: category.nom,
        parent_id: category.parent_id || "",
        color: category.color || "#cccccc",
        disponible: category.disponible !== false,
        manages_sizes: category.manages_sizes || false,
        size_template: category.size_template || [],
        image_url: category.image_url || "",
        image_display: Array.isArray(category.image_display) ? category.image_display : (category.image_display === 'both' ? ['caisse', 'borne'] : category.image_display === 'caisse' ? ['caisse'] : category.image_display === 'borne' ? ['borne'] : ['caisse', 'borne'])
      };
    }
    return {
      nom: "",
      parent_id: "",
      color: "#cccccc",
      disponible: true,
      manages_sizes: false,
      size_template: [],
      image_url: "",
      image_display: ["caisse", "borne"]
    };
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleSizeTemplateChange = (index, value) => {
    const newTemplate = [...formState.size_template];
    newTemplate[index] = value;
    setFormState({ ...formState, size_template: newTemplate });
  };

  const addSizeToTemplate = () => {
    setFormState({ ...formState, size_template: [...formState.size_template, ""] });
  };

  const removeSizeFromTemplate = (index) => {
    const newTemplate = formState.size_template.filter((_, i) => i !== index);
    setFormState({ ...formState, size_template: newTemplate });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setFormState({ ...formState, image_url: file_url });
    } catch (error) {
      console.error('Erreur upload image:', error);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleGenerateAiImage = async () => {
    setIsGeneratingImage(true);
    try {
      // Étape 1 : Demander à l'IA un prompt photo précis pour cette catégorie
      const llmResponse = await appClient.integrations.Core.InvokeLLM({
        prompt: `Tu es un expert en photographie culinaire professionnelle et en design de menu de restaurant.
Génère un prompt de génération d'image (en anglais) ultra-précis pour illustrer la catégorie de menu restaurant suivante, avec FOND BLANC PUR.

Catégorie : "${formState.nom}"

Le prompt DOIT impérativement :
- Identifier précisément ce que représente cette catégorie (ex: "Pizzas" → une belle pizza entière vue de dessus, "Boissons" → verres et bouteilles variés, "Desserts" → desserts appétissants)
- Décrire une présentation visuelle typique et appétissante
- TOUJOURS terminer par : "isolated on a pure white background, product cutout, no shadows, no table, no scenery, white background only, clean product shot, transparent-ready, PNG style, highly detailed, photorealistic"
- Ne pas inclure de texte ou logo

Réponds UNIQUEMENT avec le prompt en anglais, sans aucune explication.`,
        model: "claude_sonnet_4_6"
      });

      const imagePrompt = typeof llmResponse === 'string' ? llmResponse : llmResponse?.text || llmResponse?.content || '';

      // Étape 2 : Générer l'image
      const result = await appClient.integrations.Core.GenerateImage({ prompt: imagePrompt });
      setFormState(prev => ({ ...prev, image_url: result.url }));
    } catch (error) {
      console.error('Erreur génération IA:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formState,
        parent_id: formState.parent_id || null,
        // Ensure size_template is an array of non-empty strings only if manages_sizes is true
        size_template: formState.manages_sizes
          ? formState.size_template.filter(s => s && s.trim() !== "")
          : []
      };
      await onSave(dataToSave);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="cat-nom">Nom de la catégorie *</Label>
          <Input
            id="cat-nom"
            value={formState.nom}
            onChange={(e) => setFormState({ ...formState, nom: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-color">Couleur</Label>
          <Input
            id="cat-color"
            type="color"
            value={formState.color}
            onChange={(e) => setFormState({ ...formState, color: e.target.value })}
            className="h-10 p-1"
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="cat-disponible"
          checked={formState.disponible}
          onCheckedChange={(checked) => setFormState({ ...formState, disponible: checked })}
        />
        <Label htmlFor="cat-disponible">Disponible</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cat-parent">Catégorie parente (optionnel)</Label>
        <Select value={formState.parent_id} onValueChange={(value) => setFormState({ ...formState, parent_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Aucune" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Aucune (catégorie principale)</SelectItem>
            {categories.filter(c => c.id !== category?.id).map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
          <div className="space-y-1">
            <Label>Image de la catégorie (optionnel)</Label>
            <p className="text-xs text-blue-600 font-medium">📐 Taille recommandée : 400x400 pixels (carré)</p>
            <p className="text-xs text-gray-500">💡 Astuce : L'image doit remplir tout l'espace sans fond blanc autour</p>
          </div>
          {formState.image_url && (
            <div className="relative w-32 h-32">
              <img src={formState.image_url} alt="Catégorie" className="w-full h-full object-cover rounded-lg border" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={() => setFormState({ ...formState, image_url: '' })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div>
            <Input
              id="cat-image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('cat-image-upload').click()}
                disabled={isUploadingImage || isGeneratingImage}
              >
                {isUploadingImage ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Télécharger une image</>
                )}
              </Button>
              {aiImageEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAiImage}
                  disabled={isGeneratingImage || isUploadingImage || !formState.nom}
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  {isGeneratingImage ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération IA...</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-2" />Générer avec IA</>
                  )}
                </Button>
              )}
            </div>
          </div>

          {formState.image_url && (
            <div className="space-y-2 pt-3 border-t">
              <Label>Afficher l'image sur :</Label>
              <div className="flex flex-wrap gap-4">
                {[
                  { value: 'caisse', label: 'Caisse' },
                  { value: 'borne', label: 'Borne' },
                  { value: 'web', label: 'Site web' },
                ].map(opt => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-display-${opt.value}`}
                      checked={(formState.image_display || []).includes(opt.value)}
                      onCheckedChange={(checked) => {
                        const current = formState.image_display || [];
                        const updated = checked
                          ? [...current, opt.value]
                          : current.filter(v => v !== opt.value);
                        setFormState({ ...formState, image_display: updated });
                      }}
                    />
                    <Label htmlFor={`cat-display-${opt.value}`} className="cursor-pointer">{opt.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border rounded-lg space-y-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <Label>Gestion des tailles</Label>
              <p className="text-xs text-gray-500">Activer pour définir des tailles pour cette catégorie (ex: Pizzas).</p>
            </div>
            <Switch
              checked={formState.manages_sizes}
              onCheckedChange={(checked) => setFormState({ ...formState, manages_sizes: checked })}
            />
          </div>

          {formState.manages_sizes && (
            <div className="space-y-3 pt-3 border-t">
              <Label className="font-semibold">Noms des tailles</Label>
              {formState.size_template.map((sizeName, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={sizeName}
                    onChange={(e) => handleSizeTemplateChange(index, e.target.value)}
                    placeholder={`Taille ${index + 1} (ex: Junior)`}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSizeFromTemplate(index)}>
                    <X className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addSizeToTemplate}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une taille
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "..." : "Enregistrer"}</Button>
      </div>
    </form>
  );
};

export default function CategoryManager({ data, onDataChange }) {
  const { toast } = useToast();
  const { withTenant } = useTenant();
  const { categories = [], profile } = data || {};
  const aiImageEnabled = profile?.ai_image_generation_enabled === true;

  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const buildCategoryPayload = (formData, mode = 'full') => {
    const basePayload = {
      nom: formData.nom,
      tenant_id: formData.tenant_id,
      parent_id: formData.parent_id || null,
      color: formData.color || "#cccccc",
      disponible: formData.disponible !== false,
    };

    if (mode === 'basic') {
      return basePayload;
    }

    return {
      ...basePayload,
      manages_sizes: formData.manages_sizes === true,
      size_template: Array.isArray(formData.size_template) ? formData.size_template : [],
      image_url: formData.image_url || "",
      image_display: Array.isArray(formData.image_display) ? formData.image_display : [],
    };
  };

  const onUpdate = async () => {
    await onDataChange();
  };

  const categoryTree = useMemo(() => {
    if (!categories) return [];
    const map = {};
    const roots = [];
    categories.forEach(cat => {
      map[cat.id] = { ...cat, children: [] };
    });
    categories.forEach(cat => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].children.push(map[cat.id]);
      } else {
        roots.push(map[cat.id]);
      }
    });
    const sortCategories = (cats) => {
      return [...cats].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.nom.localeCompare(b.nom)).map(cat => ({
        ...cat,
        children: sortCategories(cat.children)
      }));
    };
    return sortCategories(roots);
  }, [categories]);

  const handleReorder = async (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    const rootCats = categoryTree.filter(c => !c.parent_id);
    const reordered = Array.from(rootCats);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    // Mettre à jour les sort_order en batch
    const updates = reordered.map((cat, index) =>
      appClient.entities.Category.update(cat.id, { sort_order: index })
    );
    await Promise.all(updates);
    await onUpdate();
  };

  const filteredCategoryTree = useMemo(() => {
    if (!searchTerm.trim()) return categoryTree;

    const filterCategories = (categoriesToFilter) => {
      return categoriesToFilter.reduce((acc, category) => {
        const matchesSearch = category.nom.toLowerCase().includes(searchTerm.toLowerCase());
        const filteredChildren = filterCategories(category.children);

        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({ ...category, children: filteredChildren });
        }
        return acc;
      }, []);
    };

    return filterCategories(categoryTree);
  }, [categoryTree, searchTerm]);


  const handleAdd = () => {
    setEditingCategory(null);
    setShowDialog(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setShowDialog(true);
  };

  const handleSave = async (formData) => {
    try {
      const dataWithTenant = withTenant(formData);
      const fullPayload = buildCategoryPayload(dataWithTenant, 'full');

      try {
        if (editingCategory) {
          await appClient.entities.Category.update(editingCategory.id, fullPayload);
        } else {
          await appClient.entities.Category.create(fullPayload);
        }
      } catch (error) {
        const fallbackPayload = buildCategoryPayload(dataWithTenant, 'basic');

        if (editingCategory) {
          await appClient.entities.Category.update(editingCategory.id, fallbackPayload);
        } else {
          await appClient.entities.Category.create(fallbackPayload);
        }
      }

      await onUpdate();
      setShowDialog(false);
      toast({
        title: "Catégorie enregistrée",
        description: `La catégorie "${formData.nom}" a été enregistrée.`,
      });
    } catch (error) {
      console.error("Error saving category:", error);
      toast({
        title: "Erreur",
        description: "Échec de l'enregistrement de la catégorie. " + (error.message || ""),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (categoryId) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette catégorie ? Les sous-catégories deviendront des catégories principales.")) {
      try {
        await appClient.entities.Category.delete(categoryId);
        await onUpdate();
        toast({
          title: "Catégorie supprimée",
          description: "La catégorie a été supprimée avec succès.",
        });
      } catch (error) {
        console.error("Error deleting category:", error);
        toast({
          title: "Erreur",
          description: "Échec de la suppression de la catégorie. Assurez-vous qu'aucun produit ne l'utilise.",
          variant: "destructive",
        });
      }
    }
  };

  const CategoryItem = ({ category, level = 0 }) => (
    <div key={category.id} style={{ marginLeft: `${level * 20}px` }} className="py-2">
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color || '#cccccc' }}></div>
            <span className="font-medium">{category.nom}</span>
            {category.manages_sizes && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Tailles</span>}
            {category.disponible === false && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Indisponible</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(category)}><Pencil className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(category.id)} className="text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
          </div>
        </CardContent>
      </Card>
      {category.children && category.children.length > 0 && (
        <div className="mt-2">
          {category.children.map(child => <CategoryItem key={child.id} category={child} level={level + 1} />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <List className="w-5 h-5 text-purple-500" />
            Gestion des Catégories
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {categories.length} catégories
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Rechercher une catégorie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handleAdd} className="bg-purple-500 hover:bg-purple-600 gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle Catégorie
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        {filteredCategoryTree.length > 0 ? (
          searchTerm ? (
            filteredCategoryTree.map(category => (
              <CategoryItem key={category.id} category={category} />
            ))
          ) : (
            <DragDropContext onDragEnd={handleReorder}>
              <Droppable droppableId="categories">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {categoryTree.map((category, index) => (
                      <Draggable key={category.id} draggableId={category.id} index={index}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps}>
                            <div className={`py-2 ${snapshot.isDragging ? 'opacity-70' : ''}`}>
                              <Card className="hover:shadow-sm transition-shadow">
                                <CardContent className="p-3 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div {...provided.dragHandleProps} className="cursor-grab text-gray-400 hover:text-gray-600">
                                      <GripVertical className="w-4 h-4" />
                                    </div>
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color || '#cccccc' }}></div>
                                    <span className="font-medium">{category.nom}</span>
                                    {category.manages_sizes && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Tailles</span>}
                                    {category.disponible === false && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Indisponible</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(category)}><Pencil className="w-4 h-4" /></Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDelete(category.id)} className="text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                                </CardContent>
                              </Card>
                              {category.children && category.children.length > 0 && (
                                <div className="mt-2">
                                  {category.children.map(child => <CategoryItem key={child.id} category={child} level={1} />)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )
        ) : (
          <div className="text-center py-8 text-gray-500">
            <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>
              {searchTerm
                ? `Aucune catégorie trouvée pour "${searchTerm}"`
                : "Aucune catégorie configurée"
              }
            </p>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={(isOpen) => { if (!isOpen) { setEditingCategory(null); } setShowDialog(isOpen); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            category={editingCategory}
            categories={categories}
            onSave={handleSave}
            onCancel={() => { setShowDialog(false); setEditingCategory(null); }}
            aiImageEnabled={aiImageEnabled}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
