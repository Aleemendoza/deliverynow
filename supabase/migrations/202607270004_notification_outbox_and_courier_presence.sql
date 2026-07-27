-- Reliable order notifications and courier location freshness.
-- External delivery is intentionally handled by the application outbox worker; the
-- order mutation and the audience selection remain atomic in PostgreSQL.

create table if not exists public.courier_presence (
  courier_id uuid primary key references public.couriers(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  observed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists courier_presence_observed_at_idx on public.courier_presence(observed_at desc);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists notification_events_order_created_idx on public.notification_events(order_id, created_at desc);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('push', 'email')),
  recipient_email text,
  title text not null,
  body text not null,
  url text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique(event_id, user_id, channel)
);

create index if not exists notification_outbox_dispatch_idx on public.notification_outbox(next_attempt_at, created_at)
  where status in ('pending', 'failed');

alter table public.courier_presence enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_outbox enable row level security;

create policy courier_presence_own_read on public.courier_presence for select using (
  courier_id in (select id from public.couriers where profile_id = auth.uid()) or public.is_admin()
);

-- The inbox endpoint uses the authenticated session client, so reading and
-- acknowledging an alert must be limited to its intended recipient.
create policy notifications_own_update on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Current position is private operational data. Only the courier updates it via RPC.
create or replace function public.update_courier_presence(latitude_value double precision, longitude_value double precision, observed_at_value timestamptz default now())
returns public.courier_presence
language plpgsql
security definer
set search_path = public
as $$
declare
  courier_row public.couriers%rowtype;
  result public.courier_presence%rowtype;
