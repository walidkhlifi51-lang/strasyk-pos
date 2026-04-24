import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/components/ui/use-toast";

const OfflineContext = createContext();

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState([]);
  const [cachedData, setCachedData] = useState({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Charger les données depuis localStorage
  useEffect(() => {
    const storedOps = localStorage.getItem('pendingOperations');
    const storedCache = localStorage.getItem('offlineCache');
    
    if (storedOps) {
      try {
        setPendingOperations(JSON.parse(storedOps));
      } catch (e) {
        console.error('Erreur chargement pendingOperations:', e);
      }
    }
    
    if (storedCache) {
      try {
        setCachedData(JSON.parse(storedCache));
      } catch (e) {
        console.error('Erreur chargement cache:', e);
      }
    }
  }, []);

  // Sauvegarder les opérations en attente dans localStorage
  useEffect(() => {
    if (pendingOperations.length > 0) {
      localStorage.setItem('pendingOperations', JSON.stringify(pendingOperations));
    } else {
      localStorage.removeItem('pendingOperations');
    }
  }, [pendingOperations]);

  // Écouter les changements de connexion
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast({
        title: "✅ Connexion rétablie",
        description: "Synchronisation en cours...",
        variant: "success",
      });
      
      // Attendre un peu avant de synchroniser
      setTimeout(() => {
        syncPendingOperations();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "⚠️ Connexion perdue",
        description: "Mode hors ligne activé. Les données sont sauvegardées localement.",
        variant: "warning",
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingOperations]);

  // Ajouter une opération à la queue
  const addPendingOperation = (operation) => {
    const newOp = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...operation
    };
    setPendingOperations(prev => [...prev, newOp]);
    
    toast({
      title: "📦 Opération mise en file d'attente",
      description: "Elle sera synchronisée dès la reconnexion.",
    });
  };

  // Mettre en cache des données
  const cacheData = (key, data) => {
    const newCache = {
      ...cachedData,
      [key]: {
        data,
        timestamp: new Date().toISOString()
      }
    };
    setCachedData(newCache);
    localStorage.setItem('offlineCache', JSON.stringify(newCache));
  };

  // Récupérer des données en cache
  const getCachedData = (key) => {
    return cachedData[key]?.data || null;
  };

  // Synchroniser les opérations en attente
  const syncPendingOperations = async () => {
    if (pendingOperations.length === 0) {
      console.log('Aucune opération à synchroniser');
      return;
    }

    console.log(`🔄 Début synchronisation de ${pendingOperations.length} opération(s)`);
    
    let successCount = 0;
    let failedOps = [];

    for (const op of pendingOperations) {
      try {
        const { appClient } = await import('@/api/appClient');
        
        if (op.type === 'create' && op.entity) {
          // Retirer les champs temporaires avant l'envoi
          const cleanData = { ...op.data };
          delete cleanData.id;
          delete cleanData.offline;
          delete cleanData.created_date;
          
          console.log('📤 Envoi commande:', cleanData);
          const result = await appClient.entities[op.entity].create(cleanData);
          console.log('✅ Commande créée:', result);
        } else if (op.type === 'update' && op.entity && op.recordId) {
          await appClient.entities[op.entity].update(op.recordId, op.data);
        }
        
        successCount++;
      } catch (error) {
        console.error('❌ Erreur sync:', error);
        failedOps.push(op);
      }
    }

    setPendingOperations(failedOps);

    if (successCount > 0) {
      // Vider le cache des commandes offline après succès
      const newCache = { ...cachedData };
      delete newCache.offlineOrders;
      setCachedData(newCache);
      localStorage.setItem('offlineCache', JSON.stringify(newCache));
      
      // Réinitialiser les compteurs offline
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('offlineCounter_')) {
          localStorage.removeItem(key);
        }
      });
      
      toast({
        title: "✅ Synchronisation réussie",
        description: `${successCount} commande(s) synchronisée(s).`,
        variant: "success",
        duration: 3000,
      });
      
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['posData'] });
      }, 500);
    }

    if (failedOps.length > 0) {
      toast({
        title: "⚠️ Synchronisation partielle",
        description: `${failedOps.length} commande(s) en échec. Nouvelle tentative automatique.`,
        variant: "warning",
      });
    }
  };

  return (
    <OfflineContext.Provider value={{
      isOnline,
      pendingOperations,
      addPendingOperation,
      syncPendingOperations,
      cacheData,
      getCachedData
    }}>
      {children}
    </OfflineContext.Provider>
  );
};
