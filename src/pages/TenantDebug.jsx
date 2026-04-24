import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, XCircle, Loader2, RefreshCw } from 'lucide-react';

const normalizeEmail = (value) => (value || '').trim().toLowerCase();

export default function TenantDebug() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [fixing, setFixing] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
    console.log(`[${timestamp}] ${message}`);
  };

  useEffect(() => {
    diagnose();
  }, []);

  const diagnose = async () => {
    setLoading(true);
    setLogs([]);
    
    try {
      addLog('🔍 Début du diagnostic...', 'info');
      
      // 1. Récupérer l'utilisateur actuel
      addLog('📋 Récupération du user connecté...', 'info');
      const currentUser = await appClient.auth.me();
      setUser(currentUser);
      addLog(`✅ User: ${currentUser.email}`, 'success');
      addLog(`   - tenant_id: ${currentUser.tenant_id || 'AUCUN'}`, 'info');
      addLog(`   - role: ${currentUser.role}`, 'info');

      // 2. Récupérer TOUS les tenants accessibles
      addLog('📋 Récupération des tenants accessibles...', 'info');
      const accessibleTenants = await appClient.entities.Tenant.list();
      setTenants(accessibleTenants);
      addLog(`✅ ${accessibleTenants.length} tenant(s) accessible(s)`, 'success');
      
      accessibleTenants.forEach((t, idx) => {
        const nom = t.data?.nom_commercial || t.nom_commercial || 'Sans nom';
        const owner = t.data?.owner_email || t.owner_email || 'Pas d\'owner';
        addLog(`   ${idx + 1}. ${nom} (${t.id})`, 'info');
        addLog(`      Owner: ${owner}`, 'info');
      });

      // 3. Essayer de lister TOUS les users (si admin)
      try {
        addLog('📋 Tentative de récupération de tous les users...', 'info');
        const users = await appClient.entities.User.list();
        setAllUsers(users);
        addLog(`✅ ${users.length} user(s) trouvé(s)`, 'success');
      } catch (e) {
        addLog('⚠️ Impossible de lister tous les users (normal si pas admin)', 'warning');
      }

      // 4. Diagnostic
      addLog('🔬 Analyse du problème...', 'info');
      
      if (accessibleTenants.length === 0) {
        addLog('❌ PROBLÈME: Aucun tenant accessible!', 'error');
        addLog('   → L\'utilisateur n\'a accès à aucun commerce', 'error');
        addLog('   → Vérifiez que owner_email correspond bien à l\'email du user', 'error');
      } else {
        addLog('✅ Tenants accessibles détectés', 'success');
        
        // Trouver le tenant qui devrait correspondre
        const userTenant = accessibleTenants.find(t => {
          const owner = t.data?.owner_email || t.owner_email;
          return normalizeEmail(owner) === normalizeEmail(currentUser.email);
        });
        
        if (userTenant) {
          const nom = userTenant.data?.nom_commercial || userTenant.nom_commercial;
          addLog(`✅ Tenant trouvé pour cet email: ${nom} (${userTenant.id})`, 'success');
          
          if (!currentUser.tenant_id) {
            addLog('⚠️ User.tenant_id est VIDE', 'warning');
            addLog('   → Correction recommandée', 'warning');
          } else if (currentUser.tenant_id !== userTenant.id) {
            addLog(`❌ User.tenant_id est INCORRECT`, 'error');
            addLog(`   Actuel: ${currentUser.tenant_id}`, 'error');
            addLog(`   Attendu: ${userTenant.id}`, 'error');
            addLog('   → Correction nécessaire', 'error');
          } else {
            addLog('✅ User.tenant_id est CORRECT', 'success');
          }
        } else {
          addLog('❌ Aucun tenant avec owner_email = ' + currentUser.email, 'error');
          addLog('   → Vérifiez les données dans la table Tenant', 'error');
        }
      }
      
    } catch (error) {
      addLog(`💥 Erreur: ${error.message}`, 'error');
      console.error('Erreur diagnostic:', error);
    } finally {
      setLoading(false);
    }
  };

  const fixTenantId = async () => {
    setFixing(true);
    try {
      addLog('🔧 Début de la correction...', 'info');
      
      if (tenants.length === 0) {
        addLog('❌ Impossible: Aucun tenant accessible', 'error');
        setFixing(false);
        return;
      }
      
      // Trouver le bon tenant
      const userTenant = tenants.find(t => {
        const owner = t.data?.owner_email || t.owner_email;
        return normalizeEmail(owner) === normalizeEmail(user.email);
      });
      
      if (!userTenant) {
        addLog('❌ Impossible: Aucun tenant ne correspond à cet email', 'error');
        setFixing(false);
        return;
      }
      
      addLog(`🔧 Mise à jour du tenant_id vers: ${userTenant.id}`, 'info');
      await appClient.auth.updateMe({ tenant_id: userTenant.id });
      addLog('✅ tenant_id mis à jour avec succès!', 'success');
      
      addLog('🔄 Rechargement dans 2 secondes...', 'info');
      setTimeout(() => {
        window.location.href = '/Accueil';
      }, 2000);
      
    } catch (error) {
      addLog(`❌ Erreur lors de la correction: ${error.message}`, 'error');
    } finally {
      setFixing(false);
    }
  };

  const LogIcon = ({ type }) => {
    switch(type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default: return <div className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🔬 Diagnostic Tenant - Mode Debug</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={diagnose}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Rafraîchir
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <>
                {/* Informations utilisateur */}
                {user && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">👤 Utilisateur connecté</h3>
                    <div className="space-y-1 text-sm">
                      <div><strong>Email:</strong> {user.email}</div>
                      <div><strong>Role:</strong> {user.role}</div>
                      <div><strong>Tenant ID:</strong> {user.tenant_id || '❌ AUCUN'}</div>
                      <div><strong>Nom:</strong> {user.full_name || 'N/A'}</div>
                    </div>
                  </div>
                )}

                {/* Tenants accessibles */}
                {tenants.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">🏪 Tenants accessibles ({tenants.length})</h3>
                    <div className="space-y-2">
                      {tenants.map(t => {
                        const nom = t.data?.nom_commercial || t.nom_commercial;
                        const owner = t.data?.owner_email || t.owner_email;
                        const isMatch = owner === user?.email;
                        
                        return (
                          <div 
                            key={t.id} 
                            className={`p-3 rounded border ${isMatch ? 'bg-green-100 border-green-300' : 'bg-white border-gray-200'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{nom}</div>
                                <div className="text-xs text-gray-600">Owner: {owner}</div>
                                <div className="text-xs text-gray-500 font-mono">{t.id}</div>
                              </div>
                              {isMatch && (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Logs */}
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto">
                  <h3 className="font-semibold mb-3 text-white">📋 Logs de diagnostic</h3>
                  {logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 mb-1">
                      <span className="text-gray-500">{log.timestamp}</span>
                      <LogIcon type={log.type} />
                      <span className={
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'warning' ? 'text-yellow-400' :
                        log.type === 'success' ? 'text-green-400' :
                        'text-gray-300'
                      }>{log.message}</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={fixTenantId}
                    disabled={fixing || tenants.length === 0}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {fixing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Correction en cours...
                      </>
                    ) : (
                      '🔧 Corriger automatiquement'
                    )}
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/Accueil'}
                    variant="outline"
                  >
                    Retour à l'accueil
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Alert>
          <AlertDescription className="text-sm">
            <strong>💡 Comment utiliser cette page:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Cette page affiche tous les détails de votre configuration tenant</li>
              <li>Si un problème est détecté, utilisez le bouton "Corriger automatiquement"</li>
              <li>Si aucun tenant n'est accessible, contactez un administrateur</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
