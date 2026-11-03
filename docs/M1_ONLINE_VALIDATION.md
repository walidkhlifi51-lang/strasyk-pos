# M1 : validation sur pos.strasyk.com

Le SQL M1 est deja applique. Cette publication ne contient que le frontend
compatible, ses tests locaux et ce protocole ; aucune migration automatique.

## Changements

- Identite et liste des commerces via strasyk_get_identity_context ; absence de
  repli sur user_metadata, email ou une lecture globale de tenants.
- Selection autorisee via strasyk_select_tenant ; refus si des operations hors
  ligne attendent, puis invalidation du cache du commerce precedent.
- Portail distributeur via strasyk_get_reseller_portal, fiche minimale et actions
  fermees par defaut selon le contrat serveur. Aucun CRUD direct de remplacement.
- Droits administrateur techniques derives du contexte serveur, pas du role JWT.
- Cache vide au changement de compte. Relecture Auth differee par setTimeout,
  annulee apres deconnexion/demontage, pour sortir du callback SDK avant les appels.
- Projections revendeurs sans company_name, non disponible dans le schema.

## Verification automatique de cette publication

33 tests locaux : 19 identite, 10 permissions/actions revendeurs, 4 evenements Auth.
Lint cible et compilation de la copie exacte de publication ; aucun compte reel
utilise par ces tests et aucune donnee Supabase modifiee.

Les tests en memoire ne valident pas le login HTTP reel, les RLS historiques ou
l'ensemble des parcours POS/borne/livraison/impression. Le suivi de deploiement et
le controle anonyme de la page Auth doivent preciser la revision effectivement vue.

## Tests manuels avec comptes existants

Ne creer aucun compte ni modifier les permissions pour simuler un profil absent.
Un profil indisponible est NON COUVERT. Ne pas fournir de token, mot de passe,
capture contenant des donnees clients ou export de session dans un rapport.

1. Admin STRASYK : ouvrir https://pos.strasyk.com/Auth, connecter le compte existant.
   Verifier Admin Commerces et Revendeurs, sans creer, activer ou suspendre de fiche.
   En cas d'ecran de chargement persistant, relever uniquement la route, la duree
   et le code HTTP/RPC depuis les outils navigateur, sans en-tetes Authorization.
2. Persistance : recharger la page, puis naviguer entre les vues admin. Verifier
   que l'identite et les droits restent coherents. Le refresh automatique doit
   etre confirme au renouvellement de session ; un simple reload ne le prouve pas.
3. Commercant : connecter un proprietaire existant, verifier son commerce courant,
   les vues de consultation et l'absence d'acces plateforme induit par son role.
   Ne pas creer de commande, encaissement, cloture ou modification de catalogue.
4. Salarie : compte existant seulement ; menus et lectures conformes aux droits
   reels. Aucun elargissement de permissions pour finir un test.
5. Revendeur STANDARD / WHITE LABEL : portefeuille des seuls commerces rattaches,
   aucune commande, client, caisse, statistique restaurant ou configuration POS.
   Pas de commission/facture sans autorisation serveur explicite. Les actions
   commerciales restent fermees en M1. Le type WHITE LABEL ne donne aucun droit POS.
6. Multi-commerce : si un compte a deja plusieurs appartenances, verifier le
   selecteur et les commerces proposes. Un changement volontaire par l'utilisateur
   doit recharger le contexte et ne pas conserver les donnees du commerce precedent.
   Cette action actualise une preference Auth, pas les donnees metier. Ne pas
   l'effectuer avec une file d'operations hors ligne en attente.
7. Deconnexion : verifier le retour a Auth et l'absence de donnees precedentes
   visibles lors de la connexion d'un autre compte dans le meme navigateur.

## Limites maintenues

Les anciennes politiques RLS et delivery_app_action restent hors M1. Aucun M2,
changement de schema, suppression de donnees, creation Auth ou integration nouvelle
n'est inclus. Ne pas rejouer une migration depuis ce protocole.
