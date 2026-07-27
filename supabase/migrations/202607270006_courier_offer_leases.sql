-- A courier is dispatchable only while an explicit availability lease is valid.
alter table public.couriers add column if not exists availability_expires_at timestamptz;
alter table public.couriers add column if not exists availability_confirmed_at timestamptz;
alter table public.couriers add column if not exists last_heartbeat_at timestamptz;
create index if not exists couriers_dispatchable_idx on public.couriers(is_active, is_online, availability_expires_at);

create type public.order_offer_round_status as enum ('active','accepted','escalated','cancelled');
create type public.order_offer_attempt_status as enum ('active','accepted','rejected','expired');
create table public.order_offer_rounds (
  id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete cascade,
  status public.order_offer_round_status not null default 'active', attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  current_attempt_id uuid, escalated_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_offer_attempts (
  id uuid primary key default gen_random_uuid(), round_id uuid not null references public.order_offer_rounds(id) on delete cascade,
  courier_id uuid not null references public.couriers(id), status public.order_offer_attempt_status not null default 'active',
  offered_at timestamptz not null default now(), expires_at timestamptz not null, responded_at timestamptz,
  unique(round_id, courier_id)
);
alter table public.order_offer_rounds add constraint order_offer_round_current_attempt_fk foreign key (current_attempt_id) references public.order_offer_attempts(id) deferrable initially deferred;
create unique index order_offer_attempt_one_active_idx on public.order_offer_attempts(round_id) where status = 'active';
create index order_offer_attempt_dispatch_idx on public.order_offer_attempts(status, expires_at);
alter table public.order_offer_rounds enable row level security;
alter table public.order_offer_attempts enable row level security;
create policy offer_attempt_own_read on public.order_offer_attempts for select using (courier_id in (select id from public.couriers where profile_id = auth.uid()) or public.is_admin());
create policy offer_round_own_read on public.order_offer_rounds for select using (public.is_admin() or exists (select 1 from public.order_offer_attempts a join public.couriers c on c.id = a.courier_id where a.round_id = order_offer_rounds.id and c.profile_id = auth.uid()));

create or replace function public.enqueue_offer_notification(attempt_id_value uuid)
returns void language plpgsql security definer set search_path = public as $$
declare attempt_row public.order_offer_attempts%rowtype; order_row public.orders%rowtype; profile_id_value uuid; event_id uuid;
begin
  select * into attempt_row from public.order_offer_attempts where id = attempt_id_value;
  select * into order_row from public.orders where id = (select order_id from public.order_offer_rounds where id = attempt_row.round_id);
  select profile_id into profile_id_value from public.couriers where id = attempt_row.courier_id;
  insert into public.notification_events(event_type, order_id, actor_id, payload) values ('order.offer', order_row.id, null, jsonb_build_object('attemptId', attempt_row.id, 'expiresAt', attempt_row.expires_at)) returning id into event_id;
  insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
  values (profile_id_value, order_row.id, 'in_app', 'order.offer', 'Nuevo pedido disponible', 'Tenés 45 segundos para aceptar el pedido.', jsonb_build_object('attemptId', attempt_row.id, 'expiresAt', attempt_row.expires_at, 'url', '/courier/orders'), 'sent', now());
  insert into public.notification_outbox(event_id, user_id, channel, recipient_email, title, body, url, payload)
  select event_id, p.id, 'push', p.email, 'Nuevo pedido disponible', 'Tenés 45 segundos para aceptar el pedido.', '/courier/orders', jsonb_build_object('attemptId', attempt_row.id, 'expiresAt', attempt_row.expires_at)
  from public.profiles p where p.id = profile_id_value on conflict (event_id, user_id, channel) do nothing;
end;
$$;

create or replace function public.offer_next_courier(round_id_value uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare round_row public.order_offer_rounds%rowtype; candidate_id uuid; attempt_id_value uuid;
begin
  select * into round_row from public.order_offer_rounds where id = round_id_value for update;
  if not found or round_row.status <> 'active' or round_row.attempt_count >= 3 then return null; end if;
  select c.id into candidate_id from public.couriers c join public.courier_presence cp on cp.courier_id = c.id
  where c.is_active and c.is_online and c.availability_expires_at > now() and cp.observed_at >= now() - interval '5 minutes'
    and not exists (select 1 from public.order_offer_attempts a where a.round_id = round_row.id and a.courier_id = c.id)
    and not exists (select 1 from public.orders o where o.assigned_courier_id = c.id and o.status in ('assigned','heading_to_pickup','at_pickup','picked_up','heading_to_delivery','at_delivery','incident'))
  order by cp.observed_at desc limit 1 for update skip locked;
  if candidate_id is null then return null; end if;
  insert into public.order_offer_attempts(round_id, courier_id, expires_at) values (round_row.id, candidate_id, now() + interval '45 seconds') returning id into attempt_id_value;
  update public.order_offer_rounds set attempt_count = attempt_count + 1, current_attempt_id = attempt_id_value, updated_at = now() where id = round_row.id;
  perform public.enqueue_offer_notification(attempt_id_value); return attempt_id_value;
end;
$$;

create or replace function public.start_order_offer_round(order_id_value uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare round_id_value uuid;
begin
  if not exists (select 1 from public.orders where id = order_id_value and status = 'confirmed' and assigned_courier_id is null) then return null; end if;
  insert into public.order_offer_rounds(order_id) values (order_id_value) on conflict (order_id) do nothing returning id into round_id_value;
  if round_id_value is null then select id into round_id_value from public.order_offer_rounds where order_id = order_id_value; end if;
  perform public.offer_next_courier(round_id_value); return round_id_value;
end;
$$;

create or replace function public.accept_order_offer(attempt_id_value uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare attempt_row public.order_offer_attempts%rowtype; round_row public.order_offer_rounds%rowtype; result public.orders%rowtype;
begin
  select * into attempt_row from public.order_offer_attempts where id = attempt_id_value for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  select * into round_row from public.order_offer_rounds where id = attempt_row.round_id for update;
  if attempt_row.courier_id not in (select id from public.couriers where profile_id = auth.uid() and is_active and is_online and availability_expires_at > now()) then raise exception 'COURIER_NOT_AVAILABLE'; end if;
  if round_row.status <> 'active' or attempt_row.status <> 'active' or attempt_row.expires_at <= now() then raise exception 'OFFER_EXPIRED'; end if;
  update public.orders set assigned_courier_id = attempt_row.courier_id, status = 'assigned', updated_at = now() where id = round_row.order_id and status = 'confirmed' and assigned_courier_id is null returning * into result;
  if not found then raise exception 'ORDER_NOT_AVAILABLE'; end if;
  update public.order_offer_attempts set status = case when id = attempt_id_value then 'accepted' else 'rejected' end, responded_at = now() where round_id = round_row.id and status = 'active';
  update public.order_offer_rounds set status = 'accepted', updated_at = now() where id = round_row.id;
  insert into public.order_assignments(order_id, courier_id, assigned_by) values (result.id, attempt_row.courier_id, auth.uid());
  insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason) values (result.id, 'confirmed', 'assigned', auth.uid(), 'Oferta aceptada');
  perform public.emit_order_notification_event('order.assigned', result.id, auth.uid()); return result;
end;
$$;

create or replace function public.prevent_direct_courier_assignment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_courier_id is distinct from old.assigned_courier_id and public.current_role() = 'courier' and not exists (
    select 1 from public.order_offer_attempts a join public.order_offer_rounds r on r.id = a.round_id
    where r.order_id = new.id and a.courier_id = new.assigned_courier_id and a.status = 'accepted'
  ) then raise exception 'OFFER_REQUIRED'; end if;
  return new;
end;
$$;
drop trigger if exists orders_prevent_direct_courier_assignment on public.orders;
create trigger orders_prevent_direct_courier_assignment before update of assigned_courier_id on public.orders for each row execute function public.prevent_direct_courier_assignment();

-- Mark the attempt before assigning so the guard above also protects direct RPC calls.
create or replace function public.accept_order_offer(attempt_id_value uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare attempt_row public.order_offer_attempts%rowtype; round_row public.order_offer_rounds%rowtype; result public.orders%rowtype;
begin
  select * into attempt_row from public.order_offer_attempts where id = attempt_id_value for update;
  if not found then raise exception 'OFFER_NOT_FOUND'; end if;
  select * into round_row from public.order_offer_rounds where id = attempt_row.round_id for update;
  if attempt_row.courier_id not in (select id from public.couriers where profile_id = auth.uid() and is_active and is_online and availability_expires_at > now()) then raise exception 'COURIER_NOT_AVAILABLE'; end if;
  if round_row.status <> 'active' or attempt_row.status <> 'active' or attempt_row.expires_at <= now() then raise exception 'OFFER_EXPIRED'; end if;
  update public.order_offer_attempts set status = case when id = attempt_id_value then 'accepted' else 'rejected' end, responded_at = now() where round_id = round_row.id and status = 'active';
  update public.orders set assigned_courier_id = attempt_row.courier_id, status = 'assigned', updated_at = now() where id = round_row.order_id and status = 'confirmed' and assigned_courier_id is null returning * into result;
  if not found then raise exception 'ORDER_NOT_AVAILABLE'; end if;
  update public.order_offer_rounds set status = 'accepted', updated_at = now() where id = round_row.id;
  insert into public.order_assignments(order_id, courier_id, assigned_by) values (result.id, attempt_row.courier_id, auth.uid());
  insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason) values (result.id, 'confirmed', 'assigned', auth.uid(), 'Oferta aceptada');
  perform public.emit_order_notification_event('order.assigned', result.id, auth.uid()); return result;
end;
$$;

create or replace function public.expire_dispatch_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare round_row record; expired_count integer := 0; escalated_count integer := 0;
begin
  update public.couriers set is_online = false, updated_at = now() where is_online and availability_expires_at <= now();
  update public.order_offer_attempts set status = 'expired', responded_at = now() where status = 'active' and expires_at <= now(); get diagnostics expired_count = row_count;
  for round_row in select r.id, r.order_id from public.order_offer_rounds r where r.status = 'active' and not exists (select 1 from public.order_offer_attempts a where a.round_id = r.id and a.status = 'active') for update skip locked loop
    if (select attempt_count from public.order_offer_rounds where id = round_row.id) < 3 and public.offer_next_courier(round_row.id) is not null then continue; end if;
    update public.order_offer_rounds set status = 'escalated', escalated_at = now(), updated_at = now() where id = round_row.id and status = 'active';
    insert into public.notifications(user_id, order_id, channel, type, title, body, payload, status, sent_at)
    select p.id, round_row.order_id, 'in_app', 'order.offer_escalated', 'Pedido sin cadete', 'Tres cadetes no respondieron. Requiere asignación manual.', '{}'::jsonb, 'sent', now() from public.profiles p where p.role = 'admin';
    escalated_count := escalated_count + 1;
  end loop;
  return jsonb_build_object('expiredOffers', expired_count, 'escalatedRounds', escalated_count);
end;
$$;

create or replace function public.renew_courier_availability()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare expires_value timestamptz;
begin
  update public.couriers set is_online = true, availability_confirmed_at = now(), last_heartbeat_at = now(), availability_expires_at = now() + interval '15 minutes', updated_at = now()
  where profile_id = auth.uid() and is_active and public.current_role() = 'courier' returning availability_expires_at into expires_value;
  if expires_value is null then raise exception 'COURIER_NOT_AVAILABLE'; end if; return expires_value;
end;
$$;

create or replace function public.set_courier_availability(online boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare courier_row public.couriers%rowtype;
begin
  select * into courier_row from public.couriers where profile_id = auth.uid() for update;
  if not found or public.current_role() <> 'courier' or not courier_row.is_active then raise exception 'COURIER_NOT_AVAILABLE'; end if;
  update public.couriers set is_online = online, availability_confirmed_at = case when online then now() else null end, last_heartbeat_at = case when online then now() else null end, availability_expires_at = case when online then now() + interval '15 minutes' else null end, updated_at = now() where id = courier_row.id;
  if not online then delete from public.courier_presence where courier_id = courier_row.id; end if; return online;
end;
$$;

create or replace function public.start_offers_when_confirmed() returns trigger language plpgsql security definer set search_path = public as $$
begin if new.status = 'confirmed' and new.assigned_courier_id is null and (tg_op = 'INSERT' or old.status is distinct from new.status) then perform public.start_order_offer_round(new.id); end if; return new; end;
$$;
drop trigger if exists orders_start_offer_round on public.orders;
create trigger orders_start_offer_round after insert or update of status on public.orders for each row execute function public.start_offers_when_confirmed();

create or replace function public.close_offer_round_when_assigned() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_courier_id is not null or new.status <> 'confirmed' then
    update public.order_offer_attempts set status = 'rejected', responded_at = now() where round_id in (select id from public.order_offer_rounds where order_id = new.id and status = 'active') and status = 'active';
    update public.order_offer_rounds set status = 'cancelled', updated_at = now() where order_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_close_offer_round on public.orders;
create trigger orders_close_offer_round after update of status, assigned_courier_id on public.orders for each row execute function public.close_offer_round_when_assigned();

grant execute on function public.renew_courier_availability() to authenticated;
grant execute on function public.accept_order_offer(uuid) to authenticated;
grant execute on function public.expire_dispatch_state() to service_role;
