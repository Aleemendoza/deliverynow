# 2026-07-28 — Movilidad configurable y consistente de cadetes

## Estado

`implementado`

## Motivo y alcance

El perfil mostraba el medio de movilidad persistido, pero el panel podía indicar “Sin configurar” al intentar leer la fila operativa bajo una política RLS distinta. Se establece `couriers.transport_type` como única fuente de verdad: el cadete puede seleccionar bicicleta o moto desde su perfil y el panel consume la misma consulta autorizada.

## Impacto

- Áreas afectadas: perfil y panel de cadete.
- Contratos/API: se agrega `POST api/courier/transport` con el valor validado `bici` o `moto`.
- Datos/migraciones/RLS: no hay migraciones. Se reutiliza `couriers.transport_type`; la actualización se autoriza por el usuario autenticado y rol `courier` antes de escribir mediante cliente servidor.
- Seguridad/privacidad: el endpoint sólo modifica el registro asociado a la identidad autenticada. El panel consulta el registro con cliente servidor después de validar el rol.
- Compatibilidad y dependencias: sin dependencias nuevas.

## Archivos modificados

- `src/app/api/courier/transport/route.ts` — validación y persistencia de movilidad.
- `src/components/courier/courier-transport-form.tsx` — selector accesible y feedback de guardado.
- `src/app/courier/profile/page.tsx` y `src/app/courier/page.tsx` — lectura consistente de la fila operativa.
- `docs/knowledge/couriers.md` y `docs/knowledge/api.md` — fuente de verdad y contrato documentados.

## Validación

- Ejecutado: lint acotado y `tsc --noEmit --incremental false`, sin errores.
- Pendiente: prueba integrada con sesión de cadete para ambos valores, perfil sin fila previa, error de red y confirmación visual del panel tras guardar.

## Rollback

Revertir el endpoint, formulario y consultas documentadas. No hay migraciones ni datos irreversibles; el valor anterior de movilidad puede restablecerse desde el perfil.

## Conocimiento actualizado

- [Operación de cadetes](../knowledge/couriers.md)
- [Contratos HTTP](../knowledge/api.md)
