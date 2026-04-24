import React from 'react';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi, Cloud, CloudOff } from 'lucide-react';
import { useOffline } from '../contexts/OfflineContext';

export default function OfflineIndicator() {
  const { isOnline, pendingOperations } = useOffline();

  if (isOnline && pendingOperations.length === 0) {
    return null; // Ne rien afficher si tout va bien
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <Badge 
        className={`${
          isOnline 
            ? 'bg-green-500 text-white' 
            : 'bg-orange-600 text-white'
        } px-6 py-3 text-sm font-bold shadow-2xl flex items-center gap-3 ${!isOnline ? 'animate-pulse' : ''}`}
      >
        {isOnline ? (
          <>
            <Wifi className="w-5 h-5" />
            Synchronisation... ({pendingOperations.length})
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5" />
            Mode hors ligne - {pendingOperations.length} commande(s) en attente
          </>
        )}
      </Badge>
    </div>
  );
}
