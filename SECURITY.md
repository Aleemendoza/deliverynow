# Seguridad

- RLS está activado para entidades privadas; roles derivan de `profiles`, no de metadata cliente.
- Cambios de estados, PIN, evidencias y reasignación deben ser RPC/handlers autenticados que registren auditoría.
- Aplicá rate limiting a creación, tracking y validación PIN; hasheá PIN con bcrypt/argon2 y limitá intentos.
- Usá CSP, HSTS, `X-Content-Type-Options: nosniff`, validación MIME/tamaño y CSRF en mutaciones basadas en cookies.
- Nunca expongas `SUPABASE_SERVICE_ROLE_KEY`, VAPID private key ni Google server key.
