import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Truck, Phone, Loader2, ExternalLink, Printer } from "lucide-react";
import { generateDeliveryQRTicketHtml, triggerPrint } from "../caisse/ticketUtils";
import { appClient } from "@/api/appClient";
import { useQueryClient } from "@tanstack/react-query";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "@/components/ui/use-toast";

const vehicleTypes = [
  { value: "scooter", label: "Scooter", icon: "🛵" },
  { value: "velo", label: "Velo", icon: "🚴" },
  { value: "voiture", label: "Voiture", icon: "🚗" },
  { value: "moto", label: "Moto", icon: "🏍️" },
];

const DeliveryPersonForm = ({ person, onSave, onCancel, vehicleOptions, appModuleEnabled }) => {
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    telephone: "",
    user_email: "",
    username: "",
    password: "",
    vehicule: "scooter",
    disponible: true,
    app_access_enabled: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (person) {
      setFormData({
        nom: person.nom || "",
        prenom: person.prenom || "",
        telephone: person.telephone || "",
        user_email: person.user_email || "",
        username: person.username || "",
        password: person.password || "",
        vehicule: person.vehicule || "scooter",
        disponible: person.disponible !== false,
        app_access_enabled: person.app_access_enabled !== false,
      });
      return;
    }

    setFormData({
      nom: "",
      prenom: "",
      telephone: "",
      user_email: "",
      username: "",
      password: "",
      vehicule: "scooter",
      disponible: true,
      app_access_enabled: true,
    });
  }, [person]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (appModuleEnabled && (!formData.username.trim() || !formData.password.trim())) {
      return;
    }
    setIsSubmitting(true);
    await onSave(formData);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nom">Nom *</Label>
          <Input
            id="nom"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            placeholder="Dupont"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prenom">Prenom *</Label>
          <Input
            id="prenom"
            value={formData.prenom}
            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
            placeholder="Jean"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="telephone">Telephone *</Label>
        <Input
          id="telephone"
          type="tel"
          value={formData.telephone}
          onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
          placeholder="0123456789"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="user_email">Email</Label>
        <Input
          id="user_email"
          type="email"
          value={formData.user_email}
          onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
          placeholder="livreur@example.com"
        />
      </div>

      {appModuleEnabled ? (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-semibold text-blue-800">Identifiants App Livreur</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="username">Identifiant *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="jean.dupont"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="******"
                required
              />
            </div>
          </div>
          <p className="text-xs text-blue-600">Ces identifiants servent a la connexion de l'application livreur.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-semibold text-gray-700">Application livreur non active</p>
          <p className="mt-1 text-xs text-gray-600">
            Les identifiants de connexion ne sont pas necessaires pour ajouter un livreur.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="vehicule">Vehicule *</Label>
        <Select value={formData.vehicule} onValueChange={(value) => setFormData({ ...formData, vehicule: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vehicleOptions.map((vehicle) => (
              <SelectItem key={vehicle.value} value={vehicle.value}>
                {vehicle.icon} {vehicle.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="disponible"
          checked={formData.disponible}
          onCheckedChange={(checked) => setFormData({ ...formData, disponible: checked })}
        />
        <Label htmlFor="disponible">Livreur disponible</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="app_access_enabled"
          checked={appModuleEnabled && formData.app_access_enabled}
          onCheckedChange={(checked) => setFormData({ ...formData, app_access_enabled: checked })}
          disabled={!appModuleEnabled}
        />
        <Label htmlFor="app_access_enabled">Acces application livreur</Label>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Enregistrement..." : person ? "Modifier" : "Ajouter"}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default function DeliveryPersonManager({ data, onDataChange }) {
  const queryClient = useQueryClient();
  const { withTenant, currentTenant } = useTenant();
  const { toast } = useToast();
  const { deliveryPeople = [], profile = null } = data || {};
  const appModuleEnabled = profile?.delivery_app_allowed === true && profile?.manages_delivery_app === true;

  const [showDialog, setShowDialog] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);

  const handlePrintQR = async () => {
    try {
      const qrUrl = `${window.location.origin}/DeliveryAppPublic?tenant=${currentTenant?.id}`;
      const profiles = await appClient.entities.RestaurantProfile.filter({ tenant_id: currentTenant?.id });
      const restaurantProfile = profiles[0] || null;
      const html = await generateDeliveryQRTicketHtml(restaurantProfile, qrUrl);
      await triggerPrint(html, () => {});
    } catch (error) {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'imprimer le QR code.",
        variant: "destructive",
      });
    }
  };

  const handleAddPerson = () => {
    setEditingPerson(null);
    setShowDialog(true);
  };

  const handleEditPerson = (person) => {
    setEditingPerson(person);
    setShowDialog(true);
  };

  const handleSavePerson = async (formData) => {
    try {
      const normalizedFormData = {
        ...formData,
        username: appModuleEnabled ? formData.username?.trim() || null : null,
        password: appModuleEnabled ? formData.password?.trim() || null : null,
        app_access_enabled: appModuleEnabled ? formData.app_access_enabled !== false : false,
      };

      if (editingPerson) {
        await appClient.entities.DeliveryPerson.update(editingPerson.id, withTenant(normalizedFormData));
      } else {
        const personData = withTenant({
          ...normalizedFormData,
          disponible: formData.disponible !== false,
          en_livraison: false,
          nb_livraisons_jour: 0,
          total_encaisse: 0,
        });
        await appClient.entities.DeliveryPerson.create(personData);
      }

      setShowDialog(false);
      setEditingPerson(null);
      await onDataChange();
      queryClient.invalidateQueries({ queryKey: ["settingsSummaryData"] });
      toast({
        title: "Succes",
        description: editingPerson ? "Livreur mis a jour." : "Livreur ajoute.",
        variant: "success",
      });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du livreur:", error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'enregistrer le livreur.",
        variant: "destructive",
      });
    }
  };

  const handleCancelForm = () => {
    setShowDialog(false);
    setEditingPerson(null);
  };

  const handleDeletePerson = async (personId) => {
    if (!confirm("Etes-vous sur de vouloir supprimer ce livreur ?")) return;

    try {
      await appClient.entities.DeliveryPerson.delete(personId);
      await onDataChange();
      queryClient.invalidateQueries({ queryKey: ["settingsSummaryData"] });
      toast({
        title: "Succes",
        description: "Livreur supprime.",
        variant: "success",
      });
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de supprimer le livreur.",
        variant: "destructive",
      });
    }
  };

  const toggleAvailability = async (person) => {
    try {
      await appClient.entities.DeliveryPerson.update(person.id, withTenant({ disponible: !person.disponible }));
      await onDataChange();
      queryClient.invalidateQueries({ queryKey: ["settingsSummaryData"] });
    } catch (error) {
      console.error("Erreur lors de la mise a jour:", error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de mettre a jour la disponibilite.",
        variant: "destructive",
      });
    }
  };

  const toggleAppAccess = async (person) => {
    try {
      await appClient.entities.DeliveryPerson.update(
        person.id,
        withTenant({ app_access_enabled: person.app_access_enabled === false }),
      );
      await onDataChange();
      queryClient.invalidateQueries({ queryKey: ["settingsSummaryData"] });
    } catch (error) {
      console.error("Erreur lors de la mise a jour de l acces livreur:", error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de mettre a jour l'acces livreur.",
        variant: "destructive",
      });
    }
  };

  const isLoading = !data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {(profile?.manages_delivery_app !== true || profile?.delivery_app_allowed !== true) && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <p className="text-sm font-semibold text-yellow-800">Module livreur partiellement desactive</p>
          <p className="mt-1 text-xs text-yellow-700">
            Vous pouvez gerer les livreurs ici, mais l'application livreur ne sera pleinement exploitable que si
            `Application livreur autorisee` et `Gestion app livreur` sont actives dans le profil restaurant/admin.
          </p>
        </div>
      )}

      {appModuleEnabled && (
        <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div>
            <p className="text-sm font-semibold text-orange-800">Application Livreur</p>
            <p className="text-xs text-orange-600">Partagez ce lien ou imprimez le QR code pour vos livreurs</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrintQR} variant="outline" size="sm" className="gap-2 border-orange-300 text-orange-700">
              <Printer className="h-4 w-4" />
              Imprimer QR
            </Button>
            <a href={`/DeliveryAppPublic?tenant=${currentTenant?.id}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2 border-orange-300 text-orange-700">
                <ExternalLink className="h-4 w-4" />
                Ouvrir
              </Button>
            </a>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold">
          <Truck className="h-5 w-5 text-blue-500" />
          Gestion des Livreurs
        </h3>
        <Button onClick={handleAddPerson} className="gap-2 bg-blue-500 hover:bg-blue-600">
          <Plus className="h-4 w-4" />
          Nouveau Livreur
        </Button>
      </div>

      {deliveryPeople.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Nom</TableHead>
                <TableHead>Identifiant</TableHead>
                <TableHead>Telephone</TableHead>
                <TableHead>Vehicule</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Acces app</TableHead>
                <TableHead>Livraisons</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryPeople.map((person) => (
                <TableRow key={person.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div>
                      <p className="font-medium">{person.prenom} {person.nom}</p>
                      {person.user_email && <p className="text-xs text-gray-500">{person.user_email}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {person.username ? (
                      <p className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">{person.username}</p>
                    ) : (
                      <span className="text-xs text-red-400">Non configure</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {person.telephone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {vehicleTypes.find((v) => v.value === person.vehicule)?.icon} {person.vehicule}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={person.disponible !== false} onCheckedChange={() => toggleAvailability(person)} />
                      <span className="text-sm">
                        {person.en_livraison ? (
                          <Badge className="bg-purple-100 text-purple-800">En livraison</Badge>
                        ) : person.disponible !== false ? (
                          <Badge className="bg-green-100 text-green-800">Disponible</Badge>
                        ) : (
                          <Badge variant="destructive">Indisponible</Badge>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={person.app_access_enabled !== false} onCheckedChange={() => toggleAppAccess(person)} />
                      {person.app_access_enabled !== false ? (
                        <Badge className="bg-blue-100 text-blue-800">Autorise</Badge>
                      ) : (
                        <Badge variant="secondary">Bloque</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>{person.nb_livraisons_jour || 0} livraisons</p>
                      <p className="text-gray-500">{(person.total_encaisse || 0).toFixed(2)}EUR encaisses</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditPerson(person)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePerson(person.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="py-12 text-center text-gray-500">
          <Truck className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Aucun livreur enregistre</p>
          <p className="text-sm">Ajoutez votre equipe de livraison</p>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPerson ? "Modifier le livreur" : "Nouveau livreur"}</DialogTitle>
          </DialogHeader>
          <DeliveryPersonForm
            person={editingPerson}
            onSave={handleSavePerson}
            onCancel={handleCancelForm}
            vehicleOptions={vehicleTypes}
            appModuleEnabled={appModuleEnabled}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
