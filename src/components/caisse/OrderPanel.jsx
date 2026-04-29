import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Trash2, Receipt, User, Search, RefreshCw, Info, TriangleAlert, Hourglass, Star, Ticket, LayoutGrid } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// This might be used by onViewCustomerHistory, but the component is not rendered here.
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import OpenDrawerButton from './OpenDrawerButton';
import PriceEditModal from './PriceEditModal';
import { appClient } from "@/api/appClient"; // New import
import { useTenant } from "../contexts/TenantContext";

// Fonction utilitaire pour sécuriser toFixed
const safeToFixed = (value, decimals = 2) => {
  const num = Number(value);
  if (isNaN(num) || num === null || num === undefined) return '0.00';
  return num.toFixed(decimals);
};

const formatCustomerAddress = (address, fallbackLabel = 'Adresse') => {
  if (!address) {
    return { title: fallbackLabel, value: '' };
  }

  const addressLine = [address.adresse, address.code_postal, address.ville].filter(Boolean).join(', ');
  const details = [
    address.etage ? `Etage ${address.etage}` : null,
    address.interphone ? `Interphone ${address.interphone}` : null,
  ].filter(Boolean).join(' · ');

  return {
    title: address.label || fallbackLabel,
    value: [addressLine, details].filter(Boolean).join(' · '),
  };
};

// New OrderSummary component as per outline, containing calculation logic
const OrderSummary = ({ currentOrder }) => {
  const { subTotal, offerDiscountValue, loyaltyDiscValue, promoDiscValue, total } = useMemo(() => {
    if (!currentOrder) {
      return { subTotal: 0, offerDiscountValue: 0, loyaltyDiscValue: 0, promoDiscValue: 0, total: 0 };
    }

    // Step 1: Calculate subTotal by summing only "true" product items
    const calculatedSubTotal = (currentOrder.articles || []).reduce((sum, item) => {
      // On ne somme que les vrais produits, pas les lignes de remise (correction applied)
      if (!item.product_id?.startsWith('discount-') && !item.product_id?.startsWith('loyalty-') && !item.product_id?.startsWith('promo-')) {
        return sum + (Number(item.prix_final_unitaire) * Number(item.quantite));
      }
      return sum;
    }, 0);

    // Step 2: Apply offer discounts (these are usually separate line items in `currentOrder.discounts`)
    const offerDiscount = (currentOrder.discounts || []).reduce((sum, d) => sum + d.amount, 0); // offerDiscountTotal is typically negative
    const totalAfterOffers = calculatedSubTotal + offerDiscount;

    // Step 3: Apply loyalty discount
    let calculatedLoyaltyDiscValue = 0;
    if (currentOrder.loyaltyDiscount && currentOrder.loyaltyDiscount.rule && totalAfterOffers > 0) {
      if (currentOrder.loyaltyDiscount.rule.type_recompense === 'percentage_discount') {
        calculatedLoyaltyDiscValue = -(totalAfterOffers * (currentOrder.loyaltyDiscount.rule.valeur_recompense / 100));
      } else if (currentOrder.loyaltyDiscount.rule.type_recompense === 'fixed_discount') {
        calculatedLoyaltyDiscValue = -currentOrder.loyaltyDiscount.rule.valeur_recompense;
      }
    }
    calculatedLoyaltyDiscValue = Math.max(calculatedLoyaltyDiscValue, -totalAfterOffers); // Cannot go below zero

    const totalAfterLoyalty = totalAfterOffers + calculatedLoyaltyDiscValue;

    // Step 4: Apply promo code discount
    let calculatedPromoDiscValue = 0;
    if (currentOrder.promoCode && totalAfterLoyalty > 0) {
      if (currentOrder.promoCode.type === 'percentage') {
        calculatedPromoDiscValue = totalAfterLoyalty * (currentOrder.promoCode.value / 100);
      } else { // fixed_amount
        calculatedPromoDiscValue = currentOrder.promoCode.value;
      }
      calculatedPromoDiscValue = Math.min(calculatedPromoDiscValue, totalAfterLoyalty); // Cannot go below zero
    }

    const finalTotal = totalAfterLoyalty - calculatedPromoDiscValue;

    return {
      subTotal: calculatedSubTotal,
      offerDiscountValue: offerDiscount,
      loyaltyDiscValue: calculatedLoyaltyDiscValue,
      promoDiscValue: calculatedPromoDiscValue,
      total: finalTotal,
    };
  }, [currentOrder?.articles, currentOrder?.discounts, currentOrder?.loyaltyDiscount, currentOrder?.promoCode]);

  // This component doesn't have any render logic in the outline.
  // It's primarily a calculation helper as per the outline's structure.
  return null;
};


