# 2026-07-28 — Pedidos resilientes ante fallas de push

## Estado

`implementado`

## Motivo y alcance

La suscripción push del navegador podía exceder el tiempo de espera y bloquear la pantalla de solicitud; el servidor también rechazaba pedidos sin una suscripción persistida. Las notificaciones son importantes para la experiencia, pero no son un prerrequisito seguro ni confiable para una transacción de pedido. El alta push se mantiene como invitación opcional y la creación continúa aunque falle o demore.

## Impacto

- Áreas afectadas: solicitud de pedido y activación de notificaciones push.
- Contratos/API: sin cambios de payload. La creación de pedido deja de consultar o exigir `push_subscriptions`.
- Datos/migraciones/RLS: sin cambios.
- Seguridad/privacidad: se conserva consentimiento explícito antes de registrar push. El pedido sigue autenticado, validado y protegido por límite de tasa; no se degrada la autorización por hacer push opcional.
- Compatibilidad y dependencias: sin dependencias nuevas.

## Archivos modificados

- `src/components/orders/order-push-gate.tsx` — aviso y reintento opcional, sin bloquear el formulario.
- `src/app/solicitar/page.tsx` — mantiene visible el flujo de pedido junto al aviso.
- `src/features/orders/server.ts` — elimina la precondición de suscripción push.
- `src/lib/notifications/browser-push.ts` — timeout más tolerante y limpieza del temporizador.
- `docs/knowledge/orders.md` y `docs/knowledge/data-and-integrations.md` — contrato operativo actualizado.

## Validación

- Ejecutado: lint acotado y `tsc --noEmit --incremental false`.
- Pendiente: prueba manual con permiso concedido, denegado, suscripción lenta, sin soporte push y creación exitosa de pedido en cada caso.

## Rollback

Revertir los archivos listados. No hay migraciones ni datos que requieran reversión.

## Conocimiento actualizado

- [Pedidos y seguimiento](../knowledge/orders.md)
- [Datos e integraciones](../knowledge/data-and-integrations.md)
