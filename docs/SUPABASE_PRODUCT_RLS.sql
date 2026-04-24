-- RLS pour les nouvelles tables produit.
-- A executer dans Supabase SQL Editor apres le schema complet.

begin;

create or replace function public.app_current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')::uuid
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.ingredients to authenticated;
grant select, insert, update, delete on public.product_ingredients to authenticated;
grant select, insert, update, delete on public.option_groups to authenticated;
grant select, insert, update, delete on public.option_items to authenticated;

alter table public.ingredients enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.option_groups enable row level security;
alter table public.option_items enable row level security;

drop policy if exists ingredients_select_tenant on public.ingredients;
create policy ingredients_select_tenant
on public.ingredients
for select
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists ingredients_insert_tenant on public.ingredients;
create policy ingredients_insert_tenant
on public.ingredients
for insert
to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists ingredients_update_tenant on public.ingredients;
create policy ingredients_update_tenant
on public.ingredients
for update
to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists ingredients_delete_tenant on public.ingredients;
create policy ingredients_delete_tenant
on public.ingredients
for delete
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists product_ingredients_select_tenant on public.product_ingredients;
create policy product_ingredients_select_tenant
on public.product_ingredients
for select
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists product_ingredients_insert_tenant on public.product_ingredients;
create policy product_ingredients_insert_tenant
on public.product_ingredients
for insert
to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists product_ingredients_update_tenant on public.product_ingredients;
create policy product_ingredients_update_tenant
on public.product_ingredients
for update
to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists product_ingredients_delete_tenant on public.product_ingredients;
create policy product_ingredients_delete_tenant
on public.product_ingredients
for delete
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists option_groups_select_tenant on public.option_groups;
create policy option_groups_select_tenant
on public.option_groups
for select
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists option_groups_insert_tenant on public.option_groups;
create policy option_groups_insert_tenant
on public.option_groups
for insert
to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists option_groups_update_tenant on public.option_groups;
create policy option_groups_update_tenant
on public.option_groups
for update
to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists option_groups_delete_tenant on public.option_groups;
create policy option_groups_delete_tenant
on public.option_groups
for delete
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists option_items_select_tenant on public.option_items;
create policy option_items_select_tenant
on public.option_items
for select
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists option_items_insert_tenant on public.option_items;
create policy option_items_insert_tenant
on public.option_items
for insert
to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists option_items_update_tenant on public.option_items;
create policy option_items_update_tenant
on public.option_items
for update
to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists option_items_delete_tenant on public.option_items;
create policy option_items_delete_tenant
on public.option_items
for delete
to authenticated
using (tenant_id = public.app_current_tenant_id());

commit;
