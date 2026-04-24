
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Search, CalendarIcon, Users, UserCheck, UserX, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ClientCard from './ClientCard';
import { startOfMonth, endOfMonth, subMonths, format, startOfYear, endOfYear, startOfDay, endOfDay, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

// Fonction utilitaire pour parser une date de façon sécurisée
const safeParseDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isValid(date) ? date : null;
};

// Fonction de conversion en heure de Paris (IDENTIQUE à OrdersList et HistoriqueJournalier)
const toParisDate = (date) => {
  // Use toLocaleString with options to get a date string in Paris time, then parse it back
  // This avoids issues with daylight saving time if just adding/subtracting hours
  return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
};

// Fonction pour convertir une date UTC en date Paris
const convertOrderDateToParis = (orderCreatedDate) => {
  if (!orderCreatedDate) return null;
  // Ensure the date string is in a format Date constructor can reliably parse as UTC
  // If it's already ISO format with 'Z', good. If not, append 'Z' to treat as UTC.
  const dateStr = (orderCreatedDate || '').replace(' ', 'T');
  let orderDate = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  
  if (isNaN(orderDate.getTime())) {
    // Fallback for potentially non-standard date strings if 'Z' append didn't work
    orderDate = new Date(orderCreatedDate);
    if (isNaN(orderDate.getTime())) return null;
  }
  
  return toParisDate(orderDate);
};

const generateRecentYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 10; i++) {
        years.push(currentYear - i);
    }
    return years;
}

const MonthYearSelector = ({ selectedMonth, selectedYear, onMonthChange, onYearChange }) => {
    const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const years = generateRecentYears();

    return (
        <div className="flex gap-2">
            <Select value={selectedMonth.toString()} onValueChange={(value) => onMonthChange(parseInt(value))}>
                <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Mois" />
                </SelectTrigger>
                <SelectContent>
                    {months.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>
                            {month}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(value) => onYearChange(parseInt(value))}>
                <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                    {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                            {year}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};

const SegmentCard = ({ title, count, clients, color, icon: Icon, onViewClients }) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewClients(clients)}>
        <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <Badge variant="outline" className="text-lg font-bold">{count}</Badge>
            </div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-500">Cliquez pour voir les clients</p>
        </CardContent>
    </Card>
);

