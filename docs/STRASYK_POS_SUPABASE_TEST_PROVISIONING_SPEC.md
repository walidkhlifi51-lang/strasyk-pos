# STRASYK POS - Supabase Test Provisioning Specification

Date: 2026-07-28
Status: specification only
Scope: definition du provisionnement canonique Supabase pour test et demonstration, sans implementation a ce stade.

## 1. Objectif

Definir un provisionnement Supabase:

- versionne;
- rejouable;
- reserve aux environnements de test et de demonstration;
- suffisamment riche pour debloquer les parcours critiques de STRASYK POS;
- strictement incapable de toucher un commerce reel par erreur.

Ce provisionnement doit resoudre le P0 d'environnement de test insuffisant identifie pendant la premiere vague de stabilisation.

## 2. Prerequis

### 2.1 Variables d'environnement necessaires

Le futur script devra exiger explicitement:

- `SUPABASE_URL` ou `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `STRASYK_TEST_ENVIRONMENT_NAME`
- `STRASYK_TEST_ENVIRONMENT_CONFIRMATION`

Variables optionnelles recommandees:

- `STRASYK_TEST_TENANT_SLUG`
- `STRASYK_TEST_OWNER_EMAIL`
- `STRASYK_TEST_OWNER_PASSWORD`
- `STRASYK_TEST_ALLOW_RESET=false|true`
- `STRASYK_TEST_EXPECTED_REGION`

### 2.2 Regles de securite obligatoires

- la cle `SUPABASE_SERVICE_ROLE_KEY` ne doit etre utilisee que par un script local securise ou un job backend explicitement protege;
- cette cle ne doit jamais etre exposee au front;
- aucun code client React/Vite ne doit importer, serialiser ou afficher cette cle;
- le script doit verifier explicitement le projet Supabase cible avant toute ecriture;
- le script doit refuser de s'executer si les informations du projet ne correspondent pas au projet de test attendu;
- le script doit etre techniquement incapable de s'executer sur un environnement ressemblant a la production.

### 2.3 Verification explicite du projet cible

Le script devra afficher puis verifier:

- URL Supabase ciblee;
- `project ref` attendu;
- nom logique d'environnement;
- confirmation explicite de l'operateur.

Comportement impose:

- si `SUPABASE_PROJECT_REF` ne correspond pas au projet attendu: echec immediat;
- si le nom d'environnement contient `prod`, `production`, `live` ou equivalent: echec immediat;
- si des metadonnees du projet, du tenant cible ou de la configuration locale contiennent `prod`, `production` ou `live`: echec immediat;
- aucune confirmation, meme renforcee, ne doit permettre de lever ce blocage;
- a defaut de correspondance exacte avec l'environnement de test attendu: abandon sans effet de bord.

### 2.4 Interdiction absolue de production

Regle non negociable:

- le provisionnement de test ne doit jamais pouvoir fonctionner sur la production.

Consequence architecturale:

- le script doit contenir un garde-fou bloquant definitif sur tout environnement dont le nom, les tags, les metadonnees, le `project ref` attendu ou la configuration locale evoquent `prod`, `production` ou `live`;
- ce blocage doit etre code comme une interdiction dure, pas comme une simple confirmation operateur;
- aucun mode `force`, `override` ou `confirm twice` ne doit exister pour lever cette interdiction.

## 3. Identite de test

### 3.1 Compte canonique

Le provisionnement canonique doit definir un compte principal de test:

- email canonique:
  - `demo.owner+strasyk-pos@test.invalid` comme valeur logique de specification
  - implementation reelle a adapter a un domaine autorise par le projet Supabase de test
- mot de passe:
  - genere ou injecte par variable d'environnement securisee
  - jamais hardcode dans le front
  - jamais stocke dans une table metier
  - jamais ecrit dans les logs
  - jamais affiche dans le resume final
  - jamais committe dans le depot
- utilisateur Supabase:
  - cree ou retrouve via admin API
  - `email_confirm = true`
- profil applicatif:
  - `full_name = "STRASYK Demo Owner"`
- role auth:
  - `user` par defaut sauf besoin explicite d'un role plateforme
- tenant associe:
  - exactement un tenant canonique de test
- statut:
  - actif

### 3.2 Comptes supplementaires recommandes

Le jeu canonique doit prevoir des comptes secondaires:

- `demo.employee`
- `demo.manager`
- `demo.delivery`

Finalite:

- couvrir permissions, livraison et exploitation quotidienne;
- eviter d'utiliser un seul compte pour tous les tests.

Gestion des secrets:

- tous les mots de passe de ces comptes doivent etre geres exclusivement via Supabase Auth;
- leur injection doit passer uniquement par variables d'environnement securisees du script;
- aucune table metier ne doit conserver ces mots de passe.

### 3.3 Rotation des identifiants

Regle officielle:

- la rotation des mots de passe doit etre supportee par rerun du script;
- les emails canoniques doivent rester stables par environnement pour conserver la reproductibilite;
- la rotation d'email ne doit etre faite qu'en mode explicite de migration, jamais a chaque relance;
- si l'email canonique doit changer, l'ancien compte doit etre:
  - soit desactive explicitement;
  - soit documente comme obsolete;
  - jamais laisse dans un etat ambigu.

### 3.4 Cas du compte non confirme deja cree

Le compte non confirme issu de la premiere vague ne doit pas etre reutilise automatiquement.

Decision imposee dans l'implementation future:

- soit le supprimer explicitement;
- soit le recuperer explicitement et le normaliser;
- mais jamais le reprendre implicitement sans verification de son identifiant, de son email et de son absence de rattachement a un tenant reel.

## 4. Tenant canonique

### 4.1 Identite du tenant

Le tenant canonique doit etre identifiable sans ambiguite comme environnement de test.

Valeurs de reference recommandees:

- nom: `STRASYK TEST DEMO RESTAURANT`
- slug: `strasyk-test-demo-restaurant`
- identifiant stable:
  - UUID fixe documente si la strategie retenue accepte un ID stable injecte
  - sinon resolution par slug unique impose
- mention visible:
  - `TEST`
  - `DEMO`
- statut:
  - actif

### 4.2 Parametrage metier de reference

Le tenant canonique doit porter au minimum:

- region: `FR`
- devise: `EUR`
- fuseau horaire: `Europe/Paris`
- TVA de reference:
  - `5.5`
  - `10`
  - `20`
- langue commerciale: `fr-FR`

### 4.3 Marqueur technique anti-confusion

Le tenant doit porter au moins un marqueur technique explicite de non-production.

Exemples acceptables:

- slug prefixe par `test-` ou `demo-`
- `nom_commercial` contenant `TEST` et `DEMO`
- champ metadata ou note technique si disponible
- profil restaurant contenant une banniere visuelle `ENVIRONNEMENT DE TEST`

Regle imposee:

- le script ne doit operer que sur un tenant portant ce marqueur.

## 5. Donnees a provisionner

Le jeu de donnees doit rester compact mais complet pour tester les parcours critiques.

## 5.0 Strategie de cles techniques stables

Le provisionnement ne doit pas reposer uniquement sur les noms visibles.

Chaque donnee canonique doit porter ou etre rattachee a une reference technique stable via l'une des strategies suivantes, par ordre de preference:

1. champ `seed_key`
2. champ `external_ref`
3. champ `metadata.seed_key`
4. table dediee de registre de provisioning

Objectifs obligatoires:

- idempotence;
- detection des incoherences;
- reset cible;
- distinction certaine entre donnees de test et donnees reelles.

Constat sur le schema documente:

- aucune preuve suffisante n'apparait dans les schemas actuels pour garantir la presence generale de `seed_key` ou `external_ref` sur les tables coeur;
- plusieurs tables supportent du `jsonb`, mais pas toutes avec un champ `metadata`;
- par consequent, la strategie de specification retenue doit privilegier un registre dedie de provisioning comme mecanisme canonique par defaut.

Registre de provisioning recommande:

- table dediee, reservee au provisioning de test;
- une ligne par objet canonique;
- champs minimaux:
  - `id`
  - `project_ref`
  - `tenant_id`
  - `entity_type`
  - `seed_key`
  - `record_id`
  - `checksum` ou signature simple
  - `created_date`
  - `updated_date`

Regles:

- `seed_key` doit etre unique au sein du tenant et du type d'entite;
- toute relation critique doit pouvoir etre re-resolue via ce registre;
- le reset cible doit s'appuyer sur ce registre avant toute suppression.

## 5.1 Profil restaurant

- quantite: `1`
- champs obligatoires:
  - `tenant_id`
  - `nom_etablissement`
  - `adresse`
  - `telephone`
  - `frais_livraison`
  - `montant_minimum_livraison`
  - `zone_livraison_km`
  - `impression_auto`
  - `manages_deliveries`
  - `manages_table_plan`
  - `manages_web_ordering`
- relations:
  - 1 profil pour le tenant canonique
- valeurs de reference:
  - adresse et telephone fictifs de test
- scenarios couverts:
  - chargement tenant
  - chargement caisse
  - livraison
  - table plan

## 5.2 Categories

- quantite: `4 a 6`
- champs obligatoires:
  - `tenant_id`
  - `nom`
  - `sort_order`
  - `disponible`
- valeurs de reference:
  - `Pizzas`
  - `Burgers`
  - `Boissons`
  - `Desserts`
- scenarios couverts:
  - chargement catalogue
  - navigation categories
  - commandes multi-familles

## 5.3 Produits simples

- quantite: `6 a 10`
- champs obligatoires:
  - `tenant_id`
  - `category_id`
  - `nom`
  - `prix`
  - `tva`
  - `disponible`
- valeurs de reference:
  - coca
  - eau
  - tiramisu
  - cafe
- scenarios couverts:
  - `STAB-POS-010`
  - `STAB-POS-020`
  - `STAB-POS-021`

## 5.4 Produits avec tailles

- quantite: `2 a 4`
- champs obligatoires:
  - `tenant_id`
  - `category_id`
  - `nom`
  - `base_price` ou equivalent
  - `size_prices`
  - `tva`
- valeurs de reference:
  - pizza margarita
  - pizza 4 fromages
- scenarios couverts:
  - variation de prix
  - chargement catalogue
  - commande simple et complexe

## 5.5 Options et supplements

- quantite:
  - `2 a 3` groupes d'options
  - `5 a 8` items d'option
- champs obligatoires:
  - `tenant_id`
  - `product_id` ou `option_group_id`
  - `nom`
  - `selection_type`
  - `price_surcharge`
- valeurs de reference:
  - taille pate
  - extra fromage
  - boisson menu
- scenarios couverts:
  - `STAB-POS-011`
  - recalcul prix
  - verification composition

## 5.6 Retraits et ingredients

- quantite:
  - `3 a 6` ingredients
  - `3 a 6` relations produit/ingredient
- champs obligatoires:
  - `tenant_id`
  - `nom`
  - relation produit ingredient
- valeurs de reference:
  - oignons
  - cornichons
  - sauce
- scenarios couverts:
  - produit avec retrait
  - personnalisation

## 5.7 Tables

- quantite: `5 a 8`
- champs obligatoires:
  - `tenant_id`
  - `nom`
  - `statut`
  - `capacite`
- valeurs de reference:
  - `T1` a `T6`
- scenarios couverts:
  - mise en attente
  - reprise
  - commande en salle

## 5.8 Modes de commande

Le schema actuel porte surtout ces modes dans les commandes et parametres, pas dans une table dediee obligatoire.

Modes de reference a couvrir:

- `sur_place`
- `a_emporter`
- `livraison`

Scenarios couverts:

- prise de commande multi-mode
- encaissement
- livraison

## 5.9 Modes de paiement

Le schema actuel semble manipuler les paiements dans la commande plutot que via une table catalogue obligatoire.

Valeurs de reference a supporter:

- `especes`
- `carte`
- `mixte`

Scenarios couverts:

- `STAB-POS-020`
- `STAB-POS-021`
- `STAB-POS-024`

## 5.10 Clients

- quantite: `5 a 8`
- champs obligatoires:
  - `tenant_id`
  - `nom`
  - `prenom`
  - `telephone`
- valeurs de reference:
  - 2 clients avec historique
  - 1 client avec cagnotte
  - 1 client livraison
  - 1 client vierge
- scenarios couverts:
  - `STAB-POS-030`
  - `STAB-POS-031`
  - fidelite
  - historique

## 5.11 Regles de fidelite

- quantite:
  - `1` `CagnotteRule`
  - `1` `LoyaltyRule` si le schema actif le supporte
- champs obligatoires:
  - `tenant_id`
  - `active`
  - `nom`
  - `accumulation_rate` ou equivalent
- valeurs de reference:
  - cagnotte `5%`
- scenarios couverts:
  - gain de cagnotte
  - chargement regles
  - consultation client

## 5.12 Livreur de demonstration

- quantite: `1`
- champs obligatoires:
  - `tenant_id`
  - `user_email`
  - `username`
  - `nom`
  - `prenom`
  - `disponible`
- valeurs de reference:
  - compte livreur clairement marque `demo`
- scenarios couverts:
  - livraison
  - affectation livreur

Regle de securite:

- aucun mot de passe ne doit etre stocke dans `delivery_people` dans le cadre du provisionnement canonique;
- l'authentification eventuelle du livreur de test doit etre geree exclusivement via Supabase Auth ou un secret d'environnement non persiste en table metier;
- si le schema historique contient encore `delivery_people.password`, le script canonique ne doit ni le renseigner, ni le relire, ni le journaliser.

## 5.13 Commandes historiques

- quantite: `4 a 6`
- types minimum:
  - `1` commande payee sur place
  - `1` commande en attente
  - `1` commande livraison
  - `1` commande client rattache avec fidelite
  - `1` commande d'une date anterieure pour statistiques
- champs obligatoires:
  - `tenant_id`
  - `numero_caisse`
  - `numero_commande`
  - `articles`
  - `total_ht`
  - `total_tva`
  - `total_ttc`
  - `statut`
  - `type_commande`
- scenarios couverts:
  - reprise
  - historique
  - statistiques
  - isolation tenant

## 5.14 Donnees minimales pour statistiques

- au moins `2 jours` de donnees
- au moins `2 categories` vendues
- au moins `2 modes de commande`
- au moins `2 modes de paiement`

Scenarios couverts:

- ecrans statistiques
- regroupements du jour vs historique

## 6. Idempotence

Le script doit etre strictement rejouable.

### 6.1 Regle generale

Chaque objet canonique doit etre retrouve via une cle stable:

- email utilisateur
- slug tenant
- reference technique stable (`seed_key`, `external_ref`, `metadata.seed_key` ou registre dedie)
- references metier canoniques documentees en second niveau seulement

### 6.2 Comportement impose

Le comportement cible sera:

- creer si absent;
- mettre a jour si present et conforme a la specification;
- echouer en cas d'incoherence structurelle;
- ne jamais reset automatiquement sans mode explicite.

### 6.3 Cas imposant l'echec immediat

- un slug de tenant existe mais sans marqueur test attendu;
- un utilisateur existe avec le bon email mais est rattache a un tenant reel;
- un objet de reference critique appartient a un autre tenant;
- une `seed_key` attendue pointe vers un enregistrement dont le tenant ou le type ne correspond pas;
- une relation obligatoire pointe vers un ID inattendu;
- le tenant cible ne correspond pas au tenant canonique.

### 6.4 Reset

Le reset ne doit pas etre implicite.

Il doit exister seulement via:

- un mode explicite;
- une commande distincte;
- une confirmation renforcee.

## 7. Securite

Le document impose les regles suivantes:

- ciblage exclusif d'un tenant marque test;
- aucune suppression globale;
- aucune requete destructive sans filtre tenant;
- journalisation de toutes les operations;
- support d'un mode `dry-run`;
- confirmation explicite avant toute suppression;
- arret immediat si un identifiant ne correspond pas au tenant attendu;
- aucune modification d'un commerce actif;
- aucune elevation silencieuse vers un tenant non marque test ou demo.
- aucune persistence de mot de passe dans les donnees metier, les logs, les sorties terminal ou le depot.

### 7.1 Garde-fous obligatoires

Le script devra:

- verifier le tenant avant chaque lot d'operation destructive;
- comparer l'ID resolu, le slug et le nom;
- verifier les references techniques du registre de provisioning avant toute mise a jour ou suppression;
- refuser toute execution si les trois verifications ne convergent pas;
- journaliser les objets modifies, crees, ignores et refuses.

## 8. Commandes prevues

Commandes futures a exposer, sans implementation a ce stade:

- `npm run test:provision`
  - role: provisionnement canonique normal
  - comportement: cree ou met a jour le compte test, le tenant test et les donnees de reference

- `npm run test:provision:dry-run`
  - role: simulation
  - comportement: affiche tout ce qui serait cree, mis a jour ou refuse, sans ecrire

- `npm run test:reset`
  - role: nettoyage ou reseed du tenant de test
  - comportement: efface uniquement les donnees test autorisees du tenant cible apres confirmations

- `npm run test:status`
  - role: inspection
  - comportement: affiche l'etat du projet cible, du compte test, du tenant test et du dataset

## 9. Sortie attendue

A la fin du provisionnement, le script devra afficher au minimum:

- projet Supabase cible;
- `project ref` cible;
- utilisateur cree ou trouve;
- etat de confirmation email;
- tenant cree ou trouve;
- nombre d'elements crees par type;
- nombre d'elements mis a jour par type;
- nombre d'elements ignores car deja conformes;
- anomalies rencontrees;
- identifiants utiles pour les tests;
- statut final succes ou echec.

Format recommande:

- resume humain lisible;
- sortie structurée exploitable ensuite par QA;
- code de sortie non nul en cas d'anomalie bloquante.

## 10. Nettoyage

Deux niveaux distincts doivent etre definis.

### 10.1 Nettoyage transactionnel

But:

- supprimer uniquement les donnees transactionnelles de test

Inclut:

- commandes de test
- clients de test si identifies comme purement transactionnels
- eventuels historiques derives

N'inclut pas:

- suppression du tenant
- suppression de l'utilisateur owner
- suppression des categories, produits ou tables canoniques de reference sauf mode explicite

### 10.2 Suppression complete de l'environnement de test

But:

- supprimer entierement l'environnement canonique de test

Contraintes:

- commande separee;
- interdite par defaut;
- confirmation renforcee;
- impossible a lancer par erreur;
- validation finale sur `tenant_id`, `slug`, `nom` et marqueur technique;
- journal detaille obligatoire.

## 11. Criteres d'acceptation

Le provisionnement sera accepte seulement si:

- un nouveau developpeur peut preparer l'environnement avec une commande documentee;
- la connexion fonctionne immediatement;
- le tenant est charge;
- la caisse affiche le catalogue;
- une commande peut etre creee et encaissee;
- le script peut etre relance sans doublon;
- aucune donnee reelle n'est touchee;
- les scenarios bloques de la vague 1 peuvent etre rejoues.

## 12. Recommandations d'architecture

Le provisionnement canonique doit rester:

- hors front;
- pilote par script local ou backend admin securise;
- decouple des parcours utilisateur normaux;
- compatible avec une future couche `Demo Restaurant` reinitialisable.

Implementation ciblee plus tard:

- base immediate: Option C
- extension future: Option D construite par-dessus

## 13. Hors scope de cette specification

- correction des anomalies P3 deja identifiees;
- relance immediate de la vague 1 authentifiee;
- implementation des scripts;
- refactoring large de l'application;
- nouvelle fonctionnalite produit.
