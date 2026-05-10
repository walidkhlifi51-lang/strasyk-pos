begin;

create or replace function public.delivery_app_action(action_name text, payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := nullif(payload->>'tenant_id', '')::uuid;
  v_delivery_person_id uuid := nullif(payload->>'delivery_person_id', '')::uuid;
  v_customer_id uuid := nullif(payload->>'customer_id', '')::uuid;
  v_order_id uuid := nullif(payload->>'order_id', '')::uuid;
  v_username text := nullif(trim(coalesce(payload->>'username', '')), '');
  v_password text := nullif(coalesce(payload->>'password', ''), '');
  v_payment_method text := nullif(trim(coalesce(payload->>'payment_method', '')), '');
  v_order_total numeric := coalesce((payload->>'order_total')::numeric, 0);
  v_numero_caisse integer := nullif(payload->>'numero_caisse', '')::integer;
  v_person public.delivery_people%rowtype;
  v_profile public.restaurant_profiles%rowtype;
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;
  v_rule public.cagnotte_rules%rowtype;
  v_balance_before numeric;
  v_balance_after numeric;
  v_amount_earned numeric;
  v_was_already_paid boolean;
  v_is_now_paid boolean;
  v_payments jsonb;
begin
  if action_name = 'login' then
    if v_username is null or v_password is null then
      return jsonb_build_object('error', 'Identifiants incorrects');
    end if;

    select *
    into v_person
    from public.delivery_people
    where username = v_username
      and password = v_password
      and (v_tenant_id is null or tenant_id = v_tenant_id)
    order by updated_date desc nulls last, created_date desc nulls last
    limit 1;

    if v_person.id is null then
      return jsonb_build_object('error', 'Identifiants incorrects');
    end if;

    select *
    into v_profile
    from public.restaurant_profiles
    where tenant_id = v_person.tenant_id
    order by updated_date desc nulls last, created_date desc nulls last
    limit 1;

    return jsonb_build_object(
      'person', to_jsonb(v_person),
      'profile', coalesce(to_jsonb(v_profile), 'null'::jsonb)
    );
  end if;

  if action_name = 'list' then
    return jsonb_build_object(
      'orders',
      coalesce((
        select jsonb_agg(to_jsonb(o) order by coalesce(o.updated_date, o.created_date) desc)
        from public.orders o
        where o.tenant_id = v_tenant_id
          and o.delivery_person_id = v_delivery_person_id
      ), '[]'::jsonb)
    );
  end if;

  if action_name = 'getCustomer' then
    select *
    into v_customer
    from public.customers
    where id = v_customer_id
      and tenant_id = v_tenant_id
    limit 1;

    return jsonb_build_object('customer', coalesce(to_jsonb(v_customer), 'null'::jsonb));
  end if;

  if action_name = 'getDeliveryPerson' then
    select *
    into v_person
    from public.delivery_people
    where id = v_delivery_person_id
    limit 1;

    return jsonb_build_object('person', coalesce(to_jsonb(v_person), 'null'::jsonb));
  end if;

  if action_name = 'confirmDelivery' then
    select *
    into v_order
    from public.orders
    where id = v_order_id
    limit 1;

    if v_order.id is null then
      return jsonb_build_object('error', 'Commande introuvable');
    end if;

    v_was_already_paid := coalesce(v_order.payee, false);
    v_is_now_paid := v_was_already_paid or v_payment_method is not null;
    v_payments := case
      when v_payment_method is not null
        then jsonb_build_array(jsonb_build_object('methode', v_payment_method, 'montant', coalesce(nullif(v_order_total, 0), coalesce(v_order.total_ttc, 0))))
      else coalesce(v_order.mode_paiement, '[]'::jsonb)
    end;

    update public.orders
    set
      statut = 'livree',
      payee = v_is_now_paid,
      mode_paiement = v_payments
    where id = v_order.id;

    if v_delivery_person_id is not null then
      update public.delivery_people
      set
        en_livraison = false,
        nb_livraisons_jour = coalesce(nb_livraisons_jour, 0) + 1,
        total_encaisse = coalesce(total_encaisse, 0) + case
          when not v_was_already_paid and v_is_now_paid then coalesce(nullif(v_order_total, 0), coalesce(v_order.total_ttc, 0))
          else 0
        end
      where id = v_delivery_person_id;
    end if;

    if not v_was_already_paid and v_is_now_paid and v_order.customer_id is not null then
      select *
      into v_customer
      from public.customers
      where id = v_order.customer_id
      limit 1;

      if v_customer.id is not null then
        select *
        into v_rule
        from public.cagnotte_rules
        where tenant_id = v_order.tenant_id
          and active = true
        order by updated_date desc nulls last, created_date desc nulls last
        limit 1;

        if v_rule.id is not null and coalesce(v_rule.accumulation_rate, 0) > 0 then
          v_amount_earned := coalesce(v_order.total_ttc, 0) * (v_rule.accumulation_rate / 100.0);
          if v_amount_earned > 0.01 then
            v_balance_before := coalesce(v_customer.cagnotte_balance, 0);
            v_balance_after := v_balance_before + v_amount_earned;

            insert into public.cagnotte_history (
              tenant_id,
              customer_id,
              order_id,
              type,
              amount,
              balance_before,
              balance_after,
              created_date
            ) values (
              v_order.tenant_id,
              v_customer.id,
              v_order.id,
              'earn',
              v_amount_earned,
              v_balance_before,
              v_balance_after,
              now()
            );

            update public.customers
            set cagnotte_balance = v_balance_after
            where id = v_customer.id;
          end if;
        end if;
      end if;
    end if;

    return jsonb_build_object('success', true);
  end if;

  if action_name = 'assign' then
    select *
    into v_order
    from public.orders
    where tenant_id = v_tenant_id
      and numero_caisse = v_numero_caisse
      and statut not in ('livree', 'payé', 'payee', 'annulee')
    order by coalesce(updated_date, created_date) desc
    limit 1;

    if v_order.id is null then
      return jsonb_build_object('error', format('Commande #%s introuvable', v_numero_caisse));
    end if;

    update public.orders
    set
      delivery_person_id = v_delivery_person_id,
      statut = 'en_cours_de_livraison'
    where id = v_order.id;

    update public.delivery_people
    set en_livraison = true
    where id = v_delivery_person_id;

    return jsonb_build_object('success', true, 'order_id', v_order.id, 'numero_caisse', v_order.numero_caisse);
  end if;

  return jsonb_build_object('error', format('Action inconnue: %s', action_name));
end;
$$;

grant execute on function public.delivery_app_action(text, jsonb) to anon, authenticated;

commit;