begin
  if latitude_value not between -90 and 90 or longitude_value not between -180 and 180 then
    raise exception 'INVALID_COURIER_LOCATION';
  end if;
  if observed_at_value < now() - interval '10 minutes' or observed_at_value > now() + interval '2 minutes' then
    raise exception 'INVALID_PRESENCE_TIMESTAMP';
  end if;

  select * into courier_row from public.couriers where profile_id = auth.uid() for update;
  if not found or public.current_role() <> 'courier' or not courier_row.is_active then
    raise exception 'COURIER_NOT_AVAILABLE';
  end if;

  insert into public.courier_presence(courier_id, latitude, longitude, observed_at, updated_at)
  values (courier_row.id, latitude_value, longitude_value, observed_at_value, now())
  on conflict (courier_id) do update
    set latitude = excluded.latitude, longitude = excluded.longitude, observed_at = excluded.observed_at, updated_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.emit_order_notification_event(event_type_value text, order_id_value uuid, actor_id_value uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  event_id uuid;
  customer_profile_id uuid;
  assigned_profile_id uuid;
  event_title text;
  event_body text;
  event_url text;
  status_label text;
begin
  select * into order_row from public.orders where id = order_id_value;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  status_label := case order_row.status
    when 'pending_confirmation' then 'recibido y pendiente de confirmacion'
    when 'confirmed' then 'confirmado; estamos buscando un cadete'
    when 'assigned' then 'asignado a un cadete'
    when 'heading_to_pickup' then 'en camino al retiro'
    when 'at_pickup' then 'en el punto de retiro'
    when 'picked_up' then 'retirado'
    when 'heading_to_delivery' then 'en camino a la entrega'
    when 'at_delivery' then 'en el destino'
    when 'delivered' then 'entregado'
    when 'cancelled' then 'cancelado'
    when 'rejected' then 'rechazado'
    when 'incident' then 'con una incidencia'
    else replace(order_row.status::text, '_', ' ')
  end;
  event_title := case
    when event_type_value = 'order.created' then 'Pedido recibido'
    when event_type_value = 'order.confirmed' then 'Pedido disponible'
    when event_type_value = 'order.assigned' then 'Pedido asignado'
    when order_row.status = 'delivered' then 'Pedido entregado'
    when order_row.status = 'incident' then 'Incidencia en pedido'
    else 'Actualizacion de pedido'
  end;
  event_body := format('Pedido %s: %s.', order_row.tracking_code, status_label);
  event_url := format('/seguimiento/%s', order_row.tracking_code);

  insert into public.notification_events(event_type, order_id, actor_id, payload)
  values (event_type_value, order_id_value, actor_id_value, jsonb_build_object('trackingCode', order_row.tracking_code, 'status', order_row.status, 'url', event_url))
  returning id into event_id;

  select profile_id into customer_profile_id from public.customers where id = order_row.customer_id;
  select profile_id into assigned_profile_id from public.couriers where id = order_row.assigned_courier_id;

  -- The customer receives every lifecycle event. In-app is durable; push and email
  -- are independent outbox jobs so provider outages never roll back the order.
  if customer_profile_id is not null then
    insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
    values (customer_profile_id, order_id_value, 'in_app', event_type_value, event_title, event_body, jsonb_build_object('eventId', event_id, 'url', event_url), 'sent', now());
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select event_id, customer_profile_id, 'push', p.email, event_title, event_body, event_url, jsonb_build_object('eventType', event_type_value)
    from public.profiles p where p.id = customer_profile_id
    on conflict (event_id, user_id, channel) do nothing;
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select event_id, customer_profile_id, 'email', p.email, event_title, event_body, event_url, jsonb_build_object('eventType', event_type_value, 'trackingCode', order_row.tracking_code, 'status', order_row.status)
    from public.profiles p where p.id = customer_profile_id and p.email is not null
    on conflict (event_id, user_id, channel) do nothing;
  end if;

  -- A confirmed order is an offer to currently online couriers. Other lifecycle
  -- events only target the courier who owns the assignment.
  if event_type_value = 'order.confirmed' then
    insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
    select c.profile_id, order_id_value, 'in_app', 'order.available', 'Nuevo pedido disponible', format('Pedido %s espera asignacion.', order_row.tracking_code), jsonb_build_object('eventId', event_id, 'url', '/courier/orders'), 'sent', now()
    from public.couriers c where c.is_active and c.is_online;
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select event_id, c.profile_id, 'push', p.email, 'Nuevo pedido disponible', format('Pedido %s espera asignacion.', order_row.tracking_code), '/courier/orders', jsonb_build_object('eventType', event_type_value)
    from public.couriers c join public.profiles p on p.id = c.profile_id where c.is_active and c.is_online
    on conflict (event_id, user_id, channel) do nothing;
  elsif assigned_profile_id is not null then
    insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
    values (assigned_profile_id, order_id_value, 'in_app', event_type_value, event_title, event_body, jsonb_build_object('eventId', event_id, 'url', '/courier/orders'), 'sent', now());
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select event_id, assigned_profile_id, 'push', p.email, event_title, event_body, '/courier/orders', jsonb_build_object('eventType', event_type_value)
    from public.profiles p where p.id = assigned_profile_id
    on conflict (event_id, user_id, channel) do nothing;
  end if;

  -- Admin notifications are deliberately in-app for routine transitions, while
  -- push is reserved for a new order, delivery, cancellation or incident.
  insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
  select p.id, order_id_value, 'in_app', event_type_value, event_title, event_body, jsonb_build_object('eventId', event_id, 'url', '/admin'), 'sent', now()
  from public.profiles p where p.role = 'admin';
  if event_type_value in ('order.created', 'order.confirmed', 'order.assigned') or order_row.status in ('delivered', 'cancelled', 'rejected', 'incident') then
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select event_id, p.id, 'push', p.email, event_title, event_body, '/admin', jsonb_build_object('eventType', event_type_value)
    from public.profiles p where p.role = 'admin'
    on conflict (event_id, user_id, channel) do nothing;
  end if;
  return event_id;
end;
$$;

-- Order creation initially runs with the service role and the customer linkage is
-- completed immediately afterwards. Keeping the link and its first event in one
-- function prevents a created order from silently missing its recipient events.
create or replace function public.link_customer_order_and_emit_created(order_id_value uuid, customer_id_value uuid, actor_id_value uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
begin
  select * into order_row from public.orders where id = order_id_value for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.customer_id is not null and order_row.customer_id <> customer_id_value then raise exception 'ORDER_CUSTOMER_ALREADY_LINKED'; end if;
  if not exists (select 1 from public.customers where id = customer_id_value and profile_id = actor_id_value) then raise exception 'INVALID_ORDER_CUSTOMER'; end if;
  update public.orders set customer_id = customer_id_value, updated_at = now() where id = order_id_value and customer_id is null;
  perform public.emit_order_notification_event('order.created', order_id_value, actor_id_value);
end;
$$;

create or replace function public.assign_order_to_courier(order_id_value uuid, courier_id_value uuid, reason_text text default 'Asignado por administracion')
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  courier_row public.couriers%rowtype;
begin
  if public.current_role() <> 'admin' then raise exception 'FORBIDDEN'; end if;
  select * into order_row from public.orders where id = order_id_value for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.status <> 'confirmed' or order_row.assigned_courier_id is not null then raise exception 'ORDER_NOT_AVAILABLE'; end if;
  select * into courier_row from public.couriers where id = courier_id_value for update;
  if not found or not courier_row.is_active then raise exception 'COURIER_NOT_AVAILABLE'; end if;
  update public.orders set assigned_courier_id = courier_id_value, status = 'assigned', updated_at = now() where id = order_id_value returning * into order_row;
  insert into public.order_assignments(order_id, courier_id, assigned_by) values (order_id_value, courier_id_value, auth.uid());
  insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason) values (order_id_value, 'confirmed', 'assigned', auth.uid(), nullif(reason_text, ''));
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data) values (auth.uid(), 'order.assigned', 'order', order_id_value, jsonb_build_object('courierId', courier_id_value));
  perform public.emit_order_notification_event('order.assigned', order_id_value, auth.uid());
  return order_row;
end;
$$;

