-- Cadete operational workspace: status timestamps, incident traceability and own availability.

create policy status_history_authorized_read on public.order_status_history for select using (
  public.is_admin()
  or exists (
    select 1 from public.orders order_row
    where order_row.id = order_status_history.order_id
      and order_row.assigned_courier_id in (select id from public.couriers where profile_id = auth.uid())
  )
);

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
  if not found or public.current_role() <> 'courier' or not courier_row.is_active then raise exception 'COURIER_NOT_AVAILABLE'; end if;
  update public.couriers set is_online = online, updated_at = now() where id = courier_row.id;
  return online;
end;
$$;

create or replace function public.transition_order_status(order_id uuid, target_status public.order_status, reason_text text default null, delivery_pin text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare ord public.orders%rowtype; actor_role public.user_role; actor_courier_id uuid; previous_order_status public.order_status; allowed boolean := false;
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
  if target_status = 'at_pickup' then update public.order_stops set arrived_at = now() where order_id = ord.id and type = 'pickup'; end if;
  if target_status = 'picked_up' then update public.order_stops set completed_at = now() where order_id = ord.id and type = 'pickup'; end if;
  if target_status = 'at_delivery' then update public.order_stops set arrived_at = now() where order_id = ord.id and type = 'delivery'; end if;
  if target_status = 'delivered' then update public.order_stops set completed_at = now() where order_id = ord.id and type = 'delivery'; end if;
  if target_status = 'incident' then insert into public.incidents(order_id, courier_id, type, description) values (ord.id, actor_courier_id, 'courier_report', coalesce(nullif(trim(reason_text), ''), 'Incidencia reportada por el cadete')); end if;
  update public.orders set status = target_status, completed_at = case when target_status = 'delivered' then now() else completed_at end, cancelled_at = case when target_status = 'cancelled' then now() else cancelled_at end, updated_at = now() where id = order_id returning * into ord;
  insert into public.order_status_history(order_id, previous_status, new_status, changed_by, reason) values (order_id, previous_order_status, target_status, auth.uid(), nullif(reason_text,''));
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data) values (auth.uid(), 'order.status_changed', 'order', order_id, jsonb_build_object('status', target_status));
  return ord;
end;
$$;

grant execute on function public.set_courier_availability(boolean) to authenticated;
