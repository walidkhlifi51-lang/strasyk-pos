-- Acces public minimal pour la borne / kiosk.
-- A executer dans Supabase SQL Editor pour permettre l usage depuis une vraie borne non connectee.

begin;

create or replace function public.kiosk_tenant_is_public(target_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.restaurant_profiles rp
    where rp.tenant_id = target_tenant_id
      and rp.manages_kiosk = true
  )
$$;

grant usage on schema public to anon;

grant select on public.tenants to anon;
grant select on public.products to anon;
grant select on public.categories to anon;
grant select on public.restaurant_profiles to anon;
grant select on public.offers to anon;
grant select on public.ingredients to anon;
grant select on public.product_ingredients to anon;
grant select on public.option_groups to anon;
grant select on public.option_items to anon;
grant select on public.menu_formulas to anon;
grant select on public.menu_formula_items to anon;

drop policy if exists tenants_select_kiosk_public on public.tenants;
create policy tenants_select_kiosk_public
on public.tenants
for select
to anon
using (public.kiosk_tenant_is_public(id));

drop policy if exists restaurant_profiles_select_kiosk_public on public.restaurant_profiles;
create policy restaurant_profiles_select_kiosk_public
on public.restaurant_profiles
for select
to anon
using (manages_kiosk = true);

drop policy if exists offers_select_kiosk_public on public.offers;
create policy offers_select_kiosk_public
on public.offers
for select
to anon
using (public.kiosk_tenant_is_public(tenant_id));

drop policy if exists ingredients_select_kiosk_public on public.ingredients;
create policy ingredients_select_kiosk_public
on public.ingredients
for select
to anon
using (public.kiosk_tenant_is_public(tenant_id));

drop policy if exists product_ingredients_select_kiosk_public on public.product_ingredients;
create policy product_ingredients_select_kiosk_public
on public.product_ingredients
for select
to anon
using (public.kiosk_tenant_is_public(tenant_id));

drop policy if exists option_groups_select_kiosk_public on public.option_groups;
create policy option_groups_select_kiosk_public
on public.option_groups
for select
to anon
using (public.kiosk_tenant_is_public(tenant_id));

drop policy if exists option_items_select_kiosk_public on public.option_items;
create policy option_items_select_kiosk_public
on public.option_items
for select
to anon
using (public.kiosk_tenant_is_public(tenant_id));

drop policy if exists menu_formulas_select_kiosk_public on public.menu_formulas;
create policy menu_formulas_select_kiosk_public
on public.menu_formulas
for select
to anon
using (public.kiosk_tenant_is_public(tenant_id));

drop policy if exists menu_formula_items_select_kiosk_public on public.menu_formula_items;
create policy menu_formula_items_select_kiosk_public
on public.menu_formula_items
for select
to anon
using (public.kiosk_tenant_is_public(tenant_id));

commit;
