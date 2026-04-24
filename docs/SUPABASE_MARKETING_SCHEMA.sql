-- Schema marketing / fidelite / promo / cagnotte.
-- A executer dans Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nom text not null,
  description text,
  active boolean not null default true,
  canaux jsonb not null default '["caisse"]'::jsonb,
  modes_commande jsonb not null default '["sur_place","emporter","livraison"]'::jsonb,
  type_condition text not null default 'product',
  condition_ids jsonb not null default '[]'::jsonb,
  condition_sizes jsonb not null default '[]'::jsonb,
  condition_excluded_product_ids jsonb not null default '[]'::jsonb,
  quantite_requise integer not null default 2,
  type_recompense text not null default 'product',
  recompense_ids jsonb not null default '[]'::jsonb,
  recompense_sizes jsonb not null default '[]'::jsonb,
  recompense_excluded_product_ids jsonb not null default '[]'::jsonb,
  quantite_offerte integer not null default 1,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint offers_type_condition_check check (type_condition in ('product', 'category')),
  constraint offers_type_recompense_check check (type_recompense in ('product', 'category')),
  constraint offers_quantite_requise_positive_check check (quantite_requise > 0),
  constraint offers_quantite_offerte_positive_check check (quantite_offerte > 0),
  constraint offers_canaux_array_check check (jsonb_typeof(canaux) = 'array'),
  constraint offers_modes_commande_array_check check (jsonb_typeof(modes_commande) = 'array'),
  constraint offers_condition_ids_array_check check (jsonb_typeof(condition_ids) = 'array'),
  constraint offers_condition_sizes_array_check check (jsonb_typeof(condition_sizes) = 'array'),
  constraint offers_condition_excluded_ids_array_check check (jsonb_typeof(condition_excluded_product_ids) = 'array'),
  constraint offers_recompense_ids_array_check check (jsonb_typeof(recompense_ids) = 'array'),
  constraint offers_recompense_sizes_array_check check (jsonb_typeof(recompense_sizes) = 'array'),
  constraint offers_recompense_excluded_ids_array_check check (jsonb_typeof(recompense_excluded_product_ids) = 'array')
);

create index if not exists idx_offers_tenant_id on public.offers(tenant_id);
create index if not exists idx_offers_active on public.offers(active);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'offers_tenant_id_fkey'
  ) then
    alter table public.offers
      add constraint offers_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  code text not null,
  description text,
  type text not null default 'percentage',
  value numeric(10,2) not null default 0,
  active boolean not null default true,
  canaux jsonb not null default '["caisse"]'::jsonb,
  modes_commande jsonb not null default '["sur_place","emporter","livraison"]'::jsonb,
  usage_limit integer,
  usage_count integer not null default 0,
  expires_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint promo_codes_type_check check (type in ('percentage', 'fixed_amount')),
  constraint promo_codes_value_positive_check check (value >= 0),
  constraint promo_codes_usage_limit_positive_check check (usage_limit is null or usage_limit > 0),
  constraint promo_codes_usage_count_positive_check check (usage_count >= 0),
  constraint promo_codes_canaux_array_check check (jsonb_typeof(canaux) = 'array'),
  constraint promo_codes_modes_commande_array_check check (jsonb_typeof(modes_commande) = 'array')
);

create unique index if not exists uq_promo_codes_tenant_code on public.promo_codes(tenant_id, code);
create index if not exists idx_promo_codes_tenant_id on public.promo_codes(tenant_id);
create index if not exists idx_promo_codes_active on public.promo_codes(active);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'promo_codes_tenant_id_fkey'
  ) then
    alter table public.promo_codes
      add constraint promo_codes_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

