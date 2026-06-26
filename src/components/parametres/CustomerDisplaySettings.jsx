import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { appClient } from '@/api/appClient';
import { Monitor, Upload, Trash2, Palette, Eye, ExternalLink, MessageSquare } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function CustomerDisplaySettings({ data, onDataChange, withTenant }) {
  const { profile } = data;
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    enabled: profile?.customer_display_enabled || false,
    images: profile?.customer_display_images || [],
    color: profile?.customer_display_color || '#f97316',
    infoMessage: profile?.customer_display_info_message || '',
  });
  const [uploading, setUploading] = useState(false);

  const isMissingDisplayColumnError = (error) => {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
    return /customer_display_images/i.test(message)
      || /customer_display_color/i.test(message)
      || /customer_display_info_message/i.test(message);
  };

  useEffect(() => {
    if (profile) {
      setSettings({
        enabled: profile.customer_display_enabled || false,
        images: profile.customer_display_images || [],
        color: profile.customer_display_color || '#f97316',
        infoMessage: profile.customer_display_info_message || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.id) return;

    try {
      console.log('💾 [CustomerDisplaySettings] Sauvegarde...', {
        enabled: settings.enabled,
        images: settings.images,
        color: settings.color,
      });

      await appClient.entities.RestaurantProfile.update(profile.id, {
        customer_display_enabled: settings.enabled,
        customer_display_images: settings.images,
        customer_display_color: settings.color,
        customer_display_info_message: settings.infoMessage,
      });

      console.log('✅ [CustomerDisplaySettings] Sauvegarde réussie');

      toast({
        title: '✅ Paramètres sauvegardés',
        description: "Configuration de l'écran client mise à jour. Rechargez l'écran client pour voir les changements.",
      });

      onDataChange();
    } catch (error) {
      console.error('❌ [CustomerDisplaySettings] Erreur sauvegarde:', error);
      toast({
        title: '❌ Erreur',
        description: isMissingDisplayColumnError(error)
          ? "Les colonnes SQL de l'ecran client manquent encore dans restaurant_profiles. Appliquez la migration Supabase de restaurant profile."
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setSettings(prev => ({
        ...prev,
        images: [...prev.images, file_url],
      }));
      toast({
        title: '✅ Image ajoutée',
        description: 'Image uploadée avec succès',
      });
    } catch (error) {
      toast({
        title: '❌ Erreur upload',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    setSettings(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const openCustomerDisplay = () => {
    const tenantId = profile?.tenant_id;
    const url = tenantId 
      ? `${createPageUrl('CustomerDisplay')}?tenant=${tenantId}`
      : createPageUrl('CustomerDisplay');
    window.open(url, '_blank', 'width=1920,height=1080');
  };

  const isEnabled = profile?.customer_display_enabled || false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Écran Client (Second écran)
              </CardTitle>
              <CardDescription className="mt-2">
                Affichez le panier et des promotions sur un écran secondaire pour vos clients
              </CardDescription>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {isEnabled ? 'Activé' : 'Désactivé par l\'administrateur'}
            </span>
          </div>
          {!isEnabled && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ⛔ Ce module est désactivé par votre administrateur. Contactez-le pour l'activer.
            </div>
          )}
        </CardHeader>

        {isEnabled && (
          <CardContent className="space-y-6">
            {/* Couleur */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Couleur principale
              </Label>
              <div className="flex gap-3 items-center">
                <Input
                  type="color"
                  value={settings.color}
                  onChange={(e) => setSettings(prev => ({ ...prev, color: e.target.value }))}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.color}
                  onChange={(e) => setSettings(prev => ({ ...prev, color: e.target.value }))}
                  className="flex-1"
                  placeholder="#f97316"
                />
              </div>
            </div>

            {/* Message informatif */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Message informatif
              </Label>
              <p className="text-xs text-gray-500">
                Message affiché entre l'en-tête et les images (promotions, horaires, informations...)
              </p>
              <Textarea
                value={settings.infoMessage}
                onChange={(e) => setSettings(prev => ({ ...prev, infoMessage: e.target.value }))}
                placeholder="Exemple: 🎉 Promo du jour: -20% sur tous les desserts ! Ouvert jusqu'à 22h"
                className="min-h-20"
              />
            </div>

            {/* Images promotionnelles */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Images promotionnelles (recommandé: 1920x1080px)
              </Label>
              <p className="text-xs text-gray-500">
                Les images défileront automatiquement sur l'écran client
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {settings.images.map((img, index) => (
                  <div key={index} className="relative group rounded-lg overflow-hidden border-2 border-gray-200">
                    <img
                      src={img}
                      alt={`Promo ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <label className="border-2 border-dashed border-gray-300 rounded-lg h-32 flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Ajouter une image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={handleSave} className="flex-1">
                Sauvegarder la configuration
              </Button>
              <Button onClick={openCustomerDisplay} variant="outline" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Prévisualiser
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
