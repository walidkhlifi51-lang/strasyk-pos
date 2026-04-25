import React, { useEffect, useMemo, useState } from 'react';
import { appClient } from '@/api/appClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { APP_BACKEND_MODE } from '@/config/env';
import { buildAbsoluteAppUrl } from '@/lib/appUrls';
import { createPageUrl } from '@/utils';
import { ArrowRight, ShieldCheck, Sparkles, Store, Truck } from 'lucide-react';

const panels = [
  {
    icon: Store,
    title: 'Commerce',
    description: 'Catalogue, options, ventes et suivi du point de vente.',
    iconColor: 'text-orange-600',
    surface: 'bg-orange-50',
    border: 'border-orange-100',
  },
  {
    icon: Truck,
    title: 'Livraison',
    description: 'Affectation, preparation et traitement des commandes.',
    iconColor: 'text-teal-600',
    surface: 'bg-teal-50',
    border: 'border-teal-100',
  },
  {
    icon: ShieldCheck,
    title: 'Acces',
    description: 'Utilisateurs, permissions et exploitation quotidienne.',
    iconColor: 'text-rose-600',
    surface: 'bg-rose-50',
    border: 'border-rose-100',
  },
];

export default function Auth() {
  const { toast } = useToast();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const redirectTo = params.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  useEffect(() => {
    const checkRecoveryState = () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const recoveryFromHash = hashParams.get('type') === 'recovery';
      const recoveryFromQuery = params.get('type') === 'recovery';
      setRecoveryMode(recoveryFromHash || recoveryFromQuery);
    };

    checkRecoveryState();
    const unsubscribe = appClient.auth.onAuthStateChange?.((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setForgotMode(false);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [params]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Champs requis',
        description: 'Renseignez votre email et votre mot de passe.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      await appClient.auth.login({ email: normalizedEmail, password });
      window.location.assign(redirectTo);
    } catch (error) {
      toast({
        title: 'Connexion impossible',
        description: error.message || 'Identifiants invalides.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();

    if (!resetEmail) {
      toast({
        title: 'Email requis',
        description: 'Renseignez votre email pour recevoir le lien de reinitialisation.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await appClient.auth.requestPasswordReset({
        email: resetEmail.trim().toLowerCase(),
        redirectTo: buildAbsoluteAppUrl('/Auth'),
      });
      toast({
        title: 'Email envoye',
        description: 'Consultez votre boite mail pour definir un nouveau mot de passe.',
      });
      setForgotMode(false);
    } catch (error) {
      toast({
        title: 'Envoi impossible',
        description: error.message || 'Impossible d envoyer le lien de reinitialisation.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      toast({
        title: 'Mot de passe invalide',
        description: 'Choisissez un mot de passe d au moins 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Confirmation incorrecte',
        description: 'Les deux mots de passe ne correspondent pas.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await appClient.auth.updatePassword({ password: newPassword });
      toast({
        title: 'Mot de passe mis a jour',
        description: 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
      });
      setRecoveryMode(false);
      setNewPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, document.title, '/Auth');
    } catch (error) {
      toast({
        title: 'Mise a jour impossible',
        description: error.message || 'Impossible de definir le nouveau mot de passe.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const cardTitle = recoveryMode ? 'Nouveau mot de passe' : forgotMode ? 'Mot de passe oublie' : 'Connexion';
  const cardDescription = recoveryMode
    ? 'Definissez un nouveau mot de passe pour retrouver l acces a votre espace.'
    : forgotMode
      ? 'Renseignez votre email. Nous vous enverrons un lien de reinitialisation.'
      : 'Commercant, employe ou livreur avec un acces deja actif.';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(160deg,#fff7ed_0%,#ffffff_42%,#eefcf8_100%)] text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.20),transparent_30%)]" />
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(to_bottom,white,rgba(255,255,255,0.35))]" />

      <main className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_460px]">
          <section className="relative overflow-hidden rounded-lg border border-white/80 bg-white/72 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 lg:p-10">
            <div className="absolute left-0 top-0 h-32 w-32 rounded-br-[40px] bg-orange-100/70" />
            <div className="absolute bottom-0 right-0 h-40 w-40 rounded-tl-[48px] bg-teal-100/70" />

            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-3 rounded-lg border border-white/90 bg-white px-4 py-3 shadow-sm">
                  <img src="/strasyk-logo.svg" alt="Strasyk" className="h-10 w-auto" />
                  <div>
                    <div className="bg-[linear-gradient(90deg,#ea580c_0%,#0f172a_45%,#0f766e_100%)] bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
                      Strasyk POS
                    </div>
                    <p className="text-sm font-medium text-slate-600">
                      Caisse et gestion des commerces
                    </p>
                  </div>
                </div>

                <div className="max-w-xl space-y-4 xl:max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
                    <Sparkles className="h-4 w-4" />
                    Interface centralisee
                  </div>
                  <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl xl:text-6xl">
                    Pilotez votre activite sur une interface claire et moderne
                  </h1>
                  <p className="max-w-lg text-base leading-8 text-slate-700 sm:text-lg xl:max-w-xl">
                    Connectez-vous pour gerer la caisse, la livraison, les acces et le quotidien du commerce depuis un seul environnement.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {panels.map((panel) => (
                  <div key={panel.title} className={`rounded-lg border ${panel.border} bg-white p-4 shadow-sm`}>
                    <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${panel.surface}`}>
                      <panel.icon className={`h-5 w-5 ${panel.iconColor}`} />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{panel.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{panel.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center lg:justify-end">
            <Card className="w-full max-w-[460px] rounded-lg border-white/90 bg-white/94 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.08em] text-orange-600">
                    Espace client
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-950">{cardTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {cardDescription}
                  </p>
                </div>

                {recoveryMode ? (
                  <form onSubmit={handleUpdatePassword} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nouveau mot de passe</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nouveau mot de passe"
                        className="h-12 rounded-lg border-slate-300 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmation</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Retapez le mot de passe"
                        className="h-12 rounded-lg border-slate-300 bg-white"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="h-12 w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm hover:from-orange-600 hover:to-red-600"
                      disabled={loading}
                    >
                      {loading ? 'Enregistrement...' : 'Definir le mot de passe'}
                    </Button>
                  </form>
                ) : forgotMode ? (
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        className="h-12 rounded-lg border-slate-300 bg-white"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="h-12 w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm hover:from-orange-600 hover:to-red-600"
                      disabled={loading}
                    >
                      {loading ? 'Envoi...' : 'Envoyer le lien'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 w-full rounded-lg"
                      onClick={() => setForgotMode(false)}
                    >
                      Retour a la connexion
                    </Button>
                  </form>
                ) : (
                  <>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="vous@exemple.com"
                          className="h-12 rounded-lg border-slate-300 bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Mot de passe</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mot de passe"
                          className="h-12 rounded-lg border-slate-300 bg-white"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="h-12 w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm hover:from-orange-600 hover:to-red-600"
                        disabled={loading}
                      >
                        {loading ? 'Connexion...' : 'Se connecter'}
                      </Button>
                    </form>

                    <button
                      type="button"
                      className="mt-4 text-sm font-medium text-orange-600 hover:text-orange-700"
                      onClick={() => {
                        setForgotMode(true);
                        setResetEmail(email);
                      }}
                    >
                      Mot de passe oublie ?
                    </button>
                  </>
                )}

                <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Nouveau client</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Ouvrez votre demande de creation commerce. Le compte de connexion est prepare pendant la demande, puis l administrateur valide l ouverture.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 h-11 w-full rounded-lg border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                    onClick={() => { window.location.href = createPageUrl('RequestAccess'); }}
                  >
                    Creer un compte
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                {APP_BACKEND_MODE === 'local' && (
                  <p className="mt-4 text-xs text-slate-500">
                    Mode local actif. Cette page prendra tout son sens avec Supabase actif.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
