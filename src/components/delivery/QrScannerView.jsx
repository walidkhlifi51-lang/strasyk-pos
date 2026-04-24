import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const ELEMENT_ID = 'qr-scanner-element';

export default function QrScannerView({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const scannedRef = useRef(false);
  const [status, setStatus] = useState('starting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode(ELEMENT_ID, { verbose: false });
        scannerRef.current = scanner;

        const onSuccess = (decodedText) => {
          if (scannedRef.current || cancelled) return;
          const urlMatch = decodedText.match(/order=(\d+)/);
          const numMatch = decodedText.match(/(\d+)/);
          const orderNum = urlMatch ? urlMatch[1] : numMatch ? numMatch[1] : null;
          if (orderNum) {
            scannedRef.current = true;
            onScan(orderNum);
          }
        };

        // Essai caméra arrière, puis caméra avant en fallback
        try {
          await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onSuccess,
            () => {}
          );
        } catch {
          if (cancelled) return;
          await scanner.start(
            { facingMode: 'user' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onSuccess,
            () => {}
          );
        }

        if (!cancelled) setStatus('running');
      } catch (err) {
        console.error('Scanner error:', err);
        if (!cancelled) {
          setErrorMsg(err?.message || "Impossible d'accéder à la caméra");
          setStatus('error');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch {} });
        scannerRef.current = null;
      }
    };
  }, []);

  if (status === 'error') {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-600 font-semibold text-sm">❌ Caméra inaccessible</p>
          <p className="text-red-500 text-xs mt-1">{errorMsg}</p>
          <p className="text-gray-500 text-xs mt-2">Autorisez l'accès à la caméra dans votre navigateur puis réessayez.</p>
        </div>
        <Button onClick={onClose} variant="outline" className="w-full border-red-400 text-red-600 hover:bg-red-50">
          <X className="w-4 h-4 mr-1" /> Fermer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {status === 'starting' && (
        <div className="text-center text-sm text-gray-500 py-2 animate-pulse">⏳ Démarrage caméra...</div>
      )}
      <p className="text-xs text-center text-gray-500">Pointez la caméra vers le QR code du ticket</p>
      <div id={ELEMENT_ID} style={{ width: '100%', minHeight: '280px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#111' }} />
      <Button onClick={onClose} variant="outline" className="w-full border-red-400 text-red-600 hover:bg-red-50">
        <X className="w-4 h-4 mr-1" /> Fermer la caméra
      </Button>
    </div>
  );
}
