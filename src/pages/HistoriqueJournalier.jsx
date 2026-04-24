import React, { useState, useEffect, useMemo, useCallback } from "react";
import { appClient } from "@/api/appClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  History,
  Search,
  Download,
  Calendar as CalendarIcon,
  RefreshCw,
  Filter,
  Receipt,
  Truck,
  Coffee,
  Package,
  Printer,
  Eye,
  Sheet,
  FileText,
  Clock,
  CheckCircle,
  PackageIcon,
  Box,
  Car,
  Ban,
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfToday, endOfToday } from "date-fns";
import { fr } from "date-fns/locale";
import { generateTicketHtml, triggerPrint } from "../components/caisse/ticketUtils";
import TicketViewerModal from "../components/historique/TicketViewerModal";
import { useToast } from "@/components/ui/use-toast";
import { useTenant } from "../components/contexts/TenantContext";
import { toParisDate as toParisDateValue } from "@/lib/dateParsing";

const ORDER_STATUS_LABELS = {
  'en_attente': 'En attente',
  'en_attente_paiement': 'Att. Paiement',
  'en_preparation': 'En préparation',
  'prete': 'Prête',
  'en_cours_de_livraison': 'En livraison',
  'livree': 'Livrée',
  'annulee': 'Annulée',
  'payé': 'Payée',
  'paye': 'Payée'
};

const ORDER_STATUS_COLORS = {
  'en_attente': 'bg-yellow-100 text-yellow-800',
  'en_attente_paiement': 'bg-orange-100 text-orange-800',
  'en_preparation': 'bg-blue-100 text-blue-800',
  'prete': 'bg-indigo-100 text-indigo-800',
  'en_cours_de_livraison': 'bg-purple-100 text-purple-800',
  'livree': 'bg-green-100 text-green-800',
  'annulee': 'bg-red-100 text-red-800',
  'payé': 'bg-green-100 text-green-800',
  'paye': 'bg-green-100 text-green-800'
};

const ORDER_TYPE_LABELS = {
  'sur_place': 'Sur place',
  'emporter': 'À emporter',
  'livraison': 'Livraison'
};

const ORDER_TYPE_COLORS = {
  'sur_place': 'bg-blue-100 text-blue-800',
  'emporter': 'bg-orange-100 text-orange-800',
  'livraison': 'bg-purple-100 text-purple-800'
};

// Configuration for order types with icons
const orderTypeConfig = {
  'sur_place': { label: ORDER_TYPE_LABELS.sur_place, color: ORDER_TYPE_COLORS.sur_place, icon: <Coffee className="w-3 h-3" /> },
  'emporter': { label: ORDER_TYPE_LABELS.emporter, color: ORDER_TYPE_COLORS.emporter, icon: <PackageIcon className="w-3 h-3" /> },
  'livraison': { label: ORDER_TYPE_LABELS.livraison, color: ORDER_TYPE_COLORS.livraison, icon: <Truck className="w-3 h-3" /> },
};