const tableStatusConfig = {
    disponible: { label: 'Disponible', color: 'bg-green-100 text-green-800', borderColor: 'border-green-300' },
    occupee: { label: 'Occupée', color: 'bg-red-100 text-red-800', borderColor: 'border-red-300' },
    reservee: { label: 'Réservée', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-300' },
    a_nettoyer: { label: 'À nettoyer', color: 'bg-purple-100 text-purple-800', borderColor: 'border-purple-300' },
};


const OrderTypeSelector = ({ orderType, onOrderTypeChange, disabled, managesDeliveries }) => {
  const styles = {
    sur_place: "data-[state=active]:bg-blue-500 data-[state=active]:border-blue-600",
    emporter: "data-[state=active]:bg-orange-500 data-[state=active]:border-orange-600",
    livraison: "data-[state=active]:bg-purple-500 data-[state=active]:border-purple-600",
  };
  
  const colCount = [true, true, managesDeliveries].filter(Boolean).length;
  const gridClass = { 2: 'grid-cols-2', 3: 'grid-cols-3' }[colCount] || 'grid-cols-2';

  return (
    <Tabs value={orderType} onValueChange={onOrderTypeChange} className="w-full">
      <TabsList className={`grid w-full ${gridClass} h-12`}>
        <TabsTrigger value="sur_place" disabled={disabled} className={`text-sm border-b-4 border-transparent rounded-none data-[state=active]:text-white ${styles.sur_place}`}>Sur place</TabsTrigger>
        <TabsTrigger value="emporter" disabled={disabled} className={`text-sm border-b-4 border-transparent rounded-none data-[state=active]:text-white ${styles.emporter}`}>À emporter</TabsTrigger>
        {managesDeliveries && (
            <TabsTrigger value="livraison" disabled={disabled} className={`text-sm border-b-4 border-transparent rounded-none data-[state=active]:text-white ${styles.livraison}`}>Livraison</TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  );
};

const AddAddressInline = ({ customer, setCustomer, onAddressAdded }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: '', adresse: '', code_postal: '', ville: '', etage: '', interphone: '' });
  const [saving, setSaving] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!addressQuery || addressQuery.length < 3) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const cp = form.code_postal?.trim();
        let url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(addressQuery)}&limit=5`;
        if (cp && cp.length === 5) url += `&postcode=${cp}`;
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data.features || []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [addressQuery, form.code_postal]);

  const handleSelectSuggestion = (feature) => {
    const p = feature.properties;
    setForm(prev => ({ ...prev, adresse: p.name || '', code_postal: p.postcode || '', ville: p.city || '' }));
    setAddressQuery(p.name || '');
    setSuggestions([]);
  };

  const handleSave = async () => {
    if (!form.adresse.trim() || !form.ville.trim()) return;
    setSaving(true);
    try {
      const existingAdresses = customer.adresses || [];
      const newAdresses = [...existingAdresses, form];
      await appClient.entities.Customer.update(customer.id, { adresses: newAdresses });
      const addrStr = `${form.adresse}, ${form.code_postal || ''} ${form.ville}`.trim();
      setCustomer(prev => ({ ...prev, adresses: newAdresses, selectedAdresse: addrStr }));
      if (onAddressAdded) onAddressAdded(1 + newAdresses.length - 1); // index dans allAddresses (principale + nouvelles)
      setOpen(false);
      setForm({ label: '', adresse: '', code_postal: '', ville: '', etage: '', interphone: '' });
      setAddressQuery('');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-green-700 underline hover:text-green-900">
        + Ajouter une nouvelle adresse
      </button>
    );
  }

  return (
    <div className="bg-white border border-green-200 rounded-lg p-3 space-y-2">
      <p className="text-xs font-semibold text-green-800">Nouvelle adresse</p>
      <input placeholder="Libellé (ex: Travail)" value={form.label} onChange={e => setForm(p => ({...p, label: e.target.value}))} className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
      <div className="relative">
        <input
          placeholder="Adresse *"
          value={addressQuery}
          onChange={e => { setAddressQuery(e.target.value); setForm(p => ({...p, adresse: e.target.value})); }}
          className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow-lg max-h-40 overflow-y-auto">
            {suggestions.map((s, i) => (
              <div key={i} onClick={() => handleSelectSuggestion(s)} className="px-2 py-1.5 text-xs cursor-pointer hover:bg-blue-50 border-b last:border-b-0">
                <span className="font-medium">{s.properties.name}</span>
                <span className="text-gray-400 ml-1">{s.properties.postcode} {s.properties.city}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="Code postal" value={form.code_postal} onChange={e => setForm(p => ({...p, code_postal: e.target.value}))} className="border border-gray-200 rounded px-2 py-1 text-xs" />
        <input placeholder="Ville *" value={form.ville} onChange={e => setForm(p => ({...p, ville: e.target.value}))} className="border border-gray-200 rounded px-2 py-1 text-xs" />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="Étage" value={form.etage} onChange={e => setForm(p => ({...p, etage: e.target.value}))} className="border border-gray-200 rounded px-2 py-1 text-xs" />
        <input placeholder="Interphone" value={form.interphone} onChange={e => setForm(p => ({...p, interphone: e.target.value}))} className="border border-gray-200 rounded px-2 py-1 text-xs" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving || !form.adresse || !form.ville} className="flex-1 bg-green-600 text-white rounded px-2 py-1 text-xs font-semibold disabled:opacity-50">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="flex-1 bg-gray-100 text-gray-600 rounded px-2 py-1 text-xs">Annuler</button>
      </div>
    </div>
  );
};

const CustomerSearch = ({
  customer, // Changed from selectedCustomer
  setCustomer, // Changed from setSelectedCustomer
  orderType,
  onViewCustomerHistory,
}) => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ nom: "", prenom: "", telephone: "", adresse: "", code_postal: "", ville: "", etage: "", interphone: "", email: "", notes: "" });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSearchTerm, setAddressSearchTerm] = useState("");
  const { currentTenant } = useTenant();

  const { toast } = useToast();

  const loadCustomers = useCallback(async () => {
    if (searchTerm.length > 1) {
      try {
        const allCustomers = await appClient.entities.Customer.filter({ tenant_id: currentTenant.id }, '-created_date', 10000);
        const filteredCustomers = allCustomers.filter(c => {
          const searchLower = searchTerm.toLowerCase();
          return (
            (c.nom && c.nom.toLowerCase().includes(searchLower)) ||
            (c.prenom && c.prenom.toLowerCase().includes(searchLower)) ||
            (c.telephone && c.telephone.includes(searchTerm))
          );
        });
        setCustomers(filteredCustomers.slice(0, 10));
      } catch (error) {
        console.error("Erreur lors de la recherche de clients:", error);
        setCustomers([]);
      }
    } else {
      setCustomers([]);
    }
  }, [searchTerm, currentTenant]);

  const searchAddress = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    try {
      const postcode = newCustomer.code_postal?.trim();
      let url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`;
      if (postcode && postcode.length === 5) {
        url += `&postcode=${postcode}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setAddressSuggestions(data.features || []);
    } catch (error) {
      console.error("Erreur lors de la recherche d'adresse:", error);
      setAddressSuggestions([]);
    }
  }, [newCustomer.code_postal]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadCustomers();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [loadCustomers]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchAddress(addressSearchTerm);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [addressSearchTerm, searchAddress]);

  const handleAddCustomer = async () => {
    if (!newCustomer.nom || !newCustomer.telephone) {
        toast({ title: "Erreur", description: "Le nom et le téléphone sont obligatoires.", variant: "destructive"});
        return;
    }
    try {
      const primaryAddress = newCustomer.adresse?.trim()
        ? {
            label: 'Principale',
            adresse: newCustomer.adresse.trim(),
            code_postal: newCustomer.code_postal?.trim() || '',
            ville: newCustomer.ville?.trim() || '',
            etage: newCustomer.etage?.trim() || '',
            interphone: newCustomer.interphone?.trim() || '',
          }
        : null;
      const createdCustomer = await appClient.entities.Customer.create({
        ...newCustomer,
        adresses: [],
        tenant_id: currentTenant.id
      });
      const selectedAdresse = primaryAddress
        ? formatCustomerAddress(primaryAddress, 'Principale').value
        : '';
      setCustomer({ ...createdCustomer, selectedAdresse }); // Use setCustomer
      toast({ title: "Succès", description: "Nouveau client ajouté.", variant: "success"});
      setShowAddForm(false);
      setSearchTerm("");
      setNewCustomer({ nom: "", prenom: "", telephone: "", adresse: "", code_postal: "", ville: "", etage: "", interphone: "", email: "", notes: "" });
    } catch (error) {
      console.error("Erreur lors de la création du client:", error);
      toast({
        title: "Erreur",
        description: `Erreur lors de la création du client: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleShowAddForm = () => {
    setShowAddForm(prev => !prev);
    if (!showAddForm) {
      const phoneRegex = /^[\d\s+\-()]+$/;
      if (searchTerm && phoneRegex.test(searchTerm.trim())) {
        setNewCustomer(prev => ({ ...prev, telephone: searchTerm.trim() }));
      } else if (searchTerm) {
        const parts = searchTerm.split(' ');
        setNewCustomer(prev => ({ ...prev, prenom: parts[0] || '', nom: parts.slice(1).join(' ') || '' }));
      } else {
        setNewCustomer({ nom: "", prenom: "", telephone: "", adresse: "", code_postal: "", ville: "", etage: "", interphone: "", email: "", notes: "" });
      }
      setAddressSearchTerm("");
      setAddressSuggestions([]);
    }
  };

  const handleSelectAddress = (feature) => {
    const props = feature.properties;
    setNewCustomer(prev => ({
      ...prev,
      adresse: props.name || "",
      code_postal: props.postcode || "",
      ville: props.city || ""
    }));
    setAddressSearchTerm(props.name || "");
    setAddressSuggestions([]);
  };

  if (customer) {
    const adresseDisplay = customer.selectedAdresse || (customer.adresse ? `${customer.adresse}, ${customer.code_postal || ''} ${customer.ville || ''}`.trim() : '');
    const allAddresses = [
      customer.adresse ? {
        label: 'Principale',
        adresse: customer.adresse,
        code_postal: customer.code_postal,
        ville: customer.ville,
        etage: customer.etage,
        interphone: customer.interphone,
      } : null,
      ...(customer.adresses || []),
    ].filter((address) => address?.adresse);
    return (
      <>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-bold text-lg text-green-900">{customer.prenom} {customer.nom}</p>
              {customer.telephone && <p className="text-green-700 font-medium">{customer.telephone}</p>}
              {orderType === 'livraison' && adresseDisplay && (
                <p className="text-green-600 text-sm mt-1">📍 {adresseDisplay}</p>
              )}
              {orderType === 'livraison' && !adresseDisplay && (
                <p className="text-orange-500 text-xs mt-1">⚠️ Aucune adresse — sélectionnez via la fiche client</p>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setCustomer(null)}>Changer</Button>
          </div>
          {orderType === 'livraison' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-green-900">Choix de l'adresse de livraison</p>
              {allAddresses.length > 0 ? (
                <div className="space-y-2">
                  {allAddresses.map((address, index) => {
                    const formattedAddress = formatCustomerAddress(address, index === 0 ? 'Principale' : `Adresse ${index + 1}`);
                    return (
                      <button
                        key={`${address.adresse}-${index}`}
                        type="button"
                        onClick={() => setCustomer((prev) => ({ ...prev, selectedAdresse: formattedAddress.value }))}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          customer.selectedAdresse === formattedAddress.value
                            ? 'border-green-600 bg-white text-green-900'
                            : 'border-green-200 bg-white/80 text-gray-700 hover:border-green-400'
                        }`}
                      >
                        <span className="block font-semibold">{formattedAddress.title}</span>
                        <span className="block text-[11px] text-gray-500">{formattedAddress.value}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-orange-600">Aucune adresse enregistree pour ce client.</p>
              )}
              <AddAddressInline customer={customer} setCustomer={setCustomer} />
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-2 gap-2"
          onClick={() => onViewCustomerHistory(customer.id)}
        >
          <Info className="w-4 h-4" />
          Info client &amp; Historique {orderType === 'livraison' && '— changer adresse'}
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Rechercher ou créer un client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>
      {customers.length > 0 && (
        <div className="max-h-32 overflow-y-auto border rounded-md bg-white">
          {customers.map(c => (
            <div
              key={c.id}
              onClick={() => {
                const fallbackAddress = c.adresse
                  ? { adresse: c.adresse, code_postal: c.code_postal, ville: c.ville, etage: c.etage, interphone: c.interphone, label: 'Principale' }
                  : (c.adresses || [])[0] || null;
                const selectedAdresse = fallbackAddress ? formatCustomerAddress(fallbackAddress, 'Principale').value : '';
                setCustomer({ ...c, selectedAdresse });
                toast({
                    title: `Client sélectionné : ${c.prenom} ${c.nom}`,
                    description: `Solde cagnotte: ${(c.cagnotte_balance || 0).toFixed(2)}€`,
                });
                setSearchTerm('');
                setCustomers([]);
              }}
              className="p-2 cursor-pointer hover:bg-gray-100 border-b last:border-b-0"
            >
              <p className="font-medium text-sm">{c.prenom} {c.nom}</p>
              <p className="text-xs text-gray-600">{c.telephone}</p>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleShowAddForm}>
        <Plus className="w-4 h-4 mr-2" /> {showAddForm ? 'Masquer le formulaire' : 'Nouveau client'}
      </Button>
      {showAddForm && (
        <div className="p-3 bg-gray-50 rounded-md border space-y-2">
          <Input placeholder="Nom*" value={newCustomer.nom} onChange={(e) => setNewCustomer({...newCustomer, nom: e.target.value})} />
          <Input placeholder="Prénom" value={newCustomer.prenom} onChange={(e) => setNewCustomer({...newCustomer, prenom: e.target.value})} />
          <Input placeholder="Téléphone*" value={newCustomer.telephone} onChange={(e) => setNewCustomer({...newCustomer, telephone: e.target.value})} />
          <Input placeholder="Email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})} />
          
          <div className="space-y-1">
            <Input 
              placeholder="Code Postal (pour filtrer les adresses)" 
              value={newCustomer.code_postal} 
              onChange={(e) => setNewCustomer({...newCustomer, code_postal: e.target.value})}
              maxLength={5}
            />
          </div>

          <div className="relative">
            <Input 
              placeholder="Tapez l'adresse..." 
              value={addressSearchTerm} 
              onChange={(e) => {
                setAddressSearchTerm(e.target.value);
                setNewCustomer({...newCustomer, adresse: e.target.value});
              }}
            />
            {addressSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {addressSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectAddress(suggestion)}
                    className="p-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                  >
                    <p className="text-sm font-medium">{suggestion.properties.name}</p>
                    <p className="text-xs text-gray-500">{suggestion.properties.postcode} {suggestion.properties.city}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Input placeholder="Ville" value={newCustomer.ville} onChange={(e) => setNewCustomer({...newCustomer, ville: e.target.value})} />
          
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Étage / Appt" value={newCustomer.etage} onChange={(e) => setNewCustomer({...newCustomer, etage: e.target.value})} />
            <Input placeholder="Interphone" value={newCustomer.interphone} onChange={(e) => setNewCustomer({...newCustomer, interphone: e.target.value})} />
          </div>
          <Input placeholder="Notes" value={newCustomer.notes} onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})} />
          <div className="flex gap-2">
            <Button type="button" size="sm" className="w-full" onClick={handleAddCustomer}>Ajouter</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
};


// Main OrderPanel Component
export default function OrderPanel({
  currentOrder,
  setCurrentOrder,
  onFinalize,
  onHoldOrder,
  products,
  categories,
  profile,
  onClearOrder,
  isCheckingLoyalty,
  onCancelOrder,
  onSettleOrder,
  isDateClosed,
  onViewCustomerHistory,
  onApplyPromoCode,
  onRemovePromoCode,
  onSelectTableClick,
  getCurrentOrderType,
  onEditItem,
}) {
  const { toast } = useToast();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // La modification d'article est déléguée au parent via onEditItem
  const [priceEditItem, setPriceEditItem] = useState(null); // { cart_id, prix_final_unitaire, nom_produit }
  const [cancellationReason, setCancellationReason] = useState("");
  
  // UseMemo for totals and TVA details, adapted to use currentOrder.articles and currentOrder.discounts, etc.
  const { subTotal, totalTTC, offerDiscountAmount, loyaltyDiscountAmount, promoDiscountAmount, scratchDiscountAmount, tvaDetails, totalTVA } = useMemo(() => {
    if (!currentOrder) {
      return {
        subTotal: 0,
        totalTTC: 0,
        offerDiscountAmount: 0,
        loyaltyDiscountAmount: 0,
        promoDiscountAmount: 0,
        scratchDiscountAmount: 0,
        tvaDetails: {},
        totalTVA: 0,
      };
    }

    let initialSubTotalTTC = 0; // Sum of TTC prices of all items before overall order discounts
    const tvaAggregated = {}; // To store { rate: { base: HT, tva: TVA_amount } }

    (currentOrder.articles || []).forEach(item => {
      // Correction: Only sum regular products for initialSubTotalTTC and TVA aggregation
      // Exclude items that represent discounts (if they are stored in articles to avoid double counting)
      if (!item.product_id?.startsWith('discount-') && !item.product_id?.startsWith('loyalty-') && !item.product_id?.startsWith('promo-')) {
        // Assuming item.prix_final_unitaire is already TTC per unit
        const itemTTC = Number(item.prix_final_unitaire) * Number(item.quantite);
        const tvaRate = Number(item.tva_rate || 0); // Assuming item has a tva_rate field (e.g., 20, 10, 5.5)

        // Calculate HT and TVA for this item
        const itemHT = itemTTC / (1 + tvaRate / 100);
        const itemTVA_amount = itemTTC - itemHT;

        // Aggregate TVA details
        if (!tvaAggregated[tvaRate]) {
          tvaAggregated[tvaRate] = { base: 0, tva: 0 };
        }
        tvaAggregated[tvaRate].base += itemHT;
        tvaAggregated[tvaRate].tva += itemTVA_amount;

        initialSubTotalTTC += itemTTC;
      }
    });

    const offerDisc = (currentOrder.discounts || []).reduce((sum, d) => sum + d.amount, 0); // offerDiscountTotal is typically negative
    const totalAfterOffers = initialSubTotalTTC + offerDisc;

    let totalBeforeLoyaltyAndPromo = totalAfterOffers;

    let loyaltyDiscValue = 0;
    if (currentOrder.loyaltyDiscount && currentOrder.loyaltyDiscount.rule && totalBeforeLoyaltyAndPromo > 0) {
      if (currentOrder.loyaltyDiscount.rule.type_recompense === 'percentage_discount') {
        loyaltyDiscValue = -(totalBeforeLoyaltyAndPromo * (currentOrder.loyaltyDiscount.rule.valeur_recompense / 100));
      } else if (currentOrder.loyaltyDiscount.rule.type_recompense === 'fixed_discount') {
        loyaltyDiscValue = -currentOrder.loyaltyDiscount.rule.valeur_recompense;
      }
    }
    loyaltyDiscValue = Math.max(loyaltyDiscValue, -totalBeforeLoyaltyAndPromo);

    const totalAfterLoyalty = totalBeforeLoyaltyAndPromo + loyaltyDiscValue;

    let promoDiscValue = 0;
    if (currentOrder.promoCode && totalAfterLoyalty > 0) {
      if (currentOrder.promoCode.type === 'percentage') {
        promoDiscValue = totalAfterLoyalty * (currentOrder.promoCode.value / 100);
      } else { // fixed_amount
        promoDiscValue = currentOrder.promoCode.value;
      }
      promoDiscValue = Math.min(promoDiscValue, totalAfterLoyalty);
    }

    // Apply scratch reduction from order.scratch_reduction or editingInfo (stored as positive value, needs to be negative for calculation)
    const scratchDisc = -(currentOrder.scratch_reduction || currentOrder.editingInfo?.scratch_reduction || 0);

    const finalTotalTTC = totalAfterLoyalty - promoDiscValue + scratchDisc;

    // Adjust TVA details proportionally if the total changed significantly due to discounts.
    // This is a simplification; for absolute precision, discounts should be applied to specific items.
    // However, for overall display, proportional adjustment is common.
    const totalMultiplier = initialSubTotalTTC > 0 ? finalTotalTTC / initialSubTotalTTC : 0;
    const finalTvaAggregated = {};
    let finalTotalTVA = 0;

    for (const rate in tvaAggregated) {
      if (tvaAggregated.hasOwnProperty(rate)) {
        finalTvaAggregated[rate] = {
          base: tvaAggregated[rate].base * totalMultiplier,
          tva: tvaAggregated[rate].tva * totalMultiplier
        };
        finalTotalTVA += finalTvaAggregated[rate].tva;
      }
    }

    return {
      subTotal: initialSubTotalTTC,
      totalTTC: finalTotalTTC,
      offerDiscountAmount: offerDisc,
      loyaltyDiscountAmount: loyaltyDiscValue,
      promoDiscountAmount: -promoDiscValue, // promoDiscountValue is positive, but it's a discount, so make it negative for display
      scratchDiscountAmount: scratchDisc,
      tvaDetails: finalTvaAggregated,
      totalTVA: finalTotalTVA,
    };
  }, [currentOrder?.articles, currentOrder?.discounts, currentOrder?.loyaltyDiscount, currentOrder?.promoCode, currentOrder?.scratch_reduction]);


  const [activeCustomerTab, setActiveCustomerTab] = useState('search');
  const [promoCodeInput, setPromoCodeInput] = useState("");
  // const [isTableSelectionOpen, setIsTableSelectionOpen] = useState(false); // Removed: New state for table selection modal - now managed by parent

  const managesDeliveries = profile?.manages_deliveries !== false;
  const managesTablePlan = profile?.table_plan_allowed === true && profile?.manages_table_plan === true;
  const forceImmediatePayment = profile?.force_immediate_payment === true;

  // Obtenir le type de commande actuel (avec fallback)
  const currentOrderType = getCurrentOrderType ? getCurrentOrderType() : (currentOrder?.orderType || 'sur_place');

  // Use currentOrder.orderType instead of orderType prop
  useEffect(() => {
    // If managesDeliveries is false, and current order type is 'livraison',
    // update the order type to 'emporter'. This also applies when currentOrder is null initially.
    if (!managesDeliveries && currentOrderType === 'livraison') {
      setCurrentOrder(prev => {
        const baseOrder = prev || {
          articles: [],
          notes: '',
          discounts: [],
          table: null,
          loyaltyDiscount: null,
          promoCode: null,
          customer: null
        };
        return { ...baseOrder, orderType: 'emporter' };
      });
    }
  }, [managesDeliveries, currentOrderType, setCurrentOrder]);

  // Retirer automatiquement le code promo s'il n'est pas valide pour le type de commande actuel
  useEffect(() => {
    if (currentOrder?.promoCode && currentOrderType) {
      const codeModes = currentOrder.promoCode.modes_commande || ['sur_place', 'emporter', 'livraison'];
      if (!codeModes.includes(currentOrderType)) {
        setCurrentOrder(prev => prev ? { ...prev, promoCode: null } : null);
        toast({
          title: "Code promo retiré",
          description: `Le code "${currentOrder.promoCode.code}" n'est pas valide pour ce type de commande.`,
          variant: "warning"
        });
      }
    }
  }, [currentOrderType, currentOrder?.promoCode, setCurrentOrder, toast]);

  // Retirer automatiquement l'avantage fidélité s'il n'est pas valide pour le type de commande actuel
  useEffect(() => {
    if (currentOrder?.loyaltyDiscount?.rule && currentOrderType) {
      const ruleModes = currentOrder.loyaltyDiscount.rule.modes_commande || ['sur_place', 'emporter', 'livraison'];
      if (!ruleModes.includes(currentOrderType)) {
        setCurrentOrder(prev => prev ? { ...prev, loyaltyDiscount: null } : null);
        toast({
          title: "Avantage fidélité retiré",
          description: `L'avantage "${currentOrder.loyaltyDiscount.rule.nom}" n'est pas valide pour ce type de commande.`,
          variant: "warning"
        });
      }
    }
  }, [currentOrderType, currentOrder?.loyaltyDiscount, setCurrentOrder, toast]);

  const handleClearCartAndReset = () => {
    onClearOrder();
  };

  const handleFinalize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if((currentOrder?.articles || []).length === 0) {
        toast({title: "Panier vide", description: "Ajoutez des produits avant d'encaisser.", variant: "destructive"});
        return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      onFinalize();
    } finally {
      // Réactiver après 3s pour permettre une nouvelle commande
      setTimeout(() => setIsSubmitting(false), 3000);
    }
  };

  const handleHoldOrder = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentOrder?.payee) {
      toast({
        title: "Action impossible",
        description: "Une commande déjà payée ne peut pas être remise en attente.",
        variant: "destructive"
      });
      return;
    }
    if((currentOrder?.articles || []).length === 0) {
        toast({title: "Panier vide", description: "Ajoutez des produits avant de mettre en attente.", variant: "destructive"});
        return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      onHoldOrder();
    } finally {
      setTimeout(() => setIsSubmitting(false), 3000);
    }
  };

  const itemCount = (currentOrder?.articles || []).reduce((sum, item) => sum + item.quantite, 0);

  const handleUpdateQuantity = (cartId, newQuantity) => {
    if (newQuantity < 0) return;
    const updatedArticles = (currentOrder?.articles || []).map(item =>
      item.cart_id === cartId ? { ...item, quantite: newQuantity } : item
    ).filter(item => item.quantite > 0);

    setCurrentOrder(prev => ({ ...prev, articles: updatedArticles }));
  };

  const isCheckoutDisabled = (
    // Livraison : besoin client avec adresse complète
    (managesDeliveries && currentOrderType === "livraison" && (!currentOrder?.customer || !(currentOrder.customer.selectedAdresse || currentOrder.customer.adresse) || !currentOrder.customer.telephone || !currentOrder.customer.nom)) || 
    // Table : besoin d'une table SEULEMENT si c'est une NOUVELLE commande (pas en édition)
    (managesTablePlan && currentOrderType === "sur_place" && !currentOrder?.table && !currentOrder?.id) || 
    // Panier vide
    (currentOrder?.articles || []).length === 0 || 
    // Journée clôturée
    isDateClosed
  );

  const isHoldDisabled =
    currentOrder?.payee ||
    (forceImmediatePayment && (currentOrderType === 'sur_place' || currentOrderType === 'emporter')) ||
    isDateClosed ||
    (currentOrder?.articles || []).length === 0;


  const handleCancelClick = () => {
    if (!currentOrder || !currentOrder.id) { // Check currentOrder for existence and ID
        toast({
            title: "Action impossible",
            description: "Aucune commande sélectionnée pour la suppression",
            variant: "destructive"
        });
        return;
    }
    if (currentOrder.payee) { // Assuming currentOrder has a 'payee' status
      toast({
        title: "Action impossible",
        description: "Vous ne pouvez pas annuler une commande qui a déjà été payée",
        variant: "destructive"
      });
      return;
    }
    setIsCancelConfirmOpen(true);
  };
  
  const handleConfirmCancel = () => {
    if (!cancellationReason.trim()) {
      toast({
        title: "Motif requis",
        description: "Veuillez saisir un motif pour l'annulation.",
        variant: "destructive"
      });
      return;
    }
    onCancelOrder(currentOrder, cancellationReason); // Pass currentOrder
    setIsCancelConfirmOpen(false);
    setCancellationReason("");
  };


  const orderTypeColors = {
    sur_place: "border-blue-500",
    emporter: "border-orange-500",
    livraison: "border-purple-500",
  };

  const tableStatus = currentOrder?.table ? tableStatusConfig[currentOrder.table.statut] || { label: currentOrder.table.statut, color: 'bg-gray-200', borderColor: 'border-gray-300' } : null;

  return (
    <>
    <div className="bg-white flex flex-col h-full">
      <OrderTypeSelector
        orderType={currentOrderType} // Utiliser currentOrderType au lieu de currentOrder?.orderType
        onOrderTypeChange={(type) => setCurrentOrder(prev => prev ? { ...prev, orderType: type } : { 
          articles: [], 
          orderType: type, 
          notes: '', 
          discounts: [], 
          table: null, 
          loyaltyDiscount: null, 
          promoCode: null, 
          customer: null 
        })}
        disabled={isDateClosed}
        managesDeliveries={managesDeliveries}
      />
      <header className={`p-4 border-b-4 ${isDateClosed ? 'border-red-500 bg-red-50' : orderTypeColors[currentOrderType]}`}>
        {isDateClosed && (
          <div className="mb-2 p-2 bg-red-100/80 border border-red-300 rounded text-red-800 text-sm">
            <strong>⚠️ Journée clôturée</strong>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">
            {currentOrder && currentOrder.id ? `Commande #${currentOrder.numero_commande || currentOrder.numero_caisse || '...'}` : "Nouvelle Commande"}
          </h2>
          <div className="flex items-center gap-2">
            {(currentOrder?.articles && currentOrder.articles.length > 0 || (currentOrder && currentOrder.id)) && (
              <Button 
                type="button"
                variant="outline" 
                size="sm" 
                onClick={handleClearCartAndReset} 
                className="gap-1 text-xs"
              >
                <RefreshCw className="w-3 h-3"/>
                Nouveau
              </Button>
            )}
            <Badge variant="secondary" className="bg-gray-200 text-gray-800">
              {itemCount} art.
            </Badge>
          </div>
        </div>
        
        {/* NOUVEAU: Afficheur d'informations de table */}
        {managesTablePlan && currentOrderType === 'sur_place' && currentOrder?.table && tableStatus && (
            <div 
                className={`mt-3 p-3 rounded-lg border flex justify-between items-center transition-all hover:shadow-md ${tableStatus.color} ${tableStatus.borderColor}`}
            >
                <div className="flex items-center gap-3">
                    <LayoutGrid className="w-8 h-8"/>
                    <div>
                        <span className="font-bold text-lg">{currentOrder.table.nom}</span>
                        <Badge variant="secondary" className={`ml-2 ${tableStatus.color}`}>{tableStatus.label}</Badge>
                    </div>
                </div>
                <div className="text-right">
                    <span className="font-bold text-xl">{safeToFixed(totalTTC)}€</span>
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs hover:bg-transparent" onClick={onSelectTableClick}>Changer</Button>
                </div>
            </div>
        )}
        
        {currentOrder && currentOrder.id && currentOrder.customer && (
          <div className="mt-1">
            <p className="text-sm font-normal text-gray-600 flex items-center gap-1">
              <User className="w-3 h-3"/>
              {`${currentOrder.customer.prenom || ''} ${currentOrder.customer.nom || ''}`.trim()}
            </p>
            {currentOrder.customer.selectedAdresse && (
              <p className="text-xs text-purple-600 mt-0.5">📍 {currentOrder.customer.selectedAdresse}</p>
            )}
          </div>
        )}
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          
          {managesTablePlan && currentOrderType === 'sur_place' && !isDateClosed && !currentOrder?.table && !currentOrder?.id && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Button className="w-full" onClick={onSelectTableClick}>
                    <LayoutGrid className="w-4 h-4 mr-2"/>
                    Choisir une table
                </Button>
            </div>
          )}

          {!isDateClosed && (currentOrderType !== 'sur_place' || !managesTablePlan || currentOrder?.id) && (
            <CustomerSearch
              customer={currentOrder?.customer}
              setCustomer={(c) => {
                console.log('[OrderPanel] Setting customer:', c);
                setCurrentOrder(prev => {
                  const baseOrder = prev || {
                    articles: [],
                    orderType: currentOrderType,
                    notes: '',
                    discounts: [],
                    table: null,
                    loyaltyDiscount: null,
                    promoCode: null,
                    customer: null,
                  };

                  const nextCustomer = typeof c === 'function' ? c(baseOrder.customer) : c;
                  return { ...baseOrder, customer: nextCustomer };
                });
              }}
              orderType={currentOrderType} // Use currentOrderType
              onViewCustomerHistory={onViewCustomerHistory}
            />
          )}

          {(currentOrder?.articles || []).length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Receipt className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Panier vide</p>
              <p className="text-sm">
                Sélectionnez des produits à droite.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(currentOrder?.articles || []).map((item) => (
                <div key={item.cart_id} className="bg-gray-50 p-3 rounded-lg flex items-start gap-3 shadow-sm">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{item.nom_produit}</p>

                    {item.isMenu && item.menuDetails && (
                      <div className="mt-2 pl-4 border-l-2 border-green-300 bg-green-50 rounded p-2">
                        <p className="text-xs font-medium text-green-700 mb-1">Composition :</p>
                        {item.menuDetails.map((menuArticle, index) => (
                          <div key={index} className="text-xs text-green-600 mb-1">
                            <span className="font-medium">• {menuArticle.product.nom}</span>
                            {menuArticle.selectedSize && (
                              <span className="text-green-500"> ({menuArticle.selectedSize})</span>
                            )}
                            {menuArticle.selectedOptions?.length > 0 && (
                              <div className="ml-3 text-green-500">
                                {menuArticle.selectedOptions.map(opt => (
                                  <div key={opt.id} className="flex justify-between">
                                    <span>+ {opt.nom}</span>
                                    {opt.price_surcharge > 0 && <span>+{safeToFixed(opt.price_surcharge)}€</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {menuArticle.excludedIngredients?.length > 0 && (
                              <div className="ml-3 text-red-500">
                                {menuArticle.excludedIngredients.map(ing => (
                                  <span key={ing.id} className="block">- Sans {ing.nom}</span>
                                ))}
                              </div>
                            )}
                            {menuArticle.notes && (
                              <div className="ml-3 text-blue-500 italic">
                                <span>Note: {menuArticle.notes}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!item.isMenu && item.selected_options?.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {item.selected_options.map(opt => (
                          <div key={opt.id} className="flex items-center text-xs text-gray-600 pl-2">
                            <span className="mr-1">↳</span>
                            <span>{opt.nom}</span>
                            {opt.price_surcharge > 0 &&
                              <span className="ml-auto text-green-600 font-medium">+{safeToFixed(opt.price_surcharge)}€</span>
                            }
                          </div>
                        ))}
                      </div>
                    )}

                    {!item.isMenu && item.excluded_ingredients?.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {item.excluded_ingredients.map(ing => (
                            <div key={ing.id} className="flex items-center text-xs text-red-600 pl-2">
                              <span className="mr-1">↳</span>
                              <span>Sans {ing.nom}</span>
                            </div>
                          ))}
                        </div>
                    )}

                    {!item.isMenu && item.notes && (
                      <div className="mt-1">
                        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded pl-2">
                          <span className="mr-1">📝</span>
                          <span className="italic">{item.notes}</span>
                        </div>
                      </div>
                    )}

                    {profile?.allow_item_edit && !item.isMenu && !currentOrder?.payee && onEditItem && (
                      <button
                        type="button"
                        onClick={() => onEditItem(item)}
                        className="mt-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs hover:bg-blue-100 active:scale-95 transition-all"
                        title="Modifier cet article"
                      >
                        ✏️ Modifier
                      </button>
                    )}
                    {profile?.allow_price_edit && !currentOrder?.payee ? (
                    <button
                      type="button"
                      onClick={() => setPriceEditItem({ cart_id: item.cart_id, prix_final_unitaire: item.prix_final_unitaire, nom_produit: item.nom_produit })}
                      className="mt-1 px-2 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 font-bold text-sm hover:bg-orange-100 active:scale-95 transition-all"
                    >
                      ✏️ {safeToFixed(item.prix_final_unitaire)}€
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">
                      Prix unitaire: {safeToFixed(item.prix_final_unitaire)}€
                    </p>
                  )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleUpdateQuantity(item.cart_id, item.quantite - 1)}
                        disabled={isDateClosed || (!!currentOrder?.payee && item.is_original && item.quantite <= (item.original_quantity ?? 1))}
                        title={(currentOrder?.payee && item.is_original && item.quantite <= (item.original_quantity ?? 1)) ? "Quantité originale payée : impossible de réduire" : undefined}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-bold text-md w-6 text-center">{item.quantite}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleUpdateQuantity(item.cart_id, item.quantite + 1)}
                        disabled={isDateClosed}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="font-bold text-right w-full pr-1">
                      {safeToFixed(item.prix_final_unitaire * item.quantite)}€
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {(currentOrder?.articles || []).length > 0 && (
            <div className="mt-4 space-y-2">
                <Label htmlFor="order-notes">Notes sur la commande</Label>
                <Input 
                    id="order-notes"
                    value={currentOrder?.notes || ''} 
                    onChange={(e) => setCurrentOrder(prev => ({ ...prev, notes: e.target.value }))} 
                    placeholder="Ex: Le client est pressé..." 
                    disabled={isDateClosed}
                />
            </div>
          )}
        </div>
      </ScrollArea>

      <footer className="p-4 border-t border-gray-200 bg-white space-y-3">
        {(currentOrder?.articles || []).length > 0 && (
          <>
            {!currentOrder?.promoCode ? (
                <div className="flex gap-2">
                    <Input 
                        placeholder="Code promo" 
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        disabled={isDateClosed}
                    />
                    <Button 
                        variant="outline" 
                        onClick={() => onApplyPromoCode(promoCodeInput)}
                        disabled={isDateClosed || !promoCodeInput}
                    >
                        Appliquer
                    </Button>
                </div>
            ) : (
                <div className="p-2 rounded-md bg-sky-50 border border-sky-200 flex justify-between items-center">
                    <p className="text-sm font-semibold text-sky-700">Code appliqué : <span className="font-bold">{currentOrder.promoCode.code}</span></p>
                    <Button variant="ghost" size="sm" onClick={onRemovePromoCode} className="text-red-500 hover:text-red-600">Retirer</Button>
                </div>
            )}
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Sous-total HT (Estimé):</span><span>{safeToFixed(totalTTC - totalTVA)}€</span></div> {/* Display estimated HT */}
              <div className="flex justify-between"><span>Total TVA (Estimée):</span><span>{safeToFixed(totalTVA)}€</span></div> {/* Display estimated total TVA */}
              <div className="flex justify-between"><span>Sous-total TTC:</span><span>{safeToFixed(subTotal)}€</span></div>
              
              {offerDiscountAmount < 0 && (
                <div className="text-green-600">
                  {(currentOrder?.discounts || []).map(d => ( // Iterate through original discounts to show names
                    <div key={d.id} className="flex justify-between font-medium">
                      <span>Remise: {d.name}</span>
                      <span>{safeToFixed(d.amount)}€</span>
                    </div>
                  ))}
                </div>
              )}

              {promoDiscountAmount < 0 && ( // Check if promoDiscountAmount is negative as per new calculation
                <div className="flex justify-between font-semibold text-sky-600">
                    <div className="flex items-center gap-1">
                      <Ticket className="w-4 h-4"/>
                      <span>Promo: {currentOrder?.promoCode.code}</span>
                    </div>
                    <span>{safeToFixed(promoDiscountAmount)}€</span> {/* Display promoDiscountAmount directly as it's already negative */}
                </div>
              )}

              {isCheckingLoyalty && (
                <div className="flex justify-center text-xs text-gray-500 py-1">
                  <p>Vérification avantage fidélité...</p>
                </div>
              )}
              {currentOrder?.loyaltyDiscount && loyaltyDiscountAmount < 0 && (
                <div className="flex justify-between text-yellow-600 font-semibold">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4"/>
                    <span>{currentOrder.loyaltyDiscount.name.replace('Fidélité: ', '')}</span>
                  </div>
                  <span>{safeToFixed(loyaltyDiscountAmount)}€</span>
                </div>
              )}

              {scratchDiscountAmount < 0 && (
                <div className="flex justify-between text-pink-600 font-semibold">
                  <span>🎫 Cadeau scratch</span>
                  <span>{safeToFixed(scratchDiscountAmount)}€</span>
                </div>
              )}

              <Separator />
              {currentOrder?.payee && currentOrder?.original_total != null && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Total commande initiale :</span>
                  <span>{safeToFixed(currentOrder.original_total)}€ (déjà payé)</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xl">
                <span>{currentOrder?.payee ? 'Supplément à encaisser :' : 'Total à payer:'}</span>
                <span className="text-orange-600">{safeToFixed(currentOrder?.payee && currentOrder?.original_total != null ? Math.max(0, totalTTC - currentOrder.original_total) : totalTTC)}€</span>
              </div>
            </div>

            {/* TVA Details block from outline */}
            <div className="text-xs text-gray-500 space-y-1">
                {Object.entries(tvaDetails).map(([rate, amounts]) => (
                    <div key={`ht-${rate}`} className="flex justify-between">
                        <span>Base HT ({rate}%)</span>
                        <span>{safeToFixed(amounts.base)}€</span>
                    </div>
                ))}
                {Object.entries(tvaDetails).map(([rate, amounts]) => (
                    <div key={`tva-${rate}`} className="flex justify-between">
                        <span>TVA ({rate}%)</span>
                        <span>{safeToFixed(amounts.tva)}€</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button 
                type="button"
                variant="destructive" 
                onClick={handleCancelClick}
                className="col-span-1 shadow-lg" 
                disabled={isDateClosed || !currentOrder || !currentOrder.id}
                title={!currentOrder?.id ? "Sélectionnez une commande à supprimer" : isDateClosed ? "Journée clôturée" : "Supprimer la commande"}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Supprimer
              </Button>
              <Button
                type="button"
                onClick={handleHoldOrder}
                className="col-span-1 bg-blue-600 hover:bg-blue-700 gap-2 shadow-lg"
                disabled={isHoldDisabled || isDateClosed || (currentOrder?.articles || []).length === 0}
                title={
                  currentOrder?.payee
                    ? "Une commande déjà payée ne peut pas être remise en attente"
                    : isHoldDisabled
                      ? "L'encaissement immédiat est requis pour ce type de commande."
                      : "Mettre la commande en attente"
                }
              >
                <Hourglass className="w-4 h-4" />
                Mettre en attente
              </Button>
              <Button
                type="button"
                onClick={handleFinalize}
                className="col-span-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg"
                disabled={isCheckoutDisabled || isSubmitting}
                title={isDateClosed ? "Journée clôturée - Aucune modification autorisée" : (isCheckoutDisabled ? "Veuillez sélectionner un client avec un panier non vide et, pour la livraison, une adresse complète (Nom, Téléphone, Adresse)." : "")}
              >
                <Receipt className="w-4 h-4" />
                {currentOrder && currentOrder.id ? "Valider & Payer" : "Encaisser"}
              </Button>
            </div>
            {isCheckoutDisabled && !isDateClosed && (currentOrder?.articles || []).length > 0 && (
                <>
                  {currentOrderType === 'livraison' && (
                    <div className="flex items-start gap-2 text-xs text-red-600 p-2 bg-red-50 rounded-md border border-red-200">
                      <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>Un client avec nom, téléphone et adresse est requis pour la livraison.</span>
                    </div>
                  )}
                  {managesTablePlan && currentOrderType === 'sur_place' && !currentOrder?.table && !currentOrder?.id && (
                     <div className="flex items-start gap-2 text-xs text-red-600 p-2 bg-red-50 rounded-md border border-red-200">
                        <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>Veuillez assigner une table pour cette commande.</span>
                    </div>
                  )}
                </>
            )}
          </>
        )}
        <div className="pt-2">
            <OpenDrawerButton />
        </div>
      </footer>
    </div>
    {priceEditItem && (
      <PriceEditModal
        isOpen={!!priceEditItem}
        currentPrice={priceEditItem.prix_final_unitaire}
        productName={priceEditItem.nom_produit}
        onClose={() => setPriceEditItem(null)}
        onConfirm={(newPrice) => {
          setCurrentOrder(prev => ({
            ...prev,
            articles: (prev.articles || []).map(a =>
              a.cart_id === priceEditItem.cart_id
                ? { ...a, prix_final_unitaire: newPrice }
                : a
            )
          }));
          setPriceEditItem(null);
        }}
      />
    )}
    <Dialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmer l'annulation</DialogTitle>
          <DialogDescription>
            Vous êtes sur le point d'annuler la commande #{currentOrder?.numero_commande || currentOrder?.numero_caisse || '...'}. Cette action est irréversible. Veuillez indiquer le motif de l'annulation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="cancellation-reason">Motif de l'annulation (obligatoire)</Label>
          <Textarea
            id="cancellation-reason"
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="Ex: Erreur de saisie, demande du client..."
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setIsCancelConfirmOpen(false); setCancellationReason(""); }}>Fermer</Button>
          <Button type="button" variant="destructive" onClick={handleConfirmCancel}>Confirmer l'annulation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

