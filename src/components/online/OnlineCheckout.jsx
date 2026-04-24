import React, { useState, useEffect, useMemo } from 'react';
import { appClient } from '@/api/appClient';
import { ArrowLeft, CreditCard, Banknote, Loader2, MapPin, Tag, Wallet, CheckCircle2, X, Gift, ShoppingBag } from 'lucide-react';
import ScratchTicketDisplay from '../scratch/ScratchTicketDisplay';
import { calculateOfferDiscounts } from '@/utils/offerUtils';
import { computeTaxSummaryFromArticles } from '@/components/utils/taxUtils';

const SCRATCH_GAIN_KEY = 'scratch_pending_gain';
const unwrapInvokeResult = (result) => result?.data ?? result ?? null;

function buildScratchItem(gain) {
  if (gain.type === 'product') {
    return {
      _key: `scratch-gift-${Date.now()}`,
      product_id: gain.product_id || 'scratch-gift',
      nom_produit: `🎁 CADEAU: ${gain.product_nom}`,
      quantite: gain.quantite || 1,
      prix_unitaire: 0,
      total_ligne: 0,
      tva: 5.5,
      options: [],
      exclusions: [],
      is_scratch_gift: true,
    };
  } else if (gain.type === 'percentage_discount' || gain.type === 'fixed_discount') {
    const label = gain.type === 'percentage_discount'
      ? `Réduction -${gain.reduction_value}%`
      : `Réduction -${gain.reduction_value}€`;
    return {
      _key: `scratch-reduction-${Date.now()}`,
      product_id: 'scratch-reduction',
      nom_produit: `🎫 CADEAU SCRATCH: ${label}`,
      quantite: 1,
      prix_unitaire: 0,
      total_ligne: 0,
      tva: 0,
      options: [],
      exclusions: [],
      is_scratch_discount: true,
      scratch_discount_type: gain.type,
      scratch_discount_value: gain.reduction_value,
    };
  }
  return null;
}

