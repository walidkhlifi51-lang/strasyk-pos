
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useTenant } from '@/components/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Edit, Plus, Trash2, EllipsisVertical, DollarSign, CheckCircle2, Circle, XCircle, Coffee, Settings, Loader2, Zap, CheckCircle, RefreshCw } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getOrderOutstandingAmount, hasOutstandingBalance } from '@/components/caisse/orderPaymentUtils';

const TABLE_PLAN_TABLE_FIELDS = [
    'id', 'tenant_id', 'nom', 'capacite', 'forme', 'statut', 'order_id', 'position_x', 'position_y',
    'zone', 'created_date', 'updated_date'
];

const TABLE_PLAN_ORDER_FIELDS = [
    'id', 'tenant_id', 'type_commande', 'statut', 'table_id', 'payee', 'total_ttc', 'created_date', 'updated_date'
];

const shapeStyles = {
    carree: {
        borderRadius: '16px',
        width: 180,
        height: 180
    },
    ronde: {
        borderRadius: '50%',
        width: 180,
        height: 180
    },
    rectangulaire: {
        borderRadius: '16px',
        width: 240,
        height: 160
    },
};

// CONFIGURATION DES STATUTS
const statusConfig = {
    disponible: { label: 'Disponible', className: 'border-green-500 bg-green-50 text-green-800', icon: <Circle className="w-4 h-4 text-green-500" />, buttonClass: 'bg-green-500 hover:bg-green-600 text-white' },
    occupee: { label: 'Occupée', className: 'border-red-500 bg-red-100 text-red-800', icon: <CheckCircle2 className="w-4 h-4 text-red-500" />, buttonClass: 'bg-red-500 hover:bg-red-600 text-white' },
    reservee: { label: 'Réservée', className: 'border-yellow-500 bg-yellow-100 text-yellow-800', icon: <Coffee className="w-4 h-4 text-yellow-500" />, buttonClass: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
    a_nettoyer: { label: 'À nettoyer', className: 'border-purple-500 bg-purple-100 text-purple-800', icon: <XCircle className="w-4 h-4 text-purple-500" />, buttonClass: 'bg-purple-500 hover:bg-purple-600 text-white' },
};


// --- Composant pour le formulaire d'ajout/modification ---
const TableFormDialog = ({ table, onSave, onCancel, onDelete }) => {
    const [formData, setFormData] = useState(table);

    useEffect(() => {
        setFormData(table);
    }, [table]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    
    return (
        <Dialog open={true} onOpenChange={onCancel}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{formData?.id ? 'Modifier la table' : 'Ajouter une table'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Nom</Label><Input value={formData.nom} onChange={(e) => handleChange('nom', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Capacité</Label><Input type="number" value={formData.capacite} onChange={(e) => handleChange('capacite', parseInt(e.target.value) || 0)} /></div>
                    <div className="space-y-2"><Label>Forme</Label>
                        <Select value={formData.forme} onValueChange={(value) => handleChange('forme', value)}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="carree">Carrée</SelectItem>
                                <SelectItem value="ronde">Ronde</SelectItem>
                                <SelectItem value="rectangulaire">Rectangulaire</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter className="flex justify-between w-full">
                    {formData?.id && <Button variant="destructive" onClick={() => onDelete(formData.id)}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</Button>}
                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" onClick={onCancel}>Annuler</Button>
                        <Button onClick={() => onSave(formData)}>Sauvegarder</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// COMPOSANT DE TABLE - AVEC BOUTONS TACTILES
const TableComponent = React.forwardRef(({ table, onMouseDown, onClick, isEditing, style, onStatusChange, onForceFree }, ref) => {
    const navigate = useNavigate();
    const [showStatusMenu, setShowStatusMenu] = React.useState(false);
    const tableStatus = statusConfig[table.statut] || { label: table.statut, className: 'border-gray-400' };
    const shapeStyle = shapeStyles[table.forme] || shapeStyles.carree;
    const hasRemainingBalance = hasOutstandingBalance(table.order);
    const outstandingAmount = getOrderOutstandingAmount(table.order);

    const handleActionClick = (e) => {
        e.stopPropagation();
    };

    const handleNavigation = (e, url) => {
        e.stopPropagation();
        navigate(url);
    };
    
    const handleStatusClick = (e, newStatus) => {
        e.stopPropagation();
        onStatusChange(table.id, newStatus);
        setShowStatusMenu(false);
    };

    return (
        <div
            ref={ref}
            onMouseDown={onMouseDown}
            onClick={onClick}
            className={`absolute p-4 shadow-xl flex flex-col items-center justify-center gap-2 border-2 transition-all duration-200 ${isEditing ? 'cursor-move' : 'cursor-pointer hover:shadow-2xl hover:scale-105'} ${tableStatus.className}`}
            style={{ 
                left: table.position_x, 
                top: table.position_y,
                width: shapeStyle.width,
                height: shapeStyle.height,
                borderRadius: shapeStyle.borderRadius,
                opacity: style?.opacity
            }}
        >
             {/* Bouton Menu Statut */}
             <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 left-2 h-10 w-10 rounded-full z-10 bg-white/80 hover:bg-white shadow-md"
                onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusMenu(!showStatusMenu);
                }}
            >
                <Settings className="h-5 w-5" />
            </Button>
            
            {/* Menu Statut en GROS BOUTONS */}
            {showStatusMenu && (
                <div 
                    className="absolute top-14 left-2 bg-white rounded-xl shadow-2xl p-3 z-20 border-2 border-gray-200 space-y-2 min-w-[180px]"
                    onClick={handleActionClick}
                >
                    <Button
                        size="lg"
                        className={`w-full justify-start gap-2 ${statusConfig.disponible.buttonClass}`}
                        onClick={(e) => handleStatusClick(e, 'disponible')}
                    >
                        {statusConfig.disponible.icon} Disponible
                    </Button>
                    <Button
                        size="lg"
                        className={`w-full justify-start gap-2 ${statusConfig.occupee.buttonClass}`}
                        onClick={(e) => handleStatusClick(e, 'occupee')}
                    >
                        {statusConfig.occupee.icon} Occupée
                    </Button>
                    <Button
                        size="lg"
                        className={`w-full justify-start gap-2 ${statusConfig.reservee.buttonClass}`}
                        onClick={(e) => handleStatusClick(e, 'reservee')}
                    >
                        {statusConfig.reservee.icon} Réservée
                    </Button>
                    <Button
                        size="lg"
                        className={`w-full justify-start gap-2 ${statusConfig.a_nettoyer.buttonClass}`}
                        onClick={(e) => handleStatusClick(e, 'a_nettoyer')}
                    >
                        {statusConfig.a_nettoyer.icon} À nettoyer
                    </Button>
                    
                    {table.statut !== 'disponible' && (
                        <>
                            <div className="border-t my-2"></div>
                            <Button
                                size="lg"
                                variant="destructive"
                                className="w-full justify-start gap-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onForceFree(table);
                                    setShowStatusMenu(false);
                                }}
                            >
                                <Zap className="h-4 w-4" /> Forcer libération
                            </Button>
                        </>
                    )}
                </div>
            )}
             
             {/* Menu rapide d'encaissement */}
             {!isEditing && table.order_id && table.order && (!table.order.payee || hasRemainingBalance) && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-10 w-10 rounded-full z-10 bg-white/80 hover:bg-white shadow-md"
                            onClick={handleActionClick}
                        >
                            <EllipsisVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent onClick={handleActionClick} className="w-48">
                        <DropdownMenuItem onClick={(e) => handleNavigation(e, createPageUrl(`StrasykPos?order_to_settle=${table.order_id}`))}>
                            <DollarSign className="mr-2 h-4 w-4 text-green-600" />
                            <div className="flex flex-col">
                                <span className="font-medium">{hasRemainingBalance ? 'Régler le complément' : 'Régler la note'}</span>
                                <span className="text-xs text-gray-500">{hasRemainingBalance ? `${outstandingAmount.toFixed(2)}€ restant` : 'Encaisser'}</span>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
             )}

            {/* Contenu simplifié sans icônes */}
            <div className="text-center flex flex-col items-center justify-center h-full gap-3">
                <span className="block font-bold text-3xl">{table.nom}</span>
                
                <Badge variant="secondary" className={`text-sm px-4 py-1 ${tableStatus.className}`}>
                    {tableStatus.label}
                </Badge>
                
                {/* Affichage du montant */}
                {table.order && (
                    <div className="mt-2 flex flex-col items-center gap-2">
                        <span className={`font-bold text-3xl ${table.order.payee ? 'text-green-600' : 'text-gray-900'}`}>
                            {table.order.total_ttc?.toFixed(2) || '0.00'}€
                        </span>
                        <Badge className={table.order.payee && !hasRemainingBalance ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}>
                            {table.order.payee && !hasRemainingBalance ? (
                                <span className="flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4" />
                                    Payée
                                </span>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <DollarSign className="w-4 h-4" />
                                    {hasRemainingBalance ? 'Complément' : 'Non payée'}
                                </span>
                            )}
                        </Badge>
                        {!isEditing && (!table.order.payee || hasRemainingBalance) && (
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white shadow-md"
                                onClick={(e) => handleNavigation(e, createPageUrl(`StrasykPos?order_to_settle=${table.order_id}`))}
                            >
                                <DollarSign className="w-4 h-4 mr-1" />
                                {hasRemainingBalance ? 'Régler complément' : 'Encaisser'}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});


export default function PlanDeTables() {
    const [tables, setTables] = useState([]);
    const [isEditing, setIsEditing] = useState(false); // Kept from original, for the "Mode Déplacement" switch
    const [showTableForm, setShowTableForm] = useState(false); // Renamed from isDialogOpen
    const [editingTable, setEditingTable] = useState(null); // Renamed from selectedTableForForm
    
    const dragInfo = useRef({ isDragging: false, hasMoved: false });
    const containerRef = useRef(null);
    
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { filterByTenant, withTenant } = useTenant();

    const fetchTablesAndOrders = async () => {
        try {
            const tablesData = await appClient.entities.Table.filter(filterByTenant(), null, null, { fields: TABLE_PLAN_TABLE_FIELDS });
            const tableOrderIds = new Set((tablesData || []).map((table) => table.order_id).filter(Boolean));
            const occupiedTableIds = (tablesData || [])
                .filter((table) => table.statut !== 'disponible')
                .map((table) => table.id);
            const ordersData = tableOrderIds.size > 0 || occupiedTableIds.length > 0
                ? await appClient.entities.Order.filter({
                    ...filterByTenant(),
                    type_commande: 'sur_place',
                    statut: { $in: ['en_attente', 'en_attente_paiement', 'en_preparation', 'prete', 'occupee', 'payé'] },
                }, '-updated_date', 250, { fields: TABLE_PLAN_ORDER_FIELDS }).then((orders) => (
                    (orders || []).filter((order) => {
                        if (!order) return false;
                        return tableOrderIds.has(order.id) || (order.table_id && occupiedTableIds.includes(order.table_id));
                    })
                ))
                : [];
            return { tables: tablesData || [], orders: ordersData };
        } catch (error) {
            console.error("Erreur chargement tables:", error);
            // Return empty arrays to prevent app crash and allow continued operation
            return { tables: [], orders: [] };
        }
    };

    // QUERY
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['tablesAndActiveOrders'],
        queryFn: fetchTablesAndOrders,
        staleTime: 110000,
        refetchOnWindowFocus: false, // Évite les requêtes supplémentaires lors du changement d'onglet
        retry: 2, // Ajouté: Réessaie la requête 2 fois en cas d'échec
    });
    
    // Destructure the data obtained from useQuery and create orderMap
    const { tables: fetchedTables = [], orders: activeOrders = [] } = data || {};
    const orderMap = useMemo(() => {
        return (activeOrders || []).reduce((acc, order) => {
            if (order?.id) acc[order.id] = order;
            return acc;
        }, {});
    }, [activeOrders]);

    // Synchronise l'état local avec les données du serveur,
    // mais SEULEMENT si aucune opération de glisser-déposer n'est en cours.
    useEffect(() => {
        if (!dragInfo.current.isDragging) { // Check dragging status inside the effect
            const populated = fetchedTables.map(table => ({
                ...table,
                order: table.order_id ? orderMap[table.order_id] : null,
            }));
            setTables(populated);
        }
    }, [fetchedTables, orderMap]);

    useEffect(() => {
        const invalidatePlan = () => {
            queryClient.invalidateQueries({ queryKey: ['tablesAndActiveOrders'] });
        };

        const unsubscribeTables = appClient.entities.Table.subscribe(() => {
            invalidatePlan();
        });

        const unsubscribeOrders = appClient.entities.Order.subscribe((event) => {
            const order = event?.data;
            if (!order || order.type_commande !== 'sur_place') return;
            invalidatePlan();
        });

        const handleFocus = () => {
            refetch();
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refetch();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            unsubscribeTables();
            unsubscribeOrders();
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [queryClient, refetch]);

    // NOUVEAU : Correctif automatique au chargement
    useEffect(() => {
        const fixTableStatuses = async () => {
            const tablesToFix = fetchedTables.filter(table => {
                // Table à nettoyer mais qui a une commande non payée active
                if (table.statut === 'a_nettoyer' && table.order_id) {
                    const order = orderMap[table.order_id];
                    return order && !order.payee;
                }
                return false;
            });

            if (tablesToFix.length > 0) {
                console.log('Correction de', tablesToFix.length, 'tables...');
                for (const table of tablesToFix) {
                    try {
                        await appClient.entities.Table.update(table.id, withTenant({
                            statut: 'occupee'
                        }));
                    } catch (err) {
                        console.error('Erreur correction table', table.nom, err);
                    }
                }
                // Actualiser après correction
                queryClient.invalidateQueries({ queryKey: ['tablesAndActiveOrders'] });
                toast({
                    title: "Correction automatique",
                    description: `${tablesToFix.length} table(s) ont été remises en statut "Occupée"`,
                });
            }
        };

        if (fetchedTables.length > 0 && Object.keys(orderMap).length > 0) {
            fixTableStatuses();
        }
    }, [fetchedTables, orderMap, queryClient, toast, withTenant]);


    // MUTATION for create, update, delete tables (form actions)
    const tableMutation = useMutation({
        mutationFn: async ({ action, payload }) => {
            switch (action) {
                case 'create': return await appClient.entities.Table.create(withTenant(payload));
                case 'update': return await appClient.entities.Table.update(payload.id, withTenant(payload.data));
                case 'delete': return await appClient.entities.Table.delete(payload.id);
                default: throw new Error(`Action non supportée: ${action}`);
            }
        },
        onSuccess: () => {
            toast({ title: "Action réussie", description: "Le plan de tables a été mis à jour." });
            queryClient.invalidateQueries({ queryKey: ['tablesAndActiveOrders'] });
        },
        onError: (error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
    });
    
    // NOUVELLE MUTATION POUR LE STATUT
    const updateTableStatusMutation = useMutation({
        mutationFn: async ({ tableId, newStatus }) => {
            let payload = { statut: newStatus };
            // Si on la passe en dispo, on en profite pour nettoyer l'ID de commande
            if (newStatus === 'disponible') {
                payload.order_id = null;
            }
            return await appClient.entities.Table.update(tableId, withTenant(payload));
        },
        onSuccess: () => {
            toast({ title: "Statut modifié", description: "Le statut de la table a été mis à jour." });
            queryClient.invalidateQueries({ queryKey: ['tablesAndActiveOrders'] });
        },
        onError: (error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
    });


    // MUTATION for position updates (drag and drop)
    const updateTablePositionMutation = useMutation({
        mutationFn: ({ id, x, y }) => appClient.entities.Table.update(id, withTenant({ position_x: x, position_y: y })),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tablesAndActiveOrders'] }); // Invalidate on success for drag/drop
        },
        onError: (error) => toast({ title: "Erreur", description: error.message, variant: "destructive" }),
    });

    const handleTableMouseDown = (e, table) => {
        dragInfo.current = {
            isDragging: true,
            hasMoved: false,
            tableId: table.id,
            startX: e.clientX,
            startY: e.clientY,
            initialX: table.position_x,
            initialY: table.position_y,
        };
    };

    const handleContainerMouseMove = useCallback((e) => {
        if (!dragInfo.current.isDragging) return;
        
        if (isEditing) {
             e.preventDefault();
            const { startX, startY, initialX, initialY, tableId } = dragInfo.current;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                dragInfo.current.hasMoved = true;
            }
            
            const containerRect = containerRef.current.getBoundingClientRect();
            
            // Trouver la table pour obtenir sa taille
            const currentTable = tables.find(t => t.id === tableId);
            const currentShapeStyle = currentTable ? (shapeStyles[currentTable.forme] || shapeStyles.carree) : shapeStyles.carree;
            
            let newX = initialX + dx;
            let newY = initialY + dy;

            newX = Math.max(0, Math.min(newX, containerRect.width - currentShapeStyle.width)); 
            newY = Math.max(0, Math.min(newY, containerRect.height - currentShapeStyle.height)); 
            
            setTables(prevTables => 
                prevTables.map(t => 
                    t.id === tableId ? { ...t, position_x: newX, position_y: newY } : t
                )
            );
        }
    }, [isEditing, setTables, tables]);

    const handleContainerMouseUp = useCallback(() => {
        if (!dragInfo.current.isDragging) return;
        
        if (isEditing && dragInfo.current.hasMoved) {
            const finalTable = tables.find(t => t.id === dragInfo.current.tableId);
            if (finalTable) {
                updateTablePositionMutation.mutate({ // Use the dedicated mutation for position
                    id: finalTable.id,
                    x: Math.round(finalTable.position_x),
                    y: Math.round(finalTable.position_y),
                });
            }
        }
        dragInfo.current = { isDragging: false, hasMoved: false };
    }, [isEditing, tables, updateTablePositionMutation]);

    const handleTableClick = (table) => {
        if (dragInfo.current.hasMoved) return;

        if (isEditing) {
            setEditingTable(table); // Updated to editingTable
            setShowTableForm(true); // Updated to showTableForm
        } else {
            // Table disponible : créer une nouvelle commande
            if (table.statut === 'disponible') {
                navigate(createPageUrl(`StrasykPos?table_id=${table.id}`));
            }
            // Table occupée : ouvrir la commande pour ajouter des articles
            else if (table.statut === 'occupee' && table.order_id) {
                navigate(createPageUrl(`StrasykPos?order_to_edit=${table.order_id}`));
            }
            // Table réservée : créer une nouvelle commande
            else if (table.statut === 'reservee') {
                navigate(createPageUrl(`StrasykPos?table_id=${table.id}`));
            }
        }
    };

    const handleSaveTable = (formData) => {
        const action = formData.id ? 'update' : 'create';
        // When creating, set default position and status
        const payload = formData.id ? 
            { id: formData.id, data: formData } : 
            { 
                ...formData, 
                position_x: 100, 
                position_y: 100, 
                statut: 'disponible' 
            };
        tableMutation.mutate({ action, payload });
        setShowTableForm(false); // Updated to showTableForm
    };

    const handleDeleteTable = (id) => {
        tableMutation.mutate({ action: 'delete', payload: { id } });
        setShowTableForm(false); // Updated to showTableForm
    };
    
    const handleStatusChange = (tableId, newStatus) => {
        updateTableStatusMutation.mutate({ tableId, newStatus });
    };

    const handleForceFreeTable = (table) => {
        if (window.confirm(`Êtes-vous sûr de vouloir forcer la libération de la table "${table.nom}" ? La commande associée ne sera pas modifiée, mais la table redeviendra disponible.`)) {
            handleStatusChange(table.id, 'disponible');
        }
    };

    return (
        <div 
            className="flex flex-col h-screen bg-gray-100"
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={handleContainerMouseUp}
        >
            <header className="p-4 bg-white border-b flex justify-between items-center">
                <h1 className="text-xl font-bold">Plan de Tables</h1>
                <div className="flex items-center gap-4">
                    <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="hover:bg-blue-50"
                        title="Actualiser le plan"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                    <div className="flex items-center space-x-2">
                        <Switch id="edit-mode" checked={isEditing} onCheckedChange={setIsEditing} />
                        <Label htmlFor="edit-mode" className="flex items-center gap-1 cursor-pointer">
                            <Edit className="w-4 h-4" /> Mode Déplacement
                        </Label>
                    </div>
                    <Button onClick={() => { setEditingTable({ nom: '', capacite: 2, forme: 'carree' }); setShowTableForm(true);}}>
                        <Plus className="w-4 h-4 mr-2" /> Ajouter
                    </Button>
                </div>
            </header>

            <div ref={containerRef} className="flex-1 bg-gray-50 relative overflow-auto">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-500 bg-opacity-20 z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-800" />
                        <span className="ml-2 text-gray-800">Chargement du plan de tables...</span>
                    </div>
                )}
                {tables.map(table => (
                    <TableComponent
                        key={table.id}
                        table={table}
                        isEditing={isEditing}
                        onMouseDown={(e) => handleTableMouseDown(e, table)}
                        onClick={() => handleTableClick(table)}
                        onStatusChange={handleStatusChange}
                        onForceFree={handleForceFreeTable}
                    />
                ))}
            </div>

            {showTableForm && ( // Updated to showTableForm
                <TableFormDialog
                    table={editingTable} // Updated to editingTable
                    onSave={handleSaveTable}
                    onCancel={() => setShowTableForm(false)} // Updated to showTableForm
                    onDelete={handleDeleteTable}
                />
            )}
        </div>
    );
}

