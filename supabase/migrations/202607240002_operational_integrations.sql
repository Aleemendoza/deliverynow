-- Operational integrity, secure order creation and browser integrations.
-- Apply after 202607240001_initial_schema.sql.

create table if not exists public.tracking_sequences (
  year integer primary key,
  next_value integer not null default 1 check (next_value > 0)
);

create table if not exists public.order_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  courier_id uuid not null references public.couriers(id),
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  unique nulls not distinct (order_id, unassigned_at)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists pin_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz;

create index if not exists order_assignments_active_courier_idx on public.order_assignments(courier_id) where unassigned_at is null;
create index if not exists push_subscriptions_profile_idx on public.push_subscriptions(profile_id);

alter table public.addresses enable row level security;
alter table public.service_types enable row level security;
alter table public.service_zones enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.order_assignments enable row level security;

drop policy if exists orders_customer_read on public.orders;
create policy orders_authorized_read on public.orders for select using (
  public.is_admin()
  or customer_id in (select id from public.customers where profile_id = auth.uid())
  or assigned_courier_id in (select id from public.couriers where profile_id = auth.uid())
  or (public.current_role() = 'courier' and status = 'confirmed' and assigned_courier_id is null)
);

drop policy if exists service_types_public_read on public.service_types;
create policy service_types_public_read on public.service_types for select using (active = true or public.is_admin());
drop policy if exists pricing_admin_read on public.pricing_rules;
create policy pricing_admin_read on public.pricing_rules for select using (public.is_admin());
drop policy if exists zones_admin_read on public.service_zones;
create policy zones_admin_read on public.service_zones for select using (public.is_admin());
drop policy if exists addresses_authorized_read on public.addresses;
create policy addresses_authorized_read on public.addresses for select using (
  exists (
    select 1 from public.order_stops stop join public.orders ord on ord.id = stop.order_id
    where stop.address_id = addresses.id
      and (public.is_admin() or ord.customer_id in (select id from public.customers where profile_id = auth.uid()) or ord.assigned_courier_id in (select id from public.couriers where profile_id = auth.uid()))
  )
);
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for select using (profile_id = auth.uid() or public.is_admin());
drop policy if exists assignments_authorized_read on public.order_assignments;
create policy assignments_authorized_read on public.order_assignments for select using (
  public.is_admin() or courier_id in (select id from public.couriers where profile_id = auth.uid())
);

create or replace function public.create_guest_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_order public.orders%rowtype;
  service_id uuid;
  pickup_address_id uuid;
  delivery_address_id uuid;
  created_order_id uuid;
  code_year integer := extract(year from now() at time zone 'America/Argentina/Buenos_Aires');
  sequence_number integer;
  tracking text;
  pin text := lpad((floor(random() * 1000000))::integer::text, 6, '0');
  scheduled_time timestamptz;
