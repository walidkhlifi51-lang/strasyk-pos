# STRASYK POS - Supabase Test Provisioning Stage 2 Plan

Date: 2026-07-29
Statut: plan uniquement
Portee: provisioning en ecriture limitee, non execute dans cette phase

## 1. Objectif de l'etape 2

Mettre en place un provisioning idempotent minimal et strictement borne a un seul environnement de test sur le projet Supabase actuel, sans toucher aux trois tenants et aux six utilisateurs deja presents.

Cette etape devra couvrir uniquement:

- un seul utilisateur Auth de test;
- un seul tenant de test;
- un seul `restaurant_profile`;
- un seul `user_access`;
- un dataset canonique minimal pour tester les parcours commerciaux essentiels du POS.

## 2. Perimetre de donnees autorise

Le futur provisioning en ecriture devra pouvoir creer ou mettre a jour uniquement:

- `auth.users` pour le compte de test canonique
- `tenants`
- `restaurant_profiles`
- `user_access`
- `categories`
- `products`
- `ingredients`
- `product_ingredients`
- `option_groups`
- `option_items`
- `customers`
- `tables`
- `loyalty_rules`
- `cagnotte_rules`
- `delivery_people`
- `orders`

Hors perimetre de l'etape 2:

- `reseller_*`
- `tenant_invoices`
- `inscription_requests`
- `delivery_verification_logs`
- `cloture_caisse`
- `drawer_openings`
- `customer_display_cart`
- `offers`
- `promo_codes`
- `menu_formulas`
- `menu_formula_items`
- toute migration auto-appliquee
- toute suppression globale

## 3. Principe de securite central

Regle absolue:

- aucune ligne ne devra etre recherchee, modifiee ou supprimee uniquement a partir d'un nom visible, d'un email affiche, d'un libelle produit ou d'un identifiant metier non reserve au test.

Le futur script devra refuser toute modification d'une ligne qui ne porte pas une cle technique rattachee explicitement au provisioning STRASYK.

Consequence:

- les trois tenants existants doivent rester intacts;
- les six utilisateurs Auth existants doivent rester intacts;
- toute ligne non rattachee a une reference technique STRASYK de provisioning sera consideree hors perimetre et non modifiable.

## 4. Strategie de cles techniques stables

Chaque objet canonique devra etre relie a une cle technique stable du type:

- `strasyk-pos-test:user:owner`
- `strasyk-pos-test:tenant:canonical`
- `strasyk-pos-test:profile:restaurant`
- `strasyk-pos-test:category:pizzas`
- etc.

Regle:

- ces cles techniques seront la reference primaire de recherche et de verification;
- les noms visibles ne serviront qu'a la coherence humaine, jamais comme cle d'autorite;
- en l'absence d'une cle technique rattachee explicitement a l'objet, le script devra s'arreter ou creer un nouvel objet borne au tenant de test selon la strategie retenue.

## 5. Strategie de registre `provisioning_registry`

Le registre technique reste la strategie canonique recommandee.

Role attendu:

- mapper `seed_key -> record_id`
- porter `project_ref`, `tenant_id`, `entity_type`
- garantir l'idempotence
- permettre la detection d'incoherence
- permettre un futur rollback cible

Important pour l'etape 2:

- aucune creation de table ne doit encore etre executee tant que la migration n'est pas explicitement validee;
- le plan doit toutefois supposer qu'un registre versionne et lisible sera introduit avant ou au debut de l'ecriture reelle.

Si `provisioning_registry` n'existe pas encore au lancement effectif de l'etape 2:

- le script d'ecriture devra echouer proprement;
- il ne devra jamais basculer silencieusement sur une recherche par noms visibles.

## 6. Controles anti-impact sur les tenants existants

Avant toute ecriture, le futur script devra:

- verifier que le projet cible est exactement `sbugjsmzunpsnkdwnskj` pour cette phase;
- verifier que l'environnement logique est `stabilization-dev`;
- verifier que `tenants` contient deja `3` lignes avant creation du tenant de test;
- verifier que `auth.users` contient deja `6` utilisateurs avant creation du compte de test;
- verifier qu'aucun des trois tenants existants ne porte la cle technique du provisioning STRASYK;
- verifier qu'aucun utilisateur existant ne porte la cle technique du provisioning STRASYK;
- refuser toute operation si un objet deja present semble ambigu ou rattache a une donnee non technique.

## 7. Strategie de creation idempotente

### 7.1 Utilisateur Auth de test

Objet unique a creer:

- un seul utilisateur Auth owner de test

Regles:

- recherche d'abord par cle technique via registre
- si absent du registre: creation d'un utilisateur de test canonique
- confirmation email forcee cote admin
- mot de passe fourni uniquement par variable d'environnement securisee
- aucun mot de passe en log, en table metier ou en sortie terminal

### 7.2 Tenant de test

Objet unique a creer:

- un seul tenant de test canonique

Regles:

- creation uniquement si absent du registre
- verification stricte du marqueur technique `TEST` / `DEMO`
- refus si un tenant homonyme existe sans rattachement technique STRASYK

### 7.3 Restaurant profile

Objet unique a creer:

