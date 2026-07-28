# 2026-07-28 — Cola autogestionada de cadetes

## Estado

`implementado` en el código versionado; despliegue de la migración pendiente de verificar por entorno.

## Motivo y alcance

Se reemplaza la oferta exclusiva y temporizada por una cola común de pedidos confirmados. Los cadetes disponibles pueden ver la cola y el primero que reclama un pedido queda asignado de forma atómica. La administración conserva configuración y monitoreo, no confirma ni asigna pedidos manualmente.

## Impacto

- Áreas afectadas: panel de cadete, pedidos disponibles, aceptación, panel administrativo y flujo de confirmación.
- Contratos/API: `api/courier/offers` entrega cola disponible; aceptación reclama por ID de pedido.
- Datos/migraciones/RLS: `202607280001_self_service_courier_queue.sql` crea/actualiza el flujo de cola y la RPC `claim_available_order`.
- Seguridad/privacidad: la RPC exige cadete activo, online y con lease vigente; limita a un pedido activo y registra asignación e historial.
- Compatibilidad y dependencias: la migración elimina los triggers del esquema de ofertas exclusivas; debe aplicarse junto con el código que la consume.

## Archivos modificados

- `supabase/migrations/202607280001_self_service_courier_queue.sql` — cola, reclamo atómico y transiciones de cadete.
- `src/app/api/courier/offers/*` — consulta y toma de pedidos de la cola.
- `src/components/courier/*` — presentación y actualización periódica de la cola.
- `src/app/admin/page.tsx` — configuración y monitoreo de sólo lectura.

## Validación

- Ejecutado: revisión del commit versionado `6907220` y de la migración/rutas consumidoras.
- Pendiente: aplicar la migración en cada entorno, ejecutar pruebas de aceptación concurrente, disponibilidad vencida, pedido activo y transiciones autorizadas.

## Rollback

Revertir el commit de funcionalidad y aplicar una migración de reversión explícita. No restaurar triggers eliminados manualmente sin revisar dependencias del esquema anterior.

## Conocimiento actualizado

- [Operación de cadetes](../knowledge/couriers.md)
- [Pedidos y seguimiento](../knowledge/orders.md)
- [Contratos HTTP](../knowledge/api.md)
