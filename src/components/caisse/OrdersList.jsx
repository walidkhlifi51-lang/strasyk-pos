import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, CheckCircle, RefreshCw, AlertTriangle, Printer, Trash2, Home, Receipt, ShoppingBag, Truck, PanelLeftClose, User, Phone, MapPin, UserX, Hourglass, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
// Removed: import { utcToZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { toParisDate } from '@/lib/dateParsing';

const typeConfig = {
  sur_place: { label: 'Sur Place', color: 'bg-blue-100 text-blue-800', icon: <Receipt className="w-3 h-3" /> },
  emporter: { label: 'À Emporter', color: 'bg-orange-100 text-orange-800', icon: <ShoppingBag className="w-3 h-3" /> },
  livraison: { label: 'Livraison', color: 'bg-purple-100 text-purple-800', icon: <Truck className="w-3 h-3" /> },
};

const statusConfig = {
  en_attente: { label: 'EN ATTENTE', color: 'bg-yellow-100 text-yellow-800', icon: <Hourglass className="w-3 h-3" /> },
  en_attente_paiement: { label: 'NON PAYÉ', color: 'bg-red-100 text-red-800', icon: <AlertTriangle className="w-3 h-3" /> },
  en_preparation: { label: 'En préparation', color: 'bg-blue-100 text-blue-800', icon: <Clock className="w-3 h-3" /> },
  prete: { label: 'En préparation', color: 'bg-blue-100 text-blue-800', icon: <Clock className="w-3 h-3" /> },
  payé: { label: 'Payé', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  en_cours_de_livraison: { label: 'En Livraison', color: 'bg-purple-100 text-purple-800', icon: <Clock className="w-3 h-3" /> },
  livree: { label: 'Livrée', color: 'bg-gray-100 text-gray-800', icon: <CheckCircle className="w-3 h-3" /> },
  annulee: { label: 'Annulée', color: 'bg-red-100 text-red-800', icon: <AlertTriangle className="w-3 h-3" /> },
};

const OrderItem = ({ order, customer, onEditOrder, onSettleOrder, onCancelOrder, profile, onManualPrint }) => {
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isTicketViewOpen, setIsTicketViewOpen] = useState(false);
  const config = statusConfig[order.statut] || { label: order.statut, color: 'bg-gray-200', icon: null };
  const type = typeConfig[order.type_commande] || { label: order.type_commande, color: 'bg-gray-200', icon: null };
  
  // Logique de date robuste pour le fuseau horaire de Paris
  const orderDate = toParisDate(order.created_date);
  if (!orderDate) return null;

  const nowInParis = toParisDate(new Date());
  const nowDateStr = format(nowInParis, 'yyyy-MM-dd');
  const orderDateStr = format(orderDate, 'yyyy-MM-dd');
  const isOrderToday = nowDateStr === orderDateStr;

  const handleConfirmCancel = () => {
    if (!cancellationReason) {
      alert("Veuillez saisir un motif.");
      return;
    }
    onCancelOrder(order, cancellationReason);
    setIsCancelConfirmOpen(false);
  };

  // Déterminer si un client existe et récupérer ses infos
  const hasCustomer = customer && order.customer_id;
  
  const getCustomerDisplay = () => {
    if (!hasCustomer) {
      return 'Anonyme';
    }
    
    const prenom = customer.prenom || '';
    const nom = customer.nom || '';
    const fullName = `${prenom} ${nom}`.trim();
    
    if (fullName) return fullName;
    if (customer.telephone) return customer.telephone;
    return 'Client';
  };

  const customerDisplay = getCustomerDisplay();
  const isAnonymous = !hasCustomer;

  // MODIFICATION : Seules les vraies commandes en attente (pas les non payées)
  const isWaitingOrder = order.statut === 'en_attente';

  return (
    <>
      <div 
        className="p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
      >
        {/* En-tête avec numéro de commande et prix */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="font-bold text-lg text-gray-900 mb-1">
              Commande #{order.from_kiosk ? 'B' : ''}{order.numero_commande || order.numero_caisse || order.id?.slice(-4) || '...'}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* MODIFICATION : Affichage "EN ATTENTE" seulement pour en_attente */}
              {isWaitingOrder ? (
                <>
                  <Badge className={`flex items-center gap-1.5 ${config.color} font-bold text-sm`}>
                    {config.icon}
                    EN ATTENTE
                  </Badge>
                  {type && (
                    <Badge className={`flex items-center gap-1 ${type.color}`}>
                      {type.icon} {type.label}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  {type && <Badge className={`flex items-center gap-1 ${type.color}`}>{type.icon}{type.label}</Badge>}
                  <Badge className={`flex items-center gap-1.5 ${config.color}`}>{config.icon}{config.label}</Badge>
                </>
              )}
            </div>
          </div>
          <div className="font-bold text-gray-900 text-xl text-right">
            {order.total_ttc?.toFixed(2)}€
          </div>
        </div>

        {/* Informations client - TOUJOURS VISIBLE */}
        <div className={`mb-3 p-2.5 rounded-lg border-2 ${isAnonymous && !order.customer_name ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center gap-2">
            {isAnonymous && !order.customer_name ? (
              <>
                <UserX className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="font-medium text-gray-600">Anonyme</span>
              </>
            ) : isAnonymous && order.customer_name ? (
              <>
                <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="font-semibold text-gray-900">👤 {order.customer_name}</span>
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{customerDisplay}</div>
                  {customer?.telephone && (
                    <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {customer.telephone}
                    </div>
                  )}
                  {order.type_commande === 'livraison' && (order.delivery_address || customer?.adresse) && (
                    <div className="flex items-start gap-1 text-xs text-gray-600 mt-0.5">
                      <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{order.delivery_address || `${customer.adresse}, ${customer.ville}`}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Heure */}
        <div className="text-xs text-gray-500 mb-3">
          {isOrderToday
            ? orderDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            : orderDate.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          }
        </div>
        
        {/* Boutons d'action */}
        <div className="flex gap-2">
          {order.from_web ? (
            <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setIsTicketViewOpen(true)}>
              <Eye className="w-4 h-4" />
              Voir ticket
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onEditOrder(order)}>
              Modifier
            </Button>
          )}
          {!order.payee && (
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => onSettleOrder(order)}>
              Régler
            </Button>
          )}
          {profile?.impression_bouton_visible && (
            <Button size="icon" variant="outline" onClick={() => onManualPrint(order)} className="h-9 w-9">
              <Printer className="w-4 h-4"/>
            </Button>
          )}
          {!order.payee && (
             <Button size="icon" variant="destructive" onClick={() => setIsCancelConfirmOpen(true)} className="h-9 w-9">
              <Trash2 className="w-4 h-4"/>
            </Button>
          )}
        </div>
      </div>
      <Dialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'annulation</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point d'annuler la commande #{order.numero_commande || order.numero_caisse}. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reason" className="text-right">
                Motif
              </Label>
              <Input
                id="reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="col-span-3"
                placeholder="Ex: Erreur de saisie"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelConfirmOpen(false)}>Fermer</Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTicketViewOpen} onOpenChange={setIsTicketViewOpen}>
        <DialogContent className="max-w-md max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-center text-sm font-normal text-gray-500">
              Prévisualisation ticket
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="bg-white p-6 mx-4 my-2 border-2 border-dashed border-gray-300 rounded font-mono text-xs leading-relaxed" style={{ maxWidth: '80mm' }}>
              {/* Logo ou nom */}
              {profile?.logo_url ? (
                <div className="text-center mb-3">
                  <img src={profile.logo_url} alt="Logo" className="max-w-[60mm] max-h-[30mm] mx-auto" />
                </div>
              ) : (
                <div className="text-center font-bold text-base mb-2">{profile?.nom_etablissement}</div>
              )}
              
              {/* Infos établissement */}
              <div className="text-center text-[10px] leading-tight mb-2">
                <div>{profile?.adresse}</div>
                <div>Tél: {profile?.telephone}</div>
                {profile?.siret && <div>SIRET: {profile.siret}</div>}
              </div>

              <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

              {/* Info commande */}
              <div className="text-center mb-3">
                <div className="font-bold text-lg">Commande #{order.from_kiosk ? 'B' : ''}{order.numero_commande || order.numero_caisse}</div>
                <div className="text-[10px] uppercase font-semibold mt-1 px-2 py-1 bg-gray-100 inline-block rounded">
                  {typeConfig[order.type_commande]?.label}
                </div>
                <div className="text-[10px] mt-1">{orderDate.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>

              {/* Client */}
              {customer && (
                <div className="bg-gray-50 p-2 mb-3 text-[10px] rounded">
                  <div className="font-semibold">CLIENT:</div>
                  <div>{customerDisplay}</div>
                  {customer.telephone && <div>📞 {customer.telephone}</div>}
                  {order.type_commande === 'livraison' && (order.delivery_address || customer.adresse) && (
                    <div>📍 {order.delivery_address || `${customer.adresse}, ${customer.ville}`}</div>
                  )}
                </div>
              )}

              <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

              {/* En-tête articles */}
              <div className="flex justify-between font-bold mb-2 text-[10px]">
                <span>Qte  Article</span>
                <span>Prix</span>
              </div>

              <div className="border-t border-gray-300 mb-2"></div>

              {/* Articles */}
              <div className="space-y-2 mb-3">
                {(order.articles || []).map((article, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <span className="font-bold">{article.quantite}x </span>
                        <span>{article.nom_produit}</span>
                      </div>
                      <div className="font-bold ml-2 whitespace-nowrap">{(article.total_ligne || 0).toFixed(2)}€</div>
                    </div>
                    {article.options?.length > 0 && (
                      <div className="pl-6 text-[10px] text-gray-600">
                        {article.options.map((opt, i) => (
                          <div key={i}>+ {opt.nom}</div>
                        ))}
                      </div>
                    )}
                    {article.notes && (
                      <div className="pl-6 text-[10px] italic text-blue-600">📝 {article.notes}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Réduction scratch */}
              {order.scratch_reduction > 0 && (
                <>
                  <div className="border-t border-gray-300 mb-2"></div>
                  <div className="flex justify-between font-semibold text-pink-600">
                    <span>🎫 Cadeau scratch</span>
                    <span>-{order.scratch_reduction.toFixed(2)}€</span>
                  </div>
                </>
              )}

              <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

              {/* Totaux */}
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Total H.T.</span>
                  <span>{(order.total_ht || 0).toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span>dont T.V.A.</span>
                  <span>{(order.total_tva || 0).toFixed(2)}€</span>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

              <div className="flex justify-between font-bold text-lg">
                <span>TOTAL T.T.C.</span>
                <span>{(order.total_ttc || 0).toFixed(2)}€</span>
              </div>

              {/* Paiement */}
              {order.payee && (order.mode_paiement?.length > 0 || order.cagnotte_spent > 0) && (
                <>
                  <div className="border-t border-gray-300 my-3"></div>
                  <div className="font-semibold mb-2 text-[10px]">PAIEMENT:</div>
                  {order.cagnotte_spent > 0 && (
                    <div className="flex justify-between">
                      <span>🎁 Cagnotte</span>
                      <span className="font-bold">{order.cagnotte_spent.toFixed(2)}€</span>
                    </div>
                  )}
                  {order.mode_paiement?.map((p, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{p.methode === 'especes' ? '💵 Espèces' : p.methode === 'carte_bancaire' ? '💳 Carte' : p.methode}</span>
                      <span className="font-bold">{(p.montant || 0).toFixed(2)}€</span>
                    </div>
                  ))}
                </>
              )}

              <div className="border-t-2 border-dashed border-gray-400 my-3"></div>

              <div className="text-center text-[11px] italic font-bold">
                Merci de votre visite !
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 pt-2">
            <Button variant="outline" onClick={() => setIsTicketViewOpen(false)}>Fermer</Button>
            <Button onClick={() => { setIsTicketViewOpen(false); onManualPrint(order); }}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};


export default function OrdersList({ 
  orders: ordersFromProps, 
  onEditOrder, 
  customers, 
  onRefresh, 
  isLoading, 
  workingDate,
  onSettleOrder,
  onCancelOrder,
  profile,
  onManualPrint,
  onHide
}) {
  const [filterType, setFilterType] = useState('all'); // Added state for filtering
  const [filterStatus, setFilterStatus] = useState('all'); // Added state for filtering

  const filteredOrders = useMemo(() => {
    let filtered = ordersFromProps;

    console.log('[OrdersList] 🔍 Filtrage des commandes:');
    console.log(`   Total commandes reçues: ${ordersFromProps.length}`);
    
    // CORRECTION : Ne filtrer QUE par type de commande, pas par statut
    // Les commandes 'en_attente' (brouillons) ET 'en_attente_paiement' (crédit) doivent être visibles
    if (filterType !== 'all') {
      filtered = filtered.filter(order => order.type_commande === filterType);
      console.log(`   Après filtre type "${filterType}": ${filtered.length}`);
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'paid') {
        filtered = filtered.filter(order => order.payee === true);
      } else if (filterStatus === 'unpaid') {
        filtered = filtered.filter(order => order.payee === false);
      }
      console.log(`   Après filtre paiement "${filterStatus}": ${filtered.length}`);
    }

    console.log(`   Commandes finales affichées: ${filtered.length}`);
    
    return filtered;
  }, [ordersFromProps, filterType, filterStatus]);

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="flex-shrink-0 p-4 border-b bg-gray-50 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-xl text-gray-800">
              Commandes du Jour
            </h3>
            <p className="text-sm text-gray-500">
              {new Date(workingDate).toLocaleString('fr-FR', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="ghost" size="icon" title="Tableau de bord">
                <Home className="w-5 h-5 text-gray-600" />
              </Button>
            </Link>
            {onHide && (
              <Button variant="ghost" size="icon" onClick={onHide} title="Masquer la liste">
                <PanelLeftClose className="w-5 h-5 text-gray-600" />
              </Button>
            )}
          </div>
        </div>
        <Button variant="outline" className="w-full gap-2" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
        {/* Optional: Filter controls could be added here to change filterType and filterStatus */}
        {/* For example:
        <div className="flex gap-2 mt-2">
          <Button onClick={() => setFilterType('all')} variant={filterType === 'all' ? 'default' : 'outline'}>All Types</Button>
          <Button onClick={() => setFilterType('sur_place')} variant={filterType === 'sur_place' ? 'default' : 'outline'}>Sur Place</Button>
          <Button onClick={() => setFilterStatus('all')} variant={filterStatus === 'all' ? 'default' : 'outline'}>All Payments</Button>
          <Button onClick={() => setFilterStatus('paid')} variant={filterStatus === 'paid' ? 'default' : 'outline'}>Paid</Button>
          <Button onClick={() => setFilterStatus('unpaid')} variant={filterStatus === 'unpaid' ? 'default' : 'outline'}>Unpaid</Button>
        </div>
        */}
      </header>
      <ScrollArea className="flex-1">
        {filteredOrders.length > 0 ? (
          filteredOrders.map(order => (
            <OrderItem
              key={order.id}
              order={order}
              customer={customers[order.customer_id]}
              onEditOrder={onEditOrder}
              onSettleOrder={onSettleOrder}
              onCancelOrder={onCancelOrder}
              profile={profile}
              onManualPrint={onManualPrint}
            />
          ))
        ) : (
          <div className="text-center p-12 text-gray-500 space-y-2">
            <Receipt className="w-12 h-12 mx-auto text-gray-400" />
            <p className="font-medium">Aucune commande trouvée</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
