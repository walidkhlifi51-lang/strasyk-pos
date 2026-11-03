# Correctifs frontend revendeurs M1

## Changements limites

- Projections de commissions/paiements alignees sur le schema existant et partagees
  entre la page plateforme et le client generique. Aucun changement SQL.
- Une erreur auxiliaire conserve la liste des revendeurs et affiche la section
  indisponible avec un code controle ; aucun message SQL ou payload brut.
- Si la lecture des revendeurs elle-meme echoue, l'interface affiche explicitement
  une indisponibilite, et non une fausse liste vide. Boutons de relecture uniquement.
- Un revendeur actif est dirige vers ResellerPortal une fois son contexte serveur
  resolu. Le garde POS reste present ; les acces plateforme, les permissions M1 et
  l'etat des comptes suspendus sont inchanges.

## Validation automatique avant publication

51 tests reussis, dont 18 regressions du chargeur reel de la page et des gardes de
navigation. L'inspection des projections utilise leur structure reelle, sans
dependre du nom de declaration different entre dev et main. Aucune assertion
fonctionnelle retiree. Lint des cinq sources modifiees : zero erreur/avertissement.
Compilation Vite reussie sur une copie isolee de main, sans travaux dev annexes.

Ces tests utilisent un transport fictif en memoire : aucun utilisateur Auth,
commerce, commande, client ou rattachement reel n'est cree/modifie. La publication
ne comprend ni migration ni outil operateur, secret, export ou diagnostic prive.

## Verification manuelle sur https://pos.strasyk.com

1. Avec l'administrateur existant : ouvrir Revendeurs, verifier la liste, les
   rattachements et le maintien des acces admin habituels. Ne rien creer/modifier.
2. Avec le membre revendeur actif existant : se connecter normalement et verifier
   l'arrivee sur ResellerPortal. Consulter uniquement la fiche commerciale minimale.
3. Ouvrir directement une route POS/Clients/Statistiques : aucune donnee restaurant
   ne doit etre rendue au revendeur ; retour vers le portail attendu.
4. Verifier rechargement et deconnexion ; aucune reutilisation des donnees du
   compte precedent. Le renouvellement Auth reel reste a observer avec la session.
5. Ne pas reactiver le membre suspendu, creer de compte ou modifier ses liens pour
   finir un scenario. Un compte sans session Auth reste non teste.

L'indisponibilite des commissions/paiements est couverte par les tests automatises
sans provoquer de panne ni changer de droits sur Supabase. Ne pas simuler une
panne en modifiant la base ou les RLS.

Aucun M2, changement de permissions serveur ou correction de delivery_app_action
n'est inclus. Les controles anonymes apres deploiement ne remplacent pas un login
reel et ne valident pas toute l'isolation RLS historique.
