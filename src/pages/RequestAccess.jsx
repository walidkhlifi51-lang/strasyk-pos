import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { buildAbsoluteAppUrl } from '@/lib/appUrls';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { CheckCircle, Clock3, Store, XCircle } from 'lucide-react';

const normalizeEmail = (value) => (value || '').trim().toLowerCase();
const LAST_REQUEST_EMAIL_KEY = 'last_inscription_email_v1';
const DELIVERY_PERSON_FIELDS = ['id', 'user_email'];
const REQUEST_ACCESS_FIELDS = ['id', 'email', 'statut', 'nom_commercial', 'nom_contact', 'prenom_contact', 'telephone', 'adresse', 'type_commerce', 'message', 'created_date'];
const TENANT_ACCESS_FIELDS = ['id', 'owner_email'];
const USER_ACCESS_FIELDS = ['id', 'user_email', 'is_active'];
const PLATFORM_ADMIN_FIELDS = ['id', 'user_email', 'is_active'];
const RESELLER_USER_ACCESS_FIELDS = ['id', 'user_email', 'status'];
const isAlreadyRegisteredError = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes('already registered')
    || message.includes('already been registered')
    || message.includes('user already registered');
};
const getRequestMode = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('kind') === 'reseller' ? 'reseller' : 'commerce';
};

const buildRequestPayload = (formData, email, requestMode) => ({
  nom_commercial: formData.nom_commercial,
  nom_contact: formData.nom_contact,
  prenom_contact: formData.prenom_contact,
  telephone: formData.telephone,
  adresse: formData.adresse,
  type_commerce: formData.type_commerce,
  message: formData.message,
  email,
  formule_choisie: requestMode === 'reseller' ? 'revendeur' : 'abonnement',
  statut: 'en_attente',
});

