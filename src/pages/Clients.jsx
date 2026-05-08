import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from "@/api/appClient";
import { useTenant } from "@/components/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Users, Search, Upload, Download, HeartPulse, TrendingUp, UserCheck, Loader2 } from "lucide-react";
import ClientForm from "../components/clients/ClientForm";
import ClientImportModal from "../components/clients/ClientImportModal";
import ClientSegmentation from "../components/clients/ClientSegmentation";
import ClientCard from "../components/clients/ClientCard";
import CustomerHistory from "../components/clients/CustomerHistory";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { subDays } from 'date-fns';

const CLIENT_LIST_FIELDS = [
  'id', 'tenant_id', 'nom', 'prenom', 'telephone', 'email', 'adresse', 'code_postal', 'ville',
  'etage', 'interphone', 'notes', 'adresses', 'cagnotte_balance', 'created_date', 'updated_date'
];

const CLIENT_ORDER_ANALYSIS_FIELDS = [
  'id', 'tenant_id', 'customer_id', 'created_date', 'statut', 'payee', 'total_ttc'
];

const StatCard = ({ title, value, icon: Icon, description, color }) => (
  <Card className="shadow-md border-0">
    <CardContent className="p-4 flex items-center">
      <div className={`p-3 rounded-lg mr-4 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </CardContent>
  </Card>
);

export default function Clients() {
  const { filterByTenant, withTenant, currentTenant } = useTenant();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState('list');
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'nom', direction: 'asc' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState(null);

  const queryClient = useQueryClient();

  const [loadLimit, setLoadLimit] = useState(5000);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  
  const { data: customersRaw, isLoading: isLoadingCustomers, error: customersError, refetch: refetchCustomers } = useQuery({
    queryKey: ['customers', currentTenant?.id, loadLimit],
    queryFn: async () => {
      const customers = await appClient.entities.Customer.filter(filterByTenant(), '-updated_date', loadLimit, { fields: CLIENT_LIST_FIELDS });
      return customers;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!currentTenant,
  });

  const { data: ordersRaw, isLoading: isLoadingOrders, error: ordersError } = useQuery({
    queryKey: ['allOrdersForClientAnalysis', currentTenant?.id],
    queryFn: async () => {
      console.log('🔄 Chargement de toutes les commandes pour l\'analyse...');
      const orders = await appClient.entities.Order.filter({
        ...filterByTenant(),
        created_date: { $gte: subDays(new Date(), 120).toISOString() },
      }, '-created_date', 1200, { fields: CLIENT_ORDER_ANALYSIS_FIELDS });
      console.log(`✅ ${orders.length} commandes chargées`);
      return orders;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!currentTenant,
  });

  const isLoading = isLoadingCustomers || isLoadingOrders;
  const error = customersError || ordersError;

  const customerLastOrderMap = useMemo(() => {
    if (!ordersRaw) return new Map();
    const map = new Map();
    (ordersRaw || []).forEach(order => {
      if (order.customer_id) {
        const orderDate = new Date(order.created_date);
        if (!map.has(order.customer_id) || orderDate > map.get(order.customer_id)) {
          map.set(order.customer_id, orderDate);
        }
      }
    });
    return map;
  }, [ordersRaw]);

  const allClients = useMemo(() => {
    if (!customersRaw) return [];
    const clientsWithLastOrder = (customersRaw || []).map(client => ({
      ...client,
      lastOrderDate: customerLastOrderMap.get(client.id) || null,
    }));
    return clientsWithLastOrder.sort((a, b) => {
      const dateA = a.lastOrderDate ? a.lastOrderDate.getTime() : 0;
      const dateB = b.lastOrderDate ? b.lastOrderDate.getTime() : 0;
      return dateB - dateA;
    });
  }, [customersRaw, customerLastOrderMap]);

  const ordersByCustomer = useMemo(() => {
    if (!ordersRaw) return {};
    const groupedOrders = {};
    ordersRaw.forEach(order => {
      if (order.customer_id) {
        if (!groupedOrders[order.customer_id]) {
          groupedOrders[order.customer_id] = [];
        }
        groupedOrders[order.customer_id].push(order);
      }
    });
    return groupedOrders;
  }, [ordersRaw]);

  const stats = useMemo(() => {
    if (!allClients.length && !ordersRaw?.length) {
        return { total: 0, active: 0, newLast30: 0 };
    }
    const ninetyDaysAgo = subDays(new Date(), 90);
    const activeClientIds = new Set(
      (ordersRaw || [])
        .filter(o => o.customer_id && new Date(o.created_date) >= ninetyDaysAgo)
        .map(o => o.customer_id)
    );

    const thirtyDaysAgo = subDays(new Date(), 30);
    const newClientsCount = allClients.filter(c => new Date(c.created_date) >= thirtyDaysAgo).length;

    return {
      total: allClients.length,
      active: activeClientIds.size,
      newLast30: newClientsCount
    };
  }, [allClients, ordersRaw]);

  const filteredClients = useMemo(() => {
    if (!allClients) return [];
    const term = searchTerm.toLowerCase();
    if (!term) return allClients;
    return allClients.filter(client =>
      (client.nom?.toLowerCase() || '').includes(term) ||
      (client.prenom?.toLowerCase() || '').includes(term) ||
      (client.telephone || '').includes(term) ||
      (client.email?.toLowerCase() || '').includes(term)
    );
  }, [searchTerm, allClients]);

  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  const paginatedClients = filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const refreshData = () => {
    refetchCustomers();
  };

  const handleFormSubmit = async (clientData) => {
    try {
      if (editingClient) {
        await appClient.entities.Customer.update(editingClient.id, clientData);
        toast({
          title: "Succès",
          description: "Client mis à jour avec succès.",
        });
      } else {
        await appClient.entities.Customer.create(withTenant(clientData));
        toast({
          title: "Succès",
          description: "Client ajouté avec succès.",
        });
      }
      refreshData();
      setIsFormOpen(false);
      setEditingClient(null);
    } catch (err) {
      toast({
        title: "Erreur",
        description: `Échec de l'opération : ${err.message}`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
      try {
        await appClient.entities.Customer.delete(id);
        refreshData();
        queryClient.invalidateQueries({ queryKey: ['posData'] });
        toast({
          title: "Succès",
          description: "Client supprimé avec succès.",
        });
      } catch (err) {
        toast({
          title: "Erreur",
          description: `Échec de la suppression : ${err.message}`,
          variant: "destructive",
        });
      }
    }
  };

  const openEditForm = (client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleViewHistory = (client) => {
    if (!client || !client.id) return;
    setViewingCustomerId(client.id);
    setIsHistoryPanelOpen(true);
  };

  const openNewForm = () => {
    setEditingClient(null);
    setIsFormOpen(true);
  };

  const handleExport = () => {
    const headers = ['nom', 'prenom', 'telephone', 'email', 'adresse', 'code_postal', 'ville', 'etage', 'interphone', 'notes', 'cagnotte_balance'];
    const csvContent = [
      headers.join(';'),
      ...allClients.map(client =>
        headers.map(header => {
          let value = client[header] || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(';')
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'export_clients.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-3xl font-bold flex items-center gap-3">
                <Users /> Gestion des Clients
              </CardTitle>
              <p className="text-gray-500 mt-1">Analysez votre base de données clients et pilotez votre fidélisation.</p>
            </div>
            <div className="flex gap-2">
                <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" /> Importer
                </Button>
                <Button onClick={handleExport} variant="outline" className="gap-2">
                   <Download className="w-4 h-4" /> Exporter
                </Button>
                <Button onClick={openNewForm} className="gap-2">
                    <PlusCircle className="h-4 w-4" /> Ajouter un client
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Clients Totaux" value={isLoading ? '...' : stats.total} description="Nombre total de fiches clients" icon={Users} color="bg-blue-500" />
          <StatCard title="Clients Actifs" value={isLoading ? '...' : stats.active} description="Ayant commandé (90 jours)" icon={UserCheck} color="bg-green-500" />
          <StatCard title="Nouveaux Clients" value={isLoading ? '...' : stats.newLast30} description="Créés ce mois-ci" icon={TrendingUp} color="bg-orange-500" />
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6">
            <Tabs defaultValue="list" onValueChange={setActiveView}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list" className="gap-2"><Users className="w-4 h-4"/>Liste des clients</TabsTrigger>
                <TabsTrigger value="segmentation" className="gap-2"><HeartPulse className="w-4 h-4"/>Analyse & Fidélisation</TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="mt-6">
                <div className="mt-4 relative mb-6">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                   <Input
                      placeholder="Rechercher par nom, prénom, téléphone, email..."
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                      className="pl-10"
                      />
                      </div>
                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                      <p className="ml-4 text-gray-600">Chargement des clients...</p>
                    </div>
                  ) : error ? (
                    <div className="text-center py-20 text-red-600">
                      <p>Erreur de chargement des données.</p>
                      <p className="text-sm">{error.message}</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-gray-500 mb-3">
                        {filteredClients.length} client(s) — page {currentPage} / {totalPages || 1}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedClients.map((client) => (
                          <ClientCard
                            key={client.id}
                            client={client}
                            onEdit={() => openEditForm(client)}
                            onDelete={() => handleDelete(client.id)}
                            onViewHistory={() => handleViewHistory(client)}
                          />
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-6">
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</Button>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</Button>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                            const page = start + i;
                            return page <= totalPages ? (
                              <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(page)}>{page}</Button>
                            ) : null;
                          })}
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</Button>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</Button>
                        </div>
                      )}
                      {!searchTerm && customersRaw?.length >= loadLimit && (
                        <div className="flex justify-center mt-6">
                          <Button 
                            onClick={() => setLoadLimit(prev => prev + 100)}
                            variant="outline"
                            className="gap-2"
                          >
                            Charger 100 clients de plus ({customersRaw.length} affichés)
                          </Button>
                        </div>
                      )}
                    </>
                  )}
              </TabsContent>
              <TabsContent value="segmentation" className="mt-6">
                {isLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    <p className="ml-4 text-gray-600">Chargement des données...</p>
                  </div>
                ) : (
                  <ClientSegmentation
                    allClients={allClients}
                    allOrders={ordersRaw || []}
                    onEditClient={openEditForm}
                    onViewHistory={handleViewHistory}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Modifier le client' : 'Nouveau Client'}</DialogTitle>
          </DialogHeader>
          <ClientForm
            initialData={editingClient}
            onSubmit={handleFormSubmit}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
       <ClientImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={refreshData}
      />

      <Sheet open={isHistoryPanelOpen} onOpenChange={setIsHistoryPanelOpen}>
        <SheetContent className="p-0 sm:max-w-xl md:max-w-2xl">
          {viewingCustomerId && (
            <CustomerHistory
              customerId={viewingCustomerId}
              tenantId={currentTenant?.id}
              onClose={() => setIsHistoryPanelOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}
