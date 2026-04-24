-- Schema coeur caisse / tables / affichage client / cloture.
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

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  numero_commande text,
  numero_caisse integer,
  type_commande text not null default 'sur_place',
  customer_id uuid,
  table_id uuid,
  delivery_person_id uuid,
  delivery_address text,
  articles jsonb not null default '[]'::jsonb,
  total_ht numeric(10,2) not null default 0,
  total_tva numeric(10,2) not null default 0,
  total_ttc numeric(10,2) not null default 0,
  statut text not null default 'en_attente',
  mode_paiement jsonb not null default '[]'::jsonb,
  mode_paiement_prevu text,
  payee boolean not null default false,
  notes text,
  cagnotte_spent numeric(10,2) not null default 0,
  scratch_reduction numeric(10,2) not null default 0,
  print_at_counter boolean not null default false,
  from_kiosk boolean not null default false,
  from_web boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint orders_type_commande_check check (type_commande in ('sur_place', 'emporter', 'livraison')),
  constraint orders_articles_array_check check (jsonb_typeof(articles) = 'array'),
  constraint orders_mode_paiement_array_check check (jsonb_typeof(mode_paiement) = 'array'),
  constraint orders_total_ht_positive_check check (total_ht >= 0),
  constraint orders_total_tva_positive_check check (total_tva >= 0),
  constraint orders_total_ttc_positive_check check (total_ttc >= 0),
  constraint orders_cagnotte_spent_positive_check check (cagnotte_spent >= 0),
  constraint orders_scratch_reduction_positive_check check (scratch_reduction >= 0)
);

alter table public.orders
  add column if not exists numero_commande text,
  add column if not exists numero_caisse integer,
  add column if not exists type_commande text default 'sur_place',
  add column if not exists customer_id uuid,
  add column if not exists table_id uuid,
  add column if not exists delivery_person_id uuid,
  add column if not exists delivery_address text,
  add column if not exists articles jsonb not null default '[]'::jsonb,
  add column if not exists total_ht numeric(10,2) not null default 0,
  add column if not exists total_tva numeric(10,2) not null default 0,
  add column if not exists total_ttc numeric(10,2) not null default 0,
  add column if not exists statut text not null default 'en_attente',
  add column if not exists mode_paiement jsonb not null default '[]'::jsonb,
  add column if not exists mode_paiement_prevu text,
  add column if not exists payee boolean not null default false,
  add column if not exists notes text,
  add column if not exists cagnotte_spent numeric(10,2) not null default 0,
  add column if not exists scratch_reduction numeric(10,2) not null default 0,
  add column if not exists print_at_counter boolean not null default false,
  add column if not exists from_kiosk boolean not null default false,
  add column if not exists from_web boolean not null default false,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

alter table public.orders
  alter column created_date set default now(),
  alter column updated_date set default now();

update public.orders
set created_date = coalesce(created_date, now()),
    updated_date = coalesce(updated_date, now())
where created_date is null
   or updated_date is null;

create index if not exists idx_orders_tenant_id on public.orders(tenant_id);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_table_id on public.orders(table_id);
create index if not exists idx_orders_delivery_person_id on public.orders(delivery_person_id);
create index if not exists idx_orders_created_date on public.orders(created_date desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_tenant_id_fkey') then
    alter table public.orders
      add constraint orders_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_customer_id_fkey') then
    alter table public.orders
      add constraint orders_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete set null;
  end if;
end $$;

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nom text not null,
  capacite integer not null default 1,
  statut text not null default 'disponible',
  order_id uuid,
  position_x numeric(10,2),
  position_y numeric(10,2),
  zone text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint tables_capacite_positive_check check (capacite > 0),
  constraint tables_statut_check check (statut in ('disponible', 'occupee', 'reservee', 'a_nettoyer'))
);

alter table public.tables
  add column if not exists tenant_id uuid,
  add column if not exists nom text,
  add column if not exists capacite integer not null default 1,
  add column if not exists statut text not null default 'disponible',
  add column if not exists order_id uuid,
  add column if not exists position_x numeric(10,2),
  add column if not exists position_y numeric(10,2),
  add column if not exists zone text,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create index if not exists idx_tables_tenant_id on public.tables(tenant_id);
create index if not exists idx_tables_order_id on public.tables(order_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tables_tenant_id_fkey') then
    alter table public.tables
      add constraint tables_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_table_id_fkey') then
    alter table public.orders
      add constraint orders_table_id_fkey
      foreign key (table_id) references public.tables(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tables_order_id_fkey') then
    alter table public.tables
      add constraint tables_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete set null;
  end if;
end $$;

create table if not exists public.cloture_caisse (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  date_cloture timestamptz not null default now(),
  statut text not null default 'en_cours',
  montant_theorique jsonb,
  montant_reel jsonb,
  ecarts jsonb,
  created_by text,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.cloture_caisse
  add column if not exists tenant_id uuid,
  add column if not exists date_cloture timestamptz not null default now(),
  add column if not exists statut text not null default 'en_cours',
  add column if not exists montant_theorique jsonb,
  add column if not exists montant_reel jsonb,
  add column if not exists ecarts jsonb,
  add column if not exists created_by text,
  add column if not exists notes text,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create index if not exists idx_cloture_caisse_tenant_id on public.cloture_caisse(tenant_id);
create unique index if not exists uq_cloture_caisse_tenant_day
  on public.cloture_caisse(tenant_id, ((date_cloture at time zone 'UTC')::date));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cloture_caisse_tenant_id_fkey') then
    alter table public.cloture_caisse
      add constraint cloture_caisse_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

create table if not exists public.drawer_openings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  reason text,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.drawer_openings
  add column if not exists tenant_id uuid,
  add column if not exists reason text,
  add column if not exists created_by text,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create index if not exists idx_drawer_openings_tenant_id on public.drawer_openings(tenant_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'drawer_openings_tenant_id_fkey') then
    alter table public.drawer_openings
      add constraint drawer_openings_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

create table if not exists public.customer_display_cart (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  cart_data jsonb,
  updated_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.customer_display_cart
  add column if not exists tenant_id uuid,
  add column if not exists cart_data jsonb,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create unique index if not exists uq_customer_display_cart_tenant on public.customer_display_cart(tenant_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customer_display_cart_tenant_id_fkey') then
    alter table public.customer_display_cart
      add constraint customer_display_cart_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

drop trigger if exists trg_orders_set_updated_date on public.orders;
create trigger trg_orders_set_updated_date
before update on public.orders
for each row
execute function public.set_updated_date();

drop trigger if exists trg_tables_set_updated_date on public.tables;
create trigger trg_tables_set_updated_date
before update on public.tables
for each row
execute function public.set_updated_date();

drop trigger if exists trg_cloture_caisse_set_updated_date on public.cloture_caisse;
create trigger trg_cloture_caisse_set_updated_date
before update on public.cloture_caisse
for each row
execute function public.set_updated_date();

drop trigger if exists trg_drawer_openings_set_updated_date on public.drawer_openings;
create trigger trg_drawer_openings_set_updated_date
before update on public.drawer_openings
for each row
execute function public.set_updated_date();

drop trigger if exists trg_customer_display_cart_set_updated_date on public.customer_display_cart;
create trigger trg_customer_display_cart_set_updated_date
before update on public.customer_display_cart
for each row
execute function public.set_updated_date();

commit;
