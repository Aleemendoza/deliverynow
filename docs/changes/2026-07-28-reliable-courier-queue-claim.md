# 2026-07-28 — Reclamo confiable de pedidos en cola

## Estado

`implementado` en código versionado; aplicación de migración pendiente por entorno.

## Motivo y alcance

La migración de cola reemplazó las ofertas exclusivas, pero el trigger heredado `orders_close_offer_round` podía permanecer activo y ejecutarse al asignar un pedido. Se lo elimina explícitamente. La API sólo comunica que otro cadete tomó un pedido cuando la RPC devuelve `ORDER_NOT_AVAILABLE`; cualquier otro fallo queda registrado y responde como error operativo.

## Impacto

- Áreas afectadas: toma de pedidos desde el panel de cadete.
- Contratos/API: `ORDER_UNAVAILABLE` queda reservado para concurrencia real; `ORDER_CLAIM_FAILED` indica fallo técnico y devuelve 503.
- Datos/migraciones/RLS: `202607280003_remove_legacy_offer_close_trigger.sql` elimina el trigger heredado, sin eliminar pedidos ni historial.
- Seguridad/privacidad: no relaja autorización ni los controles atómicos de la RPC.
- Compatibilidad y dependencias: debe aplicarse después de `202607280001`.

## Archivos modificados

- `supabase/migrations/202607280003_remove_legacy_offer_close_trigger.sql` — retiro del trigger de rondas antiguas.
- `src/app/api/courier/offers/[attemptId]/accept/route.ts` — clasificación correcta de errores y registro seguro de diagnóstico.
- `docs/knowledge/couriers.md` — invariante de ausencia de triggers heredados.

## Validación

- Ejecutado: revisión estática de la ruta, de `claim_available_order` y de los triggers de `202607270006`.
- Pendiente: aplicar migración y probar toma de un pedido por un único cadete en Supabase desplegado.

## Rollback

Revertir el cambio de API. El trigger eliminado sólo debe restaurarse si se revierte por completo al esquema de ofertas exclusivas.

## Conocimiento actualizado

- [Operación de cadetes](../knowledge/couriers.md)
