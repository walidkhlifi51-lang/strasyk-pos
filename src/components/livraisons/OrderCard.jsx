import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, User, Phone, DollarSign, Package } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const OrderCard = ({ order, customer, onAssign, deliveryPeople, isAssigned = false }) => {
  const getOrderTypeColor = (type) => {
    switch (type) {
      case 'sur_place': return 'bg-blue-500';
      case 'emporter': return 'bg-orange-500';
      case 'livraison': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getOrderTypeLabel = (type) => {
    switch (type) {
      case 'sur_place': return 'Sur Place';
      case 'emporter': return 'À Emporter';
      case 'livraison': return 'Livraison';
      default: return type;
    }
  };

  const getStatusBadge = () => {
    if (order.statut === 'en_attente') {
      return <Badge className="bg-gray-100 text-gray-800">En attente</Badge>;
    }
    if (!order.payee) {
      return <Badge className="bg-yellow-100 text-yellow-800">À Payer</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Payée</Badge>;
  };

  return (
    <Card className="mb-4 shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={`${getOrderTypeColor(order.type_commande)} text-white`}>
              {getOrderTypeLabel(order.type_commande)}
            </Badge>
            <span className="font-bold text-lg">
              #{order.numero_caisse || order.numero_commande?.slice(-4) || 'N/A'}
            </span>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Informations temporelles */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>
            {order.created_date 
              ? format(new Date(order.created_date), 'HH:mm', { locale: fr })
              : 'N/A'
            }
          </span>
        </div>

        {/* Client */}
        {customer && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-500" />
              <span className="font-medium">{customer.prenom} {customer.nom}</span>
            </div>
            {customer.telephone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                <span>{customer.telephone}</span>
              </div>
            )}
            {customer.adresse && order.type_commande === 'livraison' && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5" />
                <div>
                  <div>{customer.adresse}</div>
                  <div>{customer.code_postal} {customer.ville}</div>
                  {customer.etage && <div className="text-xs">Étage: {customer.etage}</div>}
                  {customer.interphone && <div className="text-xs">Interphone: {customer.interphone}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Articles */}
        {order.articles && order.articles.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Package className="w-4 h-4" />
              <span>{order.articles.length} article{order.articles.length > 1 ? 's' : ''}</span>
            </div>
            <div className="text-xs text-gray-500 max-h-20 overflow-y-auto">
              {order.articles.map((article, index) => (
                <div key={index} className="flex justify-between">
                  <span>{article.quantite}x {article.nom_produit}</span>
                  <span>{(article.prix_unitaire * article.quantite).toFixed(2)}€</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-bold text-lg text-green-600">
              {order.total_ttc?.toFixed(2) || '0.00'}€
            </span>
          </div>
          
          {/* Bouton d'assignation si pas encore assigné */}
          {!isAssigned && onAssign && deliveryPeople && deliveryPeople.length > 0 && (
            <Button
              onClick={() => onAssign(order)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Assigner
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderCard;
