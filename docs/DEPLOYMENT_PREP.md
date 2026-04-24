# Preparation Supabase + Vercel

## Etat actuel

- Front Vite/React pret a etre deploie.
- Backend actuel en mode `local` via `src/api/appClient.js`.
- Un mode `supabase` est prepare mais pas encore branche entite par entite.

## Variables d environnement

Copier `.env.example` en `.env.local` pour le developpement.

Variables prevues:

- `VITE_APP_BACKEND_MODE=local|supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Ordre de migration recommande

1. Creer le projet Supabase
2. Definir le schema SQL
3. Migrer Auth
4. Migrer Storage
5. Migrer les CRUD critiques:
   - Tenant
   - RestaurantProfile
   - UserAccess
   - PlatformAdminAccess
   - Product
   - Category
   - Order
   - DeliveryPerson
6. Brancher les functions serveur
7. Basculer `VITE_APP_BACKEND_MODE=supabase`
8. Deployer le front sur Vercel

## Tables a prevoir dans Supabase

- users metadata via Supabase Auth
- tenants
- restaurant_profiles
- user_access
- platform_admin_access
- products
- categories
- ingredients
- product_ingredients
- option_groups
- option_items
- orders
- customers
- delivery_people
- tables
- offers
- loyalty_rules
- cagnotte_rules
- cagnotte_history
- cloture_caisse
- drawer_openings
- tenant_invoices
- promo_codes
- customer_display_cart
- inscription_requests
- site_config
- scratch_ticket_config

## Stockage fichiers

Buckets conseilles:

- `restaurant-assets`
- `product-images`
- `marketing-assets`

## Deploiement Vercel

- Connecter le repo Git a Vercel
- Build command: `npm run build`
- Output directory: `dist`
- Variables d environnement a recopier depuis Supabase

## Important

Ne pas mettre `VITE_APP_BACKEND_MODE=supabase` tant que:

- les tables ne sont pas creees
- l auth n est pas branchee
- les CRUD principaux ne sont pas migres
