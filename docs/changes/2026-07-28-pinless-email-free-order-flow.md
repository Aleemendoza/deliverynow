# 2026-07-28 - Flujo operativo sin PIN ni correo obligatorio

## Estado

`implementado` en codigo versionado; aplicacion de migracion pendiente por entorno.

## Motivo y alcance

Para completar pruebas E2E sin verificaciones externas, se elimina el correo obligatorio al crear un pedido y el PIN al finalizar una entrega. El remitente continua identificado por su cuenta y la entrega mantiene autorizacion del cadete asignado, transiciones validas, historial y auditoria.

## Impacto

- Areas afectadas: formulario de pedido, creacion, panel del cadete y finalizacion.
- Contratos/API: `POST /api/orders/[id]/status` ya no acepta ni envia `deliveryPin`; finalizar desde `at_delivery` no requiere codigo.
- Datos/migraciones/RLS: `202607280005_remove_order_pin_and_email_requirement.sql` permite `delivery_pin_hash` nulo, elimina hashes existentes y redefine las RPC de creacion y transicion.
- Seguridad/privacidad: se reduce la retencion de datos al no almacenar el email del pedido ni hashes de PIN. La autorizacion de estados no cambia.
- Compatibilidad y dependencias: los pedidos existentes tambien quedan finalizables sin PIN tras aplicar la migracion.

## Archivos modificados

- `supabase/migrations/202607280005_remove_order_pin_and_email_requirement.sql` - contrato operativo sin PIN ni email del pedido.
- `src/components/orders/order-wizard.tsx` y esquemas - elimina el campo de correo obligatorio.
- `src/components/orders/order-status-action.tsx` y ruta de estado - finalizacion directa desde el cadete.
- `docs/knowledge/orders.md` y `docs/knowledge/couriers.md` - contrato actualizado.

## Validacion

- Ejecutado: revision de validaciones cliente/servidor, maquina de estados y firma RPC.
- Pendiente: aplicar migracion y probar el ciclo crear, tomar, retirar, entregar y finalizar en Supabase desplegado.

## Rollback

Revertir la UI/API y restaurar las definiciones anteriores de RPC solo si se restablece la verificacion por PIN. Los hashes eliminados no son recuperables.

## Conocimiento actualizado

- [Pedidos y seguimiento](../knowledge/orders.md)
- [Operacion de cadetes](../knowledge/couriers.md)
