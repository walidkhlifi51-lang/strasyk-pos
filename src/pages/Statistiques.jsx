import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  Download,
  Receipt,
  Calendar as CalendarIcon,
  ShoppingCart,
  Users,
  FileText,
  Sheet,
  Settings,
  ArrowRight,
  ClipboardList,
  Euro,
  Percent
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, getYear, getMonth, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { getValidOrders } from "@/components/utils/orderUtils";

import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useTenant } from "@/components/contexts/TenantContext";
import { toParisDate as toParisDateValue } from "@/lib/dateParsing";
import { getInvoiceTypeLabel, isFinalInvoice } from "@/lib/invoiceDocuments";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import { StatCard } from '@/components/stats/StatCards';

import SalesChart from "../components/stats/SalesChart";
import TopProducts from "../components/stats/TopProducts";
import PaymentMethodsChart from "../components/stats/PaymentMethodsChart";
import OrderTypesChart from "../components/stats/OrderTypesChart";
import NF525Report from "../components/stats/NF525Report";

const EXPORT_SECTIONS = {
  mainStats: {
    id: 'mainStats',
    label: 'Statistiques principales',
    description: 'CA, commandes, panier moyen, nouveaux clients'
  },
  paymentMethods: {
    id: 'paymentMethods',
    label: 'Modes de paiement',
    description: 'Répartition par type de paiement'
  },
  orderTypes: {
    id: 'orderTypes',
    label: 'Types de commandes',
    description: 'Sur place, livraison, emporter'
  },
  topProducts: {
    id: 'topProducts',
    label: 'Top produits',
    description: 'Produits les plus vendus'
  },
  nf525Report: {
    id: 'nf525Report',
    label: 'Rapport de TVA',
    description: 'Détail des taxes collectées par taux'
  }
};

const ORDER_TYPE_LABELS = {
  "sur_place": "Sur place",
  "emporter": "À emporter",
  "livraison": "Livraison",
  "click_collect": "Click & Collect",
};

const ORDER_STATUS_LABELS = {
  "pending": "En attente",
  "completed": "Terminée",
  "cancelled": "Annulée",
  "refunded": "Remboursée",
  "preparing": "En préparation",
  "ready": "Prête",
  "delivered": "Livrée",
};

const PLATFORM_CHART_COLORS = ['#2563eb', '#f97316', '#14b8a6', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];

// Define the Paris timezone for consistent date comparisons
const PARIS_TIMEZONE = 'Europe/Paris';

// Helper function to convert a Date object to Paris timezone
const toParisDate = (date) => {
  return toParisDateValue(date);
};

