-- Suscripciones por las tiendas (App Store / Google Play).
-- La app compra con StoreKit 2 o Google Play Billing; la función store-verify
-- confirma la compra con la tienda y solo entonces llama a store_apply_purchase.

alter table public.billing_plans
    add column if not exists apple_product_id text,
    add column if not exists google_product_id text;

update public.billing_plans set apple_product_id = coalesce(apple_product_id, 'vunlek_mensual'), google_product_id = coalesce(google_product_id, 'vunlek_mensual') where code = 'MONTHLY';
update public.billing_plans set apple_product_id = coalesce(apple_product_id, 'vunlek_anual'), google_product_id = coalesce(google_product_id, 'vunlek_anual') where code = 'ANNUAL';

alter table public.space_subscriptions
    add column if not exists store text check (store in ('APPLE', 'GOOGLE')),
    add column if not exists store_product_id text,
    add column if not exists store_original_id text;

create table if not exists public.store_purchases (
    id bigint generated always as identity primary key,
    store text not null check (store in ('APPLE', 'GOOGLE')),
    original_id text not null,
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    user_id uuid,
    product_id text not null,
    plan text not null,
    last_transaction_id text,
    state text not null,
    expires_at timestamptz,
    auto_renew boolean,
    environment text,
    raw jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (store, original_id)
);
create index if not exists store_purchases_tenant_idx on public.store_purchases (tenant_id);
alter table public.store_purchases enable row level security;
-- Sin políticas: solo el servidor (service role) lee y escribe.
revoke all on public.store_purchases from anon, authenticated;

create or replace function public.store_apply_purchase(
    p_tenant uuid, p_user uuid, p_store text, p_product text, p_original_id text,
    p_transaction_id text, p_expires timestamptz, p_auto_renew boolean,
    p_state text, p_environment text, p_raw jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
    v_plan text;
    v_owner uuid;
    v_active boolean;
    v_current text;
begin
    if p_store not in ('APPLE', 'GOOGLE') then raise exception 'Tienda desconocida'; end if;
    if p_state not in ('ACTIVE', 'GRACE', 'EXPIRED', 'REVOKED') then raise exception 'Estado desconocido'; end if;

    select code into v_plan from billing_plans
    where active and ((p_store = 'APPLE' and apple_product_id = p_product) or (p_store = 'GOOGLE' and google_product_id = p_product));
    if v_plan is null then raise exception 'El producto % no corresponde a ningún plan', p_product; end if;

    -- Una compra de la tienda pertenece a un solo espacio
    select tenant_id into v_owner from store_purchases where store = p_store and original_id = p_original_id;
    if v_owner is not null and v_owner <> p_tenant then
        raise exception 'Esta compra ya está ligada a otro espacio';
    end if;

    insert into store_purchases (store, original_id, tenant_id, user_id, product_id, plan, last_transaction_id, state, expires_at, auto_renew, environment, raw)
    values (p_store, p_original_id, p_tenant, p_user, p_product, v_plan, p_transaction_id, p_state, p_expires, p_auto_renew, p_environment, coalesce(p_raw, '{}'::jsonb))
    on conflict (store, original_id) do update set
        product_id = excluded.product_id, plan = excluded.plan, last_transaction_id = excluded.last_transaction_id,
        state = excluded.state, expires_at = excluded.expires_at, auto_renew = excluded.auto_renew,
        environment = excluded.environment, raw = excluded.raw, updated_at = now();

    v_active := p_state in ('ACTIVE', 'GRACE') and p_expires is not null and p_expires > now();

    insert into space_subscriptions (tenant_id, status, plan) values (p_tenant, 'EXPIRED', 'TRIAL')
    on conflict (tenant_id) do nothing;
    select store_original_id into v_current from space_subscriptions where tenant_id = p_tenant for update;

    if v_active then
        update space_subscriptions set
            status = case when p_state = 'GRACE' then 'PAST_DUE' else 'ACTIVE' end,
            plan = v_plan, current_period_end = p_expires, auto_renew = coalesce(p_auto_renew, true),
            store = p_store, store_product_id = p_product, store_original_id = p_original_id,
            price = null, promo_code = null, notices = '{}'::jsonb, updated_at = now()
        where tenant_id = p_tenant;
    elsif v_current = p_original_id then
        -- La suscripción vigente del espacio era esta y terminó o fue reembolsada
        update space_subscriptions set
            status = 'EXPIRED', auto_renew = false,
            current_period_end = least(coalesce(p_expires, now()), now()), updated_at = now()
        where tenant_id = p_tenant;
    end if;

    insert into billing_events (tenant_id, user_id, kind, detail)
    values (p_tenant, p_user, 'STORE_' || p_state,
        jsonb_build_object('store', p_store, 'product', p_product, 'plan', v_plan, 'until', p_expires, 'transaction', p_transaction_id, 'environment', p_environment));

    return jsonb_build_object('success', true, 'active', v_active, 'plan', v_plan, 'until', p_expires);
end $$;

revoke all on function public.store_apply_purchase(uuid, uuid, text, text, text, text, timestamptz, boolean, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.store_apply_purchase(uuid, uuid, text, text, text, text, timestamptz, boolean, text, text, jsonb) to service_role;

-- Productos de las tiendas visibles para la app (sin precios: el precio lo da la tienda)
create or replace function public.store_products()
returns jsonb language sql stable security definer set search_path to 'public'
as $$
    select coalesce(jsonb_agg(jsonb_build_object('plan', code, 'name', name, 'months', months,
        'apple', apple_product_id, 'google', google_product_id) order by months), '[]'::jsonb)
    from billing_plans where active
$$;
revoke all on function public.store_products() from public, anon;
grant execute on function public.store_products() to authenticated;
