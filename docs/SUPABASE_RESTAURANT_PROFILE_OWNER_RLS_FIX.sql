begin;

drop policy if exists restaurant_profiles_insert_access on public.restaurant_profiles;
create policy restaurant_profiles_insert_access
on public.restaurant_profiles
for insert
to authenticated
with check (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or tenant_id = public.app_current_tenant_id()
  or exists (
    select 1
    from public.tenants t
    where t.id = restaurant_profiles.tenant_id
      and lower(t.owner_email) = public.app_current_user_email()
  )
);

drop policy if exists restaurant_profiles_update_access on public.restaurant_profiles;
create policy restaurant_profiles_update_access
on public.restaurant_profiles
for update
to authenticated
using (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or tenant_id = public.app_current_tenant_id()
  or exists (
    select 1
    from public.tenants t
    where t.id = restaurant_profiles.tenant_id
      and lower(t.owner_email) = public.app_current_user_email()
  )
)
with check (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or tenant_id = public.app_current_tenant_id()
  or exists (
    select 1
    from public.tenants t
    where t.id = restaurant_profiles.tenant_id
      and lower(t.owner_email) = public.app_current_user_email()
  )
);

drop policy if exists restaurant_profiles_delete_access on public.restaurant_profiles;
create policy restaurant_profiles_delete_access
on public.restaurant_profiles
for delete
to authenticated
using (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or tenant_id = public.app_current_tenant_id()
  or exists (
    select 1
    from public.tenants t
    where t.id = restaurant_profiles.tenant_id
      and lower(t.owner_email) = public.app_current_user_email()
  )
);

commit;
