
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { appClient } from "@/api/appClient";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const MenuFormulaForm = ({ menu, products, categories, onSave, onCancel }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    id: menu?.id || null,
    nom: menu?.nom || '',
    description: menu?.description || '',
    prix: menu?.prix || '',
    category_id: menu?.category_id || '',
    disponible: menu?.disponible ?? true,
  });
  const [steps, setSteps] = useState(menu?.steps || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);

  useEffect(() => {
    if (menu) {
      setFormData({
        id: menu.id,
        nom: menu.nom,
        description: menu.description || '',
        prix: menu.prix,
        category_id: menu.category_id || '',
        disponible: menu.disponible,
      });
      setSteps(menu.steps || []);
    } else {
      // Initialize for a new menu if 'menu' prop is not provided or null
      setFormData({
        id: null,
        nom: '',
        description: '',
        prix: '',
        category_id: '',
        disponible: true,
      });
      setSteps([]);
    }
  }, [menu]);


  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStepChange = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const addStep = () => {
    setSteps(prev => [...prev, { nom_affichage: '', quantite: 1, category_id: '', produits_inclus: [] }]);
  };

  const removeStep = (index) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleProductSelection = (stepIndex, productId, isChecked) => {
    const newSteps = [...steps];
    const currentStep = newSteps[stepIndex];
    let updatedProducts = currentStep.produits_inclus ? [...currentStep.produits_inclus] : [];

    if (isChecked) {
      updatedProducts.push(productId);
    } else {
      updatedProducts = updatedProducts.filter(id => id !== productId);
    }
    newSteps[stepIndex].produits_inclus = updatedProducts;
    setSteps(newSteps);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const menuToSave = {
      ...formData,
      prix: parseFloat(formData.prix),
      steps: steps.map(step => ({
        ...step,
        quantite: parseInt(step.quantite),
        produits_inclus: step.produits_inclus || [], // Ensure it's an array
      })),
    };

    try {
      if (formData.id) {
        // Update existing menu
        await appClient.put(`/menu-formulas/${formData.id}`, menuToSave);
        toast({ title: "Succès", description: "Menu mis à jour avec succès." });
      } else {
        // Create new menu
        await appClient.post("/menu-formulas", menuToSave);
        toast({ title: "Succès", description: "Menu créé avec succès." });
      }
      onSave(); // Callback to refresh data or close form
    } catch (error) {
      console.error("Erreur enregistrement menu:", error);
      toast({ title: "Erreur", description: "Échec de l'enregistrement du menu.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const productsByCategory = (categoryId) => {
      return products.filter(p => p.category_id === categoryId);
  }

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
              <Input id="prix" type="number" step="0.01" value={formData.prix} onChange={e => handleInputChange('prix', e.target.value)} required />
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
                      {steps.map((step, index) => (
                          <div key={index} className="p-4 border rounded-lg space-y-3 bg-gray-50">
                              <div className="flex justify-between items-center">
                                <h4 className="font-semibold">Étape {index + 1}</h4>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                      <Label>Nom affiché</Label>
                                      <Input value={step.nom_affichage} onChange={e => handleStepChange(index, 'nom_affichage', e.target.value)} placeholder="Ex: Choisissez votre pizza" />
                                  </div>
                                  <div className="space-y-1">
                                      <Label>Quantité à choisir</Label>
                                      <Input type="number" min="1" value={step.quantite} onChange={e => handleStepChange(index, 'quantite', e.target.value)} />
                                  </div>
                              </div>
                              <div className="space-y-1">
                                  <Label>Catégorie des produits</Label>
                                  <Select value={step.category_id} onValueChange={value => handleStepChange(index, 'category_id', value)}>
                                      <SelectTrigger><SelectValue placeholder="Choisir une catégorie de produits..." /></SelectTrigger>
                                      <SelectContent>
                                          {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                              </div>
                              {step.category_id && (
                                  <div className="space-y-2">
                                      <Label>Produits inclus</Label>
                                      <div className="max-h-48 overflow-y-auto p-2 border rounded-md bg-white space-y-2">
                                          {productsByCategory(step.category_id).length > 0 ? productsByCategory(step.category_id).map(product => (
                                              <div key={product.id} className="flex items-center space-x-2">
                                                  <Checkbox
                                                      id={`prod-${index}-${product.id}`}
                                                      checked={(step.produits_inclus || []).includes(product.id)}
                                                      onCheckedChange={checked => handleProductSelection(index, product.id, checked)}
                                                  />
                                                  <label htmlFor={`prod-${index}-${product.id}`} className="text-sm">{product.nom}</label>
                                              </div>
                                          )) : <p className="text-sm text-gray-500">Aucun produit dans cette catégorie.</p>}
                                      </div>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              )}
              <Button type="button" variant="outline" onClick={addStep}><Plus className="w-4 h-4 mr-2" />Ajouter une étape</Button>
          </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Annuler</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
};

export default MenuFormulaForm;