export default function RequestAccess() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const requestMode = getRequestMode();
  const isResellerMode = requestMode === 'reseller';
  const latestLoadIdRef = useRef(0);
  const lastAppliedLoadIdRef = useRef(0);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeliveryPerson, setIsDeliveryPerson] = useState(false);
  const [screenState, setScreenState] = useState('form');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    nom_commercial: '',
    nom_contact: '',
    prenom_contact: '',
    telephone: '',
    adresse: '',
    type_commerce: '',
    message: '',
  });

  const createRequestMutation = useMutation({
    mutationFn: (data) => appClient.entities.InscriptionRequest.create(data),
    onSuccess: (_, variables) => {
      const requestEmail = normalizeEmail(variables?.email || user?.email || formData.email);
      localStorage.setItem(LAST_REQUEST_EMAIL_KEY, requestEmail);
      setScreenState('pending');
      toast({
        title: 'Demande envoyee',
        description: isResellerMode
          ? 'Votre demande revendeur a bien ete transmise et attend votre validation admin.'
          : "Votre demande d'ouverture a bien ete transmise et attend votre validation admin.",
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || "Impossible d'envoyer votre demande",
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    let isMounted = true;

    const loadState = async () => {
      const loadId = latestLoadIdRef.current + 1;
      latestLoadIdRef.current = loadId;

      const applyState = (callback) => {
        if (!isMounted || loadId < lastAppliedLoadIdRef.current) return false;
        lastAppliedLoadIdRef.current = loadId;
        callback();
        return true;
      };

      try {
        const currentUser = await appClient.auth.me();
        const lastRequestEmail = localStorage.getItem(LAST_REQUEST_EMAIL_KEY);

        if (!currentUser?.email) {
          applyState(() => {
            setUser(null);
            setIsDeliveryPerson(false);
            if (lastRequestEmail) {
              setFormData((prev) => ({
                ...prev,
                email: lastRequestEmail,
              }));
            }
            setScreenState('form');
          });
          return;
        }

        const userEmail = normalizeEmail(currentUser.email);
        if (!applyState(() => {
          setUser(currentUser);
          setIsDeliveryPerson(false);
        })) {
          return;
        }

        const deliveryPersons = await appClient.entities.DeliveryPerson.filter(
          { user_email: currentUser.email },
          undefined,
          5,
          { fields: DELIVERY_PERSON_FIELDS }
        );

        if (deliveryPersons.length > 0) {
          applyState(() => {
            setIsDeliveryPerson(true);
          });
          return;
        }

        const [requestsResult, ownedTenantsResult, userAccessResult, platformAdminResult, resellerUserResult] = await Promise.allSettled([
          appClient.entities.InscriptionRequest.filter({ email: currentUser.email }, '-created_date', 20, { fields: REQUEST_ACCESS_FIELDS }),
          appClient.entities.Tenant.filter({ owner_email: currentUser.email }, '-created_date', 10, { fields: TENANT_ACCESS_FIELDS }),
          appClient.entities.UserAccess.filter({ user_email: currentUser.email, is_active: true }, '-created_date', 20, { fields: USER_ACCESS_FIELDS }),
          appClient.entities.PlatformAdminAccess.filter({ user_email: currentUser.email, is_active: true }, '-created_date', 10, { fields: PLATFORM_ADMIN_FIELDS }),
          appClient.entities.ResellerUser.filter({ user_email: currentUser.email, status: 'active' }, '-created_date', 20, { fields: RESELLER_USER_ACCESS_FIELDS }),
        ]);

        const requests = requestsResult.status === 'fulfilled'
          ? requestsResult.value.filter((request) => normalizeEmail(request.email) === userEmail)
          : [];
        const ownedTenants = ownedTenantsResult.status === 'fulfilled'
          ? ownedTenantsResult.value.filter((tenant) => normalizeEmail(tenant.owner_email) === userEmail)
          : [];
        const userAccesses = userAccessResult.status === 'fulfilled'
          ? userAccessResult.value.filter((access) => normalizeEmail(access.user_email) === userEmail && access.is_active === true)
          : [];
        const platformAdminEntries = platformAdminResult.status === 'fulfilled'
          ? platformAdminResult.value.filter((entry) => normalizeEmail(entry.user_email) === userEmail && entry.is_active === true)
          : [];
        const resellerUserEntries = resellerUserResult.status === 'fulfilled'
          ? resellerUserResult.value.filter((entry) => normalizeEmail(entry.user_email) === userEmail && entry.status === 'active')
          : [];

        const hasActiveAccess = ownedTenants.length > 0 || userAccesses.length > 0 || platformAdminEntries.length > 0 || resellerUserEntries.length > 0;
        if (hasActiveAccess) {
          applyState(() => {
            setScreenState('session_active');
          });
          return;
        }

        const sortedRequests = [...requests]
          .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime());
        const acceptedRequest = sortedRequests.find((request) => request.statut === 'accepte');
        const pendingRequest = sortedRequests.find((request) => request.statut === 'en_attente');
        const refusedRequest = sortedRequests.find((request) => request.statut === 'refuse');
        const latestRequest = acceptedRequest || pendingRequest || refusedRequest || sortedRequests[0];

        if (latestRequest?.statut === 'en_attente') {
          applyState(() => {
            setFormData((prev) => ({
              ...prev,
              nom_commercial: latestRequest.nom_commercial || prev.nom_commercial,
              nom_contact: latestRequest.nom_contact || prev.nom_contact,
              prenom_contact: latestRequest.prenom_contact || prev.prenom_contact,
              telephone: latestRequest.telephone || prev.telephone,
              adresse: latestRequest.adresse || prev.adresse,
              type_commerce: latestRequest.type_commerce || prev.type_commerce,
              message: latestRequest.message || prev.message,
              email: latestRequest.email || prev.email,
            }));
            setScreenState('pending');
          });
          return;
        }

        if (latestRequest?.statut === 'accepte') {
          applyState(() => {
            setScreenState('approved');
          });
          return;
        }

        if (latestRequest?.statut === 'refuse') {
          applyState(() => {
            setFormData((prev) => ({
              ...prev,
              nom_commercial: latestRequest.nom_commercial || prev.nom_commercial,
              nom_contact: latestRequest.nom_contact || prev.nom_contact,
              prenom_contact: latestRequest.prenom_contact || prev.prenom_contact,
              telephone: latestRequest.telephone || prev.telephone,
              adresse: latestRequest.adresse || prev.adresse,
              type_commerce: latestRequest.type_commerce || prev.type_commerce,
              message: latestRequest.message || prev.message,
              email: latestRequest.email || prev.email,
            }));
            setScreenState('refused');
          });
          return;
        }

        applyState(() => {
          setScreenState('form');
        });
      } catch (error) {
        applyState(() => {
          setScreenState('form');
        });
      } finally {
        if (isMounted && loadId >= lastAppliedLoadIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadState();
    const intervalId = window.setInterval(loadState, 120000);
    const handleFocus = () => { loadState(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadState();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const requestEmail = normalizeEmail(user?.email || formData.email);

    try {
      setIsSubmitting(true);
      if (!requestEmail) {
        toast({
          title: 'Email requis',
          description: 'Renseignez votre email.',
          variant: 'destructive',
        });
        return;
      }

      if (!user) {
        if (!formData.password || formData.password.length < 6) {
          toast({
            title: 'Mot de passe requis',
            description: 'Choisissez un mot de passe d au moins 6 caracteres.',
            variant: 'destructive',
          });
          return;
        }

        if (formData.password !== formData.passwordConfirm) {
          toast({
            title: 'Confirmation invalide',
            description: 'Les mots de passe ne correspondent pas.',
            variant: 'destructive',
          });
          return;
        }

        try {
          await appClient.auth.signup({
            email: requestEmail,
            password: formData.password,
            full_name: [formData.prenom_contact, formData.nom_contact].filter(Boolean).join(' ').trim(),
            redirectTo: buildAbsoluteAppUrl('/Auth'),
          });
        } catch (signupError) {
          if (!isAlreadyRegisteredError(signupError)) {
            throw signupError;
          }
        }
      }

      await createRequestMutation.mutateAsync(buildRequestPayload(formData, requestEmail, requestMode));
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de creer et envoyer la demande.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (isDeliveryPerson) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-center text-2xl">Compte livreur detecte</CardTitle>
            <CardDescription className="text-center">
              {isResellerMode
                ? "Cette page est reservee aux demandes revendeurs. Votre compte est configure comme livreur."
                : "Cette page est reservee a l'ouverture d'un commerce. Votre compte est configure comme livreur."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 text-center mb-4">
              Utilisez l'application livreur ou contactez votre responsable si besoin.
            </p>
            <Button onClick={() => { navigate('/Dashboard'); }} className="w-full">
              Ouvrir l'application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screenState === 'session_active') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-orange-700" />
            </div>
            <CardTitle className="text-center text-2xl">Session deja active</CardTitle>
            <CardDescription className="text-center">
              {isResellerMode
                ? 'Cette page sert a demander un acces revendeur. Le compte actuellement connecte a deja un acces existant.'
                : 'Cette page sert a ouvrir un nouveau commerce. Le compte actuellement connecte a deja un acces existant.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-orange-50 p-3 text-sm text-orange-900">
              Session detectee : <strong>{user?.email}</strong>
            </div>
            <Button
              onClick={async () => {
                await appClient.auth.logout();
                navigate(createPageUrl('RequestAccess'), { replace: true });
              }}
              className="w-full"
            >
              Se deconnecter pour creer une nouvelle demande
            </Button>
            <Button variant="ghost" onClick={() => { navigate(createPageUrl('Auth')); }} className="w-full">
              Accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screenState === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock3 className="w-8 h-8 text-amber-600" />
            </div>
            <CardTitle className="text-center text-2xl">Demande en attente</CardTitle>
            <CardDescription className="text-center">
              {isResellerMode
                ? 'Votre demande revendeur a bien ete recue. Elle attend maintenant votre validation admin.'
                : 'Votre demande a bien ete recue. Elle attend maintenant votre validation admin.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-amber-50 p-3 text-center text-sm text-amber-900">
              Email : <strong>{user?.email || formData.email}</strong>
            </div>
            <p className="text-sm text-gray-600 text-center">
              Vous serez valide manuellement apres verification et traitement de votre dossier.
            </p>
            <Button variant="ghost" onClick={() => { navigate(createPageUrl('Auth')); }} className="w-full">
              Accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screenState === 'approved') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-center text-2xl">Demande validee</CardTitle>
            <CardDescription className="text-center">
              {isResellerMode
                ? 'Votre demande revendeur a ete acceptee. Reconnectez-vous si besoin pour entrer dans votre espace.'
                : 'Votre ouverture a ete acceptee. Reconnectez-vous si besoin pour entrer dans votre espace.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => { navigate('/', { replace: true }); }} className="w-full">
              Ouvrir le tableau de bord
            </Button>
            <Button variant="outline" onClick={() => { navigate(0); }} className="w-full">
              Recharger
            </Button>
            <Button variant="ghost" onClick={() => { navigate(createPageUrl('Auth')); }} className="w-full">
              Accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (screenState === 'refused') {
    return (
      <>
        <Toaster />
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-center text-2xl">Demande a revoir</CardTitle>
              <CardDescription className="text-center">
                {isResellerMode
                  ? 'Votre precedente demande revendeur n a pas ete retenue. Vous pouvez en envoyer une nouvelle.'
                  : 'Votre precedente demande n a pas ete retenue. Vous pouvez en envoyer une nouvelle.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex justify-end">
                <Button variant="ghost" type="button" onClick={() => { navigate(createPageUrl('Auth')); }}>
                  Accueil
                </Button>
              </div>
              <RequestForm
                user={user}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                loading={createRequestMutation.isPending || isSubmitting}
                submitLabel={isResellerMode ? 'Renvoyer ma demande revendeur' : 'Renvoyer ma demande d ouverture'}
                requestMode={requestMode}
              />
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster />
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-orange-600" />
            </div>
            <CardTitle className="text-center text-2xl">
              {isResellerMode ? 'Devenir revendeur' : 'Ouvrir mon commerce'}
            </CardTitle>
            <CardDescription className="text-center">
              {isResellerMode
                ? 'Cette page est reservee aux partenaires revendeurs. Remplissez ce formulaire pour demander votre acces revendeur.'
                : 'Cette page est reservee aux nouveaux commercants. Remplissez ce formulaire pour demander l ouverture de votre commerce.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex justify-end">
              <Button variant="ghost" type="button" onClick={() => { navigate(createPageUrl('Auth')); }}>
                Accueil
              </Button>
            </div>
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-medium text-orange-900">
                {isResellerMode
                  ? 'Votre demande revendeur sera envoyee immediatement a l administration. La validation reste manuelle pour controler le dossier.'
                  : 'Votre demande sera envoyee immediatement a l administration. La validation du commerce reste manuelle pour controler le dossier et les paiements.'}
              </p>
            </div>

            <RequestForm
              user={user}
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              loading={createRequestMutation.isPending || isSubmitting}
              submitLabel={isResellerMode ? 'Envoyer ma demande revendeur' : 'Envoyer ma demande d ouverture'}
              requestMode={requestMode}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function RequestForm({ user, formData, setFormData, onSubmit, loading, submitLabel, requestMode }) {
  const isResellerMode = requestMode === 'reseller';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Nom *</Label>
          <Input
            required
            value={formData.nom_contact}
            onChange={(e) => setFormData({ ...formData, nom_contact: e.target.value })}
          />
        </div>
        <div>
          <Label>Prenom *</Label>
          <Input
            required
            value={formData.prenom_contact}
            onChange={(e) => setFormData({ ...formData, prenom_contact: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label>Email *</Label>
        <Input
          type="email"
          value={user?.email || formData.email}
          disabled={!!user}
          className={user ? 'bg-gray-100' : ''}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>

      {!user && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Mot de passe *</Label>
            <Input
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Au moins 6 caracteres"
            />
          </div>
          <div>
            <Label>Confirmation *</Label>
            <Input
              type="password"
              required
              minLength={6}
              value={formData.passwordConfirm}
              onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
              placeholder="Retapez le mot de passe"
            />
          </div>
        </div>
      )}

      <div>
        <Label>{isResellerMode ? 'Nom du revendeur / societe *' : 'Nom du commerce *'}</Label>
        <Input
          required
          placeholder={isResellerMode ? 'Ex: Partner Paris Nord' : 'Pizza Roma, Boulangerie Martin...'}
          value={formData.nom_commercial}
          onChange={(e) => setFormData({ ...formData, nom_commercial: e.target.value })}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Telephone *</Label>
          <Input
            type="tel"
            required
            placeholder="01 23 45 67 89"
            value={formData.telephone}
            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
          />
        </div>
        <div>
          <Label>{isResellerMode ? "Type d'activite" : 'Type de commerce'}</Label>
          <Input
            placeholder={isResellerMode ? 'Revendeur, white label, integrateur...' : 'Restaurant, Pizzeria...'}
            value={formData.type_commerce}
            onChange={(e) => setFormData({ ...formData, type_commerce: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label>{isResellerMode ? 'Adresse de la societe' : 'Adresse du commerce'}</Label>
        <Input
          placeholder="12 rue de la Paix, 75001 Paris"
          value={formData.adresse}
          onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
        />
      </div>

      <div>
        <Label>Message (optionnel)</Label>
        <Textarea
          placeholder={isResellerMode ? 'Zone d intervention, portefeuille clients, informations complementaires...' : 'Informations complementaires...'}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          rows={3}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-orange-500 to-red-500"
        disabled={loading}
      >
        {loading ? 'Traitement en cours...' : submitLabel}
      </Button>
    </form>
  );
}
