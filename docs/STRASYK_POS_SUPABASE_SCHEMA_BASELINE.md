# STRASYK POS - Supabase Schema Baseline

Date du releve initial: 2026-07-29
Date de mise a jour post-provisioning: 2026-07-30
Projet Supabase: `sbugjsmzunpsnkdwnskj`
Environnement logique: `stabilization-dev`
Mode de releve: lecture seule uniquement

## 1. Portee

Ce document capture l'etat de reference du schema Supabase visible depuis la Data API PostgREST au 29 juillet 2026.

Il ne contient:

- aucun secret;
- aucune commande destructive;
- aucune garantie sur les schemas non exposes par la Data API;
- aucune conclusion automatique sur les catalogues systeme non accessibles via PostgREST.

## 2. Schemas exposes par la Data API

D'apres les reponses PostgREST:

- `public`
- `graphql_public`

Les schemas suivants ne sont pas exposes a la Data API de ce projet, au moins dans ce contexte d'inspection:

- `information_schema`
- `pg_catalog`

## 3. Tables et RPC visibles via PostgREST

### 3.1 Tables visibles

- `cagnotte_history`
- `cagnotte_rules`
- `categories`
- `cloture_caisse`
- `customer_display_cart`
- `customers`
- `delivery_people`
- `delivery_verification_logs`
- `drawer_openings`
- `ingredients`
- `inscription_requests`
- `loyalty_rules`
- `menu_formula_items`
- `menu_formulas`
- `offers`
- `option_groups`
- `option_items`
- `orders`
- `platform_admin_access`
- `product_ingredients`
- `products`
- `promo_codes`
- `reseller_branding`
- `reseller_commissions`
- `reseller_payouts`
- `reseller_pricing_rules`
- `reseller_tenants`
- `reseller_users`
- `resellers`
- `restaurant_profiles`
- `tables`
- `tenant_invoices`
- `tenant_sync_versions`
- `tenants`
- `user_access`

### 3.2 RPC visibles

- `rpc/app_can_access_reseller`
- `rpc/app_can_manage_reseller`
- `rpc/app_current_tenant_id`
- `rpc/app_current_user_email`
- `rpc/app_has_admin_claim`
- `rpc/app_is_active_reseller_user`
- `rpc/app_is_platform_admin`
- `rpc/current_user_email`
- `rpc/delivery_app_action`
- `rpc/is_platform_admin`
- `rpc/kiosk_tenant_is_public`
- `rpc/rls_auto_enable`

## 4. Compteurs constates en lecture seule

### 4.1 Baseline protegee avant provisioning

Cette baseline historique reste la reference de protection du premier lancement du provisioning canonique.

- utilisateurs Auth: `6`
- `tenants`: `3`
- `restaurant_profiles`: `3`
- `orders`: `139`
- `user_access`: `0`
- `provisioning_registry`: absent

Constat historique:

- compteurs avant `dry-run` et apres `dry-run` identiques;
- aucune ecriture detectee;
- aucun utilisateur Auth cree ou modifie.

### 4.2 Etat courant apres provisioning canonique

Etat valide apres application de la migration du registre et execution reelle unique du provisioning canonique:

- utilisateurs Auth: `7`
- `tenants`: `4`
- `restaurant_profiles`: `4`
- `categories`: `5`
- `products`: `9`
- `ingredients`: `88`
- `product_ingredients`: `5`
- `option_groups`: `5`
- `option_items`: `81`
- `customers`: `3`
- `tables`: `5`
- `loyalty_rules`: `2`
- `cagnotte_rules`: `2`
- `delivery_people`: `2`
- `orders`: `142`
- `user_access`: `1`
- `platform_admin_access`: `1`
- `provisioning_registry`: `30`

Constat courant:

- le tenant canonique de test est provisionne;
- les 30 objets canoniques sont enregistres dans `provisioning_registry`;
- `test:provision:dry-run` est maintenant en no-op idempotent;
- aucune ecriture n'est effectuee par `test:status` ou `test:provision:dry-run`.

## 5. Tables reellement utilisees par le front

Tables referencees explicitement par le client Supabase front dans [src/api/supabase/appClient.js](/C:/Users/walid/Desktop/stasyk-pos-v2/pos2/strasyk-pos-211025-copy-93f2904a%20(4)/src/api/supabase/appClient.js):

- `tenants`
- `restaurant_profiles`
- `resellers`
- `reseller_users`
- `reseller_branding`
- `reseller_pricing_rules`
- `reseller_tenants`
- `reseller_commissions`
- `reseller_payouts`
- `user_access`
- `platform_admin_access`
- `delivery_people`
- `categories`
- `products`
- `tables`
- `customers`
- `orders`
- `offers`
- `loyalty_rules`
- `cagnotte_rules`
- `cagnotte_history`
- `promo_codes`
- `menu_formulas`
- `menu_formula_items`
- `cloture_caisse`
- `drawer_openings`
- `customer_display_cart`
- `site_config`
- `scratch_ticket_config`
- `inscription_requests`
- `tenant_invoices`

