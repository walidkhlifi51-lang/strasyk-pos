import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from "@/components/ui/use-toast";
import { appClient } from "@/api/appClient";
import { useTenant } from '@/components/contexts/TenantContext';
import { Plus, Pencil, Trash2, Ticket, Loader2 } from "lucide-react";
import CanauxSelector from './CanauxSelector';
import { format } from "date-fns";

const ALL_MODES = ['sur_place', 'emporter', 'livraison'];
const MODE_LABELS = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' };

const PromoCodeForm = ({ code, onSave, onCancel, isSubmitting }) => {
    const [formData, setFormData] = useState({
        code: code?.code || "",
        description: code?.description || "",
        type: code?.type || "percentage",
        value: code?.value || "",
        canaux: code?.canaux || ['caisse'],
        modes_commande: code?.modes_commande || ALL_MODES,
        usage_limit: code?.usage_limit || "",
        expires_at: code?.expires_at ? format(new Date(code.expires_at), 'yyyy-MM-dd') : "",
    });

    useEffect(() => {
        setFormData({
            code: code?.code || "",
            description: code?.description || "",
            type: code?.type || "percentage",
            value: code?.value || "",
            canaux: code?.canaux || ['caisse'],
            modes_commande: code?.modes_commande || ALL_MODES,
            usage_limit: code?.usage_limit || "",
            expires_at: code?.expires_at ? format(new Date(code.expires_at), 'yyyy-MM-dd') : "",
        });
    }, [code]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        const dataToSave = {
            ...formData,
            value: parseFloat(formData.value) || 0,
            usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
            expires_at: formData.expires_at || null,
            modes_commande: formData.modes_commande || ALL_MODES,
        };
        await onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="code">Code (ce que le client tape)</Label>
                <Input id="code" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="description">Description (interne)</Label>
                <Input id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Offre de lancement" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="type">Type de réduction</Label>
                    <Select value={formData.type} onValueChange={value => setFormData({ ...formData, type: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                            <SelectItem value="fixed_amount">Montant fixe (€)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="value">Valeur</Label>
                    <Input id="value" type="number" step="0.01" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} required />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="usage_limit">Limite d'utilisations</Label>
                    <Input id="usage_limit" type="number" value={formData.usage_limit} onChange={e => setFormData({ ...formData, usage_limit: e.target.value })} placeholder="Laisser vide pour illimité" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="expires_at">Date d'expiration</Label>
                    <Input id="expires_at" type="date" value={formData.expires_at} onChange={e => setFormData({ ...formData, expires_at: e.target.value })} />
                </div>
            </div>

            <CanauxSelector value={formData.canaux} onChange={v => setFormData({...formData, canaux: v})} />

            <div className="p-3 border rounded-lg bg-purple-50 space-y-2">
                <Label className="font-semibold text-purple-900">Types de commande concernés</Label>
                <div className="flex flex-wrap gap-4">
                    {ALL_MODES.map(mode => (
                        <div key={mode} className="flex items-center space-x-2">
                            <Checkbox
                                id={`promo-mode-${mode}`}
                                checked={(formData.modes_commande || ALL_MODES).includes(mode)}
                                onCheckedChange={(checked) => {
                                    const current = formData.modes_commande || ALL_MODES;
                                    const newModes = checked
                                        ? [...current, mode]
                                        : current.filter(m => m !== mode);
                                    setFormData({...formData, modes_commande: newModes.length > 0 ? newModes : [mode]});
                                }}
                            />
                            <label htmlFor={`promo-mode-${mode}`} className="text-sm cursor-pointer">{MODE_LABELS[mode]}</label>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
                <Button type="submit" disabled={isSubmitting}>Enregistrer</Button>
            </div>
        </form>
    );
};

export default function PromoCodeManager() {
    const { toast } = useToast();
    const { filterByTenant, withTenant } = useTenant();
    const [promoCodes, setPromoCodes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingCode, setEditingCode] = useState(null);
    const [isSaving, setIsSaving] = useState(false); // New state for dialog submission

    const fetchCodes = async () => {
        setIsLoading(true);
        try {
            const codes = await appClient.entities.PromoCode.filter(filterByTenant());
            setPromoCodes(codes);
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible de charger les codes promo.", variant: "destructive" });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchCodes();
    }, []);

    const handleSave = async (formData) => {
        setIsSaving(true);
        try {
            if (editingCode) {
                await appClient.entities.PromoCode.update(editingCode.id, withTenant(formData));
            } else {
                await appClient.entities.PromoCode.create(withTenant(formData));
            }
            await fetchCodes();
            setShowDialog(false);
            setEditingCode(null);
            toast({ title: "Code promo enregistré." });
        } catch (error) {
            toast({ title: "Erreur", description: "Ce code existe déjà ou est invalide.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (confirm("Supprimer ce code promo ?")) {
            try {
                await appClient.entities.PromoCode.delete(id);
                await fetchCodes();
                toast({ title: "Code promo supprimé." });
            } catch (error) {
                toast({ title: "Erreur", description: "Impossible de supprimer le code promo.", variant: "destructive" });
            }
        }
    };
    
    const toggleActive = async (code) => {
        try {
            await appClient.entities.PromoCode.update(code.id, withTenant({ active: !code.active }));
            await fetchCodes();
            toast({ title: "Statut du code promo mis à jour." });
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible de changer le statut du code promo.", variant: "destructive" });
        }
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => { setEditingCode(null); setShowDialog(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nouveau Code Promo
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {promoCodes.length > 0 ? (
                    promoCodes.map(code => (
                        <Card key={code.id}>
                            <CardHeader>
                                <CardTitle className="flex justify-between items-center">
                                    <span className="flex items-center gap-2 font-mono"><Ticket className="w-5 h-5"/>{code.code}</span>
                                    <Switch checked={code.active} onCheckedChange={() => toggleActive(code)} />
                                </CardTitle>
                                <CardDescription>{code.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="font-semibold text-lg">
                                    {code.type === 'percentage' ? `${code.value}%` : `${code.value.toFixed(2)}€`} de réduction
                                </p>
                                <p>Utilisations: {code.usage_count} / {code.usage_limit || '∞'}</p>
                                {code.expires_at && <p>Expire le: {format(new Date(code.expires_at), 'dd/MM/yyyy')}</p>}
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="outline" size="sm" onClick={() => { setEditingCode(code); setShowDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleDelete(code.id)}><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <p className="col-span-full text-center text-gray-500 py-8">Aucun code promo créé.</p>
                )}
            </div>

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCode ? "Modifier le code promo" : "Nouveau code promo"}</DialogTitle>
                    </DialogHeader>
                    <PromoCodeForm 
                        code={editingCode}
                        onSave={handleSave}
                        onCancel={() => setShowDialog(false)}
                        isSubmitting={isSaving} // Pass the saving state
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
