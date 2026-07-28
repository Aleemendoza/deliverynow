# 2026-07-28 — Estado operativo verificable de cadetes

## Estado

`implementado`

## Motivo y alcance

El panel podía mostrar disponibilidad durante la respuesta del botón y luego volver a desconectado al consultar la cola: ésta exige un lease vigente, mientras una RPC desactualizada podía devolver el booleano solicitado sin persistirlo. Además, perfil y panel tenían lecturas independientes de movilidad. Se centraliza la lectura del registro operativo y se confirma cada mutación contra el valor persistido.

## Impacto

- Áreas afectadas: panel, perfil y cola del cadete.
- Contratos/API: disponibilidad y heartbeat pueden responder `AVAILABILITY_STATE_UNCONFIRMED` o `AVAILABILITY_STATE_UNAVAILABLE`; movilidad puede responder `TRANSPORT_STATE_UNCONFIRMED` o `TRANSPORT_STATE_UNAVAILABLE`. Los éxitos contienen valores confirmados.
- Datos/migraciones/RLS: `202607280002_confirm_courier_availability_state.sql` vuelve a declarar las RPC de disponibilidad para que el flag y el lease se actualicen de manera atómica. Debe aplicarse en cada entorno antes de habilitar operación.
- Seguridad/privacidad: se conserva la autorización por sesión y rol; la confirmación se efectúa sólo en el servidor con el registro de la identidad autenticada.
- Compatibilidad y dependencias: no incorpora dependencias ni expone datos nuevos.

## Archivos modificados

- `src/lib/couriers/operational-profile.ts` — fuente de lectura y regla compartida de disponibilidad.
- `src/app/courier/page.tsx`, `src/app/courier/profile/page.tsx` y `src/lib/profiles/experience.ts` — consumen el mismo perfil operativo.
- `src/app/api/courier/availability/*` y `transport/route.ts` — verifican el estado persistido antes de responder éxito.
- `src/components/courier/courier-availability-context.tsx` — se reinicializa al llegar un lease nuevo desde el servidor.
- `supabase/migrations/202607280002_confirm_courier_availability_state.sql` — reparación idempotente de RPC de lease.

## Validación

- Ejecutado: `eslint` acotado sobre los archivos modificados y `tsc --noEmit --incremental false`.
- Pendiente: aplicar la migración y probar con un cadete en el entorno desplegado: activar, renovar, recargar el panel, guardar bicicleta/moto y consultar la cola.

## Rollback

Revertir el cambio de aplicación y ejecutar una migración posterior que reponga las definiciones previas de RPC. La migración no elimina datos ni cambia columnas.

## Conocimiento actualizado

- [Operación de cadetes](../knowledge/couriers.md)
- [Contratos HTTP](../knowledge/api.md)
