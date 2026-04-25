import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Settings, Save, DollarSign, Gift, Printer, Plus, Trash2, Upload, Wand2 } from 'lucide-react';
import { useTenant } from '@/components/contexts/TenantContext';

export default function SiteAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasModuleAccess, isPlatformAdmin } = useTenant();

  const { data: config, isLoading } = useQuery({
    queryKey: ['siteConfig'],
    queryFn: async () => {
      const configs = await appClient.entities.SiteConfig.list();
      return configs[0] || null;
    },
  });

  const [formData, setFormData] = useState({
    prix_abonnement: 69,
    prix_parametrage: 299,
    duree_essai: 15,
    contact_email: 'contact@strasyk.fr',
    contact_telephone: '+33 1 23 45 67 89',
    contact_adresse: '123 Avenue de la République, 75011 Paris',
    offres_promotionnelles: [],
    materiel_visible: false,
    materiel_offres: [],
    ai_image_generation_enabled: false,
  });

  React.useEffect(() => {
    if (config) {
      setFormData({
        prix_abonnement: config.prix_abonnement || 69,
        prix_parametrage: config.prix_parametrage || 299,
        duree_essai: config.duree_essai || 15,
        contact_email: config.contact_email || 'contact@strasyk.fr',
        contact_telephone: config.contact_telephone || '+33 1 23 45 67 89',
        contact_adresse: config.contact_adresse || '123 Avenue de la République, 75011 Paris',
        offres_promotionnelles: config.offres_promotionnelles || [],
        materiel_visible: config.materiel_visible || false,
        materiel_offres: config.materiel_offres || [],
        ai_image_generation_enabled: config.ai_image_generation_enabled || false,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (config?.id) {
        return await appClient.entities.SiteConfig.update(config.id, data);
      } else {
        return await appClient.entities.SiteConfig.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteConfig'] });
      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les tarifs du site ont été mis à jour',
      });
    },
    onError: () => {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les paramètres',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleImageUpload = async (index, file, type = 'materiel') => {
    if (!file) return;
    
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      
      if (type === 'materiel') {
        const newOffres = [...formData.materiel_offres];
        newOffres[index].image_url = file_url;
        setFormData({ ...formData, materiel_offres: newOffres });
      } else if (type === 'promo') {
        const newOffres = [...formData.offres_promotionnelles];
        newOffres[index].image_url = file_url;
        setFormData({ ...formData, offres_promotionnelles: newOffres });
      }
      
      toast({
        title: 'Image téléchargée',
        description: 'L\'image a été ajoutée avec succès',
      });
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de télécharger l\'image',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="p-6">Chargement...</div>;
  }

  if (!isPlatformAdmin && !hasModuleAccess('can_access_site_admin')) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="font-semibold text-red-700">Acces refuse</p>
            <p className="text-sm text-gray-600 mt-2">
              Seuls les comptes autorises peuvent administrer le site du commerce.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="w-8 h-8" />
          Paramètres du Site Commercial
        </h1>
        <p className="text-gray-600 mt-2">Gérez les tarifs et offres affichés sur le site</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Tarification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Prix de l'abonnement mensuel (€)</Label>
              <Input
                type="number"
                value={formData.prix_abonnement}
                onChange={(e) => setFormData({ ...formData, prix_abonnement: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <Label>Prix du paramétrage initial (€)</Label>
              <Input
                type="number"
                value={formData.prix_parametrage}
                onChange={(e) => setFormData({ ...formData, prix_parametrage: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <Label>Durée de l'essai gratuit (jours)</Label>
              <Input
                type="number"
                value={formData.duree_essai}
                onChange={(e) => setFormData({ ...formData, duree_essai: parseInt(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations de Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="contact_email">Email de contact</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="contact@strasyk.fr"
              />
            </div>
            <div>
              <Label htmlFor="contact_telephone">Téléphone de contact</Label>
              <Input
                id="contact_telephone"
                type="text"
                value={formData.contact_telephone}
                onChange={(e) => setFormData({ ...formData, contact_telephone: e.target.value })}
                placeholder="+33 1 23 45 67 89"
              />
            </div>
            <div>
              <Label htmlFor="contact_adresse">Adresse de contact</Label>
              <Input
                id="contact_adresse"
                type="text"
                value={formData.contact_adresse}
                onChange={(e) => setFormData({ ...formData, contact_adresse: e.target.value })}
                placeholder="123 Avenue de la République, 75011 Paris"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Offres Promotionnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {formData.offres_promotionnelles?.map((offre, index) => (
                <div key={index} className="border-2 border-orange-200 rounded-lg p-4 space-y-3 bg-orange-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold">Offre #{index + 1}</Label>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Active</Label>
                          <Switch
                            checked={offre.active}
                            onCheckedChange={(checked) => {
                              const newOffres = [...formData.offres_promotionnelles];
                              newOffres[index].active = checked;
                              setFormData({ ...formData, offres_promotionnelles: newOffres });
                            }}
                          />
                        </div>
                      </div>
                      <Input
                        placeholder="Titre de l'offre (ex: Offre de lancement)"
                        value={offre.titre}
                        onChange={(e) => {
                          const newOffres = [...formData.offres_promotionnelles];
                          newOffres[index].titre = e.target.value;
                          setFormData({ ...formData, offres_promotionnelles: newOffres });
                        }}
                      />
                      <Textarea
                        placeholder="Description (ex: -20% sur le premier mois)"
                        value={offre.description}
                        onChange={(e) => {
                          const newOffres = [...formData.offres_promotionnelles];
                          newOffres[index].description = e.target.value;
                          setFormData({ ...formData, offres_promotionnelles: newOffres });
                        }}
                        rows={2}
                      />
                      <Input
                        type="number"
                        placeholder="Réduction (%)"
                        value={offre.reduction}
                        onChange={(e) => {
                          const newOffres = [...formData.offres_promotionnelles];
                          newOffres[index].reduction = parseFloat(e.target.value) || 0;
                          setFormData({ ...formData, offres_promotionnelles: newOffres });
                        }}
                      />
                      <div className="space-y-2">
                        <Label>Image de l'offre (optionnel)</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="URL de l'image"
                            value={offre.image_url || ''}
                            onChange={(e) => {
                              const newOffres = [...formData.offres_promotionnelles];
                              newOffres[index].image_url = e.target.value;
                              setFormData({ ...formData, offres_promotionnelles: newOffres });
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById(`promo-image-${index}`).click()}
                          >
                            <Upload className="w-4 h-4" />
                          </Button>
                          <input
                            id={`promo-image-${index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(index, file, 'promo');
                            }}
                          />
                        </div>
                        {offre.image_url && (
                          <img 
                            src={offre.image_url} 
                            alt="Aperçu"
                            className="w-full h-24 object-cover rounded border"
                          />
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newOffres = formData.offres_promotionnelles.filter((_, i) => i !== index);
                        setFormData({ ...formData, offres_promotionnelles: newOffres });
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setFormData({
                  ...formData,
                  offres_promotionnelles: [
                    ...(formData.offres_promotionnelles || []),
                    { active: true, titre: '', description: '', reduction: 0, image_url: '' }
                  ]
                });
              }}
              className="w-full gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter une offre promotionnelle
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Matériel de Caisse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Afficher la section matériel</Label>
            <Switch
              checked={formData.materiel_visible}
              onCheckedChange={(checked) => setFormData({ ...formData, materiel_visible: checked })}
            />
          </div>
          {formData.materiel_visible && (
            <>
              <div className="space-y-3">
                {formData.materiel_offres?.map((offre, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-3">
                        <Input
                          placeholder="Nom de l'offre (ex: Pack Complet)"
                          value={offre.nom}
                          onChange={(e) => {
                            const newOffres = [...formData.materiel_offres];
                            newOffres[index].nom = e.target.value;
                            setFormData({ ...formData, materiel_offres: newOffres });
                          }}
                        />
                        <Input
                          placeholder="Description"
                          value={offre.description}
                          onChange={(e) => {
                            const newOffres = [...formData.materiel_offres];
                            newOffres[index].description = e.target.value;
                            setFormData({ ...formData, materiel_offres: newOffres });
                          }}
                        />
                        <Input
                          type="number"
                          placeholder="Prix (0 = Sur devis)"
                          value={offre.prix}
                          onChange={(e) => {
                            const newOffres = [...formData.materiel_offres];
                            newOffres[index].prix = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, materiel_offres: newOffres });
                          }}
                        />
                        <div className="space-y-2">
                          <Label>Image du produit</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="URL de l'image"
                              value={offre.image_url || ''}
                              onChange={(e) => {
                                const newOffres = [...formData.materiel_offres];
                                newOffres[index].image_url = e.target.value;
                                setFormData({ ...formData, materiel_offres: newOffres });
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById(`image-upload-${index}`).click()}
                            >
                              <Upload className="w-4 h-4" />
                            </Button>
                            <input
                              id={`image-upload-${index}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(index, file);
                              }}
                            />
                          </div>
                          {offre.image_url && (
                            <img 
                              src={offre.image_url} 
                              alt="Aperçu"
                              className="w-full h-32 object-cover rounded border"
                            />
                          )}
                        </div>
                        <Textarea
                          placeholder="Articles inclus (un par ligne)"
                          value={offre.items?.join('\n')}
                          onChange={(e) => {
                            const newOffres = [...formData.materiel_offres];
                            newOffres[index].items = e.target.value.split('\n').filter(i => i.trim());
                            setFormData({ ...formData, materiel_offres: newOffres });
                          }}
                          rows={4}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newOffres = formData.materiel_offres.filter((_, i) => i !== index);
                          setFormData({ ...formData, materiel_offres: newOffres });
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setFormData({
                    ...formData,
                    materiel_offres: [
                      ...(formData.materiel_offres || []),
                      { nom: '', description: '', prix: 0, image_url: '', items: [] }
                    ]
                  });
                }}
                className="w-full gap-2"
              >
                <Plus className="w-4 h-4" />
                Ajouter une offre de matériel
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* IA Image Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            Génération d'Images IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">Activer la génération IA pour les commerçants</p>
              <p className="text-sm text-gray-500 mt-0.5">Affiche un bouton "Générer avec IA" dans les fiches produits et catégories</p>
            </div>
            <Switch
              checked={formData.ai_image_generation_enabled}
              onCheckedChange={(v) => setFormData({ ...formData, ai_image_generation_enabled: v })}
            />
          </div>
          {formData.ai_image_generation_enabled && (
            <div className="mt-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
              ✅ Le bouton "Générer avec IA" est visible dans les fiches produits et catégories
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
        <Save className="w-4 h-4" />
        {saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
      </Button>
    </div>
  );
}
