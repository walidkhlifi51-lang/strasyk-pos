-- RLS revendeurs.
-- A executer apres SUPABASE_RESELLER_SCHEMA.sql

begin;

create or replace function public.app_current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')::uuid
$$;

create or replace function public.app_current_user_email()
returns text
language sql
stable
as $$
  select lower(
    coalesce(
      nullif(auth.jwt() ->> 'email', ''),
      nullif(auth.email(), '')
    )
  )
$$;

create or replace function public.app_is_platform_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.platform_admin_access paa
    where lower(paa.user_email) = public.app_current_user_email()
      and coalesce(paa.is_active, true) = true
  )
$$;

create or replace function public.app_can_access_reseller(target_reseller_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.app_is_platform_admin()
    or exists (
      select 1
      from public.reseller_users ru
      where ru.reseller_id = target_reseller_id
        and lower(ru.user_email) = public.app_current_user_email()
        and ru.status = 'active'
    )
$$;

create or replace function public.app_can_manage_reseller(target_reseller_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.app_is_platform_admin()
    or exists (
      select 1
      from public.reseller_users ru
      where ru.reseller_id = target_reseller_id
        and lower(ru.user_email) = public.app_current_user_email()
        and ru.status = 'active'
        and ru.role in ('owner', 'manager', 'sales')
    )
$$;

create or replace function public.app_is_active_reseller_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.reseller_users ru
    where lower(ru.user_email) = public.app_current_user_email()
      and ru.status = 'active'
  )
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.restaurant_profiles to authenticated;
grant select, insert, update, delete on public.resellers to authenticated;
grant select, insert, update, delete on public.reseller_users to authenticated;
grant select, insert, update, delete on public.reseller_branding to authenticated;
grant select, insert, update, delete on public.reseller_pricing_rules to authenticated;
grant select, insert, update, delete on public.reseller_tenants to authenticated;
grant select, insert, update, delete on public.reseller_commissions to authenticated;
grant select, insert, update, delete on public.reseller_payouts to authenticated;
grant select, insert, update, delete on public.tenant_invoices to authenticated;

alter table public.tenants enable row level security;
alter table public.restaurant_profiles enable row level security;
alter table public.resellers enable row level security;
alter table public.reseller_users enable row level security;
alter table public.reseller_branding enable row level security;
alter table public.reseller_pricing_rules enable row level security;
alter table public.reseller_tenants enable row level security;
alter table public.reseller_commissions enable row level security;
alter table public.reseller_payouts enable row level security;
alter table public.tenant_invoices enable row level security;

drop policy if exists tenants_select_access on public.tenants;
create policy tenants_select_access
on public.tenants
for select
to authenticated
using (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or id = public.app_current_tenant_id()
  or lower(owner_email) = public.app_current_user_email()
);

drop policy if exists tenants_insert_reseller_access on public.tenants;
create policy tenants_insert_reseller_access
on public.tenants
for insert
to authenticated
with check (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
);

drop policy if exists tenants_update_access on public.tenants;
create policy tenants_update_access
on public.tenants
for update
to authenticated
using (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or id = public.app_current_tenant_id()
  or lower(owner_email) = public.app_current_user_email()
)
with check (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or id = public.app_current_tenant_id()
  or lower(owner_email) = public.app_current_user_email()
);

drop policy if exists tenants_delete_access on public.tenants;
create policy tenants_delete_access
on public.tenants
for delete
to authenticated
using (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or lower(owner_email) = public.app_current_user_email()
);

drop policy if exists restaurant_profiles_select_access on public.restaurant_profiles;
create policy restaurant_profiles_select_access
on public.restaurant_profiles
for select
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

drop policy if exists restaurant_profiles_insert_access on public.restaurant_profiles;
create policy restaurant_profiles_insert_access
on public.restaurant_profiles
for insert
to authenticated
with check (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or tenant_id = public.app_current_tenant_id()
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
)
with check (
  public.app_is_platform_admin()
  or public.app_is_active_reseller_user()
  or tenant_id = public.app_current_tenant_id()
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
);

drop policy if exists resellers_select_access on public.resellers;
create policy resellers_select_access
on public.resellers
for select
to authenticated
using (public.app_can_access_reseller(id));

drop policy if exists resellers_insert_platform_admin on public.resellers;
create policy resellers_insert_platform_admin
on public.resellers
for insert
to authenticated
with check (public.app_is_platform_admin());

drop policy if exists resellers_update_platform_admin on public.resellers;
create policy resellers_update_platform_admin
on public.resellers
for update
to authenticated
using (public.app_is_platform_admin())
with check (public.app_is_platform_admin());

drop policy if exists resellers_delete_platform_admin on public.resellers;
create policy resellers_delete_platform_admin
on public.resellers
for delete
to authenticated
using (public.app_is_platform_admin());

drop policy if exists reseller_users_select_access on public.reseller_users;
create policy reseller_users_select_access
on public.reseller_users
for select
to authenticated
using (
  public.app_is_platform_admin()
  or lower(user_email) = public.app_current_user_email()
  or public.app_can_access_reseller(reseller_id)
);

drop policy if exists reseller_users_insert_platform_admin on public.reseller_users;
create policy reseller_users_insert_platform_admin
on public.reseller_users
for insert
to authenticated
with check (public.app_is_platform_admin());

drop policy if exists reseller_users_update_platform_admin on public.reseller_users;
create policy reseller_users_update_platform_admin
on public.reseller_users
for update
to authenticated
using (public.app_is_platform_admin())
with check (public.app_is_platform_admin());

drop policy if exists reseller_users_delete_platform_admin on public.reseller_users;
create policy reseller_users_delete_platform_admin
on public.reseller_users
for delete
to authenticated
using (public.app_is_platform_admin());

drop policy if exists reseller_branding_select_access on public.reseller_branding;
create policy reseller_branding_select_access
on public.reseller_branding
for select
to authenticated
using (public.app_can_access_reseller(reseller_id));

drop policy if exists reseller_branding_insert_platform_admin on public.reseller_branding;
create policy reseller_branding_insert_platform_admin
on public.reseller_branding
for insert
to authenticated
with check (public.app_is_platform_admin());

drop policy if exists reseller_branding_update_platform_admin on public.reseller_branding;
create policy reseller_branding_update_platform_admin
on public.reseller_branding
for update
to authenticated
using (public.app_is_platform_admin())
with check (public.app_is_platform_admin());

drop policy if exists reseller_branding_delete_platform_admin on public.reseller_branding;
create policy reseller_branding_delete_platform_admin
on public.reseller_branding
for delete
to authenticated
using (public.app_is_platform_admin());

drop policy if exists reseller_pricing_rules_select_access on public.reseller_pricing_rules;
create policy reseller_pricing_rules_select_access
on public.reseller_pricing_rules
for select
to authenticated
using (public.app_can_access_reseller(reseller_id));

drop policy if exists reseller_pricing_rules_insert_platform_admin on public.reseller_pricing_rules;
create policy reseller_pricing_rules_insert_platform_admin
on public.reseller_pricing_rules
for insert
to authenticated
with check (public.app_is_platform_admin());

drop policy if exists reseller_pricing_rules_update_platform_admin on public.reseller_pricing_rules;
create policy reseller_pricing_rules_update_platform_admin
on public.reseller_pricing_rules
for update
to authenticated
using (public.app_is_platform_admin())
with check (public.app_is_platform_admin());

drop policy if exists reseller_pricing_rules_delete_platform_admin on public.reseller_pricing_rules;
create policy reseller_pricing_rules_delete_platform_admin
on public.reseller_pricing_rules
for delete
to authenticated
using (public.app_is_platform_admin());

drop policy if exists reseller_tenants_select_access on public.reseller_tenants;
create policy reseller_tenants_select_access
on public.reseller_tenants
for select
to authenticated
using (public.app_can_access_reseller(reseller_id));

drop policy if exists reseller_tenants_insert_platform_admin on public.reseller_tenants;
drop policy if exists reseller_tenants_insert_manager_access on public.reseller_tenants;
create policy reseller_tenants_insert_manager_access
on public.reseller_tenants
for insert
to authenticated
with check (public.app_can_manage_reseller(reseller_id));

drop policy if exists reseller_tenants_update_platform_admin on public.reseller_tenants;
drop policy if exists reseller_tenants_update_manager_access on public.reseller_tenants;
create policy reseller_tenants_update_manager_access
on public.reseller_tenants
for update
to authenticated
using (public.app_can_manage_reseller(reseller_id))
with check (public.app_can_manage_reseller(reseller_id));

drop policy if exists reseller_tenants_delete_platform_admin on public.reseller_tenants;
drop policy if exists reseller_tenants_delete_manager_access on public.reseller_tenants;
create policy reseller_tenants_delete_manager_access
on public.reseller_tenants
for delete
to authenticated
using (public.app_can_manage_reseller(reseller_id));

drop policy if exists reseller_commissions_select_access on public.reseller_commissions;
create policy reseller_commissions_select_access
on public.reseller_commissions
for select
to authenticated
using (public.app_can_access_reseller(reseller_id));

drop policy if exists reseller_commissions_insert_platform_admin on public.reseller_commissions;
create policy reseller_commissions_insert_platform_admin
on public.reseller_commissions
for insert
to authenticated
with check (public.app_is_platform_admin());

drop policy if exists reseller_commissions_update_platform_admin on public.reseller_commissions;
create policy reseller_commissions_update_platform_admin
on public.reseller_commissions
for update
to authenticated
using (public.app_is_platform_admin())
with check (public.app_is_platform_admin());

drop policy if exists reseller_commissions_delete_platform_admin on public.reseller_commissions;
create policy reseller_commissions_delete_platform_admin
on public.reseller_commissions
for delete
to authenticated
using (public.app_is_platform_admin());

drop policy if exists reseller_payouts_select_access on public.reseller_payouts;
create policy reseller_payouts_select_access
on public.reseller_payouts
for select
to authenticated
using (public.app_can_access_reseller(reseller_id));

drop policy if exists reseller_payouts_insert_platform_admin on public.reseller_payouts;
create policy reseller_payouts_insert_platform_admin
on public.reseller_payouts
for insert
to authenticated
with check (public.app_is_platform_admin());

drop policy if exists reseller_payouts_update_platform_admin on public.reseller_payouts;
create policy reseller_payouts_update_platform_admin
on public.reseller_payouts
for update
to authenticated
using (public.app_is_platform_admin())
with check (public.app_is_platform_admin());

drop policy if exists reseller_payouts_delete_platform_admin on public.reseller_payouts;
create policy reseller_payouts_delete_platform_admin
on public.reseller_payouts
for delete
to authenticated
using (public.app_is_platform_admin());

drop policy if exists tenant_invoices_select_access on public.tenant_invoices;
create policy tenant_invoices_select_access
on public.tenant_invoices
for select
to authenticated
using (
  public.app_is_platform_admin()
  or (
    recipient_type = 'reseller'
    and recipient_id is not null
    and public.app_can_access_reseller(recipient_id)
  )
  or (
    issuer_type = 'reseller'
    and issuer_id is not null
    and public.app_can_access_reseller(issuer_id)
  )
  or tenant_id = public.app_current_tenant_id()
  or (
    recipient_type = 'tenant'
    and recipient_id = public.app_current_tenant_id()
  )
  or exists (
    select 1
    from public.tenants t
    where t.id = coalesce(tenant_invoices.tenant_id, tenant_invoices.recipient_id)
      and lower(t.owner_email) = public.app_current_user_email()
  )
);

drop policy if exists tenant_invoices_insert_access on public.tenant_invoices;
create policy tenant_invoices_insert_access
on public.tenant_invoices
for insert
to authenticated
with check (
  public.app_is_platform_admin()
  or (
    issuer_type = 'reseller'
    and issuer_id is not null
    and public.app_can_manage_reseller(issuer_id)
    and recipient_type = 'tenant'
  )
);

drop policy if exists tenant_invoices_update_access on public.tenant_invoices;
create policy tenant_invoices_update_access
on public.tenant_invoices
for update
to authenticated
using (
  public.app_is_platform_admin()
  or (
    issuer_type = 'reseller'
    and issuer_id is not null
    and public.app_can_manage_reseller(issuer_id)
  )
)
with check (
  public.app_is_platform_admin()
  or (
    issuer_type = 'reseller'
    and issuer_id is not null
    and public.app_can_manage_reseller(issuer_id)
  )
);

drop policy if exists tenant_invoices_delete_access on public.tenant_invoices;
create policy tenant_invoices_delete_access
on public.tenant_invoices
for delete
to authenticated
using (
  public.app_is_platform_admin()
  or (
    issuer_type = 'reseller'
    and issuer_id is not null
    and public.app_can_manage_reseller(issuer_id)
  )
);

commit;
