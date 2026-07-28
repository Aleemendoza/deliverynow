-- Keep the availability lease and the visible online flag in the same transaction.
-- This protects environments upgraded from the pre-lease availability function.
create or replace function public.set_courier_availability(online boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare courier_row public.couriers%rowtype;
begin
  select * into courier_row from public.couriers where profile_id = auth.uid() for update;
  if not found or public.current_role() <> 'courier' or not courier_row.is_active then
    raise exception 'COURIER_NOT_AVAILABLE';
  end if;

  update public.couriers
  set is_online = online,
      availability_confirmed_at = case when online then now() else null end,
      last_heartbeat_at = case when online then now() else null end,
      availability_expires_at = case when online then now() + interval '15 minutes' else null end,
      updated_at = now()
  where id = courier_row.id;

  if not online then
    delete from public.courier_presence where courier_id = courier_row.id;
  end if;
  return online;
end;
$$;

create or replace function public.renew_courier_availability()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare expires_value timestamptz;
begin
  update public.couriers
  set is_online = true,
      availability_confirmed_at = now(),
      last_heartbeat_at = now(),
      availability_expires_at = now() + interval '15 minutes',
      updated_at = now()
  where profile_id = auth.uid() and is_active and public.current_role() = 'courier'
  returning availability_expires_at into expires_value;

  if expires_value is null then
    raise exception 'COURIER_NOT_AVAILABLE';
  end if;
  return expires_value;
end;
$$;

grant execute on function public.set_courier_availability(boolean) to authenticated;
grant execute on function public.renew_courier_availability() to authenticated;
