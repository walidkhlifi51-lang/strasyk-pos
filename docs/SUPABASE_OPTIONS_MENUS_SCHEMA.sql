-- Migration incrementale pour Options + Menus.
-- A executer apres les scripts produits / ingredients.

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

alter table public.option_groups
  alter column product_id drop not null,
  add column if not exists is_template boolean not null default false,
  add column if not exists template_group_id uuid;

create index if not exists idx_option_groups_is_template on public.option_groups(is_template);
create index if not exists idx_option_groups_template_group_id on public.option_groups(template_group_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'option_groups_template_group_id_fkey'
  ) then
    alter table public.option_groups
      add constraint option_groups_template_group_id_fkey
      foreign key (template_group_id) references public.option_groups(id) on delete set null;
  end if;
end $$;

alter table public.option_items
  add column if not exists is_default boolean not null default false;

create table if not exists public.menu_formulas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nom text not null,
  description text,
  prix numeric(10,2) not null default 0,
  category_id uuid,
  disponible boolean not null default true,
  color text,
  image_url text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint menu_formulas_prix_positive_check check (prix >= 0)
);

create index if not exists idx_menu_formulas_tenant_id on public.menu_formulas(tenant_id);
create index if not exists idx_menu_formulas_category_id on public.menu_formulas(category_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_formulas_tenant_id_fkey'
  ) then
    alter table public.menu_formulas
      add constraint menu_formulas_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_formulas_category_id_fkey'
  ) then
    alter table public.menu_formulas
      add constraint menu_formulas_category_id_fkey
      foreign key (category_id) references public.categories(id) on delete set null;
  end if;
end $$;

create table if not exists public.menu_formula_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  menu_formula_id uuid not null,
  category_id uuid,
  nom_affichage text,
  quantite integer not null default 1,
  taille_fixe text,
  produits_inclus jsonb not null default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint menu_formula_items_quantite_positive_check check (quantite > 0),
  constraint menu_formula_items_produits_inclus_array_check check (jsonb_typeof(produits_inclus) = 'array')
);

create index if not exists idx_menu_formula_items_tenant_id on public.menu_formula_items(tenant_id);
create index if not exists idx_menu_formula_items_menu_formula_id on public.menu_formula_items(menu_formula_id);
create index if not exists idx_menu_formula_items_category_id on public.menu_formula_items(category_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_formula_items_tenant_id_fkey'
  ) then
    alter table public.menu_formula_items
      add constraint menu_formula_items_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_formula_items_menu_formula_id_fkey'
  ) then
    alter table public.menu_formula_items
      add constraint menu_formula_items_menu_formula_id_fkey
      foreign key (menu_formula_id) references public.menu_formulas(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_formula_items_category_id_fkey'
  ) then
    alter table public.menu_formula_items
      add constraint menu_formula_items_category_id_fkey
      foreign key (category_id) references public.categories(id) on delete set null;
  end if;
end $$;

drop trigger if exists trg_menu_formulas_set_updated_date on public.menu_formulas;
create trigger trg_menu_formulas_set_updated_date
before update on public.menu_formulas
for each row
execute function public.set_updated_date();

drop trigger if exists trg_menu_formula_items_set_updated_date on public.menu_formula_items;
create trigger trg_menu_formula_items_set_updated_date
before update on public.menu_formula_items
for each row
execute function public.set_updated_date();

commit;
