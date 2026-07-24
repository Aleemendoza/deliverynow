# Plan de migración incremental de base de datos

## Principios

- No eliminar ni renombrar columnas existentes en la primera migración.
- Tomar backup y registrar conteos antes y después de cada despliegue.
- Hacer que la creación de un pedido y las transiciones de estado sean funciones PostgreSQL/RPC transaccionales, invocadas por handlers de servidor.
- Desplegar RLS, funciones y clientes en una misma versión compatible; no dejar ventanas donde el cliente deba escribir tablas privadas directamente.

## Secuencia propuesta

1. **Preflight:** exportar esquema/datos, validar tablas existentes, buckets privados y valores de `service_types`/`pricing_rules`.
2. **Seguridad:** activar RLS para todas las tablas privadas, agregar políticas selectivas de lectura y revocar escrituras directas de `anon`/`authenticated` sobre pedidos, paradas, historial, evidencias e incidencias.
3. **Funciones seguras:** crear `create_guest_order`, `transition_order_status`, `verify_delivery_pin` y `assign_order`. Cada función debe validar actor, transición, zona/capacidad, idempotencia y escribir historial/auditoría en la misma transacción.
4. **Datos operativos:** agregar restricciones e índices no destructivos para secuencia pública de tracking, historial, asignación y horarios. Crear una tabla de asignaciones antes de deprecar `assigned_courier_id`.
5. **Evidencias:** crear buckets privados y una tabla que sólo guarde rutas; permitir URLs firmadas mediante handler autorizado. Validar MIME/tamaño antes de upload.
6. **Backfill y verificación:** migrar las filas existentes, comparar conteos, probar RLS con usuarios customer/courier/admin y ejecutar rollback documentado si falla.
7. **Deprecación posterior:** sólo tras una release estable, dejar de leer campos legacy y planear su eliminación en otra migración reversible.

## Criterios de salida por migración

- Migración idempotente donde sea posible.
- Conteos y claves foráneas validados.
- Pruebas de autorización negativas incluidas.
- Sin service role en navegador ni PIN en logs.
