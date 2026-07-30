# STRASYK POS - Supabase Test Provisioning Implementation Plan

Date: 2026-07-28
Status: plan only
Scope: plan d'implementation du provisionnement canonique Supabase de test et demonstration, sans codage dans cette phase.

## 1. Objectif du plan

Definir comment implementer le provisionnement canonique valide dans:

- [docs/STRASYK_POS_SUPABASE_TEST_PROVISIONING_SPEC.md](C:/Users/walid/Desktop/stasyk-pos-v2/pos2/strasyk-pos-211025-copy-93f2904a%20(4)/docs/STRASYK_POS_SUPABASE_TEST_PROVISIONING_SPEC.md)

Le plan couvre:

- fichiers a creer et modifier;
- modules du script;
- ordre des operations;
- controles prealables;
- strategie de reprise sur erreur;
- dependances;
- tables et champs reels utilises;
- logs;
- tests du script;
- commandes `dry-run`, `provision`, `status`, `reset`;
- rollback.

## 2. Fichiers a creer

### 2.1 Scripts Node

- `scripts/test-provisioning/config.mjs`
  - lecture et validation des variables d'environnement
  - detection absolue des environnements interdits

- `scripts/test-provisioning/supabaseAdmin.mjs`
  - creation du client admin Supabase via `SUPABASE_SERVICE_ROLE_KEY`
  - helpers auth admin

- `scripts/test-provisioning/guards.mjs`
  - controles de securite
  - verification du projet cible
  - verification anti-production
  - verification du tenant cible

- `scripts/test-provisioning/schemaInspector.mjs`
  - lecture minimale du schema attendu
  - verification de presence des tables et champs critiques
  - verification de la table de registre de provisioning ou de sa migration prealable

- `scripts/test-provisioning/provisioningRegistry.mjs`
  - lecture/ecriture du registre technique de provisioning
  - resolution par `seed_key`

- `scripts/test-provisioning/authUsers.mjs`
  - create/find/update des comptes Supabase Auth
  - confirmation email admin
  - rotation des mots de passe via env seulement

- `scripts/test-provisioning/tenant.mjs`
  - provisionnement tenant canonique
  - verification du marqueur TEST/DEMO

- `scripts/test-provisioning/restaurantProfile.mjs`
  - provisionnement du profil restaurant

- `scripts/test-provisioning/catalog.mjs`
  - categories
  - produits simples
  - produits a tailles
  - ingredients
  - product_ingredients
  - option_groups
  - option_items

- `scripts/test-provisioning/customers.mjs`
  - clients de reference

- `scripts/test-provisioning/tables.mjs`
  - tables de salle

- `scripts/test-provisioning/loyalty.mjs`
  - `loyalty_rules`
  - `cagnotte_rules`
  - eventuellement historique si necessaire

- `scripts/test-provisioning/delivery.mjs`
  - compte livreur metier
  - sans mot de passe en table

- `scripts/test-provisioning/orders.mjs`
  - commandes historiques
  - commande en attente
  - commande payee
  - commande livraison

- `scripts/test-provisioning/status.mjs`
  - etat synthese de l'environnement provisionne

- `scripts/test-provisioning/reset.mjs`
  - nettoyage transactionnel cible
  - suppression complete protegee si explicitement prevue plus tard

- `scripts/test-provisioning/logger.mjs`
  - logs structurés
  - resume final

- `scripts/test-provisioning/index.mjs`
  - point d'entree principal
  - orchestration des modes `provision`, `dry-run`, `status`, `reset`

### 2.2 Fichiers de donnees de reference

- `scripts/test-provisioning/data/canonicalDataset.mjs`
  - donnees de reference lisibles
  - seed keys
  - valeurs canoniques

- `scripts/test-provisioning/data/seedKeys.mjs`
  - constantes techniques stables

### 2.3 Documentation

- mise a jour de `package.json`
  - ajout des scripts npm

- eventuellement `docs/STRASYK_POS_SUPABASE_TEST_PROVISIONING_OPERATIONS.md`
  - guide operateur, si souhaite plus tard

## 3. Fichiers a modifier

- `package.json`
  - ajouter:
    - `test:provision`
    - `test:provision:dry-run`
    - `test:status`
    - `test:reset`

- eventuellement `.env.example`
  - documenter les variables du script
  - sans ajouter de secrets reels

