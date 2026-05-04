import React, { useState, useEffect } from 'react';
import { Truck, Phone, MapPin, Clock, CheckCircle, Package, Navigation, Loader2 } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DeliveryApp() {
  const { currentUser, deliveryPerson } = useTenant();
  const [searchOrderNumber, setSearchOrderNumber] = useState('');
  const queryClient = useQueryClient();

  // Charger la commande active du livreur
  const { data: currentOrder, isLoading: orderLoading } = useQuery({
    queryKey: ['currentDeliveryOrder', deliveryPerson?.id],
    queryFn: async () => {
      if (!deliveryPerson) return null;
      const orders = await appClient.entities.Order.filter({
        delivery_person_id: deliveryPerson.id,
        statut: 'en_cours_de_livraison'
      });
      return orders.length > 0 ? orders[0] : null;
    },
    enabled: !!deliveryPerson,
    refetchInterval: 15000, // Rafraichir toutes les 15 secondes
  });

  // Charger les infos client si commande active
  const { data: customer } = useQuery({
    queryKey: ['customer', currentOrder?.customer_id],
    queryFn: async () => {
      if (!currentOrder?.customer_id) return null;
      const customers = await appClient.entities.Customer.filter({ id: currentOrder.customer_id });
      return customers.length > 0 ? customers[0] : null;
    },
    enabled: !!currentOrder?.customer_id,
  });

  // Mutation pour prendre une nouvelle commande
  const assignOrderMutation = useMutation({
    mutationFn: async (orderNumber) => {
      const orders = await appClient.entities.Order.filter({
        numero_caisse: parseInt(orderNumber),
        type_commande: 'livraison',
        statut: 'prete'
      });

      if (orders.length === 0) {
        throw new Error('Commande introuvable ou pas prete');
      }

      const order = orders[0];
      await appClient.entities.Order.update(order.id, {
        delivery_person_id: deliveryPerson.id,
        statut: 'en_cours_de_livraison'
      });

      await appClient.entities.DeliveryPerson.update(deliveryPerson.id, {
        en_livraison: true
      });

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentDeliveryOrder'] });
      setSearchOrderNumber('');
    },
  });

  // Mutation pour confirmer la livraison
  const confirmDeliveryMutation = useMutation({
    mutationFn: async () => {
      const shouldCountAsDriverCash = !currentOrder.payee;

      await appClient.entities.Order.update(currentOrder.id, {
        statut: 'livree',
        payee: currentOrder.payee
      });

      await appClient.entities.DeliveryPerson.update(deliveryPerson.id, {
        en_livraison: false,
        nb_livraisons_jour: (deliveryPerson.nb_livraisons_jour || 0) + 1,
        total_encaisse: (deliveryPerson.total_encaisse || 0) + (shouldCountAsDriverCash ? (currentOrder.total_ttc || 0) : 0)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentDeliveryOrder'] });
    },
  });

  const handleAssignOrder = () => {
    if (!searchOrderNumber) return;
    assignOrderMutation.mutate(searchOrderNumber);
  };

  const handleConfirmDelivery = () => {
    confirmDeliveryMutation.mutate();
  };

  if (!deliveryPerson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-blue-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Acces refuse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-700">
              Vous n'etes pas enregistre comme livreur. Contactez votre manager.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orderLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-blue-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* En-tete livreur */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-orange-500 to-blue-500 text-white">
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-6 h-6" />
              {deliveryPerson.prenom} {deliveryPerson.nom}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Livraisons aujourd'hui</p>
                <p className="text-2xl font-bold text-orange-600">
                  {deliveryPerson.nb_livraisons_jour || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total encaisse</p>
                <p className="text-2xl font-bold text-green-600">
                  {(deliveryPerson.total_encaisse || 0).toFixed(2)} EUR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commande en cours */}
        {currentOrder ? (
          <Card>
            <CardHeader className="bg-blue-50">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Commande #{currentOrder.numero_caisse}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {customer && (
                <>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-500 mt-1" />
                    <div>
                      <p className="font-semibold">{customer.prenom} {customer.nom}</p>
                      <p className="text-gray-600">{customer.telephone}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-500 mt-1" />
                    <div>
                      <p className="font-semibold">Adresse</p>
                      <p className="text-gray-600">{customer.adresse}</p>
                      {customer.etage && <p className="text-sm text-gray-500">Etage: {customer.etage}</p>}
                      {customer.interphone && <p className="text-sm text-gray-500">Interphone: {customer.interphone}</p>}
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-500 mt-1" />
                <div>
                  <p className="font-semibold">Montant a encaisser</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {currentOrder.total_ttc.toFixed(2)} EUR
                  </p>
                  <p className="text-sm text-gray-500">
                    Mode: {currentOrder.mode_paiement_prevu || 'Non specifie'}
                  </p>
                </div>
              </div>

              {currentOrder.notes && (
                <div className="p-3 bg-yellow-50 rounded-md">
                  <p className="text-sm font-semibold text-gray-700">Notes:</p>
                  <p className="text-sm text-gray-600">{currentOrder.notes}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer?.adresse || '')}`)}
                  variant="outline"
                  className="flex-1"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  GPS
                </Button>
                <Button
                  onClick={handleConfirmDelivery}
                  disabled={confirmDeliveryMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {confirmDeliveryMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Livraison effectuee
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Prendre une nouvelle livraison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orderNumber">Numero de commande</Label>
                <Input
                  id="orderNumber"
                  type="number"
                  placeholder="Ex: 42"
                  value={searchOrderNumber}
                  onChange={(e) => setSearchOrderNumber(e.target.value)}
                />
              </div>

              {assignOrderMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">
                    {assignOrderMutation.error.message}
                  </p>
                </div>
              )}

              <Button
                onClick={handleAssignOrder}
                disabled={!searchOrderNumber || assignOrderMutation.isPending}
                className="w-full"
              >
                {assignOrderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Package className="w-4 h-4 mr-2" />
                )}
                Prendre cette commande
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
