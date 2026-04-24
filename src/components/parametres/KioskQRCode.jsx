import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { generateKioskQRTicketHtml, triggerPrint } from '../caisse/ticketUtils';
import { useSecurity } from '../contexts/SecurityContext';

export default function KioskQRCode({ url, profile }) {
    const canvasRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    useEffect(() => {
        if (!url || !canvasRef.current) return;
        QRCode.toCanvas(canvasRef.current, url, {
            width: 200,
            margin: 2,
            color: { dark: '#1e293b', light: '#ffffff' }
        }, (err) => {
            if (!err) setReady(true);
        });
    }, [url]);

    const handlePrint = async () => {
        setIsPrinting(true);
        const html = await generateKioskQRTicketHtml(profile, url);
        await triggerPrint(html, () => setIsPrinting(false));
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Créer un canvas plus grand avec titre + QR + URL
        const output = document.createElement('canvas');
        output.width = 400;
        output.height = 500;
        const ctx = output.getContext('2d');

        // Fond blanc
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 500);

        // Titre
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Commandez en ligne', 200, 50);

        ctx.font = '16px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Scannez le QR Code pour accéder', 200, 80);
        ctx.fillText('à notre borne de commande', 200, 105);

        // QR code centré
        ctx.drawImage(canvas, 100, 120, 200, 200);

        // URL en dessous
        ctx.font = '10px Arial';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        const shortUrl = url.length > 55 ? url.substring(0, 52) + '...' : url;
        ctx.fillText(shortUrl, 200, 350);

        // Pied de page
        ctx.fillStyle = '#f97316';
        ctx.fillRect(0, 460, 400, 40);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Merci de votre commande ! 🍽️', 200, 485);

        // Télécharger
        const link = document.createElement('a');
        link.download = 'qrcode-borne.png';
        link.href = output.toDataURL('image/png');
        link.click();
    };

    return (
        <div className="flex flex-col items-center gap-3 p-4 bg-white border rounded-lg">
            <p className="text-sm font-medium text-gray-700">QR Code de la borne</p>
            <canvas ref={canvasRef} className="rounded-md border shadow-sm" />
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    disabled={!ready || isPrinting}
                    className="flex items-center gap-2"
                >
                    <Printer className="w-4 h-4" />
                    {isPrinting ? 'Impression...' : 'Imprimer ticket'}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!ready}
                    className="flex items-center gap-2"
                >
                    <Download className="w-4 h-4" />
                    Télécharger
                </Button>
            </div>
            <p className="text-xs text-gray-400 text-center">
                Imprimez et affichez ce QR code dans votre établissement
            </p>
        </div>
    );
}
