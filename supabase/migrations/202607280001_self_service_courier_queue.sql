-- Self-service dispatch: an order enters the courier queue immediately.
-- Administrators configure the platform but never confirm or assign orders.

create or replace function public.queue_new_order_for_couriers()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending_confirmation' and new.assigned_courier_id is null then
    new.status := 'confirmed';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_queue_new_order on public.orders;
create trigger orders_queue_new_order before insert on public.orders
for each row execute function public.queue_new_order_for_couriers();

-- Orders created under the old workflow must not wait for an administrator.
update public.orders
set status = 'confirmed', updated_at = now()
where status = 'pending_confirmation' and assigned_courier_id is null;

insert into public.order_status_history(order_id, previous_status, new_status, reason, metadata)
select o.id, 'pending_confirmation', 'confirmed', 'Ingreso automático a la cola de cadetes', jsonb_build_object('source', 'self-service-dispatch')
from public.orders o
where o.status = 'confirmed'
  and not exists (
    select 1 from public.order_status_history h
    where h.order_id = o.id and h.new_status = 'confirmed'
  );

-- The previous mechanism sent a timed exclusive offer. The shared queue is
-- deliberately visible to every online courier instead.
drop trigger if exists orders_start_offer_round on public.orders;
drop trigger if exists orders_prevent_direct_courier_assignment on public.orders;

create or replace function public.claim_available_order(order_id_value uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare courier_row public.couriers%rowtype; result public.orders%rowtype;
begin
  select * into courier_row
  from public.couriers
  where profile_id = auth.uid() and is_active and is_online and availability_expires_at > now()
  for update;
  if not found or public.current_role() <> 'courier' then raise exception 'COURIER_NOT_AVAILABLE'; end if;

  if exists (
    select 1 from public.orders
    where assigned_courier_id = courier_row.id
      and status in ('assigned','heading_to_pickup','at_pickup','picked_up','heading_to_delivery','at_delivery','incident')
  ) then raise exception 'COURIER_HAS_ACTIVE_ORDER'; end if;

  update public.orders
  set assigned_courier_id = courier_row.id, status = 'assigned', updated_at = now()
  where id = order_id_value and status = 'confirmed' and assigned_courier_id is null
  returning * into result;
  if not found then raise exception 'ORDER_NOT_AVAILABLE'; end if;

  insert into public.order_assignments(order_id, courier_id, assigned_by)
  values (result.id, courier_row.id, auth.uid());
  insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason)
  values (result.id, 'confirmed', 'assigned', auth.uid(), 'Tomado por el cadete desde la cola');
  perform public.emit_order_notification_event('order.assigned', result.id, auth.uid());
  return result;
end;
$$;

-- Once claimed, only the assigned courier can advance the order. Admins do
-- not have a status transition path in the operational workflow.
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
  if target_status = 'delivered' then
    if ord.pin_locked_until is not null and ord.pin_locked_until > now() then raise exception 'PIN_TEMPORARILY_LOCKED'; end if;
    if delivery_pin is null or ord.delivery_pin_hash <> crypt(delivery_pin, ord.delivery_pin_hash) then
      update public.orders set pin_attempts = pin_attempts + 1, pin_locked_until = case when pin_attempts + 1 >= 5 then now() + interval '15 minutes' else pin_locked_until end where id = order_id;
      raise exception 'INVALID_DELIVERY_PIN';
    end if;
    insert into public.delivery_proofs(order_id, storage_path, proof_type, pin_validated) values (order_id, 'pin://validated', 'pin', true);
  end if;
  update public.orders set status = target_status, completed_at = case when target_status = 'delivered' then now() else completed_at end, cancelled_at = case when target_status = 'cancelled' then now() else cancelled_at end, updated_at = now() where id = order_id returning * into ord;
  insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason) values (order_id, previous_status, target_status, auth.uid(), nullif(reason_text, ''));
  perform public.emit_order_notification_event(case when target_status = 'assigned' then 'order.assigned' else 'order.status_changed' end, order_id, auth.uid());
  return ord;
end;
$$;

revoke all on function public.assign_order_to_courier(uuid, uuid, text) from authenticated;
grant execute on function public.claim_available_order(uuid) to authenticated;
grant execute on function public.transition_order_status(uuid, public.order_status, text, text) to authenticated;
