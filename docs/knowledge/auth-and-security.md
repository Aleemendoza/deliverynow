# Identidad y seguridad

## Identidad y roles

- Supabase Auth gestiona sesión. `src/lib/auth/session.ts` ofrece la protección de rol usada por paneles privados.
- Los roles se derivan de `profiles` en base de datos; nunca se deben confiar roles entregados por el cliente.
- Las páginas de cuenta y autenticación viven en `src/app/account` y `src/app/auth`.

## Reglas obligatorias

- Validar toda entrada con contratos Zod o validación equivalente en el límite HTTP/RPC.
- Proteger mutaciones por sesión, rol y propiedad del recurso; aplicar RLS también a acceso directo a Supabase.
- No exponer secretos de servidor: service role, claves VAPID privadas y clave server de Google.
- Aplicar rate limiting a creación de pedidos, tracking y PIN. Proteger PIN con hash lento y límites de intentos.
- Para archivos: buckets privados, validación de tipo/tamaño, URL firmada autorizada y sin contenido público por defecto.

Consultar [`SECURITY.md`](../../SECURITY.md) antes de tocar autenticación, datos sensibles, rutas mutantes o almacenamiento.
