import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { appClient } from '@/api/appClient';
import { Monitor, Upload, Trash2, Palette, Eye, ExternalLink, MessageSquare, LayoutTemplate, ZoomIn, RefreshCw, Maximize, Activity, PlayCircle, Settings2 } from 'lucide-react';
import {
  CUSTOMER_DISPLAY_RUNTIME_VERSION,
  getCustomerDisplayControlChannelName,
  getCustomerDisplayLiveControlKey,
  openCustomerDisplayWindow,
  sendCustomerDisplayControlMessage,
} from '@/lib/customerDisplayController';
import {
  CUSTOMER_DISPLAY_MODES,
  CUSTOMER_DISPLAY_THEMES,
  DEFAULT_CUSTOMER_DISPLAY_SETTINGS,
  normalizeCustomerDisplaySettings,
} from '@/lib/customerDisplayRuntime';

const MODE_LABELS = {
  auto: 'Automatique',
  tv: 'TV',
  monitor: 'Moniteur',
  compact: 'Compact',
  portrait: 'Portrait',
};

const THEME_LABELS = {
  default: 'Par defaut',
  contrast: 'Contraste',
  soft: 'Doux',
};

export default function CustomerDisplaySettings({ data, onDataChange }) {
  const { profile } = data;
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState(null);
  const [statusNow, setStatusNow] = useState(Date.now());
  const [settings, setSettings] = useState({
    enabled: false,
    images: [],
    color: '#f97316',
    infoMessage: '',
    display: DEFAULT_CUSTOMER_DISPLAY_SETTINGS,
  });

  const isMissingDisplayColumnError = (error) => {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
    return /customer_display_images/i.test(message)
      || /customer_display_color/i.test(message)
      || /customer_display_info_message/i.test(message)
      || /customer_display_settings/i.test(message);
  };

  useEffect(() => {
    if (!profile) return;
    setSettings({
      enabled: profile.customer_display_enabled || false,
      images: profile.customer_display_images || [],
      color: profile.customer_display_color || '#f97316',
      infoMessage: profile.customer_display_info_message || '',
      display: normalizeCustomerDisplaySettings(profile.customer_display_settings),
    });
  }, [profile]);

  useEffect(() => {
    if (!profile?.tenant_id || typeof window === 'undefined') return undefined;

    const applyRuntimeStatus = (payload) => {
      if (!payload || payload.type !== 'runtime-status') return;
      if (payload.tenantId !== profile.tenant_id) return;
      setRuntimeStatus(payload);
      setStatusNow(Date.now());
    };

    const handleStorage = (event) => {
      if (event.key !== getCustomerDisplayLiveControlKey(profile.tenant_id) || !event.newValue) return;
      try {
        applyRuntimeStatus(JSON.parse(event.newValue));
      } catch (error) {
        console.error('[CustomerDisplaySettings] invalid runtime status payload:', error);
      }
    };

    let controlChannel = null;
    if ('BroadcastChannel' in window) {
      controlChannel = new BroadcastChannel(getCustomerDisplayControlChannelName(profile.tenant_id));
      controlChannel.onmessage = (event) => applyRuntimeStatus(event.data);
    }

    window.addEventListener('storage', handleStorage);
    const intervalId = window.setInterval(() => setStatusNow(Date.now()), 5000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(intervalId);
      controlChannel?.close?.();
    };
  }, [profile?.tenant_id]);

  const openCustomerDisplay = (setup = false) => {
    openCustomerDisplayWindow({ tenantId: profile?.tenant_id, setup });
  };

  const handleTestDisplay = () => {
    if (!profile?.tenant_id) return;
    sendCustomerDisplayControlMessage({
      tenantId: profile.tenant_id,
      type: 'display-test',
      payload: {
        title: 'TEST ECRAN CLIENT',
        subtitle: 'Verifiez que cet ecran est bien visible pour vos clients',
        durationMs: 8000,
      },
    });
  };

  const handleRequestFullscreen = () => {
    if (!profile?.tenant_id) return;
    sendCustomerDisplayControlMessage({
      tenantId: profile.tenant_id,
      type: 'request-fullscreen',
    });
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    try {
      await appClient.entities.RestaurantProfile.update(profile.id, {
        customer_display_enabled: settings.enabled,
        customer_display_images: settings.images,
        customer_display_color: settings.color,
        customer_display_info_message: settings.infoMessage,
        customer_display_settings: normalizeCustomerDisplaySettings(settings.display),
      });

      toast({
        title: 'Parametres sauvegardes',
        description: "Configuration de l'ecran client mise a jour.",
      });

      onDataChange();
    } catch (error) {
      console.error('[CustomerDisplaySettings] save error:', error);
      toast({
        title: 'Erreur',
        description: isMissingDisplayColumnError(error)
          ? "Les colonnes SQL de l'ecran client manquent encore dans restaurant_profiles. Appliquez la migration Supabase."
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setSettings((prev) => ({
        ...prev,
        images: [...prev.images, file_url],
      }));
      toast({
        title: 'Image ajoutee',
        description: 'Image uploadee avec succes.',
      });
    } catch (error) {
      toast({
        title: 'Erreur upload',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    setSettings((prev) => ({
      ...prev,
      images: prev.images.filter((_, imageIndex) => imageIndex !== index),
    }));
  };

  const isEnabled = profile?.customer_display_enabled || false;
  const normalizedDisplay = useMemo(
    () => normalizeCustomerDisplaySettings(settings.display),
    [settings.display]
  );
  const isRuntimeConnected = runtimeStatus?.emittedAt
    ? (statusNow - new Date(runtimeStatus.emittedAt).getTime()) <= 90000
    : false;
  const lastSyncLabel = runtimeStatus?.emittedAt
    ? new Date(runtimeStatus.emittedAt).toLocaleString('fr-FR')
    : 'Aucune';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Ecran Client
              </CardTitle>
              <CardDescription className="mt-2">
                Terminal d'affichage client avec configuration persistante et layout adaptatif.
              </CardDescription>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full ${isEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {isEnabled ? 'Active' : "Desactive par l'administrateur"}
            </span>
          </div>
          {!isEnabled && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Ce module est desactive par votre administrateur. Contactez-le pour l'activer.
            </div>
          )}
        </CardHeader>

        {isEnabled && (
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4" />
                  Mode d'affichage
                </Label>
                <Select
                  value={normalizedDisplay.mode}
                  onValueChange={(value) => setSettings((prev) => ({
                    ...prev,
                    display: { ...prev.display, mode: value },
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_DISPLAY_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {MODE_LABELS[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Le mode auto detecte l'ecran a chaque ouverture. Les autres modes forcent un layout.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Theme
                </Label>
                <Select
                  value={normalizedDisplay.theme}
                  onValueChange={(value) => setSettings((prev) => ({
                    ...prev,
                    display: { ...prev.display, theme: value },
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_DISPLAY_THEMES.map((theme) => (
                      <SelectItem key={theme} value={theme}>
                        {THEME_LABELS[theme]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4" />
                Zoom interface
              </Label>
              <Input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={normalizedDisplay.zoom}
                onChange={(event) => setSettings((prev) => ({
                  ...prev,
                  display: { ...prev.display, zoom: Number(event.target.value) },
                }))}
              />
              <p className="text-sm font-medium text-gray-700">{normalizedDisplay.zoom.toFixed(2)}x</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Couleur principale
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={settings.color}
                  onChange={(event) => setSettings((prev) => ({ ...prev, color: event.target.value }))}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.color}
                  onChange={(event) => setSettings((prev) => ({ ...prev, color: event.target.value }))}
                  className="flex-1"
                  placeholder="#f97316"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Message informatif
              </Label>
              <p className="text-xs text-gray-500">
                Affiche un message entre l'en-tete et les images.
              </p>
              <Textarea
                value={settings.infoMessage}
                onChange={(event) => setSettings((prev) => ({ ...prev, infoMessage: event.target.value }))}
                placeholder="Exemple: Promo du jour sur les desserts."
                className="min-h-20"
              />
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Images promotionnelles
              </Label>
              <p className="text-xs text-gray-500">
                Defilement automatique sur l'ecran client.
              </p>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {settings.images.map((imageUrl, index) => (
                  <div key={imageUrl} className="group relative overflow-hidden rounded-lg border-2 border-gray-200">
                    <img src={imageUrl} alt={`Promo ${index + 1}`} className="h-32 w-full object-cover" />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-orange-500 hover:bg-orange-50">
                  <Upload className="mb-2 w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-500">{uploading ? 'Upload...' : 'Ajouter une image'}</span>
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

            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-800">Configuration persistante</div>
              <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                <div>Mode: <span className="font-medium text-slate-900">{MODE_LABELS[normalizedDisplay.mode]}</span></div>
                <div>Theme: <span className="font-medium text-slate-900">{THEME_LABELS[normalizedDisplay.theme]}</span></div>
                <div>Zoom: <span className="font-medium text-slate-900">{normalizedDisplay.zoom.toFixed(2)}x</span></div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Activity className="w-4 h-4" />
                Diagnostic ecran client
              </div>
              <div className="mb-4 flex items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${isRuntimeConnected ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                  <span className={`h-2 w-2 rounded-full ${isRuntimeConnected ? 'bg-green-500' : 'bg-slate-500'}`}></span>
                  {isRuntimeConnected ? 'Connecte' : 'Deconnecte'}
                </span>
              </div>
              <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-3">
                <div>Resolution : <span className="font-medium text-slate-900">{runtimeStatus?.runtime?.width || '-'} x {runtimeStatus?.runtime?.height || '-'}</span></div>
                <div>Orientation : <span className="font-medium text-slate-900">{runtimeStatus?.runtime?.orientation || '-'}</span></div>
                <div>Ratio : <span className="font-medium text-slate-900">{runtimeStatus?.runtime?.ratioLabel || '-'}</span></div>
                <div>Mode detecte : <span className="font-medium text-slate-900">{runtimeStatus?.runtime?.detectedMode || '-'}</span></div>
                <div>Mode applique : <span className="font-medium text-slate-900">{runtimeStatus?.effectiveMode || normalizedDisplay.mode}</span></div>
                <div>Tactile : <span className="font-medium text-slate-900">{runtimeStatus?.runtime?.touchCapable ? 'Oui' : 'Non'}</span></div>
                <div>Derniere synchronisation : <span className="font-medium text-slate-900">{lastSyncLabel}</span></div>
                <div>Version : <span className="font-medium text-slate-900">{runtimeStatus?.version || CUSTOMER_DISPLAY_RUNTIME_VERSION}</span></div>
                <div>Setup : <span className="font-medium text-slate-900">{runtimeStatus?.setupMode ? 'Oui' : 'Non'}</span></div>
              </div>
            </div>

            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Settings2 className="w-4 h-4" />
                Assistant de configuration
              </div>
              <div className="grid gap-2 text-sm text-slate-600">
                <div>1. Ouvrir l'ecran client en mode configuration.</div>
                <div>2. L'ecran mesure automatiquement resolution, ratio, orientation et tactile.</div>
                <div>3. Verifier le diagnostic, puis sauvegarder la configuration persistante.</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t pt-4">
              <Button onClick={handleSave} className="flex-1 min-w-[220px]">
                Sauvegarder la configuration
              </Button>
              <Button onClick={() => openCustomerDisplay(false)} variant="outline" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Ouvrir l'ecran
                <ExternalLink className="w-3 h-3" />
              </Button>
              <Button onClick={() => openCustomerDisplay(true)} variant="outline" className="flex items-center gap-2">
                Configurer l'ecran
                <ExternalLink className="w-3 h-3" />
              </Button>
              <Button onClick={() => openCustomerDisplay(false)} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Rouvrir
              </Button>
              <Button onClick={handleTestDisplay} variant="outline" className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4" />
                Tester l'ecran
              </Button>
              <Button onClick={handleRequestFullscreen} variant="outline" className="flex items-center gap-2">
                <Maximize className="w-4 h-4" />
                Passer en plein ecran
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
