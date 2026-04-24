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

create table if not exists public.delivery_verification_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  delivery_person_id uuid not null,
  verification_date date not null,
  expected_total numeric(10,2) not null default 0,
  entered_total numeric(10,2) not null default 0,
  difference numeric(10,2) not null default 0,
  payment_breakdown jsonb not null default '[]'::jsonb,
  order_ids jsonb not null default '[]'::jsonb,
  orders_snapshot jsonb not null default '[]'::jsonb,
  created_by text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint delivery_verification_logs_expected_total_positive_check check (expected_total >= 0),
  constraint delivery_verification_logs_entered_total_positive_check check (entered_total >= 0),
  constraint delivery_verification_logs_payment_breakdown_array_check check (jsonb_typeof(payment_breakdown) = 'array'),
  constraint delivery_verification_logs_order_ids_array_check check (jsonb_typeof(order_ids) = 'array'),
  constraint delivery_verification_logs_orders_snapshot_array_check check (jsonb_typeof(orders_snapshot) = 'array')
);

alter table public.delivery_verification_logs
  add column if not exists tenant_id uuid,
  add column if not exists delivery_person_id uuid,
  add column if not exists verification_date date,
  add column if not exists expected_total numeric(10,2) not null default 0,
  add column if not exists entered_total numeric(10,2) not null default 0,
  add column if not exists difference numeric(10,2) not null default 0,
  add column if not exists payment_breakdown jsonb not null default '[]'::jsonb,
  add column if not exists order_ids jsonb not null default '[]'::jsonb,
  add column if not exists orders_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists created_by text,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

create index if not exists idx_delivery_verification_logs_tenant_id on public.delivery_verification_logs(tenant_id);
create index if not exists idx_delivery_verification_logs_delivery_person_id on public.delivery_verification_logs(delivery_person_id);
create index if not exists idx_delivery_verification_logs_verification_date on public.delivery_verification_logs(verification_date desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'delivery_verification_logs_tenant_id_fkey') then
    alter table public.delivery_verification_logs
      add constraint delivery_verification_logs_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'delivery_verification_logs_delivery_person_id_fkey') then
    alter table public.delivery_verification_logs
      add constraint delivery_verification_logs_delivery_person_id_fkey
      foreign key (delivery_person_id) references public.delivery_people(id) on delete cascade;
  end if;
end $$;

drop trigger if exists trg_delivery_verification_logs_set_updated_date on public.delivery_verification_logs;
create trigger trg_delivery_verification_logs_set_updated_date
before update on public.delivery_verification_logs
for each row
execute function public.set_updated_date();

commit;
