-- RLS pour le coeur caisse.
-- A executer apres SUPABASE_POS_CORE_SCHEMA.sql

begin;

create or replace function public.app_current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')::uuid
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.tables to authenticated;
grant select, insert, update, delete on public.cloture_caisse to authenticated;
grant select, insert, update, delete on public.drawer_openings to authenticated;
grant select, insert, update, delete on public.customer_display_cart to authenticated;

alter table public.orders enable row level security;
alter table public.tables enable row level security;
alter table public.cloture_caisse enable row level security;
alter table public.drawer_openings enable row level security;
alter table public.customer_display_cart enable row level security;

drop policy if exists orders_select_tenant on public.orders;
create policy orders_select_tenant on public.orders
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists orders_insert_tenant on public.orders;
create policy orders_insert_tenant on public.orders
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists orders_update_tenant on public.orders;
create policy orders_update_tenant on public.orders
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists orders_delete_tenant on public.orders;
create policy orders_delete_tenant on public.orders
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists tables_select_tenant on public.tables;
create policy tables_select_tenant on public.tables
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists tables_insert_tenant on public.tables;
create policy tables_insert_tenant on public.tables
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists tables_update_tenant on public.tables;
create policy tables_update_tenant on public.tables
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists tables_delete_tenant on public.tables;
create policy tables_delete_tenant on public.tables
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists cloture_caisse_select_tenant on public.cloture_caisse;
create policy cloture_caisse_select_tenant on public.cloture_caisse
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists cloture_caisse_insert_tenant on public.cloture_caisse;
create policy cloture_caisse_insert_tenant on public.cloture_caisse
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists cloture_caisse_update_tenant on public.cloture_caisse;
create policy cloture_caisse_update_tenant on public.cloture_caisse
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists cloture_caisse_delete_tenant on public.cloture_caisse;
create policy cloture_caisse_delete_tenant on public.cloture_caisse
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists drawer_openings_select_tenant on public.drawer_openings;
create policy drawer_openings_select_tenant on public.drawer_openings
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists drawer_openings_insert_tenant on public.drawer_openings;
create policy drawer_openings_insert_tenant on public.drawer_openings
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists drawer_openings_update_tenant on public.drawer_openings;
create policy drawer_openings_update_tenant on public.drawer_openings
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists drawer_openings_delete_tenant on public.drawer_openings;
create policy drawer_openings_delete_tenant on public.drawer_openings
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists customer_display_cart_select_tenant on public.customer_display_cart;
create policy customer_display_cart_select_tenant on public.customer_display_cart
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists customer_display_cart_insert_tenant on public.customer_display_cart;
create policy customer_display_cart_insert_tenant on public.customer_display_cart
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists customer_display_cart_update_tenant on public.customer_display_cart;
create policy customer_display_cart_update_tenant on public.customer_display_cart
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists customer_display_cart_delete_tenant on public.customer_display_cart;
create policy customer_display_cart_delete_tenant on public.customer_display_cart
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

commit;
