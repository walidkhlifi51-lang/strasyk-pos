import React from 'react';
import OrderCard from './OrderCard';
import { ScrollArea } from "@/components/ui/scroll-area";

const DeliveryColumn = ({ column, orders, customers, deliveryPeople, onAssignDelivery }) => {
  const getColumnStyle = (id) => {
    switch (id) {
      case 'pending': return 'bg-orange-50 border-orange-200';
      case 'assigned': return 'bg-blue-50 border-blue-200';
      case 'delivered': return 'bg-green-50 border-green-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`flex-1 rounded-xl border-2 ${getColumnStyle(column.id)} flex flex-col`}>
      <div className="p-4 border-b-2 border-white/50 bg-white/70 rounded-t-xl">
        <h3 className="font-bold text-lg text-gray-800 tracking-wide text-center">
          {column.title} ({orders.length})
        </h3>
      </div>
      
      {/* Contenu avec ascenseur indépendant */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-3">
            {orders.length > 0 ? (
              orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  customer={customers[order.customer_id]}
                  deliveryPeople={deliveryPeople}
                  onAssignDelivery={onAssignDelivery}
                  isDelivered={column.id === 'delivered'}
                />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📭</span>
                </div>
                <p className="font-medium">Aucune commande</p>
                <p className="text-sm">dans cette catégorie</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default function DeliveryBoard({ columns, customers, deliveryPeople, onAssignDelivery }) {
  return (
    <div className="flex gap-6 h-full">
      {Object.values(columns).map(column => (
        <DeliveryColumn
          key={column.id}
          column={column}
          orders={column.orders}
          customers={customers}
          deliveryPeople={deliveryPeople}
          onAssignDelivery={onAssignDelivery}
        />
      ))}
    </div>
  );
}
