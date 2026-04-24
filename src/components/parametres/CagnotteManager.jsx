import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PiggyBank, Save, Loader2 } from "lucide-react";
import CanauxSelector from './CanauxSelector';
import { appClient } from "@/api/appClient";
import { useTenant } from '@/components/contexts/TenantContext';
import { useToast } from "@/components/ui/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function CagnotteManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentTenant, filterByTenant, withTenant } = useTenant();

  const { data: rule, isLoading } = useQuery({
    queryKey: ['cagnotteRule', currentTenant?.id],
    queryFn: async () => {
      const rules = await appClient.entities.CagnotteRule.filter(filterByTenant());
      return rules[0] || null;
    },
    enabled: !!currentTenant?.id,
    refetchOnWindowFocus: false,
  });

  const [rate, setRate] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [canaux, setCanaux] = useState(['caisse']);

  useEffect(() => {
    if (rule) {
      setRate(rule.accumulation_rate || 0);
      setIsActive(rule.active);
      setCanaux(Array.isArray(rule.canaux) && rule.canaux.length > 0 ? rule.canaux : ['caisse']);
    } else {
      setRate(0);
      setIsActive(false);
      setCanaux(['caisse']);
    }
  }, [rule]);

  const handleSave = async () => {
    try {
      if (!currentTenant?.id) {
        throw new Error("Tenant introuvable.");
      }

      const data = {
        nom: 'Regle de cagnotte standard',
        accumulation_rate: parseFloat(rate) || 0,
        active: isActive,
        canaux,
      };

      if (rule?.id) {
        await appClient.entities.CagnotteRule.update(rule.id, withTenant(data));
      } else {
        await appClient.entities.CagnotteRule.create(withTenant(data));
      }

      await queryClient.invalidateQueries({ queryKey: ['cagnotteRule', currentTenant.id] });
      toast({
        title: "Succes",
        description: "La regle de cagnotte a ete mise a jour.",
      });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la regle de cagnotte:", error);
      toast({
        title: "Erreur",
        description: `Impossible de sauvegarder la regle: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
            Chargement de la regle de cagnotte...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Veuillez patienter pendant le chargement des parametres.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-pink-500" />
          Gestion de la Cagnotte
        </CardTitle>
        <p className="text-sm text-gray-500">Definissez comment vos clients cumulent des euros sur leur cagnotte.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="cagnotte-active" className="font-medium">Activer le systeme de cagnotte</Label>
            <p className="text-xs text-gray-500">Permet aux clients de cumuler et depenser leur cagnotte.</p>
          </div>
          <Switch id="cagnotte-active" checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <CanauxSelector value={canaux} onChange={setCanaux} />

        <div className="space-y-2">
          <Label htmlFor="accumulation-rate">Taux de cumul (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="accumulation-rate"
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-40"
              placeholder="Ex: 5"
              disabled={!isActive}
            />
            <span className="text-sm text-gray-600">
              % du montant total de la commande sera ajoute a la cagnotte du client.
            </span>
          </div>
        </div>

        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          Enregistrer la regle
        </Button>
      </CardContent>
    </Card>
  );
}
