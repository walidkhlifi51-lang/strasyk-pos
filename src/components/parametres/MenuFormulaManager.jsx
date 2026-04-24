import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, UtensilsCrossed, Loader2 } from "lucide-react";
import { appClient } from "@/api/appClient";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceInput } from '@/components/ui/price-input';
import { useTenant } from "@/components/contexts/TenantContext";

const MenuFormulaForm = ({ menu, products, categories, onSave, onCancel }) => {
  const { withTenant, currentTenant } = useTenant();
  const { toast } = useToast();

  // Debug: vérifier que le tenant est accessible
  console.log('[MenuForm] Tenant actuel:', currentTenant);
  console.log('[MenuForm] withTenant disponible:', typeof withTenant);
  const [formData, setFormData] = useState({
    nom: menu?.nom || "",
    description: menu?.description || "",
    prix: menu?.prix || 0,
    category_id: menu?.category_id || "",
    disponible: menu?.disponible !== false,
    color: menu?.color || "#4CAF50",
    image_url: menu?.image_url || "",
  });
  const [steps, setSteps] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);

  useEffect(() => {
    if (menu) {
      setIsLoadingSteps(true);
      appClient.entities.MenuFormulaItem.filter(withTenant({ menu_formula_id: menu.id }))
        .then(items => {
          const formattedItems = items.map(item => ({
            ...item,
            produits_inclus: item.produits_inclus || [],
            taille_fixe: item.taille_fixe || null
          }));
          setSteps(formattedItems);
          setIsLoadingSteps(false);
        })
        .catch(() => {
          toast({ title: "Erreur", description: "Impossible de charger les étapes du menu.", variant: "destructive" });
          setIsLoadingSteps(false);
        });
    } else {
      setSteps([]);
    }
  }, [menu, toast, withTenant]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };
  
  const handleProductSelection = (stepIndex, productId, isSelected) => {
    const newSteps = [...steps];
    const currentStep = newSteps[stepIndex];
    let newSelection = [...(currentStep.produits_inclus || [])];

    if (isSelected) {
      if (!newSelection.includes(productId)) {
        newSelection.push(productId);
      }
    } else {
      newSelection = newSelection.filter(id => id !== productId);
    }
    
    handleStepChange(stepIndex, 'produits_inclus', newSelection);
  };

  const addStep = () => {
    setSteps([...steps, { nom_affichage: "", category_id: "", quantite: 1, produits_inclus: [], taille_fixe: null }]);
  };

  const removeStep = (index) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const menuData = {
          nom: formData.nom,
          description: formData.description,
          prix: parseFloat(formData.prix),
          category_id: formData.category_id,
          disponible: formData.disponible,
          color: formData.color || "#4CAF50",
          image_url: formData.image_url || ""
      };

      console.log('[MenuForm] Données menu avant withTenant:', menuData);
      const menuDataWithTenant = withTenant(menuData);
      console.log('[MenuForm] Données menu après withTenant:', menuDataWithTenant);

      let savedMenu = menu;
      if (menu) {
        await appClient.entities.MenuFormula.update(menu.id, menuDataWithTenant);
      } else {
        savedMenu = await appClient.entities.MenuFormula.create(menuDataWithTenant);
      }
      
      const existingItems = menu ? await appClient.entities.MenuFormulaItem.filter(withTenant({ menu_formula_id: menu.id })) : [];
      
      for (const item of existingItems) {
        if (!steps.find(s => s.id === item.id)) {
          await appClient.entities.MenuFormulaItem.delete(item.id);
        }
      }
      
      for (const step of steps) {
        const stepData = {
          menu_formula_id: savedMenu.id,
          category_id: step.category_id,
          nom_affichage: step.nom_affichage,
          quantite: parseInt(step.quantite) || 1,
          taille_fixe: step.taille_fixe || null,
          produits_inclus: step.produits_inclus || []
        };
        console.log('[MenuForm] Données étape avant withTenant:', stepData);
        const stepDataWithTenant = withTenant(stepData);
        console.log('[MenuForm] Données étape après withTenant:', stepDataWithTenant);
        
        if (step.id) {
          await appClient.entities.MenuFormulaItem.update(step.id, stepDataWithTenant);
        } else {
          await appClient.entities.MenuFormulaItem.create(stepDataWithTenant);
        }
      }

      toast({ title: "Menu enregistré avec succès." });
      onSave();
    } catch (error) {
      console.error("Erreur enregistrement menu:", error);
      toast({ title: "Erreur", description: `Échec de l'enregistrement: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const productsByCategory = (categoryId) => {
      return products.filter(p => p.category_id === categoryId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="nom">Nom du menu</Label>
              <Input id="nom" value={formData.nom} onChange={e => handleInputChange('nom', e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prix">Prix (€)</Label>
              <PriceInput
                id="prix"
                value={formData.prix}
                onChange={(val) => handleInputChange('prix', val)}
                required
              />
            </div>
          </div>
           <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={formData.description} onChange={e => handleInputChange('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                  <Label htmlFor="category_id">Catégorie du menu</Label>
                  <Select value={formData.category_id} onValueChange={value => handleInputChange('category_id', value)}>
                      <SelectTrigger><SelectValue placeholder="Choisir une catégorie..." /></SelectTrigger>
                      <SelectContent>
                          {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                  <Switch id="disponible" checked={formData.disponible} onCheckedChange={checked => handleInputChange('disponible', checked)} />
                  <Label htmlFor="disponible">Menu disponible</Label>
              </div>
          </div>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
              <CardTitle className="text-lg">Étapes du menu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              {isLoadingSteps ? <Loader2 className="animate-spin" /> : (
                  <div className="space-y-4">
                      {steps.map((step, index) => {
                          const selectedCategory = categories.find(c => c.id === step.category_id);
                          const managesSizes = selectedCategory?.manages_sizes && selectedCategory?.size_template?.length > 0;
                          
                          return (
                              <div key={index} className="p-4 border rounded-lg space-y-3 bg-gray-50">
                                  <div className="flex justify-between items-center">
                                      <h4 className="font-semibold">Étape {index + 1}</h4>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(index)}>
                                          <Trash2 className="w-4 h-4 text-red-500" />
                                      </Button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                          <Label>Nom affiché</Label>
                                          <Input 
                                              value={step.nom_affichage} 
                                              onChange={e => handleStepChange(index, 'nom_affichage', e.target.value)} 
                                              placeholder="Ex: Choisissez votre pizza" 
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <Label>Quantité à choisir</Label>
                                          <Input 
                                              type="number" 
                                              min="1" 
                                              value={step.quantite} 
                                              onChange={e => handleStepChange(index, 'quantite', e.target.value)} 
                                          />
                                      </div>
                                  </div>
                                  <div className="space-y-1">
                                      <Label>Catégorie des produits</Label>
                                      <Select 
                                          value={step.category_id} 
                                          onValueChange={value => {
                                              handleStepChange(index, 'category_id', value);
                                              // Réinitialiser la taille fixe si on change de catégorie
                                              handleStepChange(index, 'taille_fixe', null);
                                          }}
                                      >
                                          <SelectTrigger><SelectValue placeholder="Choisir une catégorie de produits..." /></SelectTrigger>
                                          <SelectContent>
                                              {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>)}
                                          </SelectContent>
                                      </Select>
                                  </div>

                                  {managesSizes && (
                                      <div className="p-3 border rounded-lg bg-blue-50 space-y-2">
                                          <Label className="font-semibold text-blue-900">
                                              🎯 Taille imposée pour cette étape
                                          </Label>
                                          <Select 
                                              value={step.taille_fixe || "libre_choix"} 
                                              onValueChange={value => handleStepChange(index, 'taille_fixe', value === "libre_choix" ? null : value)}
                                          >
                                              <SelectTrigger>
                                                  <SelectValue placeholder="Laisser le client choisir la taille" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                  <SelectItem value="libre_choix">Libre choix (client choisit)</SelectItem>
                                                  {selectedCategory.size_template.map(size => (
                                                      <SelectItem key={size} value={size}>{size}</SelectItem>
                                                  ))}
                                              </SelectContent>
                                          </Select>
                                          <p className="text-xs text-blue-700">
                                              {step.taille_fixe 
                                                  ? `Tous les produits de cette étape seront en taille "${step.taille_fixe}"`
                                                  : "Le client pourra choisir la taille lors de la commande"
                                              }
                                          </p>
                                      </div>
                                  )}

                                  {step.category_id && (
                                     <div className="space-y-2">
                                         <div className="flex items-center justify-between">
                                             <Label>Produits inclus</Label>
                                             <div className="flex gap-2">
                                                 <Button
                                                     type="button"
                                                     variant="outline"
                                                     size="sm"
                                                     className="h-7 text-xs"
                                                     onClick={() => {
                                                         const allProductIds = productsByCategory(step.category_id).map(p => p.id);
                                                         handleStepChange(index, 'produits_inclus', allProductIds);
                                                     }}
                                                 >
                                                     Tout sélectionner
                                                 </Button>
                                                 <Button
                                                     type="button"
                                                     variant="outline"
                                                     size="sm"
                                                     className="h-7 text-xs"
                                                     onClick={() => handleStepChange(index, 'produits_inclus', [])}
                                                 >
                                                     Tout désélectionner
                                                 </Button>
                                             </div>
                                         </div>
                                         <div className="max-h-48 overflow-y-auto p-2 border rounded-md bg-white space-y-2">
                                             {productsByCategory(step.category_id).length > 0 ? productsByCategory(step.category_id).map(product => (
                                                 <div key={product.id} className="flex items-center space-x-2">
                                                     <Checkbox
                                                         id={`prod-${index}-${product.id}`}
                                                         checked={(step.produits_inclus || []).includes(product.id)}
                                                         onCheckedChange={checked => handleProductSelection(index, product.id, checked)}
                                                     />
                                                     <label htmlFor={`prod-${index}-${product.id}`} className="text-sm flex-1">
                                                         {product.nom}
                                                         {managesSizes && product.size_prices?.length > 0 && (
                                                             <span className="text-xs text-gray-500 ml-2">
                                                                 (Tailles disponibles)
                                                             </span>
                                                         )}
                                                     </label>
                                                 </div>
                                             )) : <p className="text-sm text-gray-500">Aucun produit dans cette catégorie.</p>}
                                         </div>
                                     </div>
                                  )}
                              </div>
                          );
                      })}
                  </div>
              )}
              <Button type="button" variant="outline" onClick={addStep}><Plus className="w-4 h-4 mr-2" />Ajouter une étape</Button>
          </CardContent>
      </Card>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Annuler</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement...</> : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  );
};


export default function MenuFormulaManager({ data, onDataChange }) {
  const { products = [], categories = [] } = data || {};
  const { toast } = useToast();
  const { withTenant, filterByTenant } = useTenant();

  const [menus, setMenus] = useState([]);
  const [isLoadingMenus, setIsLoadingMenus] = useState(true);

  useEffect(() => {
    const fetchMenus = async () => {
      setIsLoadingMenus(true);
      const menuList = await appClient.entities.MenuFormula.filter(filterByTenant()).catch(() => []);
      setMenus(menuList);
      setIsLoadingMenus(false);
    };
    fetchMenus();
  }, [filterByTenant]); 

  const [showDialog, setShowDialog] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);

  const handleSaveMenu = async () => {
    setShowDialog(false);
    setEditingMenu(null);
    setIsLoadingMenus(true);
    const menuList = await appClient.entities.MenuFormula.filter(filterByTenant()).catch(() => []);
    setMenus(menuList);
    setIsLoadingMenus(false);
  };

  const handleDeleteMenu = async (menuId) => {
    if (confirm("Supprimer ce menu et toutes ses étapes ?")) {
      try {
        const itemsToDelete = await appClient.entities.MenuFormulaItem.filter(filterByTenant({ menu_formula_id: menuId }));
        for (const item of itemsToDelete) {
          await appClient.entities.MenuFormulaItem.delete(item.id);
        }
        await appClient.entities.MenuFormula.delete(menuId);
        const menuList = await appClient.entities.MenuFormula.filter(filterByTenant()).catch(() => []);
        setMenus(menuList);
        toast({ title: "Menu supprimé." });
      } catch (error) {
        toast({ title: "Erreur", description: "Échec de la suppression.", variant: "destructive" });
      }
    }
  };

  const isLoading = !data || isLoadingMenus;
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-green-500" />
          Gestion des Menus & Formules
        </h3>
        <Button onClick={() => { setEditingMenu(null); setShowDialog(true); }} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Menu
        </Button>
      </div>

      {menus.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {menus.map(menu => (
            <Card key={menu.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span>{menu.nom}</span>
                  <span className="text-lg font-bold text-green-600">{menu.prix?.toFixed(2)}€</span>
                </CardTitle>
                <Badge variant="outline">{categories.find(c => c.id === menu.category_id)?.nom || 'N/A'}</Badge>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-gray-600 line-clamp-2">{menu.description || "Aucune description."}</p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                 <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${menu.disponible ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-xs">{menu.disponible ? 'Disponible' : 'Indisponible'}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setEditingMenu(menu); setShowDialog(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteMenu(menu.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun menu ou formule configuré.</p>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingMenu ? "Modifier le menu" : "Nouveau menu"}</DialogTitle>
              </DialogHeader>
              <MenuFormulaForm
                menu={editingMenu}
                products={products}
                categories={categories}
                onSave={handleSaveMenu}
                onCancel={() => setShowDialog(false)}
              />
          </DialogContent>
      </Dialog>
    </div>
  );
}
