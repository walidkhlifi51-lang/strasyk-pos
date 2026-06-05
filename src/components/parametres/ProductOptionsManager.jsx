import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Layers, Eye, Info, Search, X } from "lucide-react";
import { appClient } from "@/api/appClient";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { useTenant } from '../contexts/TenantContext';

const OPTION_IMPORT_INGREDIENT_FIELDS = [
  'id',
  'tenant_id',
  'nom',
  'unite',
  'cout_unitaire',
  'quantite_stock',
  'created_date',
  'updated_date',
];

const GroupPreview = ({ group, items }) => (
  <div className="text-xs text-gray-500 mt-1">
    {items.length > 0 ? (
      <span>({items.map(item => item.nom).join(', ')})</span>
    ) : (
      <span>(Aucune option)</span>
    )}
  </div>
);

const toPriceNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSizeSurcharges = (sizes = [], source = {}, fallback = 0) => {
  return Object.fromEntries(
    sizes
      .filter(size => size && size.trim() !== '')
      .map(size => [size, toPriceNumber(source?.[size] ?? fallback)])
  );
};

const GroupForm = ({ group, onSave, onCancel, withTenant }) => {
  const [name, setName] = useState(group?.nom || "");
  const [selectionType, setSelectionType] = useState(group?.selection_type || "single");
  const [minSelections, setMinSelections] = useState(group?.min_selections?.toString() || "");
  const [maxSelections, setMaxSelections] = useState(group?.max_selections?.toString() || "");
  const [required, setRequired] = useState(group?.required || false);
  const [managesSizes, setManagesSizes] = useState(group?.manages_sizes || false);
  const [sizeTemplate, setSizeTemplate] = useState(group?.size_template || []);

  const handleSave = async () => {
    const data = {
      nom: name,
      selection_type: selectionType,
      min_selections: required ? (minSelections ? parseInt(minSelections) : 1) : null,
      max_selections: selectionType === 'multiple' && maxSelections ? parseInt(maxSelections) : selectionType === 'single' ? 1 : null,
      required: required || !!minSelections,
      manages_sizes: managesSizes,
      size_template: managesSizes ? sizeTemplate.filter(s => s.trim() !== '') : [],
    };
    if (group?.id) {
      await appClient.entities.OptionGroup.update(group.id, withTenant(data));
    } else {
      await appClient.entities.OptionGroup.create(withTenant({ ...data, product_id: null, is_template: true }));
    }
    onSave();
  };

  const handleSizeChange = (index, value) => {
    const newSizes = [...sizeTemplate];
    newSizes[index] = value;
    setSizeTemplate(newSizes);
  };

  const addSize = () => {
    setSizeTemplate([...sizeTemplate, ""]);
  };

  const removeSize = (index) => {
    setSizeTemplate(sizeTemplate.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-100 rounded-md">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="group-name" className="text-xs">Nom du groupe</Label>
          <Input id="group-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Suppléments Pizzas" className="h-8" />
        </div>
        <div className="w-32 space-y-1">
          <Label htmlFor="selection-type" className="text-xs">Type de sélection</Label>
          <Select value={selectionType} onValueChange={setSelectionType}>
            <SelectTrigger id="selection-type" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Choix unique</SelectItem>
              <SelectItem value="multiple">Choix multiple</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {selectionType === 'multiple' && (
          <div className="w-24 space-y-1">
            <Label htmlFor="min-selections" className="text-xs">Min choix</Label>
            <Input
              id="min-selections"
              type="number"
              min="0"
              value={minSelections}
              onChange={e => {
                setMinSelections(e.target.value);
                setRequired(parseInt(e.target.value || "0") > 0);
              }}
              placeholder="Ex: 2"
              className="h-8"
            />
          </div>
        )}
        {selectionType === 'multiple' && (
          <div className="w-24 space-y-1">
            <Label htmlFor="max-selections" className="text-xs">Max choix</Label>
            <Input 
              id="max-selections" 
              type="number" 
              min="1" 
              value={maxSelections} 
              onChange={e => setMaxSelections(e.target.value)} 
              placeholder="Ex: 2"
              className="h-8" 
            />
          </div>
        )}
      </div>

      <div className="p-3 border rounded-lg bg-white space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold">Gestion des tailles</Label>
            <p className="text-xs text-gray-500">Activer pour définir des prix différents par taille (ex: suppléments pizzas)</p>
          </div>
          <Switch
            checked={managesSizes}
            onCheckedChange={(checked) => {
              setManagesSizes(checked);
              if (checked && sizeTemplate.length === 0) {
                setSizeTemplate(['Junior', 'Senior', 'Mega']);
              }
            }}
          />
        </div>

        {managesSizes && (
          <div className="space-y-2 pt-2 border-t mt-3">
            <Label className="font-semibold text-xs">Noms des tailles</Label>
            {sizeTemplate.map((size, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={size}
                  onChange={(e) => handleSizeChange(index, e.target.value)}
                  placeholder={`Taille ${index + 1}`}
                  className="h-8"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSize(index)} className="h-8 w-8">
                  <X className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSize} className="h-8">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une taille
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="group-required"
            checked={required}
            onCheckedChange={(checked) => {
              setRequired(checked);
              if (checked && !minSelections) setMinSelections("1");
              if (!checked) setMinSelections("");
            }}
            size="sm"
          />
          <Label htmlFor="group-required" className="text-xs">
            Obligatoire {selectionType === 'single' ? '(1 choix)' : ''}
          </Label>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} size="sm" className="h-8 bg-green-600 hover:bg-green-700">Enregistrer</Button>
          <Button variant="outline" size="sm" onClick={onCancel} className="h-8">Annuler</Button>
        </div>
      </div>
    </div>
  );
};

const ItemForm = ({ group, item, onSave, onCancel, productCategory, categories, productId, withTenant }) => {
  const categoryData = categories?.find(c => c.id === productCategory);
  const managesSizes = group?.manages_sizes || (categoryData?.manages_sizes && categoryData?.size_template?.length > 0);
  const sizesArray = group?.size_template && group.size_template.length > 0 ? group.size_template : categoryData?.size_template || [];
  
  const [name, setName] = useState(item?.nom || "");
  const [surcharge, setSurcharge] = useState(item?.price_surcharge?.toString() || "0");
  const [sizeSurcharges, setSizeSurcharges] = useState(() => {
    if (managesSizes && item?.size_surcharges) {
      return normalizeSizeSurcharges(sizesArray, item.size_surcharges);
    }
    if (managesSizes && sizesArray.length > 0) {
      return normalizeSizeSurcharges(sizesArray);
    }
    return {};
  });

  const [showIngredientImport, setShowIngredientImport] = useState(false);
  const [allIngredients, setAllIngredients] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [defaultSurcharge, setDefaultSurcharge] = useState("0");
  const [defaultPrices, setDefaultPrices] = useState({});
  const [isImporting, setIsImporting] = useState(false);
  const [ingredientSearchTerm, setIngredientSearchTerm] = useState(""); // NOUVEAU

  useEffect(() => {
    if (!item) {
      appClient.entities.Ingredient.filter(withTenant(), null, null, { fields: OPTION_IMPORT_INGREDIENT_FIELDS })
        .then((ingredients) => {
          setAllIngredients(ingredients);
        })
        .catch(() => setAllIngredients([]));
      
      // Initialiser les prix par défaut à 0 pour chaque taille
      if (managesSizes && sizesArray.length > 0) {
        setDefaultPrices(prev => normalizeSizeSurcharges(sizesArray, prev));
      }
    }
  }, [item, managesSizes, sizesArray.join('|')]);

  // NOUVEAU : Filtrer les ingrédients selon la recherche
  const filteredIngredients = useMemo(() => {
    if (!ingredientSearchTerm.trim()) {
      return allIngredients;
    }
    return allIngredients.filter(ing => 
      ing.nom.toLowerCase().includes(ingredientSearchTerm.toLowerCase())
    );
  }, [allIngredients, ingredientSearchTerm]);

  const handleSizeSurchargeChange = (size, value) => {
    setSizeSurcharges(prev => ({
      ...prev,
      [size]: parseFloat(value) || 0
    }));
  };

  const handleDefaultPriceChange = (size, value) => {
    setDefaultPrices(prev => ({
      ...prev,
      [size]: parseFloat(value) || 0
    }));
  };

  // This function is no longer called by the UI for single imports as of this change.
  // It's kept but inactive in the UI.
  const handleImportIngredient = (ingredient) => {
    setName(ingredient.nom);
    setShowIngredientImport(false);
  };

  const handleSelectAllIngredients = () => {
    setSelectedIngredients(allIngredients.map(ing => ing.id)); // Selects all, not just filtered
  };

  const handleDeselectAllIngredients = () => {
    setSelectedIngredients([]);
  };

  const toggleIngredientSelection = (ingredientId) => {
    setSelectedIngredients(prev => 
      prev.includes(ingredientId) 
        ? prev.filter(id => id !== ingredientId)
        : [...prev, ingredientId]
    );
  };

  const handleImportMultipleIngredients = async () => {
    if (selectedIngredients.length === 0) {
      return;
    }

    setIsImporting(true);
    try {
      const ingredientsToImport = allIngredients.filter(ing => selectedIngredients.includes(ing.id));
      
      for (const ingredient of ingredientsToImport) {
        const data = {
          option_group_id: group.id,
          nom: ingredient.nom,
        };
        
        if (managesSizes) {
          data.size_surcharges = normalizeSizeSurcharges(sizesArray, defaultPrices);
          data.price_surcharge = 0;
        } else {
          data.price_surcharge = toPriceNumber(defaultSurcharge);
          data.size_surcharges = null;
        }
        
        await appClient.entities.OptionItem.create(withTenant(data));
      }
      
      setShowIngredientImport(false);
      setSelectedIngredients([]);
      setIngredientSearchTerm(""); // Reset search term on successful import
      onSave();
    } catch (error) {
      console.error("Erreur import ingrédients:", error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = async () => {
    const data = {
      option_group_id: group.id,
      nom: name,
    };
    
    if (managesSizes) {
      data.size_surcharges = normalizeSizeSurcharges(sizesArray, sizeSurcharges);
      data.price_surcharge = 0;
    } else {
      data.price_surcharge = toPriceNumber(surcharge);
      data.size_surcharges = null;
    }
    
    if (item?.id) {
      await appClient.entities.OptionItem.update(item.id, withTenant(data));
    } else {
      await appClient.entities.OptionItem.create(withTenant(data));
    }
    onSave();
  };

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="item-name" className="text-xs">Nom de l'option</Label>
          {!item && allIngredients.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-blue-600"
              onClick={() => setShowIngredientImport(!showIngredientImport)}
            >
              {showIngredientImport ? "Masquer" : "📦 Importer des ingrédients"}
            </Button>
          )}

        </div>
        
        {showIngredientImport && allIngredients.length > 0 && (
          <div className="p-4 mb-2 border rounded-md bg-white space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Tous les ingrédients disponibles</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleSelectAllIngredients}
                  >
                    Tout sélectionner
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleDeselectAllIngredients}
                  >
                    Tout désélectionner
                  </Button>
                </div>
              </div>

              {/* NOUVELLE BARRE DE RECHERCHE */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher un ingrédient..."
                  value={ingredientSearchTerm}
                  onChange={(e) => setIngredientSearchTerm(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-gray-50 rounded border">
                {filteredIngredients.length > 0 ? (
                  filteredIngredients.map(ing => (
                    <div key={ing.id} className="flex items-center space-x-2 p-1.5 hover:bg-white rounded">
                      <Checkbox
                        id={`ing-${ing.id}`}
                        checked={selectedIngredients.includes(ing.id)}
                        onCheckedChange={() => toggleIngredientSelection(ing.id)}
                      />
                      <label
                        htmlFor={`ing-${ing.id}`}
                        className="text-sm flex-1 cursor-pointer"
                      >
                        {ing.nom}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucun ingrédient trouvé pour "{ingredientSearchTerm}"
                  </p>
                )}
              </div>
              <p className="text-xs text-blue-600 font-medium">
                {selectedIngredients.length} ingrédient(s) sélectionné(s)
                {filteredIngredients.length < allIngredients.length && (
                  <span className="text-gray-500"> • {filteredIngredients.length}/{allIngredients.length} affichés</span>
                )}
              </p>
            </div>

            {managesSizes && sizesArray.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm font-semibold">Prix par défaut par taille</Label>
                <p className="text-xs text-gray-500">
                  Ces prix seront appliqués à tous les ingrédients sélectionnés. Vous pourrez les modifier individuellement après l'import.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {sizesArray.map(size => (
                    <div key={size} className="flex items-center gap-2">
                      <span className="text-sm font-medium w-20">{size}</span>
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={defaultPrices[size] || 0}
                          onChange={e => handleDefaultPriceChange(size, e.target.value)}
                          className="h-8 pr-6"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!managesSizes && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-sm font-semibold">Prix Ã  appliquer aux ingrÃ©dients sÃ©lectionnÃ©s</Label>
                <p className="text-xs text-gray-500">
                  Ce surcoÃ»t sera enregistrÃ© sur chaque ingrÃ©dient importÃ© dans cette option.
                </p>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    step="0.01"
                    value={defaultSurcharge}
                    onChange={e => setDefaultSurcharge(e.target.value)}
                    className="h-8 pr-6"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">â‚¬</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowIngredientImport(false);
                  setSelectedIngredients([]);
                  setIngredientSearchTerm(""); // Réinitialiser la recherche
                }}
              >
                Annuler
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleImportMultipleIngredients}
                disabled={selectedIngredients.length === 0 || isImporting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isImporting ? "Import en cours..." : `Importer ${selectedIngredients.length} ingrédient(s)`}
              </Button>
            </div>
          </div>
        )}
        
        <Input id="item-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Supplément Fromage" className="h-8 bg-white" />
      </div>
      
      {managesSizes && sizesArray.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Prix par taille</Label>
          <div className="grid grid-cols-2 gap-2">
            {sizesArray.map(size => (
              <div key={size} className="flex items-center gap-2">
                <span className="text-xs font-medium w-16">{size}</span>
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={sizeSurcharges[size] || 0}
                    onChange={e => handleSizeSurchargeChange(size, e.target.value)}
                    className="h-8 pr-6 bg-white"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">€</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="item-surcharge" className="text-xs">Surcoût (€)</Label>
          <Input 
            id="item-surcharge" 
            type="number" 
            step="0.01" 
            value={surcharge} 
            onChange={e => setSurcharge(e.target.value)} 
            className="h-8 bg-white" 
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} size="sm" className="h-8 bg-green-600 hover:bg-green-700">OK</Button>
        <Button variant="outline" size="sm" onClick={onCancel} className="h-8 bg-white">X</Button>
      </div>
    </div>
  );
};

const BulkPriceApplier = ({ group, onApply }) => {
  const sizesArray = group?.size_template || [];
  const [surcharge, setSurcharge] = useState("0");
  const [sizeSurcharges, setSizeSurcharges] = useState(() => normalizeSizeSurcharges(sizesArray));
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    setSizeSurcharges(prev => normalizeSizeSurcharges(sizesArray, prev));
  }, [sizesArray.join('|')]);

  const hasItems = (group?.items || []).length > 0;

  const handleApply = async () => {
    if (!hasItems) return;
    setIsApplying(true);
    try {
      await onApply(group, group?.manages_sizes
        ? { managesSizes: true, sizeSurcharges: normalizeSizeSurcharges(sizesArray, sizeSurcharges) }
        : { managesSizes: false, surcharge: toPriceNumber(surcharge) }
      );
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="mt-3 p-3 border border-amber-200 bg-amber-50 rounded-lg space-y-2">
      <div>
        <Label className="text-xs font-semibold text-amber-900">
          Appliquer un prix Ã  tous les ingrÃ©dients de ce groupe
        </Label>
        <p className="text-xs text-amber-700">
          Met Ã  jour toutes les options dÃ©jÃ  crÃ©Ã©es dans ce groupe.
        </p>
      </div>

      {group?.manages_sizes && sizesArray.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {sizesArray.map(size => (
            <div key={size} className="flex items-center gap-2">
              <span className="text-xs font-medium w-16">{size}</span>
              <div className="relative flex-1">
                <Input
                  type="number"
                  step="0.01"
                  value={sizeSurcharges[size] || 0}
                  onChange={e => setSizeSurcharges(prev => ({ ...prev, [size]: toPriceNumber(e.target.value) }))}
                  className="h-8 pr-6 bg-white"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">â‚¬</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative max-w-xs">
          <Input
            type="number"
            step="0.01"
            value={surcharge}
            onChange={e => setSurcharge(e.target.value)}
            className="h-8 pr-6 bg-white"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">â‚¬</span>
        </div>
      )}

      <Button
        type="button"
        size="sm"
        disabled={!hasItems || isApplying}
        onClick={handleApply}
        className="bg-amber-600 hover:bg-amber-700"
      >
        {isApplying ? "Application..." : "Appliquer Ã  toutes les options"}
      </Button>
    </div>
  );
};

const ProductGroupChoiceRulesForm = ({ group, withTenant, onSaved }) => {
  const [selectionType, setSelectionType] = useState(group?.selection_type || "single");
  const [required, setRequired] = useState(!!group?.required);
  const [minSelections, setMinSelections] = useState(group?.min_selections?.toString() || "");
  const [maxSelections, setMaxSelections] = useState(group?.max_selections?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectionType(group?.selection_type || "single");
    setRequired(!!group?.required);
    setMinSelections(group?.min_selections?.toString() || "");
    setMaxSelections(group?.max_selections?.toString() || "");
  }, [group?.id, group?.selection_type, group?.required, group?.min_selections, group?.max_selections]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const min = required ? (parseInt(minSelections || "1", 10) || 1) : (parseInt(minSelections || "0", 10) || null);
      const max = selectionType === "single" ? 1 : (parseInt(maxSelections || "0", 10) || null);

      await appClient.entities.OptionGroup.update(group.id, withTenant({
        selection_type: selectionType,
        required: required || !!min,
        min_selections: min,
        max_selections: max,
      }));
      await onSaved();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-3 p-3 border border-green-200 bg-white rounded-lg space-y-3">
      <div>
        <Label className="text-xs font-semibold text-green-900">
          Nombre de choix pour ce produit
        </Label>
        <p className="text-xs text-green-700">
          Ce rÃ©glage s'applique uniquement Ã  ce produit.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={selectionType}
            onValueChange={(value) => {
              setSelectionType(value);
              if (value === "single") {
                setMaxSelections("1");
                if (required && !minSelections) setMinSelections("1");
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Choix unique</SelectItem>
              <SelectItem value="multiple">Choix multiple</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Min choix</Label>
          <Input
            type="number"
            min="0"
            value={minSelections}
            onChange={(e) => {
              setMinSelections(e.target.value);
              setRequired(parseInt(e.target.value || "0", 10) > 0);
            }}
            placeholder="0"
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Max choix</Label>
          <Input
            type="number"
            min="1"
            value={selectionType === "single" ? "1" : maxSelections}
            onChange={(e) => setMaxSelections(e.target.value)}
            disabled={selectionType === "single"}
            placeholder={selectionType === "single" ? "1" : "Ex: 3"}
            className="h-8"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={required}
              onCheckedChange={(checked) => {
                setRequired(checked);
                if (checked && !minSelections) setMinSelections("1");
                if (!checked) setMinSelections("");
              }}
            />
            <Label className="text-xs">Obligatoire</Label>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 bg-green-600 hover:bg-green-700"
          >
            {isSaving ? "..." : "OK"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function ProductOptionsManager({ productId, withTenant }) {
  const { toast } = useToast();
  const { filterByTenant } = useTenant();

  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [templateGroups, setTemplateGroups] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingProductGroups, setIsLoadingProductGroups] = useState(false);

  const [assignedGroupIds, setAssignedGroupIds] = useState(new Set());
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showTemplates, setShowTemplates] = useState(!productId);
  const [searchTerm, setSearchTerm] = useState("");

  // Charger le produit et les catégories une seule fois au montage
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        if (productId) {
          const prod = await appClient.entities.Product.filter(filterByTenant({ id: productId })).then(p => p[0]);
          setProduct(prod);
        }
        const cats = await appClient.entities.Category.filter(filterByTenant());
        setCategories(cats);
      } catch (error) {
        console.error("Erreur chargement données initiales:", error);
      }
    };
    loadInitialData();
  }, []); // Ne se déclenche qu'une fois

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const templates = await appClient.entities.OptionGroup.filter(filterByTenant({ is_template: true }));
      const templatesWithItems = await Promise.all(
        templates.map(async (group) => {
          const items = await appClient.entities.OptionItem.filter(filterByTenant({ option_group_id: group.id }));
          return { ...group, items };
        })
      );
      setTemplateGroups(templatesWithItems);
    } catch (error) {
      console.error("Erreur chargement templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const loadProductGroups = async () => {
    if (!productId) return;
    setIsLoadingProductGroups(true);
    try {
      const groups = await appClient.entities.OptionGroup.filter(filterByTenant({ product_id: productId }));
      const groupsWithItems = await Promise.all(
        groups.map(async (group) => {
          const items = await appClient.entities.OptionItem.filter(filterByTenant({ option_group_id: group.id }));
          return { ...group, items };
        })
      );
      setProductGroups(groupsWithItems);
    } catch (error) {
      console.error("Erreur chargement groupes produit:", error);
    } finally {
      setIsLoadingProductGroups(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (productId) {
      loadProductGroups();
    }
  }, [productId]);

  useEffect(() => {
    setAssignedGroupIds(new Set(productGroups.map(g => g.template_group_id).filter(Boolean)));
  }, [productGroups]);

  const filteredTemplateGroups = templateGroups.filter(template =>
    template.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.items?.some(item => item.nom?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSaveGroup = async () => {
    setEditingGroup(null);
    await loadTemplates();
    toast({
      title: "Template enregistré",
      description: "Le groupe de templates a été enregistré avec succès.",
    });
  };

  const handleSaveItem = async () => {
    const savedGroup = editingItem?.group || null;
    setEditingItem(null);
    if (savedGroup?.is_template && savedGroup?.id) {
      await syncTemplateItemsToProductCopies(savedGroup.id);
    }
    await loadTemplates();
    if (productId) {
      await loadProductGroups();
    }
    toast({
      title: "Option enregistrée",
      description: "L'option a été enregistrée avec succès.",
    });
  };

  const syncTemplateItemsToProductCopies = async (templateGroupId) => {
    if (!templateGroupId) return;

    const templateItems = await appClient.entities.OptionItem.filter(filterByTenant({ option_group_id: templateGroupId }));
    const productCopies = await appClient.entities.OptionGroup.filter(filterByTenant({ template_group_id: templateGroupId }));

    await Promise.all(
      productCopies.map(async (copy) => {
        const copyItems = await appClient.entities.OptionItem.filter(filterByTenant({ option_group_id: copy.id }));
        const copyItemsByName = new Map((copyItems || []).map(item => [item.nom, item]));

        await Promise.all(
          (templateItems || []).map(async (templateItem) => {
            if (copyItemsByName.has(templateItem.nom)) return;

            await appClient.entities.OptionItem.create(withTenant({
              option_group_id: copy.id,
              nom: templateItem.nom,
              price_surcharge: templateItem.price_surcharge || 0,
              size_surcharges: templateItem.size_surcharges || null,
              is_default: templateItem.is_default || false,
            }));
          })
        );
      })
    );
  };

  const handleAssignGroup = async (templateGroup, assign) => {
    if (!productId) {
      toast({
        title: "Erreur d'assignation",
        description: "Veuillez sélectionner un produit avant d'assigner des options.",
        variant: "destructive",
      });
      return;
    }
    try {
      if (assign) {
        const groupData = {
          product_id: productId,
          nom: templateGroup.nom,
          selection_type: templateGroup.selection_type,
          min_selections: templateGroup.min_selections,
          max_selections: templateGroup.max_selections,
          required: templateGroup.required,
          template_group_id: templateGroup.id,
          is_template: false,
          manages_sizes: templateGroup.manages_sizes,
          size_template: templateGroup.size_template
        };
        
        console.log('[AssignGroup] Création du groupe:', groupData);
        const newGroup = await appClient.entities.OptionGroup.create(withTenant(groupData));
        
        // Copier TOUS les items avec leurs prix
        await Promise.all(
          templateGroup.items.map(item => {
            const itemData = {
              option_group_id: newGroup.id,
              nom: item.nom,
              price_surcharge: item.price_surcharge || 0,
              size_surcharges: item.size_surcharges || null,
              is_default: item.is_default
            };
            
            console.log(`[AssignGroup] Copie de l'item "${item.nom}":`, itemData);
            
            return appClient.entities.OptionItem.create(withTenant(itemData));
          })
        );
        toast({
          title: "Groupe assigné",
          description: `Le groupe "${templateGroup.nom}" a été assigné au produit.`
        });
      } else {
        const groupToDelete = productGroups.find(g => g.template_group_id === templateGroup.id);
        if (groupToDelete) {
          if (groupToDelete.items && groupToDelete.items.length > 0) {
            await Promise.all(groupToDelete.items.map(item => appClient.entities.OptionItem.delete(item.id)));
          }
          await appClient.entities.OptionGroup.delete(groupToDelete.id);
          toast({
            title: "Groupe désassigné",
            description: `Le groupe "${templateGroup.nom}" a été désassigné du produit.`,
          });
        }
      }
      
      await loadProductGroups();
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Échec de l'assignation/désassignation du groupe: ${error.message}`,
        variant: "destructive",
      });
      console.error("Erreur assignation groupe:", error);
    }
  };

  const handleApplyPricesToGroup = async (group, payload) => {
    try {
      const updateData = payload.managesSizes
        ? { price_surcharge: 0, size_surcharges: payload.sizeSurcharges }
        : { price_surcharge: payload.surcharge, size_surcharges: null };

      await Promise.all(
        (group.items || []).map(item => appClient.entities.OptionItem.update(item.id, withTenant(updateData)))
      );

      if (group.is_template) {
        const productCopies = await appClient.entities.OptionGroup.filter(filterByTenant({ template_group_id: group.id }));
        await Promise.all(productCopies.map(async (copy) => {
          const copyItems = await appClient.entities.OptionItem.filter(filterByTenant({ option_group_id: copy.id }));
          const templateItemNames = new Set((group.items || []).map(item => item.nom));
          return Promise.all(
            copyItems
              .filter(item => templateItemNames.has(item.nom))
              .map(item => appClient.entities.OptionItem.update(item.id, withTenant(updateData)))
          );
        }));
      }

      await loadTemplates();
      if (productId) {
        await loadProductGroups();
      }
      toast({
        title: "Prix appliquÃ©s",
        description: "Le prix a Ã©tÃ© enregistrÃ© sur toutes les options du groupe.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Impossible d'appliquer les prix: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette option ?")) {
      try {
        await appClient.entities.OptionItem.delete(itemId);
        await loadTemplates();
        if (productId) {
          await loadProductGroups();
        }
        toast({
          title: "Option supprimée",
          description: "L'option a été supprimée avec succès.",
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: `Échec de la suppression de l'option: ${error.message}`,
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm("Supprimer ce template ? Il sera retiré de tous les produits qui l'utilisent.")) return;
    
    try {
      const template = templateGroups.find(t => t.id === templateId);
      if (template) {
        if (template.items && template.items.length > 0) {
          await Promise.all(template.items.map(item => appClient.entities.OptionItem.delete(item.id)));
        }
        await appClient.entities.OptionGroup.delete(templateId);
        
        const productCopies = await appClient.entities.OptionGroup.filter(filterByTenant({ template_group_id: templateId }));
        await Promise.all(productCopies.map(async (copy) => {
          const copyItems = await appClient.entities.OptionItem.filter(filterByTenant({ option_group_id: copy.id }));
          if (copyItems && copyItems.length > 0) {
            await Promise.all(copyItems.map(item => appClient.entities.OptionItem.delete(item.id)));
          }
          await appClient.entities.OptionGroup.delete(copy.id);
        }));
        
        await loadTemplates();
        if (productId) {
          await loadProductGroups();
        }
        toast({
          title: "Template supprimé",
          description: `Le template "${template.nom}" et toutes ses copies ont été supprimés.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Échec de la suppression du template: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const displayItemPrice = (item, group) => {
    if (group?.manages_sizes && item.size_surcharges) {
      const prices = Object.entries(item.size_surcharges).map(([size, price]) => `${size}: ${price.toFixed(2)}€`);
      return prices.join(', ');
    }
    if (item.price_surcharge !== 0) {
      return `${item.price_surcharge > 0 ? '+' : ''}${item.price_surcharge.toFixed(2)}€`;
    }
    return null;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold flex items-center gap-2 text-md">
          <Layers className="w-4 h-4 text-blue-500" />
          {productId ? "Options de personnalisation" : "Gestion des templates d'options"}
        </h4>
        <div className="flex gap-2">
          {!productId && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher un template..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          )}
          {productId && (
            <Button onClick={() => setShowTemplates(!showTemplates)} size="sm" variant="outline" className="gap-1">
              <Eye className="w-4 h-4" />
              {showTemplates ? 'Masquer' : 'Gérer'} templates
            </Button>
          )}
        </div>
      </div>

      {!productId && (
          <div className="flex items-start p-3 text-sm text-blue-800 bg-blue-100 rounded-lg border border-blue-200">
              <Info className="w-5 h-5 mr-3 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">📚 Workflow pour les suppléments avec tailles :</p>
                <ol className="list-decimal list-inside space-y-1 mt-2">
                  <li>Créez un template de groupe (ex: "Suppléments Pizzas")</li>
                  <li>✅ Activer "Gestion des tailles" et définissez vos tailles (Junior, Senior, Mega...)</li>
                  <li>Ajoutez manuellement vos options ici dans le template</li>
                  <li><strong>Ou mieux :</strong> Allez dans <b>Paramètres → Produits → Modifier un produit → Onglet Options</b></li>
                  <li>🎁 <strong>Là vous verrez le bouton "📦 Importer des ingrédients"</strong> qui récupère les ingrédients du produit !</li>
                </ol>
                <p className="mt-2 font-semibold text-purple-800">💡 L'import d'ingrédients n'est disponible que depuis l'édition d'un produit spécifique !</p>
              </div>
          </div>
      )}

      {showTemplates && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="p-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-medium">
                Groupes d'options réutilisables 
                <span className="ml-2 text-xs text-gray-500">
                  ({filteredTemplateGroups.length} template{filteredTemplateGroups.length > 1 ? 's' : ''})
                </span>
              </CardTitle>
              <Button onClick={() => setEditingGroup({ is_template: true })} size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                Nouveau template
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            {editingGroup && editingGroup.is_template && (
              <GroupForm 
                group={editingGroup} 
                onSave={handleSaveGroup} 
                onCancel={() => setEditingGroup(null)}
                withTenant={withTenant}
              />
            )}
            
            {isLoadingTemplates ? (
              <div className="text-center py-8 text-gray-500">Chargement des templates...</div>
            ) : filteredTemplateGroups.length > 0 ? (
              filteredTemplateGroups.map(template => {
                
                return (
                  <Card key={template.id} className="bg-white shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className="font-medium">{template.nom}</h5>
                            {template.manages_sizes && (
                              <Badge variant="secondary" className="text-xs">
                                🎯 Avec tailles
                              </Badge>
                            )}
                          </div>
                          <GroupPreview group={template} items={template.items} />
                          <div className="text-xs text-gray-500 mt-1">
                            {template.selection_type === 'single' ? 'Choix unique' : 'Choix multiples'} 
                            {template.min_selections && ` (min ${template.min_selections})`}
                            {template.max_selections && ` (max ${template.max_selections})`}
                            {template.required && ' • Requis'}
                            {template.manages_sizes && template.size_template && template.size_template.length > 0 && (
                              <span> • Tailles: {template.size_template.join(', ')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingGroup(template)} className="hover:bg-blue-100">
                            <Pencil className="w-3 h-3"/>
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-100" onClick={() => handleDeleteTemplate(template.id)}>
                            <Trash2 className="w-3 h-3"/>
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-2 space-y-2">
                        {template.items.map(item => (
                          <div key={item.id}>
                            {editingItem?.item?.id === item.id ? (
                              <ItemForm 
                                group={template} 
                                item={item} 
                                onSave={handleSaveItem}
                                onCancel={() => setEditingItem(null)}
                                productCategory={product?.category_id}
                                categories={categories}
                                productId={productId}
                                withTenant={withTenant}
                              />
                            ) : (
                              <div className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded hover:bg-gray-100">
                                <div className="flex-1">
                                  <span>{item.nom}</span>
                                  {displayItemPrice(item, template) && (
                                    <span className="ml-2 text-xs font-medium text-green-600">
                                      {displayItemPrice(item, template)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem({ group: template, item: item })}>
                                    <Pencil className="w-3 h-3 text-gray-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteItem(item.id)}>
                                    <Trash2 className="w-3 h-3 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        <BulkPriceApplier
                          group={template}
                          onApply={handleApplyPricesToGroup}
                        />

                        {editingItem?.group?.id === template.id && !editingItem.item ? (
                          <ItemForm 
                            group={template} 
                            item={null} 
                            onSave={handleSaveItem}
                            onCancel={() => setEditingItem(null)}
                            productCategory={product?.category_id}
                            categories={categories}
                            productId={productId}
                            withTenant={withTenant}
                          />
                        ) : (
                          <Button variant="link" size="sm" className="text-xs p-0 h-auto text-blue-600 mt-2" onClick={() => setEditingItem({ group: template, item: null })}>
                            + Ajouter une option
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>
                  {searchTerm 
                    ? `Aucun template trouvé pour "${searchTerm}"` 
                    : "Aucun template configuré"
                  }
                </p>
                {!searchTerm && (
                  <p className="text-sm">Créez des templates d'options réutilisables</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {productId && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Assigner des groupes d'options à ce produit :</Label>
          {isLoadingProductGroups ? (
            <div className="text-center py-4 text-gray-500 text-sm border-2 border-dashed rounded-lg">
              Chargement des groupes assignés...
            </div>
          ) : templateGroups.length > 0 ? templateGroups.map(template => (
            <div key={template.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id={`assign-${template.id}`}
                checked={assignedGroupIds.has(template.id)}
                onCheckedChange={(checked) => handleAssignGroup(template, checked)}
              />
              <div className="flex-1">
                <label htmlFor={`assign-${template.id}`} className="font-medium cursor-pointer flex items-center gap-2">
                  {template.nom}
                  {template.manages_sizes && (
                    <Badge variant="secondary" className="text-xs">
                      🎯 Avec tailles
                    </Badge>
                  )}
                </label>
                <GroupPreview group={template} items={template.items} />
                <div className="text-xs text-gray-500 mt-1">
                  {template.selection_type === 'single' ? 'Choix unique' : 'Choix multiples'}
                  {template.min_selections && ` (min ${template.min_selections})`}
                  {template.max_selections && ` (max ${template.max_selections})`}
                  {template.required && ' • Requis'}
                  {template.manages_sizes && template.size_template && template.size_template.length > 0 && (
                    <span> • Tailles: {template.size_template.join(', ')}</span>
                  )}
                </div>
              </div>
            </div>
          )) : (
             <div className="text-center py-4 text-gray-500 text-sm border-2 border-dashed rounded-lg">
              <p>Aucun template d'option n'a été trouvé.</p>
              <p>Veuillez d'abord en créer dans l'onglet <b className="text-gray-600">Paramètres &gt; Options</b>.</p>
            </div>
          )}

          <div className="space-y-3 pt-4">
            <Label className="text-sm font-medium">Options configurÃ©es sur ce produit :</Label>
            {productGroups.length > 0 ? (
              productGroups.map(group => (
                <Card key={group.id} className="border-green-200 bg-green-50/40">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium">{group.nom}</h5>
                          {group.manages_sizes && (
                            <Badge variant="secondary" className="text-xs">
                              Avec tailles
                            </Badge>
                          )}
                        </div>
                        <GroupPreview group={group} items={group.items || []} />
                        <div className="text-xs text-gray-500 mt-1">
                          {group.selection_type === 'single' ? 'Choix unique' : 'Choix multiples'}
                          {group.min_selections && ` (min ${group.min_selections})`}
                          {group.max_selections && ` (max ${group.max_selections})`}
                          {group.required && ' - Requis'}
                          {group.manages_sizes && group.size_template?.length > 0 && (
                            <span> - Tailles: {group.size_template.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <ProductGroupChoiceRulesForm
                      group={group}
                      withTenant={withTenant}
                      onSaved={loadProductGroups}
                    />

                    <div className="mt-3 space-y-2">
                      {(group.items || []).map(item => (
                        <div key={item.id}>
                          {editingItem?.item?.id === item.id ? (
                            <ItemForm
                              group={group}
                              item={item}
                              onSave={handleSaveItem}
                              onCancel={() => setEditingItem(null)}
                              productCategory={product?.category_id}
                              categories={categories}
                              productId={productId}
                              withTenant={withTenant}
                            />
                          ) : (
                            <div className="flex justify-between items-center text-sm p-2 bg-white rounded border hover:bg-gray-50">
                              <div className="flex-1">
                                <span>{item.nom}</span>
                                {displayItemPrice(item, group) && (
                                  <span className="ml-2 text-xs font-medium text-green-600">
                                    {displayItemPrice(item, group)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setEditingItem({ group, item })}
                                  title="Modifier les prix de cette option"
                                >
                                  <Pencil className="w-3 h-3 text-gray-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteItem(item.id)}
                                  title="Supprimer cette option"
                                >
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <BulkPriceApplier
                        group={group}
                        onApply={handleApplyPricesToGroup}
                      />

                      {editingItem?.group?.id === group.id && !editingItem.item ? (
                        <ItemForm
                          group={group}
                          item={null}
                          onSave={handleSaveItem}
                          onCancel={() => setEditingItem(null)}
                          productCategory={product?.category_id}
                          categories={categories}
                          productId={productId}
                          withTenant={withTenant}
                        />
                      ) : (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs p-0 h-auto text-green-700 mt-2"
                          onClick={() => setEditingItem({ group, item: null })}
                        >
                          + Ajouter une option Ã  ce produit
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm border-2 border-dashed rounded-lg">
                Aucun groupe d'options n'est encore assignÃ© Ã  ce produit.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