create table if not exists public.loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nom text not null,
  description text,
  numero_commande integer not null default 1,
  active boolean not null default true,
  canaux jsonb not null default '["caisse"]'::jsonb,
  modes_commande jsonb not null default '["sur_place","emporter","livraison"]'::jsonb,
  type_recompense text not null default 'percentage_discount',
  valeur_recompense numeric(10,2),
  produit_offert_ids jsonb not null default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint loyalty_rules_numero_commande_positive_check check (numero_commande > 0),
  constraint loyalty_rules_type_recompense_check check (type_recompense in ('percentage_discount', 'fixed_discount', 'free_product')),
  constraint loyalty_rules_valeur_positive_check check (valeur_recompense is null or valeur_recompense >= 0),
  constraint loyalty_rules_canaux_array_check check (jsonb_typeof(canaux) = 'array'),
  constraint loyalty_rules_modes_commande_array_check check (jsonb_typeof(modes_commande) = 'array'),
  constraint loyalty_rules_produit_offert_ids_array_check check (jsonb_typeof(produit_offert_ids) = 'array')
);

create index if not exists idx_loyalty_rules_tenant_id on public.loyalty_rules(tenant_id);
create index if not exists idx_loyalty_rules_active on public.loyalty_rules(active);
create unique index if not exists uq_loyalty_rules_tenant_order on public.loyalty_rules(tenant_id, numero_commande);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'loyalty_rules_tenant_id_fkey'
  ) then
    alter table public.loyalty_rules
      add constraint loyalty_rules_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

create table if not exists public.cagnotte_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nom text not null,
  accumulation_rate numeric(10,4) not null default 0,
  active boolean not null default false,
  canaux jsonb not null default '["caisse"]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint cagnotte_rules_accumulation_rate_positive_check check (accumulation_rate >= 0),
  constraint cagnotte_rules_canaux_array_check check (jsonb_typeof(canaux) = 'array')
);

create index if not exists idx_cagnotte_rules_tenant_id on public.cagnotte_rules(tenant_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cagnotte_rules_tenant_id_fkey'
  ) then
    alter table public.cagnotte_rules
      add constraint cagnotte_rules_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

create table if not exists public.cagnotte_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  customer_id uuid not null,
  order_id uuid,
  type text not null,
  amount numeric(10,2) not null,
  balance_before numeric(10,2) not null default 0,
  balance_after numeric(10,2) not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint cagnotte_history_type_check check (type in ('earn', 'spend', 'adjustment')),
  constraint cagnotte_history_balance_before_check check (balance_before >= 0),
  constraint cagnotte_history_balance_after_check check (balance_after >= 0)
);

create index if not exists idx_cagnotte_history_tenant_id on public.cagnotte_history(tenant_id);
create index if not exists idx_cagnotte_history_customer_id on public.cagnotte_history(customer_id);
create index if not exists idx_cagnotte_history_order_id on public.cagnotte_history(order_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cagnotte_history_tenant_id_fkey'
  ) then
    alter table public.cagnotte_history
      add constraint cagnotte_history_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cagnotte_history_customer_id_fkey'
  ) then
    alter table public.cagnotte_history
      add constraint cagnotte_history_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cagnotte_history_order_id_fkey'
  ) then
    alter table public.cagnotte_history
      add constraint cagnotte_history_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete set null;
  end if;
end $$;

drop trigger if exists trg_offers_set_updated_date on public.offers;
create trigger trg_offers_set_updated_date
before update on public.offers
for each row
execute function public.set_updated_date();

drop trigger if exists trg_promo_codes_set_updated_date on public.promo_codes;
create trigger trg_promo_codes_set_updated_date
before update on public.promo_codes
for each row
execute function public.set_updated_date();

drop trigger if exists trg_loyalty_rules_set_updated_date on public.loyalty_rules;
create trigger trg_loyalty_rules_set_updated_date
before update on public.loyalty_rules
for each row
execute function public.set_updated_date();

drop trigger if exists trg_cagnotte_rules_set_updated_date on public.cagnotte_rules;
create trigger trg_cagnotte_rules_set_updated_date
before update on public.cagnotte_rules
for each row
execute function public.set_updated_date();

drop trigger if exists trg_cagnotte_history_set_updated_date on public.cagnotte_history;
create trigger trg_cagnotte_history_set_updated_date
before update on public.cagnotte_history
for each row
execute function public.set_updated_date();

commit;
