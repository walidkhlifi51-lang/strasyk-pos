begin;

create or replace function public.app_current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')::uuid
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.delivery_people to authenticated;

alter table public.delivery_people enable row level security;

drop policy if exists delivery_people_select_tenant on public.delivery_people;
create policy delivery_people_select_tenant
on public.delivery_people
for select
to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists delivery_people_insert_tenant on public.delivery_people;
create policy delivery_people_insert_tenant
on public.delivery_people
for insert
to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists delivery_people_update_tenant on public.delivery_people;
create policy delivery_people_update_tenant
on public.delivery_people
for update
to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists delivery_people_delete_tenant on public.delivery_people;
create policy delivery_people_delete_tenant
on public.delivery_people
for delete
to authenticated
using (tenant_id = public.app_current_tenant_id());

commit;