create or replace function public.transition_order_status(order_id uuid, target_status public.order_status, reason_text text default null, delivery_pin text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare ord public.orders%rowtype; actor_role public.user_role; actor_courier_id uuid; previous_order_status public.order_status; allowed boolean := false; event_type_value text;
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
    if actor_role = 'courier' and not exists (
      select 1 from public.couriers c join public.courier_presence cp on cp.courier_id = c.id
      where c.id = actor_courier_id and c.is_active and c.is_online and cp.observed_at >= now() - interval '5 minutes'
    ) then raise exception 'COURIER_PRESENCE_STALE'; end if;
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
  if target_status = 'at_pickup' then update public.order_stops set arrived_at = now() where order_id = ord.id and type = 'pickup'; end if;
  if target_status = 'picked_up' then update public.order_stops set completed_at = now() where order_id = ord.id and type = 'pickup'; end if;
  if target_status = 'at_delivery' then update public.order_stops set arrived_at = now() where order_id = ord.id and type = 'delivery'; end if;
  if target_status = 'delivered' then update public.order_stops set completed_at = now() where order_id = ord.id and type = 'delivery'; end if;
  if target_status = 'incident' then insert into public.incidents(order_id, courier_id, type, description) values (ord.id, actor_courier_id, 'courier_report', coalesce(nullif(trim(reason_text), ''), 'Incidencia reportada por el cadete')); end if;
  update public.orders set status = target_status, completed_at = case when target_status = 'delivered' then now() else completed_at end, cancelled_at = case when target_status = 'cancelled' then now() else cancelled_at end, updated_at = now() where id = order_id returning * into ord;
  insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason) values (order_id, previous_order_status, target_status, auth.uid(), nullif(reason_text,''));
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data) values (auth.uid(), 'order.status_changed', 'order', order_id, jsonb_build_object('status', target_status));
  event_type_value := case when target_status = 'confirmed' then 'order.confirmed' when target_status = 'assigned' then 'order.assigned' else 'order.status_changed' end;
  perform public.emit_order_notification_event(event_type_value, order_id, auth.uid());
  return ord;
end;
$$;

create or replace function public.claim_notification_outbox(batch_size integer, worker_id_value text)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if batch_size < 1 or batch_size > 100 or length(trim(worker_id_value)) < 8 then raise exception 'INVALID_OUTBOX_CLAIM'; end if;
  return query
  with claimed as (
    select id from public.notification_outbox
    where (status = 'pending' or (status = 'failed' and next_attempt_at <= now())) and next_attempt_at <= now()
    order by created_at for update skip locked limit batch_size
  )
  update public.notification_outbox o set status = 'processing', locked_at = now(), locked_by = worker_id_value, attempt_count = o.attempt_count + 1
  from claimed where o.id = claimed.id returning o.*;
end;
$$;

create or replace function public.finalize_notification_outbox(outbox_id_value uuid, worker_id_value text, outcome_value text, error_value text default null, retry_at_value timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if outcome_value not in ('sent', 'failed') then raise exception 'INVALID_OUTBOX_OUTCOME'; end if;
  update public.notification_outbox
  set status = outcome_value,
      sent_at = case when outcome_value = 'sent' then now() else null end,
      error_message = nullif(left(coalesce(error_value, ''), 500), ''),
      next_attempt_at = case when outcome_value = 'failed' then coalesce(retry_at_value, now() + interval '30 seconds') else next_attempt_at end,
      locked_at = null,
      locked_by = null
  where id = outbox_id_value and status = 'processing' and locked_by = worker_id_value;
  if not found then raise exception 'OUTBOX_CLAIM_NOT_FOUND'; end if;
end;
$$;

-- Presence is ephemeral: going offline immediately removes the last location
-- instead of retaining a movement history after availability ends.
create or replace function public.set_courier_availability(online boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  courier_row public.couriers%rowtype;
begin
  select * into courier_row from public.couriers where profile_id = auth.uid() for update;
  if not found or public.current_role() <> 'courier' or not courier_row.is_active then
    raise exception 'COURIER_NOT_AVAILABLE';
  end if;
  update public.couriers set is_online = online, updated_at = now() where id = courier_row.id;
  if not online then
    delete from public.courier_presence where courier_id = courier_row.id;
  end if;
  return online;
end;
$$;

revoke all on function public.update_courier_presence(double precision, double precision, timestamptz) from public, anon;
revoke all on function public.assign_order_to_courier(uuid, uuid, text) from public, anon;
revoke all on function public.transition_order_status(uuid, public.order_status, text, text) from public, anon;
revoke all on function public.emit_order_notification_event(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.link_customer_order_and_emit_created(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_notification_outbox(integer, text) from public, anon, authenticated;
revoke all on function public.finalize_notification_outbox(uuid, text, text, text, timestamptz) from public, anon, authenticated;

grant execute on function public.update_courier_presence(double precision, double precision, timestamptz) to authenticated;
grant execute on function public.set_courier_availability(boolean) to authenticated;
grant execute on function public.assign_order_to_courier(uuid, uuid, text) to authenticated;
grant execute on function public.transition_order_status(uuid, public.order_status, text, text) to authenticated;
grant execute on function public.emit_order_notification_event(text, uuid, uuid) to service_role;
grant execute on function public.link_customer_order_and_emit_created(uuid, uuid, uuid) to service_role;
grant execute on function public.claim_notification_outbox(integer, text) to service_role;
grant execute on function public.finalize_notification_outbox(uuid, text, text, text, timestamptz) to service_role;
