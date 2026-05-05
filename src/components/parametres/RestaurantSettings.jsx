import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Loader2, Upload, X, CheckCircle2 } from "lucide-react";
import { PriceInput } from '@/components/ui/price-input';
import { useTenant } from '../contexts/TenantContext';
import KioskQRCode from './KioskQRCode';
import DeliveryAppQRCode from './DeliveryAppQRCode';

const RESTAURANT_PROFILE_SCHEMA_FIELDS = new Set([
    'tenant_id',
    'nom_etablissement',
    'adresse',
    'ville',
    'telephone',
    'logo_url',
    'siret',
    'tva_intracommunautaire',
    'frais_livraison',
    'montant_minimum_livraison',
    'zone_livraison_km',
    'impression_auto',
    'impression_bouton_visible',
    'impression_double',
    'page_pins',
    'tva_rates',
    'manages_deliveries',
    'manages_table_plan',
    'table_plan_allowed',
    'bipeur_enabled',
    'manages_kiosk',
    'kiosk_welcome_message',
    'kiosk_welcome_images',
    'kiosk_terminal_welcome_images',
    'kiosk_welcome_title_size',
    'kiosk_welcome_title_style',
    'kiosk_primary_color',
    'kiosk_secondary_color',
    'kiosk_card_payment_enabled',
    'manages_delivery_app',
    'delivery_app_allowed',
    'manages_web_ordering',
    'customer_display_enabled',
    'web_ordering_closed',
    'web_frais_livraison_enabled',
    'web_frais_livraison',
    'site_template',
    'site_primary_color',
    'scratch_tickets_enabled',
    'ai_image_generation_enabled',
    'force_immediate_payment',
    'prix_differencies_par_mode',
    'allow_price_edit',
    'allow_item_edit',
]);

const normalizeKioskWelcomeImages = (images = []) => (
    Array.isArray(images)
        ? images.map((item) => {
            if (typeof item === 'string') {
                return { image_url: item, title: '' };
            }

            return {
                image_url: item?.image_url || item?.url || '',
                title: item?.title || '',
            };
        }).filter((item) => item.image_url)
        : []
);