begin
  select * into existing_order from public.orders where idempotency_key = (payload->>'idempotencyKey')::uuid;
  if found then
    return jsonb_build_object('trackingCode', existing_order.tracking_code, 'status', existing_order.status, 'duplicate', true);
  end if;

  select id into service_id from public.service_types where code = payload->>'serviceType' and active = true;
  if service_id is null then raise exception 'SERVICE_UNAVAILABLE'; end if;

  insert into public.tracking_sequences(year, next_value) values (code_year, 2)
  on conflict (year) do update set next_value = tracking_sequences.next_value + 1
  returning next_value - 1 into sequence_number;
  tracking := format('VC-%s-%s', code_year, lpad(sequence_number::text, 6, '0'));

  insert into public.addresses(formatted_address, place_id, latitude, longitude, street_number, city, province, postal_code, floor, apartment, reference)
  values (payload#>>'{pickup,formattedAddress}', payload#>>'{pickup,placeId}', (payload#>>'{pickup,latitude}')::double precision, (payload#>>'{pickup,longitude}')::double precision, nullif(payload#>>'{pickup,streetNumber}',''), nullif(payload#>>'{pickup,city}',''), nullif(payload#>>'{pickup,province}',''), nullif(payload#>>'{pickup,postalCode}',''), nullif(payload#>>'{pickup,floor}',''), nullif(payload#>>'{pickup,apartment}',''), nullif(payload#>>'{pickup,reference}',''))
  returning id into pickup_address_id;
  insert into public.addresses(formatted_address, place_id, latitude, longitude, street_number, city, province, postal_code, floor, apartment, reference)
  values (payload#>>'{delivery,formattedAddress}', payload#>>'{delivery,placeId}', (payload#>>'{delivery,latitude}')::double precision, (payload#>>'{delivery,longitude}')::double precision, nullif(payload#>>'{delivery,streetNumber}',''), nullif(payload#>>'{delivery,city}',''), nullif(payload#>>'{delivery,province}',''), nullif(payload#>>'{delivery,postalCode}',''), nullif(payload#>>'{delivery,floor}',''), nullif(payload#>>'{delivery,apartment}',''), nullif(payload#>>'{delivery,reference}',''))
  returning id into delivery_address_id;

  if payload->>'scheduledAt' is not null then scheduled_time := (payload->>'scheduledAt')::timestamptz; end if;
  insert into public.orders(tracking_code, guest_name, guest_email, guest_phone_e164, service_type_id, status, payment_responsible, payment_method, delivery_pin_hash, scheduled_at, distance_meters, duration_seconds, estimated_price, final_price, price_snapshot, notes, idempotency_key)
  values (tracking, payload->>'senderName', payload->>'senderEmail', payload->>'senderPhone', service_id, 'pending_confirmation', payload->>'paymentResponsible', payload->>'paymentMethod', crypt(pin, gen_salt('bf', 10)), scheduled_time, (payload->>'distanceMeters')::integer, (payload->>'durationSeconds')::integer, (payload->>'total')::numeric, (payload->>'total')::numeric, payload->'priceSnapshot', nullif(payload#>>'{product,notes}',''), (payload->>'idempotencyKey')::uuid)
  returning id into created_order_id;

  insert into public.order_stops(order_id, type, sequence, address_id, contact_name, contact_phone_e164, instructions)
  values
    (created_order_id, 'pickup', 1, pickup_address_id, payload->>'senderName', payload->>'senderPhone', nullif(payload#>>'{pickup,reference}','')),
    (created_order_id, 'delivery', 2, delivery_address_id, payload->>'recipientName', payload->>'recipientPhone', nullif(payload#>>'{delivery,reference}',''));
  insert into public.order_status_history(order_id, new_status, metadata) values (created_order_id, 'pending_confirmation', jsonb_build_object('source','guest-order'));
  insert into public.notifications(order_id, channel, type, title, body, status) values (created_order_id, 'email', 'order_received', 'Pedido recibido', format('Pedido %s recibido', tracking), 'pending');
  insert into public.audit_logs(action, entity_type, entity_id, after_data) values ('order.created', 'order', created_order_id, jsonb_build_object('trackingCode', tracking));
  return jsonb_build_object('id', created_order_id, 'trackingCode', tracking, 'status', 'pending_confirmation', 'pin', pin, 'duplicate', false);
end;
$$;

create or replace function public.transition_order_status(order_id uuid, target_status public.order_status, reason_text text default null, delivery_pin text default null)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders%rowtype;
  actor_role public.user_role;
  actor_courier_id uuid;
  previous_order_status public.order_status;
  allowed boolean := false;
begin
  select * into ord from public.orders where id = order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  previous_order_status := ord.status;
  select role into actor_role from public.profiles where id = auth.uid();
  select id into actor_courier_id from public.couriers where profile_id = auth.uid();
  if actor_role = 'admin' then allowed := true; end if;
  if actor_role = 'courier' and (ord.assigned_courier_id = actor_courier_id or (ord.status = 'confirmed' and target_status = 'assigned')) then allowed := true; end if;
  if not allowed then raise exception 'FORBIDDEN'; end if;
  if not ((ord.status = 'pending_confirmation' and target_status in ('confirmed','rejected')) or (ord.status = 'confirmed' and target_status in ('assigned','cancelled')) or (ord.status = 'assigned' and target_status in ('heading_to_pickup','cancelled')) or (ord.status = 'heading_to_pickup' and target_status in ('at_pickup','incident','cancelled')) or (ord.status = 'at_pickup' and target_status in ('picked_up','incident','cancelled')) or (ord.status = 'picked_up' and target_status in ('heading_to_delivery','incident')) or (ord.status = 'heading_to_delivery' and target_status in ('at_delivery','incident')) or (ord.status = 'at_delivery' and target_status in ('delivered','incident')) or (ord.status = 'incident' and target_status in ('assigned','cancelled'))) then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  if target_status = 'assigned' then
    if actor_courier_id is null then raise exception 'COURIER_REQUIRED'; end if;
    update public.orders set assigned_courier_id = actor_courier_id where id = order_id;
    insert into public.order_assignments(order_id, courier_id, assigned_by) values (order_id, actor_courier_id, auth.uid());
  end if;
  if target_status = 'delivered' then
    if ord.pin_locked_until is not null and ord.pin_locked_until > now() then raise exception 'PIN_TEMPORARILY_LOCKED'; end if;
    if delivery_pin is null or ord.delivery_pin_hash <> crypt(delivery_pin, ord.delivery_pin_hash) then
      update public.orders set pin_attempts = pin_attempts + 1, pin_locked_until = case when pin_attempts + 1 >= 5 then now() + interval '15 minutes' else pin_locked_until end where id = order_id;
      raise exception 'INVALID_DELIVERY_PIN';
    end if;
    insert into public.delivery_proofs(order_id, storage_path, proof_type, pin_validated) values (order_id, 'pin://validated', 'pin', true);
  end if;
  update public.orders set status = target_status, completed_at = case when target_status = 'delivered' then now() else completed_at end, cancelled_at = case when target_status = 'cancelled' then now() else cancelled_at end, updated_at = now() where id = order_id returning * into ord;
  insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason) values (order_id, previous_order_status, target_status, auth.uid(), nullif(reason_text,''));
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data) values (auth.uid(), 'order.status_changed', 'order', order_id, jsonb_build_object('status', target_status));
  return ord;
end;
$$;

grant execute on function public.transition_order_status(uuid, public.order_status, text, text) to authenticated;
revoke all on function public.create_guest_order(jsonb) from public, anon, authenticated;
