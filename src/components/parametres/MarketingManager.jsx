import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OfferManager from './OfferManager';
import LoyaltyManager from './LoyaltyManager';
import CagnotteManager from './CagnotteManager';
import PromoCodeManager from './PromoCodeManager';
import { Gift, Star, PiggyBank, Ticket } from "lucide-react";

export default function MarketingManager({ data, onDataChange }) {

  return (
    <div className="p-4 md:p-6 space-y-6">
        <h3 className="text-xl font-semibold flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" />
            Gestion Marketing & Fidélité
        </h3>

        <Tabs defaultValue="offers" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="offers">
                    <Gift className="w-4 h-4 mr-2" /> Offres
                </TabsTrigger>
                <TabsTrigger value="loyalty">
                    <Star className="w-4 h-4 mr-2" /> Fidélité
                </TabsTrigger>
                <TabsTrigger value="cagnotte">
                    <PiggyBank className="w-4 h-4 mr-2" /> Cagnotte
                </TabsTrigger>
                <TabsTrigger value="promo_codes">
                    <Ticket className="w-4 h-4 mr-2" /> Codes Promo
                </TabsTrigger>
            </TabsList>
            <TabsContent value="offers">
                <OfferManager data={data} onDataChange={onDataChange} />
            </TabsContent>
            <TabsContent value="loyalty">
                <LoyaltyManager />
            </TabsContent>
            <TabsContent value="cagnotte">
                <CagnotteManager />
            </TabsContent>
            <TabsContent value="promo_codes">
                <PromoCodeManager />
            </TabsContent>
        </Tabs>
    </div>
  );
}
