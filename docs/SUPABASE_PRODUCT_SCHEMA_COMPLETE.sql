-- Schema complet pour la configuration produits Strasyk POS.
-- A executer dans Supabase SQL Editor.
-- Ce script complete la table products existante et cree les tables liees
-- pour ingredients, composition produit, groupes d'options et items d'options.
--
-- Il couvre aussi la gestion des tailles via :
-- - categories.manages_sizes
-- - categories.size_template
-- - products.size_prices
-- - products.prix_par_mode
-- - products.size_prix_par_mode
-- - products.web_size_prices

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

alter table public.products
  add column if not exists temps_preparation integer,
  add column if not exists tva numeric(6,2) not null default 5.5,
  add column if not exists base_price numeric(10,2),
  add column if not exists size_prices jsonb not null default '[]'::jsonb,
  add column if not exists prix_par_mode jsonb not null default '{}'::jsonb,
  add column if not exists size_prix_par_mode jsonb not null default '[]'::jsonb,
  add column if not exists web_price numeric(10,2),
  add column if not exists web_size_prices jsonb not null default '[]'::jsonb,
  add column if not exists color text,
  add column if not exists sort_order integer,
  add column if not exists updated_date timestamptz not null default now(),
  alter column created_date set default now();

alter table public.products
  add constraint products_tva_positive_check
    check (tva >= 0) not valid;

alter table public.products
  add constraint products_base_price_positive_check
    check (base_price is null or base_price >= 0) not valid;

alter table public.products
  add constraint products_prix_positive_check
    check (prix is null or prix >= 0) not valid;

alter table public.products
  add constraint products_json_size_prices_array_check
    check (jsonb_typeof(size_prices) = 'array') not valid;

alter table public.products
  add constraint products_json_prix_par_mode_object_check
    check (jsonb_typeof(prix_par_mode) = 'object') not valid;

alter table public.products
  add constraint products_json_size_prix_par_mode_array_check
    check (jsonb_typeof(size_prix_par_mode) = 'array') not valid;

alter table public.products
  add constraint products_json_web_size_prices_array_check
    check (jsonb_typeof(web_size_prices) = 'array') not valid;

create index if not exists idx_products_tenant_id on public.products(tenant_id);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_sort_order on public.products(sort_order);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_tenant_id_fkey'
  ) then
    alter table public.products
      add constraint products_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_category_id_fkey'
  ) then
    alter table public.products
      add constraint products_category_id_fkey
      foreign key (category_id) references public.categories(id) on delete restrict;
  end if;
end $$;

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nom text not null,
  unite text not null default 'g',
  cout_unitaire numeric(10,2),
  quantite_stock numeric(12,3) not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint ingredients_cout_positive_check check (cout_unitaire is null or cout_unitaire >= 0),
  constraint ingredients_stock_positive_check check (quantite_stock >= 0)
);

create index if not exists idx_ingredients_tenant_id on public.ingredients(tenant_id);
create index if not exists idx_ingredients_nom on public.ingredients(nom);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ingredients_tenant_id_fkey'
  ) then
    alter table public.ingredients
      add constraint ingredients_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

create table if not exists public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null,
  ingredient_id uuid not null,
  quantite numeric(12,3) not null default 0,
  retirable boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint product_ingredients_quantite_positive_check check (quantite >= 0)
);

create unique index if not exists uq_product_ingredients_product_ingredient
  on public.product_ingredients(product_id, ingredient_id);
create index if not exists idx_product_ingredients_tenant_id on public.product_ingredients(tenant_id);
create index if not exists idx_product_ingredients_product_id on public.product_ingredients(product_id);
create index if not exists idx_product_ingredients_ingredient_id on public.product_ingredients(ingredient_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_ingredients_tenant_id_fkey'
  ) then
    alter table public.product_ingredients
      add constraint product_ingredients_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_ingredients_product_id_fkey'
  ) then
    alter table public.product_ingredients
      add constraint product_ingredients_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_ingredients_ingredient_id_fkey'
  ) then
    alter table public.product_ingredients
      add constraint product_ingredients_ingredient_id_fkey
      foreign key (ingredient_id) references public.ingredients(id) on delete cascade;
  end if;
end $$;

create table if not exists public.option_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  product_id uuid not null,
  nom text not null,
  selection_type text not null default 'single',
  min_selections integer,
  max_selections integer,
  required boolean not null default false,
  manages_sizes boolean not null default false,
  size_template jsonb not null default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint option_groups_selection_type_check check (selection_type in ('single', 'multiple')),
  constraint option_groups_min_positive_check check (min_selections is null or min_selections >= 0),
  constraint option_groups_max_positive_check check (max_selections is null or max_selections >= 0),
  constraint option_groups_min_max_check check (
    min_selections is null
    or max_selections is null
    or min_selections <= max_selections
  ),
  constraint option_groups_size_template_array_check check (jsonb_typeof(size_template) = 'array')
);

create index if not exists idx_option_groups_tenant_id on public.option_groups(tenant_id);
create index if not exists idx_option_groups_product_id on public.option_groups(product_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'option_groups_tenant_id_fkey'
  ) then
    alter table public.option_groups
      add constraint option_groups_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'option_groups_product_id_fkey'
  ) then
    alter table public.option_groups
      add constraint option_groups_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end $$;

create table if not exists public.option_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  option_group_id uuid not null,
  nom text not null,
  price_surcharge numeric(10,2) not null default 0,
  size_surcharges jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint option_items_price_surcharge_check check (price_surcharge >= 0),
  constraint option_items_size_surcharges_object_check check (
    size_surcharges is null or jsonb_typeof(size_surcharges) = 'object'
  )
);

create index if not exists idx_option_items_tenant_id on public.option_items(tenant_id);
create index if not exists idx_option_items_group_id on public.option_items(option_group_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'option_items_tenant_id_fkey'
  ) then
    alter table public.option_items
      add constraint option_items_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'option_items_option_group_id_fkey'
  ) then
    alter table public.option_items
      add constraint option_items_option_group_id_fkey
      foreign key (option_group_id) references public.option_groups(id) on delete cascade;
  end if;
end $$;

drop trigger if exists trg_products_set_updated_date on public.products;
create trigger trg_products_set_updated_date
before update on public.products
for each row
execute function public.set_updated_date();

drop trigger if exists trg_ingredients_set_updated_date on public.ingredients;
create trigger trg_ingredients_set_updated_date
before update on public.ingredients
for each row
execute function public.set_updated_date();

drop trigger if exists trg_product_ingredients_set_updated_date on public.product_ingredients;
create trigger trg_product_ingredients_set_updated_date
before update on public.product_ingredients
for each row
execute function public.set_updated_date();

drop trigger if exists trg_option_groups_set_updated_date on public.option_groups;
create trigger trg_option_groups_set_updated_date
before update on public.option_groups
for each row
execute function public.set_updated_date();

drop trigger if exists trg_option_items_set_updated_date on public.option_items;
create trigger trg_option_items_set_updated_date
before update on public.option_items
for each row
execute function public.set_updated_date();

commit;
