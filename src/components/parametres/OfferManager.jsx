import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit, Gift, Loader2 } from "lucide-react";
import CanauxSelector from './CanauxSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox import
import { appClient } from "@/api/appClient";
import { useTenant } from '@/components/contexts/TenantContext'; // Added useTenant import
import { useToast } from "@/components/ui/use-toast";

const ALL_MODES = ['sur_place', 'emporter', 'livraison'];
const MODE_LABELS = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' };

const OfferForm = ({ offer, products, categories, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        nom: offer?.nom || '',
        description: offer?.description || '',
        active: offer?.active !== false,
        canaux: offer?.canaux || ['caisse'],
        modes_commande: offer?.modes_commande || ALL_MODES,
        type_condition: offer?.type_condition || 'product',
        condition_ids: offer?.condition_ids || [],
        condition_sizes: offer?.condition_sizes || [],
        quantite_requise: offer?.quantite_requise || 2,
        type_recompense: offer?.type_recompense || 'product',
        recompense_ids: offer?.recompense_ids || [],
        recompense_sizes: offer?.recompense_sizes || [],
        quantite_offerte: offer?.quantite_offerte || 1,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onSave(formData);
        setIsSubmitting(false);
    };

    const handleMultiSelect = (field, value) => {
        // The UI only allows single selection currently, so we wrap it in an array for consistency
        setFormData(prev => ({...prev, [field]: Array.isArray(value) ? value : [value]}));
    };

    // Determine if the selected condition (product/category) manages sizes
    const conditionManagesSizes = () => {
        const selectedId = formData.condition_ids[0];
        if (!selectedId) return false;

        if (formData.type_condition === 'category') {
            const cat = categories.find(c => c.id === selectedId);
            return cat?.manages_sizes && Array.isArray(cat?.size_template) && cat.size_template.length > 0;
        }
        if (formData.type_condition === 'product') {
            const prod = products.find(p => p.id === selectedId);
            if (prod?.category_id) {
                const cat = categories.find(c => c.id === prod.category_id);
                return cat?.manages_sizes && Array.isArray(cat?.size_template) && cat.size_template.length > 0;
            }
        }
        return false;
    };

    // Determine if the selected reward (product/category) manages sizes
    const recompenseManagesSizes = () => {
        const selectedId = formData.recompense_ids[0];
        if (!selectedId) return false;

        if (formData.type_recompense === 'category') {
            const cat = categories.find(c => c.id === selectedId);
            return cat?.manages_sizes && Array.isArray(cat?.size_template) && cat.size_template.length > 0;
        }
        if (formData.type_recompense === 'product') {
            const prod = products.find(p => p.id === selectedId);
            if (prod?.category_id) {
                const cat = categories.find(c => c.id === prod.category_id);
                return cat?.manages_sizes && Array.isArray(cat?.size_template) && cat.size_template.length > 0;
            }
        }
        return false;
    };

    // Get available sizes for the condition
    const getConditionSizes = () => {
        const selectedId = formData.condition_ids[0];
        if (!selectedId) return [];

        if (formData.type_condition === 'category') {
            const cat = categories.find(c => c.id === selectedId);
            return cat?.size_template || [];
        }
        if (formData.type_condition === 'product') {
            const prod = products.find(p => p.id === selectedId);
            if (prod?.category_id) {
                const cat = categories.find(c => c.id === prod.category_id);
                return cat?.size_template || [];
            }
        }
        return [];
    };

    // Get available sizes for the reward
    const getRecompenseSizes = () => {
        const selectedId = formData.recompense_ids[0];
        if (!selectedId) return [];

        if (formData.type_recompense === 'category') {
            const cat = categories.find(c => c.id === selectedId);
            return cat?.size_template || [];
        }
        if (formData.type_recompense === 'product') {
            const prod = products.find(p => p.id === selectedId);
            if (prod?.category_id) {
                const cat = categories.find(c => c.id === prod.category_id);
                return cat?.size_template || [];
            }
        }
        return [];
    };

    const itemsForCondition = formData.type_condition === 'product' ? products : categories;
    const itemsForReward = formData.type_recompense === 'product' ? products : categories;

    const conditionSizes = getConditionSizes();
    const recompenseSizes = getRecompenseSizes();

    return (
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="nom">Nom de l'offre</Label>
                <Input id="nom" value={formData.nom} onChange={e => setFormData({...formData, nom: e.target.value})} placeholder="Ex: 2 pizzas achetées, la 3ème offerte" required/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="description">Description (optionnel)</Label>
                <Input id="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Décrivez l'offre ici"/>
            </div>
            <div className="flex items-center space-x-2">
                <Switch id="active" checked={formData.active} onCheckedChange={c => setFormData({...formData, active: c})}/>
                <Label htmlFor="active">Offre active</Label>
            </div>

            <CanauxSelector value={formData.canaux} onChange={v => setFormData({...formData, canaux: v})} />

            <div className="p-3 border rounded-lg bg-purple-50 space-y-2">
                <Label className="font-semibold text-purple-900">Types de commande concernés</Label>
                <div className="flex flex-wrap gap-4">
                    {ALL_MODES.map(mode => (
                        <div key={mode} className="flex items-center space-x-2">
                            <Checkbox
                                id={`offer-mode-${mode}`}
                                checked={(formData.modes_commande || ALL_MODES).includes(mode)}
                                onCheckedChange={(checked) => {
                                    const current = formData.modes_commande || ALL_MODES;
                                    const newModes = checked
                                        ? [...current, mode]
                                        : current.filter(m => m !== mode);
                                    setFormData({...formData, modes_commande: newModes.length > 0 ? newModes : [mode]});
                                }}
                            />
                            <label htmlFor={`offer-mode-${mode}`} className="text-sm cursor-pointer">{MODE_LABELS[mode]}</label>
                        </div>
                    ))}
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-lg">Condition</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={formData.type_condition} onValueChange={v => setFormData({...formData, type_condition: v, condition_ids: [], condition_sizes: []})}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="product">Produit spécifique</SelectItem>
                                <SelectItem value="category">Toute une catégorie</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input type="number" value={formData.quantite_requise} onChange={e => setFormData({...formData, quantite_requise: parseInt(e.target.value)})} placeholder="Quantité requise" min="1"/>
                    </div>
                    <Select onValueChange={v => handleMultiSelect('condition_ids', v)} value={formData.condition_ids[0] || ''}>
                        <SelectTrigger><SelectValue placeholder="Choisir les produits/catégories"/></SelectTrigger>
                        <SelectContent className="max-h-60">
                            {itemsForCondition.map(item => <SelectItem key={item.id} value={item.id}>{item.nom}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    {conditionManagesSizes() && conditionSizes.length > 0 && (
                        <div className="p-3 border rounded-lg bg-blue-50 space-y-2">
                            <Label className="font-semibold text-blue-900">Tailles concernées (optionnel)</Label>
                            <p className="text-xs text-blue-700">Laissez vide pour toutes les tailles, ou sélectionnez des tailles spécifiques.</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {conditionSizes.map(size => (
                                    <div key={size} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`cond-size-${size}`}
                                            checked={(formData.condition_sizes || []).includes(size)}
                                            onCheckedChange={(checked) => {
                                                const newSizes = checked
                                                    ? [...(formData.condition_sizes || []), size]
                                                    : (formData.condition_sizes || []).filter(s => s !== size);
                                                setFormData({...formData, condition_sizes: newSizes});
                                            }}
                                        />
                                        <label htmlFor={`cond-size-${size}`} className="text-sm cursor-pointer">{size}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">Note: La sélection multiple n'est pas encore supportée par l'interface, veuillez choisir un seul élément.</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-lg">Récompense</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={formData.type_recompense} onValueChange={v => setFormData({...formData, type_recompense: v, recompense_ids: [], recompense_sizes: []})}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="product">Produit spécifique</SelectItem>
                                <SelectItem value="category">Toute une catégorie</SelectItem>
                            </SelectContent>
                        </Select>
                         <Input type="number" value={formData.quantite_offerte} onChange={e => setFormData({...formData, quantite_offerte: parseInt(e.target.value)})} placeholder="Quantité offerte" min="1"/>
                    </div>
                    <Select onValueChange={v => handleMultiSelect('recompense_ids', v)} value={formData.recompense_ids[0] || ''}>
                         <SelectTrigger><SelectValue placeholder="Choisir les produits/catégories"/></SelectTrigger>
                        <SelectContent className="max-h-60">
                            {itemsForReward.map(item => <SelectItem key={item.id} value={item.id}>{item.nom}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    {recompenseManagesSizes() && recompenseSizes.length > 0 && (
                        <div className="p-3 border rounded-lg bg-green-50 space-y-2">
                            <Label className="font-semibold text-green-900">Tailles offertes (optionnel)</Label>
                            <p className="text-xs text-green-700">Laissez vide pour toutes les tailles, ou sélectionnez des tailles spécifiques.</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {recompenseSizes.map(size => (
                                    <div key={size} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`reward-size-${size}`}
                                            checked={(formData.recompense_sizes || []).includes(size)}
                                            onCheckedChange={(checked) => {
                                                const newSizes = checked
                                                    ? [...(formData.recompense_sizes || []), size]
                                                    : (formData.recompense_sizes || []).filter(s => s !== size);
                                                setFormData({...formData, recompense_sizes: newSizes});
                                            }}
                                        />
                                        <label htmlFor={`reward-size-${size}`} className="text-sm cursor-pointer">{size}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Sauvegarde..." : "Sauvegarder"}</Button>
            </div>
        </form>
    )
}


export default function OfferManager({ data, onDataChange }) {
    const { products = [], categories = [] } = data || {};
    const { toast } = useToast();
    const { filterByTenant, withTenant } = useTenant(); // Destructure filterByTenant and withTenant
    const [offers, setOffers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingOffer, setEditingOffer] = useState(null);

    useEffect(() => {
        const fetchOffers = async () => {
            setIsLoading(true);
            const offerList = await appClient.entities.Offer.filter(filterByTenant()).catch(() => []); // Use filterByTenant
            setOffers(offerList);
            setIsLoading(false);
        };
        fetchOffers();
    }, [filterByTenant]); // Add filterByTenant to dependencies

    const handleSaveOffer = async (formData) => {
        // Ensure IDs are always arrays, even if the UI limits to single selection
        const dataToSave = {
            ...formData,
            condition_ids: Array.isArray(formData.condition_ids) ? formData.condition_ids : [formData.condition_ids],
            recompense_ids: Array.isArray(formData.recompense_ids) ? formData.recompense_ids : [formData.recompense_ids],
            // condition_sizes and recompense_sizes are already arrays from state, no special handling needed here
        }
        try {
            if (editingOffer) {
                await appClient.entities.Offer.update(editingOffer.id, withTenant(dataToSave)); // Use withTenant for update
            } else {
                await appClient.entities.Offer.create(withTenant(dataToSave)); // Use withTenant for create
            }
            setShowDialog(false);
            setEditingOffer(null);
            const offerList = await appClient.entities.Offer.filter(filterByTenant()).catch(() => []); // Refetch with filterByTenant
            setOffers(offerList);
            toast({ title: "Offre enregistrée." });
        } catch (error) {
            console.error("Save offer error", error)
            toast({ title: "Erreur d'enregistrement", variant: "destructive" });
        }
    };
    
    const handleDeleteOffer = async (id) => {
        if (!confirm("Supprimer cette offre ?")) return;
        try {
            await appClient.entities.Offer.delete(id);
            const offerList = await appClient.entities.Offer.filter(filterByTenant()).catch(() => []); // Refetch with filterByTenant
            setOffers(offerList);
            toast({ title: "Offre supprimée" });
        } catch (error) {
            toast({ title: "Erreur de suppression", variant: "destructive" });
        }
    };

    if (isLoading || !data) {
        return (
            <div className="flex justify-center items-center p-10">
                <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
            </div>
        );
    }

    return (
        <div className="p-4 bg-white rounded-lg shadow-inner space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-lg">Offres automatiques</h4>
                 <Button onClick={() => { setEditingOffer(null); setShowDialog(true); }}>
                    <Plus className="w-4 h-4 mr-2"/> Nouvelle Offre
                </Button>
            </div>
            
            {offers.length > 0 ? (
                <div className="space-y-3">
                    {offers.map(offer => (
                        <Card key={offer.id}>
                            <CardContent className="p-4 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">{offer.nom}</p>
                                    <p className="text-sm text-muted-foreground">{offer.description || 'Pas de description'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                     <Switch checked={offer.active} disabled/>
                                     <Button variant="ghost" size="sm" onClick={() => {setEditingOffer(offer); setShowDialog(true);}}>
                                        <Edit className="w-4 h-4"/>
                                     </Button>
                                     <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteOffer(offer.id)}>
                                        <Trash2 className="w-4 h-4"/>
                                     </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">
                    <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune offre promotionnelle configurée.</p>
                </div>
            )}

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                 <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingOffer ? "Modifier l'offre" : "Nouvelle offre"}</DialogTitle>
                    </DialogHeader>
                    <OfferForm 
                        offer={editingOffer}
                        products={products}
                        categories={categories}
                        onSave={handleSaveOffer}
                        onCancel={() => setShowDialog(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
