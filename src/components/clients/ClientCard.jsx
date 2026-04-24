import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Mail, Edit, Trash2, History, PiggyBank } from 'lucide-react';

export default function ClientCard({ client, onEdit, onDelete, onViewHistory }) {
    const lastOrderDate = client.lastOrderDate 
        ? new Date(client.lastOrderDate).toLocaleDateString('fr-FR')
        : 'N/A';

    return (
        <Card className="flex flex-col justify-between">
            <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">{client.prenom} {client.nom}</CardTitle>
                        <p className="text-sm text-gray-500">Dernière commande: {lastOrderDate}</p>
                    </div>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(client)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(client.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>{client.telephone}</span>
                </div>
                {client.email && (
                    <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span>{client.email}</span>
                    </div>
                )}
                {client.adresse && (
                    <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                        <span>{client.adresse}, {client.code_postal} {client.ville}</span>
                    </div>
                )}
                {client.cagnotte_balance > 0 && (
                    <div className="flex items-center gap-2 pt-2 text-green-600">
                        <PiggyBank className="w-4 h-4" />
                        <span className="font-bold">Cagnotte: {client.cagnotte_balance.toFixed(2)}€</span>
                    </div>
                )}
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => onViewHistory(client)}>
                    <History className="w-4 h-4 mr-2" />
                    Voir l'historique
                </Button>
            </CardContent>
        </Card>
    );
}
