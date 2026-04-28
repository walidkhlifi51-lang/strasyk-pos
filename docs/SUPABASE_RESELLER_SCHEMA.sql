-- Schema revendeurs / marque blanche.
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

create table if not exists public.resellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'standard',
  status text not null default 'active',
  owner_user_id uuid,
  contact_email text,
  contact_phone text,
  company_name text,
  address text,
  siret text,
  vat_number text,
  kbis_document_url text,
  identity_document_url text,
  other_document_url text,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint resellers_type_check check (type in ('standard', 'white_label')),
  constraint resellers_status_check check (status in ('active', 'suspended'))
);

alter table public.resellers
  add column if not exists name text,
  add column if not exists type text not null default 'standard',
  add column if not exists status text not null default 'active',
  add column if not exists owner_user_id uuid,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists company_name text,
  add column if not exists address text,
  add column if not exists siret text,
  add column if not exists vat_number text,
  add column if not exists kbis_document_url text,
  add column if not exists identity_document_url text,
  add column if not exists other_document_url text,
  add column if not exists notes text,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create index if not exists idx_resellers_status on public.resellers(status);
create index if not exists idx_resellers_contact_email on public.resellers(contact_email);

create table if not exists public.reseller_users (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null,
  user_email text not null,
  role text not null default 'manager',
  status text not null default 'active',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint reseller_users_role_check check (role in ('owner', 'manager', 'sales', 'support')),
  constraint reseller_users_status_check check (status in ('active', 'suspended'))
);

alter table public.reseller_users
  add column if not exists reseller_id uuid,
  add column if not exists user_email text,
  add column if not exists role text not null default 'manager',
  add column if not exists status text not null default 'active',
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create unique index if not exists uq_reseller_users_unique_email
  on public.reseller_users(reseller_id, lower(user_email));
create index if not exists idx_reseller_users_user_email on public.reseller_users(lower(user_email));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reseller_users_reseller_id_fkey') then
    alter table public.reseller_users
      add constraint reseller_users_reseller_id_fkey
      foreign key (reseller_id) references public.resellers(id) on delete cascade;
  end if;
end $$;

