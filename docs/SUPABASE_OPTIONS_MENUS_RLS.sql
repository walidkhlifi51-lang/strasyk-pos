-- RLS pour options + menus.
-- A executer apres SUPABASE_OPTIONS_MENUS_SCHEMA.sql

begin;

create or replace function public.app_current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')::uuid
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.menu_formulas to authenticated;
grant select, insert, update, delete on public.menu_formula_items to authenticated;

alter table public.menu_formulas enable row level security;
alter table public.menu_formula_items enable row level security;

drop policy if exists menu_formulas_select_tenant on public.menu_formulas;
create policy menu_formulas_select_tenant
on public.menu_formulas
for select
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists menu_formulas_insert_tenant on public.menu_formulas;
create policy menu_formulas_insert_tenant
on public.menu_formulas
for insert
to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists menu_formulas_update_tenant on public.menu_formulas;
create policy menu_formulas_update_tenant
on public.menu_formulas
for update
to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists menu_formulas_delete_tenant on public.menu_formulas;
create policy menu_formulas_delete_tenant
on public.menu_formulas
for delete
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists menu_formula_items_select_tenant on public.menu_formula_items;
create policy menu_formula_items_select_tenant
on public.menu_formula_items
for select
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists menu_formula_items_insert_tenant on public.menu_formula_items;
create policy menu_formula_items_insert_tenant
on public.menu_formula_items
for insert
to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists menu_formula_items_update_tenant on public.menu_formula_items;
create policy menu_formula_items_update_tenant
on public.menu_formula_items
for update
to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists menu_formula_items_delete_tenant on public.menu_formula_items;
create policy menu_formula_items_delete_tenant
on public.menu_formula_items
for delete
to authenticated
using (tenant_id = public.app_current_tenant_id());

commit;
