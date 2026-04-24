import React from "react";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calculateOfferDiscounts } from "@/utils/offerUtils";

export default function KioskCart({ cart, onUpdateQuantity, onRemoveItem, onValidate, offers = [], orderType = 'emporter', products = [] }) {
  const baseTotal = cart.reduce((sum, item) => sum + item.prix_unitaire * item.quantite, 0);
  const offerDiscounts = calculateOfferDiscounts(cart, offers, orderType, products);
  const offerDiscountTotal = offerDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const total = Math.max(0, baseTotal + offerDiscountTotal);

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <ShoppingBag className="w-24 h-24 mb-4" />
        <p className="text-xl font-medium">Votre panier est vide</p>
        <p className="text-sm">Sélectionnez des produits pour commencer</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-orange-50">
        <h2 className="text-2xl font-bold text-gray-800">Votre commande</h2>
        <p className="text-sm text-gray-600">{cart.length} article(s)</p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {cart.map((item, index) => (
            <div key={index} className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{item.nom_produit}</h3>
                  {item.selectedSize && (
                    <p className="text-sm text-gray-600">Taille: {item.selectedSize}</p>
                  )}
                  {item.selectedOptions?.length > 0 && (
                    <p className="text-xs text-gray-500">
                      + {item.selectedOptions.map(o => o.nom).join(", ")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-gray-500 italic">Note: {item.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveItem(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onUpdateQuantity(index, item.quantite - 1)}
                    disabled={item.quantite <= 1}
                    className="h-10 w-10"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-xl font-bold w-12 text-center">{item.quantite}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onUpdateQuantity(index, item.quantite + 1)}
                    className="h-10 w-10"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{item.prix_unitaire.toFixed(2)} € × {item.quantite}</p>
                  <p className="text-xl font-bold text-orange-600">
                    {(item.prix_unitaire * item.quantite).toFixed(2)} €
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-white">
        <div className="mb-4">
          {offerDiscounts.length > 0 && (
            <div className="space-y-1 mb-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Sous-total</span>
                <span>{baseTotal.toFixed(2)} €</span>
              </div>
              {offerDiscounts.map(d => (
                <div key={d.id} className="flex justify-between text-sm font-semibold text-purple-600">
                  <span>🎁 {d.name}</span>
                  <span>{d.amount.toFixed(2)} €</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between text-2xl font-bold">
            <span>Total</span>
            <span className="text-orange-600">{total.toFixed(2)} €</span>
          </div>
        </div>
        <Button
          onClick={onValidate}
          className="w-full h-16 text-xl font-bold bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
          disabled={cart.length === 0}
        >
          Valider la commande
        </Button>
      </div>
    </div>
  );
}
