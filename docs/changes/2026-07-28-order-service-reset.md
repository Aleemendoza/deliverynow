# 2026-07-28 — Validación aislada por tipo de envío

## Estado

`implementado`

## Motivo y alcance

Al cambiar de tipo de envío, el formulario mantenía campos específicos y errores del servicio anterior. En particular, valores `NaN` de peso y el tamaño de un paquete podían bloquear Documento u otros servicios. La selección ahora reinicia el bloque de producto y sus errores para que cada servicio valide únicamente sus propios requisitos.

## Impacto

- Áreas afectadas: primer paso del formulario de solicitud.
- Contratos/API: sin cambios; el payload enviado conserva el mismo schema.
- Datos/migraciones/RLS: sin cambios.
- Seguridad/privacidad: no se modifican autorización ni datos expuestos. Se evita enviar valores residuales de otro servicio.
- Compatibilidad y dependencias: Documento continúa como selección inicial; sin dependencias nuevas.

## Archivos modificados

- `src/components/orders/order-wizard.tsx` — reinicio de producto, errores y estimación al cambiar servicio.
- `docs/knowledge/orders.md` — invariantes de selección y validación por servicio.

## Validación

- Ejecutado: lint específico y `tsc --noEmit --incremental false`, sin errores.
- Pendiente: prueba manual de Documento → Paquete → Documento, Paquete → Compra, y cambio de servicio tras errores de tamaño, peso o fondos de compra.

## Rollback

Revertir el cambio de `order-wizard` y esta documentación. No hay migraciones ni datos persistidos que revertir.

## Conocimiento actualizado

- [Pedidos y seguimiento](../knowledge/orders.md)
