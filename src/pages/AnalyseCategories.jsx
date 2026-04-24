import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, Download, FileText, Loader2, TrendingUp, TrendingDown, ArrowUpDown, Layers, Search } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, startOfDay, endOfDay, getYear, getMonth, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import TopCategoriesChart from '../components/stats/TopCategoriesChart';

export default function AnalyseCategories() {
    const { filterByTenant } = useTenant();
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('month');
    const [sortConfig, setSortConfig] = useState({ key: 'revenue', direction: 'desc' });
    
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [yearForMonthSelector, setYearForMonthSelector] = useState(new Date().getFullYear());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [intervalStart, setIntervalStart] = useState(subDays(new Date(), 30));
    const [intervalEnd, setIntervalEnd] = useState(new Date());

    const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
        queryKey: ['orders'],
        queryFn: () => appClient.entities.Order.filter(filterByTenant()),
    });

    const { data: products = [], isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products'],
        queryFn: () => appClient.entities.Product.filter(filterByTenant()),
    });

    const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
        queryKey: ['categories'],
        queryFn: () => appClient.entities.Category.filter(filterByTenant()),
    });

    const isLoading = isLoadingOrders || isLoadingProducts || isLoadingCategories;

    const getDateRange = useCallback(() => {
        const now = new Date();
        switch (dateFilter) {
            case 'today':
                return { start: startOfDay(now), end: endOfDay(now) };
            case 'specific_day':
                return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
            case 'month':
                return { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
            case 'year':
                return { start: startOfYear(new Date(selectedYear, 0, 1)), end: endOfYear(new Date(selectedYear, 0, 1)) };
            case 'interval':
                return { start: startOfDay(intervalStart), end: endOfDay(intervalEnd) };
            default:
                return { start: startOfMonth(now), end: endOfMonth(now) };
        }
    }, [dateFilter, selectedDate, selectedMonth, selectedYear, intervalStart, intervalEnd]);

    const getPeriodLabel = useCallback(() => {
        switch (dateFilter) {
            case 'today': return 'Aujourd\'hui';
            case 'specific_day': return format(selectedDate, 'dd MMMM yyyy', { locale: fr });
            case 'month': return format(selectedMonth, 'MMMM yyyy', { locale: fr });
            case 'year': return selectedYear.toString();
            case 'interval': return `Du ${format(intervalStart, 'dd/MM/yyyy', { locale: fr })} au ${format(intervalEnd, 'dd/MM/yyyy', { locale: fr })}`;
            default: return 'Période sélectionnée';
        }
    }, [dateFilter, selectedDate, selectedMonth, selectedYear, intervalStart, intervalEnd]);

    const categoryStats = useMemo(() => {
        const { start, end } = getDateRange();

        const filteredOrders = orders.filter(order => {
            if (order.statut === 'annulee' || !order.payee) return false;
            const orderDate = parseISO(order.created_date);
            return orderDate >= start && orderDate <= end;
        });

        const statsMap = {};

        categories.forEach(category => {
            statsMap[category.id] = {
                id: category.id,
                name: category.nom,
                quantity: 0,
                revenue: 0,
                orderCount: 0
            };
        });

        filteredOrders.forEach(order => {
            if (!Array.isArray(order.articles)) return;

            order.articles.forEach(article => {
                if (article.product_id?.startsWith('discount-') || 
                    article.product_id?.startsWith('loyalty-') || 
                    article.product_id?.startsWith('promo-')) {
                    return;
                }

                let categoryId = null;
                if (article.isMenu && article.menu_id) {
                    categoryId = 'menus';
                } else if (article.product_id) {
                    const product = products.find(p => p.id === article.product_id);
                    categoryId = product?.category_id;
                }

                if (categoryId) {
                    if (!statsMap[categoryId]) {
                        if (categoryId === 'menus') {
                            statsMap[categoryId] = {
                                id: categoryId,
                                name: 'Menus',
                                quantity: 0,
                                revenue: 0,
                                orderCount: 0
                            };
                        }
                    }

                    if (statsMap[categoryId]) {
                        statsMap[categoryId].quantity += article.quantite || 0;
                        statsMap[categoryId].revenue += (article.prix_unitaire || 0) * (article.quantite || 0);
                        statsMap[categoryId].orderCount++;
                    }
                }
            });
        });

        return Object.values(statsMap).filter(stat => stat.quantity > 0);
    }, [orders, products, categories, dateFilter]);

    const filteredStats = useMemo(() => {
        let filtered = categoryStats;

        if (searchTerm) {
            filtered = filtered.filter(stat =>
                stat.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return filtered.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            const direction = sortConfig.direction === 'asc' ? 1 : -1;
            return (aValue > bValue ? 1 : -1) * direction;
        });
    }, [categoryStats, searchTerm, sortConfig]);

    const totalRevenue = useMemo(() => {
        return categoryStats.reduce((sum, stat) => sum + stat.revenue, 0);
    }, [categoryStats]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const exportToCSV = () => {
        const headers = ['Catégorie', 'Quantité Vendue', 'Chiffre d\'Affaires', 'Prix Moyen', '% du CA'];
        const rows = filteredStats.map(stat => [
            stat.name,
            stat.quantity,
            stat.revenue.toFixed(2),
            (stat.revenue / stat.quantity).toFixed(2),
            ((stat.revenue / totalRevenue) * 100).toFixed(1)
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `analyse_categories_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
    };

    const exportToPDF = () => {
        const printWindow = window.open('', '_blank');
        const { start, end } = getDateRange();

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Analyse des Catégories</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background-color: #4F46E5; color: white; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .summary { margin: 20px 0; padding: 15px; background: #f0f0f0; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>Analyse des Catégories</h1>
                <div class="summary">
                    <p><strong>Période:</strong> ${format(start, 'dd/MM/yyyy', { locale: fr })} - ${format(end, 'dd/MM/yyyy', { locale: fr })}</p>
                    <p><strong>Chiffre d'affaires total:</strong> ${totalRevenue.toFixed(2)}€</p>
                    <p><strong>Nombre de catégories:</strong> ${filteredStats.length}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Catégorie</th>
                            <th>Quantité</th>
                            <th>CA (€)</th>
                            <th>Prix Moyen (€)</th>
                            <th>% du CA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredStats.map(stat => `
                            <tr>
                                <td>${stat.name}</td>
                                <td>${stat.quantity}</td>
                                <td>${stat.revenue.toFixed(2)}€</td>
                                <td>${(stat.revenue / stat.quantity).toFixed(2)}€</td>
                                <td>${((stat.revenue / totalRevenue) * 100).toFixed(1)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const SortButton = ({ column, label }) => (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSort(column)}
            className="font-semibold"
        >
            {label}
            <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <Layers className="w-8 h-8 text-indigo-600" />
                            Analyse des Catégories
                        </h1>
                        <p className="text-sm text-blue-600 mt-1">Période: {getPeriodLabel()}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={exportToCSV} variant="outline" className="gap-2">
                            <Download className="w-4 h-4" />
                            Export CSV
                        </Button>
                        <Button onClick={exportToPDF} variant="outline" className="gap-2">
                            <FileText className="w-4 h-4" />
                            Export PDF
                        </Button>
                    </div>
                </div>

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
                                <TabsContent value="specific_day" className="flex justify-center">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="gap-2">
                                                <Calendar className="w-4 h-4" />
                                                {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <CalendarComponent mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} locale={fr} />
                                        </PopoverContent>
                                    </Popover>
                                </TabsContent>
                                <TabsContent value="month" className="flex flex-col items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <Button variant="outline" size="sm" onClick={() => setYearForMonthSelector(yearForMonthSelector - 1)}>&lt; {yearForMonthSelector - 1}</Button>
                                        <span className="font-bold text-lg">{yearForMonthSelector}</span>
                                        <Button variant="outline" size="sm" onClick={() => setYearForMonthSelector(yearForMonthSelector + 1)} disabled={yearForMonthSelector === new Date().getFullYear()}>{yearForMonthSelector + 1} &gt;</Button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 w-full max-w-md">
                                        {Array.from({ length: 12 }, (_, i) => {
                                            const monthDate = new Date(yearForMonthSelector, i, 1);
                                            const isSelected = getYear(selectedMonth) === yearForMonthSelector && getMonth(selectedMonth) === i;
                                            return (<Button key={i} variant={isSelected ? "default" : "outline"} onClick={() => setSelectedMonth(monthDate)} disabled={monthDate > new Date()} className="capitalize">{format(monthDate, 'MMM', { locale: fr })}</Button>);
                                        })}
                                    </div>
                                </TabsContent>
                                <TabsContent value="year" className="flex justify-center">
                                    <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}>
                                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TabsContent>
                                <TabsContent value="interval" className="flex justify-center gap-4">
                                    <Popover>
                                        <PopoverTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Calendar className="w-4 h-4" />{format(intervalStart, 'dd/MM/yyyy', { locale: fr })}</Button></PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={intervalStart} onSelect={(date) => date && setIntervalStart(date)} locale={fr} /></PopoverContent>
                                    </Popover>
                                    <Popover>
                                        <PopoverTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Calendar className="w-4 h-4" />{format(intervalEnd, 'dd/MM/yyyy', { locale: fr })}</Button></PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={intervalEnd} onSelect={(date) => date && setIntervalEnd(date)} locale={fr} /></PopoverContent>
                                    </Popover>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </CardContent>
                </Card>

                <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Rechercher une catégorie..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                <TopCategoriesChart data={filteredStats} />

                <Card>
                    <CardHeader>
                        <CardTitle>Détails des Catégories</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-3">
                                            <SortButton column="name" label="Catégorie" />
                                        </th>
                                        <th className="text-right p-3">
                                            <SortButton column="quantity" label="Quantité" />
                                        </th>
                                        <th className="text-right p-3">
                                            <SortButton column="revenue" label="CA (€)" />
                                        </th>
                                        <th className="text-right p-3">Prix Moyen</th>
                                        <th className="text-right p-3">% du CA</th>
                                        <th className="text-right p-3">Tendance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStats.map((stat) => {
                                        const avgPrice = stat.revenue / stat.quantity;
                                        const revenuePercent = (stat.revenue / totalRevenue) * 100;
                                        
                                        return (
                                            <tr key={stat.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3 font-medium">{stat.name}</td>
                                                <td className="p-3 text-right">{stat.quantity}</td>
                                                <td className="p-3 text-right font-semibold text-green-600">
                                                    {stat.revenue.toFixed(2)}€
                                                </td>
                                                <td className="p-3 text-right">{avgPrice.toFixed(2)}€</td>
                                                <td className="p-3 text-right">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                        {revenuePercent.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    {revenuePercent > 10 ? (
                                                        <TrendingUp className="w-5 h-5 text-green-500 inline" />
                                                    ) : (
                                                        <TrendingDown className="w-5 h-5 text-gray-400 inline" />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
