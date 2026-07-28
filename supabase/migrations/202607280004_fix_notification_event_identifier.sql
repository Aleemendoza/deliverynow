-- Notification outbox writes run as part of an order transaction. Keep the
-- PL/pgSQL variable distinct from notification_outbox.event_id.
create or replace function public.emit_order_notification_event(event_type_value text, order_id_value uuid, actor_id_value uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  notification_event_id uuid;
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
  returning id into notification_event_id;

  select profile_id into customer_profile_id from public.customers where id = order_row.customer_id;
  select profile_id into assigned_profile_id from public.couriers where id = order_row.assigned_courier_id;

  if customer_profile_id is not null then
    insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
    values (customer_profile_id, order_id_value, 'in_app', event_type_value, event_title, event_body, jsonb_build_object('eventId', notification_event_id, 'url', event_url), 'sent', now());
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select notification_event_id, customer_profile_id, 'push', p.email, event_title, event_body, event_url, jsonb_build_object('eventType', event_type_value)
    from public.profiles p where p.id = customer_profile_id
    on conflict (event_id, user_id, channel) do nothing;
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select notification_event_id, customer_profile_id, 'email', p.email, event_title, event_body, event_url, jsonb_build_object('eventType', event_type_value, 'trackingCode', order_row.tracking_code, 'status', order_row.status)
    from public.profiles p where p.id = customer_profile_id and p.email is not null
    on conflict (event_id, user_id, channel) do nothing;
  end if;

  if event_type_value = 'order.confirmed' then
    insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
    select c.profile_id, order_id_value, 'in_app', 'order.available', 'Nuevo pedido disponible', format('Pedido %s espera asignacion.', order_row.tracking_code), jsonb_build_object('eventId', notification_event_id, 'url', '/courier/orders'), 'sent', now()
    from public.couriers c where c.is_active and c.is_online;
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select notification_event_id, c.profile_id, 'push', p.email, 'Nuevo pedido disponible', format('Pedido %s espera asignacion.', order_row.tracking_code), '/courier/orders', jsonb_build_object('eventType', event_type_value)
    from public.couriers c join public.profiles p on p.id = c.profile_id where c.is_active and c.is_online
    on conflict (event_id, user_id, channel) do nothing;
  elsif assigned_profile_id is not null then
    insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
    values (assigned_profile_id, order_id_value, 'in_app', event_type_value, event_title, event_body, jsonb_build_object('eventId', notification_event_id, 'url', '/courier/orders'), 'sent', now());
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select notification_event_id, assigned_profile_id, 'push', p.email, event_title, event_body, '/courier/orders', jsonb_build_object('eventType', event_type_value)
    from public.profiles p where p.id = assigned_profile_id
    on conflict (event_id, user_id, channel) do nothing;
  end if;

  insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
  select p.id, order_id_value, 'in_app', event_type_value, event_title, event_body, jsonb_build_object('eventId', notification_event_id, 'url', '/admin'), 'sent', now()
  from public.profiles p where p.role = 'admin';
  if event_type_value in ('order.created', 'order.confirmed', 'order.assigned') or order_row.status in ('delivered', 'cancelled', 'rejected', 'incident') then
    insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
    select notification_event_id, p.id, 'push', p.email, event_title, event_body, '/admin', jsonb_build_object('eventType', event_type_value)
    from public.profiles p where p.role = 'admin'
    on conflict (event_id, user_id, channel) do nothing;
  end if;
  return notification_event_id;
end;
$$;
