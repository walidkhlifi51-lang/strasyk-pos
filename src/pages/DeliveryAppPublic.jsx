import React, { useState, useEffect, useCallback, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, MapPin, Phone, CreditCard, CheckCircle, Truck, LogOut, QrCode, Clock, Navigation, ChevronRight, X, History, Camera } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import QrScannerView from '../components/delivery/QrScannerView';
import { getSupabaseBrowserClient } from '@/api/supabase/client';

const ACTIVE_DELIVERY_STATUSES = ['en_cours_de_livraison', 'en_preparation', 'prete', 'en_attente', 'en_attente_paiement'];
const HISTORY_DELIVERY_STATUSES = ['livree', 'payÃ©'];
const DELIVERY_PUBLIC_PERSON_FIELDS = [
  'id', 'tenant_id', 'user_email', 'username', 'password', 'nom', 'prenom', 'telephone', 'vehicule',
  'disponible', 'app_access_enabled', 'en_livraison', 'nb_livraisons_jour', 'total_encaisse',
  'created_date', 'updated_date'
];
const DELIVERY_PUBLIC_CUSTOMER_FIELDS = [
  'id', 'nom', 'prenom', 'telephone', 'adresse', 'etage', 'interphone', 'cagnotte_balance', 'updated_date'
];
const DELIVERY_PUBLIC_CAGNOTTE_RULE_FIELDS = ['id', 'tenant_id', 'active', 'accumulation_rate', 'updated_date'];

const paymentMethods = [
  { value: 'especes', label: 'Espèces', emoji: '💵' },
  { value: 'carte_bancaire', label: 'Carte', emoji: '💳' },
  { value: 'ticket_restaurant', label: 'Ticket Resto', emoji: '🎫' },
  { value: 'cheque', label: 'Chèque', emoji: '📝' },
];

const statusConfig = {
  en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  en_attente_paiement: { label: 'À encaisser', color: 'bg-orange-100 text-orange-800' },
  en_preparation: { label: 'En préparation', color: 'bg-blue-100 text-blue-800' },
  prete: { label: 'Prête', color: 'bg-green-100 text-green-800' },
  en_cours_de_livraison: { label: 'En cours', color: 'bg-purple-100 text-purple-800' },
  livree: { label: 'Livrée ✓', color: 'bg-gray-100 text-gray-600' },
  payé: { label: 'Payée ✓', color: 'bg-gray-100 text-gray-600' },
};

