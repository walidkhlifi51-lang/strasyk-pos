import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Truck, MapPin, User, Phone, Clock, Package, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import DeliveryPersonStatus from '../components/livraisons/DeliveryPersonStatus';
import QRCode from 'qrcode';

const OrderCard = ({ order, customer, deliveryPeople, onAssignDelivery, showAssignButton = false }) => {
  const customerDisplayName = customer ? `${customer.prenom || ''} ${customer.nom || ''}`.trim() : (order.customer_name || 'Client');
  const customerDisplayAddress = order.delivery_address || customer?.adresse || null;

  const getOrderTypeColor = (type) => {
    switch (type) {
      case 'sur_place': return 'bg-blue-500';
      case 'emporter': return 'bg-orange-500';
      case 'livraison': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const assignedDriver = order.delivery_person_id ? 
    deliveryPeople.find(dp => dp.id === order.delivery_person_id) : null;

  return (
    <Card className="mb-3 shadow-md border-l-4 border-l-purple-500">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <Badge className={`${getOrderTypeColor(order.type_commande)} text-white`}>
              {order.type_commande === 'livraison' ? 'LIV' : order.type_commande === 'emporter' ? 'EMP' : 'SP'}
            </Badge>
            <span className="font-bold text-lg">
              #{order.numero_caisse || order.numero_commande?.slice(-4) || 'N/A'}
            </span>
          </div>
          <Badge className={order.payee ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
            {order.payee ? 'Payée' : 'À payer'}
          </Badge>
        </div>

        {assignedDriver && (
          <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">
                Assigné à : {assignedDriver.prenom} {assignedDriver.nom}
              </span>
              <Badge variant="outline" className="text-xs">
                {assignedDriver.vehicule}
              </Badge>
            </div>
          </div>
        )}

        {customer && (
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{customerDisplayName}</span>
            </div>
            {customer.telephone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{customer.telephone}</span>
              </div>
            )}
            {customerDisplayAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                <div className="text-sm">
                  <div>{customerDisplayAddress}</div>
                  <div>{customer.code_postal} {customer.ville}</div>
                  {customer.etage && <div className="text-xs text-gray-600">Étage: {customer.etage}</div>}
                  {customer.interphone && <div className="text-xs text-gray-600">Interphone: {customer.interphone}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {!customer && (order.customer_name || order.delivery_address) && (
          <div className="space-y-2 mb-3">
            {order.customer_name && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{order.customer_name}</span>
              </div>
            )}
            {order.delivery_address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                <div className="text-sm">
                  <div>{order.delivery_address}</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm">
                {order.created_date ? format(new Date(order.created_date), 'HH:mm', { locale: fr }) : 'N/A'}
              </span>
            </div>
            <span className="font-bold text-green-600">
              {order.total_ttc?.toFixed(2) || '0.00'}€
            </span>
          </div>

          {(showAssignButton || assignedDriver) && order.statut !== 'livree' && (
            <Button 
              onClick={() => onAssignDelivery(order)} 
              size="sm"
              variant={assignedDriver ? "outline" : "default"}
              className={assignedDriver ? "border-purple-500 text-purple-600 hover:bg-purple-50" : "bg-purple-600 hover:bg-purple-700"}
            >
              {assignedDriver ? 'Réassigner' : 'Assigner'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function Livraisons() {
  const { filterByTenant, withTenant, currentTenant } = useTenant();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [assignmentModal, setAssignmentModal] = useState({ isOpen: false, order: null });

  const isDeliveryOrder = useCallback((order) => {
    if (!order) return false;
    if (order.type_commande === 'livraison') return true;
    if (order.delivery_person_id) return true;
    if (order.delivery_address && order.type_commande !== 'sur_place') return true;
    return false;
  }, []);

  const organizeColumns = (dayDeliveryOrders) => {
    return {
      pending: { 
        id: 'pending', 
        title: "En attente d'assignation", 
        orders: dayDeliveryOrders.filter(o => !o.delivery_person_id && o.statut !== 'livree') 
      },
      assigned: { 
        id: 'assigned', 
        title: 'Assignées', 
        orders: dayDeliveryOrders.filter(o => o.delivery_person_id && o.statut !== 'livree') 
      },
      delivered: { 
        id: 'delivered', 
        title: 'Livrées', 
        orders: dayDeliveryOrders.filter(o => o.statut === 'livree') 
      }
    };
  };

  const fetchDeliveryData = useCallback(async () => {
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

    const toParisDateStr = (dateStr) => {
      const normalized = dateStr.replace(' ', 'T');
      const d = new Date(normalized.endsWith('Z') || normalized.includes('+') ? normalized : normalized + 'Z');
      return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
    };
    
    const [ordersData, deliveryPeopleData, customersData] = await Promise.all([
      appClient.entities.Order.filter(filterByTenant(), '-created_date'),
      appClient.entities.DeliveryPerson.filter(filterByTenant()),
      appClient.entities.Customer.filter(filterByTenant())
    ]);

    const dayDeliveryOrders = ordersData.filter(order => {
      if (!order.created_date) return false;
      return isDeliveryOrder(order)
        && toParisDateStr(order.created_date) === selectedDateStr
        && order.statut !== 'annulee';
    });

    const customersMap = customersData.reduce((acc, customer) => {
      acc[customer.id] = customer;
      return acc;
    }, {});
    
    const ordersByStatus = organizeColumns(dayDeliveryOrders);

    console.log(`[Livraisons] Total récupérées: ${ordersData.length}, après filtre date (${selectedDateStr}): ${dayDeliveryOrders.length}`);
    if (ordersData.length > 0) {
      console.log('[Livraisons] Exemple date brute:', ordersData[0]?.created_date, '→ Paris:', toParisDateStr(ordersData[0]?.created_date));
    }

    return {
      allOrders: dayDeliveryOrders,
      ordersByStatus,
      deliveryPeople: deliveryPeopleData,
      customersMap: customersMap,
      totalFetched: ordersData.length,
    };
  }, [selectedDate, filterByTenant, isDeliveryOrder]);

  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['livraisons', format(selectedDate, 'yyyy-MM-dd'), currentTenant?.id],
    queryFn: fetchDeliveryData,
    refetchOnWindowFocus: false,
    refetchInterval: 90000,
    staleTime: 80000,
    retry: 2,
    enabled: !!currentTenant,
  });

  const allOrders = data?.allOrders || [];
  const totalFetched = data?.totalFetched ?? null;
  const ordersByStatus = data?.ordersByStatus || {
    pending: { id: 'pending', title: "En attente d'assignation", orders: [] },
    assigned: { id: 'assigned', title: 'Assignées', orders: [] },
    delivered: { id: 'delivered', title: 'Livrées', orders: [] }
  };
  const deliveryPeople = data?.deliveryPeople || [];
  const customers = data?.customersMap || {};

  const handleAssignDelivery = (order) => {
    setAssignmentModal({ isOpen: true, order });
  };

  const confirmAssignment = async (deliveryPersonId) => {
    if (!assignmentModal.order || !deliveryPersonId) return;

    try {
      await appClient.entities.Order.update(assignmentModal.order.id, withTenant({
        delivery_person_id: deliveryPersonId,
        statut: assignmentModal.order.delivery_person_id ? assignmentModal.order.statut : 'en_cours_de_livraison' 
      }));

      setAssignmentModal({ isOpen: false, order: null });
      queryClient.invalidateQueries({ queryKey: ['livraisons', format(selectedDate, 'yyyy-MM-dd'), currentTenant?.id] });
    } catch (error) {
      console.error("Erreur lors de l'assignation:", error);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await appClient.entities.Order.update(orderId, withTenant({ statut: newStatus }));
      queryClient.invalidateQueries({ queryKey: ['livraisons', format(selectedDate, 'yyyy-MM-dd'), currentTenant?.id] });
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Truck className="w-8 h-8 text-purple-500" />
              Gestion des Livraisons
            </h1>
            <p className="text-gray-600 mt-2">
              Livraisons du {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
            </p>
            {totalFetched !== null && (
              <p className="text-xs text-gray-400 mt-1">
                {totalFetched} commande(s) livraison en base, {allOrders.length} correspondent à la date
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {format(selectedDate, 'dd/MM/yyyy', { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>

            <Button onClick={() => refetch()} variant="outline" className="gap-2" disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>

        <Tabs defaultValue="board" className="space-y-6">
          <TabsList>
            <TabsTrigger value="board">Tableau de Bord</TabsTrigger>
            <TabsTrigger value="drivers">Livreurs</TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="space-y-6">
            <div className="flex gap-6 h-[600px]">
              {Object.values(ordersByStatus).map(column => (
                <div key={column.id} className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col shadow-md">
                  <div className="p-4 border-b bg-gray-50 rounded-t-xl">
                    <h3 className="font-bold text-center text-gray-800">
                      {column.title} ({column.orders.length})
                    </h3>
                  </div>
                  <ScrollArea className="flex-1 p-4">
                    {column.orders.length > 0 ? (
                      column.orders.map(order => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          customer={customers[order.customer_id]}
                          deliveryPeople={deliveryPeople}
                          onAssignDelivery={handleAssignDelivery}
                          showAssignButton={column.id === 'pending'}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Aucune commande</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="drivers">
            <DeliveryPersonStatus 
              deliveryPeople={deliveryPeople} 
              orders={allOrders}
              customers={customers}
              onStatusChange={handleStatusChange}
              selectedDate={selectedDate}
            />
          </TabsContent>
        </Tabs>

        <Dialog open={assignmentModal.isOpen} onOpenChange={(open) => !open && setAssignmentModal({ isOpen: false, order: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {assignmentModal.order?.delivery_person_id ? 'Réassigner' : 'Assigner'} la commande #{assignmentModal.order?.numero_caisse || assignmentModal.order?.numero_commande?.slice(-4) || 'N/A'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {assignmentModal.order?.delivery_person_id && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Actuellement assignée à :</strong> {
                      deliveryPeople.find(dp => dp.id === assignmentModal.order.delivery_person_id)?.prenom
                    } {
                      deliveryPeople.find(dp => dp.id === assignmentModal.order.delivery_person_id)?.nom
                    }
                  </p>
                </div>
              )}
              <div className="text-sm text-gray-600">
                <p><strong>Client:</strong> {assignmentModal.order?.customer_id ? 
                  `${customers[assignmentModal.order.customer_id]?.prenom || ''} ${customers[assignmentModal.order.customer_id]?.nom || ''}`.trim() : 
                  assignmentModal.order?.customer_name || 'Anonyme'
                }</p>
                <p><strong>Adresse:</strong> {assignmentModal.order?.delivery_address || customers[assignmentModal.order?.customer_id]?.adresse || 'Non renseignée'}</p>
                <p><strong>Total:</strong> {assignmentModal.order?.total_ttc?.toFixed(2) || '0.00'}€</p>
              </div>
              
              {deliveryPeople.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <p className="text-sm text-yellow-800">
                    Aucun livreur enregistré. Allez dans <strong>Paramètres → Livreurs</strong> pour en ajouter.
                  </p>
                </div>
              ) : (
                <Select onValueChange={confirmAssignment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un livreur" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryPeople.map(person => (
                      <SelectItem key={person.id} value={person.id}>
                        <div className="flex items-center gap-2">
                          <span>{person.prenom} {person.nom} - {person.vehicule}</span>
                          {!person.disponible && person.en_livraison && (
                            <Badge variant="outline" className="text-xs bg-purple-50">En livraison</Badge>
                          )}
                          {!person.disponible && !person.en_livraison && (
                            <Badge variant="outline" className="text-xs bg-gray-50">Indisponible</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


