# 2026-07-28 - Visibilidad confiable de trabajo asignado al cadete

## Estado

`implementado` en codigo versionado; validacion E2E pendiente en el entorno desplegado.

## Motivo y alcance

Un pedido correctamente asignado aparecia en admin, cliente y notificaciones, pero el panel del cadete lo mostraba como inexistente. La pantalla dependia de lecturas RLS para sus metricas y tarjetas, por lo que una politica desplegada desactualizada podia ocultar la asignacion aunque la RPC hubiera completado correctamente. La lectura del panel pasa a servidor y queda limitada al `courier.id` obtenido desde el perfil de la sesion validada.

## Impacto

- Areas afectadas: panel operativo del cadete, metricas, tarjetas de pedido y acciones de estado.
- Contratos/API: sin cambios en endpoints publicos.
- Datos/migraciones/RLS: no modifica datos ni politicas; reduce la dependencia del render de una politica RLS por entorno.
- Seguridad/privacidad: `requireRole('courier')` valida la sesion y la consulta de servicio filtra por el unico registro operativo de ese perfil; no acepta un identificador de cadete desde el cliente.
- Compatibilidad y dependencias: conserva las RPC autorizadas para cambiar estados.

## Archivos modificados

- `src/app/courier/page.tsx` - carga de cola, metricas y pedidos propios desde una consulta de servidor acotada.
- `docs/knowledge/couriers.md` - documenta el limite de autorizacion de la lectura.

## Validacion

- Ejecutado: revision de la asignacion persistida, politica RLS y render de `CourierOrderCard`; la tarjeta contiene direcciones, contactos, precio, ruta y acciones de transicion.
- Pendiente: con el mismo cadete, recargar `/courier` despues de tomar un pedido y avanzar al menos hasta `heading_to_pickup`.

## Rollback

Revertir la lectura de `src/app/courier/page.tsx` a cliente Supabase si todas las politicas RLS estan verificadas en el entorno. No hay datos que deshacer.

## Conocimiento actualizado

- [Operacion de cadetes](../knowledge/couriers.md)
