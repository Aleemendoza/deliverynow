# 2026-07-28 — Cola de cadete integrada al panel

## Estado

`implementado`

## Motivo y alcance

La disponibilidad y la cola operativa estaban separadas en dos pantallas. Esto permitía que el panel indicara disponibilidad mientras la consulta de ofertas respondía que el lease no era válido. La cola de pedidos, las tareas en curso y el historial se integran ahora en `/courier`; al activar disponibilidad, la consulta comienza automáticamente y una respuesta `COURIER_OFFLINE` vuelve el estado visual a no disponible.

## Impacto

- Áreas afectadas: panel del cadete, cola de pedidos y aceptación de pedidos.
- Contratos/API: `offers/[attemptId]/accept` informa `COURIER_OFFLINE` cuando la RPC rechaza la toma por falta de disponibilidad. No cambia los payloads de éxito.
- Datos/migraciones/RLS: sin migraciones. Se conserva la validación de disponibilidad, lease, rol y concurrencia en las RPC.
- Seguridad/privacidad: la UI nunca habilita una cola para un lease inactivo; la API y la RPC continúan siendo los límites autoritativos para ver y tomar pedidos.
- Compatibilidad y dependencias: `/courier/orders` redirige a `/courier` para conservar enlaces existentes. Sin dependencias nuevas.

## Archivos modificados

- `src/app/courier/page.tsx` — panel único con cola, pedidos activos e historial.
- `src/app/courier/orders/page.tsx` — redirección de compatibilidad.
- `src/components/courier/courier-availability-*.tsx` — estado compartido entre toggle, presencia, lease y cola.
- `src/components/courier/nearby-offers.tsx` y `courier-offer-card.tsx` — carga automática y bloqueo ante indisponibilidad.
- `src/app/api/courier/offers/[attemptId]/accept/route.ts` — error de disponibilidad explícito.
- `docs/knowledge/couriers.md` y `docs/knowledge/api.md` — flujo y contrato actualizados.

## Validación

- Ejecutado: lint acotado de los archivos modificados y `tsc --noEmit --incremental false`, sin errores.
- Pendiente: prueba integrada con Supabase de activación, lease vigente/vencido, ubicación rechazada, cola vacía, toma exitosa y toma rechazada por indisponibilidad.

## Rollback

Revertir los archivos listados. La redirección puede revertirse de forma independiente si se necesitara restaurar la ruta separada; no hay migraciones ni datos para revertir.

## Conocimiento actualizado

- [Operación de cadetes](../knowledge/couriers.md)
- [Contratos HTTP](../knowledge/api.md)
