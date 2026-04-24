import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Store, Zap, Shield, Headphones, ArrowRight, Phone, Mail, MapPin, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function LandingPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState(null);
  const [formData, setFormData] = useState({
    nom_commercial: '',
    nom_contact: '',
    prenom_contact: '',
    email: '',
    telephone: '',
    adresse: '',
    type_commerce: '',
    souhaite_parametrage: false,
    message: '',
  });

  const { data: config } = useQuery({
    queryKey: ['siteConfig'],
    queryFn: async () => {
      const configs = await appClient.entities.SiteConfig.list();
      return configs[0] || {
        prix_abonnement: 69,
        prix_parametrage: 299,
        duree_essai: 15,
        offre_active: false,
        contact_email: 'contact@strasyk.fr',
        contact_telephone: '+33 1 23 45 67 89',
        contact_adresse: '123 Avenue de la République, 75011 Paris',
      };
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: (data) => appClient.entities.InscriptionRequest.create(data),
    onSuccess: () => {
      setSuccessDialog(true);
      setShowForm(false);
      setFormData({
        nom_commercial: '',
        nom_contact: '',
        prenom_contact: '',
        email: '',
        telephone: '',
        adresse: '',
        type_commerce: '',
        souhaite_parametrage: false,
        message: '',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer votre demande. Réessayez.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createRequestMutation.mutate({
      ...formData,
      formule_choisie: selectedFormula,
      statut: 'en_attente',
    });
  };

  const openForm = (formula) => {
    setSelectedFormula(formula);
    setShowForm(true);
  };

  const prixAbonnement = config?.prix_abonnement || 69;
  const prixParametrage = config?.prix_parametrage || 299;
  const dureeEssai = config?.duree_essai || 15;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="/strasyk-logo.svg" 
              alt="Strasyk" 
              className="h-24"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.href = createPageUrl('Accueil')} className="border-cyan-500 text-cyan-600 hover:bg-cyan-50">
              Accéder à mon espace
            </Button>
            <Button onClick={() => openForm('essai')} className="bg-gradient-to-r from-cyan-500 to-blue-600">
              Essai Gratuit
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-extrabold text-gray-900 mb-6">
          La Caisse Enregistreuse <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
            Pensée pour Vous
          </span>
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Solution complète pour restaurants, pizzerias et commerces de proximité. 
          Gestion des commandes, livraisons, stocks et fidélité en un seul outil.
        </p>
        {config?.offres_promotionnelles && config.offres_promotionnelles.length > 0 && (
          <div className="mb-8 space-y-3">
            {config.offres_promotionnelles
              .filter(offre => offre.active)
              .map((offre, index) => (
                <div key={index} className="inline-block bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-400 rounded-lg px-6 py-3 shadow-lg mx-2">
                  {offre.image_url && (
                    <img src={offre.image_url} alt={offre.titre} className="h-12 w-auto inline-block mr-3 rounded" />
                  )}
                  <span className="text-orange-900 font-bold text-lg">
                    🎉 {offre.titre} - {offre.description}
                    {offre.reduction > 0 && ` (-${offre.reduction}%)`}
                  </span>
                </div>
              ))}
          </div>
        )}
        <div className="flex gap-4 justify-center">
          <Button size="lg" onClick={() => openForm('essai')} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-lg px-8 py-6">
            Essayer {dureeEssai} jours gratuitement
            <ArrowRight className="ml-2" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => openForm('abonnement')} className="text-lg px-8 py-6 border-cyan-500 text-cyan-600 hover:bg-cyan-50">
            Voir les tarifs
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">Tout ce dont vous avez besoin</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <Zap className="w-8 h-8" />, title: 'Rapide et Intuitif', desc: 'Interface tactile optimisée pour la vitesse' },
            { icon: <Store className="w-8 h-8" />, title: 'Gestion Complète', desc: 'Commandes, livraisons, stocks, tout en un' },
            { icon: <Shield className="w-8 h-8" />, title: 'Données Sécurisées', desc: 'Sauvegarde automatique dans le cloud' },
            { icon: <Headphones className="w-8 h-8" />, title: 'Support Dédié', desc: 'Assistance technique disponible' },
          ].map((feature, i) => (
          <Card key={i} className="border-2 hover:border-cyan-500 transition">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4 text-cyan-600">
                  {feature.icon}
                </div>
                <h4 className="font-bold text-lg mb-2">{feature.title}</h4>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Matériel */}
      {config?.materiel_visible && config?.materiel_offres?.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16 bg-gray-50">
          <h3 className="text-3xl font-bold text-center mb-4">Matériel de Caisse</h3>
          <p className="text-center text-gray-600 mb-12">Équipez-vous avec du matériel professionnel</p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {config.materiel_offres.map((materiel, i) => (
              <Card key={i} className="border-2 hover:shadow-xl transition overflow-hidden">
                {materiel.image_url && (
                  <div className="w-full h-48 overflow-hidden bg-gray-100">
                    <img 
                      src={materiel.image_url} 
                      alt={materiel.nom}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{materiel.nom}</CardTitle>
                  <CardDescription>{materiel.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold mb-6">
                    {materiel.prix > 0 ? `${materiel.prix}€` : 'Sur devis'}
                  </div>
                  <ul className="space-y-3 mb-6">
                    {materiel.items?.map((item, j) => (
                      <li key={j} className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-green-500" />
                        <span className="text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="w-full" onClick={() => openForm('abonnement')}>
                    Demander un devis
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Pricing */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">Tarifs Simples et Transparents</h3>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Essai */}
          <Card className="border-2 hover:shadow-xl transition">
            <CardHeader>
              <CardTitle>Essai Gratuit</CardTitle>
              <CardDescription>{dureeEssai} jours sans engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-6">0€</div>
              <ul className="space-y-3 mb-6">
                {['Toutes les fonctionnalités', 'Support par email', 'Sans carte bancaire'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => openForm('essai')}>
                Commencer l'essai
              </Button>
            </CardContent>
          </Card>

          {/* Abonnement */}
          <Card className="border-4 border-cyan-500 shadow-2xl relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold">
              POPULAIRE
            </div>
            <CardHeader>
              <CardTitle>Abonnement Mensuel</CardTitle>
              <CardDescription>Pour commerces établis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-1">{prixAbonnement}€<span className="text-lg text-gray-600">/mois</span></div>
              <p className="text-sm text-gray-600 mb-6">Sans engagement</p>
              <ul className="space-y-3 mb-6">
                {['Toutes les fonctionnalités', 'Support prioritaire', 'Mises à jour incluses', 'Multi-utilisateurs'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700" onClick={() => openForm('abonnement')}>
                S'abonner maintenant
              </Button>
            </CardContent>
          </Card>

          {/* Setup */}
          <Card className="border-2 hover:shadow-xl transition">
            <CardHeader>
              <CardTitle>Paramétrage Complet</CardTitle>
              <CardDescription>Installation clé en main</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-6">{prixParametrage}€<span className="text-lg text-gray-600"> unique</span></div>
              <ul className="space-y-3 mb-6">
                {['Configuration complète', 'Import de vos produits', 'Formation incluse', 'Assistance démarrage'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" onClick={() => {
                setFormData(prev => ({ ...prev, souhaite_parametrage: true }));
                openForm('abonnement_plus_setup');
              }}>
                Demander un devis
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-4xl font-bold mb-6">Prêt à moderniser votre commerce ?</h3>
          <p className="text-xl mb-8 opacity-90">Rejoignez les commerces qui nous font confiance</p>
          <Button size="lg" variant="secondary" onClick={() => openForm('essai')} className="text-lg px-8 py-6">
            Démarrer maintenant
            <ChevronRight className="ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-8">
          <div>
            <img 
              src="/strasyk-logo.svg" 
              alt="Strasyk" 
              className="h-20 mb-3 brightness-0 invert"
            />
            <p className="text-sm">La solution de caisse pensée pour les commerçants</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Contact</h4>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4" /> 
                {config?.contact_email || 'contact@strasyk.fr'}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4" /> 
                {config?.contact_telephone || '+33 1 23 45 67 89'}
              </p>
              {config?.contact_adresse && (
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> 
                  {config.contact_adresse}
                </p>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Légal</h4>
            <div className="space-y-2 text-sm">
              <p>Mentions légales</p>
              <p>CGV</p>
              <p>Politique de confidentialité</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedFormula === 'essai' ? 'Démarrer votre essai gratuit' : 'Demande d\'abonnement'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nom *</Label>
                <Input required value={formData.nom_contact} onChange={(e) => setFormData({ ...formData, nom_contact: e.target.value })} />
              </div>
              <div>
                <Label>Prénom *</Label>
                <Input required value={formData.prenom_contact} onChange={(e) => setFormData({ ...formData, prenom_contact: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Nom du commerce *</Label>
              <Input required value={formData.nom_commercial} onChange={(e) => setFormData({ ...formData, nom_commercial: e.target.value })} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Email *</Label>
                <Input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label>Téléphone *</Label>
                <Input type="tel" required value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Adresse du commerce</Label>
              <Input value={formData.adresse} onChange={(e) => setFormData({ ...formData, adresse: e.target.value })} />
            </div>
            <div>
              <Label>Type de commerce</Label>
              <Input placeholder="Restaurant, Pizzeria, Boulangerie..." value={formData.type_commerce} onChange={(e) => setFormData({ ...formData, type_commerce: e.target.value })} />
            </div>

            <div className="border-2 border-cyan-200 rounded-lg p-4 bg-cyan-50 space-y-3">
              <Label className="text-lg font-semibold text-cyan-900">Formule souhaitée *</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border-2 hover:border-cyan-400 transition cursor-pointer">
                  <input
                    type="radio"
                    id="formule_essai"
                    name="formule"
                    value="essai"
                    checked={selectedFormula === 'essai'}
                    onChange={(e) => setSelectedFormula(e.target.value)}
                    className="w-5 h-5 text-cyan-600"
                    required
                  />
                  <Label htmlFor="formule_essai" className="cursor-pointer flex-1">
                    <div className="font-semibold text-gray-900">Essai gratuit {dureeEssai} jours</div>
                    <div className="text-sm text-gray-600">Testez toutes les fonctionnalités sans engagement</div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border-2 hover:border-cyan-400 transition cursor-pointer">
                  <input
                    type="radio"
                    id="formule_abonnement"
                    name="formule"
                    value="abonnement"
                    checked={selectedFormula === 'abonnement'}
                    onChange={(e) => setSelectedFormula(e.target.value)}
                    className="w-5 h-5 text-cyan-600"
                  />
                  <Label htmlFor="formule_abonnement" className="cursor-pointer flex-1">
                    <div className="font-semibold text-gray-900">Abonnement mensuel - {prixAbonnement}€/mois</div>
                    <div className="text-sm text-gray-600">Sans engagement, résiliable à tout moment</div>
                  </Label>
                </div>
              </div>
            </div>

            {selectedFormula === 'abonnement' && (
              <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <input
                  type="checkbox"
                  id="parametrage"
                  checked={formData.souhaite_parametrage}
                  onChange={(e) => setFormData({ ...formData, souhaite_parametrage: e.target.checked })}
                  className="w-5 h-5 text-orange-600"
                />
                <Label htmlFor="parametrage" className="cursor-pointer flex-1">
                  <div className="font-semibold text-orange-900">Paramétrage complet (+{prixParametrage}€)</div>
                  <div className="text-sm text-orange-700">Configuration clé en main + formation incluse</div>
                </Label>
              </div>
            )}

            <div>
              <Label>Message (optionnel)</Label>
              <Textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={createRequestMutation.isPending}>
              {createRequestMutation.isPending ? 'Envoi en cours...' : 'Envoyer ma demande'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-6 h-6" />
              Demande envoyée !
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Merci pour votre demande ! Nous vous recontacterons très rapidement.</p>
            <p className="text-sm text-gray-600">
              Vous recevrez un email de confirmation avec toutes les informations nécessaires.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

