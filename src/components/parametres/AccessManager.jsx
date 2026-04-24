import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '../contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { UserCheck, UserX, UserPlus, Mail, Shield, Trash2, RefreshCw, Link2, Copy } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { getDefaultAccessPermissions, normalizeUserAccess, USER_ACCESS_PERMISSIONS } from '@/lib/userAccess';
import { getAppBaseUrl } from '@/lib/appUrls';

export default function AccessManager() {
  const { currentTenant, filterByTenant } = useTenant();
  const { toast } = useToast();
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('employee');

  const { data: profile } = useQuery({
    queryKey: ['restaurantProfile', currentTenant?.id],
    queryFn: () => appClient.entities.RestaurantProfile.filter(filterByTenant()).then(res => res?.[0]),
    enabled: !!currentTenant?.id,
  });

  const { data: accesses = [], refetch: refetchAccesses } = useQuery({
    queryKey: ['userAccesses', currentTenant?.id],
    queryFn: () => appClient.entities.UserAccess.filter(filterByTenant()),
    enabled: !!currentTenant?.id,
  });

  const appUrl = getAppBaseUrl();
  
  const getInviteLink = (email, role) => {
    return `${appUrl}${createPageUrl('InviteSignup')}?tenant=${currentTenant.id}&email=${encodeURIComponent(email)}&role=${role}`;
  };

  const copyInviteLink = (email, role) => {
    const link = getInviteLink(email, role);
    const message = `Bonjour,

Vous êtes invité à rejoindre ${currentTenant.nom_commercial} sur Strasyk POS.

🔗 Créez votre compte en 1 clic :
${link}

Ce lien vous permettra de :
✅ Créer votre compte en quelques secondes
✅ Accéder automatiquement au commerce
✅ Commencer à travailler immédiatement

À bientôt !`;

    navigator.clipboard.writeText(message);
    toast({
      title: "✅ Invitation copiée",
      description: "Envoyez ce message par email à l'utilisateur",
    });
  };

  const handleAddAccess = async () => {
    if (!newUserEmail) {
      toast({
        title: "⚠️ Email requis",
        description: "Veuillez entrer un email",
        variant: "destructive",
      });
      return;
    }

    if (accesses.length >= maxCashierUsers) {
      toast({
        title: "❌ Limite atteinte",
        description: `Nombre maximum d'utilisateurs atteint (${maxCashierUsers}). Supprimez un utilisateur pour en ajouter un nouveau.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const alreadyExists = accesses.find(a => a.user_email === newUserEmail);
      if (alreadyExists) {
        toast({
          title: "⚠️ Déjà ajouté",
          description: "Cet utilisateur a déjà un accès",
          variant: "destructive",
        });
        return;
      }

      await appClient.entities.UserAccess.create({
        tenant_id: currentTenant.id,
        user_email: newUserEmail,
        role: newUserRole,
        is_active: true,
        ...getDefaultAccessPermissions(newUserRole),
      });

      toast({
        title: "✅ Utilisateur ajouté",
        description: `Copiez le lien d'invitation pour ${newUserEmail}`,
      });

      copyInviteLink(newUserEmail, newUserRole);
      setNewUserEmail('');
      setNewUserRole('employee');
      refetchAccesses();
    } catch (error) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (access) => {
    try {
      const newValue = !access.is_active;
      console.log(`[AccessManager] Toggle is_active: ${access.is_active} → ${newValue} pour ${access.user_email} (id: ${access.id})`);
      await appClient.entities.UserAccess.update(access.id, {
        is_active: newValue,
      });
      console.log(`[AccessManager] Mise à jour réussie`);

      toast({
        title: access.is_active ? "🔒 Accès désactivé" : "✅ Accès activé",
        description: `${access.user_email}`,
      });

      refetchAccesses();
    } catch (error) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (access) => {
    if (!confirm(`Supprimer l'accès de ${access.user_email} ?`)) return;

    try {
      await appClient.entities.UserAccess.delete(access.id);

      toast({
        title: "🗑️ Accès supprimé",
        description: `${access.user_email}`,
      });

      refetchAccesses();
    } catch (error) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateRole = async (access, newRole) => {
    try {
      await appClient.entities.UserAccess.update(access.id, {
        role: newRole,
        ...getDefaultAccessPermissions(newRole),
      });

      toast({
        title: "✅ Rôle mis à jour",
        description: `${access.user_email} → ${newRole}`,
      });

      refetchAccesses();
    } catch (error) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTogglePermission = async (access, permissionKey, value) => {
    try {
      await appClient.entities.UserAccess.update(access.id, {
        [permissionKey]: value,
      });

      toast({
        title: "Permissions mises a jour",
        description: `${access.user_email}`,
      });

      refetchAccesses();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleRemoteCashier = async (access) => {
    if (!profile?.remote_cashier_module_enabled) {
      toast({
        title: "❌ Module non activé",
        description: "Le module caisse distante n'est pas activé pour ce commerce. Contactez le support.",
        variant: "destructive",
      });
      return;
    }

    const currentRemoteCashiers = accesses.filter(a => a.is_remote_cashier).length;
    const maxAllowed = profile.max_remote_cashiers || 0;

    if (!access.is_remote_cashier && currentRemoteCashiers >= maxAllowed) {
      toast({
        title: "❌ Limite atteinte",
        description: `Vous avez atteint le nombre maximum de caisses distantes (${maxAllowed}). Désactivez-en une pour en activer une autre.`,
        variant: "destructive",
      });
      return;
    }

    try {
      await appClient.entities.UserAccess.update(access.id, {
        is_remote_cashier: !access.is_remote_cashier,
      });

      toast({
        title: access.is_remote_cashier ? "🖨️ Caisse distante désactivée" : "🖨️ Caisse distante activée",
        description: `${access.user_email} - Les tickets ${access.is_remote_cashier ? 'ne s\'imprimeront plus' : 's\'imprimeront'} sur la caisse principale`,
      });

      refetchAccesses();
    } catch (error) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const currentRemoteCashiers = accesses.filter(a => a.is_remote_cashier).length;
  const maxRemoteCashiers = profile?.max_remote_cashiers || 0;
  const maxCashierUsers = profile?.max_cashier_users || 5;



  return (
    <div className="space-y-6">
      {profile?.remote_cashier_module_enabled && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">🖨️ Module Caisse Distante Activé</p>
                <p className="text-sm text-blue-700 mt-1">
                  {currentRemoteCashiers} / {maxRemoteCashiers} caisses distantes utilisées
                </p>
              </div>
              <Badge className="bg-blue-600">
                {maxRemoteCashiers - currentRemoteCashiers} restantes
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Inviter un utilisateur ({accesses.length} / {maxCashierUsers})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label>Email de l'utilisateur</Label>
              <Input
                type="email"
                placeholder="utilisateur@exemple.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Rôle</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employé</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAddAccess} className="mt-4">
            <Link2 className="w-4 h-4 mr-2" />
            Générer le lien d'invitation
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Utilisateurs ({accesses.length})
            </span>
            <Button variant="outline" size="sm" onClick={refetchAccesses}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accesses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun utilisateur invité</p>
          ) : (
            <div className="space-y-3">
              {accesses.map((rawAccess) => {
                const access = normalizeUserAccess(rawAccess);

                return (
                <div key={access.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium">{access.user_email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={access.is_active ? "success" : "secondary"}>
                          {access.is_active ? "Actif" : "Inactif"}
                        </Badge>
                        {access.is_remote_cashier && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                            🖨️ Caisse distante
                          </Badge>
                        )}
                        <Select
                          value={access.role}
                          onValueChange={(value) => handleUpdateRole(access, value)}
                        >
                          <SelectTrigger className="w-32 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employé</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyInviteLink(access.user_email, access.role)}
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copier lien d'invitation
                    </Button>
                    {profile?.remote_cashier_module_enabled && (
                      <Button
                        variant={access.is_remote_cashier ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleRemoteCashier(access)}
                        title={access.is_remote_cashier ? "Impression distante activée" : "Activer impression distante"}
                      >
                        🖨️
                      </Button>
                    )}
                    <Button
                      variant={access.is_active ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleToggleActive(access)}
                    >
                      {access.is_active ? (
                        <>
                          <UserX className="w-4 h-4 mr-1" />
                          Désactiver
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4 mr-1" />
                          Activer
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(access)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 border-t pt-4">
                    {USER_ACCESS_PERMISSIONS.map((permission) => (
                      <div key={permission.key} className="rounded-lg border bg-gray-50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{permission.label}</p>
                            <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                          </div>
                          <Switch
                            checked={access[permission.key] !== false}
                            onCheckedChange={(checked) => handleTogglePermission(access, permission.key, checked)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <p className="text-sm text-green-800">
            <strong>✅ Nouveau système d'invitation :</strong>
            <br />
            1. Ajoutez l'email de l'utilisateur et son rôle
            <br />
            2. Un lien d'invitation personnalisé est copié automatiquement
            <br />
            3. Envoyez-le par email - l'utilisateur créera son compte en 1 clic
            <br />
            4. Il sera automatiquement lié à votre commerce !
          </p>
        </CardContent>
      </Card>



      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">
            🔐 Permissions par rôle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-l-4 border-blue-600 pl-4">
            <h4 className="font-bold text-blue-900 mb-2">👑 Propriétaire (Owner)</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✅ Accès complet à toutes les fonctionnalités</li>
              <li>✅ Gestion des utilisateurs et paramètres</li>
              <li>✅ Comptabilité et analyse des coûts</li>
              <li>✅ Statistiques et rapports détaillés</li>
            </ul>
          </div>

          <div className="border-l-4 border-green-600 pl-4">
            <h4 className="font-bold text-green-900 mb-2">👔 Manager</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>✅ Caisse, livraisons, clients</li>
              <li>✅ Comptage caisse et historique</li>
              <li>✅ Statistiques et analyses produits/catégories</li>
              <li>✅ Paramètres et journal tiroir</li>
              <li>❌ Comptabilité et analyse coûts (réservé au propriétaire)</li>
            </ul>
          </div>

          <div className="border-l-4 border-orange-600 pl-4">
            <h4 className="font-bold text-orange-900 mb-2">👤 Employé</h4>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>✅ Accueil, caisse, plan de tables</li>
              <li>✅ Livraisons, encaissements, clients</li>
              <li>✅ Manuel d'utilisation</li>
              <li>❌ Pas d'accès aux paramètres</li>
              <li>❌ Pas d'accès aux statistiques</li>
              <li>❌ Pas de comptage caisse</li>
            </ul>
          </div>

          <div className="border-l-4 border-blue-600 pl-4">
            <h4 className="font-bold text-blue-900 mb-2">🖨️ Caisse distante</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✅ Mode pour caissiers travaillant à distance</li>
              <li>✅ Les tickets s'impriment sur la caisse principale</li>
              <li>✅ Fonctionne comme les bornes de commande</li>
              <li>💡 Activable pour n'importe quel utilisateur</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