- aucun fichier front React ne doit etre modifie pour la V1 du provisioning
  - sauf si une documentation de developer experience l'exige

## 4. Dependances necessaires

Dependances deja disponibles:

- `@supabase/supabase-js`

Dependances additionnelles possibles mais non obligatoires:

- aucune obligatoire si le script reste en ESM Node simple

Recommendation:

- ne pas ajouter de framework lourd de migration ou de CLI custom dans cette phase;
- rester sur Node natif + `@supabase/supabase-js`.

## 5. Tables Supabase reellement utilisees

### 5.1 Tables coeur a provisionner

- `tenants`
- `restaurant_profiles`
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
- `cagnotte_history` si necessaire pour coherence des historiques

### 5.2 Tables techniques ou de support

- `user_access` si des comptes non-owner doivent etre testes
- `platform_admin_access` seulement si un compte plateforme de test est explicitement souhaite
- `customer_display_cart` non necessaire pour la V1 du provisioning canonique
- `tenant_invoices` hors scope V1
- table dediee de registre de provisioning:
  - recommandee
  - probablement a creer si absente

### 5.3 Tables Auth

- Supabase Auth users via admin API

## 6. Champs exacts verifies dans le schema existant

### 6.1 Champs documentes et utilisables avec confiance raisonnable

`orders` via `docs/SUPABASE_POS_CORE_SCHEMA.sql`:

- `id`
- `tenant_id`
- `numero_commande`
- `numero_caisse`
- `type_commande`
- `customer_id`
- `table_id`
- `delivery_person_id`
- `delivery_address`
- `articles`
- `total_ht`
- `total_tva`
- `total_ttc`
- `statut`
- `mode_paiement`
- `mode_paiement_prevu`
- `numero_bipeur`
- `numero_table`
- `payee`
- `notes`
- `cagnotte_spent`
- `scratch_reduction`
- `print_at_counter`
- `from_kiosk`
- `from_web`
- `created_date`
- `updated_date`

`tables` via `docs/SUPABASE_POS_CORE_SCHEMA.sql`:

- `id`
- `tenant_id`
- `nom`
- `capacite`
- `forme`
- `statut`
- `order_id`
- `position_x`
- `position_y`
- `zone`
- `created_date`
- `updated_date`

`customers` via `docs/SUPABASE_CUSTOMERS_SCHEMA.sql`:

- `id`
- `tenant_id`
- `nom`
- `prenom`
- `telephone`
- `email`
- `adresse`
- `code_postal`
- `ville`
- `etage`
- `interphone`
- `notes`
- `adresses`
- `cagnotte_balance`
- `created_date`
- `updated_date`

`delivery_people` via `docs/SUPABASE_DELIVERY_PEOPLE_SCHEMA.sql`:

- `id`
- `tenant_id`
- `nom`
- `prenom`
- `telephone`
- `user_email`
- `username`
- `vehicule`
- `disponible`
- `app_access_enabled`
- `en_livraison`
- `nb_livraisons_jour`
- `total_encaisse`
- `created_date`
- `updated_date`

Note:

- `password` existe dans le schema historique mais ne devra pas etre utilise par le provisioning canonique.

`products`, `ingredients`, `product_ingredients`, `option_groups`, `option_items` via `docs/SUPABASE_PRODUCT_SCHEMA_COMPLETE.sql`:

- `products`:
  - `tenant_id`
  - `category_id`
  - `nom`
  - `description`
  - `prix`
  - `base_price`
  - `size_prices`
  - `prix_par_mode`
  - `size_prix_par_mode`
  - `web_price`
  - `web_size_prices`
  - `temps_preparation`
  - `tva`
  - `color`
  - `sort_order`
  - `created_date`
  - `updated_date`
- `ingredients`:
  - `tenant_id`
  - `nom`
  - `unite`
  - `cout_unitaire`
  - `quantite_stock`
- `product_ingredients`:
  - `tenant_id`
  - `product_id`
  - `ingredient_id`
  - `quantite`
  - `retirable`
- `option_groups`:
  - `tenant_id`
  - `product_id`
  - `nom`
  - `selection_type`
  - `min_selections`
  - `max_selections`
  - `required`
  - `manages_sizes`
  - `size_template`
- `option_items`:
  - `tenant_id`
  - `option_group_id`
  - `nom`
  - `price_surcharge`
  - `size_surcharges`

