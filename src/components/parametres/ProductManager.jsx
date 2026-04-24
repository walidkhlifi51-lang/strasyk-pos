import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Package, Search, Loader2, Layers, Star, ArrowUp, ArrowDown } from "lucide-react";
import { appClient } from '@/api/appClient';
import ProductForm from "./ProductForm";
import ProductOptionsManager from "./ProductOptionsManager";
import { useToast } from "@/components/ui/use-toast";

export default function ProductManager({ data, onDataChange }) {
  const { toast } = useToast();
  
  // Utiliser les données passées en props avec des valeurs par défaut
  const products = data?.products || [];
  const categories = data?.categories || [];
  const ingredients = data?.ingredients || [];
  const profile = data?.profile || null;

  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [productForOptions, setProductForOptions] = useState(null);

  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return [];
    // If categories is not an array, we can still filter by product name,
    // but category-based filtering won't work.
    const validCategories = Array.isArray(categories) ? categories : [];
    
    return products.filter(product => {
      if (!product) return false; // Ensure product itself is not null/undefined
      const matchesSearch = !searchTerm || 
        (product.nom && product.nom.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (validCategories.find(c => c.id === product.category_id)?.nom?.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    }).sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
  }, [products, categories, searchTerm]);

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowDialog(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setShowDialog(true);
  };

  const handleManageOptions = (product) => {
    setProductForOptions(product);
    setShowOptionsDialog(true);
  };

  const handleSaveComplete = async () => {
    // Fermer le dialog
    setShowDialog(false);
    setEditingProduct(null);
    
    // Rafraîchir les données
    await onDataChange();
  };

  const handleDeleteProduct = async (productId) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce produit et toutes ses options de personnalisation ?")) {
      try {
        const groupsToDelete = await appClient.entities.OptionGroup.filter({ product_id: productId });
        for (const group of groupsToDelete) {
          const itemsToDelete = await appClient.entities.OptionItem.filter({ option_group_id: group.id });
          for (const item of itemsToDelete) {
            await appClient.entities.OptionItem.delete(item.id);
          }
          await appClient.entities.OptionGroup.delete(group.id);
        }

        const productIngredientsToDelete = await appClient.entities.ProductIngredient.filter({ product_id: productId });
        for (const prodIng of productIngredientsToDelete) {
          await appClient.entities.ProductIngredient.delete(prodIng.id);
        }

        await appClient.entities.Product.delete(productId);
        
        await onDataChange(); // Utiliser le callback du parent

        toast({
          title: "Produit supprimé",
          description: "Le produit a été supprimé avec succès.",
        });
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        toast({
          title: "Erreur",
          description: "Échec de la suppression du produit.",
          variant: "destructive",
        });
      }
    }
  };

  const toggleAvailability = async (product) => {
    try {
      await appClient.entities.Product.update(product.id, { disponible: !product.disponible });
      await onDataChange(); // Utiliser le callback du parent
      toast({
        title: "Disponibilité mise à jour",
        description: `Le produit "${product.nom}" est maintenant ${product.disponible ? "indisponible" : "disponible"}.`,
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast({
        title: "Erreur",
        description: "Échec de la mise à jour de la disponibilité.",
        variant: "destructive",
      });
    }
  };

  const handleToggleFeatured = async (product) => {
    await appClient.entities.Product.update(product.id, { featured: !product.featured });
    await onDataChange();
  };

  const handleMoveProduct = async (product, direction) => {
    const allSorted = [...products].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
    const withOrder = allSorted.map((p, i) => ({ ...p, sort_order: p.sort_order ?? i }));
    const currentIndex = withOrder.findIndex(p => p.id === product.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= withOrder.length) return;
    await appClient.entities.Product.update(withOrder[currentIndex].id, { sort_order: withOrder[swapIndex].sort_order });
    await appClient.entities.Product.update(withOrder[swapIndex].id, { sort_order: withOrder[currentIndex].sort_order });
    await onDataChange();
  };

  const getDisplayPrice = (product) => {
    // Vérifier les prix par mode (si prix différenciés activés)
    if (product.prix_par_mode) {
      const prices = [
        product.prix_par_mode.sur_place,
        product.prix_par_mode.emporter,
        product.prix_par_mode.livraison
      ].filter(p => p !== null && p !== undefined && !isNaN(p) && p > 0);
      
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        return `dès ${minPrice.toFixed(2)}€`;
      }
    }

    // Vérifier les prix par taille
    if (product.size_prices && product.size_prices.length > 0) {
      const validPrices = product.size_prices
        .map(p => p.price)
        .filter(p => p !== null && p !== undefined && !isNaN(p) && p > 0);
      
      if (validPrices.length > 0) {
        const minPrice = Math.min(...validPrices);
        return `dès ${minPrice.toFixed(2)}€`;
      }
    }

    // Vérifier les prix par taille et mode
    if (product.size_prix_par_mode && product.size_prix_par_mode.length > 0) {
      const allPrices = [];
      product.size_prix_par_mode.forEach(sp => {
        if (sp.sur_place) allPrices.push(sp.sur_place);
        if (sp.emporter) allPrices.push(sp.emporter);
        if (sp.livraison) allPrices.push(sp.livraison);
      });
      
      const validPrices = allPrices.filter(p => p !== null && p !== undefined && !isNaN(p) && p > 0);
      if (validPrices.length > 0) {
        const minPrice = Math.min(...validPrices);
        return `dès ${minPrice.toFixed(2)}€`;
      }
    }

    // Prix de base
    if (product.base_price !== undefined && product.base_price !== null && !isNaN(product.base_price) && product.base_price > 0) {
      return `${product.base_price.toFixed(2)}€`;
    }

    // Ancien champ prix (legacy)
    if (product.prix !== undefined && product.prix !== null && !isNaN(product.prix) && product.prix > 0) {
      return `${product.prix.toFixed(2)}€`;
    }

    return '0.00€';
  };

  // Afficher un loader seulement si les données ne sont pas encore chargées
  const isLoading = !data;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <span className="sr-only">Chargement des produits...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500" />
            Gestion des Produits
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {products.length} produits • {products.filter(p => p.disponible).length} disponibles
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handleAddProduct} className="bg-orange-500 hover:bg-orange-600 gap-2">
            <Plus className="w-4 h-4" />
            Nouveau Produit
          </Button>
        </div>
      </div>

      {/* Liste des produits */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: product.color || '#eeeeee' }}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: product.color || '#eeeeee' }}></div>
                      <CardTitle className="text-lg">{product.nom}</CardTitle>
                      {product.featured && <span className="text-amber-400 text-base" title="Mis en avant">⭐</span>}
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {categories.find(c => c.id === product.category_id)?.nom || 'N/A'}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-orange-600">{getDisplayPrice(product)}</p>
                    {product.temps_preparation && (
                      <p className="text-xs text-gray-500">{product.temps_preparation} min</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {product.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={product.disponible !== false}
                      onCheckedChange={() => toggleAvailability(product)}
                      size="sm"
                    />
                    <span className="text-xs">
                      {product.disponible !== false ? "Disponible" : "Indisponible"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleEditProduct(product)} className="flex-1">
                      <Pencil className="w-4 h-4 mr-1" />Modifier
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleManageOptions(product)} className="flex-1">
                      <Layers className="w-4 h-4 mr-1" />Options
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleMoveProduct(product, 'up')} className="flex-1" title="Monter">
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleMoveProduct(product, 'down')} className="flex-1" title="Descendre">
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleFeatured(product)}
                      className={`flex-1 ${product.featured ? 'text-amber-500 border-amber-300 bg-amber-50' : 'text-gray-400'}`}
                      title={product.featured ? 'Retirer de la mise en avant' : 'Mettre en avant'}
                    >
                      <Star className="w-4 h-4" fill={product.featured ? 'currentColor' : 'none'} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>
            {searchTerm
              ? `Aucun produit trouvé pour "${searchTerm}"`
              : "Aucun produit configuré"
            }
          </p>
          {!searchTerm && (
            <p className="text-sm">Commencez par ajouter vos premiers produits</p>
          )}
        </div>
      )}

      {/* Dialog de création/édition de produit */}
      {showDialog && (
        <Dialog open={showDialog} onOpenChange={(open) => {
          if (!open) {
            setShowDialog(false);
            setEditingProduct(null);
          }
        }}>
          <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                  {editingProduct ? "Modifier le produit" : "Nouveau produit"}
                  <Badge className="bg-green-100 text-green-800">Configuration complète</Badge>
                  </DialogTitle>
              </DialogHeader>
              <ProductForm
                product={editingProduct}
                categories={categories}
                ingredients={ingredients}
                profile={profile}
                onSave={handleSaveComplete}
                onCancel={() => {
                  setShowDialog(false);
                  setEditingProduct(null);
                }}
                onUpdateCategories={onDataChange}
              />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de gestion des options de produit */}
      {showOptionsDialog && productForOptions && (
        <Dialog open={showOptionsDialog} onOpenChange={(open) => {
          if (!open) {
            setShowOptionsDialog(false);
            setProductForOptions(null);
          }
        }}>
          <DialogContent className="sm:max-w-6xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Options - {productForOptions.nom}</DialogTitle>
            </DialogHeader>
            <ProductOptionsManager productId={productForOptions.id} onSave={() => onDataChange()} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
