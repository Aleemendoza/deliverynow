-- pgcrypto is installed in Supabase's extensions schema. The order RPC needs
-- that schema to generate and hash the delivery PIN securely.
alter function public.create_guest_order(jsonb) set search_path = public, extensions;
notify pgrst, 'reload schema';
