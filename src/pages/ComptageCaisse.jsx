import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Calculator,
  Euro,
  CheckCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  CreditCard,
  Banknote,
  FileText,
  CheckSquare
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useTenant } from "../components/contexts/TenantContext";
import { getDateKey, parseSupabaseDate, toParisDate as toParisDateValue } from "@/lib/dateParsing";

import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

const PAYMENT_LABELS = {
  especes: 'Espèces',
  carte_bancaire: 'Carte bancaire',
  cheque: 'Chèque',
  ticket_restaurant: 'Ticket restaurant'
};

const PAYMENT_ICONS = {
  especes: Banknote,
  carte_bancaire: CreditCard,
  cheque: CheckSquare,
  ticket_restaurant: FileText
};

const PAYMENT_METHOD_CONFIG = [
  { key: 'especes', label: 'Espèces', icon: Banknote, buttonClass: 'border-green-200 bg-green-50 text-green-700', totalClass: 'text-green-700' },
  { key: 'carte_bancaire', label: 'Carte bancaire', icon: CreditCard, buttonClass: 'border-blue-200 bg-blue-50 text-blue-700', totalClass: 'text-blue-700' },
  { key: 'cheque', label: 'Chèque', icon: CheckSquare, buttonClass: 'border-violet-200 bg-violet-50 text-violet-700', totalClass: 'text-violet-700' },
  { key: 'ticket_restaurant', label: 'Ticket restaurant', icon: FileText, buttonClass: 'border-orange-200 bg-orange-50 text-orange-700', totalClass: 'text-orange-700' },
];

