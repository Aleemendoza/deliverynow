-- E2E operational mode: delivery completion no longer depends on a PIN and
-- order creation does not collect or persist a confirmation email.
alter table public.orders alter column delivery_pin_hash drop not null;

-- Existing orders must be finishable under the same operational contract and
-- old PIN hashes are no longer needed once verification is removed.
update public.orders
set delivery_pin_hash = null,
    pin_attempts = 0,
    pin_locked_until = null
where delivery_pin_hash is not null or pin_attempts <> 0 or pin_locked_until is not null;

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
  values (tracking, payload->>'senderName', null, payload->>'senderPhone', service_id, 'pending_confirmation', payload->>'paymentResponsible', payload->>'paymentMethod', null, scheduled_time, (payload->>'distanceMeters')::integer, (payload->>'durationSeconds')::integer, (payload->>'total')::numeric, (payload->>'total')::numeric, payload->'priceSnapshot', nullif(payload#>>'{product,notes}',''), (payload->>'idempotencyKey')::uuid)
  returning id into created_order_id;

  insert into public.order_stops(order_id, type, sequence, address_id, contact_name, contact_phone_e164, instructions)
  values
    (created_order_id, 'pickup', 1, pickup_address_id, payload->>'senderName', payload->>'senderPhone', nullif(payload#>>'{pickup,reference}','')),
    (created_order_id, 'delivery', 2, delivery_address_id, payload->>'recipientName', payload->>'recipientPhone', nullif(payload#>>'{delivery,reference}',''));
  insert into public.order_status_history(order_id, new_status, metadata) values (created_order_id, 'pending_confirmation', jsonb_build_object('source','guest-order'));
  insert into public.audit_logs(action, entity_type, entity_id, after_data) values ('order.created', 'order', created_order_id, jsonb_build_object('trackingCode', tracking));
  return jsonb_build_object('id', created_order_id, 'trackingCode', tracking, 'status', 'pending_confirmation', 'duplicate', false);
end;
$$;

create or replace function public.transition_order_status(order_id uuid, target_status public.order_status, reason_text text default null, delivery_pin text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare ord public.orders%rowtype; actor_courier_id uuid; previous_status public.order_status;
begin
  select * into ord from public.orders where id = order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select id into actor_courier_id from public.couriers where profile_id = auth.uid() and is_active;
  if public.current_role() <> 'courier' or actor_courier_id is null or ord.assigned_courier_id <> actor_courier_id then raise exception 'FORBIDDEN'; end if;
  if not ((ord.status = 'assigned' and target_status in ('heading_to_pickup','cancelled')) or (ord.status = 'heading_to_pickup' and target_status in ('at_pickup','incident','cancelled')) or (ord.status = 'at_pickup' and target_status in ('picked_up','incident','cancelled')) or (ord.status = 'picked_up' and target_status in ('heading_to_delivery','incident')) or (ord.status = 'heading_to_delivery' and target_status in ('at_delivery','incident')) or (ord.status = 'at_delivery' and target_status in ('delivered','incident')) or (ord.status = 'incident' and target_status in ('assigned','cancelled'))) then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  previous_status := ord.status;
  update public.orders set status = target_status, completed_at = case when target_status = 'delivered' then now() else completed_at end, cancelled_at = case when target_status = 'cancelled' then now() else cancelled_at end, updated_at = now() where id = order_id returning * into ord;
  insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason) values (order_id, previous_status, target_status, auth.uid(), nullif(reason_text, ''));
  perform public.emit_order_notification_event(case when target_status = 'assigned' then 'order.assigned' else 'order.status_changed' end, order_id, auth.uid());
  return ord;
end;
$$;

grant execute on function public.create_guest_order(jsonb) to service_role;
grant execute on function public.transition_order_status(uuid, public.order_status, text, text) to authenticated;