export default function OnlineCheckout({ cart, orderType, tenant, profile, onBack, onSuccess, onCartChange, offers = [], products = [] }) {
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', telephone: '', adresse: '', code_postal: '', ville: '' });
  const [scratchBanner, setScratchBanner] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [cagnotteInfo, setCagnotteInfo] = useState(null);
  const [cagnotteAmount, setCagnotteAmount] = useState(0);
  const [cagnotteLoading, setCagnotteLoading] = useState(false);
  const [cagnotteChecked, setCagnotteChecked] = useState(false);

  const primaryColor = profile.kiosk_primary_color || '#f97316';

  // Lire le gain scratch depuis sessionStorage au montage
  // On ne l'applique PAS automatiquement — il sera utilisé uniquement si aucun ticket pre_payment n'est affiché.
  // La clé reste dans sessionStorage; le ScratchTicketDisplay (pre_payment) prendra le dessus si présent.
  // Si l'utilisateur a un gain en attente ET qu'il y a un ticket pre_payment, il gratte le nouveau ticket.
  // Le gain du sessionStorage est consommé uniquement s'il n'y a PAS de ticket pre_payment (géré par le bandeau scratchBanner).
  useEffect(() => {
    const raw = sessionStorage.getItem(SCRATCH_GAIN_KEY);
    if (!raw) return;
    try {
      const gain = JSON.parse(raw);
      const minimum = gain.montant_minimum || 0;
      const productsSubtotal = cart
        .filter(i => !i.is_scratch_discount && !i.is_scratch_gift)
        .reduce((s, i) => s + i.total_ligne, 0);
      const reached = minimum === 0 || productsSubtotal >= minimum;

      if (!reached) {
        setScratchBanner({ gain, minimum, manquant: minimum - productsSubtotal });
      }
      // Dans tous les cas, supprimer le gain du sessionStorage —
      // le ScratchTicketDisplay (pre_payment) va générer un nouveau ticket à gratter.
      sessionStorage.removeItem(SCRATCH_GAIN_KEY);
    } catch (e) {
      sessionStorage.removeItem(SCRATCH_GAIN_KEY);
    }
  }, []);

  // Calcul des réductions d'offres automatiques (achetez X → obtenez Y)
  const offerDiscounts = useMemo(() => {
    const realItems = cart.filter(i => !i.is_scratch_discount && !i.is_scratch_gift && i.product_id && !i.product_id.startsWith('offer-'));
    return calculateOfferDiscounts(realItems, offers, orderType, products);
  }, [cart, offers, orderType, products]);

  const offerDiscountTotal = offerDiscounts.reduce((sum, d) => sum + d.amount, 0); // négatif

  // Calculs panier
  const normalItems = cart.filter(item => !item.is_scratch_discount);
  const scratchDiscounts = cart.filter(item => item.is_scratch_discount);
  const productsTotal = normalItems.reduce((sum, item) => sum + item.total_ligne, 0);
  const deliveryFee = orderType === 'livraison' && profile.web_frais_livraison_enabled !== false
    ? (profile.web_frais_livraison ?? profile.frais_livraison ?? 0)
    : 0;
  const subtotalBeforeScratch = productsTotal + deliveryFee + offerDiscountTotal;

  let scratchReduction = 0;
  scratchDiscounts.forEach(disc => {
    if (disc.scratch_discount_type === 'percentage_discount') {
      scratchReduction += subtotalBeforeScratch * disc.scratch_discount_value / 100;
    } else if (disc.scratch_discount_type === 'fixed_discount') {
      scratchReduction += disc.scratch_discount_value;
    }
  });

  const subtotal = Math.max(0, subtotalBeforeScratch - scratchReduction);
  const promoDiscount = promoApplied
    ? promoApplied.type === 'percentage'
      ? parseFloat((subtotal * promoApplied.value / 100).toFixed(2))
      : promoApplied.value
    : 0;
  const afterPromo = Math.max(0, subtotal - promoDiscount);
  const maxCagnotte = Math.min(cagnotteInfo?.balance || 0, afterPromo);
  const finalTotal = Math.max(0, afterPromo - cagnotteAmount);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.prenom.trim()) e.prenom = true;
    if (!form.nom.trim()) e.nom = true;
    if (!form.email.includes('@')) e.email = true;
    if (form.telephone.replace(/\s/g, '').length < 10) e.telephone = true;
    if (orderType === 'livraison') {
      if (!form.adresse.trim()) e.adresse = true;
      if (!form.ville.trim()) e.ville = true;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCheckPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const codes = await appClient.entities.PromoCode.filter({
        tenant_id: tenant.id,
        code: promoInput.toUpperCase().trim(),
        active: true
      });
      if (codes.length === 0) {
        setPromoError('Code promo invalide ou inactif.');
      } else {
        const code = codes[0];
        const notExpired = !code.expires_at || new Date(code.expires_at) > new Date();
        const notOverLimit = !code.usage_limit || code.usage_count < code.usage_limit;
        const modeOk = !code.modes_commande || code.modes_commande.length === 0 || code.modes_commande.includes(orderType);
        const canalOk = !code.canaux || code.canaux.includes('site');
        if (!notExpired) setPromoError('Ce code promo a expiré.');
        else if (!notOverLimit) setPromoError("Ce code promo a atteint sa limite d'utilisation.");
        else if (!modeOk) setPromoError("Ce code promo n'est pas valide pour ce mode de commande.");
        else if (!canalOk) setPromoError("Ce code promo n'est pas disponible sur le site.");
        else setPromoApplied({ code: code.code, type: code.type, value: code.value });
      }
    } catch {
      setPromoError('Erreur lors de la vérification.');
    }
    setPromoLoading(false);
  };

  const handleCheckCagnotte = async () => {
    const phone = form.telephone.replace(/\s/g, '');
    if (phone.length < 10) { alert("Veuillez saisir votre numéro de téléphone d'abord."); return; }
    setCagnotteLoading(true);
    setCagnotteChecked(true);
    try {
      let res;
      try {
        res = unwrapInvokeResult(await appClient.functions.invoke('getCustomerCagnotte', { tenant_id: tenant.id, telephone: phone }));
      } catch {
        const customers = await appClient.entities.Customer.filter({ tenant_id: tenant.id, telephone: phone });
        const customer = customers[0];
        res = customer
          ? { found: true, customer_id: customer.id, cagnotte_balance: customer.cagnotte_balance || 0 }
          : { found: false, cagnotte_balance: 0 };
      }
      if (res?.found && res.cagnotte_balance > 0) {
        setCagnotteInfo({ balance: res.cagnotte_balance, customer_id: res.customer_id });
      } else {
        setCagnotteInfo({ balance: 0 });
      }
    } catch {
      setCagnotteInfo({ balance: 0 });
    }
    setCagnotteLoading(false);
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const isInIframe = window !== window.top;
    if (isInIframe && paymentMethod === 'online') {
      alert("Le paiement en ligne n'est pas disponible dans ce mode d'affichage.");
      return;
    }
    setIsSubmitting(true);
    const adresseComplete = orderType === 'livraison'
      ? `${form.adresse}, ${form.code_postal} ${form.ville}`.trim()
      : '';
    const articles = cart.filter(item => !item.is_scratch_discount).map(({ _key, ...item }) => item);
    // Ajouter les lignes de réduction d'offres comme articles
    const articlesWithOffers = [...articles];
    offerDiscounts.forEach(d => {
      articlesWithOffers.push({
        product_id: `offer-${d.id}`,
        nom_produit: `🎁 Offre: ${d.name}`,
        quantite: 1,
        prix_unitaire: d.amount,
        total_ligne: d.amount,
        tva: 0,
        options: [],
        exclusions: [],
      });
    });

    // Sauvegarder l'adresse comme adresse supplémentaire si le client existe déjà
    if (orderType === 'livraison' && form.adresse.trim()) {
      try {
        const phone = form.telephone.replace(/\s/g, '');
        const existingCustomers = await appClient.entities.Customer.filter({ tenant_id: tenant.id, telephone: phone });
        if (existingCustomers.length > 0) {
          const existing = existingCustomers[0];
          const mainAddr = existing.adresse || '';
          // Vérifier si l'adresse saisie est différente de la principale
          if (mainAddr.toLowerCase().trim() !== form.adresse.toLowerCase().trim()) {
            const existingAdresses = existing.adresses || [];
            const alreadySaved = existingAdresses.some(a => a.adresse?.toLowerCase().trim() === form.adresse.toLowerCase().trim());
            if (!alreadySaved) {
              const newAddr = { label: '', adresse: form.adresse, code_postal: form.code_postal, ville: form.ville };
              await appClient.entities.Customer.update(existing.id, { adresses: [...existingAdresses, newAddr] });
            }
          }
        }
      } catch (e) {
        console.error('Erreur sauvegarde adresse:', e);
      }
    }

    const taxSummary = computeTaxSummaryFromArticles(articlesWithOffers, finalTotal);

    const payload = {
      tenant_id: tenant.id,
      customer_email: form.email,
      customer_phone: form.telephone.replace(/\s/g, ''),
      customer_nom: form.nom,
      customer_prenom: form.prenom,
      customer_adresse: adresseComplete,
      articles: articlesWithOffers,
      type_commande: orderType,
      total_ttc: finalTotal,
      total_ht: taxSummary.totalHt,
      total_tva: taxSummary.totalTva,
      notes: '',
      payment_method: paymentMethod,
      promo_code: promoApplied ? promoApplied.code : null,
      promo_discount: promoDiscount > 0 ? promoDiscount : 0,
      cagnotte_amount: cagnotteAmount,
      scratch_reduction: scratchReduction
    };

    try {
      let orderRes;
      try {
        orderRes = unwrapInvokeResult(await appClient.functions.invoke('createWebOrder', payload));
      } catch {
        let customerId = null;
        const customerPhone = payload.customer_phone;
        const customerName = `${payload.customer_prenom || ''} ${payload.customer_nom || ''}`.trim();

        if (customerPhone) {
          const existingCustomers = await appClient.entities.Customer.filter({ tenant_id: tenant.id, telephone: customerPhone });
          if (existingCustomers[0]) {
            customerId = existingCustomers[0].id;
            await appClient.entities.Customer.update(customerId, {
              email: payload.customer_email || existingCustomers[0].email || '',
              nom: payload.customer_nom || existingCustomers[0].nom || '',
              prenom: payload.customer_prenom || existingCustomers[0].prenom || '',
              adresse: payload.customer_adresse || existingCustomers[0].adresse || '',
            });
          } else {
            const createdCustomer = await appClient.entities.Customer.create({
              tenant_id: tenant.id,
              nom: payload.customer_nom || '',
              prenom: payload.customer_prenom || '',
              telephone: customerPhone,
              email: payload.customer_email || '',
              adresse: payload.customer_adresse || '',
            });
            customerId = createdCustomer.id;
          }
        }

        const today = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
        const formattedDate = today.split('-').reverse().join('').slice(0, 6);
        const allOrders = await appClient.entities.Order.filter({ tenant_id: tenant.id });
        const todayOrders = allOrders.filter((order) => {
          if (!order?.created_date) return false;
          const normalized = String(order.created_date).replace(' ', 'T');
          const withTimezone = normalized.endsWith('Z') || /[+-]\d{2}(:?\d{2})?$/.test(normalized) ? normalized : `${normalized}Z`;
          const parsed = new Date(withTimezone);
          if (Number.isNaN(parsed.getTime())) return false;
          return parsed.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }) === today;
        });

        const nextNumeroCaisse = todayOrders.reduce((max, order) => Math.max(max, Number(order.numero_caisse) || 0), 0) + 1;
        const numeroCommande = `${nextNumeroCaisse}-${formattedDate}`;
        const createdOrder = await appClient.entities.Order.create({
          tenant_id: tenant.id,
          numero_caisse: nextNumeroCaisse,
          numero_commande: numeroCommande,
          customer_id: customerId,
          customer_name: customerName || customerPhone || 'Client web',
          type_commande: payload.type_commande,
          delivery_address: payload.customer_adresse,
          articles: payload.articles || [],
          total_ttc: payload.total_ttc || 0,
          total_ht: payload.total_ht || 0,
          total_tva: payload.total_tva || 0,
          statut: paymentMethod === 'online' ? 'en_attente_paiement' : 'en_attente',
          payee: false,
          from_web: true,
          print_at_counter: true,
          cagnotte_spent: payload.cagnotte_amount || 0,
          scratch_reduction: payload.scratch_reduction || 0,
          notes: payload.notes || '',
        });

        orderRes = {
          order_id: createdOrder.id,
          numero_commande: numeroCommande,
          final_total: createdOrder.total_ttc,
        };
      }

      const { order_id, final_total } = orderRes || {};
      const actualTotal = final_total ?? finalTotal;
      if (paymentMethod === 'online' && actualTotal > 0) {
        const slug = tenant.slug || '';
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        let checkoutRes = null;

        try {
          checkoutRes = unwrapInvokeResult(await appClient.functions.invoke('createWebCheckout', {
            order_id,
            tenant_id: tenant.id,
            articles,
            total_ttc: actualTotal,
            restaurant_name: profile.nom_etablissement,
            success_url: `${baseUrl}?slug=${slug}&success=true&order_id=${order_id}`,
            cancel_url: `${baseUrl}?slug=${slug}&cancelled=true`
          }));
        } catch {
          checkoutRes = null;
        }

        const checkoutUrl = checkoutRes?.checkout_url || checkoutRes?.url || null;
        if (!checkoutUrl || checkoutUrl.startsWith('#')) {
          alert("Le paiement en ligne n'est pas encore configuré pour ce restaurant. Utilisez 'payer à la caisse' ou 'paiement à la livraison'.");
          return;
        }

        window.location.href = checkoutUrl;
      } else {
        onSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors[field] ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-orange-200'}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Retour</span>
          </button>
          <h1 className="font-bold text-gray-900">Finaliser la commande</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Ticket scratch pre_payment — le gain est appliqué au panier APRÈS grattage */}
        <ScratchTicketDisplay
          tenantId={tenant.id}
          displayOn="pre_payment"
          cartTotal={cart.filter(i => !i.is_scratch_discount && !i.is_scratch_gift).reduce((s, i) => s + i.total_ligne, 0)}
          onAddToCart={(gain) => {
            const minimum = gain.montant_minimum || 0;
            const productsSubtotal = cart
              .filter(i => !i.is_scratch_discount && !i.is_scratch_gift)
              .reduce((s, i) => s + i.total_ligne, 0);
            if (minimum > 0 && productsSubtotal < minimum) {
              setScratchBanner({ gain, minimum, manquant: minimum - productsSubtotal });
              return;
            }
            const item = buildScratchItem(gain);
            if (item && onCartChange) onCartChange(prev => [...prev, item]);
          }}
          primaryColor={primaryColor}
          profile={profile}
        />

        {/* Bandeau scratch - minimum non atteint */}
        {scratchBanner && (
          <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-orange-800">Vous avez un cadeau scratch !</p>
                <p className="text-orange-700 font-semibold text-sm">
                  {scratchBanner.gain.type === 'product' ? `🎁 ${scratchBanner.gain.product_nom}` :
                   scratchBanner.gain.type === 'percentage_discount' ? `🏷️ -${scratchBanner.gain.reduction_value}%` :
                   `🏷️ -${scratchBanner.gain.reduction_value}€`}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-orange-200 text-center">
              <p className="text-sm text-orange-700">Il vous manque encore</p>
              <p className="text-2xl font-black text-orange-600">{scratchBanner.manquant.toFixed(2)}€</p>
              <p className="text-xs text-orange-500">pour atteindre le minimum de {scratchBanner.minimum.toFixed(2)}€</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onBack} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-orange-400 text-orange-700 font-semibold text-sm hover:bg-orange-100 transition-colors">
                <ShoppingBag className="w-4 h-4" /> Continuer mes achats
              </button>
              <button onClick={() => { sessionStorage.removeItem(SCRATCH_GAIN_KEY); setScratchBanner(null); }} className="py-2.5 rounded-xl bg-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-300 transition-colors">
                Continuer sans cadeau
              </button>
            </div>
          </div>
        )}

        {/* Récapitulatif */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3">Récapitulatif</h2>
          <div className="space-y-2">
            {normalItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.quantite}× {item.nom_produit}</span>
                <span className="font-medium">{item.total_ligne.toFixed(2)}€</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1">
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Frais de livraison</span><span>{deliveryFee.toFixed(2)}€</span>
              </div>
            )}
            {offerDiscounts.map(d => (
              <div key={d.id} className="flex justify-between text-sm text-purple-600 font-semibold">
                <span>🎁 {d.name}</span><span>{d.amount.toFixed(2)}€</span>
              </div>
            ))}
            {scratchReduction > 0 && (
              <div className="flex justify-between text-sm text-pink-600 font-semibold">
                <span>🎫 Cadeau scratch</span><span>-{scratchReduction.toFixed(2)}€</span>
              </div>
            )}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Code promo ({promoApplied.code})</span><span>-{promoDiscount.toFixed(2)}€</span>
              </div>
            )}
            {cagnotteAmount > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Cagnotte utilisée</span><span>-{cagnotteAmount.toFixed(2)}€</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span><span>{finalTotal.toFixed(2)}€</span>
            </div>
          </div>
        </div>

        {/* Informations client */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Vos informations</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prénom *</label>
              <input type="text" value={form.prenom} onChange={e => setField('prenom', e.target.value)} className={inputClass('prenom')} placeholder="Jean" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nom *</label>
              <input type="text" value={form.nom} onChange={e => setField('nom', e.target.value)} className={inputClass('nom')} placeholder="Dupont" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Email *</label>
              <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} className={inputClass('email')} placeholder="jean@email.com" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Téléphone *</label>
              <input type="tel" value={form.telephone} onChange={e => setField('telephone', e.target.value)} className={inputClass('telephone')} placeholder="06 12 34 56 78" />
            </div>
          </div>
        </div>

        {/* Adresse livraison */}
        {orderType === 'livraison' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Adresse de livraison
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Adresse *</label>
                <input type="text" value={form.adresse} onChange={e => setField('adresse', e.target.value)} className={inputClass('adresse')} placeholder="12 rue de la Paix" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Code postal</label>
                  <input type="text" value={form.code_postal} onChange={e => setField('code_postal', e.target.value)} className={inputClass('code_postal')} placeholder="75001" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ville *</label>
                  <input type="text" value={form.ville} onChange={e => setField('ville', e.target.value)} className={inputClass('ville')} placeholder="Paris" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Code promo */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4" style={{ color: primaryColor }} /> Code promo
          </h2>
          {promoApplied ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-bold text-green-700 text-sm">{promoApplied.code}</p>
                  <p className="text-xs text-green-600">
                    -{promoApplied.type === 'percentage' ? `${promoApplied.value}%` : `${promoApplied.value}€`} appliqué (-{promoDiscount.toFixed(2)}€)
                  </p>
                </div>
              </div>
              <button onClick={() => { setPromoApplied(null); setPromoInput(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input type="text" value={promoInput} onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }} onKeyDown={e => e.key === 'Enter' && handleCheckPromo()} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 uppercase" placeholder="Votre code promo" />
              <button onClick={handleCheckPromo} disabled={promoLoading || !promoInput.trim()} className="px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center gap-1" style={{ backgroundColor: primaryColor }}>
                {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
              </button>
            </div>
          )}
          {promoError && <p className="text-red-500 text-xs mt-2">{promoError}</p>}
        </div>

        {/* Cagnotte */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-500" /> Ma cagnotte
          </h2>
          {!cagnotteChecked ? (
            <div>
              <p className="text-sm text-gray-500 mb-3">Saisissez votre téléphone ci-dessus puis vérifiez votre solde cagnotte.</p>
              <button onClick={handleCheckCagnotte} disabled={cagnotteLoading} className="w-full border-2 border-amber-200 bg-amber-50 text-amber-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-100 transition-colors flex items-center justify-center gap-2">
                {cagnotteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wallet className="w-4 h-4" /> Vérifier mon solde cagnotte</>}
              </button>
            </div>
          ) : cagnotteInfo?.balance > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">Solde disponible :</p>
                <p className="font-bold text-amber-600 text-lg">{cagnotteInfo.balance.toFixed(2)}€</p>
              </div>
              <label className="text-xs text-gray-500 mb-1 block">Montant à utiliser (max {maxCagnotte.toFixed(2)}€)</label>
              <div className="flex gap-2 items-center">
                <input type="number" min="0" max={maxCagnotte} step="0.01" value={cagnotteAmount} onChange={e => setCagnotteAmount(Math.min(parseFloat(e.target.value) || 0, maxCagnotte))} className="flex-1 border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
                <button onClick={() => setCagnotteAmount(maxCagnotte)} className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">Tout utiliser</button>
              </div>
              {cagnotteAmount > 0 && <p className="text-xs text-amber-600 mt-1.5">-{cagnotteAmount.toFixed(2)}€ déduits de votre total</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Aucune cagnotte trouvée pour ce numéro de téléphone.</p>
          )}
        </div>

        {/* Mode de paiement */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Mode de paiement</h2>
          <div className="space-y-2">
            {finalTotal === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border-2 border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-semibold text-sm text-green-700">Commande entièrement couverte</p>
                  <p className="text-xs text-green-600">Cagnotte et/ou code promo couvrent l'intégralité du montant</p>
                </div>
              </div>
            ) : (
              <>
                <button onClick={() => setPaymentMethod('online')} className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${paymentMethod === 'online' ? 'bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`} style={{ borderColor: paymentMethod === 'online' ? primaryColor : undefined }}>
                  <CreditCard className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Paiement en ligne</p>
                    <p className="text-xs text-gray-400">Carte bancaire sécurisée (Stripe)</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex-shrink-0" style={{ borderColor: paymentMethod === 'online' ? primaryColor : '#d1d5db', backgroundColor: paymentMethod === 'online' ? primaryColor : 'transparent' }} />
                </button>
                <button onClick={() => setPaymentMethod('cash')} className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${paymentMethod === 'cash' ? 'bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`} style={{ borderColor: paymentMethod === 'cash' ? primaryColor : undefined }}>
                  <Banknote className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{orderType === 'livraison' ? 'Paiement à la livraison' : 'Payer à la caisse'}</p>
                    <p className="text-xs text-gray-400">{orderType === 'livraison' ? 'Espèces ou carte à la réception' : 'Règlement sur place à la récupération'}</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex-shrink-0" style={{ borderColor: paymentMethod === 'cash' ? primaryColor : '#d1d5db', backgroundColor: paymentMethod === 'cash' ? primaryColor : 'transparent' }} />
                </button>
              </>
            )}
          </div>
        </div>

        <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-4 text-white font-bold rounded-xl text-base transition-opacity disabled:opacity-70 flex items-center justify-center gap-2" style={{ backgroundColor: primaryColor }}>
          {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Traitement...</> : `Confirmer · ${finalTotal.toFixed(2)}€`}
        </button>

        <p className="text-xs text-center text-gray-400 pb-4">Paiement sécurisé par Stripe · Vos données sont protégées</p>
      </div>
    </div>
  );
}

