# Datos e integraciones

## Supabase

Las migraciones se aplican en orden desde `supabase/migrations/`; no se deben editar migraciones ya aplicadas. Crear una nueva migración incremental y documentar su impacto. `supabase/seed.sql` aporta datos iniciales.

Entidades de dominio documentadas: perfiles/roles, clientes, cadetes, zonas, servicios, tarifas versionadas, pedidos, paradas, historial, asignaciones, notificaciones, evidencias, incidentes y auditoría. La definición exacta de columnas, tipos, RLS y funciones es el SQL versionado.

## Integraciones

| Servicio | Adaptador/límite | Condición |
| --- | --- | --- |
| Google Maps/Places | `src/lib/google/maps-loader.ts` | clave pública restringida por referrer. |
| Google Routes | `src/lib/google/routes.ts` | sólo servidor, clave separada y restringida. |
| Resend | `src/lib/notifications/email.ts` | requiere remitente y clave de servidor. |
| Web Push | `src/lib/notifications/push.ts` | VAPID privada sólo en servidor; consentimiento explícito. |
| Supabase Realtime | `src/lib/realtime/subscription.ts` | complemento de recarga, no fuente única al recuperar foco. |

Las credenciales, buckets y proveedores habilitados en cada entorno son **pendientes de verificar** fuera del repositorio. Consultar `README.md` y `DEPLOYMENT.md` antes de despliegue.
