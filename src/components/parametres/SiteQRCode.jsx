import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { triggerPrint } from '../caisse/ticketUtils';

export default function SiteQRCode({ url, label = 'Site vitrine', profile }) {
    const canvasRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    useEffect(() => {
        if (!url || !canvasRef.current) return;
        setReady(false);
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
        const qrDataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
        const html = `
        <!DOCTYPE html><html><head><meta charset="UTF-8">
        <style>
            @page { size: 80mm auto; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: 14px; width: 80mm; padding: 6mm; background: white; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .separator { border-top: 1px dashed #000; margin: 8px 0; }
            .double-separator { border-top: 2px solid #000; margin: 8px 0; }
            .logo { max-width: 60mm; max-height: 30mm; height: auto; width: auto; }
        </style></head><body>
        ${profile?.logo_url ? `<div class="center" style="margin-bottom:10px;"><img src="${profile.logo_url}" class="logo" /></div>` : ''}
        <div class="center bold" style="font-size:20px;margin-bottom:4px;">${profile?.nom_etablissement || 'Restaurant'}</div>
        <div class="center" style="font-size:12px;color:#666;margin-bottom:4px;">${profile?.adresse || ''}</div>
        ${profile?.telephone ? `<div class="center" style="font-size:12px;color:#666;margin-bottom:4px;">Tél: ${profile.telephone}</div>` : ''}
        <div class="double-separator"></div>
        <div class="center bold" style="font-size:16px;margin:10px 0;">🌐 Commandez en ligne !</div>
        <div class="center" style="font-size:13px;color:#444;margin-bottom:12px;">Scannez le QR code pour accéder<br>à notre site de commande</div>
        <div class="center" style="margin:10px 0;"><img src="${qrDataUrl}" style="width:55mm;height:55mm;" /></div>
        <div class="separator"></div>
        <div class="center" style="font-size:10px;color:#666;margin:6px 0;word-break:break-all;">${url}</div>
        <div class="double-separator"></div>
        <div class="center bold" style="font-size:15px;margin-top:8px;font-style:italic;">Merci de votre visite ! 🙏</div>
        </body></html>`;
        await triggerPrint(html, () => setIsPrinting(false));
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const output = document.createElement('canvas');
        output.width = 400;
        output.height = 500;
        const ctx = output.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 500);
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Commandez en ligne', 200, 50);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Scannez le QR Code pour accéder', 200, 80);
        ctx.fillText('à notre site de commande en ligne', 200, 105);
        ctx.drawImage(canvas, 100, 120, 200, 200);
        ctx.font = '10px Arial';
        ctx.fillStyle = '#94a3b8';
        const shortUrl = url.length > 55 ? url.substring(0, 52) + '...' : url;
        ctx.fillText(shortUrl, 200, 350);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(0, 460, 400, 40);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('Merci de votre commande ! 🍽️', 200, 485);
        const link = document.createElement('a');
        link.download = 'qrcode-site.png';
        link.href = output.toDataURL('image/png');
        link.click();
    };

    return (
        <div className="flex flex-col items-center gap-3 p-4 bg-white border rounded-lg">
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <canvas ref={canvasRef} className="rounded-md border shadow-sm" />
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint} disabled={!ready || isPrinting} className="flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    {isPrinting ? 'Impression...' : 'Imprimer ticket'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} disabled={!ready} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Télécharger
                </Button>
            </div>
            <p className="text-xs text-gray-400 text-center">Imprimez et affichez ce QR code dans votre établissement</p>
        </div>
    );
}