export default function Statistiques() {
  const { filterByTenant, isPlatformAdmin, currentTenant, currentReseller } = useTenant();
  const isPlatformStatsView = isPlatformAdmin && !currentTenant && !currentReseller;

  const [dateFilter, setDateFilter] = useState("today");

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [yearForMonthSelector, setYearForMonthSelector] = useState(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [intervalStart, setIntervalStart] = useState(new Date());
  const [intervalEnd, setIntervalEnd] = useState(new Date());

  // State for the actual date range derived from filters
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState(
    Object.keys(EXPORT_SECTIONS).reduce((acc, key) => ({ ...acc, [key]: true }), {})
  );

  // This function returns the date range for calculation, and is used to update the dateRange state.
  const calculateDateRange = useCallback(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case "specific_day":
        return {
          start: startOfDay(selectedDate),
          end: endOfDay(selectedDate)
        };
      case "month":
        return {
          start: startOfMonth(selectedMonth),
          end: endOfMonth(selectedMonth)
        };
      case "year":
        return {
          start: startOfYear(new Date(selectedYear, 0, 1)),
          end: endOfYear(new Date(selectedYear, 0, 1))
        };
      case "interval":
        const start = startOfDay(intervalStart);
        const end = endOfDay(intervalEnd);
        return {
          start: start > end ? end : start,
          end: start > end ? start : end,
        };
      default:
        // Default to last 30 days if no specific filter is set or initial load
        return {
          start: subDays(startOfDay(now), 30),
          end: endOfDay(now)
        };
    }
  }, [dateFilter, selectedDate, selectedMonth, selectedYear, intervalStart, intervalEnd]);

  // Effect to update dateRange state whenever filter criteria change
  useEffect(() => {
    const { start, end } = calculateDateRange();
    setDateRange({ from: start, to: end });
  }, [calculateDateRange]);

  // Variables derived from dateRange for useQuery
  const { from: startDate, to: endDate } = dateRange;
  const startDateStr = startDate ? format(startDate, 'yyyy-MM-dd') : '';
  const endDateStr = endDate ? format(endDate, 'yyyy-MM-dd') : '';

  // Convert dateRange.from and dateRange.to to Paris timezone for filtering inside queryFn
  const startDateInParis = startDate ? startOfDay(toParisDate(startDate)) : null;
  const endDateInParis = endDate ? endOfDay(toParisDate(endDate)) : null;

  // Use useQuery for orders
  const { data: ordersData = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['orders', startDateStr, endDateStr],
    queryFn: async () => {
      const allOrders = await appClient.entities.Order.filter(filterByTenant());
      
      // If dates are not yet set, return empty to prevent errors or unexpected behavior
      if (!startDateInParis || !endDateInParis) {
          console.warn("Date range for orders is not yet defined, returning empty orders list from queryFn.");
          return [];
      }

      // Exclure les commandes annulées et en_attente (brouillons non payés)
      // IMPORTANT: ne pas exclure les commandes web/borne qui ont le statut en_attente
      return allOrders.filter(order => {
        // Exclude cancelled orders always
        if (order.statut === 'annulee') return false;
        // Exclude draft orders (en_attente) only if NOT from web or kiosk
        if (order.statut === 'en_attente' && !order.from_web && !order.from_kiosk) {
          return false;
        }
        
        // Ensure order has a created_date
        if (!order?.created_date) return false;
        
        // Parse order date string, handling potential ' ' instead of 'T' and ensuring UTC interpretation
        const orderDate = toParisDate(order.created_date);
        if (!orderDate) return false;
        
        // Filter orders that fall within the inclusive date range (in Paris time)
        return orderDate >= startDateInParis && orderDate <= endDateInParis;
      });
    },
    enabled: !isPlatformStatsView && !!startDate && !!endDate, // Only run query if date range is defined
    staleTime: 1000 * 60 * 2, // 2 minutes stale time as requested
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Use useQuery for customers
  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customersForStats'],
    queryFn: () => appClient.entities.Customer.filter(filterByTenant()),
    enabled: !isPlatformStatsView,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false,
  });

  // Use useQuery for products
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['productsForStats'],
    queryFn: () => appClient.entities.Product.filter(filterByTenant()),
    enabled: !isPlatformStatsView,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false,
  });

  // Use useQuery for restaurant profile
  const { data: profile = null, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['restaurantProfile'],
    queryFn: async () => {
      const profiles = await appClient.entities.RestaurantProfile.filter(filterByTenant());
      return profiles[0] || null;
    },
    enabled: !isPlatformStatsView,
    staleTime: 1000 * 60 * 60 * 24 * 7, // 1 week
    refetchOnWindowFocus: false,
  });

  const { data: platformSalesContext = { invoices: [], tenants: [], resellers: [] }, isLoading: isLoadingPlatformSales } = useQuery({
    queryKey: ['platform-sales-stats', startDateStr, endDateStr],
    queryFn: async () => {
      const [allInvoices, tenants, resellers] = await Promise.all([
        appClient.entities.TenantInvoice.list('-created_date'),
        appClient.entities.Tenant.list(),
        appClient.entities.Reseller.list(),
      ]);

      const invoices = allInvoices.filter((invoice) => {
        if (!isFinalInvoice(invoice) || invoice.statut !== 'payee') return false;

        const isPlatformIssued = invoice.issuer_type === 'platform' || (!invoice.issuer_type && (invoice.tenant_id || invoice.recipient_type === 'tenant'));
        if (!isPlatformIssued) return false;

        const referenceDate = invoice.date_paiement || invoice.created_date || invoice.date_facturation;
        if (!referenceDate || !startDateInParis || !endDateInParis) return false;

        const invoiceDate = toParisDate(referenceDate);
        if (!invoiceDate) return false;

        return invoiceDate >= startDateInParis && invoiceDate <= endDateInParis;
      });

      return { invoices, tenants, resellers };
    },
    enabled: isPlatformStatsView && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });


  const getPeriodLabel = useCallback(() => {
    switch (dateFilter) {
      case "today":
        return "Aujourd'hui";
      case "specific_day":
        return format(selectedDate, 'dd MMMM yyyy', { locale: fr });
      case "month":
        return format(selectedMonth, 'MMMM yyyy', { locale: fr });
      case "year":
        return selectedYear.toString();
      case "interval":
        return `Du ${format(dateRange.from, 'dd/MM/yyyy', { locale: fr })} au ${format(dateRange.to, 'dd/MM/yyyy', { locale: fr })}`;
      default:
        return "Période sélectionnée";
    }
  }, [dateFilter, selectedDate, selectedMonth, selectedYear, dateRange.from, dateRange.to]);

  // Memoized filtered orders. `ordersData` from `useQuery` is now already filtered by date and specific statuses.
  // `getValidOrders` will perform any additional validation (e.g., checking for existence of required fields).
  const filteredOrders = useMemo(() => {
    return getValidOrders(ordersData);
  }, [ordersData]);


  // Calculate stats using useMemo
  const stats = useMemo(() => {
    const chiffreAffairesTotal = filteredOrders.reduce((sum, order) => sum + (order.total_ttc || 0), 0);
    const nombreCommandes = filteredOrders.length;
    const panierMoyen = nombreCommandes > 0 ? chiffreAffairesTotal / nombreCommandes : 0;
    
    const totalDiscounts = filteredOrders
        .flatMap(order => order.articles || [])
        .filter(article => article.total_ligne < 0)
        .reduce((sum, article) => sum + article.total_ligne, 0);

    const clientsCrees = (customers || []).filter(c => {
        if (!c.created_date) return false;
        const creationDate = parseISO(c.created_date);
        return creationDate >= dateRange.from && creationDate <= dateRange.to;
    }).length;

    return {
        chiffreAffairesTotal,
        nombreCommandes,
        panierMoyen,
        totalDiscounts,
        clientsCrees
    };
  }, [filteredOrders, customers, dateRange]);


  const summaryData = [
    { title: "Chiffre d'affaires", value: `${stats.chiffreAffairesTotal.toFixed(2)}€`, icon: Euro, color: "bg-gradient-to-r from-green-500 to-green-600" },
    { title: 'Total des Remises', value: `${Math.abs(stats.totalDiscounts).toFixed(2)}€`, icon: Percent, color: 'bg-gradient-to-r from-red-500 to-red-600' },
    { title: "Nombre de Commandes", value: stats.nombreCommandes, icon: ShoppingCart, color: "bg-gradient-to-r from-blue-500 to-blue-600" },
    { title: "Panier Moyen", value: `${stats.panierMoyen.toFixed(2)}€`, icon: Receipt, color: "bg-gradient-to-r from-orange-500 to-orange-600" },
    { title: "Nouveaux Clients", value: stats.clientsCrees, icon: Users, color: "bg-gradient-to-r from-purple-500 to-purple-600" },
  ];


  const exportData = () => {
    const customerMap = customers.reduce((acc, customer) => {
      acc[customer.id] = customer;
      return acc;
    }, {});

    const csvData = filteredOrders.map(order => {
      let modesPaiement = '';
      if (Array.isArray(order.mode_paiement) && order.mode_paiement.length > 0) {
        modesPaiement = order.mode_paiement.map(p =>
          `${(p.methode || '').replace(/_/g, ' ')}: ${p.montant?.toFixed(2) || '0.00'}€`
        ).join(' + ');
      } else if (order.mode_paiement_prevu) {
        modesPaiement = `Prévu: ${order.mode_paiement_prevu.replace(/_/g, ' ')}`;
      } else {
        modesPaiement = 'Non défini';
      }

      const client = customerMap[order.customer_id];
      const clientName = client
        ? `${client.prenom || ''} ${client.nom || ''}`.trim()
        : 'Anonyme';

      return {
        'Numéro Commande': `#${order.numero_caisse || (order.numero_commande ? order.numero_commande.slice(-4) : 'N/A')}`,
        'Date': format(new Date(order.created_date), 'dd/MM/yyyy', { locale: fr }),
        'Heure': format(new Date(order.created_date), 'HH:mm', { locale: fr }),
        'Type': ORDER_TYPE_LABELS[order.type_commande] || order.type_commande,
        'Client': clientName,
        'Total HT': (order.total_ht || 0).toFixed(2),
        'TVA': (order.total_tva || 0).toFixed(2),
        'Total TTC': (order.total_ttc || 0).toFixed(2),
        'Mode Paiement': modesPaiement,
        'Statut Paiement': order.payee ? 'Payée' : 'En attente',
        'Statut': ORDER_STATUS_LABELS[order.statut] || order.statut
      };
    });

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.map(header => `"${header}"`).join(';'),
      ...csvData.map(row =>
        headers.map(header => {
          const value = row[header] || '';
          const cleanValue = String(value).replace(/"/g, '""');
          return `"${cleanValue}"`;
        }).join(';')
      )
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], {
      type: 'text/csv;charset=utf-8;'
    });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commandes-${getPeriodLabel().replace(/\s/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSectionToggle = (sectionId, checked) => {
    setSelectedSections(prev => ({
      ...prev,
      [sectionId]: checked
    }));
  };

  const calculatePaymentStats = useCallback((orders) => {
    const stats = {};
    orders.forEach(order => {
      if (order.mode_paiement && Array.isArray(order.mode_paiement)) {
        order.mode_paiement.forEach(payment => {
          if (!stats[payment.methode]) {
            stats[payment.methode] = { amount: 0, count: 0 };
          }
          stats[payment.methode].amount += payment.montant || 0;
          stats[payment.methode].count += 1;
        });
      }
    });
    return stats;
  }, []);

  const calculateTopProducts = useCallback((orders) => {
    const productStats = {};
    orders.forEach(order => {
      if (Array.isArray(order.articles)) {
        order.articles.forEach(article => {
          if (!productStats[article.product_id]) {
            productStats[article.product_id] = {
              nom: article.nom_produit || 'Produit inconnu',
              quantite_vendue: 0,
              chiffre_affaires: 0
            };
          }
          productStats[article.product_id].quantite_vendue += article.quantite || 0;
          productStats[article.product_id].chiffre_affaires += article.total_ligne || 0;
        });
      }
    });
    return Object.values(productStats)
      .sort((a, b) => b.quantite_vendue - a.quantite_vendue);
  }, []);

  const calculateOrderTypeStats = useCallback((orders) => {
    const stats = {};
    orders.forEach(order => {
      const type = order.type_commande || 'non_spécifié';
      if (!stats[type]) {
        stats[type] = { count: 0, revenue: 0 };
      }
      stats[type].count += 1;
      stats[type].revenue += order.total_ttc || 0;
    });
    return stats;
  }, []);

  const calculateNF525Data = useCallback((orders) => {
    const totalHT = orders.reduce((sum, order) => sum + (order.total_ht || 0), 0);
    const totalTVA = orders.reduce((sum, order) => sum + (order.total_tva || 0), 0);
    const totalTTC = orders.reduce((sum, order) => sum + (order.total_ttc || 0), 0);

    const tvaRates = profile?.tva_rates?.map(r => r.rate) || [5.5, 10, 20];
    const tvaDetails = {};
    tvaRates.forEach(rate => {
        tvaDetails[`${rate}%`] = { ht: 0, tva: 0, ttc: 0 };
    });
    tvaDetails['Autres'] = { ht: 0, tva: 0, ttc: 0 };

    orders.forEach(order => {
      if (Array.isArray(order.articles)) {
        order.articles.forEach(article => {
          const articleTVA = article.tva || 0;
          const tauxKey = tvaRates.includes(articleTVA) ? `${articleTVA}%` : 'Autres';

          const totalLigne = article.total_ligne || 0;
          const ht = totalLigne / (1 + (articleTVA / 100));
          const tvaAmount = totalLigne - ht;

          tvaDetails[tauxKey].ht += ht;
          tvaDetails[tauxKey].tva += tvaAmount;
          tvaDetails[tauxKey].ttc += totalLigne;
        });
      }
    });

    Object.keys(tvaDetails).forEach(key => {
        if (tvaDetails[key].ttc === 0 && key !== 'Autres') {
            delete tvaDetails[key];
        }
    });

    return {
      nb_transactions: orders.length,
      totalHT,
      totalTVA,
      totalTTC,
      tvaDetails
    };
  }, [profile, filteredOrders]);

  const generateStatsHTML = useCallback((formatType = 'pdf') => {
    let sectionsHTML = '';

    if (selectedSections.mainStats) {
      sectionsHTML += `
        <div class="section">
          <h2>📊 Statistiques Principales</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <h3>${stats.chiffreAffairesTotal.toFixed(2)}€</h3>
              <p>Chiffre d'Affaires</p>
            </div>
            <div class="stat-card">
              <h3>${Math.abs(stats.totalDiscounts).toFixed(2)}€</h3>
              <p>Total des Remises</p>
            </div>
            <div class="stat-card">
              <h3>${stats.nombreCommandes}</h3>
              <p>Commandes</p>
            </div>
            <div class="stat-card">
              <h3>${stats.panierMoyen.toFixed(2)}€</h3>
              <p>Panier Moyen</p>
            </div>
            <div class="stat-card">
              <h3>${stats.clientsCrees}</h3>
              <p>Nouveaux Clients</p>
            </div>
          </div>
        </div>
      `;
    }

    if (selectedSections.paymentMethods) {
      const paymentStats = calculatePaymentStats(filteredOrders);
      const paymentRows = Object.entries(paymentStats)
        .map(([method, data]) => `
          <tr>
            <td>${method.replace(/_/g, ' ')}</td>
            <td>${data.amount.toFixed(2)}€</td>
            <td>${data.count}</td>
          </tr>
        `).join('');

      sectionsHTML += `
        <div class="section">
          <h2>💳 Modes de Paiement</h2>
          <table>
            <thead>
              <tr><th>Mode</th><th>Montant</th><th>Transactions</th></tr>
            </thead>
            <tbody>${paymentRows}</tbody>
          </table>
        </div>
      `;
    }

    if (selectedSections.topProducts) {
      const topProductsResult = calculateTopProducts(filteredOrders);
      const productRows = topProductsResult.slice(0, 10).map((product, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${product.nom}</td>
          <td>${product.quantite_vendue}</td>
          <td>${product.chiffre_affaires.toFixed(2)}€</td>
        </tr>
      `).join('');

      sectionsHTML += `
        <div class="section">
          <h2>🏆 Top Produits</h2>
          <table>
            <thead>
              <tr><th>Rang</th><th>Produit</th><th>Quantité</th><th>CA</th></tr>
            </thead>
            <tbody>${productRows}</tbody>
          </table>
        </div>
      `;
    }

    if (selectedSections.orderTypes) {
      const orderTypeStats = calculateOrderTypeStats(filteredOrders);
      const typeRows = Object.entries(orderTypeStats)
        .map(([type, data]) => `
          <tr>
            <td>${(ORDER_TYPE_LABELS[type] || type).replace(/_/g, ' ')}</td>
            <td>${data.count}</td>
            <td>${data.revenue.toFixed(2)}€</td>
          </tr>
        `).join('');

      sectionsHTML += `
        <div class="section">
          <h2>📦 Types de Commandes</h2>
          <table>
            <thead>
              <tr><th>Type</th><th>Nombre</th><th>CA</th></tr>
            </thead>
            <tbody>${typeRows}</tbody>
          </table>
        </div>
      `;
    }

    if (selectedSections.nf525Report) {
      const nf525Data = calculateNF525Data(filteredOrders);
      const tvaRows = Object.entries(nf525Data.tvaDetails).map(([rate, data]) => `
        <tr>
          <td>${rate}</td>
          <td>${data.ht.toFixed(2)}€</td>
          <td>${data.tva.toFixed(2)}€</td>
          <td>${data.ttc.toFixed(2)}€</td>
        </tr>
      `).join('');

      sectionsHTML += `
        <div class="section">
          <h2>🧾 Rapport de TVA</h2>
          <div class="nf525-summary">
            <p><strong>Transactions:</strong> ${nf525Data.nb_transactions}</p>
            <p><strong>Total HT:</strong> ${nf525Data.totalHT.toFixed(2)}€</p>
            <p><strong>Total TVA:</strong> ${nf525Data.totalTVA.toFixed(2)}€</p>
            <p><strong>Total TTC:</strong> ${nf525Data.totalTTC.toFixed(2)}€</p>
          </div>
          <table>
            <thead>
              <tr><th>Taux TVA</th><th>Base HT</th><th>TVA</th><th>Total TTC</th></tr>
            </thead>
            <tbody>
              ${tvaRows}
            </tbody>
          </table>
        </div>
      `;
    }

    const bodyOnload = formatType === 'pdf' ? 'onload="window.print();"' : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Rapport Statistiques - ${getPeriodLabel()}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; font-size: 11px; line-height: 1.4; color: #333; }
          .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { font-size: 24px; margin: 0; color: #333; }
          .header p { margin: 5px 0 0; color: #666; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section h2 { font-size: 18px; margin-bottom: 15px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
          .stat-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; background: #f9f9f9; }
          .stat-card h3 { font-size: 20px; margin: 0 0 5px; color: #333; }
          .stat-card p { margin: 0; color: #666; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          thead { background-color: #f5f5f5; }
          th { font-weight: bold; color: #333; }
          .nf525-summary { background: #f0f8f0; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
          .nf525-summary p { margin: 5px 0; }
          @media print {
            body { margin: 10px; font-size: 10px; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body ${bodyOnload}>
        <div class="header">
          <h1>📊 Rapport Statistiques</h1>
          <p>Période: ${getPeriodLabel()}</p>
          <p>Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
        </div>
        ${sectionsHTML}
      </body>
      </html>
    `;
  }, [filteredOrders, selectedSections, stats, calculatePaymentStats, calculateTopProducts, calculateOrderTypeStats, calculateNF525Data, getPeriodLabel]);

  const exportToCSV = () => {
    let csvContent = '';

    csvContent += `Rapport Statistiques\n`;
    csvContent += `Période;"${getPeriodLabel()}"\n`;
    csvContent += `Date de génération;"${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}"\n\n`;

    if (selectedSections.mainStats) {
      csvContent += '--- RESUME EXECUTIF ---\n';
      csvContent += `"Chiffre d'Affaires";"${stats.chiffreAffairesTotal.toFixed(2)}€"\n`;
      csvContent += `"Total des Remises";"${Math.abs(stats.totalDiscounts).toFixed(2)}€"\n`;
      csvContent += `"Nombre de Commandes";"${stats.nombreCommandes}"\n`;
      csvContent += `"Panier Moyen";"${stats.panierMoyen.toFixed(2)}€"\n`;
      csvContent += `"Nouveaux Clients";"${stats.clientsCrees}"\n\n`;
    }

    if (selectedSections.topProducts) {
      const topProducts = calculateTopProducts(filteredOrders);
      csvContent += '--- TOP PRODUITS ---\n';
      csvContent += '"Rang";"Produit";"Quantité vendue";"Chiffre d\'affaires"\n';
      topProducts.slice(0, 10).forEach((product, index) => {
        const productName = String(product.nom || '').replace(/"/g, '""');
        const quantity = String(product.quantite_vendue || 0);
        const revenue = String(product.chiffre_affaires?.toFixed(2) || '0.00').replace(/"/g, '""') + '€';
        csvContent += `"${index + 1}";"${productName}";"${quantity}";"${revenue}"\n`;
      });
      csvContent += '\n';
    }

    if (selectedSections.paymentMethods) {
      const paymentStats = calculatePaymentStats(filteredOrders);
      csvContent += '--- MODES DE PAIEMENT ---\n';
      csvContent += '"Mode";"Montant";"Nombre de transactions"\n';
      Object.entries(paymentStats).forEach(([method, data]) => {
        const cleanedMethod = String(method || '').replace(/_/g, ' ').replace(/"/g, '""');
        const amount = String(data.amount?.toFixed(2) || '0.00').replace(/"/g, '""') + '€';
        const count = String(data.count || 0);
        csvContent += `"${cleanedMethod}";"${amount}";"${count}"\n`;
      });
      csvContent += '\n';
    }

    if (selectedSections.orderTypes) {
      const orderTypeStats = calculateOrderTypeStats(filteredOrders);
      csvContent += '--- TYPES DE COMMANDES ---\n';
      csvContent += '"Type";"Nombre";"Chiffre d\'affaires"\n';
      Object.entries(orderTypeStats).forEach(([type, data]) => {
        const cleanedType = String(ORDER_TYPE_LABELS[type] || type || '').replace(/_/g, ' ').replace(/"/g, '""');
        const count = String(data.count || 0);
        const revenue = String(data.revenue?.toFixed(2) || '0.00').replace(/"/g, '""') + '€';
        csvContent += `"${cleanedType}";"${count}";"${revenue}"\n`;
      });
      csvContent += '\n';
    }

    if (selectedSections.nf525Report) {
      const nf525Data = calculateNF525Data(filteredOrders);
      csvContent += '--- RAPPORT DE TVA ---\n';
      csvContent += `"Nombre de transactions";"${nf525Data.nb_transactions}"\n`;
      csvContent += `"Total HT";"${nf525Data.totalHT.toFixed(2)}€"\n`;
      csvContent += `"Total TVA";"${nf525Data.totalTVA.toFixed(2)}€"\n`;
      csvContent += `"Total TTC";"${nf525Data.totalTTC.toFixed(2)}€"\n`;
      csvContent += '\n';
      csvContent += 'DETAIL TVA\n';
      csvContent += '"Taux";"Base HT";"Montant TVA";"Total TTC"\n';
      Object.entries(nf525Data.tvaDetails).forEach(([rate, data]) => {
        csvContent += `"${rate}";"${data.ht.toFixed(2)}€";"${data.tva.toFixed(2)}€";"${data.ttc.toFixed(2)}€"\n`;
      });
      csvContent += '\n';
    }

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport-statistiques-${getPeriodLabel().replace(/\s/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportModalOpen(false);
  };

  const exportToPDF = () => {
    const htmlContent = generateStatsHTML('pdf');
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    } else {
      alert("Votre navigateur a bloqué l'ouverture d'une nouvelle fenêtre. Veuillez autoriser les pop-ups pour cette page pour exporter en PDF.");
    }
    setExportModalOpen(false);
  };

  const platformSalesStats = useMemo(() => {
    if (!isPlatformStatsView) return null;

    const invoices = platformSalesContext.invoices || [];
    const tenantMap = new Map((platformSalesContext.tenants || []).map((tenant) => [tenant.id, tenant]));
    const resellerMap = new Map((platformSalesContext.resellers || []).map((reseller) => [reseller.id, reseller]));

    const resolveRecipient = (invoice) => {
      if (invoice.recipient_type === 'reseller') {
        return {
          segment: 'revendeur',
          name: invoice.recipient_snapshot?.brand_name
            || invoice.recipient_snapshot?.name
            || resellerMap.get(invoice.recipient_id)?.name
            || 'Revendeur inconnu',
        };
      }

      return {
        segment: 'commerce',
        name: invoice.recipient_snapshot?.nom_commercial
          || invoice.recipient_snapshot?.name
          || tenantMap.get(invoice.recipient_id || invoice.tenant_id)?.nom_commercial
          || 'Commerce inconnu',
      };
    };

    const totals = invoices.reduce((acc, invoice) => {
      const recipient = resolveRecipient(invoice);
      const amount = Number(invoice.montant || 0);
      const type = invoice.type || 'autre';

      acc.totalRevenue += amount;
      acc.totalInvoices += 1;

      if (recipient.segment === 'commerce') {
        acc.merchantRevenue += amount;
        acc.merchantInvoices += 1;
      } else {
        acc.resellerRevenue += amount;
        acc.resellerInvoices += 1;
      }

      if (type === 'abonnement' || type === 'frais_de_maintenance') {
        acc.recurringRevenue += amount;
        acc.recurringInvoices += 1;
      } else {
        acc.oneOffRevenue += amount;
        acc.oneOffInvoices += 1;
      }

      if (!acc.typeBreakdown[type]) {
        acc.typeBreakdown[type] = { amount: 0, count: 0 };
      }
      acc.typeBreakdown[type].amount += amount;
      acc.typeBreakdown[type].count += 1;

      if (!acc.segmentBreakdown[recipient.segment]) {
        acc.segmentBreakdown[recipient.segment] = { amount: 0, count: 0 };
      }
      acc.segmentBreakdown[recipient.segment].amount += amount;
      acc.segmentBreakdown[recipient.segment].count += 1;

      acc.recentInvoices.push({
        ...invoice,
        recipientName: recipient.name,
        recipientSegment: recipient.segment,
      });

      return acc;
    }, {
      totalRevenue: 0,
      totalInvoices: 0,
      merchantRevenue: 0,
      merchantInvoices: 0,
      resellerRevenue: 0,
      resellerInvoices: 0,
      recurringRevenue: 0,
      recurringInvoices: 0,
      oneOffRevenue: 0,
      oneOffInvoices: 0,
      typeBreakdown: {},
      segmentBreakdown: {},
      recentInvoices: [],
    });

    totals.averageInvoice = totals.totalInvoices > 0 ? totals.totalRevenue / totals.totalInvoices : 0;
    totals.typeRows = Object.entries(totals.typeBreakdown)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.amount - a.amount);
    totals.segmentRows = Object.entries(totals.segmentBreakdown)
      .map(([segment, data]) => ({ segment, ...data }))
      .sort((a, b) => b.amount - a.amount);
    totals.resellerRows = invoices
      .filter((invoice) => invoice.recipient_type === 'reseller')
      .reduce((acc, invoice) => {
        const key = invoice.recipient_id || invoice.recipient_snapshot?.contact_email || invoice.id;
        if (!acc[key]) {
          acc[key] = {
            name: resolveRecipient(invoice).name,
            amount: 0,
            count: 0,
          };
        }
        acc[key].amount += Number(invoice.montant || 0);
        acc[key].count += 1;
        return acc;
      }, {});
    totals.resellerRows = Object.values(totals.resellerRows).sort((a, b) => b.amount - a.amount).slice(0, 8);
    totals.recentInvoices = totals.recentInvoices
      .sort((a, b) => new Date(b.date_paiement || b.created_date || b.date_facturation || 0) - new Date(a.date_paiement || a.created_date || a.date_facturation || 0))
      .slice(0, 12);

    return totals;
  }, [isPlatformStatsView, platformSalesContext]);

  // Combine loading states
  const isLoading = isPlatformStatsView
    ? isLoadingPlatformSales
    : isLoadingOrders || isLoadingCustomers || isLoadingProducts || isLoadingProfile;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement des statistiques...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isPlatformStatsView) {
    const statsCards = [
      { title: "CA plateforme", value: `${(platformSalesStats?.totalRevenue || 0).toFixed(2)}€`, icon: Euro, color: "bg-gradient-to-r from-green-500 to-green-600" },
      { title: "Factures payees", value: platformSalesStats?.totalInvoices || 0, icon: FileText, color: "bg-gradient-to-r from-blue-500 to-blue-600" },
      { title: "Ventes commerces", value: `${(platformSalesStats?.merchantRevenue || 0).toFixed(2)}€`, icon: Users, color: "bg-gradient-to-r from-orange-500 to-orange-600" },
      { title: "Ventes revendeurs", value: `${(platformSalesStats?.resellerRevenue || 0).toFixed(2)}€`, icon: Receipt, color: "bg-gradient-to-r from-purple-500 to-purple-600" },
      { title: "Abonnements", value: `${(platformSalesStats?.recurringRevenue || 0).toFixed(2)}€`, icon: Percent, color: "bg-gradient-to-r from-cyan-500 to-cyan-600" },
      { title: "Ventes ponctuelles", value: `${(platformSalesStats?.oneOffRevenue || 0).toFixed(2)}€`, icon: ShoppingCart, color: "bg-gradient-to-r from-rose-500 to-red-600" },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-orange-500" />
                Statistiques plateforme
              </h1>
              <p className="text-gray-600 mt-2">Ventes facturées par la plateforme aux commerces et aux revendeurs.</p>
              <p className="text-sm text-blue-600 mt-1">Période: {getPeriodLabel()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {statsCards.map((card) => (
              <StatCard key={card.title} title={card.title} value={card.value} icon={card.icon} color={card.color} />
            ))}
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <Tabs value={dateFilter} onValueChange={setDateFilter}>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="today">Aujourd'hui</TabsTrigger>
                  <TabsTrigger value="specific_day">Un jour</TabsTrigger>
                  <TabsTrigger value="month">Un mois</TabsTrigger>
                  <TabsTrigger value="year">Une année</TabsTrigger>
                  <TabsTrigger value="interval">Intervalle</TabsTrigger>
                </TabsList>

                <div className="mt-4">
                  <TabsContent value="today" className="text-center text-gray-600">
                    Ventes plateforme pour aujourd'hui
                  </TabsContent>

                  <TabsContent value="specific_day" className="flex justify-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} locale={fr} />
                      </PopoverContent>
                    </Popover>
                  </TabsContent>

                  <TabsContent value="month" className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-4">
                      <Button variant="outline" size="sm" onClick={() => setYearForMonthSelector(yearForMonthSelector - 1)}>
                        &lt; {yearForMonthSelector - 1}
                      </Button>
                      <span className="font-bold text-lg">{yearForMonthSelector}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setYearForMonthSelector(yearForMonthSelector + 1)}
                        disabled={yearForMonthSelector === new Date().getFullYear()}
                      >
                        {yearForMonthSelector + 1} &gt;
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 w-full max-w-md">
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthDate = new Date(yearForMonthSelector, i, 1);
                        const isSelected = getYear(selectedMonth) === yearForMonthSelector && getMonth(selectedMonth) === i;
                        const isFuture = monthDate > new Date();

                        return (
                          <Button
                            key={i}
                            variant={isSelected ? "default" : "outline"}
                            onClick={() => setSelectedMonth(monthDate)}
                            disabled={isFuture}
                            className="capitalize"
                          >
                            {format(monthDate, 'MMM', { locale: fr })}
                          </Button>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="year" className="flex justify-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          Année {selectedYear}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-4">
                        <div className="grid grid-cols-4 gap-2">
                          {Array.from({ length: 6 }, (_, i) => {
                            const year = new Date().getFullYear() - 5 + i;
                            return (
                              <Button key={year} variant={selectedYear === year ? "default" : "outline"} size="sm" onClick={() => setSelectedYear(year)}>
                                {year}
                              </Button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TabsContent>

                  <TabsContent value="interval" className="flex justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Du:</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <CalendarIcon className="w-4 h-4" />
                            {format(intervalStart, 'dd/MM/yyyy', { locale: fr })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={intervalStart} onSelect={(date) => date && setIntervalStart(date)} locale={fr} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Au:</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <CalendarIcon className="w-4 h-4" />
                            {format(intervalEnd, 'dd/MM/yyyy', { locale: fr })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={intervalEnd} onSelect={(date) => date && setIntervalEnd(date)} locale={fr} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="border-0 shadow-md">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Répartition par type de vente</h2>
                  <p className="text-sm text-gray-500">Abonnement, vente complète, matériel, maintenance et autres.</p>
                </div>
                {platformSalesStats?.typeRows?.length ? (
                  <div className="space-y-3">
                    {platformSalesStats.typeRows.map((row) => (
                      <div key={row.type} className="flex items-center justify-between rounded-lg border bg-white p-3">
                        <div>
                          <p className="font-medium text-gray-900">{getInvoiceTypeLabel(row.type)}</p>
                          <p className="text-xs text-gray-500">{row.count} facture(s)</p>
                        </div>
                        <p className="font-semibold text-gray-900">{row.amount.toFixed(2)}€</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucune vente sur cette période.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="border-0 shadow-md">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Revendeurs qui génèrent le plus de ventes</h2>
                  <p className="text-sm text-gray-500">Classement par chiffre d'affaires facturé par la plateforme.</p>
                </div>
                {platformSalesStats?.resellerRows?.length ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={platformSalesStats.resellerRows} layout="vertical" margin={{ top: 8, right: 20, left: 20, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tickFormatter={(value) => `${value.toFixed(0)}€`} />
                        <YAxis type="category" dataKey="name" width={120} />
                        <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(2)}€`, 'CA']} />
                        <Bar dataKey="amount" radius={[0, 10, 10, 0]} fill="#2563eb" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucune vente revendeur sur cette période.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Ventes par type</h2>
                  <p className="text-sm text-gray-500">Abonnements, ventes complètes, matériel et autres ventes plateforme.</p>
                </div>
                {platformSalesStats?.typeRows?.length ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={platformSalesStats.typeRows.map((row) => ({
                            name: getInvoiceTypeLabel(row.type),
                            value: Number(row.amount || 0),
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={110}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {platformSalesStats.typeRows.map((row, index) => (
                            <Cell key={row.type} fill={PLATFORM_CHART_COLORS[index % PLATFORM_CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${Number(value || 0).toFixed(2)}€`, 'CA']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucune vente sur cette période.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-md">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Répartition par cible</h2>
                  <p className="text-sm text-gray-500">Distinction entre commerces et revendeurs.</p>
                </div>
                {platformSalesStats?.segmentRows?.length ? (
                  <div className="space-y-3">
                    {platformSalesStats.segmentRows.map((row) => (
                      <div key={row.segment} className="flex items-center justify-between rounded-lg border bg-white p-3">
                        <div>
                          <p className="font-medium text-gray-900">{row.segment === 'commerce' ? 'Commerces' : 'Revendeurs'}</p>
                          <p className="text-xs text-gray-500">{row.count} facture(s)</p>
                        </div>
                        <p className="font-semibold text-gray-900">{row.amount.toFixed(2)}€</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucune vente sur cette période.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Dernières ventes plateforme</h2>
                <p className="text-sm text-gray-500">Factures finales payées émises par la plateforme.</p>
              </div>
              {platformSalesStats?.recentInvoices?.length ? (
                <div className="space-y-3">
                  {platformSalesStats.recentInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border bg-white p-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {invoice.recipientName} - {getInvoiceTypeLabel(invoice.type)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {invoice.recipientSegment === 'commerce' ? 'Commerce' : 'Revendeur'} - {invoice.numero_facture || invoice.id?.slice(0, 8)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Payée le {new Date(invoice.date_paiement || invoice.created_date || invoice.date_facturation).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{Number(invoice.montant || 0).toFixed(2)}€</p>
                        <p className="text-xs text-gray-500">TVA {Number(invoice.tva_taux || 0).toFixed(0)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aucune facture finale payée sur cette période.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-orange-500" />
              Statistiques & Rapports
            </h1>
            <p className="text-gray-600 mt-2">Analyses détaillées de vos ventes.</p>
            <p className="text-sm text-blue-600 mt-1">Période: {getPeriodLabel()}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportData}>
                <Sheet className="mr-2 h-4 w-4" />
                <span>Exporter toutes les commandes (CSV)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExportModalOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Personnaliser l'export (PDF/CSV)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Personnaliser votre rapport</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 p-1">
                <p className="text-sm text-gray-600 mb-4">
                  Sélectionnez les sections à inclure dans votre rapport :
                </p>
                {Object.entries(EXPORT_SECTIONS).map(([key, section]) => (
                  <div key={key} className="flex items-start space-x-3">
                    <Checkbox
                      id={key}
                      checked={selectedSections[key]}
                      onCheckedChange={(checked) => handleSectionToggle(key, checked)}
                    />
                    <div className="space-y-1">
                      <label htmlFor={key} className="text-sm font-medium cursor-pointer">
                        {section.label}
                      </label>
                      <p className="text-xs text-gray-500">{section.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setExportModalOpen(false)}>
                Annuler
              </Button>
              <Button onClick={exportToCSV} variant="outline" className="gap-2">
                <Sheet className="w-4 h-4" />
                CSV
              </Button>
              <Button onClick={exportToPDF} className="gap-2">
                <FileText className="w-4 h-4" />
                PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <Tabs value={dateFilter} onValueChange={setDateFilter}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="today">Aujourd'hui</TabsTrigger>
                <TabsTrigger value="specific_day">Un jour</TabsTrigger>
                <TabsTrigger value="month">Un mois</TabsTrigger>
                <TabsTrigger value="year">Une année</TabsTrigger>
                <TabsTrigger value="interval">Intervalle</TabsTrigger>
              </TabsList>

              <div className="mt-4">
                <TabsContent value="today" className="text-center text-gray-600">
                  Statistiques pour aujourd'hui
                </TabsContent>

                <TabsContent value="specific_day" className="flex justify-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                </TabsContent>

                <TabsContent value="month" className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setYearForMonthSelector(yearForMonthSelector - 1)}
                    >
                      &lt; {yearForMonthSelector - 1}
                    </Button>
                    <span className="font-bold text-lg">{yearForMonthSelector}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setYearForMonthSelector(yearForMonthSelector + 1)}
                      disabled={yearForMonthSelector === new Date().getFullYear()}
                    >
                      {yearForMonthSelector + 1} &gt;
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 w-full max-w-md">
                    {Array.from({ length: 12 }, (_, i) => {
                      const monthDate = new Date(yearForMonthSelector, i, 1);
                      const isSelected = getYear(selectedMonth) === yearForMonthSelector && getMonth(selectedMonth) === i;
                      const isFuture = monthDate > new Date();

                      return (
                        <Button
                          key={i}
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => setSelectedMonth(monthDate)}
                          disabled={isFuture}
                          className="capitalize"
                        >
                          {format(monthDate, 'MMM', { locale: fr })}
                        </Button>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="year" className="flex justify-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        Année {selectedYear}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4">
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - 5 + i;
                          return (
                            <Button
                              key={year}
                              variant={selectedYear === year ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedYear(year)}
                            >
                              {year}
                            </Button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TabsContent>

                <TabsContent value="interval" className="flex justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Du:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          {format(intervalStart, 'dd/MM/yyyy', { locale: fr })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={intervalStart}
                          onSelect={(date) => date && setIntervalStart(date)}
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Au:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          {format(intervalEnd, 'dd/MM/yyyy', { locale: fr })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={intervalEnd}
                          onSelect={(date) => date && setIntervalEnd(date)}
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-gray-100 to-slate-100">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-500 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">
                  Intégrité des Données
                </h3>
                <p className="text-gray-700">
                  Chaque transaction est enregistrée de manière sécurisée pour garantir la traçabilité.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {summaryData.map((item, index) => (
            <StatCard
              key={index}
              title={item.title}
              value={item.value}
              icon={item.icon}
              color={item.color}
            />
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <SalesChart orders={filteredOrders} dateInterval={dateRange} periodType={dateFilter} />
          <PaymentMethodsChart orders={filteredOrders} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <OrderTypesChart orders={filteredOrders} />
          <div>
            <TopProducts orders={filteredOrders} products={products} />
            <Link to={createPageUrl('AnalyseProduits')}>
              <Button variant="outline" className="w-full mt-4 gap-2">
                Voir l'analyse détaillée des produits
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-1 gap-6">
          <NF525Report orders={filteredOrders} dateRange={dateFilter} customDateRange={dateRange} profile={profile} />
        </div>
      </div>
    </div>
  );
}
