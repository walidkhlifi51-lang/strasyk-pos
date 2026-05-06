import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { appClient } from "@/api/appClient";
import { useTenant } from "@/components/contexts/TenantContext";

// Import components
import RestaurantSettings from '../components/parametres/RestaurantSettings';
import ProductManager from '../components/parametres/ProductManager';
import CategoryManager from '../components/parametres/CategoryManager';
import DeliveryPersonManager from '../components/parametres/DeliveryPersonManager';
import ProductOptionsManager from '../components/parametres/ProductOptionsManager';
import IngredientManager from '../components/parametres/IngredientManager';
import MenuFormulaManager from '../components/parametres/MenuFormulaManager';
import MarketingManager from '../components/parametres/MarketingManager';
import SecurityManager from '../components/parametres/SecurityManager';
import LoyaltyManager from '../components/parametres/LoyaltyManager';
import CagnotteManager from '../components/parametres/CagnotteManager';
import PromoCodeManager from '../components/parametres/PromoCodeManager';
import AccessManager from '../components/parametres/AccessManager';
import CustomerDisplaySettings from '../components/parametres/CustomerDisplaySettings';
import WebOrderingSettings from '../components/parametres/WebOrderingSettings';
import ScratchTicketManager from '../components/scratch/ScratchTicketManager';

import { Store, Package, List, Layers, Salad, UtensilsCrossed, Gift, Truck, Settings, CheckCircle, RefreshCw, Loader2, Ticket, PiggyBank, ShieldCheck, Users, Monitor, Globe, Sparkles } from "lucide-react";

const tabs = [
    { name: 'restaurant', label: 'Établissement', icon: Store, component: RestaurantSettings, requiredData: ['profile'] },
    { name: 'products', label: 'Produits', icon: Package, component: ProductManager, requiredData: ['products', 'categories', 'ingredients', 'profile'] },
    { name: 'categories', label: 'Catégories', icon: List, component: CategoryManager, requiredData: ['categories'] },
    { name: 'options', label: 'Options', icon: Layers, component: ProductOptionsManager, requiredData: ['products'] },
    { name: 'ingredients', label: 'Ingrédients', icon: Salad, component: IngredientManager, requiredData: ['ingredients'] },
    { name: 'menus', label: 'Menus', icon: UtensilsCrossed, component: MenuFormulaManager, requiredData: ['products', 'categories'] },
    { name: 'marketing', label: 'Promotions', icon: Gift, component: MarketingManager, requiredData: ['products', 'categories'] },
    { name: 'scratch', label: 'Scratch Tickets', icon: Sparkles, component: ScratchTicketManager, requiredData: ['profile'], condition: (profile) => profile?.manages_kiosk === true || profile?.manages_web_ordering === true },
    { name: 'loyalty_offers', label: 'Offres & Fidélité', icon: Gift, component: LoyaltyManager, requiredData: ['products', 'categories', 'profile'] },
    { name: 'promo_codes', label: 'Codes Promo', icon: Ticket, component: PromoCodeManager, requiredData: ['profile'] },
    { name: 'cagnotte', label: 'Cagnotte', icon: PiggyBank, component: CagnotteManager, requiredData: ['profile'] },
    { name: 'delivery', label: 'Livreurs', icon: Truck, component: DeliveryPersonManager, requiredData: ['deliveryPeople', 'profile'], condition: (profile) => profile?.manages_deliveries !== false },
    { name: 'customer_display', label: 'Écran Client', icon: Monitor, component: CustomerDisplaySettings, requiredData: ['profile'] },
    { name: 'web_ordering', label: 'Commande en ligne', icon: Globe, component: WebOrderingSettings, requiredData: ['profile', 'products'], condition: (profile, permissions) => profile?.manages_web_ordering === true && permissions.canAccessWebOrdering },
    { name: 'access', label: 'Gestion des accès', icon: Users, component: AccessManager, requiredData: [], condition: (_, permissions) => permissions.isOwner },
    { name: 'security', label: 'Sécurité', icon: ShieldCheck, component: SecurityManager, requiredData: ['profile'] },
];

