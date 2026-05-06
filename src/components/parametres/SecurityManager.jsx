import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Shield, KeyRound, Info, BookKey, Loader2, Check } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../contexts/TenantContext';

const SECURED_PAGES_CONFIG = [
  { name: "Accueil", key: "Accueil", description: "Floute les chiffres du tableau de bord" },
  { name: "Statistiques", key: "Statistiques", description: "Protège l'accès aux statistiques de vente" },
  { name: "Comptabilité", key: "Comptabilite", description: "Protège l'accès aux exports comptables" },
  { name: "Historique", key: "HistoriqueJournalier", description: "Protège l'historique complet des commandes" },
  { name: "Journal Tiroir", key: "DrawerLog", description: "Protège l'historique des ouvertures du tiroir" },
  { name: "Encaissements", key: "Encaissements", description: "Protège le journal des encaissements" },
  { name: "Analyse Produits", key: "AnalyseProduits", description: "Protège l'analyse des ventes par produit" },
  { name: "Comptage Caisse", key: "ComptageCaisse", description: "Protège la fonctionnalité de comptage" },
  { name: "Paramètres", key: "Parametres", description: "Protège l'accès à tous les paramètres" },
];

const KIOSK_EXIT_PIN_KEY = 'KioskTerminalExit';

export default function SecurityManager() {
  const queryClient = useQueryClient();
  const { currentTenant, filterByTenant } = useTenant();
  
  const { data: profile, isLoading } = useQuery({
      queryKey: ['restaurantProfile', currentTenant?.id],
      queryFn: async () => {
        const profiles = await appClient.entities.RestaurantProfile.filter(filterByTenant(), '-updated_date', 5);
        return profiles[0] || null;
      },
      enabled: !!currentTenant?.id,
  });

  const [pins, setPins] = useState({});
  const [isSubmittingPins, setIsSubmittingPins] = useState(false);
  const [formData, setFormData] = useState({ force_immediate_payment: false });
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      if (profile.page_pins) {
        setPins(profile.page_pins);
      }
      setFormData(prev => ({
        ...prev,
        force_immediate_payment: profile.force_immediate_payment || false
      }));
    }
  }, [profile]);

  const handlePinChange = (pageKey, value) => {
    if (/^\d*$/.test(value) && value.length <= 8) {
      setPins(prev => ({ ...prev, [pageKey]: value }));
    }
  };

  const handleInputChange = async (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    
    try {
      if (profile) {
        await appClient.entities.RestaurantProfile.update(profile.id, { 
          tenant_id: currentTenant.id,
          [key]: value 
        });
        toast({
          title: "Réglage enregistré",
          description: "La règle d'encaissement a été mise à jour.",
        });
        queryClient.invalidateQueries({ queryKey: ['restaurantProfile'] });
      } else {
        throw new Error("Profil du restaurant non trouvé.");
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du réglage:", error);
      toast({
        title: "Erreur",
        description: `Impossible d'enregistrer le réglage: ${key}.`,
        variant: "destructive",
      });
      setFormData(prev => ({ ...prev, [key]: !value }));
    }
  };

  const handleSavePins = async () => {
    setIsSubmittingPins(true);
    try {
      if (profile) {
        await appClient.entities.RestaurantProfile.update(profile.id, { 
          tenant_id: currentTenant.id,
          page_pins: pins 
        });
        toast({
          title: "Sécurité mise à jour",
          description: "Vos codes PIN ont été enregistrés.",
        });
        queryClient.invalidateQueries({ queryKey: ['restaurantProfile'] });
      } else {
        throw new Error("Profil du restaurant non trouvé.");
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des PINs:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les codes PIN.",
        variant: "destructive",
      });
    }
    setIsSubmittingPins(false);
  };

  if (isLoading) {
      return (
        <div className="flex justify-center items-center p-10">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      );
  }

  return (
    <div className="p-6 space-y-6">
       <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-500" />
                        Gestion de la Sécurité
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Définissez des codes PIN pour restreindre l'accès aux sections sensibles.
                    </p>
                    <p className="text-muted-foreground mt-2">Protégez l'accès à certaines pages avec un code PIN à 4 chiffres.</p>
                </div>
                <Button onClick={handleSavePins} disabled={isSubmittingPins} className="bg-indigo-600 hover:bg-indigo-700">
                    {isSubmittingPins ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Sauvegarder les codes PIN
                </Button>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-start p-3 text-sm text-indigo-800 bg-indigo-100 rounded-lg border border-indigo-200">
                <Info className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                <p>
                    Laissez un champ vide pour qu'aucun code ne soit demandé pour cette section. Un code doit contenir entre 4 et 8 chiffres.
                </p>
            </div>

            <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-amber-700" />
                        Code de sortie grande borne
                    </CardTitle>
                    <CardDescription className="text-xs text-amber-800">
                        Permet de quitter le mode borne sur l ecran tactile. Laissez vide pour utiliser le code par defaut 2580.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Input
                        type="password"
                        placeholder="Code de sortie (4-8 chiffres)"
                        value={pins[KIOSK_EXIT_PIN_KEY] || ''}
                        onChange={(e) => handlePinChange(KIOSK_EXIT_PIN_KEY, e.target.value)}
                        pattern="\d{4,8}"
                        title="Doit contenir entre 4 et 8 chiffres."
                    />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SECURED_PAGES_CONFIG.map(page => (
                    <Card key={page.key}>
                        <CardHeader className="pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            {page.key === "DrawerLog" ? <BookKey className="w-4 h-4 text-gray-500"/> : <KeyRound className="w-4 h-4 text-gray-500"/>}
                            {page.name}
                        </CardTitle>
                        <CardDescription className="text-xs">{page.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                        <Input
                            type="password"
                            placeholder="Code PIN (4-8 chiffres)"
                            value={pins[page.key] || ''}
                            onChange={(e) => handlePinChange(page.key, e.target.value)}
                            pattern="\d{4,8}"
                            title="Doit contenir entre 4 et 8 chiffres."
                        />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </CardContent>
       </Card>

      <Card>
          <CardHeader>
              <CardTitle>Règles d'Encaissement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border bg-background p-4">
                  <div className="space-y-0.5">
                      <Label htmlFor="force_immediate_payment" className="text-base">
                          Forcer l'encaissement immédiat
                      </Label>
                      <p className="text-sm text-muted-foreground">
                          Interdit la mise en crédit des commandes "Sur Place" et "À Emporter".
                      </p>
                  </div>
                  <Switch
                      id="force_immediate_payment"
                      checked={formData.force_immediate_payment}
                      onCheckedChange={(checked) => handleInputChange('force_immediate_payment', checked)}
                  />
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
