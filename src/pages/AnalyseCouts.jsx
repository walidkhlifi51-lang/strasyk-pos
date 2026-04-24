
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, Loader2, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AnalyseCouts() {
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { filterByTenant } = useTenant();

    // MODIFICATION: Retirer staleTime pour forcer le rechargement
    const { data: products = [], isLoading: loadingProducts, refetch: refetchProducts } = useQuery({
        queryKey: ['products'],
        queryFn: () => appClient.entities.Product.filter(filterByTenant()),
        refetchOnWindowFocus: true,
    });

    const { data: categories = [], isLoading: loadingCategories, refetch: refetchCategories } = useQuery({
        queryKey: ['categories'],
        queryFn: () => appClient.entities.Category.filter(filterByTenant()),
        refetchOnWindowFocus: true,
    });

    const { data: ingredients = [], isLoading: loadingIngredients, refetch: refetchIngredients } = useQuery({
        queryKey: ['ingredients'],
        queryFn: () => appClient.entities.Ingredient.filter(filterByTenant()),
        refetchOnWindowFocus: true,
    });

    const { data: productIngredients = [], isLoading: loadingProductIngredients, refetch: refetchProductIngredients } = useQuery({
        queryKey: ['productIngredients'],
        queryFn: () => appClient.entities.ProductIngredient.filter(filterByTenant()),
        refetchOnWindowFocus: true,
    });

    // NOUVEAU: Fonction de rafraîchissement améliorée
    const handleRefresh = async () => {
        try {
            // Forcer le rechargement de toutes les données
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['products'] }),
                queryClient.invalidateQueries({ queryKey: ['categories'] }),
                queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
                queryClient.invalidateQueries({ queryKey: ['productIngredients'] }),
            ]);
            
            // Refetch explicite pour être sûr
            await Promise.all([
                refetchProducts(),
                refetchCategories(),
                refetchIngredients(),
                refetchProductIngredients(),
            ]);
            
            toast({
                title: "Données actualisées",
                description: "L'analyse des coûts a été mise à jour avec les dernières données.",
            });
        } catch (error) {
            console.error("Failed to refresh data:", error);
            toast({
                title: "Erreur",
                description: "Impossible d'actualiser les données. Veuillez réessayer.",
                variant: "destructive",
            });
        }
    };

    const productsWithCosts = useMemo(() => {
        if (!products.length || !categories.length) {
            return [];
        }

        return products.map(product => {
            const productIngrs = productIngredients.filter(pi => pi && pi.product_id === product.id);
            
            let coutRevient = 0;
            const detailsIngredients = [];

            productIngrs.forEach(pi => {
                const ingredient = ingredients.find(ing => ing && ing.id === pi.ingredient_id);
                if (ingredient && ingredient.cout_unitaire != null && ingredient.cout_unitaire > 0) {
                    const coutIngredient = pi.quantite * ingredient.cout_unitaire;
                    coutRevient += coutIngredient;
                    detailsIngredients.push({
                        nom: ingredient.nom,
                        quantite: pi.quantite,
                        unite: ingredient.unite,
                        cout_unitaire: ingredient.cout_unitaire,
                        cout_total: coutIngredient
                    });
                }
            });

            let prixVente = 0;
            if (product.size_prices && product.size_prices.length > 0) {
                const prices = product.size_prices.map(sp => sp.price).filter(p => p != null && !isNaN(p));
                if (prices.length > 0) {
                    prixVente = Math.min(...prices);
                }
            } else if (product.base_price != null && !isNaN(product.base_price)) {
                prixVente = product.base_price;
            } else if (product.prix != null && !isNaN(product.prix)) {
                prixVente = product.prix;
            }

            const margeEuros = prixVente - coutRevient;
            const margePourcentage = prixVente > 0 ? (margeEuros / prixVente) * 100 : 0;

            const category = categories.find(c => c && c.id === product.category_id);

            return {
                ...product,
                coutRevient,
                prixVente,
                margeEuros,
                margePourcentage,
                detailsIngredients,
                categoryNom: category?.nom || 'Sans catégorie',
                hasIngredients: productIngrs.length > 0,
                hasCostData: productIngrs.length > 0 && detailsIngredients.length > 0
            };
        });
    }, [products, ingredients, productIngredients, categories]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return productsWithCosts;
        const term = searchTerm.toLowerCase();
        return productsWithCosts.filter(p => 
            (p.nom && p.nom.toLowerCase().includes(term)) ||
            (p.categoryNom && p.categoryNom.toLowerCase().includes(term))
        );
    }, [productsWithCosts, searchTerm]);

    const stats = useMemo(() => {
        const produitsAvecCouts = filteredProducts.filter(p => p.hasCostData);
        const totalProduits = filteredProducts.length;
        const produitsAvecIngredients = produitsAvecCouts.length;
        const produitsSansIngredients = totalProduits - produitsAvecIngredients;
        const margeMoyenne = produitsAvecCouts.length > 0 
            ? produitsAvecCouts.reduce((sum, p) => sum + p.margePourcentage, 0) / produitsAvecCouts.length 
            : 0;
        const produitsFaibleMarge = produitsAvecCouts.filter(p => p.margePourcentage < 30).length;

        return {
            totalProduits,
            produitsAvecIngredients,
            produitsSansIngredients,
            margeMoyenne,
            produitsFaibleMarge
        };
    }, [filteredProducts]);

    const isLoading = loadingProducts || loadingCategories || loadingIngredients || loadingProductIngredients;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-8 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
                    <p className="text-gray-600">Chargement de l'analyse des coûts...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Calculator className="w-8 h-8 text-orange-500" />
                            Analyse des Coûts de Revient
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Analysez la rentabilité de vos produits
                        </p>
                    </div>
                    <Button 
                        onClick={handleRefresh}
                        variant="outline"
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Actualiser
                    </Button>
                </div>

                {stats.produitsSansIngredients > 0 && (
                    <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-yellow-900">
                                        {stats.produitsSansIngredients} produit{stats.produitsSansIngredients > 1 ? 's' : ''} sans ingrédients configurés
                                    </p>
                                    <p className="text-sm text-yellow-700 mt-1">
                                        Pour calculer les coûts, allez dans Paramètres → Produits et configurez les ingrédients utilisés pour chaque produit.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600">Total Produits</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.totalProduits}</div>
                            <p className="text-xs text-gray-500 mt-1">produits au catalogue</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600">Avec Ingrédients</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-blue-600">{stats.produitsAvecIngredients}</div>
                            <p className="text-xs text-gray-500 mt-1">coûts calculables</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600">Marge Moyenne</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-600">
                                {stats.margeMoyenne.toFixed(1)}%
                            </div>
                            <p className="text-xs text-gray-500 mt-1">sur tous les produits</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-gray-600">Faible Marge</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-orange-600">{stats.produitsFaibleMarge}</div>
                            <p className="text-xs text-gray-500 mt-1">produits &lt; 30% marge</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Liste des Produits</CardTitle>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    placeholder="Rechercher un produit..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produit</TableHead>
                                    <TableHead>Catégorie</TableHead>
                                    <TableHead className="text-right">Prix Vente</TableHead>
                                    <TableHead className="text-right">Coût Revient</TableHead>
                                    <TableHead className="text-right">Marge (€)</TableHead>
                                    <TableHead className="text-right">Marge (%)</TableHead>
                                    <TableHead className="text-center">Statut</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                            {searchTerm ? `Aucun produit trouvé pour "${searchTerm}"` : 'Aucun produit disponible'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProducts.map(product => (
                                        <TableRow key={product.id} className="hover:bg-gray-50">
                                            <TableCell className="font-medium">{product.nom}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{product.categoryNom}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {product.prixVente > 0 ? `${product.prixVente.toFixed(2)}€` : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {product.hasCostData ? `${product.coutRevient.toFixed(2)}€` : 
                                                    <span className="text-gray-400 text-sm">Non configuré</span>
                                                }
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {product.hasCostData ? (
                                                    <span className={product.margeEuros >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {product.margeEuros.toFixed(2)}€
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                {product.hasCostData ? (
                                                    <span className={
                                                        product.margePourcentage >= 50 ? 'text-green-600' :
                                                        product.margePourcentage >= 30 ? 'text-yellow-600' :
                                                        'text-red-600'
                                                    }>
                                                        {product.margePourcentage.toFixed(1)}%
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {product.hasCostData ? (
                                                    product.margePourcentage >= 50 ? (
                                                        <Badge className="bg-green-100 text-green-800">Excellent</Badge>
                                                    ) : product.margePourcentage >= 30 ? (
                                                        <Badge className="bg-yellow-100 text-yellow-800">Correct</Badge>
                                                    ) : (
                                                        <Badge className="bg-red-100 text-red-800">Faible</Badge>
                                                    )
                                                ) : (
                                                    <Badge variant="outline" className="text-gray-500">
                                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                                        À configurer
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

