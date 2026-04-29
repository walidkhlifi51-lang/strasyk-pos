begin;

alter table public.restaurant_profiles
  add column if not exists logo_url text,
  add column if not exists siret text,
  add column if not exists tva_intracommunautaire text,
  add column if not exists kiosk_welcome_message text,
  add column if not exists kiosk_welcome_images jsonb not null default '[]'::jsonb,
  add column if not exists kiosk_primary_color text,
  add column if not exists kiosk_secondary_color text,
  add column if not exists kiosk_card_payment_enabled boolean not null default false,
  add column if not exists force_immediate_payment boolean not null default false,
  add column if not exists prix_differencies_par_mode boolean not null default false,
  add column if not exists allow_price_edit boolean not null default false,
  add column if not exists allow_item_edit boolean not null default false,
  add column if not exists manages_kiosk boolean not null default false,
  add column if not exists manages_delivery_app boolean not null default false,
  add column if not exists delivery_app_allowed boolean not null default false,
  add column if not exists table_plan_allowed boolean not null default false,
  add column if not exists bipeur_enabled boolean not null default false,
  add column if not exists customer_display_enabled boolean not null default false,
  add column if not exists manages_web_ordering boolean not null default false,
  add column if not exists web_ordering_closed boolean not null default false,
  add column if not exists web_frais_livraison_enabled boolean not null default false,
  add column if not exists web_frais_livraison numeric(10,2) not null default 0,
  add column if not exists site_template text,
  add column if not exists site_primary_color text,
  add column if not exists custom_domain text,
  add column if not exists domain_verified boolean not null default false,
  add column if not exists domain_last_checked_at timestamptz,
  add column if not exists scratch_tickets_enabled boolean not null default false,
  add column if not exists ai_image_generation_enabled boolean not null default false;

alter table public.restaurant_profiles
  alter column kiosk_welcome_images set default '[]'::jsonb;

update public.restaurant_profiles
set kiosk_welcome_images = '[]'::jsonb
where kiosk_welcome_images is null;

commit;
