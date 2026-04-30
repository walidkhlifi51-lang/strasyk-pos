import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateTicketHtml, triggerPrint } from '../caisse/ticketUtils';
import { Printer, AlertTriangle } from 'lucide-react'; // Ajout de l'icône

export default function TicketViewerModal({ order, customer, profile, isOpen, onClose }) {
  const ticketRef = useRef(null);

  const handlePrint = async () => {
    if (!profile) {
      alert("Profil restaurant non configuré.");
      return;
    }
    const ticketHtml = await generateTicketHtml(order, customer, profile);
    triggerPrint(ticketHtml);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Aperçu du ticket - Commande #{order.numero_commande || order.numero_caisse || 'N/A'}</DialogTitle>
        </DialogHeader>
        <div ref={ticketRef} className="bg-white text-black text-sm p-4 font-mono max-h-[60vh] overflow-y-auto">
          
          {/* Section pour les commandes annulées */}
          {order.statut === 'annulee' && (
          <div className="border-2 border-dashed border-red-500 bg-red-50 p-3 text-center mb-4 rounded-lg">
          <div className="flex items-center justify-center text-red-600 font-bold text-lg">
            <AlertTriangle className="w-5 h-5 mr-2" />
            COMMANDE ANNULÉE
          </div>
          {order.motif_annulation && (
            <p className="text-red-500 mt-1 text-sm">
              Motif: {order.motif_annulation}
            </p>
          )}
          </div>
          )}

          {/* En-tête du ticket */}
          <div className="text-center">
            {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="mx-auto h-16 w-auto object-contain mb-2" />}
            <h3 className="font-bold text-lg">{profile?.nom_etablissement || 'Votre Restaurant'}</h3>
            <p>{profile?.adresse}</p>
            <p>Tél: {profile?.telephone}</p>
            {profile?.siret && <p>SIRET: {profile.siret}</p>}
            <hr className="my-2 border-dashed" />
          </div>

          {/* Informations de la commande */}
          <div className="space-y-1">
            <p><strong>Commande:</strong> #{order.numero_caisse || 'N/A'}</p>
            <p><strong>Date:</strong> {new Date(order.created_date.replace(' ', 'T') + 'Z').toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>
            {customer && <p><strong>Client:</strong> {customer.prenom} {customer.nom}</p>}
            <p><strong>Type:</strong> {order.type_commande}</p>
            {order.type_commande === 'sur_place' && (order.table_name || order.numero_table) && <p><strong>Table:</strong> {order.table_name || order.numero_table}</p>}
            {(order.type_commande === 'sur_place' || order.type_commande === 'emporter') && order.numero_bipeur && <p><strong>Bippeur:</strong> {order.numero_bipeur}</p>}
          </div>

          <hr className="my-2 border-dashed" />

          {/* Articles */}
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Qté</th>
                <th className="text-left">Article</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.articles || []).map((article, index) => (
                <React.Fragment key={index}>
                  <tr>
                    <td className="align-top">{article.quantite}x</td>
                    <td>
                      {article.nom_produit}
                      {article.options && article.options.length > 0 && (
                        <div className="text-xs text-gray-600 pl-2">
                          {article.options.map(opt => `+ ${opt.nom}`).join(', ')}
                        </div>
                      )}
                      {article.exclusions && article.exclusions.length > 0 && (
                        <div className="text-xs text-gray-600 pl-2">
                          {article.exclusions.map(exc => `- ${exc.nom}`).join(', ')}
                        </div>
                      )}
                       {article.notes && (
                        <div className="text-xs text-gray-500 pl-2 italic">Note: {article.notes}</div>
                      )}
                    </td>
                    <td className="text-right align-top">{article.total_ligne?.toFixed(2)}€</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <hr className="my-2 border-dashed" />

          {/* Totaux */}
          <div className="space-y-1">
            {/* Vous pouvez ajouter les totaux HT, TVA ici si nécessaire */}
            <div className="flex justify-between font-bold text-lg">
              <span>TOTAL:</span>
              <span>{order.total_ttc?.toFixed(2)}€</span>
            </div>
          </div>
          
          <hr className="my-2 border-dashed" />

          {/* Paiement */}
          {order.payee && (
             <div className="text-center">
                <p className="font-bold">Payé le {new Date(order.updated_date.replace(' ', 'T')+'Z').toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>
                {(order.mode_paiement || []).map((p, i) => (
                    <p key={i}>{p.methode}: {p.montant?.toFixed(2)}€</p>
                ))}
             </div>
          )}

          <div className="text-center mt-4">
            <p>Merci de votre visite !</p>
          </div>
        </div>
        <DialogFooter className="p-4 border-t">
          <Button onClick={handlePrint} className="w-full">
            <Printer className="mr-2 h-4 w-4" /> Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
