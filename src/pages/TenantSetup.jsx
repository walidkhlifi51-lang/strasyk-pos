import React, { useState } from "react";
import { appClient } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Store, Loader2 } from "lucide-react";

export default function TenantSetup() {
  const [formData, setFormData] = useState({
    nom_commercial: "",
    adresse: "",
    telephone: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nom_commercial || !formData.adresse || !formData.telephone) {
      toast({
        title: "❌ Champs requis",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const user = await appClient.auth.me();
      
      // Créer le slug
      const slug = formData.nom_commercial
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Créer le tenant
      const newTenant = await appClient.entities.Tenant.create({
        nom_commercial: formData.nom_commercial,
        slug: slug,
        owner_email: user.email,
        subscription_plan: "basic",
        active: true,
      });

      // Créer le profil restaurant
      await appClient.entities.RestaurantProfile.create({
        tenant_id: newTenant.id,
        nom_etablissement: formData.nom_commercial,
        adresse: formData.adresse,
        telephone: formData.telephone,
        frais_livraison: 2.5,
        montant_minimum_livraison: 15,
        zone_livraison_km: 5,
        impression_auto: true,
        manages_deliveries: true,
        manages_table_plan: false,
        delivery_app_allowed: false,
        manages_delivery_app: false,
      });

      // Assigner le tenant à l'utilisateur
      await appClient.auth.updateMe({ tenant_id: newTenant.id });

      toast({
        title: "✅ Commerce créé !",
        description: `${formData.nom_commercial} a été créé avec succès.`,
      });

      // Recharger la page
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error("Erreur création commerce:", error);
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de créer le commerce",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Configuration initiale
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Configurez votre commerce pour commencer
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="nom_commercial">
                Nom du commerce <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nom_commercial"
                placeholder="Pizza Roma, Burger King..."
                value={formData.nom_commercial}
                onChange={(e) => setFormData({ ...formData, nom_commercial: e.target.value })}
                disabled={isCreating}
                required
              />
            </div>

            <div>
              <Label htmlFor="adresse">
                Adresse <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adresse"
                placeholder="12 rue de la Paix, 75000 Paris"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                disabled={isCreating}
                required
              />
            </div>

            <div>
              <Label htmlFor="telephone">
                Téléphone <span className="text-red-500">*</span>
              </Label>
              <Input
                id="telephone"
                placeholder="01 23 45 67 89"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                disabled={isCreating}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création en cours...
                </>
              ) : (
                "Créer mon commerce"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
