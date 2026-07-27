-- Make the newly granted RPC immediately discoverable by Supabase's PostgREST API.
notify pgrst, 'reload schema';
