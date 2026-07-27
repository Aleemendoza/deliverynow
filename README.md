# Delivery Ya

PWA mobile-first para pedidos locales, seguimiento y operación de cadetería en Villa Constitución.

## Inicio rápido

1. Copiá `.env.example` como `.env.local` y completá las variables.
2. Creá un proyecto Supabase y ejecutá las migraciones en orden (`202607240001_initial_schema.sql` y `202607240002_operational_integrations.sql`), luego `supabase/seed.sql`.
3. Ejecutá `npm install` y `npm run dev`.
4. Configurá Google OAuth en Supabase, con callback `https://<project-ref>.supabase.co/auth/v1/callback`, y agregá `http://localhost:3000/auth/callback` como redirect URL de la aplicación.

`NEXT_PUBLIC_*` puede llegar al navegador. Todo el resto es secreto de servidor. No subas `.env.local`.

## Integraciones

- **Supabase:** habilitá Email/Password y Google en Auth. Registrá las URLs de redirección local y de producción. Ejecutá las migraciones antes de probar pedidos: la segunda crea RLS adicional, tracking secuencial, RPC de creación/transición, PIN con bcrypt y suscripciones push.
- **Google Maps:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` debe restringirse por HTTP referrer y habilitar Maps JavaScript API + Places API. `GOOGLE_MAPS_SERVER_API_KEY` debe ser una clave distinta, restringida por IP/entorno y habilitar Routes API.
- **Resend:** configurá `RESEND_API_KEY` y un remitente verificado en `RESEND_FROM_EMAIL`. Sin estas variables el pedido se persiste pero el adaptador de correo informa que se omitió el envío.
- **Web Push:** generá claves VAPID con `npx web-push generate-vapid-keys`; cargá la pública en `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y las demás sólo en servidor. El cadete activa permisos explícitamente desde su panel; nunca se solicitan al abrir la landing.
- **Storage:** creá los buckets privados `delivery-proofs`, `incident-evidence` y `profile-images`. No los marques públicos; las cargas de evidencia se habilitan únicamente a través de handlers autenticados.

Para producción, verificá que la instancia de Supabase tenga aplicada la migración y que todas las variables requeridas estén configuradas: el build local no valida conectividad ni permisos contra servicios externos.

## Comandos

- `npm run dev`: desarrollo.
- `npm run lint`: chequeo estático.
- `npm run test`: pruebas unitarias.
- `npm run build`: build de producción.

Consultá [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [SECURITY.md](SECURITY.md), [DEPLOYMENT.md](DEPLOYMENT.md) y [TESTING.md](TESTING.md) antes de desplegar.