export default function ComptageCaisse() {
  const { withTenant, filterByTenant, currentTenant, currentUser } = useTenant();
  const location = useLocation();
  const getDateFromUrl = useCallback(() => {
    const params = new URLSearchParams(location.search || '');
    let dateParam = params.get('date');

    if (!dateParam && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1] || '';
      dateParam = new URLSearchParams(hashQuery).get('date');
    }

    if (dateParam) {
      const [year, month, day] = dateParam.split('-').map(Number);
      if (year && month && day) {
        return new Date(year, month - 1, day);
      }
    }

    return new Date();
  }, [location.search]);

  const [selectedDate, setSelectedDate] = useState(() => getDateFromUrl());
  const [caisseCount, setCaisseCount] = useState({
    especes: '',
    carte_bancaire: '',
    cheque: '',
    ticket_restaurant: ''
  });
  const [keypadValue, setKeypadValue] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [includeAllDeliveries, setIncludeAllDeliveries] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [actionFeedback, setActionFeedback] = useState(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setSelectedDate(getDateFromUrl());
  }, [getDateFromUrl]);

  useEffect(() => {
    setActionFeedback(null);
  }, [selectedDate]);

  const dateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const { data: allOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['orders', currentTenant?.id],
    queryFn: () => appClient.entities.Order.filter(filterByTenant(), 1000),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    enabled: !!currentTenant,
  });

  const { data: clotureDuJour, isLoading: isLoadingCloture } = useQuery({
    queryKey: ['clotureForDate', dateStr, currentTenant?.id],
    queryFn: async () => {
      const existingClotures = await appClient.entities.ClotureCaisse.filter(filterByTenant(), '-date_cloture', 200);
      const sortedClotures = [...(existingClotures || [])].sort((a, b) => {
        const aTime = parseSupabaseDate(a?.updated_date || a?.created_date || a?.date_cloture)?.getTime() || 0;
        const bTime = parseSupabaseDate(b?.updated_date || b?.created_date || b?.date_cloture)?.getTime() || 0;
        return bTime - aTime;
      });
      return sortedClotures.find((cloture) => {
        return getDateKey(cloture?.date_cloture) === dateStr;
      }) || null;
    },
    enabled: !!selectedDate && !!currentTenant,
    staleTime: 0,
    cacheTime: 0
  });

  const { data: lastCloture, isLoading: isLoadingLastCloture } = useQuery({
    queryKey: ['lastCloture', currentTenant?.id],
    queryFn: async () => {
      const clotures = await appClient.entities.ClotureCaisse.filter(filterByTenant(), '-date_cloture', 1);
      return clotures[0] || null;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    enabled: !!currentTenant,
  });

  const lastClotureDate = useMemo(() => {
    if (lastCloture?.date_cloture) {
      return parseSupabaseDate(lastCloture.date_cloture);
    }
    return null;
  }, [lastCloture]);

  useEffect(() => {
    console.log('🔄 useEffect déclenché - includeAllDeliveries:', includeAllDeliveries);
    setForceUpdate(prev => prev + 1);
  }, [includeAllDeliveries]);

  const toParisDate = useCallback((dateString) => {
    return toParisDateValue(dateString);
  }, []);

  const ordersOfDay = useMemo(() => {
    if (!allOrders || allOrders.length === 0) {
      console.log('❌ Aucune commande disponible');
      return [];
    }
    
    const selectedDayString = dateStr;
    console.log('📅 Date sélectionnée:', selectedDayString);

    const filteredOrders = allOrders.filter(order => {
      if (!order?.created_date) {
        console.log('❌ Commande sans date:', order);
        return false;
      }
      
      if (order.statut === 'annulee' || order.statut === 'en_attente') {
        return false;
      }
      
      const orderDateInParis = toParisDate(order.created_date);
      if (!orderDateInParis) {
        return false;
      }
      const orderDayString = format(orderDateInParis, 'yyyy-MM-dd');
      
      const matches = orderDayString === selectedDayString;
      
      if (matches) {
        console.log(`✅ Commande #${order.numero_caisse} du ${orderDayString} - Type: ${order.type_commande} - Statut: ${order.statut} - Total: ${order.total_ttc}€`);
      }
      
      return matches;
    });

    console.log(`📊 Total commandes du jour (avant filtrage livraisons): ${filteredOrders.length}`);
    
    return filteredOrders.sort((a, b) => {
      const dateA = parseSupabaseDate(a.created_date);
      const dateB = parseSupabaseDate(b.created_date);
      return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
    });
  }, [allOrders, dateStr, toParisDate]);

  const nextNumeroCaisse = useMemo(() => {
    const selectedDayString = dateStr;

    const ordersForCurrentDay = allOrders.filter(order => {
      if (!order?.created_date) return false;
      
      const orderDateInParis = toParisDate(order.created_date);
      if (!orderDateInParis) return false;
      const orderDayString = format(orderDateInParis, 'yyyy-MM-dd');
      
      return orderDayString === selectedDayString;
    });

    const maxNumeroCaisse = ordersForCurrentDay.reduce((max, order) => Math.max(max, order.numero_caisse || 0), 0);
    return maxNumeroCaisse + 1;
  }, [allOrders, dateStr, toParisDate]);

  const isDateClosed = useMemo(() => {
    const toParisDateLocal = (date) => toParisDateValue(date);

    const today = new Date();
    const todayInParis = toParisDateLocal(today);
    const todayStr = format(todayInParis, 'yyyy-MM-dd');

    const allUniqueOrderDates = [...new Set(
        (allOrders || [])
            .filter(o => o && o.created_date)
            .map(o => {
                const dateStrForOrder = o.created_date.replace(' ', 'T');
                const orderDate = toParisDateLocal(dateStrForOrder);
                if (!orderDate) return null;
                return format(orderDate, 'yyyy-MM-dd');
            }).filter(Boolean)
    )];

    const closedDates = new Set();
    
    const unclosedDays = allUniqueOrderDates
      .filter(date => date < todayStr && !closedDates.has(date))
      .sort();
    
    const workingDateInParisStr = format(toParisDateLocal(selectedDate), 'yyyy-MM-dd');
    const isCurrentDayClosedForPOS = closedDates.has(workingDateInParisStr);
    return isCurrentDayClosedForPOS || unclosedDays.length > 0;
  }, [allOrders, selectedDate]);

  useEffect(() => {
    if (clotureDuJour) {
      const savedBreakdown = clotureDuJour.details_compte
        || clotureDuJour.montant_reel?.details_compte
        || clotureDuJour.montant_reel?.breakdown
        || null;
      if (savedBreakdown) {
         setCaisseCount({
          especes: (savedBreakdown.especes !== undefined && savedBreakdown.especes !== null) ? parseFloat(savedBreakdown.especes).toFixed(2) : '',
          carte_bancaire: (savedBreakdown.carte_bancaire !== undefined && savedBreakdown.carte_bancaire !== null) ? parseFloat(savedBreakdown.carte_bancaire).toFixed(2) : '',
          cheque: (savedBreakdown.cheque !== undefined && savedBreakdown.cheque !== null) ? parseFloat(savedBreakdown.cheque).toFixed(2) : '',
          ticket_restaurant: (savedBreakdown.ticket_restaurant !== undefined && savedBreakdown.ticket_restaurant !== null) ? parseFloat(savedBreakdown.ticket_restaurant).toFixed(2) : ''
        });
      } else {
          setCaisseCount({especes: '', carte_bancaire: '', cheque: '', ticket_restaurant: ''});
      }
    } else {
      setCaisseCount({especes: '', carte_bancaire: '', cheque: '', ticket_restaurant: ''});
    }
  }, [clotureDuJour]);

  useEffect(() => {
    if (!actionFeedback?.title) return;
    if (actionFeedback.title === 'Journee cloturee') {
      window.alert(actionFeedback.description);
    }
    if (actionFeedback.title === 'Echec de la cloture') {
      window.alert(actionFeedback.description);
    }
  }, [actionFeedback]);

  const isLoading = isLoadingOrders || isLoadingCloture || isLoadingLastCloture;

  const currentEntryAmount = Number.isFinite(Number.parseFloat(keypadValue)) ? Number.parseFloat(keypadValue) : 0;

  const handleKeypadInput = (value) => {
    if (value === '.' && keypadValue.includes('.')) return;
    if (value === '.' && keypadValue === '') {
      setKeypadValue('0.');
      return;
    }
    setKeypadValue(prev => prev + value);
  };

  const handleKeypadBackspace = () => {
    setKeypadValue(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setKeypadValue('');
  };

  const clearAllCountedPayments = () => {
    setCaisseCount({
      especes: '',
      carte_bancaire: '',
      cheque: '',
      ticket_restaurant: ''
    });
    setKeypadValue('');
  };

  const addAmountToType = (type) => {
    if (currentEntryAmount <= 0) return;
    const currentAmountInField = parseFloat(caisseCount[type]) || 0;
    const newTotal = currentAmountInField + currentEntryAmount;
    setCaisseCount(prev => ({
      ...prev,
      [type]: newTotal.toFixed(2)
    }));
    setKeypadValue('');
  };

  const stats = useMemo(() => {
    console.log('');
    console.log('='.repeat(60));
    console.log('🔢 NOUVEAU CALCUL - forceUpdate:', forceUpdate);
    console.log('🎚️ includeAllDeliveries:', includeAllDeliveries);
    console.log('📦 ordersOfDay.length:', ordersOfDay.length);
    
    if (ordersOfDay.length === 0) {
      console.log('⚠️ AUCUNE COMMANDE POUR CE JOUR !');
      return {
        ordersForCashRegister: [],
        totalExpected: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        paymentBreakdown: {
          especes: 0,
          carte_bancaire: 0,
          cheque: 0,
          ticket_restaurant: 0
        },
        paidOrdersCount: 0,
        unpaidOrdersCount: 0
      };
    }
    
    let countSurPlace = 0;
    let countEmporter = 0;
    let countLivraisonInclus = 0;
    let countLivraisonExclus = 0;
    
    const ordersForCashRegister = [];
    
    for (const order of ordersOfDay) {
      const type = order.type_commande;
      
      if (type === 'sur_place') {
        ordersForCashRegister.push(order);
        countSurPlace++;
        console.log(`  ✅ #${order.numero_caisse} Sur place INCLUS - ${order.total_ttc}€`);
        continue;
      }
      
      if (type === 'emporter') {
        ordersForCashRegister.push(order);
        countEmporter++;
        console.log(`  ✅ #${order.numero_caisse} À emporter INCLUS - ${order.total_ttc}€`);
        continue;
      }
      
      if (type === 'livraison') {
        if (includeAllDeliveries) {
          ordersForCashRegister.push(order);
          countLivraisonInclus++;
          console.log(`  ✅ #${order.numero_caisse} Livraison INCLUSE - ${order.total_ttc}€`);
        } else {
          countLivraisonExclus++;
          console.log(`  ❌ #${order.numero_caisse} Livraison EXCLUE - ${order.total_ttc}€`);
        }
      }
    }
    
    console.log('');
    console.log('📊 RÉSULTATS:');
    console.log(`   Sur place: ${countSurPlace}`);
    console.log(`   À emporter: ${countEmporter}`);
    console.log(`   Livraisons incluses: ${countLivraisonInclus}`);
    console.log(`   Livraisons exclues: ${countLivraisonExclus}`);
    console.log(`   TOTAL RETENU: ${ordersForCashRegister.length}`);
    
    let totalExpected = 0;
    for (const order of ordersForCashRegister) {
      totalExpected += (order.total_ttc || 0);
    }
    
    console.log(`💰 TOTAL ATTENDU: ${totalExpected.toFixed(2)}€`);
    
    const paidOrders = ordersForCashRegister.filter(o => o.payee === true);
    const unpaidOrders = ordersForCashRegister.filter(o => o.payee !== true);
    
    const totalPaid = paidOrders.reduce((sum, order) => sum + (order.total_ttc || 0), 0);
    const totalUnpaid = unpaidOrders.reduce((sum, order) => sum + (order.total_ttc || 0), 0);
    
    const paymentBreakdown = {
      especes: 0,
      carte_bancaire: 0,
      cheque: 0,
      ticket_restaurant: 0
    };
    
    for (const order of paidOrders) {
      if (Array.isArray(order.mode_paiement)) {
        for (const payment of order.mode_paiement) {
          if (paymentBreakdown.hasOwnProperty(payment.methode)) {
            paymentBreakdown[payment.methode] += payment.montant || 0;
          }
        }
      }
    }
    
    console.log('='.repeat(60));
    console.log('');
    
    return {
      ordersForCashRegister,
      totalExpected,
      totalPaid,
      totalUnpaid,
      paymentBreakdown,
      paidOrdersCount: paidOrders.length,
      unpaidOrdersCount: unpaidOrders.length
    };
  }, [ordersOfDay, includeAllDeliveries, forceUpdate]);

  const countedTotal = Object.values(caisseCount).reduce((sum, value) => {
    const numericValue = parseFloat(value);
    return sum + (isNaN(numericValue) ? 0 : numericValue);
  }, 0);
  const difference = countedTotal - stats.totalExpected;

  const buildPayload = () => {
    const detailsCompte = {
      especes: parseFloat(caisseCount.especes) || 0,
      carte_bancaire: parseFloat(caisseCount.carte_bancaire) || 0,
      cheque: parseFloat(caisseCount.cheque) || 0,
      ticket_restaurant: parseFloat(caisseCount.ticket_restaurant) || 0
    };

    const clotureDateLocalNoon = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      12, 0, 0, 0
    );

    return {
      date_cloture: clotureDateLocalNoon.toISOString(),
      montant_theorique: {
        total: stats.totalExpected,
        total_paid: stats.totalPaid,
        total_unpaid: stats.totalUnpaid,
        paid_orders_count: stats.paidOrdersCount,
        unpaid_orders_count: stats.unpaidOrdersCount,
        details_attendu: stats.paymentBreakdown,
        include_all_deliveries: includeAllDeliveries,
      },
      montant_reel: {
        total: countedTotal,
        details_compte: detailsCompte,
      },
      ecarts: {
        total: difference,
      },
      notes: `Cloture caisse ${format(selectedDate, 'dd/MM/yyyy')} - ${currentUser?.full_name || currentUser?.email || 'utilisateur'}`,
      created_by: currentUser?.full_name || currentUser?.email || null,
    };
  };

  const upsertClotureForDay = async (payloadWithTenant, statut) => {
    const preservedStatut = clotureDuJour?.statut === 'cloturee' ? 'cloturee' : statut;
    const finalPayload = { ...payloadWithTenant, statut: preservedStatut };

    if (clotureDuJour?.id) {
      return appClient.entities.ClotureCaisse.update(clotureDuJour.id, finalPayload);
    }

    try {
      return await appClient.entities.ClotureCaisse.create(finalPayload);
    } catch (error) {
      const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
      const duplicateDayError = error?.code === '23505'
        || message.includes('duplicate key')
        || message.includes('uq_cloture_caisse_tenant_day');

      if (!duplicateDayError) throw error;

      const existingClotures = await appClient.entities.ClotureCaisse.filter(filterByTenant(), '-date_cloture', 200);
      const existingForDay = [...(existingClotures || [])]
        .sort((a, b) => {
          const aTime = parseSupabaseDate(a?.updated_date || a?.created_date || a?.date_cloture)?.getTime() || 0;
          const bTime = parseSupabaseDate(b?.updated_date || b?.created_date || b?.date_cloture)?.getTime() || 0;
          return bTime - aTime;
        })
        .find((cloture) => getDateKey(cloture?.date_cloture) === dateStr);

      if (!existingForDay?.id) throw error;

      return appClient.entities.ClotureCaisse.update(existingForDay.id, finalPayload);
    }
  };

  const handleSaveComptage = async () => {
    setIsSaving(true);
    const payload = buildPayload();
    try {
      if (clotureDuJour?.statut === 'cloturee') {
        if (!confirm("Vous êtes sur le point de modifier un comptage pour une journée déjà clôturée réglementairement. Voulez-vous continuer ?")) {
          setIsSaving(false);
          return;
        }
      }

      const payloadWithTenant = withTenant(payload);

      const savedCloture = await upsertClotureForDay(payloadWithTenant, clotureDuJour?.statut === 'cloturee' ? 'cloturee' : 'en_cours');
      queryClient.setQueryData(['clotureForDate', dateStr, currentTenant?.id], savedCloture);
      queryClient.setQueryData(['lastCloture', currentTenant?.id], savedCloture);
      setActionFeedback({
        type: 'success',
        title: 'Comptage enregistre',
        description: `Le comptage du ${format(selectedDate, 'dd/MM/yyyy')} a bien ete enregistre.`,
      });
      toast({
        title: "Succès",
        description: "Comptage enregistré avec succès !",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ['clotureForDate', dateStr, currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['lastCloture', currentTenant?.id] });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du comptage", error);
      setActionFeedback({
        type: 'error',
        title: 'Echec de l enregistrement',
        description: error?.message || "Une erreur est survenue lors de l'enregistrement.",
      });
      toast({
        title: "Erreur",
        description: error?.message || "Une erreur est survenue lors de l'enregistrement.",
        variant: "destructive",
      });
    }
    setIsSaving(false);
  };

  const handleCloture = async () => {
    const isAnyInputNonNumeric = Object.values(caisseCount).some(value => value !== '' && isNaN(parseFloat(value)));
    if (isAnyInputNonNumeric) {
      toast({
        title: "Erreur de saisie",
        description: "Veuillez vérifier que tous les montants saisis sont des nombres valides. Les champs vides sont traités comme zéro.",
        variant: "destructive",
      });
      return;
    }

    if (clotureDuJour?.statut === 'cloturee') {
      if (!confirm(`Cette journée est déjà clôturée. Confirmez-vous la mise à jour des totaux avec les nouveaux calculs ? L'écart sera de ${difference.toFixed(2)}€.`)) {
        return;
      }
    } else {
      if (!confirm(`Êtes-vous sûr de vouloir clôturer définitivement la journée avec un écart de ${difference.toFixed(2)}€ ? Cette action est irréversible.`)) {
        return;
      }
    }

    setIsClosing(true);
    setActionFeedback({
      type: 'success',
      title: 'Traitement en cours',
      description: `Cloture du ${format(selectedDate, 'dd/MM/yyyy')} en cours...`,
    });
    try {
      const payload = buildPayload();

      const payloadWithTenant = withTenant(payload);

      const savedCloture = await upsertClotureForDay(payloadWithTenant, 'cloturee');
      queryClient.setQueryData(['clotureForDate', dateStr, currentTenant?.id], savedCloture);
      queryClient.setQueryData(['lastCloture', currentTenant?.id], savedCloture);
      setActionFeedback({
        type: 'success',
        title: 'Journee cloturee',
        description: `La journee du ${format(selectedDate, 'dd/MM/yyyy')} a bien ete cloturee.`,
      });

      toast({
        title: "Succès",
        description: "La journée a été clôturée définitivement.",
        variant: "success",
      });

      // Invalider toutes les queries liées pour forcer un rafraîchissement complet
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['clotureForDate'] });
      await queryClient.invalidateQueries({ queryKey: ['lastCloture'] });
      await queryClient.invalidateQueries({ queryKey: ['posData'] });
      
      // Réinitialiser complètement le cache pour éviter les problèmes de clôture
      await queryClient.refetchQueries({ queryKey: ['posData'] });
    } catch (error) {
      console.error("Erreur lors de la clôture de caisse", error);
      setActionFeedback({
        type: 'error',
        title: 'Echec de la cloture',
        description: error?.message || "Une erreur est survenue lors de la clôture.",
      });
      toast({
        title: "Erreur",
        description: error?.message || "Une erreur est survenue lors de la clôture.",
        variant: "destructive",
      });
    } finally {
      setIsClosing(false);
    }
  };

  const isToday = () => {
    const today = new Date();
    return selectedDate.toDateString() === today.toDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Calculator className="w-8 h-8 text-orange-500" />
              Comptage de Caisse
            </h1>
            <p className="text-gray-600 mt-2">
              Vérifiez votre caisse pour le {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
              {isToday() && <span className="ml-2 text-green-600 font-medium">(Aujourd'hui)</span>}
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                Changer de date
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
        </div>

        {actionFeedback && (
          <Card className={`shadow-lg border ${actionFeedback.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <CardContent className="p-4">
              <p className={`font-semibold ${actionFeedback.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {actionFeedback.title}
              </p>
              <p className={`text-sm mt-1 ${actionFeedback.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {actionFeedback.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Interrupteur pour inclure les livraisons */}
        <div className="bg-blue-50 border-2 border-blue-200/50 rounded-xl p-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <Switch
                id="include-deliveries"
                checked={includeAllDeliveries}
                onCheckedChange={(checked) => {
                  console.log('');
                  console.log('🎚️ === CHANGEMENT DU CURSEUR ===');
                  console.log('Ancienne valeur:', includeAllDeliveries);
                  console.log('Nouvelle valeur:', checked);
                  console.log('================================');
                  console.log('');
                  setIncludeAllDeliveries(checked);
                }}
              />
              <div>
                <Label htmlFor="include-deliveries" className="font-semibold text-blue-900 cursor-pointer">
                  Inclure tous les encaissements des livreurs dans le comptage
                </Label>
                <p className="text-sm text-blue-700">
                  {includeAllDeliveries 
                    ? "✅ ACTIVÉ : Toutes les livraisons sont INCLUSES dans le total"
                    : "❌ DÉSACTIVÉ : Les livraisons sont EXCLUES du total"}
                </p>
              </div>
            </div>
        </div>

        {/* Affichage d'un avertissement si aucune commande */}
        {!isLoading && ordersOfDay.length === 0 && (
          <Card className="shadow-lg bg-yellow-50 border-yellow-200">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-yellow-600" />
              <h3 className="font-bold text-lg text-yellow-900 mb-2">Aucune commande pour ce jour</h3>
              <p className="text-yellow-700">
                Il n'y a aucune commande enregistrée pour le {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}.
              </p>
              <p className="text-sm text-yellow-600 mt-2">
                Vérifiez que vous avez sélectionné la bonne date.
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
           <div className="text-center py-12 text-gray-500">Chargement des données...</div>
        ) : (
          <div>
            {/* Affichage du statut de clôture s'il existe */}
            {clotureDuJour?.statut === 'cloturee' && (
              <Card className="shadow-lg bg-green-50 border-green-200 mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-green-800">
                    <CheckCircle className="w-8 h-8" />
                    Journée Clôturée Réglementairement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-700">
                        Cette journée a été clôturée le {format(new Date(clotureDuJour.updated_date), 'dd/MM/yyyy à HH:mm', { locale: fr })}{clotureDuJour.created_by ? <> par <strong>{clotureDuJour.created_by}</strong></> : null}.
                      </p>
                      <p className="text-sm text-green-600 mt-2">
                        ✓ Les commandes de cette date sont maintenant figées (conformité réglementaire)
                      </p>
                      <p className="text-sm text-blue-600 mt-1">
                        💡 Vous pouvez toujours continuer ou modifier le comptage physique ci-dessous
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Écart enregistré</p>
                      <p className={`text-2xl font-bold ${((clotureDuJour.ecart ?? clotureDuJour.ecarts?.total ?? 0) === 0) ? 'text-green-600' : 'text-red-600'}`}>
                        {(clotureDuJour.ecart ?? clotureDuJour.ecarts?.total ?? 0).toFixed(2)}€
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Euro className="w-5 h-5 text-green-500" />
                      Total Attendu en Caisse
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-4xl font-bold text-center text-green-600 mb-4">{stats.totalExpected.toFixed(2)}€</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <p className="text-gray-600">Total Payé</p>
                        <p className="font-semibold">{stats.totalPaid.toFixed(2)}€ ({stats.paidOrdersCount} cmd)</p>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <p className="text-gray-600">Total Impayé (à la caisse)</p>
                        <p className="font-semibold">{stats.totalUnpaid.toFixed(2)}€ ({stats.unpaidOrdersCount} cmd)</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      {includeAllDeliveries 
                        ? "Total incluant toutes les livraisons (au restaurant et chez les clients)."
                        : "Total incluant sur place et à emporter uniquement."}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Calculator className="w-5 h-5" />
                      Votre Comptage Physique
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl bg-slate-900 px-6 py-5 text-white">
                      <p className="text-sm uppercase tracking-[0.18em] text-slate-300">Total a verifier</p>
                      <p className="mt-3 text-5xl font-black tracking-tight">{stats.totalExpected.toFixed(2)} EUR</p>
                      <p className="mt-3 text-sm text-slate-300">{ordersOfDay.length} commande{ordersOfDay.length > 1 ? 's' : ''} - caisse du jour</p>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-bold text-slate-900">Verification du comptage</p>
                          <p className="text-sm text-slate-500">Saisis un montant puis clique sur un mode de paiement.</p>
                        </div>
                        <Button type="button" variant="outline" onClick={clearAllCountedPayments}>
                          Effacer tout
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {PAYMENT_METHOD_CONFIG.map((method) => {
                          const Icon = method.icon;
                          const counted = parseFloat(caisseCount[method.key]) || 0;
                          const expected = stats.paymentBreakdown[method.key] || 0;
                          const itemDifference = counted - expected;
                          return (
                            <button
                              key={method.key}
                              type="button"
                              onClick={() => addAmountToType(method.key)}
                              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-transform hover:-translate-y-0.5 ${method.buttonClass} ${currentEntryAmount > 0 ? 'ring-2 ring-offset-2 ring-slate-300' : ''}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-white/80 p-3">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-base font-bold">{method.label}</p>
                                  <p className="text-xs opacity-80">Attendu {expected.toFixed(2)} EUR</p>
                                  {Math.abs(itemDifference) > 0.01 && (
                                    <p className={`text-xs font-semibold ${itemDifference > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                      Ecart {itemDifference > 0 ? '+' : ''}{itemDifference.toFixed(2)} EUR
                                    </p>
                                  )}
                                </div>
                              </div>
                              <p className={`text-2xl font-black ${method.totalClass}`}>{counted.toFixed(2)} EUR</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm text-slate-500">Total attendu</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{stats.totalExpected.toFixed(2)} EUR</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-sm text-slate-500">Total saisi</p>
                        <p className="mt-2 text-3xl font-black text-slate-900">{countedTotal.toFixed(2)} EUR</p>
                      </div>
                      <div className={`rounded-2xl border p-4 ${
                        Math.abs(difference) < 0.01
                          ? 'border-green-200 bg-green-50'
                          : difference > 0
                            ? 'border-green-200 bg-green-50'
                            : 'border-red-200 bg-red-50'
                      }`}>
                        <p className={`text-sm ${
                          Math.abs(difference) < 0.01
                            ? 'text-green-700'
                            : difference > 0
                              ? 'text-green-700'
                              : 'text-red-700'
                        }`}>
                          {Math.abs(difference) < 0.01 ? 'Comptage equilibre' : difference > 0 ? 'Surplus' : 'Restant a saisir'}
                        </p>
                        <p className={`mt-2 text-3xl font-black ${
                          Math.abs(difference) < 0.01
                            ? 'text-green-700'
                            : difference > 0
                              ? 'text-green-700'
                              : 'text-red-700'
                        }`}>
                          {Math.abs(difference).toFixed(2)} EUR
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <Button
                    onClick={handleSaveComptage}
                    disabled={isSaving || isClosing}
                    variant="outline"
                    className="w-full text-lg py-6"
                  >
                    {isSaving ? 'Enregistrement...' : 'Enregistrer le comptage'}
                  </Button>
                   <Button
                    onClick={handleCloture}
                    disabled={isClosing || isSaving}
                    className="w-full text-lg py-6 bg-green-600 hover:bg-green-700"
                  >
                    {isClosing ? 'Clôture en cours...' :
                     clotureDuJour?.statut === 'cloturee' ? 'Mettre à jour la clôture' : 'Clôturer la journée'}
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <Card className="sticky top-8 border-0 shadow-xl">
                  <CardContent className="space-y-4 p-4">
                    <div className="rounded-2xl bg-slate-900 p-4 text-right text-white">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Montant en cours</p>
                      <p className="mt-2 text-4xl font-black">{keypadValue || '0'} EUR</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0'].map((key) => (
                        <Button
                          key={key}
                          type="button"
                          variant="outline"
                          className="h-16 text-2xl font-bold"
                          onClick={() => handleKeypadInput(key)}
                        >
                          {key}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-16 text-lg font-bold text-red-600"
                        onClick={handleKeypadBackspace}
                      >
                        Suppr
                      </Button>
                    </div>
                    <Button type="button" variant="outline" className="h-12 w-full" onClick={handleKeypadClear}>
                      Effacer tout
                    </Button>
                  </CardContent>
                </Card>
                <Card className="shadow-lg">
                   <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-base">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      Récapitulatif Attendu
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {Object.entries(stats.paymentBreakdown).map(([key, value]) => (
                        <li key={key} className="flex justify-between items-center text-sm">
                          <span className="flex items-center gap-2">
                            {React.createElement(PAYMENT_ICONS[key], { className: "w-4 h-4 text-gray-500"})}
                            {PAYMENT_LABELS[key]}:
                          </span>
                          <span className="font-semibold">{value.toFixed(2)}€</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="shadow-lg">
                  <CardHeader>
                     <CardTitle className="flex items-center gap-3 text-base">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      Détail des Commandes Incluses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between"><span>Sur Place:</span> <Badge>{stats.ordersForCashRegister.filter(o => o.type_commande === 'sur_place').length}</Badge></div>
                      <div className="flex justify-between"><span>À Emporter:</span> <Badge>{stats.ordersForCashRegister.filter(o => o.type_commande === 'emporter').length}</Badge></div>
                      <div className="flex justify-between">
                        <span>Livraisons {includeAllDeliveries ? '(toutes)' : '(exclues)'}:</span>
                        <Badge>{stats.ordersForCashRegister.filter(o => o.type_commande === 'livraison').length}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

