# Dominio: pedidos y seguimiento

## Flujo conocido

1. El cliente inicia el pedido desde `/solicitar`; `order-wizard` usa esquemas de `src/features/orders` y validaciones compartidas.
2. Las rutas `api/orders` y `api/orders/estimate` reciben la operación; precio y ruta dependen de los adaptadores de servidor.
3. Supabase conserva pedido, direcciones, paradas, historial, asignación y snapshot de tarifa. Las migraciones son la referencia para restricciones y RPC.
4. El seguimiento público está en `/seguimiento` y `api/tracking/[trackingCode]`; existen rutas de sesión de seguimiento. Cualquier cambio debe mantener privacidad, limitación de abuso y coherencia de estados.
5. El cadete actualiza estados mediante `api/orders/[id]/status`; la máquina de estados reside en `src/lib/orders/status.ts` y en RPC SQL. Ambas deben permanecer alineadas.

## Contratos que no deben divergir

- El estado de un pedido afecta tracking, bandeja de cadete, admin, notificaciones, historial y métricas.
- Una asignación afecta disponibilidad del cadete, autorización para transiciones y `order_assignments`.
- El precio mostrado debe coincidir con el snapshot persistido, no con una tarifa vigente posterior.
- Los datos personales/direcciones no deben exponerse a usuarios o cadetes que no estén autorizados.

## Riesgos a revisar

Creación atómica, concurrencia al tomar/asignar, PIN de entrega, transiciones autorizadas, RLS y auditoría. Consultar `SECURITY.md`, `DATABASE.md` y la migración que define la RPC antes de cambiar este dominio.