- un seul `restaurant_profile` lie au tenant de test

Regles:

- relation resolue par `tenant_id` issu du registre
- mise a jour uniquement si la ligne est rattachee a la cle technique du tenant de test

### 7.4 User access

Objet unique a creer:

- un seul `user_access` owner de test

Regles:

- creation uniquement pour le tenant de test
- role minimal necessaire aux parcours POS
- refus si une ligne existante non technique utilise deja le meme couple `tenant_id/user_email`

## 8. Dataset canonique minimal

Le dataset minimal vise a debloquer les parcours commerciaux essentiels:

- 4 categories
- 6 produits
- 3 ingredients de reference
- 2 groupes d'options
- 4 items d'options
- 5 clients
- 6 tables
- 1 regle `loyalty_rules`
- 1 regle `cagnotte_rules`
- 1 livreur
- 4 commandes de demonstration

Contraintes:

- tout doit appartenir au tenant de test;
- toute relation doit etre resolue a partir des cles techniques;
- aucune ligne existante hors registre ne doit etre reprise implicitement.

## 9. Ordre des operations prevu

Ordre strict recommande:

1. verifications d'environnement
2. verification du registre `provisioning_registry`
3. lecture des compteurs initiaux
4. verification des trois tenants existants et des six utilisateurs existants
5. creation ou resolution de l'utilisateur Auth de test
6. creation ou resolution du tenant de test
7. creation ou resolution du `restaurant_profile`
8. creation ou resolution du `user_access`
9. creation ou resolution du dataset minimal:
   - categories
   - products
   - ingredients
   - product_ingredients
   - option_groups
   - option_items
   - customers
   - tables
   - loyalty_rules
   - cagnotte_rules
   - delivery_people
   - orders
10. verification finale
11. preuve avant/apres

## 10. Rollback cible

Le rollback futur devra rester cible et borne uniquement aux objets rattaches techniquement au provisioning STRASYK.

Regles:

- aucune suppression globale
- aucun rollback sur un tenant non technique
- aucun rollback sur un utilisateur non technique
- aucune recherche de suppression par nom du restaurant ou email seul

Mecanisme attendu:

- lecture du registre
- suppression ou neutralisation uniquement des objets referencés par `seed_key`
- verification finale du nombre d'objets supprimes

Le rollback n'est pas execute dans cette phase et `test:reset` reste desactive.

## 11. Tests a prevoir pour l'etape 2

Tests de garde:

- refus si `provisioning_registry` absent
- refus si projet non autorise
- refus si environnement interdit
- refus si compteurs initiaux inattendus
- refus si un objet cible existe sans rattachement technique STRASYK

Tests d'idempotence:

- premier run: creation du tenant de test complet
- second run: aucune duplication
- troisieme run: zero ecriture si aucune derive

Tests de securite:

- aucune modification des trois tenants existants
- aucune modification des six utilisateurs existants
- refus si tentative de rapprochement par nom visible uniquement

Tests fonctionnels minimaux:

- connexion avec l'utilisateur de test
- chargement du tenant de test
- affichage du catalogue
- creation d'une commande
- encaissement sur les donnees de test

## 12. Preuves attendues avant / apres

Avant execution reelle:

- nombre d'utilisateurs Auth
- nombre de tenants
- nombre de `restaurant_profiles`
- compteurs des tables du provisioning canonique
- absence ou presence du registre

Apres execution reelle:

- delta du nombre d'utilisateurs Auth
- delta du nombre de tenants
- delta des tables canoniques
- liste des objets crees par `seed_key`
- preuve qu'aucun tenant existant n'a change
- preuve qu'aucun utilisateur existant n'a change

## 13. Risques a traiter avant execution

- `provisioning_registry` absent aujourd'hui
- certains objets visibles en base ne sont pas completement documentes dans le depot SQL
- `delivery_people.password` existe encore en base et devra etre ignore strictement
- `site_config` et `scratch_ticket_config` restent a analyser fonctionnellement mais sont hors perimetre de l'etape 2

## 14. Condition de demarrage de l'etape 2

L'ecriture reelle ne devra commencer que si:

- ce plan est valide;
- la strategie du registre est validee;
- la migration du registre est relue et approuvee separement;
- les commandes d'ecriture restent protegees jusqu'a validation finale;
- les garde-fous sur les tenants et utilisateurs existants sont testes.

## 15. Statut d'execution

Cette section decrit le resultat reel obtenu apres validation et execution des etapes 2B et 2C. Elle complete le plan initial sans remplacer les hypotheses et formulations au futur des sections precedentes.

Statut constate au 30 juillet 2026:

- migration `20260729143000_create_provisioning_registry.sql` appliquee;
- provisioning reel reussi;
- `30` objets enregistres dans `provisioning_registry`;
- compensation non declenchee;
- idempotence validee;
- `test:provision:dry-run` post-provisioning en no-op;
- `test:reset` toujours desactive;
- phase provisioning terminee.

Etat courant valide:

- utilisateurs Auth: `7`
- `tenants`: `4`
- `restaurant_profiles`: `4`
- `user_access`: `1`
- `provisioning_registry`: `30`
- `orders`: `142`
