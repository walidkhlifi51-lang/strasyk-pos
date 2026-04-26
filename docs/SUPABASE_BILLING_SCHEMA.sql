-- Evolution de tenant_invoices vers un document de facturation unifie.
-- Objectif :
-- 1. Plateforme -> revendeur
-- 2. Revendeur -> commerce
-- 3. Garder la compatibilite avec l'existant base sur tenant_id

begin;

alter table public.tenant_invoices
  add column if not exists issuer_type text,
  add column if not exists issuer_id uuid,
  add column if not exists recipient_type text,
  add column if not exists recipient_id uuid,
  add column if not exists reseller_id uuid,
  add column if not exists issuer_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists recipient_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.tenant_invoices
  alter column tenant_id drop not null,
  alter column issuer_snapshot set default '{}'::jsonb,
  alter column recipient_snapshot set default '{}'::jsonb,
  alter column metadata set default '{}'::jsonb;

update public.tenant_invoices
set issuer_type = coalesce(issuer_type, 'platform'),
    recipient_type = coalesce(recipient_type, case when tenant_id is not null then 'tenant' else recipient_type end),
    recipient_id = coalesce(recipient_id, tenant_id)
where issuer_type is null
   or recipient_type is null
   or recipient_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tenant_invoices_issuer_type_check'
  ) then
    alter table public.tenant_invoices
      add constraint tenant_invoices_issuer_type_check
      check (issuer_type is null or issuer_type in ('platform', 'reseller'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tenant_invoices_recipient_type_check'
  ) then
    alter table public.tenant_invoices
      add constraint tenant_invoices_recipient_type_check
      check (recipient_type is null or recipient_type in ('tenant', 'reseller'));
  end if;
end $$;

create index if not exists idx_tenant_invoices_tenant_id
  on public.tenant_invoices(tenant_id);

create index if not exists idx_tenant_invoices_reseller_id
  on public.tenant_invoices(reseller_id);

create index if not exists idx_tenant_invoices_issuer
  on public.tenant_invoices(issuer_type, issuer_id);

create index if not exists idx_tenant_invoices_recipient
  on public.tenant_invoices(recipient_type, recipient_id);

create index if not exists idx_tenant_invoices_date_facturation
  on public.tenant_invoices(date_facturation desc);

comment on column public.tenant_invoices.issuer_type is 'platform ou reseller';
comment on column public.tenant_invoices.issuer_id is 'null ou id revendeur si issuer_type = reseller';
comment on column public.tenant_invoices.recipient_type is 'tenant ou reseller';
comment on column public.tenant_invoices.recipient_id is 'id du destinataire';
comment on column public.tenant_invoices.reseller_id is 'raccourci de jointure utile pour reporting revendeur';
comment on column public.tenant_invoices.issuer_snapshot is 'snapshot legal/branding au moment de l emission';
comment on column public.tenant_invoices.recipient_snapshot is 'snapshot du client au moment de l emission';
comment on column public.tenant_invoices.metadata is 'champ libre pour extensions facture';

commit;
