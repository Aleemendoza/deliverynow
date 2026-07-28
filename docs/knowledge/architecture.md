# Arquitectura y límites

## Estructura

| Capa | Ubicación | Responsabilidad |
| --- | --- | --- |
| Presentación | `src/app`, `src/components` | Rutas App Router y componentes React. |
| Dominio | `src/features`, `src/lib/orders`, `src/lib/pricing`, `src/lib/validation` | Validación, precios, reglas de estado y casos de uso. |
| Infraestructura | `src/lib/supabase`, `src/lib/google`, `src/lib/notifications` | Clientes Supabase, Google Routes/Maps y notificaciones. |
| Datos | `supabase/migrations`, `supabase/seed.sql` | Esquema, RPC, políticas y datos iniciales. |

## Reglas de integración

- Las rutas API (`src/app/api`) son límites de confianza: deben validar entrada, autenticar/autorizar y no revelar secretos.
- El cliente de navegador no recibe la clave de servicio. Las operaciones privilegiadas se ejecutan mediante el cliente servidor o RPC con controles explícitos.
- Google Routes se invoca sólo desde servidor. Los cambios de precio deben conservar snapshots históricos en el pedido.
- Las mutaciones de base de datos deben considerar RPC, transacción, RLS y auditoría; una modificación de UI no autoriza a saltar estos límites.
- `src/proxy.ts` y `src/lib/auth/session.ts` participan en el flujo de sesión y roles. Revisarlos al agregar rutas privadas.

## Accesibilidad visual

- `src/app/globals.css` define tokens de superficie, controles y foco para toda la aplicación. Los campos no dependen del color de relleno para indicar que son interactivos: conservan borde visible, foco de teclado reforzado y texto/placeholder de alto contraste.
- Los estados de error se expresan con texto mediante `role="alert"` además de un borde diferenciado; las acciones conservan etiquetas explícitas e iconos complementarios.

## Verificación mínima por cambio

| Cambio | Revisar además |
| --- | --- |
| Página o componente | Ruta consumidora, estados vacío/error/carga y accesibilidad. |
| API | Schema, llamadores, respuestas de error, autorización y rate limit. |
| Migración/RPC | Tipos de dominio, RLS, reversibilidad, datos existentes y rutas consumidoras. |
| Integración externa | Variables de entorno, adaptador, fallos y documentación de despliegue. |
