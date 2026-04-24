import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, Upload, X, Globe, Wand2 } from "lucide-react";
import { appClient } from "@/api/appClient";
import { useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../contexts/TenantContext';
import ProductOptionsManager from './ProductOptionsManager';

export default function ProductForm({ product, categories, ingredients, profile, onSave, onCancel, onUpdateCategories }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentTenant, withTenant } = useTenant();
  const tenantId = currentTenant?.id || null;

  const parseNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const parseOptionalInt = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const [productData, setProductData] = useState(() => {
    // Si les prix par mode n'existent pas, utiliser base_price comme valeur par défaut
    const defaultPrixParMode = product?.prix_par_mode || {
      sur_place: product?.base_price || 0,
      emporter: product?.base_price || 0,
      livraison: product?.base_price || 0
    };

    // Si les prix par taille et mode n'existent pas, utiliser size_prices
    const defaultSizePrixParMode = product?.size_prix_par_mode || 
      (product?.size_prices || []).map(sp => ({
        size: sp.size,
        sur_place: sp.price || 0,
        emporter: sp.price || 0,
        livraison: sp.price || 0
      }));

    return {
      nom: product?.nom || '',
      description: product?.description || '',
      category_id: product?.category_id || '',
      disponible: product?.disponible !== false,
      temps_preparation: product?.temps_preparation || '',
      tva: product?.tva || 5.5,
      image_url: product?.image_url || '',
      image_display: Array.isArray(product?.image_display) ? product.image_display : (product?.image_display === 'both' ? ['caisse', 'borne'] : product?.image_display === 'caisse' ? ['caisse'] : product?.image_display === 'borne' ? ['borne'] : ['caisse', 'borne']),
      color: product?.color || '#eeeeee',
      featured: product?.featured || false,
      sort_order: product?.sort_order ?? null,
      base_price: product?.base_price || 0,
      size_prices: product?.size_prices || [],
      prix_par_mode: defaultPrixParMode,
      size_prix_par_mode: defaultSizePrixParMode,
      // Prix web : par défaut identique à la caisse
      web_price: product?.web_price ?? product?.base_price ?? 0,
      web_size_prices: product?.web_size_prices || (product?.size_prices || []).map(sp => ({ size: sp.size, price: sp.price || 0 })),
      use_custom_web_price: product?.web_price != null,
    };
  });

  const prixDifferencies = profile?.prix_differencies_par_mode === true;

  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [aiImagePerspective, setAiImagePerspective] = useState('angled');
  const aiImageEnabled = profile?.ai_image_generation_enabled === true;

  const selectedCategory = categories?.find(c => c.id === productData.category_id);
  const managesSizes = selectedCategory?.manages_sizes && selectedCategory?.size_template?.length > 0;
  const sizesArray = selectedCategory?.size_template || [];

  const buildProductPayload = (mode = 'full') => {
    const legacyPrice = managesSizes
      ? Math.min(
          ...(productData.size_prices || [])
            .map((sp) => parseNumber(sp.price, 0))
            .filter((price) => price > 0)
        )
      : parseNumber(productData.base_price, 0);

    const basePayload = {
      tenant_id: tenantId,
      nom: productData.nom.trim(),
      description: productData.description,
      category_id: productData.category_id,
      disponible: productData.disponible,
      temps_preparation: parseOptionalInt(productData.temps_preparation),
      tva: parseNumber(productData.tva, 5.5),
      prix: Number.isFinite(legacyPrice) ? legacyPrice : 0,
    };

    if (managesSizes) {
      basePayload.base_price = null;
      basePayload.size_prices = productData.size_prices
        .filter(sp => sp.size)
        .map(sp => ({ size: sp.size, price: parseNumber(sp.price, 0) }));
    } else {
      basePayload.base_price = parseNumber(productData.base_price, 0);
      basePayload.size_prices = [];
    }

    if (mode === 'basic') {
      return {
        tenant_id: basePayload.tenant_id,
        nom: basePayload.nom,
        description: basePayload.description,
        category_id: basePayload.category_id,
        disponible: basePayload.disponible,
        prix: basePayload.prix,
        image_url: productData.image_url || null,
        image_display: productData.image_display || ['caisse', 'borne'],
        featured: productData.featured || false,
      };
    }

    const extendedPayload = {
      ...basePayload,
      image_url: productData.image_url || null,
      image_display: productData.image_display || ['caisse', 'borne'],
      color: productData.color || '#eeeeee',
      featured: productData.featured || false,
      sort_order: productData.sort_order ?? null,
    };

    if (managesSizes) {
      if (prixDifferencies) {
        extendedPayload.size_prix_par_mode = (productData.size_prix_par_mode || [])
          .filter(sp => sp.size)
          .map(sp => ({
            size: sp.size,
            sur_place: parseNumber(sp.sur_place, 0),
            emporter: parseNumber(sp.emporter, 0),
            livraison: parseNumber(sp.livraison, 0)
          }));
      }

      if (productData.use_custom_web_price) {
        extendedPayload.web_size_prices = (productData.web_size_prices || [])
          .filter(sp => sp.size)
          .map(sp => ({ size: sp.size, price: parseNumber(sp.price, 0) }));
        extendedPayload.web_price = null;
      } else {
        extendedPayload.web_size_prices = [];
        extendedPayload.web_price = null;
      }
    } else {
      if (prixDifferencies) {
        extendedPayload.prix_par_mode = {
          sur_place: parseNumber(productData.prix_par_mode?.sur_place, 0),
          emporter: parseNumber(productData.prix_par_mode?.emporter, 0),
          livraison: parseNumber(productData.prix_par_mode?.livraison, 0)
        };
      }

      if (productData.use_custom_web_price) {
        extendedPayload.web_price = parseNumber(productData.web_price, 0);
      } else {
        extendedPayload.web_price = null;
      }
    }

    return extendedPayload;
  };

  // Charger les ingrédients du produit
  useEffect(() => {
    const loadIngredients = async () => {
      if (product?.id && ingredients?.length > 0) {
        try {
          const productIngredients = await appClient.entities.ProductIngredient.filter({
            product_id: product.id
          });
          
          const enrichedIngredients = productIngredients
            .map(pi => {
              const ingredientData = ingredients.find(ing => ing.id === pi.ingredient_id);
              if (ingredientData) {
                return {
                  ingredient_id: pi.ingredient_id,
                  quantite: parseFloat(pi.quantite) || 0,
                  retirable: pi.retirable || false,
                  ingredient: ingredientData
                };
              }
              return null; 
            })
            .filter(Boolean);
          
          setSelectedIngredients(enrichedIngredients);
        } catch (error) {
          console.error("Erreur chargement ingrédients:", error);
          toast({
            title: "Erreur",
            description: "Impossible de charger les ingrédients du produit.",
            variant: "destructive"
          });
        }
      } else {
        setSelectedIngredients([]);
      }
    };
    loadIngredients();
  }, [product?.id, ingredients, toast]);

  // Synchroniser les tailles avec la catégorie
  useEffect(() => {
    if (managesSizes && sizesArray.length > 0) {
      setProductData(prev => {
        const existingSizes = prev.size_prices.map(sp => sp.size);
        const newSizes = sizesArray.filter(size => !existingSizes.includes(size));
        
        if (newSizes.length > 0) {
          return {
            ...prev,
            size_prices: [
              ...prev.size_prices,
              ...newSizes.map(size => ({ size, price: 0 }))
            ]
          };
        }
        return prev;
      });
    }
  }, [productData.category_id, managesSizes, sizesArray.length]);

  const handleInputChange = (field, value) => {
    setProductData(prev => ({ ...prev, [field]: value }));
  };

  const handleSizePriceChange = (size, price) => {
    setProductData(prev => ({
      ...prev,
      size_prices: prev.size_prices.map(sp =>
        sp.size === size ? { ...sp, price: parseFloat(price) || 0 } : sp
      )
    }));
  };

  const handlePrixParModeChange = (mode, value) => {
    setProductData(prev => ({
      ...prev,
      prix_par_mode: {
        ...prev.prix_par_mode,
        [mode]: parseFloat(value) || 0
      }
    }));
  };

  const handleSizePrixParModeChange = (size, mode, value) => {
    setProductData(prev => {
      const existing = prev.size_prix_par_mode || [];
      const sizeIndex = existing.findIndex(s => s.size === size);
      
      if (sizeIndex >= 0) {
        const updated = [...existing];
        updated[sizeIndex] = { ...updated[sizeIndex], [mode]: parseFloat(value) || 0 };
        return { ...prev, size_prix_par_mode: updated };
      } else {
        return {
          ...prev,
          size_prix_par_mode: [...existing, { size, [mode]: parseFloat(value) || 0 }]
        };
      }
    });
  };

  const handleIngredientChange = (index, field, value) => {
    setSelectedIngredients(prev =>
      prev.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      )
    );
  };

  const addIngredient = () => {
    setSelectedIngredients(prev => ([
      ...prev, 
      { ingredient_id: '', quantite: 0, retirable: false, ingredient: null }
    ]));
  };

  const removeIngredient = (index) => {
    setSelectedIngredients(prev =>
      prev.filter((_, i) => i !== index)
    );
  };

  const handleGenerateAiImage = async () => {
    setIsGeneratingImage(true);
    try {
      const categoryName = categories?.find(c => c.id === productData.category_id)?.nom || '';
      const ingredientNames = selectedIngredients
        .map(si => si.ingredient?.nom || ingredients.find(i => i.id === si.ingredient_id)?.nom)
        .filter(Boolean);

      // Étape 1 : Demander à l'IA de construire un prompt photo précis
      const perspectiveInstructions = {
        'frontal': 'The product must be photographed straight-on, directly facing the camera. Optimal for drinks, bottles, flat products.',
        'angled': 'The product must be photographed at a 45-degree angle from above (isometric-like view). This creates a 3D perspective showing depth. Perfect for pizzas, burgers, and plated dishes.',
        'side': 'The product must be photographed from the side profile. Shows the full height and side details.',
        'topdown': 'The product must be photographed from directly above, looking straight down. Bird\'s eye view.'
      };

      const llmResponse = await appClient.integrations.Core.InvokeLLM({
        prompt: `Tu es un expert en photographie culinaire professionnelle. 
Génère un prompt de génération d'image (en anglais) ultra-précis pour un produit de restaurant, avec FOND BLANC PUR.

Produit : "${productData.nom}"
Catégorie : "${categoryName}"
Description : "${productData.description || 'N/A'}"
Ingrédients visibles : ${ingredientNames.length > 0 ? ingredientNames.join(', ') : 'non précisés'}

Perspective photographique OBLIGATOIRE : ${perspectiveInstructions[aiImagePerspective]}

Le prompt DOIT impérativement :
- Identifier précisément le type de plat (ex: pizza, coca-cola, burger, salade, etc.) basé sur le nom et la catégorie
- Décrire les ingrédients visibles spécifiques à ce plat
- Respecter strictement la perspective décrite ci-dessus
- TOUJOURS terminer par : "isolated on a pure white background, product cutout, no shadows, no table, no scenery, white background only, clean product shot, transparent-ready, PNG style, highly detailed, photorealistic"
- NE PAS inclure de texte, logo ou décoration

Réponds UNIQUEMENT avec le prompt en anglais, sans aucune explication.`,
        model: "claude_sonnet_4_6"
      });

      const imagePrompt = typeof llmResponse === 'string' ? llmResponse : llmResponse?.text || llmResponse?.content || '';

      // Étape 2 : Générer l'image avec ce prompt précis
      const result = await appClient.integrations.Core.GenerateImage({ prompt: imagePrompt });
      handleInputChange('image_url', result.url);
      toast({ title: "Image générée avec succès !" });
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de la génération d'image", variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      handleInputChange('image_url', file_url);
      toast({ title: "Image téléchargée avec succès" });
    } catch (error) {
      toast({ title: "Erreur", description: "Échec du téléchargement de l'image", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!tenantId) {
      toast({
        title: "Erreur",
        description: "Aucun commerce actif détecté pour enregistrer le produit.",
        variant: "destructive",
      });
      return;
    }

    if (!productData.nom.trim()) {
      toast({
        title: "Nom requis",
        description: "Renseignez le nom du produit.",
        variant: "destructive",
      });
      return;
    }

    if (!productData.category_id) {
      toast({
        title: "Catégorie requise",
        description: "Sélectionnez une catégorie avant d'enregistrer.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const productPayload = buildProductPayload('full');

      console.log('💾 Payload à enregistrer:', productPayload);

      let savedProduct;

      try {
        if (product?.id) {
          await appClient.entities.Product.update(product.id, productPayload);
          savedProduct = { id: product.id, ...productPayload };
        } else {
          savedProduct = await appClient.entities.Product.create(productPayload);
        }
      } catch (error) {
        const fallbackPayload = buildProductPayload('basic');
        console.warn('Fallback produit minimal suite à erreur schéma Supabase:', error);

        if (product?.id) {
          await appClient.entities.Product.update(product.id, fallbackPayload);
          savedProduct = { id: product.id, ...fallbackPayload };
        } else {
          savedProduct = await appClient.entities.Product.create(fallbackPayload);
        }
      }
      
      console.log('✅ Produit enregistré:', savedProduct);

      // ÉTAPE 3: Gérer les ingrédients
      if (savedProduct?.id) {
        try {
          const existingProductIngredients = await appClient.entities.ProductIngredient.filter({ 
            product_id: savedProduct.id 
          });
          
          const currentSelectedIngredients = selectedIngredients.filter(ing =>
            ing.ingredient_id && ing.ingredient_id.trim() !== ''
          );

          for (const existing of existingProductIngredients) {
            if (!currentSelectedIngredients.find(si => si.ingredient_id === existing.ingredient_id)) {
              await appClient.entities.ProductIngredient.delete(existing.id);
            }
          }

          for (const si of currentSelectedIngredients) {
            const existing = existingProductIngredients.find(
              epi => epi.ingredient_id === si.ingredient_id
            );
            
            const ingredientPayload = {
              tenant_id: tenantId,
              product_id: savedProduct.id,
              ingredient_id: si.ingredient_id,
              quantite: parseNumber(si.quantite, 0),
              retirable: Boolean(si.retirable)
            };
            
            if (existing) {
              await appClient.entities.ProductIngredient.update(existing.id, ingredientPayload);
            } else {
              await appClient.entities.ProductIngredient.create(ingredientPayload);
            }
          }
        } catch (ingredientError) {
          console.warn('Étape ingrédients ignorée car le schéma Supabase n est pas encore complet:', ingredientError);
        }
      }

      // ÉTAPE 4: Succès
      toast({
        title: "Produit enregistré",
        description: `Le produit "${productPayload.nom}" a été enregistré avec succès.`,
      });

      // Forcer le rafraîchissement des données via le parent
      if (onSave) {
        await onSave();
      }

    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'enregistrement.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="infos" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="ingredients">Ingrédients</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="space-y-6">
          {/* Informations de base */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations de base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom du produit *</Label>
                  <Input
                    id="nom"
                    value={productData.nom}
                    onChange={(e) => handleInputChange('nom', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie *</Label>
                  <Select value={productData.category_id} onValueChange={(value) => handleInputChange('category_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une catégorie..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={productData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temps_preparation">Temps de préparation (min)</Label>
                  <Input
                    id="temps_preparation"
                    type="number"
                    value={productData.temps_preparation}
                    onChange={(e) => handleInputChange('temps_preparation', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tva">TVA (%)</Label>
                  <Select value={String(productData.tva)} onValueChange={(value) => handleInputChange('tva', parseFloat(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(profile?.tva_rates || []).map((rate, index) => (
                        <SelectItem key={index} value={String(rate.rate)}>
                          {rate.rate}% - {rate.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Couleur</Label>
                  <Input
                    id="color"
                    type="color"
                    value={productData.color}
                    onChange={(e) => handleInputChange('color', e.target.value)}
                    className="h-10 p-1"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="disponible"
                  checked={productData.disponible}
                  onCheckedChange={(checked) => handleInputChange('disponible', checked)}
                />
                <Label htmlFor="disponible">Produit disponible</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="featured"
                  checked={productData.featured || false}
                  onCheckedChange={(checked) => handleInputChange('featured', checked)}
                />
                <Label htmlFor="featured" className="flex items-center gap-1">
                  <span className="text-amber-400">⭐</span> Mettre en avant sur le site vitrine
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Prix de vente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prix de vente (TTC)</CardTitle>
              <CardDescription>
                {managesSizes
                  ? "Cette catégorie utilise des tailles. Définissez un prix pour chaque taille."
                  : "Définissez le prix de vente du produit."}
                {prixDifferencies && (
                  <Badge className="ml-2 bg-blue-100 text-blue-800">Prix différenciés activés</Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {managesSizes ? (
                <div className="space-y-3">
                  {prixDifferencies ? (
                    <>
                      <Label>Prix par taille et par mode</Label>
                      <div className="grid grid-cols-4 gap-2 text-sm font-medium text-gray-600 mb-2">
                        <span>Taille</span>
                        <span>Sur place</span>
                        <span>Emporter</span>
                        <span>Livraison</span>
                      </div>
                      {productData.size_prices.map((sizePrice, index) => {
                        const modePrice = (productData.size_prix_par_mode || []).find(s => s.size === sizePrice.size) || {};
                        return (
                          <div key={`size-${sizePrice.size}-${index}`} className="grid grid-cols-4 gap-2 items-center">
                            <span className="font-medium">{sizePrice.size}</span>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                value={modePrice.sur_place || ''}
                                onChange={(e) => handleSizePrixParModeChange(sizePrice.size, 'sur_place', e.target.value)}
                                placeholder="0.00"
                                className="pr-6 text-sm"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">€</span>
                            </div>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                value={modePrice.emporter || ''}
                                onChange={(e) => handleSizePrixParModeChange(sizePrice.size, 'emporter', e.target.value)}
                                placeholder="0.00"
                                className="pr-6 text-sm"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">€</span>
                            </div>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.01"
                                value={modePrice.livraison || ''}
                                onChange={(e) => handleSizePrixParModeChange(sizePrice.size, 'livraison', e.target.value)}
                                placeholder="0.00"
                                className="pr-6 text-sm"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">€</span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <Label>Prix par taille</Label>
                      {productData.size_prices.map((sizePrice, index) => (
                        <div key={`size-${sizePrice.size}-${index}`} className="flex items-center gap-3">
                          <span className="w-24 font-medium">{sizePrice.size}</span>
                          <div className="flex-1 relative">
                            <Input
                              type="number"
                              step="0.01"
                              value={sizePrice.price ?? ''}
                              onChange={(e) => handleSizePriceChange(sizePrice.size, e.target.value)}
                              placeholder="0.00"
                              className="pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : prixDifferencies ? (
                <div className="space-y-3">
                  <Label>Prix par mode de commande</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-600">Sur place</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          value={productData.prix_par_mode?.sur_place || ''}
                          onChange={(e) => handlePrixParModeChange('sur_place', e.target.value)}
                          placeholder="0.00"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-600">Emporter</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          value={productData.prix_par_mode?.emporter || ''}
                          onChange={(e) => handlePrixParModeChange('emporter', e.target.value)}
                          placeholder="0.00"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-600">Livraison</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          value={productData.prix_par_mode?.livraison || ''}
                          onChange={(e) => handlePrixParModeChange('livraison', e.target.value)}
                          placeholder="0.00"
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="base_price">Prix du produit</Label>
                  <div className="relative">
                    <Input
                      id="base_price"
                      type="number"
                      step="0.01"
                      value={productData.base_price ?? ''}
                      onChange={(e) => handleInputChange('base_price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prix web */}
          <Card className="border-blue-100">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" />
                Prix site web (commande en ligne)
              </CardTitle>
              <CardDescription>
                Par défaut, le prix affiché en ligne est identique à la caisse. Activez cette option pour définir un prix web différent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={productData.use_custom_web_price}
                  onCheckedChange={(v) => handleInputChange('use_custom_web_price', v)}
                />
                <Label>Utiliser un prix web différent</Label>
              </div>

              {productData.use_custom_web_price && (
                managesSizes ? (
                  <div className="space-y-3">
                    <Label>Prix web par taille</Label>
                    {productData.size_prices.map((sizePrice) => {
                      const webSp = (productData.web_size_prices || []).find(s => s.size === sizePrice.size) || { size: sizePrice.size, price: sizePrice.price || 0 };
                      return (
                        <div key={sizePrice.size} className="flex items-center gap-3">
                          <span className="w-24 font-medium text-sm">{sizePrice.size}</span>
                          <span className="text-xs text-gray-400 w-28">Caisse: {Number(sizePrice.price || 0).toFixed(2)}€</span>
                          <div className="flex-1 relative">
                            <Input
                              type="number"
                              step="0.01"
                              value={webSp.price ?? ''}
                              onChange={(e) => {
                                const newVal = parseFloat(e.target.value) || 0;
                                setProductData(prev => {
                                  const existing = prev.web_size_prices || prev.size_prices.map(sp => ({ size: sp.size, price: sp.price || 0 }));
                                  const idx = existing.findIndex(s => s.size === sizePrice.size);
                                  if (idx >= 0) {
                                    const updated = [...existing];
                                    updated[idx] = { ...updated[idx], price: newVal };
                                    return { ...prev, web_size_prices: updated };
                                  }
                                  return { ...prev, web_size_prices: [...existing, { size: sizePrice.size, price: newVal }] };
                                });
                              }}
                              placeholder="Prix web"
                              className="pr-8 border-blue-200"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="web_price">Prix web du produit</Label>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">Caisse: <strong>{Number(productData.base_price || 0).toFixed(2)}€</strong></span>
                      <div className="relative w-40">
                        <Input
                          id="web_price"
                          type="number"
                          step="0.01"
                          value={productData.web_price ?? ''}
                          onChange={(e) => handleInputChange('web_price', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="pr-8 border-blue-200"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
                      </div>
                    </div>
                  </div>
                )
              )}

              {!productData.use_custom_web_price && (
                <p className="text-sm text-gray-400 italic">
                  Prix web = prix caisse ({managesSizes ? 'par taille' : `${Number(productData.base_price || 0).toFixed(2)}€`})
                </p>
              )}
            </CardContent>
          </Card>

          {/* Image du produit */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Image du produit</CardTitle>
              <p className="text-xs text-blue-600 font-medium">📐 Taille recommandée : 800x600 pixels (format paysage)</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {productData.image_url && (
                <div className="relative w-32 h-32">
                  <img src={productData.image_url} alt="Produit" className="w-full h-full object-cover rounded-lg border" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={() => handleInputChange('image_url', '')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('image-upload').click()}
                    disabled={isUploadingImage || isGeneratingImage}
                  >
                    {isUploadingImage ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Chargement...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" />Télécharger une image</>
                    )}
                  </Button>
                  {aiImageEnabled && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor="ai-perspective" className="text-sm mb-1.5 block">Perspective de la photo</Label>
                        <Select value={aiImagePerspective} onValueChange={setAiImagePerspective}>
                          <SelectTrigger id="ai-perspective" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="frontal">📷 De face (face à la caméra)</SelectItem>
                            <SelectItem value="angled">🎲 En angle (vue 3D - parfait pour pizza)</SelectItem>
                            <SelectItem value="side">👈 De côté (profil)</SelectItem>
                            <SelectItem value="topdown">⬇️ De dessus (vue d'en haut)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGenerateAiImage}
                        disabled={isGeneratingImage || isUploadingImage || !productData.nom}
                        className="border-purple-300 text-purple-700 hover:bg-purple-50"
                      >
                        {isGeneratingImage ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Génération...</>
                        ) : (
                          <><Wand2 className="w-4 h-4 mr-2" />Générer</>  
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {productData.image_url && (
                <div className="space-y-2 pt-3 border-t">
                  <Label>Afficher l'image sur :</Label>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { value: 'caisse', label: 'Caisse' },
                      { value: 'borne', label: 'Borne' },
                      { value: 'web', label: 'Site web' },
                    ].map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`display-${opt.value}`}
                          checked={(productData.image_display || []).includes(opt.value)}
                          onCheckedChange={(checked) => {
                            const current = productData.image_display || [];
                            const updated = checked
                              ? [...current, opt.value]
                              : current.filter(v => v !== opt.value);
                            handleInputChange('image_display', updated);
                          }}
                        />
                        <Label htmlFor={`display-${opt.value}`} className="cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingredients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Composition & Ingrédients</CardTitle>
              <CardDescription>
                Définissez les ingrédients composant ce produit. Utile pour la gestion des stocks et pour permettre aux clients de retirer des ingrédients.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedIngredients.length > 0 ? (
                selectedIngredients.map((ingredient, index) => {
                  const ingredientData = ingredient.ingredient || ingredients.find(i => i.id === ingredient.ingredient_id);
                  
                  return (
                    <div key={`ing-${index}-${ingredient.ingredient_id}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Select
                        value={ingredient.ingredient_id}
                        onValueChange={(value) => handleIngredientChange(index, 'ingredient_id', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Choisir un ingrédient..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ingredients.map(ing => (
                            <SelectItem key={ing.id} value={ing.id}>
                              {ing.nom} ({ing.unite})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          value={ingredient.quantite}
                          onChange={(e) => handleIngredientChange(index, 'quantite', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>

                      {ingredientData && (
                        <span className="text-sm text-gray-600 w-12">{ingredientData.unite}</span>
                      )}

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={ingredient.retirable}
                          onCheckedChange={(checked) => handleIngredientChange(index, 'retirable', checked)}
                        />
                        <span className="text-xs text-gray-600 whitespace-nowrap">Retirable</span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeIngredient(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-gray-500 border-2 border-dashed rounded-lg">
                  <p className="text-sm">Aucun ingrédient ajouté</p>
                </div>
              )}

              <Button type="button" variant="outline" onClick={addIngredient} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un ingrédient
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="options" className="space-y-6">
          {product?.id ? (
            <ProductOptionsManager 
              productId={product.id}
              withTenant={withTenant}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <p>Enregistrez d'abord le produit pour pouvoir gérer ses options.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            product?.id ? "Mettre à jour" : "Créer le produit"
          )}
        </Button>
      </div>
    </form>
  );
}
