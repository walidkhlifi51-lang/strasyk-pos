# Billing Architecture

## Goal

Utiliser une seule logique de facturation pour deux flux :

- `platform -> reseller`
- `reseller -> tenant`

L'UI reste la meme, seul l'emetteur change.

## Storage

La base existante `tenant_invoices` devient un document de facturation unifie avec :

- `issuer_type`
- `issuer_id`
- `recipient_type`
- `recipient_id`
- `tenant_id`
- `reseller_id`
- `issuer_snapshot`
- `recipient_snapshot`

`tenant_id` reste conserve pour ne pas casser l'existant.

## UI Placement

### Platform admin

- `ResellersPlatform`
- fiche revendeur
- onglet `Factures`

Contient les documents emis par la plateforme vers ce revendeur.

### Reseller portal

- fiche client commerce
- onglet `Factures`

Contient les documents emis par le revendeur vers ce commerce.

## Activation / Payment Logic

- un revendeur peut facturer son client
- la plateforme facture le revendeur
- l'activation des modules payants reste controlee par la plateforme
- les snapshots evitent qu'un changement de branding modifie les anciennes factures

## Implementation Path

1. Evoluer `tenant_invoices` avec `SUPABASE_BILLING_SCHEMA.sql`
2. Ajouter le RLS facture plateforme/revendeur
3. Rendre le PDF generique via `issuer_snapshot` et `recipient_snapshot`
4. Ajouter l'onglet `Factures` dans la fiche revendeur
5. Ajouter l'onglet `Factures` dans la fiche client revendeur
6. Ajouter demandes/validation d'activation module si necessaire
