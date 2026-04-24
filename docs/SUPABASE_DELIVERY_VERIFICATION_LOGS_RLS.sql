begin;

create or replace function public.app_current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')::uuid
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.delivery_verification_logs to authenticated;

alter table public.delivery_verification_logs enable row level security;

drop policy if exists delivery_verification_logs_select_tenant on public.delivery_verification_logs;
create policy delivery_verification_logs_select_tenant
on public.delivery_verification_logs
for select
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists delivery_verification_logs_insert_tenant on public.delivery_verification_logs;
create policy delivery_verification_logs_insert_tenant
on public.delivery_verification_logs
for insert
to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists delivery_verification_logs_update_tenant on public.delivery_verification_logs;
create policy delivery_verification_logs_update_tenant
on public.delivery_verification_logs
for update
to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists delivery_verification_logs_delete_tenant on public.delivery_verification_logs;
create policy delivery_verification_logs_delete_tenant
on public.delivery_verification_logs
for delete
to authenticated
using (tenant_id = public.app_current_tenant_id());

commit;