export default function DeliveryAppPublic() {
  const { toast } = useToast();
  const tenantId = new URLSearchParams(window.location.search).get('tenant');
  const [deliveryPerson, setDeliveryPerson] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState({});
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [showPayment, setShowPayment] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [qrInput, setQrInput] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [scannedNum, setScannedNum] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);

  const [restaurantProfile, setRestaurantProfile] = useState(null);
  const deliveryPersonRef = useRef(null);
  const assignFnRef = useRef(null);
  const loadOrdersRef = useRef(null);
  const deliveryProfileFields = [
    'id',
    'tenant_id',
    'nom_etablissement',
    'adresse',
    'telephone',
    'logo_url',
    'delivery_app_allowed',
    'manages_delivery_app',
  ];
  const getParisDateKey = useCallback((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parisDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    return `${parisDate.getFullYear()}-${String(parisDate.getMonth() + 1).padStart(2, '0')}-${String(parisDate.getDate()).padStart(2, '0')}`;
  }, []);

  const invokeDeliveryAction = useCallback(async (action, payload = {}) => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data, error } = await supabase.rpc('delivery_app_action', {
        action_name: action,
        payload,
      });
      if (!error) return { data };
    }

    if (action === 'assign') {
      return appClient.functions.invoke('assignDeliveryOrder', payload);
    }

    return appClient.functions.invoke('assignDeliveryOrder', {
      action,
      ...payload,
    });
  }, []);

  // Load restaurant profile when logged in
  useEffect(() => {
    if (!deliveryPerson) return;
    const tId = tenantId || deliveryPerson.tenant_id;
    if (!tId) return;
    appClient.entities.RestaurantProfile.filter({ tenant_id: tId }, undefined, 1, { fields: deliveryProfileFields })
      .then(res => { if (res[0]) setRestaurantProfile(res[0]); })
      .catch(() => {});
  }, [deliveryPerson?.id]);

  // Reload auth from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('delivery_auth_v2');
    if (saved) {
      try {
        const auth = JSON.parse(saved);
        loginWithCredentials(auth.username, auth.password, true);
      } catch {}
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!deliveryPerson) return;
    loadOrders(deliveryPerson);
    const interval = setInterval(() => loadOrders(deliveryPerson), 120000);
    return () => clearInterval(interval);
  }, [deliveryPerson?.id]);

  useEffect(() => {
    if (!deliveryPerson) return undefined;

    const unsubscribeOrders = appClient.entities.Order.subscribe((event) => {
      const order = event?.data;
      if (!order) return;
      const currentTenantId = tenantId || deliveryPerson.tenant_id;
      const relevantStatus = ACTIVE_DELIVERY_STATUSES.includes(order.statut) || HISTORY_DELIVERY_STATUSES.includes(order.statut);
      if (order.tenant_id !== currentTenantId || !relevantStatus) return;
      if (order.delivery_person_id !== deliveryPerson.id && ACTIVE_DELIVERY_STATUSES.includes(order.statut)) return;
      loadOrdersRef.current?.(deliveryPersonRef.current || deliveryPerson);
    });

    const unsubscribeDeliveryPerson = appClient.entities.DeliveryPerson.subscribe((event) => {
      const person = event?.data;
      if (!person || person.id !== deliveryPerson.id) return;
      setDeliveryPerson((prev) => ({ ...(prev || {}), ...person }));
      deliveryPersonRef.current = { ...(deliveryPersonRef.current || {}), ...person };
    });

    return () => {
      unsubscribeOrders();
      unsubscribeDeliveryPerson();
    };
  }, [deliveryPerson?.id, deliveryPerson?.tenant_id, tenantId]);

  // Handle QR code from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNum = params.get('order');
    if (orderNum && deliveryPerson) {
      assignOrderByNumber(orderNum);
    }
  }, [deliveryPerson?.id]);

  const loginWithCredentials = async (user, pass, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const loginRes = await invokeDeliveryAction('login', {
        username: user,
        password: pass,
        tenant_id: tenantId || null,
      });
      const person = loginRes?.data?.person || null;
      const profile = loginRes?.data?.profile || null;

      if (!person) throw new Error(loginRes?.data?.error || 'Identifiants incorrects');
      if (person.app_access_enabled === false) throw new Error('Acces application livreur desactive');
      const tId = tenantId || person.tenant_id;
      if (!tId) throw new Error('Aucun commerce rattache a ce livreur');
      if (!profile?.delivery_app_allowed) throw new Error('Application livreur non autorisee par l administrateur');
      if (!profile?.manages_delivery_app) throw new Error('Application livreur non activee par le commercant');
      setDeliveryPerson(person);
      setRestaurantProfile(profile);
      deliveryPersonRef.current = person;
      localStorage.setItem('delivery_auth_v2', JSON.stringify({ username: user, password: pass }));
      await loadOrders(person);
    } catch (err) {
      if (!silent) toast({ title: '❌ Erreur', description: err.message, variant: 'destructive' });
      localStorage.removeItem('delivery_auth_v2');
    }
    if (!silent) setIsLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    await loginWithCredentials(username, password);
  };

  const logout = () => {
    localStorage.removeItem('delivery_auth_v2');
    setDeliveryPerson(null);
    setOrders([]);
    setCustomers({});
    setUsername('');
    setPassword('');
  };

  const loadOrders = useCallback(async (person) => {
    if (!person) return;
    setIsLoadingOrders(true);
    try {
      const tId = tenantId || person.tenant_id;
      const res = await invokeDeliveryAction('list', {
        delivery_person_id: person.id,
        tenant_id: tId,
      });
      const todayParis = getParisDateKey(new Date());
      const allOrders = res.data?.orders || [];
      const filteredOrders = allOrders.filter((order) => {
        if (!order) return false;
        if (ACTIVE_DELIVERY_STATUSES.includes(order.statut)) return true;
        if (HISTORY_DELIVERY_STATUSES.includes(order.statut)) {
          return getParisDateKey(order.created_date) === todayParis;
        }
        return false;
      });
      const sorted = filteredOrders.sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date));
      setOrders(sorted);

      const customerIds = [...new Set(sorted.map(o => o.customer_id).filter(Boolean))];
      const customerMap = {};
      if (customerIds.length > 0) {
        try {
          const customersList = await appClient.entities.Customer.filter(
            { id: { $in: customerIds } },
            undefined,
            customerIds.length,
            { fields: DELIVERY_PUBLIC_CUSTOMER_FIELDS }
          );
          customersList.forEach((customer) => {
            if (customer?.id) customerMap[customer.id] = customer;
          });
        } catch (error) {
          console.warn('[DeliveryAppPublic] fallback clients via function invoke', error);
          await Promise.all(customerIds.map(async (cid) => {
            try {
              const cRes = await invokeDeliveryAction('getCustomer', {
                customer_id: cid,
                tenant_id: tId,
              });
              if (cRes.data?.customer) customerMap[cid] = cRes.data.customer;
            } catch {}
          }));
        }
      }
      setCustomers(customerMap);
    } catch (err) {
      console.error('Erreur chargement commandes:', err);
    }
    setIsLoadingOrders(false);
  }, [getParisDateKey, tenantId]);

  const assignOrderByNumber = async (orderNum) => {
    const person = deliveryPersonRef.current || deliveryPerson;
    if (!person) {
      toast({ title: '❌ Non connecté', description: 'Reconnectez-vous', variant: 'destructive' });
      return;
    }
    const numInt = parseInt(orderNum);
    toast({ title: '⏳ Recherche commande #' + numInt + '...' });
    try {
      const tId = tenantId || person.tenant_id;
      const res = await invokeDeliveryAction('assign', {
        numero_caisse: numInt,
        tenant_id: tId,
        delivery_person_id: person.id,
      });
      if (res.data?.error) {
        toast({ title: '❌ ' + res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: `✅ Commande #${numInt} assignée !` });
      setShowQrScanner(false);
      setQrInput('');
      setScannedNum(null);
      await loadOrders(person);
    } catch (err) {
      console.error('[assign] Erreur:', err);
      toast({ title: '❌ Erreur: ' + (err?.response?.data?.error || err.message), variant: 'destructive' });
    }
  };

  const handleQrAssign = async () => {
    if (!qrInput.trim()) return;
    const num = qrInput.trim().replace(/\D/g, '');
    await assignOrderByNumber(num);
  };

  // Keep assignFnRef always up to date so scanner callback uses latest version
  useEffect(() => {
    assignFnRef.current = assignOrderByNumber;
  });

  useEffect(() => {
    loadOrdersRef.current = loadOrders;
  }, [loadOrders]);

  const handleConfirmDelivery = async (order, paymentData) => {
    setIsLoading(true);
    try {
      try {
        await invokeDeliveryAction('confirmDelivery', {
          order_id: order.id,
          delivery_person_id: deliveryPerson.id,
          payment_method: paymentData ? paymentData.methode : null,
          order_total: order.total_ttc,
        });
      } catch (invokeError) {
        const wasAlreadyPaid = !!order.payee;
        const isNowPaid = wasAlreadyPaid || !!paymentData?.methode;
        const paymentBreakdown = paymentData?.methode
          ? [{ methode: paymentData.methode, montant: order.total_ttc || 0 }]
          : (order.mode_paiement || []);

        await appClient.entities.Order.update(order.id, {
          statut: 'livree',
          payee: isNowPaid,
          mode_paiement: paymentBreakdown,
        });

        await appClient.entities.DeliveryPerson.update(deliveryPerson.id, {
          en_livraison: false,
          nb_livraisons_jour: (deliveryPerson.nb_livraisons_jour || 0) + 1,
          total_encaisse: (deliveryPerson.total_encaisse || 0) + (!wasAlreadyPaid && isNowPaid ? (order.total_ttc || 0) : 0),
        });

        if (!wasAlreadyPaid && isNowPaid && order.customer_id) {
          const customersList = await appClient.entities.Customer.filter({ id: order.customer_id }, undefined, 1, { fields: DELIVERY_PUBLIC_CUSTOMER_FIELDS });
          const customer = customersList?.[0];
          if (customer) {
            const activeRules = await appClient.entities.CagnotteRule.filter(
              { tenant_id: tenantId || deliveryPerson.tenant_id, active: true },
              undefined,
              5,
              { fields: DELIVERY_PUBLIC_CAGNOTTE_RULE_FIELDS }
            );
            const rule = activeRules?.[0];
            if (rule?.accumulation_rate > 0) {
              const amountEarned = (order.total_ttc || 0) * (rule.accumulation_rate / 100);
              if (amountEarned > 0.01) {
                const balanceBefore = customer.cagnotte_balance || 0;
                const balanceAfter = balanceBefore + amountEarned;
                await appClient.entities.CagnotteHistory.create({
                  tenant_id: tenantId || deliveryPerson.tenant_id,
                  customer_id: customer.id,
                  order_id: order.id,
                  type: 'earn',
                  amount: amountEarned,
                  balance_before: balanceBefore,
                  balance_after: balanceAfter,
                  created_date: new Date().toISOString(),
                });
                await appClient.entities.Customer.update(customer.id, { cagnotte_balance: balanceAfter });
              }
            }
          }
        }
      }

      toast({ title: `✅ Commande #${order.numero_caisse} livrée !` });
      setShowPayment(null);
      setActiveOrderId(null);
      await loadOrders(deliveryPerson);
      // Rafraîchir les données du livreur pour mettre à jour le compteur
      try {
        const freshPersons = await invokeDeliveryAction('getDeliveryPerson', {
          delivery_person_id: deliveryPerson.id,
        });
        if (freshPersons.data?.person) {
          setDeliveryPerson(freshPersons.data.person);
          deliveryPersonRef.current = freshPersons.data.person;
        }
      } catch {
        const refreshed = await appClient.entities.DeliveryPerson.filter({ id: deliveryPerson.id }, undefined, 1, { fields: DELIVERY_PUBLIC_PERSON_FIELDS });
        if (refreshed?.[0]) {
          setDeliveryPerson(refreshed[0]);
          deliveryPersonRef.current = refreshed[0];
        }
      }
    } catch (err) {
      toast({ title: '❌ Erreur', description: err.message, variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const activeOrders = orders.filter(o => ACTIVE_DELIVERY_STATUSES.includes(o.statut));
  const historyOrders = orders.filter(o => HISTORY_DELIVERY_STATUSES.includes(o.statut));

  // LOGIN SCREEN
  if (!deliveryPerson) {
    return (
      <>
        <Toaster />
        <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Truck className="w-10 h-10 text-orange-600" />
              </div>
              <CardTitle className="text-2xl font-bold">App Livreur</CardTitle>
              <p className="text-gray-500 text-sm">Connectez-vous pour voir vos commandes</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label>Identifiant</Label>
                  <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Votre identifiant" required autoComplete="username" />
                </div>
                <div>
                  <Label>Mot de passe</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full h-12 text-lg bg-orange-500 hover:bg-orange-600" disabled={isLoading}>
                  {isLoading ? 'Connexion...' : '🚀 Se connecter'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // PAYMENT MODAL
  if (showPayment) {
    const order = showPayment;
    const customer = customers[order.customer_id];
    const alreadyPaid = order.payee;
    return (
      <>
        <Toaster />
        <div className="min-h-screen bg-gray-900/80 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-600" />
                Valider la livraison
              </CardTitle>
              <p className="text-sm text-gray-500">Commande #{order.numero_caisse} — {(order.total_ttc || 0).toFixed(2)}€</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-semibold">{customer.prenom} {customer.nom}</p>
                  <p className="text-sm text-gray-600">{order.delivery_address || customer.adresse}</p>
                </div>
              )}

              {alreadyPaid ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm font-medium text-center">
                  ✅ Cette commande est déjà payée
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-2">Mode de paiement encaissé :</p>
                  {order.mode_paiement_prevu && (
                    <div className="bg-amber-50 border border-amber-300 rounded p-2 text-xs text-amber-800 mb-2 flex items-center gap-2">
                      <span>⚠️</span>
                      <span>Mode prévu : <strong>{order.mode_paiement_prevu}</strong> — modifiable ci-dessous si le client change d'avis</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.map(m => (
                      <button
                        key={m.value}
                        onClick={() => setSelectedPaymentMethod(m.value)}
                        className={`p-3 rounded-xl border-2 font-semibold text-sm transition-all ${selectedPaymentMethod === m.value ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-700'}`}
                      >
                        <div className="text-xl mb-1">{m.emoji}</div>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPayment(null)}>Annuler</Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={isLoading || (!alreadyPaid && !selectedPaymentMethod)}
                  onClick={() => handleConfirmDelivery(order, alreadyPaid ? null : { methode: selectedPaymentMethod })}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {alreadyPaid ? 'Confirmer livraison' : 'Valider & livrer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // MAIN APP
  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gray-100">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="font-bold text-xl">👋 {deliveryPerson.prenom} {deliveryPerson.nom}</h1>
                <p className="text-orange-100 text-sm">🚗 {deliveryPerson.vehicule} · {deliveryPerson.nb_livraisons_jour || 0} livraisons aujourd'hui</p>
              </div>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={logout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            {restaurantProfile && (
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-3">
                {restaurantProfile.logo_url && (
                  <img src={restaurantProfile.logo_url} alt="logo" className="h-12 w-auto max-w-[60px] rounded-xl object-contain bg-white flex-shrink-0 shadow p-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{restaurantProfile.nom_etablissement}</p>
                  {restaurantProfile.adresse && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurantProfile.adresse + (restaurantProfile.ville ? ' ' + restaurantProfile.ville : ''))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-100 text-xs flex items-center gap-1 hover:text-white transition-colors"
                    >
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{restaurantProfile.adresse}{restaurantProfile.ville ? ', ' + restaurantProfile.ville : ''}</span>
                    </a>
                  )}
                </div>
                {restaurantProfile.telephone && (
                  <a
                    href={`tel:${restaurantProfile.telephone}`}
                    className="flex-shrink-0 w-10 h-10 bg-white/25 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors shadow"
                  >
                    <Phone className="w-5 h-5 text-white" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setShowQrScanner(v => !v)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm">Prendre une commande</p>
                    <p className="text-xs text-gray-500">Scanner le QR code ou saisir le numéro</p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showQrScanner ? 'rotate-90' : ''}`} />
              </button>

              {showQrScanner && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  {!scannerActive && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">Saisissez le numéro de commande imprimé sur le ticket :</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ex: 42"
                          value={qrInput}
                          onChange={e => setQrInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleQrAssign()}
                          type="number"
                          className="text-lg font-bold"
                          autoFocus
                        />
                        <Button onClick={handleQrAssign} className="bg-blue-600 hover:bg-blue-700 px-6">
                          ✓
                        </Button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-2 bg-white text-gray-500">OU</span>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setScannerActive(true)}
                        variant="outline" 
                        className="w-full gap-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                      >
                        <Camera className="w-4 h-4" />
                        Utiliser la caméra
                      </Button>
                    </div>
                  )}
                  


                  {scannedNum && !scannerActive && (
                    <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 text-center space-y-3">
                      <p className="text-green-700 font-bold text-lg">QR Scanné ✅</p>
                      <p className="text-green-900 text-2xl font-black">Commande #{scannedNum}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setScannedNum(null)}>
                          Annuler
                        </Button>
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={async () => {
                            const num = scannedNum;
                            setScannedNum(null);
                            setShowQrScanner(false);
                            await assignOrderByNumber(num);
                          }}
                        >
                          Confirmer
                        </Button>
                      </div>
                    </div>
                  )}

                  {scannerActive && (
                    <QrScannerView
                      onScan={(orderNum) => {
                        setScannerActive(false);
                        setScannedNum(orderNum);
                      }}
                      onClose={() => setScannerActive(false)}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="font-bold text-gray-700">Commandes en cours ({activeOrders.length})</h2>
              <button onClick={() => loadOrders(deliveryPerson)} className="text-xs text-blue-600">
                {isLoadingOrders ? '⟳ Chargement...' : '⟳ Actualiser'}
              </button>
            </div>

            {activeOrders.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-gray-400">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune commande assignée</p>
                  <p className="text-xs mt-1">Scannez un ticket ou demandez au responsable</p>
                </CardContent>
              </Card>
            )}

            {activeOrders.map(order => {
              const customer = customers[order.customer_id];
              const status = statusConfig[order.statut] || { label: order.statut, color: 'bg-gray-100 text-gray-700' };
              const isActive = activeOrderId === order.id;
              const deliveryAddr = order.delivery_address || (customer ? `${customer.adresse || ''}, ${customer.code_postal || ''} ${customer.ville || ''}`.trim() : '');

              return (
                <Card key={order.id} className={`mb-3 border-2 transition-all ${isActive ? 'border-orange-400 shadow-lg' : 'border-transparent'}`}>
                  <CardContent className="p-0">
                    <button
                      className="w-full p-4 flex items-center justify-between"
                      onClick={() => setActiveOrderId(isActive ? null : order.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center font-bold text-orange-700 text-lg">
                          #{order.numero_caisse}
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{customer ? `${customer.prenom} ${customer.nom}` : 'Client inconnu'}</p>
                          <p className="text-xs text-gray-500 break-words">{deliveryAddr || 'Adresse non renseignée'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={status.color + ' text-xs'}>{status.label}</Badge>
                        <span className="font-bold text-sm">{(order.total_ttc || 0).toFixed(2)}€</span>
                      </div>
                    </button>

                    {isActive && (
                      <div className="px-4 pb-4 space-y-3 border-t border-orange-100 bg-orange-50 rounded-b-xl">
                        {customer && (
                          <div className="pt-3 space-y-2">
                            {customer.telephone && (
                              <a
                                href={`tel:${customer.telephone}`}
                                className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm active:scale-95 transition-transform"
                              >
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                  <Phone className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Appeler le client</p>
                                  <p className="font-bold text-green-700">{customer.telephone}</p>
                                </div>
                              </a>
                            )}
                            {deliveryAddr && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddr)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm active:scale-95 transition-transform"
                              >
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <Navigation className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex-1 text-left">
                                  <p className="text-xs text-gray-500">Itinéraire GPS</p>
                                  <p className="font-medium text-blue-700 text-sm break-words">{deliveryAddr}</p>
                                  {customer.etage && <p className="text-xs text-gray-500">🏢 {customer.etage}</p>}
                                  {customer.interphone && <p className="text-xs text-gray-500">🔔 {customer.interphone}</p>}
                                </div>
                              </a>
                            )}
                          </div>
                        )}

                        {order.articles && (
                          <div className="bg-white rounded-xl p-3">
                            <p className="text-xs font-bold text-gray-500 mb-2">COMMANDE</p>
                            {order.articles.filter(a => !a.product_id?.startsWith('discount-') && !a.product_id?.startsWith('promo-')).map((a, i) => (
                              <div key={i} className="flex justify-between text-sm py-0.5">
                                <span>{a.quantite}× {a.nom_produit}</span>
                                <span className="font-medium">{((a.prix_unitaire || 0) * (a.quantite || 1)).toFixed(2)}€</span>
                              </div>
                            ))}
                            <Separator className="my-2" />
                            <div className="flex justify-between font-bold">
                              <span>Total</span>
                              <span className="text-orange-600">{(order.total_ttc || 0).toFixed(2)}€</span>
                            </div>
                            {order.notes && (
                              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                                📝 {order.notes}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="bg-white rounded-xl p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500">PAIEMENT</span>
                            <Badge className={order.payee ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                              {order.payee ? '✓ Payée' : order.mode_paiement_prevu || 'À encaisser'}
                            </Badge>
                          </div>
                        </div>

                        <Button
                          className="w-full h-12 text-base bg-green-600 hover:bg-green-700 text-white font-bold"
                          onClick={() => { setShowPayment(order); setSelectedPaymentMethod(null); }}
                        >
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Valider la livraison
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {historyOrders.length > 0 && (
            <div>
              <button
                className="w-full flex items-center justify-between px-1 mb-2"
                onClick={() => setShowHistory(v => !v)}
              >
                <h2 className="font-bold text-gray-500 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Historique ({historyOrders.length})
                </h2>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
              </button>

              {showHistory && historyOrders.map(order => {
                const customer = customers[order.customer_id];
                return (
                  <Card key={order.id} className="mb-2 opacity-70">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">#{order.numero_caisse} — {customer ? `${customer.prenom} ${customer.nom}` : ''}</p>
                        <p className="text-xs text-gray-500">{order.delivery_address || customer?.adresse}</p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-gray-100 text-gray-600 text-xs">Livrée</Badge>
                        <p className="text-sm font-bold mt-1">{(order.total_ttc || 0).toFixed(2)}€</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="h-6" />
        </div>
      </div>
    </>
  );
}
