import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star, Loader2 } from "lucide-react";
import CanauxSelector from './CanauxSelector';
import { appClient } from "@/api/appClient";
import { useTenant } from '@/components/contexts/TenantContext';
import { useQuery, useQueryClient } from "@tanstack/react-query";

const ALL_MODES = ['sur_place', 'emporter', 'livraison'];
const MODE_LABELS = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' };

const MultiSelect = ({ label, options, selected, onSelect }) => {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
        {options.map(option => (
          <div key={option.id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`ms-loyalty-${option.id}`}
              checked={selected.includes(option.id)}
              onChange={() => {
                const newSelected = selected.includes(option.id)
                  ? selected.filter(id => id !== option.id)
                  : [...selected, option.id];
                onSelect(newSelected);
              }}
            />
            <label htmlFor={`ms-loyalty-${option.id}`} className="text-sm">{option.nom}</label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function LoyaltyManager() {
  const queryClient = useQueryClient();
  const { filterByTenant, withTenant } = useTenant();
  
  const { data: loyaltyRules = [], isLoading: isLoadingRules, refetch } = useQuery({ // Changed rules to loyaltyRules, isLoading to isLoadingRules
    queryKey: ['loyaltyRules'],
    queryFn: () => appClient.entities.LoyaltyRule.filter(filterByTenant()),
    refetchOnWindowFocus: false, // Added this line to prevent excessive refetches
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products'],
    queryFn: () => appClient.entities.Product.filter(filterByTenant(), null, null, { fields: ['id', 'nom'] })
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false); // Changed showDialog to isDialogOpen
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    nom: "",
    description: "",
    numero_commande: 1,
    active: true,
    canaux: ['caisse'],
    modes_commande: ALL_MODES,
    type_recompense: "percentage_discount",
    valeur_recompense: 0,
    produit_offert_ids: [],
  });

  const resetForm = () => {
    setFormData({
      nom: "",
      description: "",
      numero_commande: 1,
      active: true,
      canaux: ['caisse'],
      modes_commande: ALL_MODES,
      type_recompense: "percentage_discount",
      valeur_recompense: 0,
      produit_offert_ids: [],
    });
    setEditingRule(null);
  };

  const handleAdd = () => {
    resetForm();
    setIsDialogOpen(true); // Changed setShowDialog to setIsDialogOpen
  };

  const handleEdit = (rule) => {
    setFormData({
      nom: rule.nom,
      description: rule.description || "",
      numero_commande: rule.numero_commande,
      active: rule.active !== false,
      canaux: rule.canaux || ['caisse'],
      modes_commande: rule.modes_commande || ALL_MODES,
      type_recompense: rule.type_recompense,
      valeur_recompense: rule.valeur_recompense || 0,
      produit_offert_ids: rule.produit_offert_ids || [],
    });
    setEditingRule(rule);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const dataToSave = { ...formData };
        if (dataToSave.type_recompense !== 'free_product') {
            dataToSave.produit_offert_ids = [];
        }
        if (dataToSave.type_recompense === 'free_product') {
            dataToSave.valeur_recompense = null;
        }

      if (editingRule) {
        await appClient.entities.LoyaltyRule.update(editingRule.id, withTenant(dataToSave));
      } else {
        await appClient.entities.LoyaltyRule.create(withTenant(dataToSave));
      }
      queryClient.invalidateQueries({ queryKey: ['loyaltyRules'] });
      setIsDialogOpen(false); // Changed setShowDialog to setIsDialogOpen
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la règle:", error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette règle de fidélité ?")) {
      try {
        await appClient.entities.LoyaltyRule.delete(id);
        queryClient.invalidateQueries({ queryKey: ['loyaltyRules'] });
      } catch (error) {
        console.error("Erreur lors de la suppression de la règle:", error);
      }
    }
  };
  
  if (isLoadingRules || isLoadingProducts) { // Changed isLoadingRules
    return (
      <Card className="min-h-[200px] flex items-center justify-center">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Loader2 className="w-6 h-6 animate-spin" /> Chargement des règles de fidélité...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
         <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Programme de Fidélité
            </CardTitle>
            <p className="text-sm text-gray-500">Récompensez vos clients fidèles à chaque commande.</p>
        </div>
        <Button onClick={handleAdd} variant="secondary"><Plus className="w-4 h-4 mr-2" />Nouvelle Règle</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loyaltyRules.sort((a,b) => a.numero_commande - b.numero_commande).map(rule => ( // Changed rules to loyaltyRules
            <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">#{rule.numero_commande} Commande: {rule.nom} {rule.active ? '🟢' : '🔴'}</p>
                <p className="text-sm text-gray-600">{rule.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete(rule.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
          {loyaltyRules.length === 0 && <p className="text-center text-gray-500 py-4">Aucune règle de fidélité configurée.</p>} {/* Changed rules to loyaltyRules */}
        </div>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}> {/* Changed showDialog to isDialogOpen and setShowDialog to setIsDialogOpen */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Modifier" : "Créer"} une règle de fidélité</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
             <div className="flex items-center space-x-2">
                <Switch id="active-loyalty" checked={formData.active} onCheckedChange={c => setFormData({...formData, active: c})} />
                <Label htmlFor="active-loyalty">Règle active</Label>
            </div>
            <div className="space-y-2">
                <Label htmlFor="loyalty-name">Nom de la règle (ex: Boisson offerte)</Label>
                <Input id="loyalty-name" placeholder="Offre de bienvenue" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} required />
            </div>
             <div className="space-y-2">
                <Label htmlFor="loyalty-desc">Description (optionnel)</Label>
                <Input id="loyalty-desc" placeholder="Une petite description pour vos collaborateurs" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>

            <div className="p-4 border rounded-lg bg-gray-50">
                <Label htmlFor="loyalty-order-num" className="font-semibold">Condition sur le numéro de commande</Label>
                 <div className="flex items-center gap-2 mt-2 text-sm">
                    <span>S'applique à la</span>
                    <Input 
                        id="loyalty-order-num"
                        type="number" 
                        min="1" 
                        value={formData.numero_commande} 
                        onChange={e => setFormData({...formData, numero_commande: parseInt(e.target.value) || 1})} 
                        className="w-20 text-center"
                    />
                    <span>ème commande du client.</span>
                </div>
            </div>

            <CanauxSelector value={formData.canaux} onChange={v => setFormData({...formData, canaux: v})} />

            <div className="p-3 border rounded-lg bg-purple-50 space-y-2">
                <Label className="font-semibold text-purple-900">Types de commande concernés</Label>
                <div className="flex flex-wrap gap-4">
                    {ALL_MODES.map(mode => (
                        <div key={mode} className="flex items-center space-x-2">
                            <Checkbox
                                id={`loyalty-mode-${mode}`}
                                checked={(formData.modes_commande || ALL_MODES).includes(mode)}
                                onCheckedChange={(checked) => {
                                    const current = formData.modes_commande || ALL_MODES;
                                    const newModes = checked
                                        ? [...current, mode]
                                        : current.filter(m => m !== mode);
                                    setFormData({...formData, modes_commande: newModes.length > 0 ? newModes : [mode]});
                                }}
                            />
                            <label htmlFor={`loyalty-mode-${mode}`} className="text-sm cursor-pointer">{MODE_LABELS[mode]}</label>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <Label>Type de Récompense</Label>
                <Select value={formData.type_recompense} onValueChange={v => setFormData({...formData, type_recompense: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="percentage_discount">Réduction en %</SelectItem>
                        <SelectItem value="fixed_discount">Réduction en €</SelectItem>
                        <SelectItem value="free_product">Produit Offert</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {formData.type_recompense.includes('discount') && (
                <div className="space-y-2">
                    <Label>Valeur de la réduction ({formData.type_recompense === 'percentage_discount' ? '%' : '€'})</Label>
                    <Input type="number" step="0.01" value={formData.valeur_recompense} onChange={e => setFormData({...formData, valeur_recompense: parseFloat(e.target.value) || 0})} />
                </div>
            )}

            {formData.type_recompense === 'free_product' && (
                <MultiSelect label="Produits pouvant être offerts" options={products} selected={formData.produit_offert_ids} onSelect={ids => setFormData({...formData, produit_offert_ids: ids})} />
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button> {/* Changed setShowDialog to setIsDialogOpen */}
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
