begin;

alter table public.restaurant_profiles
  add column if not exists custom_domain text,
  add column if not exists domain_verified boolean not null default false,
  add column if not exists domain_last_checked_at timestamptz;

update public.restaurant_profiles
set custom_domain = nullif(
  lower(
    regexp_replace(
      regexp_replace(
        custom_domain,
        '^https?://',
        ''
      ),
      '/.*$',
      ''
    )
  ),
  ''
)
where custom_domain is not null;

create unique index if not exists uq_restaurant_profiles_custom_domain
  on public.restaurant_profiles(custom_domain)
  where custom_domain is not null;

commit;
