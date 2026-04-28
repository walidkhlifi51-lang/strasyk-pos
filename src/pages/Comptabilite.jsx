import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookCopy, FileDown, FileType, Loader2, Percent } from "lucide-react";
import {
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  getMonth,
  getYear,
  isWithinInterval,
  parseISO,
  set,
  startOfDay,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useTenant } from "@/components/contexts/TenantContext";
import { computeTaxSummaryFromArticles } from "@/components/utils/taxUtils";
import { isFinalInvoice } from "@/lib/invoiceDocuments";
import { toParisDate as toParisDateValue } from "@/lib/dateParsing";

const safeToFixed = (num) => (typeof num === "number" ? num.toFixed(2) : "0.00");

const generateYearOptions = () => {
  const currentYear = getYear(new Date());
  const years = [];
  for (let i = currentYear + 1; i >= 2023; i -= 1) {
    years.push({ value: i, label: i.toString() });
  }
  return years;
};

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: format(new Date(0, i), "MMMM", { locale: fr }),
}));

const createPlatformAccountingAccumulator = () => ({
  paid_count: 0,
  paid_ttc: 0,
  paid_ht: 0,
  paid_tva: 0,
  unpaid_count: 0,
  unpaid_ttc: 0,
  unpaid_ht: 0,
  unpaid_tva: 0,
});

const getPlatformInvoiceAmounts = (invoice) => {
  const amountTtc = Number(invoice.metadata?.amount_ttc ?? invoice.montant ?? 0);
  const amountHt = Number(
    invoice.metadata?.amount_ht ?? (amountTtc / (1 + Number(invoice.tva_taux || 0) / 100))
  );
  const amountTva = Number(invoice.metadata?.amount_tva ?? (amountTtc - amountHt));

  return { amountTtc, amountHt, amountTva };
};

const addPlatformAccountingInvoice = (target, invoice) => {
  const { amountTtc, amountHt, amountTva } = getPlatformInvoiceAmounts(invoice);
  const isPaidInvoice = isFinalInvoice(invoice) && invoice.statut === "payee";
  const isUnpaidPaymentLine = invoice.metadata?.document_kind === "payment_request" && invoice.statut !== "payee";

  if (isPaidInvoice) {
    target.paid_count += 1;
    target.paid_ttc += amountTtc;
    target.paid_ht += amountHt;
    target.paid_tva += amountTva;
  }

  if (isUnpaidPaymentLine) {
    target.unpaid_count += 1;
    target.unpaid_ttc += amountTtc;
    target.unpaid_ht += amountHt;
    target.unpaid_tva += amountTva;
  }
};

