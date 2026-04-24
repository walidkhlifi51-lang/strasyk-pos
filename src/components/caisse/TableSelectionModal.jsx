import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Square, Circle, RectangleHorizontal } from 'lucide-react';

const shapeIcons = {
    carree: <Square className="w-6 h-6" />,
    ronde: <Circle className="w-6 h-6" />,
    rectangulaire: <RectangleHorizontal className="w-6 h-6" />,
};

export default function TableSelectionModal({ isOpen, onClose, tables, onSelectTable }) {
    const availableTables = tables.filter(t => t.statut === 'disponible');

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Sélectionner une table</DialogTitle>
                    <DialogDescription>Choisissez une table disponible pour y assigner la commande.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">
                        {availableTables.length > 0 ? (
                            availableTables.map(table => (
                                <div
                                    key={table.id}
                                    onClick={() => onSelectTable(table)}
                                    className="p-4 border-2 border-green-300 bg-green-50 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-green-100 hover:shadow-lg transition-all text-green-800"
                                >
                                    <span className="font-bold text-lg">{table.nom}</span>
                                    <div className="text-green-600">{shapeIcons[table.forme]}</div>
                                    <div className="flex items-center gap-1.5 text-sm">
                                        <Users className="w-4 h-4" />
                                        <span>{table.capacite}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <p>Aucune table n'est disponible pour le moment.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