`loyalty_rules`, `cagnotte_rules`, `cagnotte_history` via `docs/SUPABASE_MARKETING_SCHEMA.sql`:

- `loyalty_rules`:
  - `tenant_id`
  - `nom`
  - `description`
  - `numero_commande`
  - `active`
  - `canaux`
  - `modes_commande`
  - `type_recompense`
  - `valeur_recompense`
  - `produit_offert_ids`
- `cagnotte_rules`:
  - `tenant_id`
  - `nom`
  - `accumulation_rate`
  - `active`
  - `canaux`
- `cagnotte_history`:
  - `tenant_id`
  - `customer_id`
  - `order_id`
  - `type`
  - `amount`
  - `balance_before`
  - `balance_after`

`restaurant_profiles` via `docs/SUPABASE_RESTAURANT_PROFILE_SCHEMA.sql` plus usage projet:

- champs documentes:
  - `logo_url`
  - `prenom_gerant`
  - `nom_gerant`
  - `siret`
  - `tva_intracommunautaire`
  - `kiosk_welcome_message`
  - `kiosk_welcome_images`
  - `kiosk_terminal_welcome_images`
  - `kiosk_primary_color`
  - `kiosk_secondary_color`
  - `kiosk_card_payment_enabled`
  - `force_immediate_payment`
  - `prix_differencies_par_mode`
  - `allow_price_edit`
  - `allow_item_edit`
  - `manages_kiosk`
  - `manages_delivery_app`
  - `delivery_app_allowed`
  - `table_plan_allowed`
  - `bipeur_enabled`
  - `customer_display_enabled`
  - `customer_display_images`
  - `customer_display_settings`
  - `manages_web_ordering`
  - `web_ordering_closed`
  - `web_frais_livraison_enabled`
  - `web_frais_livraison`
  - `site_template`
  - `site_primary_color`
  - `custom_domain`
  - `domain_verified`
  - `scratch_tickets_enabled`
  - `ai_image_generation_enabled`

### 6.2 Champs tenant a verifier en preflight

La definition complete SQL de `tenants` n'est pas entierement presente dans les fichiers fournis, mais le projet s'appuie clairement sur:

- `id`
- `nom_commercial`
- `owner_email`
- `active`
- `subscription_plan`
- `pos_suspended`
- `slug`
- `created_date`
- `updated_date`

Plan:

- le script devra verifier explicitement la presence de ces champs avant toute operation;
- en cas d'absence ou divergence schema, echec immediat avec message clair.

### 6.3 Champs pour cles techniques

Constat:

- aucune preuve suffisante de `seed_key` ou `external_ref` sur les tables coeur;
- pas de champ `metadata` documente sur la plupart des tables coeur provisionnees;
- donc la V1 du plan d'implementation doit prevoir une table dediee de registre de provisioning.

## 7. Strategie de modules et de responsabilites

### 7.1 Module config

Responsabilites:

- lecture env
- normalisation options CLI
- mode `dry-run`, `provision`, `status`, `reset`

### 7.2 Module guards

Responsabilites:

- interdiction absolue production
- verification `project ref`
- verification presence `service role`
- verification drapeau `allow reset`

### 7.3 Module schemaInspector

Responsabilites:

- tester existence des tables critiques
- tester existence des champs critiques
- tester existence du registre de provisioning
- remonter un rapport de compatibilite

### 7.4 Module registry

Responsabilites:

- mapper `seed_key -> record_id`
- verifier coherence `entity_type`, `tenant_id`, `project_ref`
- permettre `status` et `reset`

### 7.5 Modules metier de provisioning

Ordre de dependance:

1. auth users
2. tenant
3. restaurant profile
4. catalog
5. customers
6. tables
7. loyalty
8. delivery
9. orders

## 8. Ordre des operations

Ordre recommande:

1. lecture config
2. gardes anti-production
3. verification projet Supabase cible
4. inspection schema
5. ouverture logger de session
6. verification ou creation du registre de provisioning
7. verification ou creation des comptes Auth
8. verification ou creation du tenant canonique
9. verification ou creation du profil restaurant
10. provisioning categories
11. provisioning produits
12. provisioning ingredients / retraits / options
13. provisioning tables
14. provisioning clients
15. provisioning fidelite
16. provisioning livreur
17. provisioning commandes historiques
18. verification de coherence finale
19. resume final

## 9. Controles prealables

