import React, { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ClipboardList,
  Calendar as CalendarIcon,
  ArrowUpDown,
  Search,
  Package,
  Download,
  FileText,
  Sheet,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  getYear,
  getMonth,
  subDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { getValidOrders } from "@/components/utils/orderUtils";
import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { useTenant } from "@/components/contexts/TenantContext";
import { toParisDate as toParisDateValue } from "@/lib/dateParsing";
import TopProductsChart from "../components/product-analysis/TopProductsChart";

const isRealProductArticle = (article) => {
  const productId = article?.product_id;
  if (!productId) return false;

  const ignoredPrefixes = ["discount-", "loyalty-", "promo-", "offer-", "scratch-"];
  return !ignoredPrefixes.some((prefix) => String(productId).startsWith(prefix));
};

export default function AnalyseProduits() {
  const { filterByTenant } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "revenue", direction: "desc" });

  const [dateFilter, setDateFilter] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [yearForMonthSelector, setYearForMonthSelector] = useState(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [intervalStart, setIntervalStart] = useState(subDays(new Date(), 30));
  const [intervalEnd, setIntervalEnd] = useState(new Date());

  const getDateRangeFromFilter = useCallback(() => {
    const now = new Date();

    switch (dateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "specific_day":
        return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
      case "month":
        return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
      case "year":
        return {
          start: startOfYear(new Date(selectedYear, 0, 1)),
          end: endOfYear(new Date(selectedYear, 0, 1)),
        };
      case "interval":
        return { start: startOfDay(intervalStart), end: endOfDay(intervalEnd) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [dateFilter, selectedDate, selectedMonth, selectedYear, intervalStart, intervalEnd]);

  const getPeriodLabel = useCallback(() => {
    switch (dateFilter) {
      case "today":
        return "Aujourd'hui";
      case "specific_day":
        return format(selectedDate, "dd MMMM yyyy", { locale: fr });
      case "month":
        return format(selectedMonth, "MMMM yyyy", { locale: fr });
      case "year":
        return selectedYear.toString();
      case "interval":
        return `Du ${format(intervalStart, "dd/MM/yyyy", { locale: fr })} au ${format(intervalEnd, "dd/MM/yyyy", { locale: fr })}`;
      default:
        return "Periode selectionnee";
    }
  }, [dateFilter, selectedDate, selectedMonth, selectedYear, intervalStart, intervalEnd]);

  const { start: startDateInParis, end: endDateInParis } = useMemo(
    () => getDateRangeFromFilter(),
    [getDateRangeFromFilter]
  );

  const startDateStr = startDateInParis ? startDateInParis.toISOString() : "";
  const endDateStr = endDateInParis ? endDateInParis.toISOString() : "";

  const { data: ordersData = [], isLoading: ordersLoading, isFetching: isFetchingOrders } = useQuery({
    queryKey: ["productAnalysisOrders", startDateStr, endDateStr],
    queryFn: () => appClient.entities.Order.filter(filterByTenant(), "-created_date", 2000),
    enabled: Boolean(startDateInParis && endDateInParis),
    staleTime: 1000 * 60 * 2,
  });

  const { data: productsData = [], isLoading: isLoadingProducts, isFetching: isFetchingProducts } = useQuery({
    queryKey: ["productAnalysisProducts"],
    queryFn: () => appClient.entities.Product.filter(filterByTenant()),
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const { data: categoriesData = [], isLoading: isLoadingCategories, isFetching: isFetchingCategories } = useQuery({
    queryKey: ["productAnalysisCategories"],
    queryFn: () => appClient.entities.Category.filter(filterByTenant()),
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const isLoading =
    ordersLoading ||
    isLoadingProducts ||
    isLoadingCategories ||
    isFetchingOrders ||
    isFetchingProducts ||
    isFetchingCategories;

  const categories = useMemo(
    () =>
      categoriesData.reduce((acc, category) => {
        acc[category.id] = category.nom;
        return acc;
      }, {}),
    [categoriesData]
  );

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(ordersData) || !startDateInParis || !endDateInParis) return [];

    return getValidOrders(ordersData).filter((order) => {
      if (!order?.created_date) return false;
      const orderDate = toParisDateValue(order.created_date);
      if (!orderDate) return false;
      return orderDate >= startDateInParis && orderDate <= endDateInParis;
    });
  }, [ordersData, startDateInParis, endDateInParis]);

  const productStats = useMemo(() => {
    if (!Array.isArray(filteredOrders) || !Array.isArray(productsData)) return [];

    const productMap = new Map(productsData.map((product) => [product.id, product]));
    const stats = new Map();
    let totalRevenueForPeriod = 0;

    filteredOrders.forEach((order) => {
      totalRevenueForPeriod += Number(order?.total_ttc) || 0;

      if (!Array.isArray(order.articles)) return;

      order.articles.forEach((article) => {
        if (!isRealProductArticle(article)) return;

        const productId = article.product_id;
        const product = productMap.get(productId);
        const current = stats.get(productId) || {
          id: productId,
          name: product?.nom || article.nom_produit || "Produit inconnu",
          categoryId: product?.category_id || null,
          quantity: 0,
          revenue: 0,
        };

        current.quantity += Number(article.quantite) || 0;
        current.revenue += Number(article.total_ligne) || 0;
        stats.set(productId, current);
      });
    });

    return Array.from(stats.values()).map((stat) => ({
      ...stat,
      avgPrice: stat.quantity > 0 ? stat.revenue / stat.quantity : 0,
      revenuePercentage: totalRevenueForPeriod > 0 ? (stat.revenue / totalRevenueForPeriod) * 100 : 0,
    }));
  }, [filteredOrders, productsData]);

  const sortedAndFilteredProducts = useMemo(() => {
    const filtered = productStats
      .filter((product) => product.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter((product) => selectedCategory === "all" || product.categoryId === selectedCategory);

    return filtered.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [productStats, searchTerm, selectedCategory, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((previous) => ({
      key,
      direction: previous.key === key && previous.direction === "desc" ? "asc" : "desc",
    }));
  };

  const exportToCSV = () => {
    const headers = [
      "Produit",
      "Categorie",
      "Quantite vendue",
      "Chiffre d'affaires (EUR)",
      "Prix moyen (EUR)",
      "% du CA total",
    ];

    const rows = sortedAndFilteredProducts.map((product) =>
      [
        `"${product.name.replace(/"/g, '""')}"`,
        `"${(categories[product.categoryId] || "N/A").replace(/"/g, '""')}"`,
        product.quantity,
        product.revenue.toFixed(2),
        product.avgPrice.toFixed(2),
        `${product.revenuePercentage.toFixed(1)}%`,
      ].join(";")
    );

    const csvContent = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const periodLabel = getPeriodLabel().replace(/[\s/]/g, "-");
    const dateLabel = format(new Date(), "yyyy-MM-dd");

    link.setAttribute("href", url);
    link.setAttribute("download", `analyse-produits-${periodLabel}-${dateLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateProductsReportHTML = () => {
    const periodLabel = getPeriodLabel();
    const generationDate = format(new Date(), "dd/MM/yyyy 'a' HH:mm", { locale: fr });

    const rows = sortedAndFilteredProducts
      .map(
        (product) => `
          <tr>
            <td>${product.name}</td>
            <td>${categories[product.categoryId] || "N/A"}</td>
            <td style="text-align:center;">${product.quantity}</td>
            <td style="text-align:right;">${product.revenue.toFixed(2)} EUR</td>
            <td style="text-align:right;">${product.avgPrice.toFixed(2)} EUR</td>
            <td style="text-align:right;">${product.revenuePercentage.toFixed(1)}%</td>
          </tr>
        `
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Analyse des ventes par produit</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; color: #222; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0 0 6px; font-size: 20px; }
            .header p { margin: 0; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background: #f6f6f6; text-align: left; }
          </style>
        </head>
        <body onload="window.print();">
          <div class="header">
            <h1>Analyse des ventes par produit</h1>
            <p>Periode : ${periodLabel}</p>
            <p>Genere le ${generationDate}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Categorie</th>
                <th>Quantite vendue</th>
                <th>Chiffre d'affaires</th>
                <th>Prix moyen</th>
                <th>% du CA total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
  };

  const exportToPDF = () => {
    const newWindow = window.open("", "_blank");
    if (!newWindow) {
      alert("Le navigateur a bloque l'ouverture de la fenetre d'impression.");
      return;
    }

    newWindow.document.write(generateProductsReportHTML());
    newWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-orange-500" />
              Analyse des Ventes par Produit
            </h1>
            <p className="text-sm text-blue-600 mt-1">Periode: {getPeriodLabel()}</p>
          </div>

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

        <Card className="shadow-lg border-0">
          <CardContent className="p-6">
            <Tabs value={dateFilter} onValueChange={setDateFilter}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="today">Aujourd'hui</TabsTrigger>
                <TabsTrigger value="specific_day">Un jour</TabsTrigger>
                <TabsTrigger value="month">Un mois</TabsTrigger>
                <TabsTrigger value="year">Une annee</TabsTrigger>
                <TabsTrigger value="interval">Intervalle</TabsTrigger>
              </TabsList>

              <div className="mt-4">
                <TabsContent value="specific_day" className="flex justify-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {format(selectedDate, "dd MMMM yyyy", { locale: fr })}
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
                    {Array.from({ length: 12 }, (_, index) => {
                      const monthDate = new Date(yearForMonthSelector, index, 1);
                      const isSelected =
                        getYear(selectedMonth) === yearForMonthSelector && getMonth(selectedMonth) === index;

                      return (
                        <Button
                          key={index}
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => setSelectedMonth(monthDate)}
                          disabled={monthDate > new Date()}
                          className="capitalize"
                        >
                          {format(monthDate, "MMM", { locale: fr })}
                        </Button>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="year" className="flex justify-center">
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, index) => new Date().getFullYear() - index).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>

                <TabsContent value="interval" className="flex justify-center gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {format(intervalStart, "dd/MM/yyyy", { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={intervalStart} onSelect={(date) => date && setIntervalStart(date)} locale={fr} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        {format(intervalEnd, "dd/MM/yyyy", { locale: fr })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={intervalEnd} onSelect={(date) => date && setIntervalEnd(date)} locale={fr} />
                    </PopoverContent>
                  </Popover>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <TopProductsChart productStats={productStats} />

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher un produit..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-1/4">
                  <SelectValue placeholder="Filtrer par categorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les categories</SelectItem>
                  {Object.entries(categories).map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-[30%]">Produit</TableHead>
                    <TableHead>Categorie</TableHead>
                    <TableHead className="text-center cursor-pointer" onClick={() => handleSort("quantity")}>
                      <div className="flex items-center justify-center gap-1">
                        Quantite <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort("revenue")}>
                      <div className="flex items-center justify-end gap-1">
                        Chiffre d'affaires <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Prix moyen</TableHead>
                    <TableHead className="text-right">% du CA total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        Chargement...
                      </TableCell>
                    </TableRow>
                  ) : sortedAndFilteredProducts.length > 0 ? (
                    sortedAndFilteredProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{categories[product.categoryId] || "N/A"}</TableCell>
                        <TableCell className="text-center font-bold">{product.quantity}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {product.revenue.toFixed(2)}EUR
                        </TableCell>
                        <TableCell className="text-right">{product.avgPrice.toFixed(2)}EUR</TableCell>
                        <TableCell className="text-right">{product.revenuePercentage.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-32 text-gray-500">
                        <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        Aucune vente pour cette periode ou ce filtre.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
