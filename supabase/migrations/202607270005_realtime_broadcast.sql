-- Realtime emits invalidation events only. Clients refetch through RLS-protected APIs.
create table if not exists public.tracking_realtime_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  channel text not null unique check (length(channel) >= 32),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists tracking_realtime_sessions_order_expires_idx on public.tracking_realtime_sessions(order_id, expires_at);
alter table public.tracking_realtime_sessions enable row level security;

create or replace function public.can_receive_realtime_topic(topic_value text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when topic_value = 'courier-offers' then exists (select 1 from couriers c where c.profile_id = auth.uid() and c.is_active and c.is_online)
    when topic_value like 'profile:%' then topic_value = 'profile:' || auth.uid()::text or public.is_admin()
    when topic_value like 'order:%' then exists (
      select 1 from orders o where o.id::text = substring(topic_value from 7)
      and (public.is_admin() or o.customer_id in (select id from customers where profile_id = auth.uid()) or o.assigned_courier_id in (select id from couriers where profile_id = auth.uid()))
    )
    else false end;
$$;

drop policy if exists deliverynow_realtime_receive on realtime.messages;
create policy deliverynow_realtime_receive on realtime.messages for select to authenticated using (public.can_receive_realtime_topic(realtime.topic()));

create or replace function public.send_realtime_event(topic_value text, event_value text, payload_value jsonb default '{}'::jsonb, is_private boolean default true)
returns void language plpgsql security definer set search_path = public, realtime as $$
begin
  perform realtime.send(jsonb_build_object('at', now()) || coalesce(payload_value, '{}'::jsonb), event_value, topic_value, is_private);
end;
$$;

create or replace function public.broadcast_notification_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.channel = 'in_app' and new.user_id is not null then
    perform public.send_realtime_event('profile:' || new.user_id::text, 'notification.created', jsonb_build_object('notificationId', new.id));
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_realtime_broadcast on public.notifications;
create trigger notifications_realtime_broadcast after insert on public.notifications for each row execute function public.broadcast_notification_created();

create or replace function public.broadcast_order_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare session_row record;
begin
  perform public.send_realtime_event('order:' || new.id::text, 'order.changed', jsonb_build_object('orderId', new.id));
  if tg_op = 'INSERT' or old.status is distinct from new.status or old.assigned_courier_id is distinct from new.assigned_courier_id then
    if new.status = 'confirmed' or old.status = 'confirmed' then perform public.send_realtime_event('courier-offers', 'offer.changed'); end if;
    for session_row in select channel from public.tracking_realtime_sessions where order_id = new.id and expires_at > now() loop
      perform public.send_realtime_event('tracking:' || session_row.channel, 'tracking.status_changed', '{}'::jsonb, false);
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_realtime_broadcast on public.orders;
create trigger orders_realtime_broadcast after insert or update of status, assigned_courier_id on public.orders for each row execute function public.broadcast_order_changed();

create or replace function public.broadcast_courier_location_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare order_row record;
begin
  for order_row in select id from public.orders where assigned_courier_id = new.courier_id and status in ('assigned','heading_to_pickup','at_pickup','picked_up','heading_to_delivery','at_delivery') loop
    perform public.send_realtime_event('order:' || order_row.id::text, 'courier.location_changed', jsonb_build_object('orderId', order_row.id));
  end loop;
  return new;
end;
$$;
drop trigger if exists courier_presence_realtime_broadcast on public.courier_presence;
create trigger courier_presence_realtime_broadcast after insert or update of latitude, longitude, observed_at on public.courier_presence for each row execute function public.broadcast_courier_location_changed();

create or replace function public.cleanup_tracking_realtime_sessions()
returns integer language plpgsql security definer set search_path = public as $$
declare deleted_count integer;
begin delete from public.tracking_realtime_sessions where expires_at <= now(); get diagnostics deleted_count = row_count; return deleted_count; end;
$$;

revoke all on public.tracking_realtime_sessions from anon, authenticated;
revoke all on function public.send_realtime_event(text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.cleanup_tracking_realtime_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_tracking_realtime_sessions() to service_role;