create table if not exists public.reseller_branding (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null,
  brand_name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  support_email text,
  support_phone text,
  custom_domain text,
  domain_verified boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.reseller_branding
  add column if not exists reseller_id uuid,
  add column if not exists brand_name text,
  add column if not exists logo_url text,
  add column if not exists primary_color text,
  add column if not exists secondary_color text,
  add column if not exists support_email text,
  add column if not exists support_phone text,
  add column if not exists custom_domain text,
  add column if not exists domain_verified boolean not null default false,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create unique index if not exists uq_reseller_branding_reseller_id
  on public.reseller_branding(reseller_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reseller_branding_reseller_id_fkey') then
    alter table public.reseller_branding
      add constraint reseller_branding_reseller_id_fkey
      foreign key (reseller_id) references public.resellers(id) on delete cascade;
  end if;
end $$;

create table if not exists public.reseller_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null,
  offer_code text not null,
  billing_type text not null default 'monthly',
  cost_price numeric(10,2) not null default 0,
  reseller_price numeric(10,2) not null default 0,
  public_price numeric(10,2) not null default 0,
  commission_type text not null default 'fixed',
  commission_value numeric(10,2) not null default 0,
  active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint reseller_pricing_rules_billing_type_check check (billing_type in ('monthly', 'yearly', 'one_shot')),
  constraint reseller_pricing_rules_commission_type_check check (commission_type in ('fixed', 'percentage', 'margin'))
);

alter table public.reseller_pricing_rules
  add column if not exists reseller_id uuid,
  add column if not exists offer_code text,
  add column if not exists billing_type text not null default 'monthly',
  add column if not exists cost_price numeric(10,2) not null default 0,
  add column if not exists reseller_price numeric(10,2) not null default 0,
  add column if not exists public_price numeric(10,2) not null default 0,
  add column if not exists commission_type text not null default 'fixed',
  add column if not exists commission_value numeric(10,2) not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create index if not exists idx_reseller_pricing_rules_reseller_id on public.reseller_pricing_rules(reseller_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reseller_pricing_rules_reseller_id_fkey') then
    alter table public.reseller_pricing_rules
      add constraint reseller_pricing_rules_reseller_id_fkey
      foreign key (reseller_id) references public.resellers(id) on delete cascade;
  end if;
end $$;

create table if not exists public.reseller_tenants (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null,
  tenant_id uuid not null,
  acquisition_channel text,
  subscription_plan text,
  billing_type text,
  sale_price numeric(10,2) not null default 0,
  cost_price numeric(10,2) not null default 0,
  commission_type text,
  commission_value numeric(10,2),
  signed_at timestamptz,
  started_at timestamptz,
  status text not null default 'active',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint reseller_tenants_status_check check (status in ('active', 'inactive', 'cancelled')),
  constraint reseller_tenants_commission_type_check check (commission_type is null or commission_type in ('fixed', 'percentage', 'margin'))
);

alter table public.reseller_tenants
  add column if not exists reseller_id uuid,
  add column if not exists tenant_id uuid,
  add column if not exists acquisition_channel text,
  add column if not exists subscription_plan text,
  add column if not exists billing_type text,
  add column if not exists sale_price numeric(10,2) not null default 0,
  add column if not exists cost_price numeric(10,2) not null default 0,
  add column if not exists commission_type text,
  add column if not exists commission_value numeric(10,2),
  add column if not exists signed_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists status text not null default 'active',
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create unique index if not exists uq_reseller_tenants_active_tenant
  on public.reseller_tenants(tenant_id)
  where status = 'active';
create index if not exists idx_reseller_tenants_reseller_id on public.reseller_tenants(reseller_id);
create index if not exists idx_reseller_tenants_tenant_id on public.reseller_tenants(tenant_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reseller_tenants_reseller_id_fkey') then
    alter table public.reseller_tenants
      add constraint reseller_tenants_reseller_id_fkey
      foreign key (reseller_id) references public.resellers(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reseller_tenants_tenant_id_fkey') then
    alter table public.reseller_tenants
      add constraint reseller_tenants_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

create table if not exists public.reseller_commissions (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null,
  tenant_id uuid,
  source_type text not null default 'sale',
  source_reference text,
  period_start date,
  period_end date,
  base_amount numeric(10,2) not null default 0,
  commission_amount numeric(10,2) not null default 0,
  status text not null default 'pending',
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint reseller_commissions_source_type_check check (source_type in ('sale', 'recurring', 'setup', 'bonus', 'adjustment')),
  constraint reseller_commissions_status_check check (status in ('pending', 'approved', 'paid', 'cancelled'))
);

alter table public.reseller_commissions
  add column if not exists reseller_id uuid,
  add column if not exists tenant_id uuid,
  add column if not exists source_type text not null default 'sale',
  add column if not exists source_reference text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists base_amount numeric(10,2) not null default 0,
  add column if not exists commission_amount numeric(10,2) not null default 0,
  add column if not exists status text not null default 'pending',
  add column if not exists notes text,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create index if not exists idx_reseller_commissions_reseller_id on public.reseller_commissions(reseller_id);
create index if not exists idx_reseller_commissions_status on public.reseller_commissions(status);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reseller_commissions_reseller_id_fkey') then
    alter table public.reseller_commissions
      add constraint reseller_commissions_reseller_id_fkey
      foreign key (reseller_id) references public.resellers(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reseller_commissions_tenant_id_fkey') then
    alter table public.reseller_commissions
      add constraint reseller_commissions_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete set null;
  end if;
end $$;

create table if not exists public.reseller_payouts (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null,
  period_start date,
  period_end date,
  total_amount numeric(10,2) not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint reseller_payouts_status_check check (status in ('pending', 'approved', 'paid', 'cancelled'))
);

alter table public.reseller_payouts
  add column if not exists reseller_id uuid,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists total_amount numeric(10,2) not null default 0,
  add column if not exists status text not null default 'pending',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_reference text,
  add column if not exists notes text,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create index if not exists idx_reseller_payouts_reseller_id on public.reseller_payouts(reseller_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reseller_payouts_reseller_id_fkey') then
    alter table public.reseller_payouts
      add constraint reseller_payouts_reseller_id_fkey
      foreign key (reseller_id) references public.resellers(id) on delete cascade;
  end if;
end $$;

drop trigger if exists trg_resellers_set_updated_date on public.resellers;
create trigger trg_resellers_set_updated_date
before update on public.resellers
for each row
execute function public.set_updated_date();

drop trigger if exists trg_reseller_users_set_updated_date on public.reseller_users;
create trigger trg_reseller_users_set_updated_date
before update on public.reseller_users
for each row
execute function public.set_updated_date();

drop trigger if exists trg_reseller_branding_set_updated_date on public.reseller_branding;
create trigger trg_reseller_branding_set_updated_date
before update on public.reseller_branding
for each row
execute function public.set_updated_date();

drop trigger if exists trg_reseller_pricing_rules_set_updated_date on public.reseller_pricing_rules;
create trigger trg_reseller_pricing_rules_set_updated_date
before update on public.reseller_pricing_rules
for each row
execute function public.set_updated_date();

drop trigger if exists trg_reseller_tenants_set_updated_date on public.reseller_tenants;
create trigger trg_reseller_tenants_set_updated_date
before update on public.reseller_tenants
for each row
execute function public.set_updated_date();

drop trigger if exists trg_reseller_commissions_set_updated_date on public.reseller_commissions;
create trigger trg_reseller_commissions_set_updated_date
before update on public.reseller_commissions
for each row
execute function public.set_updated_date();

drop trigger if exists trg_reseller_payouts_set_updated_date on public.reseller_payouts;
create trigger trg_reseller_payouts_set_updated_date
before update on public.reseller_payouts
for each row
execute function public.set_updated_date();

commit;
