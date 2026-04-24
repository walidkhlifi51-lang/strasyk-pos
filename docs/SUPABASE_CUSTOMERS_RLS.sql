-- RLS pour customers.
-- A executer apres SUPABASE_CUSTOMERS_SCHEMA.sql

begin;

create or replace function public.app_current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')::uuid
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.customers to authenticated;

alter table public.customers enable row level security;

drop policy if exists customers_select_tenant on public.customers;
create policy customers_select_tenant
on public.customers
for select
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists customers_insert_tenant on public.customers;
create policy customers_insert_tenant
on public.customers
for insert
to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists customers_update_tenant on public.customers;
create policy customers_update_tenant
on public.customers
for update
to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists customers_delete_tenant on public.customers;
create policy customers_delete_tenant
on public.customers
for delete
to authenticated
using (tenant_id = public.app_current_tenant_id());

commit;
