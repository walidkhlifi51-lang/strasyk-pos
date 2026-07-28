# STRASYK POS - Phase 1 Foundations

Date: 2026-07-28

## Objectif

Cette phase prepare l'architecture sans modifier le comportement metier visible.

## Services crees et reellement utiles maintenant

- `src/services/auth/authService.js`
- `src/services/tenant/tenantService.js`
- `src/services/catalog/catalogService.js`
- `src/services/orders/orderService.js`
- `src/services/customers/customerService.js`
- `src/services/analytics/analyticsService.js`
- `src/services/billing/invoiceService.js`
- `src/services/integrations/integrationService.js`

## Contrats / interfaces minimales prepares

- `paymentService`
- `loyaltyService`
- `deliveryIntegrationService`
- `paymentProviderService`
- `eInvoicingService`
- `accountingIntegrationService`
- `notificationService`

## Couche serveur preparee

Fichiers:

- `src/services/server/rpcClient.js`
- `src/services/server/edgeFunctionsClient.js`
- `src/services/server/serverContracts.js`

Regle:

- aucune fausse RPC n'est implemente;
- seuls les contrats et points d'entree sont prepares.

## API STRASYK versionnee

Structure preparee:

- `src/services/api/strasykApi/v1/contracts.js`
- `src/services/api/strasykApi/v1/client.js`

Convention:

- les integrations existantes s'appuieront sur `/api/v1`;
- toute evolution incompatible passera par `/api/v2/`;
- les contrats v1 resteront stables.

## OpenAPI

Pas de specification complete generee dans cette phase.

Conventions retenues:

- prefixe: `/api/v1`
- contenu: `application/json`
- idempotence: header `Idempotency-Key`
- contexte tenant: header `X-Strasyk-Tenant`

## Routes debug / maintenance protegees

Pages concernees:

- `AuditTenant`
- `CleanupTenant`
- `DebugTenant`
- `DiagnosticClients`
- `DiagnosticTenant`
- `TenantDebug`
- `TenantFix`
- `TenantSetup`

Regle d'acces:

- autorisees en developpement;
- ou si `VITE_ENABLE_TECH_ROUTES=true`;
- ou si l'utilisateur authentifie porte le role auth `admin`.

Verification production:

1. construire l'application sans `VITE_ENABLE_TECH_ROUTES=true`;
2. verifier qu'une URL comme `/AuditTenant` ou `/TenantDebug` tombe sur la page de repli;
3. verifier que ces routes ne sont plus dans le routage commercial.

## Contrats serveur critiques prepares

Operations documentees dans `serverContracts.js`:

- creation atomique d'une commande
- modification controlee
- annulation
- encaissement
- fidelite
- affectation livraison
- creation de facture
- creation d'avoir

## Integrations externes

### STRASYK Delivery

Le contrat prepare uniquement les besoins cote POS:

- creer une mission
- consulter une mission
- annuler une mission
- consulter un statut
- relancer une synchronisation

Aucune hypothese n'est prise sur Base44 ni sur l'API finale.

### Paiements

Une interface fournisseur generique est preparee pour pouvoir connecter plus tard:

- Stripe
- myPOS
- Worldline
- Adyen
- autres

### Facturation electronique

Une interface fournisseur generique est preparee pour:

- Pennylane
- autre PDP
- logiciel comptable

Le POS reste independant du fournisseur.

## Problemes decouverts mais non corriges

- le backend `localAppClient` reste une base parallele officielle dans l'etat actuel;
- `StrasykPos.jsx` porte encore une logique metier importante;
- plusieurs grandes pages hors perimetre Phase 1 parlent encore directement a `appClient`;
- la config `jsconfig.json` ne couvre pas encore l'ensemble des nouveaux dossiers pour `typecheck`;
- la base Git du workspace ne permet pas les ecritures dans `.git` sans elevation.

## Reporte en Phase 1B ou Phase 2

- migration de `Statistiques.jsx`
- migration de `Comptabilite.jsx`
- migration de `OrderOnline.jsx`
- migration de `Kiosk.jsx`
- extraction serveur reelle des transactions critiques
- retrait du backend local comme source officielle
