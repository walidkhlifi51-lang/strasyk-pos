
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ShoppingCart } from "lucide-react";

export default function TopProducts({ orders }) {
  const getTopProducts = () => {
    if (!orders || orders.length === 0) {
        return [];
    }

    const productStats = {};
    
    orders.forEach(order => {
      // CORRECTION : S'assurer que 'articles' est bien un tableau avant de le parcourir.
      if (Array.isArray(order.articles)) {
        order.articles.forEach(article => {
          if (!productStats[article.product_id]) {
            productStats[article.product_id] = {
              nom: article.nom_produit,
              quantite_vendue: 0,
              chiffre_affaires: 0
            };
          }
          productStats[article.product_id].quantite_vendue += article.quantite || 0;
          productStats[article.product_id].chiffre_affaires += article.total_ligne || 0;
        });
      }
    });

    return Object.entries(productStats)
      .map(([id, stats]) => ({ id, ...stats }))
      .sort((a, b) => b.quantite_vendue - a.quantite_vendue)
      .slice(0, 8);
  };

  const topProducts = getTopProducts();

  const getRankColor = (index) => {
    switch (index) {
      case 0: return "bg-gradient-to-r from-yellow-400 to-yellow-500";
      case 1: return "bg-gradient-to-r from-gray-300 to-gray-400";
      case 2: return "bg-gradient-to-r from-amber-600 to-amber-700";
      default: return "bg-gradient-to-r from-blue-500 to-blue-600";
    }
  };

  const getRankIcon = (index) => {
    if (index < 3) return <Trophy className="w-4 h-4 text-white" />;
    return <ShoppingCart className="w-4 h-4 text-white" />;
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-orange-500" />
          Top Produits
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topProducts.length > 0 ? (
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getRankColor(index)}`}>
                    {index < 3 ? (
                      <span className="text-white font-bold text-sm">
                        {index + 1}
                      </span>
                    ) : (
                      <span className="text-white font-bold text-xs">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {product.nom}
                    </p>
                    <p className="text-sm text-gray-600">
                      CA: {product.chiffre_affaires.toFixed(2)}€
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    {product.quantite_vendue} vendus
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune vente sur cette période</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

