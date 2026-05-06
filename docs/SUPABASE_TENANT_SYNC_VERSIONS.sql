begin;

create table if not exists public.tenant_sync_versions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  products_version timestamptz,
  menu_version timestamptz,
  settings_version timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_tenant_sync_versions()
returns trigger
language plpgsql
as $$
begin
  insert into public.tenant_sync_versions (
    tenant_id,
    products_version,
    menu_version,
    settings_version,
    updated_at
  )
  values (
    coalesce(new.tenant_id, old.tenant_id),
    case when tg_argv[0] = 'products' then now() else null end,
    case when tg_argv[0] = 'menu' then now() else null end,
    case when tg_argv[0] = 'settings' then now() else null end,
    now()
  )
  on conflict (tenant_id) do update set
    products_version = case
      when tg_argv[0] = 'products' then now()
      else public.tenant_sync_versions.products_version
    end,
    menu_version = case
      when tg_argv[0] = 'menu' then now()
      else public.tenant_sync_versions.menu_version
    end,
    settings_version = case
      when tg_argv[0] = 'settings' then now()
      else public.tenant_sync_versions.settings_version
    end,
    updated_at = now();

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_products_touch_sync_versions on public.products;
create trigger trg_products_touch_sync_versions
after insert or update or delete on public.products
for each row execute function public.touch_tenant_sync_versions('products');

drop trigger if exists trg_categories_touch_sync_versions on public.categories;
create trigger trg_categories_touch_sync_versions
after insert or update or delete on public.categories
for each row execute function public.touch_tenant_sync_versions('products');

drop trigger if exists trg_ingredients_touch_sync_versions on public.ingredients;
create trigger trg_ingredients_touch_sync_versions
after insert or update or delete on public.ingredients
for each row execute function public.touch_tenant_sync_versions('products');

drop trigger if exists trg_product_ingredients_touch_sync_versions on public.product_ingredients;
create trigger trg_product_ingredients_touch_sync_versions
after insert or update or delete on public.product_ingredients
for each row execute function public.touch_tenant_sync_versions('products');

drop trigger if exists trg_menu_formulas_touch_sync_versions on public.menu_formulas;
create trigger trg_menu_formulas_touch_sync_versions
after insert or update or delete on public.menu_formulas
for each row execute function public.touch_tenant_sync_versions('menu');

drop trigger if exists trg_menu_formula_items_touch_sync_versions on public.menu_formula_items;
create trigger trg_menu_formula_items_touch_sync_versions
after insert or update or delete on public.menu_formula_items
for each row execute function public.touch_tenant_sync_versions('menu');

drop trigger if exists trg_option_groups_touch_sync_versions on public.option_groups;
create trigger trg_option_groups_touch_sync_versions
after insert or update or delete on public.option_groups
for each row execute function public.touch_tenant_sync_versions('menu');

drop trigger if exists trg_option_items_touch_sync_versions on public.option_items;
create trigger trg_option_items_touch_sync_versions
after insert or update or delete on public.option_items
for each row execute function public.touch_tenant_sync_versions('menu');

drop trigger if exists trg_offers_touch_sync_versions on public.offers;
create trigger trg_offers_touch_sync_versions
after insert or update or delete on public.offers
for each row execute function public.touch_tenant_sync_versions('menu');

drop trigger if exists trg_restaurant_profiles_touch_sync_versions on public.restaurant_profiles;
create trigger trg_restaurant_profiles_touch_sync_versions
after insert or update or delete on public.restaurant_profiles
for each row execute function public.touch_tenant_sync_versions('settings');

grant select on public.tenant_sync_versions to anon, authenticated;
grant insert, update on public.tenant_sync_versions to authenticated;

alter table public.tenant_sync_versions enable row level security;

drop policy if exists tenant_sync_versions_select_access on public.tenant_sync_versions;
create policy tenant_sync_versions_select_access
on public.tenant_sync_versions
for select
to anon, authenticated
using (true);

commit;
