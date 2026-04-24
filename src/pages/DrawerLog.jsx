
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, BookKey, AlertTriangle } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseSupabaseDate, toParisDate } from '@/lib/dateParsing';

export default function DrawerLog() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { filterByTenant, currentTenant } = useTenant();

  // selectedDateISO is no longer needed for the queryKey as we now fetch all data
  // const selectedDateISO = selectedDate?.toISOString().split('T')[0];

  const { data: allDrawerOpenings = [], isLoading, error } = useQuery({
    queryKey: ['drawerOpenings', currentTenant?.id],
    queryFn: () => appClient.entities.DrawerOpening.filter(filterByTenant()),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    enabled: !!currentTenant?.id,
    // Removed: enabled: !!selectedDate, as the query is no longer conditionally enabled by selectedDate
    // Removed: initialData: [] as 'data: allDrawerOpenings = []' handles the initial empty state
  });

  // Filter the fetched data by selectedDate using useMemo for performance
  const groupedOpenings = useMemo(() => {
    if (!selectedDate || !allDrawerOpenings) {
      return [];
    }

    const fromDate = startOfDay(selectedDate);
    const toDate = endOfDay(selectedDate);

    return allDrawerOpenings.filter(op => {
      if (!op.created_date) return false;
      const opDate = toParisDate(op.created_date);
      if (!opDate) return false;
      return opDate >= fromDate && opDate <= toDate;
    });
  }, [allDrawerOpenings, selectedDate]);
  
  const handleDateChange = (date) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BookKey className="w-8 h-8 text-amber-600" />
            Journal des Ouvertures du Tiroir
          </h1>
          <p className="text-gray-600 mt-2">
            Historique des ouvertures manuelles du tiroir-caisse.
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              {selectedDate
                ? format(selectedDate, "dd MMMM yyyy", { locale: fr })
                : "Sélectionner une date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateChange}
              initialFocus
              locale={fr}
              max={365}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique du {format(selectedDate, "dd MMMM yyyy", { locale: fr })}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Chargement...</p>}
          {error && <p className="text-red-500">Erreur de chargement des données.</p>}
          {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date et Heure</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Ouvert par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedOpenings.length > 0 ? (
                  groupedOpenings.map(op => (
                    <TableRow key={op.id}>
                      <TableCell>
                        {(() => {
                          const utcDate = parseSupabaseDate(op.created_date);
                          if (!utcDate || isNaN(utcDate.getTime())) return "Date invalide";
                          return utcDate.toLocaleString('fr-FR', {
                            timeZone: 'Europe/Paris',
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          }).replace(',', '');
                        })()}
                      </TableCell>
                      <TableCell>{op.reason}</TableCell>
                      <TableCell>{op.created_by || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">
                      Aucune ouverture manuelle enregistrée pour cette période.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <div className="flex items-start p-3 text-sm text-amber-800 bg-amber-100 rounded-lg border border-amber-200">
          <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <p>
            Ce journal ne trace que les ouvertures manuelles via le bouton "Ouvrir le tiroir". Les ouvertures automatiques lors d'un paiement en espèces ne sont pas listées ici.
          </p>
      </div>
    </div>
  );
}

