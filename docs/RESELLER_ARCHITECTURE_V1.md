# Architecture Revendeur V1

## Objectif

Ajouter dans ce projet un vrai niveau `Revendeur` sans mélanger :
- administration plateforme
- gestion des commerces
- exploitation quotidienne des commerces

Le but est de supporter :
- revendeurs standard
- revendeurs en marque blanche
- suivi des ventes
- suivi des commissions
- branding revendeur
- contrôle des accès

## Niveaux d'acteurs

### 1. Platform Owner
- accès total
- gère tous les tenants
- gère les admins plateforme
- gère les revendeurs
- définit les règles globales
- voit toute la facturation et toutes les commissions

### 2. Platform Admin
- accès partiel ou complet selon droits
- gère les commerces autorisés
- peut assister les commerces
- peut activer/suspendre selon permissions
- ne doit pas forcément voir toute la finance revendeur

### 3. Reseller
- vend la solution sous la marque principale
- gère uniquement son portefeuille de commerces
- suit ses ventes et ses commissions
- peut créer des commerces si autorisé
- ne voit pas les autres revendeurs

### 4. White Label Reseller
- même logique qu'un revendeur
- avec branding propre
- peut utiliser son nom, son logo, ses couleurs, son domaine
- peut avoir une grille tarifaire dédiée
- ne doit pas voir la marque plateforme sur son espace si le mode white label est actif

### 5. Tenant Owner / Commerce
- gère son établissement
- n'a pas de visibilité sur la plateforme globale
- ne voit pas les autres commerces

## Séparation d'interface

Le projet reste unique, mais avec 3 espaces métier distincts :

### Espace Plateforme
- gestion des commerces
- gestion des modules
- gestion des admins plateforme
- gestion des revendeurs
- supervision facturation
- audit global

### Espace Revendeur
- dashboard revendeur
- portefeuille clients
- pipeline commercial
- ventes
- commissions
- branding
- support clients revendeur

### Espace Commerce
- caisse
- paramètres établissement
- produits
- livraisons
- clients
- stats

## Modèle métier recommandé

### Cas 1. Revendeur standard
- vend sous la marque principale
- peut créer ou parrainer des commerces
- touche un pourcentage ou un montant fixe

### Cas 2. Revendeur white label
- vend sous sa propre marque
- branding spécifique
- domaine spécifique
- prix publics éventuellement différents
- documents et interface brandés

## Règles financières à supporter

Le système doit supporter au moins :
- commission fixe à la vente
- commission en pourcentage
- commission récurrente mensuelle
- marge revendeur sur prix de base
- frais d'installation
- bonus ponctuels

## Tables Supabase recommandées

### `resellers`
- `id`
- `name`
- `type` : `standard | white_label`
- `status` : `active | suspended`
- `owner_user_id`
- `contact_email`
- `contact_phone`
- `notes`
- `created_date`
- `updated_date`

### `reseller_users`
- `id`
- `reseller_id`
- `user_email`
- `role` : `owner | manager | sales | support`
- `status`
- `created_date`
- `updated_date`

### `reseller_branding`
- `id`
- `reseller_id`
- `brand_name`
- `logo_url`
- `primary_color`
- `secondary_color`
- `support_email`
- `support_phone`
- `custom_domain`
- `domain_verified`
- `created_date`
- `updated_date`

### `reseller_pricing_rules`
- `id`
- `reseller_id`
- `offer_code`
- `billing_type` : `monthly | yearly | one_shot`
- `cost_price`
- `reseller_price`
- `public_price`
- `commission_type` : `fixed | percentage | margin`
- `commission_value`
- `active`
- `created_date`
- `updated_date`

### `reseller_tenants`
- `id`
- `reseller_id`
- `tenant_id`
- `acquisition_channel`
- `subscription_plan`
- `billing_type`
- `sale_price`
- `cost_price`
- `commission_type`
- `commission_value`
- `signed_at`
- `started_at`
- `status`
- `created_date`
- `updated_date`

