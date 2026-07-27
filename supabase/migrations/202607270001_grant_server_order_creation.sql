-- Order creation is invoked exclusively by the API with Supabase's service_role key.
-- Keep the RPC unavailable to browser roles while allowing the trusted server client.
revoke all on function public.create_guest_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_guest_order(jsonb) to service_role;
