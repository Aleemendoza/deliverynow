-- Keep the operational courier record in sync with the protected profile role.
-- This backfills accounts whose role was promoted manually before the courier
-- workspace existed, and prevents the same inconsistency for future accounts.

insert into public.couriers(profile_id, transport_type)
select profile.id, 'moto'
from public.profiles profile
where profile.role = 'courier'
  and not exists (
    select 1 from public.couriers courier where courier.profile_id = profile.id
  );

create or replace function public.provision_courier_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'courier'
    and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.role is distinct from 'courier')) then
    insert into public.couriers(profile_id, transport_type)
    values (new.id, 'moto')
    on conflict (profile_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_provision_courier on public.profiles;
create trigger profiles_provision_courier
after insert or update of role on public.profiles
for each row execute procedure public.provision_courier_profile();