export default function Comptabilite() {
  const { filterByTenant, isPlatformAdmin, currentTenant, currentReseller } = useTenant();
  const isPlatformAccountingView = isPlatformAdmin && !currentTenant && !currentReseller;

  const [viewMode, setViewMode] = useState("monthly");
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [monthlyYear, setMonthlyYear] = useState(getYear(new Date()));
  const [monthlyMonth, setMonthlyMonth] = useState(getMonth(new Date()));
  const [annualYear, setAnnualYear] = useState(getYear(new Date()));

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["restaurantProfile"],
    queryFn: async () => {
      const profiles = await appClient.entities.RestaurantProfile.filter(filterByTenant());
      return profiles[0] || null;
    },
    enabled: !isPlatformAccountingView,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allOrders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["allOrdersForReports"],
    queryFn: () => appClient.entities.Order.filter(filterByTenant(), "-created_date", 10000),
    enabled: !isPlatformAccountingView,
    staleTime: 5 * 60 * 1000,
  });

  const { data: platformInvoices = [], isLoading: isLoadingPlatformInvoices } = useQuery({
    queryKey: ["platformAccountingInvoices"],
    queryFn: async () => {
      const invoices = await appClient.entities.TenantInvoice.list("-created_date");
      return invoices.filter((invoice) => {
        const isPlatformIssued =
          invoice.issuer_type === "platform" ||
          (!invoice.issuer_type && (invoice.tenant_id || invoice.recipient_type === "tenant"));

        if (!isPlatformIssued) return false;

        return (
          (isFinalInvoice(invoice) && invoice.statut === "payee") ||
          invoice.metadata?.document_kind === "payment_request"
        );
      });
    },
    enabled: isPlatformAccountingView,
    staleTime: 5 * 60 * 1000,
  });

  const periodConfig = useMemo(() => {
    if (viewMode === "daily") {
      return {
        interval: { start: startOfDay(selectedDay), end: endOfDay(selectedDay) },
        periodLabel: format(selectedDay, "dd MMMM yyyy", { locale: fr }),
        detailTitle: "Détail du jour",
      };
    }

    if (viewMode === "annual") {
      const date = set(new Date(), { year: annualYear });
      return {
        interval: { start: startOfYear(date), end: endOfYear(date) },
        periodLabel: `Année ${annualYear}`,
        detailTitle: "Détail par mois",
      };
    }

    const date = set(new Date(), { year: monthlyYear, month: monthlyMonth });
    return {
      interval: { start: startOfMonth(date), end: endOfMonth(date) },
      periodLabel: format(date, "MMMM yyyy", { locale: fr }),
      detailTitle: "Détail par jour",
    };
  }, [viewMode, selectedDay, monthlyYear, monthlyMonth, annualYear]);

  const merchantReportData = useMemo(() => {
    if (isPlatformAccountingView || !allOrders || !profile) return null;

    const configuredTvaRates = (profile.tva_rates && profile.tva_rates.length > 0)
      ? profile.tva_rates.map((r) => Number(r.rate)).sort((a, b) => a - b)
      : [5.5, 10, 20];

    const { interval, periodLabel, detailTitle } = periodConfig;

    const groupingFn = viewMode === "annual"
      ? (d) => format(d, "yyyy-MM")
      : viewMode === "monthly"
        ? (d) => format(d, "yyyy-MM-dd")
        : () => "day";

    const displayFormat = viewMode === "annual"
      ? (key) => format(parseISO(`${key}-01`), "MMMM yyyy", { locale: fr })
      : viewMode === "monthly"
        ? (key) => format(parseISO(key), "eee dd/MM", { locale: fr })
        : () => format(selectedDay, "dd MMMM yyyy", { locale: fr });

    const ordersForPeriod = allOrders.filter((order) => {
      if (order.statut === "annulee" || order.statut === "en_attente" || !order.created_date) return false;
      const orderDate = parseISO(order.created_date.replace(" ", "T") + "Z");
      return isWithinInterval(orderDate, interval);
    });

    const dataByGroup = {};

    ordersForPeriod.forEach((order) => {
      const orderDate = parseISO(order.created_date.replace(" ", "T") + "Z");
      const groupKey = groupingFn(orderDate);

      if (!dataByGroup[groupKey]) {
        dataByGroup[groupKey] = {
          groupLabel: displayFormat(groupKey),
          groupKey,
          total_ttc: 0,
          total_ht: 0,
          tva_autres: 0,
          total_remises: 0,
          payment_carte_bancaire: 0,
          payment_especes: 0,
          payment_ticket_restaurant: 0,
          payment_cheque: 0,
          payment_autres: 0,
        };
        configuredTvaRates.forEach((rate) => {
          dataByGroup[groupKey][`tva_${rate}`] = 0;
        });
      }

      const groupData = dataByGroup[groupKey];
      const taxSummary = computeTaxSummaryFromArticles(order.articles || [], order.total_ttc || 0);
      groupData.total_ttc += order.total_ttc || 0;
      groupData.total_ht += taxSummary.totalHt;

      (order.articles || []).forEach((article) => {
        const tvaRate = article.tva;
        const totalLigne = article.total_ligne || 0;

        if (article.product_id?.startsWith("discount-") || article.product_id?.startsWith("loyalty-") || article.product_id?.startsWith("promo-")) {
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
        order.mode_paiement.forEach((payment) => {
          const montant = payment.montant || 0;
          if (payment.methode === "carte_bancaire") groupData.payment_carte_bancaire += montant;
          else if (payment.methode === "especes") groupData.payment_especes += montant;
          else if (payment.methode === "ticket_restaurant") groupData.payment_ticket_restaurant += montant;
          else if (payment.methode === "cheque") groupData.payment_cheque += montant;
          else groupData.payment_autres += montant;
        });
      }
    });

    const items = Object.values(dataByGroup).sort((a, b) => a.groupKey.localeCompare(b.groupKey));

    const initialTotals = {
      total_ttc: 0,
      total_ht: 0,
      tva_autres: 0,
      total_remises: 0,
      payment_carte_bancaire: 0,
      payment_especes: 0,
      payment_ticket_restaurant: 0,
      payment_cheque: 0,
      payment_autres: 0,
    };
    configuredTvaRates.forEach((rate) => { initialTotals[`tva_${rate}`] = 0; });

    const totals = items.reduce((acc, item) => {
      Object.keys(acc).forEach((key) => { acc[key] += item[key] || 0; });
      return acc;
    }, initialTotals);

    const usedConfiguredRates = configuredTvaRates.filter((rate) =>
      items.some((item) => Math.abs(item[`tva_${rate}`] || 0) > 0.0001) || Math.abs(totals[`tva_${rate}`] || 0) > 0.0001
    );

    return { items, totals, tvaRates: usedConfiguredRates, periodLabel, detailTitle };
  }, [allOrders, profile, periodConfig, selectedDay, viewMode, isPlatformAccountingView]);

  const platformReportData = useMemo(() => {
    if (!isPlatformAccountingView) return null;

    const { interval, periodLabel, detailTitle } = periodConfig;
    const groupingFn = viewMode === "annual"
      ? (d) => format(d, "yyyy-MM")
      : viewMode === "monthly"
        ? (d) => format(d, "yyyy-MM-dd")
        : () => "day";
    const displayFormat = viewMode === "annual"
      ? (key) => format(parseISO(`${key}-01`), "MMMM yyyy", { locale: fr })
      : viewMode === "monthly"
        ? (key) => format(parseISO(key), "eee dd/MM", { locale: fr })
        : () => format(selectedDay, "dd MMMM yyyy", { locale: fr });

    const invoicesForPeriod = platformInvoices.filter((invoice) => {
      const isPaidInvoice = isFinalInvoice(invoice) && invoice.statut === "payee";
      const sourceDate = isPaidInvoice
        ? (invoice.date_paiement || invoice.updated_date || invoice.created_date || invoice.date_facturation)
        : (invoice.created_date || invoice.date_facturation);
      if (!sourceDate) return false;
      const invoiceDate = toParisDateValue(sourceDate);
      return invoiceDate ? isWithinInterval(invoiceDate, interval) : false;
    });

    const dataByGroup = {};
    invoicesForPeriod.forEach((invoice) => {
      const isPaidInvoice = isFinalInvoice(invoice) && invoice.statut === "payee";
      const sourceDate = isPaidInvoice
        ? (invoice.date_paiement || invoice.updated_date || invoice.created_date || invoice.date_facturation)
        : (invoice.created_date || invoice.date_facturation);
      const groupKey = groupingFn(toParisDateValue(sourceDate));

      if (!dataByGroup[groupKey]) {
        dataByGroup[groupKey] = {
          groupLabel: displayFormat(groupKey),
          groupKey,
          ...createPlatformAccountingAccumulator(),
        };
      }

      addPlatformAccountingInvoice(dataByGroup[groupKey], invoice);
    });

    const items = Object.values(dataByGroup).sort((a, b) => a.groupKey.localeCompare(b.groupKey));
    const totals = items.reduce((acc, item) => {
      Object.keys(createPlatformAccountingAccumulator()).forEach((key) => {
        acc[key] += item[key] || 0;
      });
      return acc;
    }, createPlatformAccountingAccumulator());

    return { items, totals, periodLabel, detailTitle };
  }, [isPlatformAccountingView, periodConfig, platformInvoices, selectedDay, viewMode]);

  const reportData = isPlatformAccountingView ? platformReportData : merchantReportData;
  const items = reportData?.items || [];
  const totals = reportData?.totals || {};
  const tvaRates = reportData?.tvaRates || [];
  const periodLabel = reportData?.periodLabel || "";
  const detailTitle = reportData?.detailTitle || "";

  const isLoading = isPlatformAccountingView ? isLoadingPlatformInvoices : isLoadingOrders || isLoadingProfile;
  const hasData = items.length > 0;

  const totalTVA = useMemo(() => {
    if (isPlatformAccountingView) return Number(totals.total_tva || 0);
    let total = totals.tva_autres || 0;
    tvaRates.forEach((rate) => { total += totals[`tva_${rate}`] || 0; });
    return total;
  }, [isPlatformAccountingView, totals, tvaRates]);

  const platformGrandTotals = useMemo(() => ({
    total_ttc: Number(totals.paid_ttc || 0) + Number(totals.unpaid_ttc || 0),
    total_ht: Number(totals.paid_ht || 0) + Number(totals.unpaid_ht || 0),
    total_tva: Number(totals.paid_tva || 0) + Number(totals.unpaid_tva || 0),
  }), [totals]);

  const exportTo = (formatType) => {
    if (!hasData) return;

    if (isPlatformAccountingView) {
      const headers = [
        "Période",
        "Paye TTC",
        "Paye HT",
        "TVA payee",
        "Non paye TTC",
        "Non paye HT",
        "TVA non payee",
        "Total TTC",
        "Total HT",
      ];

      const bodyRows = items.map((item) => [
        `"${item.groupLabel}"`,
        safeToFixed(item.paid_ttc),
        safeToFixed(item.paid_ht),
        safeToFixed(item.paid_tva),
        safeToFixed(item.unpaid_ttc),
        safeToFixed(item.unpaid_ht),
        safeToFixed(item.unpaid_tva),
        safeToFixed((item.paid_ttc || 0) + (item.unpaid_ttc || 0)),
        safeToFixed((item.paid_ht || 0) + (item.unpaid_ht || 0)),
      ]);

      const footerRow = [
        "Total",
        safeToFixed(totals.paid_ttc),
        safeToFixed(totals.paid_ht),
        safeToFixed(totals.paid_tva),
        safeToFixed(totals.unpaid_ttc),
        safeToFixed(totals.unpaid_ht),
        safeToFixed(totals.unpaid_tva),
        safeToFixed(platformGrandTotals.total_ttc),
        safeToFixed(platformGrandTotals.total_ht),
      ];

      if (formatType === "csv") {
        const csvContent = [
          `Rapport Comptable Plateforme`,
          `Période;"${periodLabel}"`,
          "",
          headers.join(";"),
          ...bodyRows.map((row) => row.map((cell) => String(cell).replace(".", ",")).join(";")),
          footerRow.map((cell) => String(cell).replace(".", ",")).join(";"),
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `rapport_comptable_plateforme_${periodLabel.replace(/\s/g, "_")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      const html = `
        <html><head><meta charset="UTF-8"><title>Rapport Comptable Plateforme - ${periodLabel}</title>
        <style>
          body { font-family: sans-serif; font-size: 10px; }
          h1, h2 { text-align: center; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 4px; text-align: right; }
          th:first-child, td:first-child { text-align: left; }
          thead { background-color: #f2f2f2; }
          tfoot { font-weight: bold; background: #f7f7f7; }
        </style></head>
        <body onload="window.print()">
          <h1>Rapport Comptable Plateforme</h1>
          <h2>Période: ${periodLabel}</h2>
          <table>
            <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
            <tbody>${bodyRows.map((row) => `<tr>${row.map((cell, index) => `<td>${index === 0 ? String(cell).replace(/"/g, "") : cell}${index > 1 ? "€" : ""}</td>`).join("")}</tr>`).join("")}</tbody>
            <tfoot><tr>${footerRow.map((cell, index) => `<td>${index === 0 ? cell : cell}${index > 1 ? "€" : ""}</td>`).join("")}</tr></tfoot>
          </table>
        </body></html>
      `;
      const win = window.open("", "_blank");
      win.document.write(html);
      win.document.close();
      return;
    }

    const headers = ["Période", "CA TTC", "CA HT", "Remises", ...tvaRates.map((r) => `TVA ${r}%`), "TVA Autres", "Carte", "Espèces", "Ticket Resto.", "Chèque", "Paiem. Autres"];
    const bodyRows = items.map((item) => [
      `"${item.groupLabel}"`,
      safeToFixed(item.total_ttc),
      safeToFixed(item.total_ht),
      safeToFixed(item.total_remises),
      ...tvaRates.map((r) => safeToFixed(item[`tva_${r}`])),
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
      ...tvaRates.map((r) => safeToFixed(totals[`tva_${r}`])),
      safeToFixed(totals.tva_autres),
      safeToFixed(totals.payment_carte_bancaire),
      safeToFixed(totals.payment_especes),
      safeToFixed(totals.payment_ticket_restaurant),
      safeToFixed(totals.payment_cheque),
      safeToFixed(totals.payment_autres),
    ];

    if (formatType === "csv") {
      const establishmentName = `Établissement;${profile?.nom_etablissement || "N/A"}\n`;
      const periodInfo = `Période;${periodLabel}\n\n`;
      const csvContent = [
        headers.join(";"),
        ...bodyRows.map((row) => row.map((cell) => String(cell).replace(".", ",")).join(";")),
        footerRow.map((cell) => String(cell).replace(".", ",")).join(";"),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + establishmentName + periodInfo + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `rapport_comptable_${periodLabel.replace(/\s/g, "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const html = `
      <html><head><meta charset="UTF-8"><title>Rapport Comptable - ${periodLabel}</title>
      <style>
        body { font-family: sans-serif; font-size: 10px; }
        h1, h2, h3 { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 4px; text-align: right; }
        th:first-child, td:first-child { text-align: left; }
        thead { background-color: #f2f2f2; }
        tfoot { font-weight: bold; background: #f7f7f7; }
      </style></head>
      <body onload="window.print()">
        <h1>Rapport Comptable</h1>
        <h3>${profile?.nom_etablissement || ""}</h3>
        <h2>Période: ${periodLabel}</h2>
        <table>
          <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
          <tbody>${bodyRows.map((row) => `<tr>${row.map((cell, index) => `<td>${index === 0 ? String(cell).replace(/"/g, "") : cell}${index > 0 ? "€" : ""}</td>`).join("")}</tr>`).join("")}</tbody>
          <tfoot><tr>${footerRow.map((cell, index) => `<td>${cell}${index > 0 ? "€" : ""}</td>`).join("")}</tr></tfoot>
        </table>
      </body></html>
    `;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-screen-xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <BookCopy className="w-8 h-8 text-blue-600" /> {isPlatformAccountingView ? "Comptabilité Plateforme" : "Rapport Comptable"}
            </h1>
            <p className="text-gray-500 mt-1">
              {isPlatformAccountingView
                ? "Exports détaillés de vos ventes plateforme vers commerces et revendeurs."
                : "Analyse de votre chiffre d'affaires, paiements et TVA."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white" onClick={() => exportTo("csv")} disabled={!hasData || isLoading}>
              <FileDown className="w-4 h-4 mr-2" /> CSV
            </Button>
            <Button variant="outline" className="bg-white" onClick={() => exportTo("pdf")} disabled={!hasData || isLoading}>
              <FileType className="w-4 h-4 mr-2" /> PDF
            </Button>
          </div>
        </div>

        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">Rapport Journalier</TabsTrigger>
            <TabsTrigger value="monthly">Rapport Mensuel</TabsTrigger>
            <TabsTrigger value="annual">Rapport Annuel</TabsTrigger>
          </TabsList>
          <TabsContent value="daily">
            <div className="flex justify-center items-center gap-2 my-4">
              <Select value={format(selectedDay, "yyyy-MM-dd")} onValueChange={(val) => setSelectedDay(parseISO(`${val}T00:00:00`))}>
                <SelectTrigger className="w-[220px] bg-white"><SelectValue placeholder="Jour" /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const value = format(date, "yyyy-MM-dd");
                    return <SelectItem key={value} value={value}>{format(date, "dd MMMM yyyy", { locale: fr })}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          <TabsContent value="monthly">
            <div className="flex justify-center items-center gap-2 my-4">
              <Select value={String(monthlyMonth)} onValueChange={(val) => setMonthlyMonth(Number(val))}>
                <SelectTrigger className="w-[150px] bg-white"><SelectValue placeholder="Mois" /></SelectTrigger>
                <SelectContent>{monthOptions.map((opt) => <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(monthlyYear)} onValueChange={(val) => setMonthlyYear(Number(val))}>
                <SelectTrigger className="w-[100px] bg-white"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>{generateYearOptions().map((opt) => <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </TabsContent>
          <TabsContent value="annual">
            <div className="flex justify-center items-center gap-2 my-4">
              <Select value={String(annualYear)} onValueChange={(val) => setAnnualYear(Number(val))}>
                <SelectTrigger className="w-[100px] bg-white"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>{generateYearOptions().map((opt) => <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isPlatformAccountingView ? (
            <>
              <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Ventes payees TTC</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{safeToFixed(totals?.paid_ttc)}€</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Ventes payees HT</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{safeToFixed(totals?.paid_ht)}€</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Ventes en attente TTC</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{safeToFixed(totals?.unpaid_ttc)}€</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Ventes en attente HT</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-amber-600">{safeToFixed(totals?.unpaid_ht)}€</p></CardContent></Card>
            </>
          ) : (
            <>
              <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Chiffre d'Affaires TTC</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{safeToFixed(totals?.total_ttc)}€</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Chiffre d'Affaires HT</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{safeToFixed(totals?.total_ht)}€</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500">Total TVA</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{safeToFixed(totalTVA)}€</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">Total Remises <Percent className="w-4 h-4" /></CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{safeToFixed(totals?.total_remises)}€</p></CardContent></Card>
            </>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle>{detailTitle}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[60vh] w-full whitespace-nowrap">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50 z-10">
                  <TableRow>
                    <TableHead className="min-w-[150px]">Période</TableHead>
                    {isPlatformAccountingView ? (
                      <>
                        <TableHead className="text-right min-w-[120px]">Paye TTC</TableHead>
                        <TableHead className="text-right min-w-[120px]">Paye HT</TableHead>
                        <TableHead className="text-right min-w-[120px]">TVA payee</TableHead>
                        <TableHead className="text-right min-w-[120px]">Non paye TTC</TableHead>
                        <TableHead className="text-right min-w-[120px]">Non paye HT</TableHead>
                        <TableHead className="text-right min-w-[120px]">TVA non payee</TableHead>
                        <TableHead className="text-right min-w-[120px]">Total TTC</TableHead>
                        <TableHead className="text-right min-w-[120px]">Total HT</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="text-right min-w-[120px]">CA TTC</TableHead>
                        <TableHead className="text-right min-w-[120px]">CA HT</TableHead>
                        <TableHead className="text-right min-w-[120px] text-red-600">Remises</TableHead>
                        {tvaRates.map((rate) => <TableHead key={rate} className="text-right min-w-[100px]">TVA {rate}%</TableHead>)}
                        <TableHead className="text-right min-w-[100px]">TVA Autres</TableHead>
                        <TableHead className="text-right min-w-[120px]">Carte</TableHead>
                        <TableHead className="text-right min-w-[120px]">Espèces</TableHead>
                        <TableHead className="text-right min-w-[120px]">Ticket Resto.</TableHead>
                        <TableHead className="text-right min-w-[120px]">Chèque</TableHead>
                        <TableHead className="text-right min-w-[120px]">Paiem. Autres</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={isPlatformAccountingView ? 9 : 11 + tvaRates.length} className="text-center py-10"><Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" /><p className="text-gray-500 mt-2">Chargement des données...</p></TableCell></TableRow>
                  ) : hasData ? (
                    items.map((item) => (
                      <TableRow key={item.groupKey || item.groupLabel}>
                        <TableCell className="font-medium">{item.groupLabel}</TableCell>
                        {isPlatformAccountingView ? (
                          <>
                            <TableCell className="text-right">{safeToFixed(item.paid_ttc)}€</TableCell>
                            <TableCell className="text-right">{safeToFixed(item.paid_ht)}€</TableCell>
                            <TableCell className="text-right">{safeToFixed(item.paid_tva)}€</TableCell>
                            <TableCell className="text-right text-amber-600">{safeToFixed(item.unpaid_ttc)}€</TableCell>
                            <TableCell className="text-right text-amber-600">{safeToFixed(item.unpaid_ht)}€</TableCell>
                            <TableCell className="text-right text-amber-600">{safeToFixed(item.unpaid_tva)}€</TableCell>
                            <TableCell className="text-right">{safeToFixed((item.paid_ttc || 0) + (item.unpaid_ttc || 0))}€</TableCell>
                            <TableCell className="text-right">{safeToFixed((item.paid_ht || 0) + (item.unpaid_ht || 0))}€</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="text-right">{safeToFixed(item.total_ttc)}€</TableCell>
                            <TableCell className="text-right">{safeToFixed(item.total_ht)}€</TableCell>
                            <TableCell className="text-right text-red-600">{safeToFixed(item.total_remises)}€</TableCell>
                            {tvaRates.map((rate) => <TableCell key={rate} className="text-right">{safeToFixed(item[`tva_${rate}`])}€</TableCell>)}
                            <TableCell className="text-right">{safeToFixed(item.tva_autres)}€</TableCell>
                            <TableCell className="text-right">{safeToFixed(item.payment_carte_bancaire)}€</TableCell>
                            <TableCell className="text-right">{safeToFixed(item.payment_especes)}€</TableCell>
                            <TableCell className="text-right">{safeToFixed(item.payment_ticket_restaurant)}€</TableCell>
                            <TableCell className="text-right">{safeToFixed(item.payment_cheque)}€</TableCell>
                            <TableCell className="text-right">{safeToFixed(item.payment_autres)}€</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={isPlatformAccountingView ? 9 : 11 + tvaRates.length} className="text-center py-10 text-gray-500">
                      {isPlatformAccountingView ? "Aucune vente plateforme pour la période sélectionnée." : "Aucune donnée de commande pour la période sélectionnée."}
                    </TableCell></TableRow>
                  )}
                </TableBody>
                {hasData && (
                  <TableFooter className="sticky bottom-0 bg-gray-100 font-bold">
                    <TableRow>
                      <TableCell>Total</TableCell>
                      {isPlatformAccountingView ? (
                        <>
                          <TableCell className="text-right">{safeToFixed(totals.paid_ttc)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(totals.paid_ht)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(totals.paid_tva)}€</TableCell>
                          <TableCell className="text-right text-amber-600">{safeToFixed(totals.unpaid_ttc)}€</TableCell>
                          <TableCell className="text-right text-amber-600">{safeToFixed(totals.unpaid_ht)}€</TableCell>
                          <TableCell className="text-right text-amber-600">{safeToFixed(totals.unpaid_tva)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(platformGrandTotals.total_ttc)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(platformGrandTotals.total_ht)}€</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right">{safeToFixed(totals.total_ttc)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(totals.total_ht)}€</TableCell>
                          <TableCell className="text-right text-red-600">{safeToFixed(totals.total_remises)}€</TableCell>
                          {tvaRates.map((rate) => <TableCell key={rate} className="text-right">{safeToFixed(totals[`tva_${rate}`])}€</TableCell>)}
                          <TableCell className="text-right">{safeToFixed(totals.tva_autres)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(totals.payment_carte_bancaire)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(totals.payment_especes)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(totals.payment_ticket_restaurant)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(totals.payment_cheque)}€</TableCell>
                          <TableCell className="text-right">{safeToFixed(totals.payment_autres)}€</TableCell>
                        </>
                      )}
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