Avant toute ecriture:

- confirmer que `SUPABASE_SERVICE_ROLE_KEY` est present
- verifier `SUPABASE_URL`
- verifier `SUPABASE_PROJECT_REF`
- verifier que l'environnement ne contient ni `prod`, ni `production`, ni `live`
- verifier la presence des tables critiques
- verifier la presence des champs critiques
- verifier que le tenant cible est marque TEST/DEMO
- verifier qu'aucun enregistrement deja trouve n'appartient a un tenant reel

## 10. Strategie de transaction et de reprise sur erreur

### 10.1 Principe

Le script sera multi-etapes et multi-tables. Une transaction SQL globale unique est peu realiste via les CRUD admin standards.

Strategie recommandee:

- operations atomiques par bloc logique;
- checkpoints par etape;
- registre de provisioning ecrit seulement apres succes de l'operation associee;
- echec immediat sur incoherence critique.

### 10.2 Reprise

En cas d'erreur:

- le script s'arrete avec code non nul;
- le resume final indique la derniere etape validee;
- la relance doit etre possible sans doublon grace au registre et aux cles stables.

### 10.3 Rollback partiel

Regles:

- si la creation du tenant echoue apres creation du user: ne pas supprimer automatiquement le user sauf mode explicite
- si un bloc secondaire echoue apres creation du tenant: laisser les objets deja coherents et reprendre au rerun
- si une incoherence critique est detectee: ne rien corriger automatiquement

## 11. Strategie de logs

Le logger doit produire:

- logs humains lisibles en console
- statut par etape
- mode `dry-run` explicite
- resume final

Interdictions:

- aucun mot de passe en clair
- aucune `service role key`
- aucune donnee sensible inutile

Contenu minimal:

- projet cible
- mode d'execution
- tenant cible
- compte owner cible
- objets crees / mis a jour / ignores / refuses
- anomalies

## 12. Tests du script lui-meme

### 12.1 Tests de garde

- refuse sans `service role`
- refuse sans `project ref`
- refuse si environnement contient `prod`
- refuse si URL cible inattendue

### 12.2 Tests de schema

- refuse si table critique absente
- refuse si champ critique absent
- refuse si registre absent et non activable selon le mode choisi

### 12.3 Tests d'idempotence

- premier run: creation
- deuxieme run: zero doublon
- troisieme run apres modification mineure: mise a jour ciblee

### 12.4 Tests de reset

- `dry-run reset` n'ecrit rien
- `reset` transactionnel n'efface que les donnees du tenant test
- suppression complete reste separee et protegee

## 13. Plan par commande

### 13.1 `npm run test:provision:dry-run`

Etapes:

1. charger config
2. executer tous les guards
3. inspecter schema
4. simuler create/update/ignore
5. afficher le plan d'action

### 13.2 `npm run test:provision`

Etapes:

1. guards
2. schema
3. auth users
4. tenant
5. dataset
6. coherence finale
7. sortie

### 13.3 `npm run test:status`

Etapes:

1. guards lecture seule
2. lecture registre
3. lecture utilisateur, tenant, dataset
4. rapport de conformite

### 13.4 `npm run test:reset`

Etapes:

1. guards renforces
2. verification `ALLOW_RESET`
3. verification tenant test
4. dry-run obligatoire recommande avant vraie execution
5. suppression ciblee des donnees transactionnelles seulement
6. verification post-reset

## 14. Criteres de rollback

Le rollback doit etre envisage a deux niveaux.

### 14.1 Rollback operatif

- si une etape cree un objet incoherent, la relance ne doit pas propager cette incoherence;
- le script doit s'arreter avant les blocs descendants.

### 14.2 Rollback fonctionnel

Si l'environnement provisionne devient douteux:

- lancer `test:status`
- si besoin lancer `test:reset` transactionnel
- reexecuter `test:provision`

### 14.3 Interdictions

- aucune suppression globale;
- aucun rollback automatique sur tenant non test;
- aucun rollback silencieux sur des comptes ou tenants hors registre.

## 15. Recommendation finale d'implementation

Implementation par phases:

1. guards + config + status
2. registre de provisioning
3. auth users + tenant + profile
4. catalog + clients + tables
5. loyalty + delivery + orders historiques
6. reset transactionnel
7. tests du script

Ce sequencing minimise le risque et permet de valider tres tot la securite avant de semer des donnees metier.