// Configuration for order statuses with icons
const orderStatusConfig = {
  'en_attente': { label: ORDER_STATUS_LABELS.en_attente, color: ORDER_STATUS_COLORS.en_attente, icon: <Clock className="w-3 h-3" /> },
  'en_attente_paiement': { label: ORDER_STATUS_LABELS.en_attente_paiement, color: ORDER_STATUS_COLORS.en_attente_paiement, icon: <Clock className="w-3 h-3" /> },
  'en_preparation': { label: ORDER_STATUS_LABELS.en_preparation, color: ORDER_STATUS_COLORS.en_preparation, icon: <Box className="w-3 h-3" /> },
  'prete': { label: ORDER_STATUS_LABELS.prete, color: ORDER_STATUS_COLORS.prete, icon: <CheckCircle className="w-3 h-3" /> },
  'en_cours_de_livraison': { label: ORDER_STATUS_LABELS.en_cours_de_livraison, color: ORDER_STATUS_COLORS.en_cours_de_livraison, icon: <Car className="w-3 h-3" /> },
  'livree': { label: ORDER_STATUS_LABELS.livree, color: ORDER_STATUS_COLORS.livree, icon: <CheckCircle className="w-3 h-3" /> },
  'annulee': { label: ORDER_STATUS_LABELS.annulee, color: ORDER_STATUS_COLORS.annulee, icon: <Ban className="w-3 h-3" /> },
  'payé': { label: 'Payée', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  'paye': { label: 'Payée', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
};


export default function HistoriqueJournalier() {
  const { filterByTenant, currentTenant } = useTenant();
  const [dateRange, setDateRange] = useState({ from: startOfToday(), to: endOfToday() });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const PARIS_TIMEZONE = 'Europe/Paris'; // Keep or redefine locally if removed globally

  // Fonction IDENTIQUE à celle d'OrdersList
  const toParisDate = useCallback((date) => {
    return toParisDateValue(date);
  }, [PARIS_TIMEZONE]);


  const selectedParisDate = useMemo(() => {
    // dateRange.from is already a Date object, apply timezone conversion
    return toParisDate(dateRange.from);
  }, [dateRange.from, toParisDate]);

  const selectedDateStr = selectedParisDate ? format(selectedParisDate, 'yyyy-MM-dd') : null;

  const { data: queryData, isLoading: ordersLoading, error, refetch } = useQuery({
    queryKey: ['historyData', selectedDateStr, currentTenant?.id],
    queryFn: async () => {
      const [allOrders, allCustomers] = await Promise.all([
        appClient.entities.Order.filter(filterByTenant(), '-created_date', 2000),
        appClient.entities.Customer.filter(filterByTenant()),
      ]);

      const filteredOrdersByDateAndStatus = allOrders.filter(order => {
        // Exclure les brouillons (en_attente) SAUF les commandes web (from_web)
        // Les commandes web en attente de paiement doivent être visibles pour la traçabilité
        if (order.statut === 'en_attente' && !order.from_web) {
          return false;
        }
        
        if (!order.created_date) return false;
        
        // Conversion IDENTIQUE à OrdersList
        const orderDate = toParisDate(order.created_date);
        
        if (!orderDate || isNaN(orderDate.getTime())) return false;
        
        const orderDayStr = format(orderDate, 'yyyy-MM-dd');
        
        return orderDayStr === selectedDateStr;
      });

      return { allOrders: filteredOrdersByDateAndStatus, allCustomers };
    },
    staleTime: 30 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!selectedDateStr && !!currentTenant,
  });

  const { allOrders: ordersFromQuery = [], allCustomers = [] } = queryData || {};

  const { dailyOrders, customersMap } = useMemo(() => {
    const customerMap = (allCustomers || []).reduce((acc, customer) => {
      acc[customer.id] = customer;
      return acc;
    }, {});
    
    const ordersWithCustomers = ordersFromQuery.map(order => ({
      ...order,
      customer: order.customer_id ? customerMap[order.customer_id] : null,
    }));

    const sortedOrders = ordersWithCustomers.sort((a, b) => {
      // Apply the same date conversion logic for sorting
      const dateA = toParisDate(a.created_date);
      const dateB = toParisDate(b.created_date);
      
      if (!dateA || !dateB || isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
      return dateB.getTime() - dateA.getTime();
    });

    return { dailyOrders: sortedOrders, customersMap: customerMap };
  }, [ordersFromQuery, allCustomers, toParisDate]);

  const orders = dailyOrders;
  const customers = customersMap;

  const [deliveryPeople, setDeliveryPeople] = useState({});
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadStaticData = async () => {
      try {
        if (!profile) {
          const profileData = await appClient.entities.RestaurantProfile.filter(filterByTenant());
          if (profileData && profileData.length > 0) {
            setProfile(profileData[0]);
          }
        }
        const deliveryPeopleData = await appClient.entities.DeliveryPerson.filter(filterByTenant());
        const deliveryPeopleMap = deliveryPeopleData.reduce((acc, person) => {
          acc[person.id] = person;
          return acc;
        }, {});
        setDeliveryPeople(deliveryPeopleMap);
      } catch (error) {
        console.error("Erreur lors du chargement des données statiques:", error);
      }
    };
    if (currentTenant) {
      loadStaticData();
    }
  }, [profile, currentTenant, filterByTenant]);

  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [viewingOrder, setViewingOrder] = useState(null);

  const stats = useMemo(() => {
    const revenueOrders = filteredOrders.filter(order => order.statut !== 'annulee');
    const totalRevenue = revenueOrders.reduce((sum, order) => sum + (order.total_ttc || 0), 0);
    const paidOrdersCount = filteredOrders.filter(order => order.payee && order.statut !== 'annulee').length;

    return {
      totalOrders: filteredOrders.length,
      totalRevenue: totalRevenue,
      avgOrderValue: revenueOrders.length > 0 ? totalRevenue / revenueOrders.length : 0,
      paidOrders: paidOrdersCount
    };
  }, [filteredOrders]);

  useEffect(() => {
    let currentFiltered = orders;

    if (searchTerm) {
      currentFiltered = currentFiltered.filter(order =>
        (order.numero_commande && order.numero_commande.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.numero_caisse && order.numero_caisse.toString().includes(searchTerm))
      );
    }

    if (typeFilter !== "all") {
      currentFiltered = currentFiltered.filter(order => order.type_commande === typeFilter);
    }

    if (paymentFilter !== "all") {
      if (paymentFilter === "paid") {
        currentFiltered = currentFiltered.filter(order => order.payee === true && order.statut !== 'annulee');
      } else if (paymentFilter === "unpaid") {
        currentFiltered = currentFiltered.filter(order => order.payee !== true && order.statut !== 'annulee');
      } else if (paymentFilter === "cancelled") {
        currentFiltered = currentFiltered.filter(order => order.statut === 'annulee');
      }
    }

    setFilteredOrders(currentFiltered);
  }, [orders, searchTerm, typeFilter, paymentFilter]);

  const handlePrintTicket = async (order) => {
    if (!profile) {
      alert("Profil restaurant non configuré. Veuillez configurer votre établissement dans les paramètres.");
      return;
    }

    try {
      const customer = order.customer;
      const orderForPrint = { ...order }; 
      const ticketHtml = generateTicketHtml(orderForPrint, customer, profile); 
      if (ticketHtml) {
        triggerPrint(ticketHtml);
      } else {
        alert("Erreur lors de la génération du ticket.");
      }
    } catch (error) {
      console.error("Erreur lors de l'impression:", error);
      alert("Une erreur est survenue lors de l'impression.");
    }
  };

  const handleViewOrder = (order) => {
    setViewingOrder(order);
  };

  const exportToCSV = () => {
    if (filteredOrders.length === 0) {
      toast({
        title: "Export CSV",
        description: "Aucune donnée à exporter.",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Numéro', 'Date', 'Heure', 'Type', 'Client', 'Statut', 'Paiement', 'Total TTC'];

    const csvData = filteredOrders.map(order => {
      const clientName = order.customer
        ? `${order.customer.prenom || ''} ${order.customer.nom || ''}`.trim()
        : 'Anonyme';
      const paymentStatus = order.statut === 'annulee' ? '-' : (order.payee ? 'Payée' : 'Non payée');
      const totalValue = order.total_ttc?.toFixed(2).replace('.', ',') || '0,00';

      // Apply consistent date conversion logic for CSV
      const orderParisDate = toParisDate(order.created_date);

      return [
        `"${order.numero_commande || order.numero_caisse || order.id?.slice(-4) || 'N/A'}"`, // Updated
        `"${order.created_date && orderParisDate && !isNaN(orderParisDate.getTime()) ? format(orderParisDate, 'dd/MM/yyyy', { locale: fr }) : ''}"`,
        `"${order.created_date && orderParisDate && !isNaN(orderParisDate.getTime()) ? format(orderParisDate, 'HH:mm', { locale: fr }) : ''}"`,
        `"${ORDER_TYPE_LABELS[order.type_commande] || order.type_commande}"`,
        `"${clientName.replace(/"/g, '""')}"`,
        `"${ORDER_STATUS_LABELS[order.statut] || order.statut}"`,
        `"${paymentStatus}"`,
        `"${totalValue}"`
      ].join(';');
    });

    const BOM = '\uFEFF';
    const csvContent = [headers.join(';'), ...csvData].join('\n');
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historique-${format(dateRange.from, 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export CSV",
      description: "L'historique a été exporté en CSV.",
    });
  };

  // generatePDFHtml is moved inside the component to access toParisDate
  const generatePDFHtml = useCallback((orders, customers, profile, date, stats) => {
    const formattedDate = format(date, 'dd MMMM yyyy', { locale: fr });

    const rows = orders.map(order => {
      const client = order.customer_id && customers[order.customer_id]
        ? `${customers[order.customer_id].prenom || ''} ${customers[order.customer_id].nom || ''}`.trim()
        : 'Anonyme';
      const paymentStatus = order.statut === 'annulee' ? '-' : (order.payee ? 'Payée' : 'Non payée');
      const totalClass = order.statut === 'annulee' ? 'text-gray-400 line-through' : '';
      const displayedTotal = order.statut === 'annulee' ? `(${order.total_ttc?.toFixed(2) || '0.00'}€)` : `${order.total_ttc?.toFixed(2) || '0.00'}€`;

      // Utiliser la même logique de formatage
      const orderDate = toParisDate(order.created_date);
      const timeStr = orderDate && !isNaN(orderDate.getTime()) ? format(orderDate, 'HH:mm', { locale: fr }) : 'N/A';

      return `
        <tr>
          <td>#${order.numero_commande || order.numero_caisse || order.id?.slice(-4) || 'N/A'}</td> <!-- Updated -->
          <td>${timeStr}</td>
          <td>${ORDER_TYPE_LABELS[order.type_commande] || order.type_commande}</td>
          <td>${client}</td>
          <td>${ORDER_STATUS_LABELS[order.statut] || order.statut}</td>
          <td>${paymentStatus}</td>
          <td class="text-right ${totalClass}">${displayedTotal}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Rapport du ${formattedDate}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; font-size: 10px; }
          .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
          .header img { max-height: 50px; }
          .header h1 { font-size: 24px; margin: 0; }
          .header p { margin: 0; color: #555; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .summary-card { border: 1px solid #eee; border-radius: 8px; padding: 10px; text-align: center; }
          .summary-card p { margin: 0; color: #555; font-size: 10px; }
          .summary-card h3 { margin: 5px 0 0; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          thead { background-color: #f8f8f8; }
          th { font-weight: bold; }
          .text-right { text-align: right; }
          .text-gray-400 { color: #9ca3af; }
          .line-through { text-decoration: line-through; }
        </style>
      </head>
      <body onload="window.print()">
        <div class="header">
          <div>
            <h1>Rapport Journalier</h1>
            <p>Date: ${formattedDate}</p>
          </div>
          ${profile?.logo_url ? `<img src="${profile.logo_url}" alt="Logo">` : ''}
        </div>
        <div class="summary">
          <div class="summary-card">
            <p>Total Commandes</p>
            <h3>${stats.totalOrders}</h3>
          </div>
          <div class="summary-card">
            <p>Chiffre d'Affaires</p>
            <h3>${stats.totalRevenue.toFixed(2)}€</h3>
          </div>
          <div class="summary-card">
            <p>Panier Moyen</p>
            <h3>${stats.avgOrderValue.toFixed(2)}€</h3>
          </div>
          <div class="summary-card">
            <p>Commandes Payées</p>
            <h3>${stats.paidOrders}</h3>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>N° Commande</th>
              <th>Heure</th>
              <th>Type</th>
              <th>Client</th>
              <th>Statut</th>
              <th>Paiement</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
      </html>
    `;
  }, [toParisDate, fr, ORDER_TYPE_LABELS, ORDER_STATUS_LABELS]); // Dependencies for useCallback

  const exportToPDF = () => {
    if (filteredOrders.length === 0) {
      toast({
        title: "Export PDF",
        description: "Aucune donnée à exporter.",
        variant: "destructive",
      });
      return;
    }
    const htmlContent = generatePDFHtml(filteredOrders, customers, profile, dateRange.from, stats);
    triggerPrint(htmlContent);
    toast({
      title: "Export PDF",
      description: "Le rapport PDF est en cours de préparation pour l'impression.",
    });
  };

  // Fonction de formatage IDENTIQUE à OrdersList
  const formatOrderTime = useCallback((order) => {
    if (!order?.created_date) return 'N/A';
    
    const orderDate = toParisDate(order.created_date);
    
    if (!orderDate || isNaN(orderDate.getTime())) return "Date invalide";
    
    return format(orderDate, 'HH:mm', { locale: fr });
  }, [toParisDate, fr]);

  // Utility function to safely format numbers (used in table rendering)
  const safeToFixed = (num, precision = 2) => {
    if (typeof num !== 'number' || isNaN(num) || num === null) {
      return '0.00';
    }
    return num.toFixed(precision);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <History className="w-8 h-8 text-blue-500" />
              Historique Journalier
            </h1>
            <p className="text-gray-600 mt-2">
              Commandes du {format(dateRange.from, 'dd MMMM yyyy', { locale: fr })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {format(dateRange.from, 'dd/MM/yyyy', { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateRange.from}
                  onSelect={(newDay) => {
                    if (newDay) {
                      setDateRange({ from: startOfDay(newDay), to: endOfDay(newDay) });
                    }
                  }}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>

            <Button onClick={() => refetch()} variant="outline" className="gap-2" disabled={ordersLoading}>
              <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  <Sheet className="mr-2 h-4 w-4" />
                  <span>Exporter en CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Exporter en PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-md border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Total Commandes
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.totalOrders}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Chiffre d'Affaires
                  </p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {stats.totalRevenue.toFixed(2)}€
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <span className="text-green-600 font-bold text-lg">€</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Panier Moyen
                  </p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {stats.avgOrderValue.toFixed(2)}€
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    Commandes Payées
                  </p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {stats.paidOrders}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Rechercher par n° commande..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {Object.entries(ORDER_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="État paiement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="paid">Payées</SelectItem>
                  <SelectItem value="unpaid">Non payées</SelectItem>
                  <SelectItem value="cancelled">Annulées</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => {
                  setSearchTerm("");
                  setTypeFilter("all");
                  setPaymentFilter("all");
                }}
                variant="outline"
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Updated Card for orders table */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-3">
                    <Receipt className="w-5 h-5" />
                    Commandes ({filteredOrders.length})
                </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-3" />
                <span className="text-gray-600">Chargement des commandes...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Aucune commande trouvée</p>
                <p className="text-sm">Essayez de modifier les filtres</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Commande</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Heure</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paiement</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map((order) => {
                      const customer = customers[order.customer_id];
                      const typeConfig = orderTypeConfig[order.type_commande] || { label: order.type_commande, color: 'bg-gray-100 text-gray-800', icon: null };
                      // Pour les commandes web en_attente, afficher "Att. paiement livraison/caisse"
                      const effectiveStatut = (order.from_web && order.statut === 'en_attente') ? 'en_attente_paiement' : order.statut;
                      const statusConfig = orderStatusConfig[effectiveStatut] || { label: effectiveStatut, color: 'bg-gray-100 text-gray-800', icon: null };
                      
                      return (
                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-gray-900">
                              #{order.from_web ? 'W' : order.from_kiosk ? 'B' : ''}{order.numero_commande || order.numero_caisse || order.id?.slice(-4)}
                            </div>
                            {order.from_web && (
                              <span className="text-xs text-blue-600 font-medium">🌐 Web</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatOrderTime(order)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={`flex items-center gap-1 w-fit ${typeConfig.color}`}>
                              {typeConfig.icon}
                              {typeConfig.label}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {customer ? `${customer.prenom || ''} ${customer.nom || ''}`.trim() : 'Anonyme'}
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={`flex items-center gap-1 w-fit ${statusConfig.color} text-xs`}>
                              {statusConfig.icon}
                              {statusConfig.label}
                            </Badge>
                            {order.statut === 'annulee' && order.motif_annulation && (
                              <p className="text-xs text-red-500 mt-1 max-w-[150px]">{order.motif_annulation}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={order.payee ? 'bg-green-100 text-green-800' : (order.statut === 'annulee' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800')}>
                              {order.statut === 'annulee' ? '-' : (order.payee ? 'Payée' : 'Non payée')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className={`font-bold text-lg text-gray-900 ${order.statut === 'annulee' ? 'text-gray-400 line-through' : ''}`}>
                              {safeToFixed(order.total_ttc)}€
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleViewOrder(order)} title="Voir le détail">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {viewingOrder && (
        <TicketViewerModal
          order={viewingOrder}
          customer={viewingOrder.customer}
          profile={profile}
          isOpen={!!viewingOrder}
          onClose={() => setViewingOrder(null)}
        />
      )}
    </div>
  );
}
