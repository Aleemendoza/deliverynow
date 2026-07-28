# Dominio: operación de cadetes

## Componentes y rutas

- Panel: `src/app/courier/page.tsx`; requiere rol `courier`.
- Pedidos: `src/app/courier/orders/page.tsx` y componentes `src/components/courier/`.
- Disponibilidad/presencia: rutas `api/courier/availability`, `heartbeat` y `presence`, con componentes de toggle y lease.
- Ofertas: `api/courier/offers` y aceptación en `api/courier/offers/[attemptId]/accept`.

## Invariantes

- Sólo un cadete activo, online y con lease vigente puede ver o tomar trabajo operativo.
- Un cadete no puede tener más de un pedido activo.
- Sólo el cadete asignado puede avanzar el estado de su pedido; toda transición debe registrar historial y actor.
- La aceptación concurrente debe ser atómica: un pedido no puede terminar asignado a más de un cadete.

## Cola autogestionada

La migración versionada `202607280001_self_service_courier_queue.sql` y sus cambios de UI/API sustituyen ofertas exclusivas temporales por una cola visible a cadetes disponibles. El primero que reclama el pedido queda asignado mediante la RPC `claim_available_order`.

El control de concurrencia, disponibilidad y pedido activo reside en la RPC. La migración debe aplicarse y validarse en cada entorno antes de habilitar el flujo operativo. Al trabajar en este dominio, revisar también las migraciones `202607270004` a `202607270006`, la ruta de aceptación y el panel de pedidos.
