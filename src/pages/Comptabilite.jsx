import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookCopy, FileDown, Loader2, FileType, Percent } from "lucide-react";
import {
  format,
  getYear,
  getMonth,
  set,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useTenant } from "@/components/contexts/TenantContext";
import { computeTaxSummaryFromArticles } from "@/components/utils/taxUtils";

const safeToFixed = (num) => (typeof num === 'number' ? num.toFixed(2) : '0.00');

const generateYearOptions = () => {
  const currentYear = getYear(new Date());
  const years = [];
  for (let i = currentYear + 1; i >= 2023; i--) {
    years.push({ value: i, label: i.toString() });
  }
  return years;
};

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: format(new Date(0, i), 'MMMM', { locale: fr }),
}));

export default function Comptabilite() {
  const { filterByTenant } = useTenant();
  const [viewMode, setViewMode] = useState('monthly');
  const [monthlyYear, setMonthlyYear] = useState(getYear(new Date()));
  const [monthlyMonth, setMonthlyMonth] = useState(getMonth(new Date()));
  const [annualYear, setAnnualYear] = useState(getYear(new Date()));

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['restaurantProfile'],
    queryFn: async () => {
      const profiles = await appClient.entities.RestaurantProfile.filter(filterByTenant());
      return profiles[0] || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: allOrders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['allOrdersForReports'],
    queryFn: () => appClient.entities.Order.filter(filterByTenant(), '-created_date', 10000),
    staleTime: 5 * 60 * 1000,
  });

  const reportData = useMemo(() => {
    if (!allOrders || !profile) return { items: [], totals: {}, tvaRates: [], periodLabel: "" };

    const configuredTvaRates = (profile.tva_rates && profile.tva_rates.length > 0)
      ? profile.tva_rates.map(r => Number(r.rate)).sort((a, b) => a - b)
      : [5.5, 10, 20];

    let interval;
    let periodLabel;
    let groupingFn, displayFormat;

    if (viewMode === 'annual') {
      const date = set(new Date(), { year: annualYear });
      interval = { start: startOfYear(date), end: endOfYear(date) };
      periodLabel = `Année ${annualYear}`;
      groupingFn = (d) => format(d, 'yyyy-MM');
      displayFormat = (key) => format(parseISO(`${key}-01`), 'MMMM yyyy', { locale: fr });
    } else { // monthly
      const date = set(new Date(), { year: monthlyYear, month: monthlyMonth });
      interval = { start: startOfMonth(date), end: endOfMonth(date) };
      periodLabel = format(date, 'MMMM yyyy', { locale: fr });
      groupingFn = (d) => format(d, 'yyyy-MM-dd');
      displayFormat = (key) => format(parseISO(key), 'eee dd/MM', { locale: fr });
    }

    const ordersForPeriod = allOrders.filter(order => {
        // Exclure les commandes annulées ET en_attente (cohérence avec Statistiques)
        if (order.statut === 'annulee' || order.statut === 'en_attente' || !order.created_date) return false;
        const orderDate = parseISO(order.created_date.replace(' ', 'T') + 'Z'); 
        return isWithinInterval(orderDate, interval);
    });

    const dataByGroup = {};

    ordersForPeriod.forEach(order => {
        const orderDate = parseISO(order.created_date.replace(' ', 'T') + 'Z');
        const groupKey = groupingFn(orderDate);

        if (!dataByGroup[groupKey]) {
            dataByGroup[groupKey] = {
                groupLabel: displayFormat(groupKey),
                groupKey: groupKey, // AJOUT : garder la clé pour le tri
                total_ttc: 0, total_ht: 0, tva_autres: 0, total_remises: 0,
                payment_carte_bancaire: 0, payment_especes: 0, payment_ticket_restaurant: 0, payment_cheque: 0, payment_autres: 0,
            };
            configuredTvaRates.forEach(rate => {
                dataByGroup[groupKey][`tva_${rate}`] = 0;
            });
        }
        
        const groupData = dataByGroup[groupKey];
        const taxSummary = computeTaxSummaryFromArticles(order.articles || [], order.total_ttc || 0);
        groupData.total_ttc += order.total_ttc || 0;
        groupData.total_ht += taxSummary.totalHt;

        (order.articles || []).forEach(article => {
            const tvaRate = article.tva;
            const totalLigne = article.total_ligne || 0;

            if (article.product_id?.startsWith('discount-') || article.product_id?.startsWith('loyalty-') || article.product_id?.startsWith('promo-')) {
                groupData.total_remises += totalLigne;
            }

            if (totalLigne > 0) {
                const ht = totalLigne / (1 + (tvaRate / 100));
                const tvaAmount = totalLigne - ht;
                if (configuredTvaRates.includes(tvaRate)) {
                    groupData[`tva_${tvaRate}`] += tvaAmount;
                } else {
                    groupData.tva_autres += tvaAmount;
                }
            }
        });

        if (order.payee && Array.isArray(order.mode_paiement)) {
            order.mode_paiement.forEach(p => {
                const montant = p.montant || 0;
                if (p.methode === 'carte_bancaire') groupData.payment_carte_bancaire += montant;
                else if (p.methode === 'especes') groupData.payment_especes += montant;
                else if (p.methode === 'ticket_restaurant') groupData.payment_ticket_restaurant += montant;
                else if (p.methode === 'cheque') groupData.payment_cheque += montant;
                else groupData.payment_autres += montant;
            });
        }
    });
    
    // CORRECTION : Tri chronologique par la clé de groupe (date)
    const items = Object.values(dataByGroup).sort((a, b) => a.groupKey.localeCompare(b.groupKey));

    const initialTotals = {
        total_ttc: 0, total_ht: 0, tva_autres: 0, total_remises: 0,
        payment_carte_bancaire: 0, payment_especes: 0, payment_ticket_restaurant: 0, payment_cheque: 0, payment_autres: 0,
    };
    configuredTvaRates.forEach(rate => { initialTotals[`tva_${rate}`] = 0; });

    const totals = items.reduce((acc, item) => {
        Object.keys(acc).forEach(key => acc[key] += item[key] || 0);
        return acc;
    }, initialTotals);
    
    const usedConfiguredRates = configuredTvaRates.filter((rate) =>
      items.some((item) => Math.abs(item[`tva_${rate}`] || 0) > 0.0001) ||
      Math.abs(totals[`tva_${rate}`] || 0) > 0.0001
    );

    return { items, totals, tvaRates: usedConfiguredRates, periodLabel };
  }, [allOrders, profile, viewMode, monthlyYear, monthlyMonth, annualYear]);

  const { items, totals, tvaRates, periodLabel } = reportData;
  const isLoading = isLoadingOrders || isLoadingProfile;
  
  const totalTVA = useMemo(() => {
    if(!totals || !tvaRates) return 0;
    let total = totals.tva_autres || 0;
    tvaRates.forEach(rate => { total += totals[`tva_${rate}`] || 0; });
    return total;
  }, [totals, tvaRates]);

  const exportTo = (formatType) => {
    if (!items || !tvaRates || !profile) return;

    const headers = ["Période", "CA TTC", "CA HT", "Remises", ...tvaRates.map(r => `TVA ${r}%`), "TVA Autres", "Carte", "Espèces", "Ticket Resto.", "Chèque", "Paiem. Autres"];
    
    const bodyRows = items.map(item => [
      `"${item.groupLabel}"`,
      safeToFixed(item.total_ttc),
      safeToFixed(item.total_ht),
      safeToFixed(item.total_remises),
      ...tvaRates.map(r => safeToFixed(item[`tva_${r}`])),
      safeToFixed(item.tva_autres),
      safeToFixed(item.payment_carte_bancaire),
      safeToFixed(item.payment_especes),
      safeToFixed(item.payment_ticket_restaurant),
      safeToFixed(item.payment_cheque),
      safeToFixed(item.payment_autres),
    ]);

    const footerRow = [
      "Total",
      safeToFixed(totals.total_ttc),
      safeToFixed(totals.total_ht),
      safeToFixed(totals.total_remises),
      ...tvaRates.map(r => safeToFixed(totals[`tva_${r}`])),
      safeToFixed(totals.tva_autres),
      safeToFixed(totals.payment_carte_bancaire),
      safeToFixed(totals.payment_especes),
      safeToFixed(totals.payment_ticket_restaurant),
      safeToFixed(totals.payment_cheque),
      safeToFixed(totals.payment_autres),
    ];

    if (formatType === 'csv') {
      const establishmentName = `Établissement;${profile.nom_etablissement || 'N/A'}\n`;
      const periodInfo = `Période;${periodLabel}\n\n`;
      
      const csvContent = [
        headers.join(';'),
        ...bodyRows.map(row => row.map(cell => String(cell).replace('.', ',')).join(';')),
        footerRow.map(cell => typeof cell === 'string' ? cell : String(cell).replace('.', ',')).join(';')
      ].join('\n');

      const fullCsv = establishmentName + periodInfo + csvContent;

      const blob = new Blob(["\uFEFF" + fullCsv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `rapport_comptable_${periodLabel.replace(/\s/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (formatType === 'pdf') {
      const html = `
        <html><head><meta charset="UTF-8"><title>Rapport Comptable - ${periodLabel}</title>
        <style>
          body { font-family: sans-serif; font-size: 10px; }
          h1, h2, h3 { text-align: center; }
          h1 { font-size: 16px; }
          h2 { font-size: 14px; font-weight: normal; }
          h3 { font-size: 12px; font-weight: bold; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 4px; text-align: left; }
          th { background-color: #f2f2f2; }
          td.text-right, th.text-right { text-align: right; }
          .text-red { color: #dc2626; }
          tfoot { font-weight: bold; }
        </style></head>
        <body onload="window.print()">
          <h1>Rapport Comptable</h1>
          <h3>${profile.nom_etablissement || ''}</h3>
          <h2>Période: ${periodLabel}</h2>
          <table>
            <thead><tr>${headers.map(h => `<th ${['CA', 'TVA', 'Remises', 'Carte', 'Espèces'].some(s => h.includes(s)) ? 'class="text-right"' : ''}>${h}</th>`).join('')}</tr></thead>
            <tbody>${bodyRows.map(row => `<tr>${row.map((cell, i) => `<td class="${i === 3 ? 'text-red' : ''} ${i > 0 ? 'text-right' : ''}">${String(cell).replace(/"/g, '')}€</td>`).join('').replace(/Période€/g, 'Période')}</tr>`).join('')}</tbody>
            <tfoot><tr>${footerRow.map((cell, i) => `<td class="${i === 3 ? 'text-red' : ''} ${i > 0 ? 'text-right' : ''}>${(typeof cell === 'number' ? safeToFixed(cell) : String(cell))}€</td>`).join('').replace(/Total€/g, 'Total')}</tr></tfoot>
          </table>
        </body></html>
      `;
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    }
  };

  const hasData = items && items.length > 0;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-screen-xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <BookCopy className="w-8 h-8 text-blue-600" /> Rapport Comptable
            </h1>
            <p className="text-gray-500 mt-1">Analyse de votre chiffre d'affaires, paiements et TVA.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white" onClick={() => exportTo('csv')} disabled={!hasData || isLoading}>
              <FileDown className="w-4 h-4 mr-2" /> CSV
            </Button>
            <Button variant="outline" className="bg-white" onClick={() => exportTo('pdf')} disabled={!hasData || isLoading}>
              <FileType className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly">Rapport Mensuel</TabsTrigger>
            <TabsTrigger value="annual">Rapport Annuel</TabsTrigger>
          </TabsList>
          <TabsContent value="monthly">
            <div className="flex justify-center items-center gap-2 my-4">
                <Select value={monthlyMonth} onValueChange={(val) => setMonthlyMonth(Number(val))}>
                  <SelectTrigger className="w-[150px] bg-white"><SelectValue placeholder="Mois" /></SelectTrigger>
                  <SelectContent>{monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={monthlyYear} onValueChange={(val) => setMonthlyYear(Number(val))}>
                  <SelectTrigger className="w-[100px] bg-white"><SelectValue placeholder="Année" /></SelectTrigger>
                  <SelectContent>{generateYearOptions().map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
          </TabsContent>
          <TabsContent value="annual">
             <div className="flex justify-center items-center gap-2 my-4">
                <Select value={annualYear} onValueChange={(val) => setAnnualYear(Number(val))}>
                  <SelectTrigger className="w-[100px] bg-white"><SelectValue placeholder="Année" /></SelectTrigger>
                  <SelectContent>{generateYearOptions().map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Chiffre d'Affaires TTC</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{safeToFixed(totals?.total_ttc)}€</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Chiffre d'Affaires HT</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{safeToFixed(totals?.total_ht)}€</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Total TVA</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{safeToFixed(totalTVA)}€</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">Total Remises<Percent className="w-4 h-4" /></CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{safeToFixed(totals?.total_remises)}€</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Détail par {viewMode === 'monthly' ? 'jour' : 'mois'}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[60vh] w-full whitespace-nowrap">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50 z-10">
                  <TableRow>
                    <TableHead className="min-w-[150px]">Période</TableHead>
                    <TableHead className="text-right min-w-[120px]">CA TTC</TableHead>
                    <TableHead className="text-right min-w-[120px]">CA HT</TableHead>
                    <TableHead className="text-right min-w-[120px] text-red-600">Remises</TableHead>
                    {(tvaRates || []).map(rate => <TableHead key={rate} className="text-right min-w-[100px]">TVA {rate}%</TableHead>)}
                    <TableHead className="text-right min-w-[100px]">TVA Autres</TableHead>
                    <TableHead className="text-right min-w-[120px]">Carte</TableHead>
                    <TableHead className="text-right min-w-[120px]">Espèces</TableHead>
                    <TableHead className="text-right min-w-[120px]">Ticket Resto.</TableHead>
                    <TableHead className="text-right min-w-[120px]">Chèque</TableHead>
                    <TableHead className="text-right min-w-[120px]">Paiem. Autres</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={11 + (tvaRates?.length || 0)} className="text-center py-10">
                        <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
                        <p className="text-gray-500 mt-2">Chargement des données...</p>
                    </TableCell></TableRow>
                  ) : hasData ? (
                    items.map((item) => (
                      <TableRow key={item.groupLabel}>
                        <TableCell className="font-medium">{item.groupLabel}</TableCell>
                        <TableCell className="text-right">{safeToFixed(item.total_ttc)}€</TableCell>
                        <TableCell className="text-right">{safeToFixed(item.total_ht)}€</TableCell>
                        <TableCell className="text-right text-red-600">{safeToFixed(item.total_remises)}€</TableCell>
                        {(tvaRates || []).map(rate => <TableCell key={rate} className="text-right">{safeToFixed(item[`tva_${rate}`])}€</TableCell>)}
                        <TableCell className="text-right">{safeToFixed(item.tva_autres)}€</TableCell>
                        <TableCell className="text-right">{safeToFixed(item.payment_carte_bancaire)}€</TableCell>
                        <TableCell className="text-right">{safeToFixed(item.payment_especes)}€</TableCell>
                        <TableCell className="text-right">{safeToFixed(item.payment_ticket_restaurant)}€</TableCell>
                        <TableCell className="text-right">{safeToFixed(item.payment_cheque)}€</TableCell>
                        <TableCell className="text-right">{safeToFixed(item.payment_autres)}€</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={11 + (tvaRates?.length || 0)} className="text-center py-10 text-gray-500">
                        Aucune donnée de commande pour la période sélectionnée.
                    </TableCell></TableRow>
                  )}
                </TableBody>
                {hasData && totals && (
                  <TableFooter className="sticky bottom-0 bg-gray-100 font-bold">
                    <TableRow>
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{safeToFixed(totals.total_ttc)}€</TableCell>
                      <TableCell className="text-right">{safeToFixed(totals.total_ht)}€</TableCell>
                      <TableCell className="text-right text-red-600">{safeToFixed(totals.total_remises)}€</TableCell>
                      {(tvaRates || []).map(rate => <TableCell key={rate} className="text-right">{safeToFixed(totals[`tva_${rate}`])}€</TableCell>)}
                      <TableCell className="text-right">{safeToFixed(totals.tva_autres)}€</TableCell>
                      <TableCell className="text-right">{safeToFixed(totals.payment_carte_bancaire)}€</TableCell>
                      <TableCell className="text-right">{safeToFixed(totals.payment_especes)}€</TableCell>
                      <TableCell className="text-right">{safeToFixed(totals.payment_ticket_restaurant)}€</TableCell>
                      <TableCell className="text-right">{safeToFixed(totals.payment_cheque)}€</TableCell>
                      <TableCell className="text-right">{safeToFixed(totals.payment_autres)}€</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