export default function RestaurantSettings({ data, onDataChange }) {
    const { profile } = data || {};
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { currentTenant } = useTenant();

    const [localProfile, setLocalProfile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [saveSucceeded, setSaveSucceeded] = useState(false);
    const scratchTicketsAvailable = (localProfile?.manages_kiosk === true) || (localProfile?.manages_web_ordering === true);
    const kioskExitCode = localProfile?.page_pins?.KioskTerminalExit || '2580';
    const mobileKioskUrl = `${window.location.origin}/Kiosk?tenant=${currentTenant?.id}&display=mobile`;
    const terminalKioskUrl = `${window.location.origin}/KioskTerminal?tenant=${currentTenant?.id}`;
    const terminalKioskProtectedUrl = `${window.location.origin}/KioskTerminal?tenant=${currentTenant?.id}&exitCode=${kioskExitCode}`;

    const copyToClipboard = async (value, label) => {
        try {
            await navigator.clipboard.writeText(value);
            toast({
                title: 'Lien copie',
                description: `${label} a ete copie dans le presse-papiers.`,
            });
        } catch (error) {
            toast({
                title: 'Copie impossible',
                description: `Impossible de copier ${label.toLowerCase()}.`,
                variant: 'destructive',
            });
        }
    };

    useEffect(() => {
        if (profile) {
            setLocalProfile({
                ...profile,
                kiosk_welcome_images: normalizeKioskWelcomeImages(profile.kiosk_welcome_images),
                kiosk_terminal_welcome_images: normalizeKioskWelcomeImages(profile.kiosk_terminal_welcome_images || profile.kiosk_welcome_images),
            });
        } else {
            setLocalProfile({
                nom_etablissement: '',
                adresse: '',
                telephone: '',
                siret: '',
                tva_intracommunautaire: '',
                frais_livraison: 2.5,
                montant_minimum_livraison: 15,
                zone_livraison_km: 5,
                manages_deliveries: true,
                manages_table_plan: false,
                bipeur_enabled: false,
                delivery_app_allowed: false,
                manages_delivery_app: false,
                force_immediate_payment: false,
                prix_differencies_par_mode: false,
                logo_url: '',
                kiosk_welcome_images: [],
                kiosk_terminal_welcome_images: [],
                kiosk_welcome_title_size: 'large',
                kiosk_welcome_title_style: 'bold',
                tva_rates: [
                    { rate: 20, label: "Taux Normal" },
                    { rate: 10, label: "Taux Intermédiaire" },
                    { rate: 5.5, label: "Taux Réduit" }
                ],
            });
        }
    }, [profile]);

    const mutation = useMutation({
        mutationFn: (profilePayload) => {
            if (localProfile && localProfile.id) {
                return appClient.entities.RestaurantProfile.update(localProfile.id, profilePayload);
            } else {
                return appClient.entities.RestaurantProfile.create(profilePayload);
            }
        },
        onSuccess: (updatedProfile) => {
            if (updatedProfile) {
                setLocalProfile((prev) => ({ ...(prev || {}), ...updatedProfile }));
            }
            setSaveSucceeded(true);
            window.setTimeout(() => setSaveSucceeded(false), 2500);
            queryClient.invalidateQueries({ queryKey: ['restaurantProfile'] });
            queryClient.invalidateQueries({ queryKey: ['managementData'] });
            queryClient.invalidateQueries({ queryKey: ['tenantAccess'] });
            queryClient.invalidateQueries({ queryKey: ['posData'] });
            onDataChange?.();
            toast({
                title: "Succès",
                description: "Les paramètres du restaurant ont été mis à jour.",
            });
        },
        onError: (error) => {
            toast({
                title: "Erreur",
                description: `Une erreur est survenue: ${error.message}`,
                variant: "destructive",
            });
        }
    });
    const isSaving = mutation.isPending === true;

    const handleSave = async () => {
        if (!currentTenant?.id) {
            toast({
                title: "Commerce introuvable",
                description: "Impossible de sauvegarder sans commerce selectionne.",
                variant: "destructive",
            });
            return;
        }

        if (!localProfile.nom_etablissement || !localProfile.adresse || !localProfile.telephone) {
            toast({
                title: "Champs requis manquants",
                description: "Veuillez renseigner au moins le nom, l'adresse et le téléphone de l'établissement.",
                variant: "destructive",
            });
            return;
        }
        
        try {
            const { id, created_date, updated_date, created_by, ...rawPayload } = localProfile;
            const payload = Object.fromEntries(
                Object.entries(rawPayload).filter(([key]) => RESTAURANT_PROFILE_SCHEMA_FIELDS.has(key))
            );
            
            payload.tenant_id = currentTenant.id;
            payload.frais_livraison = parseFloat(payload.frais_livraison) || 0;
            payload.montant_minimum_livraison = parseFloat(payload.montant_minimum_livraison) || 0;
            payload.zone_livraison_km = parseFloat(payload.zone_livraison_km) || 0;
            
            if (payload.tva_rates && Array.isArray(payload.tva_rates)) {
                payload.tva_rates = payload.tva_rates.map(rate => ({
                    rate: parseFloat(rate.rate) || 0,
                    label: rate.label || `Taux ${rate.rate}%`
                }));
            }

            if (!scratchTicketsAvailable) {
                payload.scratch_tickets_enabled = false;
            }
            
            await mutation.mutateAsync(payload);
        } catch (error) {
            console.error("Erreur preparation sauvegarde parametres:", error);
            toast({
                title: "Erreur",
                description: error?.message || "La sauvegarde n'a pas pu etre effectuee.",
                variant: "destructive",
            });
        }
    };
    
    const handleLogoUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { file_url } = await appClient.integrations.Core.UploadFile({ file });
            handleFieldChange('logo_url', file_url);
            toast({
                title: "Logo téléchargé",
                description: "Le logo a été chargé. Cliquez sur 'Enregistrer' pour le sauvegarder.",
            });
        } catch (error) {
            console.error("Erreur de téléchargement du logo:", error);
            toast({
                title: "Erreur",
                description: "Échec du téléchargement du logo.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleFieldChange = (field, value) => {
        setLocalProfile(prev => ({ ...prev, [field]: value }));
    };
    
    const handleTvaRateChange = (index, rate) => {
        const newRates = [...(localProfile.tva_rates || [])];
        newRates[index] = { ...newRates[index], rate: parseFloat(rate) || 0 };
        handleFieldChange('tva_rates', newRates);
    };

    const addTvaRate = () => {
        const newRates = [...(localProfile.tva_rates || []), { rate: 0, label: 'Nouveau Taux' }];
        handleFieldChange('tva_rates', newRates);
    };

    const removeTvaRate = (index) => {
        const newRates = [...(localProfile.tva_rates || [])];
        newRates.splice(index, 1);
        handleFieldChange('tva_rates', newRates);
    };

    if (!localProfile) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Chargement des paramètres...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Informations Générales</CardTitle>
                    <CardDescription>Mettez à jour les informations de votre établissement. Le nom, l'adresse et le téléphone sont requis.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nom_etablissement">Nom de l'établissement *</Label>
                            <Input id="nom_etablissement" value={localProfile.nom_etablissement || ''} onChange={(e) => handleFieldChange('nom_etablissement', e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="telephone">Téléphone *</Label>
                            <Input id="telephone" value={localProfile.telephone || ''} onChange={(e) => handleFieldChange('telephone', e.target.value)} required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="adresse">Adresse *</Label>
                        <Input id="adresse" value={localProfile.adresse || ''} onChange={(e) => handleFieldChange('adresse', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ville">Ville</Label>
                        <Input id="ville" value={localProfile.ville || ''} onChange={(e) => handleFieldChange('ville', e.target.value)} placeholder="Ex: Paris" />
                    </div>

                    <div className="space-y-2 pt-4">
                        <Label>Logo de l'établissement</Label>
                        <div className="flex items-center gap-4">
                            {localProfile.logo_url && (
                                <img src={localProfile.logo_url} alt="Logo" className="w-20 h-20 rounded-md object-cover border" />
                            )}
                            <div className="flex-1">
                                <Input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                <Button asChild variant="outline">
                                    <label htmlFor="logo-upload" className="cursor-pointer flex items-center gap-2">
                                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        <span>{isUploading ? "Chargement..." : "Changer le logo"}</span>
                                    </label>
                                </Button>
                                <p className="text-xs text-gray-500 mt-2">Le logo apparaîtra sur vos tickets de caisse.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="siret">SIRET</Label>
                            <Input id="siret" value={localProfile.siret || ''} onChange={(e) => handleFieldChange('siret', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tva_intracommunautaire">TVA Intracommunautaire</Label>
                            <Input id="tva_intracommunautaire" value={localProfile.tva_intracommunautaire || ''} onChange={(e) => handleFieldChange('tva_intracommunautaire', e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Paramètres de Livraison</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex items-center space-x-2">
                        <Switch id="manages_deliveries" checked={localProfile.manages_deliveries} onCheckedChange={(checked) => handleFieldChange('manages_deliveries', checked)} />
                        <label htmlFor="manages_deliveries">Activer la gestion des livraisons</label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="frais_livraison">Frais de livraison (€)</Label>
                            <PriceInput
                                id="frais_livraison"
                                value={localProfile.frais_livraison || 0}
                                onChange={(val) => handleFieldChange('frais_livraison', val)}
                                disabled={!localProfile.manages_deliveries}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="montant_minimum_livraison">Montant minimum (€)</Label>
                            <PriceInput
                                id="montant_minimum_livraison"
                                value={localProfile.montant_minimum_livraison || 0}
                                onChange={(val) => handleFieldChange('montant_minimum_livraison', val)}
                                disabled={!localProfile.manages_deliveries}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="zone_livraison_km">Zone de livraison (km)</Label>
                            <PriceInput
                                id="zone_livraison_km"
                                value={localProfile.zone_livraison_km || 0}
                                onChange={(val) => handleFieldChange('zone_livraison_km', val)}
                                disabled={!localProfile.manages_deliveries}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Plan de tables</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!localProfile.table_plan_allowed ? (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            ⛔ Ce module est désactivé par votre administrateur. Contactez-le pour l'activer.
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="manages_table_plan"
                                checked={localProfile.manages_table_plan || false}
                                onCheckedChange={(checked) => handleFieldChange('manages_table_plan', checked)}
                            />
                            <label htmlFor="manages_table_plan">Activer le plan de tables</label>
                        </div>
                    )}
                </CardContent>
            </Card>
            

            <Card>
                <CardHeader>
                    <CardTitle>Borne de Commande</CardTitle>
                    <CardDescription>Configuration de la borne - L'activation/désactivation est gérée par l'administrateur</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     {!localProfile.manages_kiosk && (
                        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 mb-4">
                            <p className="text-sm font-semibold text-orange-900 mb-1">🚫 Borne désactivée</p>
                            <p className="text-sm text-orange-700">
                                La borne a été désactivée par l'administrateur. Contactez le support pour la réactiver.
                            </p>
                        </div>
                    )}
                    
                    {localProfile.manages_kiosk && (
                        <>
                            <div className="mt-4 space-y-4">
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-blue-900">URL borne telephone</p>
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(mobileKioskUrl, 'URL borne telephone')}>
                                            Copier
                                        </Button>
                                    </div>
                                    <code className="block overflow-x-auto rounded border bg-white px-3 py-2 text-xs">
                                        {mobileKioskUrl}
                                    </code>
                                    <p className="mt-2 text-xs text-blue-700">
                                        Conservez ce lien pour le QR code et l usage smartphone.
                                    </p>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-slate-900">URL grande borne</p>
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(terminalKioskUrl, 'URL grande borne')}>
                                            Copier
                                        </Button>
                                    </div>
                                    <code className="block overflow-x-auto rounded border bg-white px-3 py-2 text-xs">
                                        {terminalKioskUrl}
                                    </code>
                                    <p className="mt-2 text-xs text-slate-700">
                                        Ouvrez ce lien sur votre vraie borne 22 pouces ou votre ecran tactile.
                                    </p>
                                </div>

                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                    <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-amber-900">URL grande borne avec code sortie</p>
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(terminalKioskProtectedUrl, 'URL grande borne avec code sortie')}>
                                            Copier
                                        </Button>
                                    </div>
                                    <code className="block overflow-x-auto rounded border bg-white px-3 py-2 text-xs">
                                        {terminalKioskProtectedUrl}
                                    </code>
                                    <p className="mt-2 text-xs text-amber-800">
                                        Cette version utilise le code de sortie configure dans `Securite` : `{kioskExitCode}`.
                                    </p>
                                </div>
                            </div>

                            <KioskQRCode url={mobileKioskUrl} profile={localProfile} />
                            
                            <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-semibold text-sm">Personnalisation de la borne</h4>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="kiosk_welcome_message">Message de bienvenue</Label>
                                    <Input 
                                        id="kiosk_welcome_message" 
                                        value={localProfile.kiosk_welcome_message || ''} 
                                        onChange={(e) => handleFieldChange('kiosk_welcome_message', e.target.value)}
                                        placeholder="Ex: Bienvenue chez nous ! Commandez en toute simplicité"
                                    />
                                    <p className="text-xs text-gray-500">Affiché sur la page d'accueil de la borne</p>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label>Images d'accueil de la vraie borne (grand ecran)</Label>
                                    
                                    {(localProfile.kiosk_terminal_welcome_images || []).length > 0 && (
                                        <div className="space-y-3 mb-3">
                                            {localProfile.kiosk_terminal_welcome_images.map((imageItem, idx) => (
                                                <div key={idx} className="grid grid-cols-[120px_1fr_auto] gap-3 items-start rounded-lg border p-3 bg-white">
                                                    <img src={imageItem.image_url} alt={`Image ${idx + 1}`} className="w-full h-24 rounded-md object-cover border" />
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`kiosk-image-title-${idx}`}>Titre de l'image</Label>
                                                        <Input
                                                            id={`kiosk-image-title-${idx}`}
                                                            value={imageItem.title || ''}
                                                            onChange={(e) => {
                                                                const newImages = [...(localProfile.kiosk_terminal_welcome_images || [])];
                                                                newImages[idx] = { ...newImages[idx], title: e.target.value };
                                                                handleFieldChange('kiosk_terminal_welcome_images', newImages);
                                                            }}
                                                            placeholder={`Ex: Burger maison ${idx + 1}`}
                                                        />
                                                        <p className="text-xs text-gray-500">Ce titre s affichera au-dessus de la photo sur la vraie borne uniquement.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const newImages = [...(localProfile.kiosk_terminal_welcome_images || [])];
                                                            newImages.splice(idx, 1);
                                                            handleFieldChange('kiosk_terminal_welcome_images', newImages);
                                                        }}
                                                        className="bg-red-500 text-white rounded-full p-2"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <div className="flex-1">
                                        <Input 
                                            id="kiosk-images-upload" 
                                            type="file" 
                                            accept="image/*"
                                            multiple
                                            onChange={async (e) => {
                                                const files = Array.from(e.target.files);
                                                if (files.length === 0) return;
                                                setIsUploading(true);
                                                try {
                                                    const uploadPromises = files.map(file => 
                                                        appClient.integrations.Core.UploadFile({ file })
                                                    );
                                                    const results = await Promise.all(uploadPromises);
                                                    const newImages = results.map((r, index) => ({
                                                        image_url: r.file_url,
                                                        title: files[index]?.name?.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ') || '',
                                                    }));
                                                    const currentImages = localProfile.kiosk_terminal_welcome_images || [];
                                                    handleFieldChange('kiosk_terminal_welcome_images', [...currentImages, ...newImages]);
                                                    toast({
                                                        title: "Images téléchargées",
                                                        description: `${files.length} image(s) ajoutée(s). Cliquez sur 'Enregistrer' pour sauvegarder.`,
                                                    });
                                                } catch (error) {
                                                    toast({
                                                        title: "Erreur",
                                                        description: "Échec du téléchargement des images.",
                                                        variant: "destructive",
                                                    });
                                                } finally {
                                                    setIsUploading(false);
                                                }
                                            }}
                                            className="hidden" 
                                        />
                                        <Button asChild variant="outline" size="sm">
                                            <label htmlFor="kiosk-images-upload" className="cursor-pointer flex items-center gap-2">
                                                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                <span>{isUploading ? "Chargement..." : "Ajouter des images"}</span>
                                            </label>
                                        </Button>
                                        <p className="text-xs text-gray-500 mt-2">Les images défileront automatiquement sur l'écran d'accueil</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="kiosk_welcome_title_size">Taille du titre des photos</Label>
                                        <select
                                            id="kiosk_welcome_title_size"
                                            value={localProfile.kiosk_welcome_title_size || 'large'}
                                            onChange={(e) => handleFieldChange('kiosk_welcome_title_size', e.target.value)}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="medium">Moyenne</option>
                                            <option value="large">Grande</option>
                                            <option value="xlarge">Tres grande</option>
                                            <option value="hero">Geante</option>
                                        </select>
                                        <p className="text-xs text-gray-500">Pour ajuster le titre selon le commerce et la taille de la borne.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="kiosk_welcome_title_style">Style d'ecriture du titre</Label>
                                        <select
                                            id="kiosk_welcome_title_style"
                                            value={localProfile.kiosk_welcome_title_style || 'bold'}
                                            onChange={(e) => handleFieldChange('kiosk_welcome_title_style', e.target.value)}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="bold">Classique gras</option>
                                            <option value="italic">Italique elegant</option>
                                            <option value="serif">Serif raffine</option>
                                            <option value="caps">Majuscules espacees</option>
                                        </select>
                                        <p className="text-xs text-gray-500">Le style choisi s applique au titre affiche au-dessus des photos sur la vraie borne.</p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="kiosk_primary_color">Couleur principale</Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                id="kiosk_primary_color" 
                                                type="color"
                                                value={localProfile.kiosk_primary_color || '#f97316'} 
                                                onChange={(e) => handleFieldChange('kiosk_primary_color', e.target.value)}
                                                className="w-20 h-10 p-1"
                                            />
                                            <Input 
                                                type="text"
                                                value={localProfile.kiosk_primary_color || '#f97316'} 
                                                onChange={(e) => handleFieldChange('kiosk_primary_color', e.target.value)}
                                                className="flex-1"
                                                placeholder="#f97316"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor="kiosk_secondary_color">Couleur secondaire</Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                id="kiosk_secondary_color" 
                                                type="color"
                                                value={localProfile.kiosk_secondary_color || '#ef4444'} 
                                                onChange={(e) => handleFieldChange('kiosk_secondary_color', e.target.value)}
                                                className="w-20 h-10 p-1"
                                            />
                                            <Input 
                                                type="text"
                                                value={localProfile.kiosk_secondary_color || '#ef4444'} 
                                                onChange={(e) => handleFieldChange('kiosk_secondary_color', e.target.value)}
                                                className="flex-1"
                                                placeholder="#ef4444"
                                            />
                                        </div>
                                        </div>
                                        </div>

                                        <div className="flex items-center space-x-2 pt-4 border-t">
                                        <Switch 
                                        id="kiosk_card_payment_enabled" 
                                        checked={localProfile.kiosk_card_payment_enabled || false} 
                                        onCheckedChange={(checked) => handleFieldChange('kiosk_card_payment_enabled', checked)} 
                                        />
                                        <div>
                                        <label htmlFor="kiosk_card_payment_enabled" className="font-medium cursor-pointer">Activer le paiement par carte sur la borne</label>
                                        <p className="text-sm text-gray-500">Permet aux clients de payer directement par carte bancaire (nécessite un terminal de paiement)</p>
                                        </div>
                                        </div>
                                        </div>
                                        </>
                                        )}
                                        </CardContent>
                                        </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Modules Additionnels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!scratchTicketsAvailable && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                            Les scratch tickets ne sont disponibles que si la borne ou la commande en ligne est activÃ©e.
                        </div>
                    )}

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="scratch_tickets_enabled"
                            checked={scratchTicketsAvailable ? (localProfile.scratch_tickets_enabled || false) : false}
                            onCheckedChange={(checked) => handleFieldChange('scratch_tickets_enabled', checked)}
                            disabled={!scratchTicketsAvailable}
                        />
                        <div>
                            <label htmlFor="scratch_tickets_enabled" className="font-medium cursor-pointer">Activer les Scratch Tickets</label>
                            <p className="text-sm text-gray-500">Permet aux clients de gratter des tickets pour gagner des cadeaux ou réductions</p>
                        </div>
                    </div>

                    {!localProfile.delivery_app_allowed && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            Ce module est desactive par votre administrateur. Contactez-le pour l activer.
                        </div>
                    )}

                    <div className="flex items-center space-x-2 pt-4 border-t">
                        <Switch id="manages_delivery_app" checked={localProfile.manages_delivery_app || false} onCheckedChange={(checked) => handleFieldChange('manages_delivery_app', checked)} disabled={!localProfile.delivery_app_allowed} />
                        <div>
                            <label htmlFor="manages_delivery_app" className="font-medium cursor-pointer">🚚 Activer l'Application Livreur</label>
                            <p className="text-sm text-gray-500">Donne accès à l'app mobile pour que vos livreurs gèrent leurs livraisons (suivi, paiement, GPS)</p>
                        </div>
                    </div>
                    
                    {localProfile.delivery_app_allowed && localProfile.manages_delivery_app && (
                        <div className="mt-4 pt-4 border-t">
                            <DeliveryAppQRCode 
                                tenantId={currentTenant?.id} 
                                restaurantName={localProfile.nom_etablissement || 'Restaurant'}
                                profile={localProfile}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Commandes et Paiements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center space-x-2">
                        <Switch id="force_immediate_payment" checked={localProfile.force_immediate_payment || false} onCheckedChange={(checked) => handleFieldChange('force_immediate_payment', checked)} />
                        <label htmlFor="force_immediate_payment">Forcer le paiement immédiat (pas de mise en crédit)</label>
                    </div>
                    
                    <div className="flex items-center space-x-2 pt-4 border-t">
                        <Switch id="bipeur_enabled" checked={localProfile.bipeur_enabled || false} onCheckedChange={(checked) => handleFieldChange('bipeur_enabled', checked)} />
                        <div>
                            <label htmlFor="bipeur_enabled" className="font-medium cursor-pointer">Afficher le bipeur en caisse</label>
                            <p className="text-sm text-gray-500">Affiche le choix du numero de bipeur dans la fenetre de reglement pour les commandes sur place et a emporter</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-4 border-t">
                        <Switch id="prix_differencies_par_mode" checked={localProfile.prix_differencies_par_mode || false} onCheckedChange={(checked) => handleFieldChange('prix_differencies_par_mode', checked)} />
                        <div>
                            <label htmlFor="prix_differencies_par_mode" className="font-medium cursor-pointer">Prix différenciés par mode de commande</label>
                            <p className="text-sm text-gray-500">Permet de définir des prix différents pour sur place, emporter et livraison</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-4 border-t">
                        <Switch id="allow_price_edit" checked={localProfile.allow_price_edit || false} onCheckedChange={(checked) => handleFieldChange('allow_price_edit', checked)} />
                        <div>
                            <label htmlFor="allow_price_edit" className="font-medium cursor-pointer">Autoriser la modification du prix en caisse</label>
                            <p className="text-sm text-gray-500">Permet au caissier de modifier manuellement le prix d'un article dans le panier</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-4 border-t">
                        <Switch id="allow_item_edit" checked={localProfile.allow_item_edit || false} onCheckedChange={(checked) => handleFieldChange('allow_item_edit', checked)} />
                        <div>
                            <label htmlFor="allow_item_edit" className="font-medium cursor-pointer">Autoriser la modification d'un article dans le panier</label>
                            <p className="text-sm text-gray-500">Permet de re-personnaliser un article déjà ajouté (taille, options, ingrédients) sans le supprimer</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Taux de TVA</CardTitle>
                    <CardDescription>Configurez les taux de TVA applicables dans votre établissement.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {(localProfile.tva_rates || []).map((rate, index) => (
                        <div key={index} className="flex items-end gap-4">
                            <div className="space-y-2 flex-1">
                                <Label htmlFor={`tva-label-${index}`}>Nom du taux</Label>
                                <Input 
                                    id={`tva-label-${index}`}
                                    type="text" 
                                    value={rate.label || ''} 
                                    onChange={(e) => {
                                        const newRates = [...(localProfile.tva_rates || [])];
                                        newRates[index] = { ...newRates[index], label: e.target.value };
                                        handleFieldChange('tva_rates', newRates);
                                    }}
                                    placeholder="Ex: Taux Normal"
                                />
                            </div>
                            <div className="space-y-2 w-32">
                                <Label htmlFor={`tva-rate-${index}`}>Taux (%)</Label>
                                <Input 
                                    id={`tva-rate-${index}`}
                                    type="number"
                                    step="0.1"
                                    value={rate.rate || ''} 
                                    onChange={(e) => handleTvaRateChange(index, e.target.value)}
                                />
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeTvaRate(index)} className="mb-0.5">
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                    <Button type="button" onClick={addTvaRate} variant="outline" size="sm">Ajouter un taux de TVA</Button>
                </CardContent>
            </Card>
            
            <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`min-w-[240px] transition-all ${saveSucceeded ? 'bg-green-600 hover:bg-green-700' : ''}`}
            >
                {isSaving ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                    </>
                ) : saveSucceeded ? (
                    <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Modifications enregistrees
                    </>
                ) : (
                    'Enregistrer les modifications'
                )}
            </Button>
        </div>
    );
}