### `reseller_commissions`
- `id`
- `reseller_id`
- `tenant_id`
- `source_type` : `sale | recurring | setup | bonus | adjustment`
- `source_reference`
- `period_start`
- `period_end`
- `base_amount`
- `commission_amount`
- `status` : `pending | approved | paid | cancelled`
- `notes`
- `created_date`
- `updated_date`

### `reseller_payouts`
- `id`
- `reseller_id`
- `period_start`
- `period_end`
- `total_amount`
- `status`
- `paid_at`
- `payment_reference`
- `notes`
- `created_date`
- `updated_date`

## Lien avec les tenants

Le lien principal recommandé est :
- un commerce peut appartenir à zéro ou un revendeur dans la v1

Règle simple v1 :
- un tenant est rattaché à un seul revendeur actif maximum

Si plus tard il faut supporter affiliation multiple :
- le faire dans une v2

## Permissions recommandées

### Platform Owner
- tout

### Platform Admin
- gestion plateforme selon scope

### Reseller Owner
- voit uniquement ses revendeurs, utilisateurs, clients, ventes, commissions

### Reseller Manager
- voit le portefeuille
- peut gérer les clients et l'équipe revendeur
- pas forcément le payout final

### Reseller Sales
- voit prospects et ventes
- pas de gestion finance avancée

### Reseller Support
- voit les tenants rattachés
- peut ouvrir certaines fiches support

## Écrans V1 recommandés

### Côté plateforme

#### 1. `Revendeurs`
- liste des revendeurs
- type
- statut
- nombre de commerces
- CA revendeur
- commissions dues

#### 2. `Fiche Revendeur`
- identité
- utilisateurs revendeur
- branding
- tenants rattachés
- ventes
- commissions
- payouts

### Côté revendeur

#### 1. `Dashboard Revendeur`
- nombre de commerces actifs
- MRR
- ventes du mois
- commissions en attente
- commissions payées

#### 2. `Clients`
- liste des commerces rattachés
- statut
- formule
- date de création
- revenu généré

#### 3. `Commissions`
- détail par vente
- détail récurrent
- statut de paiement

#### 4. `Branding`
- nom de marque
- logo
- couleurs
- domaine

## White Label V1

Dans la v1, le white label doit permettre :
- nom de marque
- logo
- couleurs
- domaine public revendeur

Peut être différé en v2 :
- emails transactionnels brandés
- documents PDF brandés partout
- authentification séparée par domaine revendeur

## Suivi commercial minimal

Le suivi commercial doit exister dès la v1 :
- nombre de commerces créés
- plan souscrit
- prix vendu
- commission prévue
- commission générée
- statut de paiement commission

## Règles de sécurité

- chaque revendeur ne voit que ses propres tenants
- un admin commerce ne voit jamais les données d'un autre commerce
- un revendeur n'accède pas aux réglages plateforme
- un revendeur white label ne voit pas les autres revendeurs

## Recommandation d'implémentation

### Étape 1
- créer tables `resellers`, `reseller_users`, `reseller_tenants`
- ajouter RLS

### Étape 2
- créer interface plateforme `Revendeurs`
- fiche revendeur

### Étape 3
- créer module financier : `reseller_pricing_rules`, `reseller_commissions`, `reseller_payouts`

### Étape 4
- ajouter branding white label

## Décisions V1 à figer

Avant code final, considérer ces choix comme validés :
- un tenant appartient à un seul revendeur
- un revendeur peut être `standard` ou `white_label`
- la rémunération supporte `fixed`, `percentage`, `margin`
- l'interface revendeur est distincte de l'interface plateforme
- tout reste dans ce même projet

## Suite recommandée

La prochaine étape de développement doit être :

1. schéma Supabase revendeur
2. RLS revendeur
3. liste + fiche revendeur côté plateforme
4. rattachement tenant ↔ revendeur
5. ensuite seulement les commissions et le white label avancé
