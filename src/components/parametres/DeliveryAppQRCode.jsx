// DeliveryAppQRCode v2
import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, Printer } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { generateDeliveryQRTicketHtml, triggerPrint } from '../caisse/ticketUtils';

export default function DeliveryAppQRCode({ tenantId, profile }) {
  const { toast } = useToast();
  const qrCanvasRef = useRef(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const qrUrl = tenantId ? `${window.location.origin}/DeliveryAppPublic?tenant=${tenantId}` : '';

  useEffect(() => {
    if (!qrCanvasRef.current || !qrUrl) return;
    import('qrcode').then(QRCode => {
      QRCode.default.toCanvas(qrCanvasRef.current, qrUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#000', light: '#fff' }
      }).catch(err => console.error('QR generation error:', err));
    });
  }, [qrUrl]);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const html = await generateDeliveryQRTicketHtml(profile, qrUrl);
      await triggerPrint(html, () => setIsPrinting(false));
    } catch (error) {
      console.error('Erreur impression QR:', error);
      toast({ title: 'Erreur', description: 'Impossible de générer le QR code', variant: 'destructive' });
      setIsPrinting(false);
    }
  };

  if (!tenantId) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4 text-sm text-yellow-700">
          ⚠️ Aucun tenant configuré
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          QR Code App Livreur
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Imprimez ce QR code et donnez-le aux livreurs pour accéder directement à l'application.
        </p>

        <div className="flex flex-col items-center gap-4 p-6 bg-white border-2 border-gray-200 rounded-lg">
          <canvas
            ref={qrCanvasRef}
            className="border-4 border-gray-300 rounded-lg"
            style={{ maxWidth: '300px', height: 'auto', display: 'block' }}
          />
        </div>

        <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-3">
          <p className="font-semibold mb-1">📝 Lien direct :</p>
          <code className="break-all">{qrUrl}</code>
        </div>

        <Button
          onClick={handlePrint}
          disabled={isPrinting}
          className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <Printer className="w-4 h-4" />
          {isPrinting ? 'Impression...' : '🖨️ Imprimer le QR Code'}
        </Button>
      </CardContent>
    </Card>
  );
}
