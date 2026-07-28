# Contratos HTTP

Las rutas están bajo `src/app/api`. Este documento es un mapa de impacto, no una especificación de payload exhaustiva: el código y sus schemas son la fuente de verdad.

| Grupo | Rutas | Responsabilidad |
| --- | --- | --- |
| Sesión | `api/auth/session` | Consulta de sesión para cliente. |
| Pedidos | `api/orders`, `api/orders/estimate`, `api/orders/[id]/status`, `api/orders/[id]/courier-location` | Crear/estimar, transicionar y actualizar ubicación bajo autorización. |
| Seguimiento | `api/tracking/[trackingCode]`, `.../session` | Consulta pública controlada y sesión asociada. |
| Cadetes | `api/courier/availability`, `heartbeat`, `presence`, `offers`, `offers/[attemptId]/accept`, `transport` | Disponibilidad, presencia, movilidad y toma de trabajo. Disponibilidad y renovación sólo responden éxito tras confirmar `is_online` y el lease persistido; si no coinciden devuelven `AVAILABILITY_STATE_UNCONFIRMED`. Las consultas y tomas devuelven `COURIER_OFFLINE` cuando la disponibilidad o lease no están vigentes. `transport` admite sólo `bici` o `moto` para el propio cadete y confirma el valor almacenado antes de responder. |
| Notificaciones | `api/notifications`, `api/push/subscribe`, `api/cron/notifications` | Inbox, suscripciones y procesamiento. |

Para cambiar una ruta, identificar todos sus llamadores con búsqueda, conservar errores seguros y revisar autenticación, autorización, cache y schema. Agregar/actualizar pruebas cuando se cambie contrato o comportamiento.
