
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Bike, CheckCircle, Clock } from 'lucide-react';

export default function DeliveryPersonStatus({ deliveryPeople, orders }) {

  const getDeliveryPersonOrder = (deliveryPersonId) => {
    return orders.find(o => o.delivery_person_id === deliveryPersonId && o.statut === 'en_cours_de_livraison');
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5" />
          Statut des Livreurs
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {deliveryPeople.length > 0 ? (
          deliveryPeople.map(dp => {
            const currentOrder = getDeliveryPersonOrder(dp.id);
            return (
              <div key={dp.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <p className="font-semibold flex items-center gap-2">
                    <Bike className="w-4 h-4 text-gray-500" />
                    {dp.prenom} {dp.nom}
                  </p>
                  {dp.disponible ? (
                    <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Disponible
                    </Badge>
                  ) : dp.en_livraison ? (
                    <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      En livraison
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Indisponible</Badge>
                  )}
                </div>
                {currentOrder && (
                  <div className="mt-2 text-xs text-gray-600 border-t pt-2">
                    Commande: #{currentOrder.numero_commande?.slice(-6) || '...'}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-4 text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Aucun livreur enregistré</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

