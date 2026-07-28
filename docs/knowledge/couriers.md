# Dominio: operación de cadetes

> La migración `202607280004_fix_notification_event_identifier.sql` corrige una ambigüedad entre la variable local y la columna `notification_outbox.event_id` en la emisión de notificaciones. Sin ella, el evento `order.assigned` revierte de forma atómica el reclamo de un pedido.

> El panel carga los pedidos asignados mediante una consulta de servidor limitada al registro `couriers` perteneciente al perfil autenticado. La autorización de sesión se verifica antes de la consulta; esto evita que una política RLS desactualizada o incompleta oculte el trabajo ya asignado.

## Componentes y rutas

- Panel: `src/app/courier/page.tsx`; requiere rol `courier`.
- Pedidos: `src/app/courier/orders/page.tsx` y componentes `src/components/courier/`.
- Disponibilidad/presencia: rutas `api/courier/availability`, `heartbeat` y `presence`, con componentes de toggle y lease.
- Ofertas: `api/courier/offers` y aceptación en `api/courier/offers/[attemptId]/accept`.

## Experiencia operativa del panel

- La cola de pedidos, las tareas en curso y el historial viven en `/courier`; `/courier/orders` conserva compatibilidad mediante redirección al panel.
- El panel considera disponible a un cadete sólo si `is_online` y su lease no expiró. Al activar disponibilidad, la cola se consulta automáticamente; cuando la API o el intento de toma informa `COURIER_OFFLINE`, se bloquea la cola y se pide reactivar disponibilidad y ubicación.
- `couriers.transport_type` es la fuente de verdad de movilidad. El cadete puede elegir `bici` o `moto` desde `/courier/profile`; perfil, panel y respuesta de guardado leen el mismo registro operativo autorizado y confirman el valor persistido.
- La disponibilidad visible no se deriva de la respuesta nominal de una RPC: sólo se confirma cuando el registro operativo persiste `is_online`, `is_active` y `availability_expires_at` vigente. La migración `202607280002_confirm_courier_availability_state.sql` reafirma este contrato para entornos que conservaran una versión anterior de la RPC.

## Invariantes

- El cadete asignado puede finalizar desde `at_delivery` sin PIN; el cambio conserva actor, historial y marca temporal de finalización.

- Sólo un cadete activo, online y con lease vigente puede ver o tomar trabajo operativo.
- Un cadete no puede tener más de un pedido activo.
- Sólo el cadete asignado puede avanzar el estado de su pedido; toda transición debe registrar historial y actor.
- La aceptación concurrente debe ser atómica: un pedido no puede terminar asignado a más de un cadete.

## Cola autogestionada

Las migraciones versionadas `202607280001_self_service_courier_queue.sql` y `202607280003_remove_legacy_offer_close_trigger.sql`, junto con sus cambios de UI/API, sustituyen ofertas exclusivas temporales por una cola visible a cadetes disponibles. El primero que reclama el pedido queda asignado mediante la RPC `claim_available_order`; ningún trigger heredado de rondas de ofertas debe ejecutarse durante ese reclamo.

El control de concurrencia, disponibilidad y pedido activo reside en la RPC. La migración debe aplicarse y validarse en cada entorno antes de habilitar el flujo operativo. Al trabajar en este dominio, revisar también las migraciones `202607270004` a `202607270006`, la ruta de aceptación y el panel de pedidos.
