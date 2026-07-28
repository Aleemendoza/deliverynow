# 2026-07-28 - Correccion de emision de notificaciones al asignar

## Estado

`implementado` en codigo versionado; aplicacion de migracion pendiente por entorno.

## Motivo y alcance

La prueba controlada de `claim_available_order` devolvio SQLSTATE `42702`: la variable PL/pgSQL `event_id` era ambigua con la columna `notification_outbox.event_id`. La excepcion ocurria al escribir el outbox y revertia toda la toma atomica del pedido. La migracion renombra solamente la variable local a `notification_event_id`.

## Impacto

- Areas afectadas: toma de pedidos y notificaciones del ciclo de vida.
- Contratos/API: la aceptacion deja de responder `ORDER_CLAIM_FAILED` por esta ambiguedad.
- Datos/migraciones/RLS: `202607280004_fix_notification_event_identifier.sql` redefine una funcion; no modifica registros ni permisos.
- Seguridad/privacidad: conserva `security definer`, `search_path` y el modelo de outbox.
- Compatibilidad y dependencias: requiere las tablas de notificaciones existentes desde las migraciones operativas previas.

## Archivos modificados

- `supabase/migrations/202607280004_fix_notification_event_identifier.sql` - elimina la ambiguedad SQL.
- `docs/knowledge/couriers.md` - documenta la dependencia del reclamo con la emision de eventos.

## Validacion

- Ejecutado: reproduccion controlada en Supabase; se obtuvo `42702 column reference "event_id" is ambiguous`.
- Pendiente: aplicar la migracion y reclamar un pedido desde un cadete online en produccion.

## Rollback

Restaurar la definicion previa de la funcion solo si se revierte el sistema de notificaciones completo. No hay datos que deshacer.

## Conocimiento actualizado

- [Operacion de cadetes](../knowledge/couriers.md)
