-- RLS pour offers / promo_codes / loyalty_rules / cagnotte.
-- A executer apres SUPABASE_MARKETING_SCHEMA.sql

begin;

create or replace function public.app_current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'user_metadata' ->> 'tenant_id', '')::uuid
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.offers to authenticated;
grant select, insert, update, delete on public.promo_codes to authenticated;
grant select, insert, update, delete on public.loyalty_rules to authenticated;
grant select, insert, update, delete on public.cagnotte_rules to authenticated;
grant select, insert, update, delete on public.cagnotte_history to authenticated;

alter table public.offers enable row level security;
alter table public.promo_codes enable row level security;
alter table public.loyalty_rules enable row level security;
alter table public.cagnotte_rules enable row level security;
alter table public.cagnotte_history enable row level security;

drop policy if exists offers_select_tenant on public.offers;
create policy offers_select_tenant on public.offers
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists offers_insert_tenant on public.offers;
create policy offers_insert_tenant on public.offers
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists offers_update_tenant on public.offers;
create policy offers_update_tenant on public.offers
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists offers_delete_tenant on public.offers;
create policy offers_delete_tenant on public.offers
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists promo_codes_select_tenant on public.promo_codes;
create policy promo_codes_select_tenant on public.promo_codes
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists promo_codes_insert_tenant on public.promo_codes;
create policy promo_codes_insert_tenant on public.promo_codes
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists promo_codes_update_tenant on public.promo_codes;
create policy promo_codes_update_tenant on public.promo_codes
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists promo_codes_delete_tenant on public.promo_codes;
create policy promo_codes_delete_tenant on public.promo_codes
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists loyalty_rules_select_tenant on public.loyalty_rules;
create policy loyalty_rules_select_tenant on public.loyalty_rules
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists loyalty_rules_insert_tenant on public.loyalty_rules;
create policy loyalty_rules_insert_tenant on public.loyalty_rules
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists loyalty_rules_update_tenant on public.loyalty_rules;
create policy loyalty_rules_update_tenant on public.loyalty_rules
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists loyalty_rules_delete_tenant on public.loyalty_rules;
create policy loyalty_rules_delete_tenant on public.loyalty_rules
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists cagnotte_rules_select_tenant on public.cagnotte_rules;
create policy cagnotte_rules_select_tenant on public.cagnotte_rules
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists cagnotte_rules_insert_tenant on public.cagnotte_rules;
create policy cagnotte_rules_insert_tenant on public.cagnotte_rules
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists cagnotte_rules_update_tenant on public.cagnotte_rules;
create policy cagnotte_rules_update_tenant on public.cagnotte_rules
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists cagnotte_rules_delete_tenant on public.cagnotte_rules;
create policy cagnotte_rules_delete_tenant on public.cagnotte_rules
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists cagnotte_history_select_tenant on public.cagnotte_history;
create policy cagnotte_history_select_tenant on public.cagnotte_history
for select to authenticated
using (tenant_id = public.app_current_tenant_id());

drop policy if exists cagnotte_history_insert_tenant on public.cagnotte_history;
create policy cagnotte_history_insert_tenant on public.cagnotte_history
for insert to authenticated
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists cagnotte_history_update_tenant on public.cagnotte_history;
create policy cagnotte_history_update_tenant on public.cagnotte_history
for update to authenticated
using (tenant_id = public.app_current_tenant_id())
with check (tenant_id = public.app_current_tenant_id());

drop policy if exists cagnotte_history_delete_tenant on public.cagnotte_history;
create policy cagnotte_history_delete_tenant on public.cagnotte_history
for delete to authenticated
using (tenant_id = public.app_current_tenant_id());

commit;