export default function ClientSegmentation({ allClients, allOrders, onEditClient, onViewHistory }) {
    const [analysisType, setAnalysisType] = useState('reactivation_monthly');
    const [yearA, setYearA] = useState(new Date().getFullYear() - 1);
    const [yearB, setYearB] = useState(new Date().getFullYear());
    const [inactiveClients, setInactiveClients] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [analysisRun, setAnalysisRun] = useState(false);

    // Nouveaux états pour la segmentation par fréquence
    const [frequencyPeriodType, setFrequencyPeriodType] = useState('month');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [intervalStart, setIntervalStart] = useState(startOfMonth(new Date()));
    const [intervalEnd, setIntervalEnd] = useState(endOfMonth(new Date()));
    const [frequencySegments, setFrequencySegments] = useState({
        inactive: [],
        occasional: [],
        regular: [],
        loyal: []
    });
    const [viewingSegment, setViewingSegment] = useState(null);

    // Nouveaux états pour le sélecteur de mois/année de réactivation mensuelle
    const initialDateA = subMonths(new Date(), 2);
    const [selectedMonthA, setSelectedMonthA] = useState(initialDateA.getMonth());
    const [selectedYearA, setSelectedYearA] = useState(initialDateA.getFullYear());

    const initialDateB = subMonths(new Date(), 1);
    const [selectedMonthB, setSelectedMonthB] = useState(initialDateB.getMonth());
    const [selectedYearB, setSelectedYearB] = useState(initialDateB.getFullYear());
    
    // Nouveaux états pour le sélecteur de mois/année de fréquence (renommés pour clarté)
    const [selectedMonthFreq, setSelectedMonthFreq] = useState(new Date().getMonth());
    const [selectedYearFreq, setSelectedYearFreq] = useState(new Date().getFullYear());

    const yearOptions = generateRecentYears();

    const handleReactivationAnalysis = () => {
        console.log('');
        console.log('🔍 ANALYSE DE RÉACTIVATION - DÉMARRAGE');
        console.log('='.repeat(80));
        
        setIsLoading(true);
        setAnalysisRun(true);

        try {
            let startA, endA, startB, endB;

            if (analysisType === 'reactivation_monthly') {
                startA = startOfMonth(new Date(selectedYearA, selectedMonthA, 1));
                endA = endOfMonth(new Date(selectedYearA, selectedMonthA, 1));
                startB = startOfMonth(new Date(selectedYearB, selectedMonthB, 1));
                endB = endOfMonth(new Date(selectedYearB, selectedMonthB, 1));
                
                console.log(`📅 Période A: ${format(startA, 'dd/MM/yyyy', {locale: fr})} - ${format(endA, 'dd/MM/yyyy', {locale: fr})}`);
                console.log(`📅 Période B: ${format(startB, 'dd/MM/yyyy', {locale: fr})} - ${format(endB, 'dd/MM/yyyy', {locale: fr})}`);
            } else { // yearly
                startA = startOfYear(new Date(yearA, 0, 1));
                endA = endOfYear(new Date(yearA, 0, 1));
                startB = startOfYear(new Date(yearB, 0, 1));
                endB = endOfYear(new Date(yearB, 0, 1));
                
                console.log(`📅 Année A: ${yearA}`);
                console.log(`📅 Année B: ${yearB}`);
            }
            
            console.log(`\n📦 COMMANDES DISPONIBLES:`);
            console.log(`   Total commandes: ${allOrders.length}`);
            
            // Afficher quelques exemples de commandes pour debug
            if (allOrders.length > 0) {
                console.log(`\n   Exemples de commandes (5 premières):`);
                allOrders.slice(0, 5).forEach((order, idx) => {
                    const orderDate = convertOrderDateToParis(order.created_date);
                    console.log(`   ${idx + 1}. #${order.numero_caisse} - Date brute: ${order.created_date} - Date Paris: ${orderDate ? format(orderDate, 'dd/MM/yyyy HH:mm', {locale: fr}) : 'INVALIDE'} - Client: ${order.customer_id || 'AUCUN'} - Statut: ${order.statut}`);
                });
            }
            
            // Filtrer les commandes de la période A
            console.log(`\n🔍 ANALYSE PÉRIODE A (${format(startA, 'MMMM yyyy', {locale: fr})}):`);
            const clientsInA = new Set();
            let processedA = 0;
            let validA = 0;
            
            allOrders.forEach(o => {
                processedA++;
                
                if (!o.customer_id) {
                    console.log(`   ❌ Commande #${o.numero_caisse || '?'} - Pas de customer_id`);
                    return;
                }
                
                if (!o.created_date) {
                    console.log(`   ❌ Commande #${o.numero_caisse} - Pas de created_date`);
                    return;
                }
                
                if (o.statut === 'annulee') {
                    console.log(`   ❌ Commande #${o.numero_caisse} - Statut annulée`);
                    return;
                }
                
                const orderDate = convertOrderDateToParis(o.created_date);
                if (!orderDate) {
                    console.log(`   ❌ Commande #${o.numero_caisse} - Date invalide: ${o.created_date}`);
                    return;
                }
                
                const isInPeriod = orderDate >= startA && orderDate <= endA;
                
                if (isInPeriod) {
                    clientsInA.add(o.customer_id);
                    validA++;
                    console.log(`   ✅ Commande #${o.numero_caisse} - ${format(orderDate, 'dd/MM/yyyy', {locale: fr})} - Client: ${o.customer_id.slice(0, 8)}...`);
                }
            });

            console.log(`\n📊 RÉSUMÉ PÉRIODE A:`);
            console.log(`   Commandes traitées: ${processedA}`);
            console.log(`   Commandes valides dans la période: ${validA}`);
            console.log(`   Clients uniques: ${clientsInA.size}`);

            // Filtrer les commandes de la période B
            console.log(`\n🔍 ANALYSE PÉRIODE B (${format(startB, 'MMMM yyyy', {locale: fr})}):`);
            const clientsInB = new Set();
            let processedB = 0;
            let validB = 0;
            
            allOrders.forEach(o => {
                processedB++;
                
                if (!o.customer_id || !o.created_date || o.statut === 'annulee') return;
                
                const orderDate = convertOrderDateToParis(o.created_date);
                if (!orderDate) return;
                
                const isInPeriod = orderDate >= startB && orderDate <= endB;
                
                if (isInPeriod) {
                    clientsInB.add(o.customer_id);
                    validB++;
                    console.log(`   ✅ Commande #${o.numero_caisse} - ${format(orderDate, 'dd/MM/yyyy', {locale: fr})} - Client: ${o.customer_id.slice(0, 8)}...`);
                }
            });

            console.log(`\n📊 RÉSUMÉ PÉRIODE B:`);
            console.log(`   Commandes traitées: ${processedB}`);
            console.log(`   Commandes valides dans la période: ${validB}`);
            console.log(`   Clients uniques: ${clientsInB.size}`);

            // Clients à réactiver
            const inactiveClientIds = [...clientsInA].filter(id => !clientsInB.has(id));
            
            console.log(`\n🎯 RÉSULTAT FINAL:`);
            console.log(`   Clients dans A mais pas dans B: ${inactiveClientIds.length}`);
            
            if (inactiveClientIds.length > 0) {
                console.log(`   IDs des clients à relancer:`);
                inactiveClientIds.forEach((id, idx) => {
                    console.log(`      ${idx + 1}. ${id}`);
                });
            }
            
            const results = allClients.filter(client => inactiveClientIds.includes(client.id));
            
            console.log(`   Clients trouvés dans la base: ${results.length}`);
            
            setInactiveClients(results);
            console.log('='.repeat(80));
            console.log('');
        } catch (error) {
            console.error("❌ ERREUR lors de l'analyse de réactivation:", error);
            console.error(error.stack);
            setInactiveClients([]);
        }
        
        setIsLoading(false);
    };

    const handleFrequencyAnalysis = () => {
        console.log('');
        console.log('📊 ANALYSE PAR FRÉQUENCE');
        console.log('='.repeat(60));
        
        setIsLoading(true);
        setAnalysisRun(true);

        try {
            let startDate, endDate;

            if (frequencyPeriodType === 'month') {
                startDate = startOfMonth(new Date(selectedYearFreq, selectedMonthFreq, 1));
                endDate = endOfMonth(new Date(selectedYearFreq, selectedMonthFreq, 1));
                console.log(`📅 Mois: ${format(startDate, 'MMMM yyyy', { locale: fr })}`);
            } else if (frequencyPeriodType === 'year') {
                startDate = startOfYear(new Date(selectedYear, 0, 1));
                endDate = endOfYear(new Date(selectedYear, 0, 1));
                console.log(`📅 Année: ${selectedYear}`);
            } else { // interval
                if (!isValid(intervalStart) || !isValid(intervalEnd)) {
                    throw new Error("Dates d'intervalle invalides");
                }
                startDate = startOfDay(intervalStart);
                endDate = endOfDay(intervalEnd);
                console.log(`📅 Période: ${format(startDate, 'dd/MM/yyyy', { locale: fr })} - ${format(endDate, 'dd/MM/yyyy', { locale: fr })}`);
            }

            console.log(`📦 Total commandes à analyser: ${allOrders.length}`);

            // Calculer le nombre de commandes par client (avec conversion Paris)
            const clientOrderCounts = {};
            let validOrdersCount = 0;
            
            allOrders.forEach(order => {
                if (!order.customer_id || !order.created_date || order.statut === 'annulee') return;
                
                const orderDate = convertOrderDateToParis(order.created_date);
                if (!orderDate) return;
                
                if (orderDate >= startDate && orderDate <= endDate) {
                    clientOrderCounts[order.customer_id] = (clientOrderCounts[order.customer_id] || 0) + 1;
                    validOrdersCount++;
                }
            });

            console.log(`✅ Commandes valides dans la période: ${validOrdersCount}`);
            console.log(`👥 Clients uniques ayant commandé: ${Object.keys(clientOrderCounts).length}`);

            // Segmenter les clients
            const segments = {
                inactive: [], // 0 commandes
                occasional: [], // 1-2 commandes
                regular: [], // 3-5 commandes
                loyal: [] // 6+ commandes
            };

            let countInactive = 0;
            let countOccasional = 0;
            let countRegular = 0;
            let countLoyal = 0;

            allClients.forEach(client => {
                const orderCount = clientOrderCounts[client.id] || 0;
                const clientWithCount = { ...client, orderCount };

                if (orderCount === 0) {
                    segments.inactive.push(clientWithCount);
                    countInactive++;
                } else if (orderCount <= 2) {
                    segments.occasional.push(clientWithCount);
                    countOccasional++;
                } else if (orderCount <= 5) {
                    segments.regular.push(clientWithCount);
                    countRegular++;
                } else {
                    segments.loyal.push(clientWithCount);
                    countLoyal++;
                }
            });

            console.log(`📊 SEGMENTATION:`);
            console.log(`   Inactifs (0 cmd): ${countInactive}`);
            console.log(`   Occasionnels (1-2 cmd): ${countOccasional}`);
            console.log(`   Réguliers (3-5 cmd): ${countRegular}`);
            console.log(`   Fidèles (6+ cmd): ${countLoyal}`);
            console.log('='.repeat(60));
            console.log('');

            setFrequencySegments(segments);
        } catch (error) {
            console.error("❌ Erreur lors de l'analyse de fréquence:", error);
            setFrequencySegments({
                inactive: [],
                occasional: [],
                regular: [],
                loyal: []
            });
        }
        
        setIsLoading(false);
    };

    const getPeriodLabel = () => {
        try {
            if (frequencyPeriodType === 'month') {
                const months = [
                    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
                ];
                return `${months[selectedMonthFreq]} ${selectedYearFreq}`;
            } else if (frequencyPeriodType === 'year') {
                return selectedYear.toString();
            } else {
                if (isValid(intervalStart) && isValid(intervalEnd)) {
                    return `Du ${format(intervalStart, 'dd/MM/yyyy', { locale: fr })} au ${format(intervalEnd, 'dd/MM/yyyy', { locale: fr })}`;
                }
                return 'Période invalide';
            }
        } catch (error) {
            console.error("Erreur lors du formatage de la période:", error);
            return 'Période invalide';
        }
    };

    return (
        <Card className="bg-gray-50 border-gray-200">
            <CardHeader>
                <CardTitle className="text-lg">Analyse Comportementale & Fidélisation</CardTitle>
                <p className="text-sm text-gray-600">
                    Analysez le comportement de vos clients pour optimiser votre stratégie de fidélisation.
                </p>
            </CardHeader>
            <CardContent>
                <Tabs value={analysisType} onValueChange={(value) => {
                    setAnalysisType(value);
                    setAnalysisRun(false);
                    setViewingSegment(null);
                }}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="reactivation_monthly">Réactivation Mensuelle</TabsTrigger>
                        <TabsTrigger value="reactivation_yearly">Réactivation Annuelle</TabsTrigger>
                        <TabsTrigger value="frequency">Segmentation par Fréquence</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="reactivation_monthly" className="pt-4">
                        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow">
                            <span className="font-medium">Clients ayant commandé en:</span>
                            <MonthYearSelector
                                selectedMonth={selectedMonthA}
                                selectedYear={selectedYearA}
                                onMonthChange={setSelectedMonthA}
                                onYearChange={setSelectedYearA}
                            />
                            <span className="font-medium">mais pas en:</span>
                             <MonthYearSelector
                                selectedMonth={selectedMonthB}
                                selectedYear={selectedYearB}
                                onMonthChange={setSelectedMonthB}
                                onYearChange={setSelectedYearB}
                            />
                        </div>
                        <div className="flex justify-center">
                            <Button onClick={handleReactivationAnalysis} disabled={isLoading} className="gap-2 text-lg py-6 px-8">
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5"/>}
                                Lancer l'analyse
                            </Button>
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="reactivation_yearly" className="pt-4">
                        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow">
                            <span className="font-medium">Clients ayant commandé en:</span>
                            <Select value={yearA.toString()} onValueChange={(v) => setYearA(parseInt(v))}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>{yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                            <span className="font-medium">mais pas en:</span>
                            <Select value={yearB.toString()} onValueChange={(v) => setYearB(parseInt(v))}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>{yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-center">
                            <Button onClick={handleReactivationAnalysis} disabled={isLoading} className="gap-2 text-lg py-6 px-8">
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5"/>}
                                Lancer l'analyse
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="frequency" className="pt-4">
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg shadow">
                                <span className="font-medium">Analyser la fréquence pour :</span>
                                <Select value={frequencyPeriodType} onValueChange={setFrequencyPeriodType}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="month">Un mois</SelectItem>
                                        <SelectItem value="year">Une année</SelectItem>
                                        <SelectItem value="interval">Période personnalisée</SelectItem>
                                    </SelectContent>
                                </Select>
                                
                                {frequencyPeriodType === 'month' && (
                                    <MonthYearSelector
                                        selectedMonth={selectedMonthFreq}
                                        selectedYear={selectedYearFreq}
                                        onMonthChange={setSelectedMonthFreq}
                                        onYearChange={setSelectedYearFreq}
                                    />
                                )}
                                
                                {frequencyPeriodType === 'year' && (
                                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                                
                                {frequencyPeriodType === 'interval' && (
                                    <>
                                        <span className="text-sm">Du :</span>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    <CalendarIcon className="w-4 h-4" />
                                                    {isValid(intervalStart) ? format(intervalStart, 'dd/MM/yyyy', { locale: fr }) : 'Date de début'}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={intervalStart} onSelect={(date) => date && setIntervalStart(date)} locale={fr} />
                                            </PopoverContent>
                                        </Popover>
                                        <span className="text-sm">Au :</span>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    <CalendarIcon className="w-4 h-4" />
                                                    {isValid(intervalEnd) ? format(intervalEnd, 'dd/MM/yyyy', { locale: fr }) : 'Date de fin'}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={intervalEnd} onSelect={(date) => date && setIntervalEnd(date)} locale={fr} />
                                            </PopoverContent>
                                        </Popover>
                                    </>
                                )}
                            </div>
                            
                            <div className="flex justify-center">
                                <Button onClick={handleFrequencyAnalysis} disabled={isLoading} className="gap-2 text-lg py-6 px-8">
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5"/>}
                                    Analyser la fréquence
                                </Button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
                
                {analysisRun && analysisType.startsWith('reactivation') && (
                    <div className="mt-8">
                        <h3 className="text-md font-semibold mb-4 text-center">
                            Résultats de l'analyse : <span className="text-blue-600 font-bold">{inactiveClients.length} client(s) à relancer</span>
                        </h3>
                        {isLoading ? (
                            <p className="text-center">Analyse en cours...</p>
                        ) : inactiveClients.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {inactiveClients.map(client => (
                                    <ClientCard 
                                        key={client.id}
                                        client={client}
                                        onEdit={() => onEditClient(client)}
                                        onDelete={() => {}}
                                        onViewHistory={onViewHistory || (() => {})}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-8">Aucun client ne correspond à ces critères.</p>
                        )}
                    </div>
                )}

                {analysisRun && analysisType === 'frequency' && (
                    <div className="mt-8">
                        <h3 className="text-md font-semibold mb-4 text-center">
                            Segmentation par fréquence - Période: {getPeriodLabel()}
                        </h3>
                        
                        {viewingSegment ? (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-semibold">
                                        {viewingSegment.title} ({viewingSegment.clients.length} clients)
                                    </h4>
                                    <Button variant="outline" onClick={() => setViewingSegment(null)}>
                                        ← Retour à la vue d'ensemble
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {viewingSegment.clients.map(client => (
                                        <div key={client.id} className="relative">
                                            <ClientCard 
                                                client={client}
                                                onEdit={() => onEditClient(client)}
                                                onDelete={() => {}}
                                                onViewHistory={onViewHistory || (() => {})}
                                            />
                                            <Badge className="absolute top-2 right-2 bg-blue-500">
                                                {client.orderCount} commande{client.orderCount > 1 ? 's' : ''}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <SegmentCard
                                    title="Clients Inactifs"
                                    count={frequencySegments.inactive.length}
                                    clients={frequencySegments.inactive}
                                    color="bg-gray-500"
                                    icon={UserX}
                                    onViewClients={(clients) => setViewingSegment({ title: "Clients Inactifs", clients })}
                                />
                                <SegmentCard
                                    title="Clients Occasionnels"
                                    count={frequencySegments.occasional.length}
                                    clients={frequencySegments.occasional}
                                    color="bg-yellow-500"
                                    icon={Users}
                                    onViewClients={(clients) => setViewingSegment({ title: "Clients Occasionnels (1-2 commandes)", clients })}
                                />
                                <SegmentCard
                                    title="Clients Réguliers"
                                    count={frequencySegments.regular.length}
                                    clients={frequencySegments.regular}
                                    color="bg-blue-500"
                                    icon={UserCheck}
                                    onViewClients={(clients) => setViewingSegment({ title: "Clients Réguliers (3-5 commandes)", clients })}
                                />
                                <SegmentCard
                                    title="Clients Fidèles"
                                    count={frequencySegments.loyal.length}
                                    clients={frequencySegments.loyal}
                                    color="bg-purple-500"
                                    icon={Crown}
                                    onViewClients={(clients) => setViewingSegment({ title: "Clients Fidèles (6+ commandes)", clients })}
                                />
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

