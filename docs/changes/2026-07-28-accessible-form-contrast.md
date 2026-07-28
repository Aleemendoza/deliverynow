# 2026-07-28 — Base visual accesible para formularios

## Estado

`implementado`

## Motivo y alcance

Los controles del flujo de solicitud se confundían con la superficie, los placeholders tenían contraste insuficiente y el foco se percibía principalmente por color. Se define una base visual consistente para formularios con superficies diferenciadas, bordes persistentes, foco de teclado amplio y mensajes de error con texto. Se mueve el acceso flotante de volver al inicio para que no cubra acciones críticas en móvil.

## Impacto

- Áreas afectadas: formularios de todos los roles y flujo de solicitud.
- Contratos/API: sin cambios.
- Datos/migraciones/RLS: sin cambios.
- Seguridad/privacidad: sin cambios.
- Compatibilidad y dependencias: sin dependencias nuevas. Respeta `prefers` del navegador mediante controles nativos y conserva el modo oscuro.

## Archivos modificados

- `src/app/globals.css` — tokens de contraste, controles, placeholder, foco, error y checkboxes/radios.
- `src/components/orders/order-wizard.tsx` — semántica de error para campos y selectores.
- `src/components/scroll-to-top.tsx` — separación del botón flotante respecto de acciones del formulario.
- `docs/knowledge/architecture.md` y `docs/knowledge/orders.md` — pautas visuales actualizadas.

## Validación

- Ejecutado: lint acotado, `tsc --noEmit --incremental false` y revisión de espacios.
- Pendiente: validación manual en dispositivos móviles, navegación por teclado y revisión con simuladores de deficiencias de visión cromática en navegador.

## Rollback

Revertir los archivos visuales y documentación listados. No hay migraciones ni datos que revertir.

## Conocimiento actualizado

- [Arquitectura](../knowledge/architecture.md)
- [Pedidos y seguimiento](../knowledge/orders.md)
