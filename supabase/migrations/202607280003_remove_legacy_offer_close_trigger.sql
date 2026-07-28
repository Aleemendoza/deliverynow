-- The shared courier queue no longer owns offer rounds. Leaving this legacy
-- trigger active makes every successful claim invoke the retired offer flow.
drop trigger if exists orders_close_offer_round on public.orders;
