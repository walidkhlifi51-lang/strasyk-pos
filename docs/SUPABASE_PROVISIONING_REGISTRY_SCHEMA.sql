begin;

create table if not exists public.provisioning_registry (
  id uuid primary key default gen_random_uuid(),
  project_ref text not null,
  tenant_id uuid null references public.tenants(id) on delete restrict,
  entity_type text not null,
  seed_key text not null,
  record_table text not null,
  record_id uuid not null,
  checksum text null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint provisioning_registry_project_ref_not_blank check (length(trim(project_ref)) > 0),
  constraint provisioning_registry_entity_type_not_blank check (length(trim(entity_type)) > 0),
  constraint provisioning_registry_seed_key_not_blank check (length(trim(seed_key)) > 0),
  constraint provisioning_registry_record_table_not_blank check (length(trim(record_table)) > 0),
  constraint uq_provisioning_registry_seed unique (project_ref, entity_type, seed_key),
  constraint uq_provisioning_registry_record unique (project_ref, record_table, record_id)
);

create index if not exists idx_provisioning_registry_tenant_id
  on public.provisioning_registry(tenant_id);

create index if not exists idx_provisioning_registry_seed_key
  on public.provisioning_registry(seed_key);

alter table public.provisioning_registry enable row level security;

revoke all on public.provisioning_registry from public;
revoke all on public.provisioning_registry from anon;
revoke all on public.provisioning_registry from authenticated;
grant select, insert, update, delete on public.provisioning_registry to service_role;

comment on table public.provisioning_registry is
  'Technical STRASYK test provisioning registry. Server-side use only with Supabase service role.';

commit;
