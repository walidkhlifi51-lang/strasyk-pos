import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Archive, Terminal } from 'lucide-react';
import { appClient } from '@/api/appClient';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTenant } from '../contexts/TenantContext';

const OPENING_REASONS = [
  'Fond de caisse',
  'Rendre la monnaie',
  "Correction d'erreur de paiement",
  'Prelevement / Depot',
  'Autre (preciser en note de caisse si besoin)',
];

const formatPrintDate = () =>
  new Date().toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).replace(',', '');

const triggerDrawerKick = ({ reason, openedBy }) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head>
        <title>Ouverture tiroir</title>
        <style>
          @page { size: 80mm auto; margin: 2mm; }
          html, body { margin: 0; padding: 0; font-family: monospace; color: #000; background: #fff; }
          body { width: 76mm; font-size: 10px; line-height: 1.1; }
          .center { text-align: center; }
          .title { font-size: 12px; font-weight: bold; margin: 0 0 2px; }
          .row { margin: 0; word-break: break-word; }
          .spacer { height: 8px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="title">OUVERTURE TIROIR</div>
          <div class="row">${reason || ''}</div>
        </div>
        <div class="spacer"></div>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (error) {
      console.error("Erreur lors de l'ouverture du tiroir:", error);
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }
  }, 150);
};

export default function OpenDrawerButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { withTenant, currentUser, currentTenant } = useTenant();

  const openedBy = currentUser?.full_name || currentUser?.email || null;

  const handleOpenDrawer = async () => {
    if (!reason) {
      toast({
        title: 'Motif requis',
        description: "Veuillez selectionner un motif pour ouvrir le tiroir.",
        variant: 'destructive',
      });
      return;
    }

    setIsOpening(true);
    try {
      const payload = withTenant({
        reason,
        created_by: openedBy,
      });

      try {
        await appClient.entities.DrawerOpening.create(payload);
      } catch (error) {
        const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
        if (!message.includes('created_by')) {
          throw error;
        }

        await appClient.entities.DrawerOpening.create(withTenant({ reason }));
      }

      triggerDrawerKick({ reason, openedBy });
      queryClient.invalidateQueries({ queryKey: ['drawerOpenings'] });
      queryClient.invalidateQueries({ queryKey: ['drawerOpenings', currentTenant?.id] });

      toast({
        title: 'Tiroir ouvert',
        description: `Motif : ${reason}`,
        variant: 'success',
      });

      setIsModalOpen(false);
      setReason('');
    } catch (error) {
      console.error('Failed to open drawer or log event:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'enregistrer l'evenement ou d'ouvrir le tiroir.",
        variant: 'destructive',
      });
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsModalOpen(true)} className="w-full gap-2">
        <Archive className="h-4 w-4" />
        Ouvrir le tiroir
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ouverture manuelle du tiroir-caisse</DialogTitle>
            <DialogDescription>
              Pour des raisons de securite, chaque ouverture manuelle est enregistree.
              Veuillez selectionner le motif de cette action.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <Terminal className="h-4 w-4" stroke="currentColor" />
            <AlertTitle>Astuce Pro</AlertTitle>
            <AlertDescription>
              Pour une ouverture instantanee sans voir la fenetre d'impression, demandez a votre technicien
              de configurer le mode `kiosk-printing` du navigateur.
            </AlertDescription>
          </Alert>

          <div className="space-y-4 py-4">
            <Label className="font-medium">Motif de l'ouverture</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {OPENING_REASONS.map((item) => (
                <Button
                  key={item}
                  variant={reason === item ? 'default' : 'outline'}
                  onClick={() => setReason(item)}
                  className="h-auto justify-start whitespace-normal py-3 text-left"
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsModalOpen(false);
                setReason('');
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleOpenDrawer} disabled={!reason || isOpening}>
              {isOpening ? 'Ouverture...' : 'Confirmer et Ouvrir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