RPC reference explicitement par le front:

- `delivery_app_action`

Le front utilise aussi des canaux realtime sur le schema `public`.

## 6. Tables couvertes par le provisioning canonique

Le provisioning canonique initial doit rester limite aux parcours commerciaux essentiels du POS:

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
- `provisioning_registry`

Perimetre fonctionnel associe:

- authentification;
- tenant;
- profil restaurant;
- acces utilisateur;
- catalogue;
- compositions et options;
- clients;
- tables;
- fidelite et cagnotte;
- livraison;
- commandes de demonstration.

## 7. Tables utilisees par le front mais hors provisioning canonique initial

Ces tables appartiennent a l'inventaire global du schema mais ne doivent pas recevoir de donnees dans le provisioning initial tant qu'un scenario ne l'exige pas:

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

## 8. Tables utilisees par le front mais absentes de PostgREST

Deux tables referencees par le front ne sont pas visibles via PostgREST:

- `site_config`
- `scratch_ticket_config`

Etat actuel:

- `site_config`: non trouvee dans le schema cache PostgREST (`PGRST205`)
- `scratch_ticket_config`: non trouvee dans le schema cache PostgREST (`PGRST205`)

Important:

- ce document ne les presente pas comme des bugs confirmes;
- leur usage reel et leur comportement de repli dans le front doivent etre analyses avant toute conclusion;
- l'absence dans PostgREST peut signifier table absente, table non creee, ou fonctionnalite historical/legacy non finalisee.

## 9. Compatibilite avec le contrat de provisioning

Constat:

- les tables critiques du provisioning existent bien;
- les colonnes minimales attendues sont presentes;
- plusieurs tables ont davantage de colonnes que le contrat minimal, ce qui est acceptable pour l'etape 2.

Exemples de colonnes supplementaires observees:

- `restaurant_profiles`: nombreuses colonnes kiosk, web ordering, branding et customer display
- `products`: colonnes prix web, tailles, couleurs, tri
- `orders`: colonnes client, table, livreur, paiement prevu, bipeur
- `user_access`: drapeaux d'acces complementaires
- `delivery_people`: colonne legacy `password`, a ne jamais utiliser dans le provisioning canonique

## 10. Limites de l'inspection actuelle

L'inspection lecture seule effectuee dans cette phase ne permet pas de confirmer completement:

- les contraintes SQL reelles;
- les cles etrangeres reelles;
- les policies RLS detaillees;
- les grants exacts;
- les schemas non exposes par la Data API;
- les vues ou objets systeme non exposes par PostgREST.

Raison:

- `information_schema` et `pg_catalog` ne sont pas exposes par la Data API de ce projet dans ce contexte;
- l'inspection a ete volontairement limitee a des appels REST en lecture seule et a des requetes de comptage non mutantes.

## 11. Divergence entre la base reelle et les fichiers SQL du depot

La base reelle visible via PostgREST est plus riche et plus avancee que l'ensemble des fichiers SQL actuellement presents dans `docs/`.

Divergences notables:

- certaines tables visibles n'ont pas de script complet de creation clairement present dans le depot:
  - `tenants`
  - `restaurant_profiles` base
  - `user_access`
  - `platform_admin_access`
  - `tenant_invoices`
  - `inscription_requests`
  - `categories`
  - `products` base
- plusieurs tables documentees dans le depot apparaissent avec davantage de colonnes en base reelle que dans le contrat de provisioning minimal;
- le depot contient beaucoup de scripts incrementaux `alter table` et de policies, mais pas une representation exhaustive et autoportante de tout le schema reel.

## 12. Conclusion de baseline

Baseline historique protegee au 29 juillet 2026:

- utilisateurs Auth: `6`
- `tenants`: `3`
- `restaurant_profiles`: `3`
- `orders`: `139`
- `provisioning_registry`: absent

Etat courant valide au 30 juillet 2026:

- le projet Supabase cible est bien le bon;
- la base n'est pas vide;
- PostgREST expose bien les tables critiques utiles au provisioning canonique;
- la migration `20260729143000_create_provisioning_registry.sql` est appliquee;
- `provisioning_registry` existe et contient `30` lignes;
- le tenant canonique de test est provisionne;
- `site_config` et `scratch_ticket_config` restent a classifier fonctionnellement;
- la baseline historique initiale reste conservee comme reference de protection;
- l'etat courant apres provisioning est:
  - utilisateurs Auth `7`
  - `tenants` `4`
  - `restaurant_profiles` `4`
  - `user_access` `1`
  - `provisioning_registry` `30`
  - `orders` `142`