const StatCard = ({ title, value, subtitle, icon, colorClass, onClick }) => (
    <div
        className="bg-white p-5 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow border border-gray-100"
        onClick={onClick}
    >
        <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClass}`}>
            {icon}
        </div>
    </div>
);

export default function Parametres() {
    const [activeTab, setActiveTab] = useState('products');
    const { currentTenant, filterByTenant, withTenant, hasModuleAccess, isOwner } = useTenant();

    const { data: managementData, isLoading, refetch } = useQuery({
        queryKey: ['managementData', currentTenant?.id],
        queryFn: async () => {
            console.log('🔧 [Parametres] Chargement avec filtrage tenant...');
            
            const [products, categories, ingredients, deliveryPeople, profileList] = await Promise.all([
                appClient.entities.Product.filter(filterByTenant()).catch(() => []),
                appClient.entities.Category.filter(filterByTenant()).catch(() => []),
                appClient.entities.Ingredient.filter(filterByTenant()).catch(() => []),
                appClient.entities.DeliveryPerson.filter(filterByTenant()).catch(() => []),
                appClient.entities.RestaurantProfile.filter(filterByTenant(), '-updated_date', 5).catch(() => [])
            ]);
            
            const profile = profileList?.[0] || null;
            
            console.log('✅ [Parametres] Données chargées:', {
                products: products.length,
                categories: categories.length,
                ingredients: ingredients.length,
                deliveryPeople: deliveryPeople.length,
                profile: profile ? 'OK' : 'MANQUANT'
            });
            
            return { products, categories, ingredients, deliveryPeople, profile };
        },
        enabled: !!currentTenant?.id,
        refetchOnWindowFocus: false,
    });

    const ActiveTabInfo = useMemo(() => tabs.find(tab => tab.name === activeTab), [activeTab]);
    const ActiveComponent = ActiveTabInfo?.component;

    const activeComponentData = useMemo(() => {
        if (!ActiveTabInfo || !managementData) return {};

        const dataForComponent = {};
        ActiveTabInfo.requiredData.forEach(key => {
            dataForComponent[key] = managementData[key];
        });
        return dataForComponent;
    }, [ActiveTabInfo, managementData]);

    const summaryData = useMemo(() => {
        if (!managementData) return [];
        return [
        {
            title: 'Produits',
            value: managementData.products?.length || 0,
            subtitle: `${managementData.products?.filter(p => p.disponible).length || 0} disponibles`,
            icon: <Package className="w-6 h-6 text-orange-600" />,
            colorClass: 'bg-orange-100',
            tabName: 'products'
        },
        {
            title: 'Livreurs',
            value: managementData.deliveryPeople?.length || 0,
            subtitle: `${managementData.deliveryPeople?.filter(d => d.disponible).length || 0} disponibles`,
            icon: <Truck className="w-6 h-6 text-blue-600" />,
            colorClass: 'bg-blue-100',
            tabName: 'delivery'
        },
        {
            title: 'Catégories',
            value: managementData.categories?.length || 0,
            subtitle: `${managementData.categories?.filter(c => !c.parent_id).length || 0} principales`,
            icon: <List className="w-6 h-6 text-purple-600" />,
            colorClass: 'bg-purple-100',
            tabName: 'categories'
        },
        {
            title: 'Ingrédients',
            value: managementData.ingredients?.length || 0,
            subtitle: 'en base de données',
            icon: <Salad className="w-6 h-6 text-yellow-600" />,
            colorClass: 'bg-yellow-100',
            tabName: 'ingredients'
        },
        {
            title: 'Profil',
            value: managementData.profile?.nom_etablissement ? <CheckCircle className="w-8 h-8 text-green-600" /> : '...',
            subtitle: managementData.profile?.nom_etablissement ? 'Configuré' : 'À configurer',
            icon: <Store className="w-6 h-6 text-green-600" />,
            colorClass: 'bg-green-100',
            tabName: 'restaurant'
        }
    ]}, [managementData]);

    if (!currentTenant) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-500">Chargement du tenant...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-4 md:p-6 lg:p-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <Settings className="w-7 h-7" />
                        Paramètres & Configuration
                    </h1>
                    <p className="text-gray-500 mt-2">Gérez les produits, livreurs et profil du restaurant</p>
                </div>
                <Button variant="outline" onClick={() => refetch()} className="flex-shrink-0">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualiser les données
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {summaryData.map(item => (
                    <StatCard
                        key={item.title}
                        {...item}
                        onClick={() => setActiveTab(item.tabName)}
                    />
                ))}
            </div>

            <div className="bg-gray-100 p-1.5 rounded-xl">
                <div className="flex items-center overflow-x-auto">
                    {tabs
                        .filter(tab => !tab.condition || tab.condition(managementData?.profile, {
                            canAccessWebOrdering: hasModuleAccess('can_access_web_ordering'),
                            canAccessDeliveryApp: hasModuleAccess('can_access_delivery_app'),
                            isOwner,
                        }))
                        .map(tab => (
                        <button
                            key={tab.name}
                            onClick={() => setActiveTab(tab.name)}
                            className={`flex-shrink-0 w-full md:w-auto flex items-center justify-center p-3 px-4 rounded-lg text-sm font-medium transition-colors duration-200 ${
                                activeTab === tab.name
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:bg-white/60 hover:text-gray-800"
                            }`}
                        >
                            <tab.icon className="h-5 w-5 mr-2" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div>
                {isLoading ? (
                    <div className="text-center py-10 flex justify-center items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                        <p className="text-gray-600">Chargement des données de configuration...</p>
                    </div>
                ) : ActiveComponent ? (
                    <ActiveComponent
                        data={activeComponentData}
                        onDataChange={refetch}
                        withTenant={withTenant}
                        tenantId={currentTenant?.id}
                    />
                ) : (
                    <p>Sélectionnez une catégorie de paramètres.</p>
                )}
            </div>
        </div>
    );
}
