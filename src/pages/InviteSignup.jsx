import React, { useEffect, useMemo, useState } from 'react';
import { appClient } from '@/api/appClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Store, Loader2, ArrowRight, Handshake } from 'lucide-react';
import { buildAbsoluteAppUrl } from '@/lib/appUrls';

const normalizeEmail = (value) => (value || '').trim().toLowerCase();

export default function InviteSignup() {
  const { toast } = useToast();
  const [contextInfo, setContextInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const tenantId = params.get('tenant');
        const resellerId = params.get('reseller');
        const email = normalizeEmail(params.get('email'));
        const role = params.get('role') || (resellerId ? 'manager' : 'employee');
        const label = params.get('label') || '';

        if (!email || (!tenantId && !resellerId)) {
          setLoading(false);
          return;
        }

        if (tenantId) {
          localStorage.setItem('pending_tenant_invite', JSON.stringify({
            tenant_id: tenantId,
            expected_email: email,
            role,
            label,
            timestamp: Date.now(),
          }));

          setContextInfo({
            type: 'tenant',
            title: label || 'Commerce invite',
            description: 'Invitation commerce',
            icon: Store,
            email,
            role,
            redirectAfterSignup: buildAbsoluteAppUrl('/Auth'),
          });
          setLoading(false);
          return;
        }

        localStorage.setItem('pending_reseller_invite', JSON.stringify({
          reseller_id: resellerId,
          expected_email: email,
          role,
          label,
          timestamp: Date.now(),
        }));

        setContextInfo({
          type: 'reseller',
          title: label || 'Revendeur invite',
          description: 'Invitation revendeur',
          icon: Handshake,
          email,
          role,
          redirectAfterSignup: buildAbsoluteAppUrl('/Auth'),
        });
      } catch (error) {
        console.error('Erreur chargement invitation:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, [params]);

  const handleCreateAccount = async () => {
    if (!contextInfo?.email) return;

    if (!password || password.length < 6) {
      toast({
        title: 'Mot de passe requis',
        description: 'Choisissez un mot de passe d au moins 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== passwordConfirm) {
      toast({
        title: 'Confirmation invalide',
        description: 'Les mots de passe ne correspondent pas.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      await appClient.auth.signup({
        email: contextInfo.email,
        password,
        full_name: fullName.trim(),
        redirectTo: contextInfo.redirectAfterSignup,
      });

      toast({
        title: '✅ Compte cree',
        description: 'Vous pouvez maintenant vous connecter avec votre email et votre mot de passe.',
      });

      window.location.href = '/Auth';
    } catch (error) {
      toast({
        title: '❌ Erreur',
        description: error.message || 'Impossible de creer le compte.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!contextInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h2>
            <p className="text-gray-600 mb-4">Ce lien d invitation n est pas valide.</p>
            <Button onClick={() => { window.location.href = '/Auth'; }}>
              Aller a la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = contextInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {contextInfo.description}
          </CardTitle>
          <p className="text-gray-600 mt-2 font-semibold text-lg">
            {contextInfo.title}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-semibold mb-2">Email invite</p>
            <p className="text-blue-900 font-mono text-sm bg-white px-3 py-2 rounded border">
              {contextInfo.email}
            </p>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nom et prenom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">Confirmation</Label>
              <Input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="Retapez votre mot de passe"
              />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 font-semibold mb-2">Etapes</p>
            <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside">
              <li>Definissez votre mot de passe</li>
              <li>Créez votre compte avec cet email</li>
              <li>Connectez-vous ensuite sur la page normale</li>
              <li>L application vous reconnaitra automatiquement comme {contextInfo.type === 'reseller' ? 'revendeur' : 'utilisateur commerce'}</li>
            </ol>
          </div>

          <Button
            onClick={handleCreateAccount}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
          >
            {submitting ? 'Creation en cours...' : 'Creer mon compte'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <div className="text-center text-sm text-gray-600">
            <p>Vous avez deja un compte ?</p>
            <button
              onClick={() => { window.location.href = '/Auth'; }}
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              Se connecter
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
