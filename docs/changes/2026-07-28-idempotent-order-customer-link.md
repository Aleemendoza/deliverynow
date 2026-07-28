# 2026-07-28 — Vinculación idempotente de pedidos a la cuenta

## Estado

`implementado`

## Motivo y alcance

Al reintentar una creación idempotente, `create_guest_order` puede no devolver el ID del pedido. El flujo ahora lo recupera mediante la clave de idempotencia para completar de manera segura la vinculación del pedido con la cuenta del cliente. La notificación inicial se vuelve de mejor esfuerzo: un fallo de emisión queda registrado sin convertir un pedido ya creado y vinculado en un error para el usuario.

## Impacto

- Áreas afectadas: creación de pedidos, cuenta del cliente y notificaciones iniciales.
- Contratos/API: no cambia el payload ni la respuesta pública; mejora el comportamiento ante reintentos y fallos transitorios posteriores a la creación.
- Datos/migraciones/RLS: no hay migraciones. El cambio actualiza `orders.customer_id` sólo cuando está sin vincular; requiere que las políticas y permisos desplegados permitan la operación del cliente de servidor existente.
- Seguridad/privacidad: evita sobrescribir un `customer_id` ya presente. La correspondencia usa la `idempotency_key` generada para el mismo pedido; la configuración RLS real sigue pendiente de verificación por entorno.
- Compatibilidad y dependencias: sin dependencias nuevas.

## Archivos modificados

- `src/features/orders/server.ts` — recuperación del ID idempotente, vinculación condicional y notificación no bloqueante.
- `docs/knowledge/orders.md` — invariantes de idempotencia y vinculación.

## Validación

- Ejecutado: revisión del flujo y `tsc --noEmit --incremental false`.
- Pendiente: prueba integrada contra Supabase de primera creación, reintento, vinculación ya existente, fallo de emisión y permisos/RLS desplegados.

## Rollback

Revertir los cambios de `createOrder` y esta documentación. No requiere migraciones ni reversión de datos; los pedidos ya vinculados no deben desvincularse automáticamente.

## Conocimiento actualizado

- [Pedidos y seguimiento](../knowledge/orders.md)
