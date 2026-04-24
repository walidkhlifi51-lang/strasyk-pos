-- Schema incrementale pour customers.
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

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nom text not null,
  prenom text,
  telephone text not null,
  email text,
  adresse text,
  code_postal text,
  ville text,
  etage text,
  interphone text,
  notes text,
  adresses jsonb not null default '[]'::jsonb,
  cagnotte_balance numeric(10,2) not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint customers_adresses_array_check check (jsonb_typeof(adresses) = 'array'),
  constraint customers_cagnotte_balance_positive_check check (cagnotte_balance >= 0)
);

alter table public.customers
  add column if not exists prenom text,
  add column if not exists telephone text,
  add column if not exists email text,
  add column if not exists adresse text,
  add column if not exists code_postal text,
  add column if not exists ville text,
  add column if not exists etage text,
  add column if not exists interphone text,
  add column if not exists notes text,
  add column if not exists adresses jsonb not null default '[]'::jsonb,
  add column if not exists cagnotte_balance numeric(10,2) not null default 0,
  add column if not exists updated_date timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_adresses_array_check'
  ) then
    alter table public.customers
      add constraint customers_adresses_array_check
      check (jsonb_typeof(adresses) = 'array') not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_cagnotte_balance_positive_check'
  ) then
    alter table public.customers
      add constraint customers_cagnotte_balance_positive_check
      check (cagnotte_balance >= 0) not valid;
  end if;
end $$;

create index if not exists idx_customers_tenant_id on public.customers(tenant_id);
create index if not exists idx_customers_telephone on public.customers(telephone);
create index if not exists idx_customers_nom on public.customers(nom);
create unique index if not exists uq_customers_tenant_telephone on public.customers(tenant_id, telephone);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_tenant_id_fkey'
  ) then
    alter table public.customers
      add constraint customers_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

drop trigger if exists trg_customers_set_updated_date on public.customers;
create trigger trg_customers_set_updated_date
before update on public.customers
for each row
execute function public.set_updated_date();

commit;
