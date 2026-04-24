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

create table if not exists public.delivery_people (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nom text not null,
  prenom text not null,
  telephone text not null,
  user_email text,
  username text,
  password text,
  vehicule text not null default 'scooter',
  disponible boolean not null default true,
  app_access_enabled boolean not null default true,
  en_livraison boolean not null default false,
  nb_livraisons_jour integer not null default 0,
  total_encaisse numeric(10,2) not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint delivery_people_vehicule_check check (vehicule in ('scooter', 'velo', 'voiture', 'moto')),
  constraint delivery_people_nb_livraisons_jour_positive_check check (nb_livraisons_jour >= 0),
  constraint delivery_people_total_encaisse_positive_check check (total_encaisse >= 0)
);

alter table public.delivery_people
  add column if not exists tenant_id uuid,
  add column if not exists nom text,
  add column if not exists prenom text,
  add column if not exists telephone text,
  add column if not exists user_email text,
  add column if not exists username text,
  add column if not exists password text,
  add column if not exists vehicule text not null default 'scooter',
  add column if not exists disponible boolean not null default true,
  add column if not exists app_access_enabled boolean not null default true,
  add column if not exists en_livraison boolean not null default false,
  add column if not exists nb_livraisons_jour integer not null default 0,
  add column if not exists total_encaisse numeric(10,2) not null default 0,
  add column if not exists created_date timestamptz not null default now(),
  add column if not exists updated_date timestamptz not null default now();

alter table public.delivery_people
  alter column username drop not null,
  alter column password drop not null;

create index if not exists idx_delivery_people_tenant_id on public.delivery_people(tenant_id);
create index if not exists idx_delivery_people_user_email on public.delivery_people(user_email);
create index if not exists idx_delivery_people_username on public.delivery_people(username);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'delivery_people_tenant_id_fkey') then
    alter table public.delivery_people
      add constraint delivery_people_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

drop trigger if exists trg_delivery_people_set_updated_date on public.delivery_people;
create trigger trg_delivery_people_set_updated_date
before update on public.delivery_people
for each row
execute function public.set_updated_date();

commit;
