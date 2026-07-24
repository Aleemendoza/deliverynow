# Base de datos

La migración inicial crea perfiles con roles protegidos, clientes, cadetes, zonas, tarifas versionadas, pedidos, paradas, historial, notificaciones, evidencias, incidentes y auditoría. Hay índices sobre lectura de operación y seguimiento.

Ejecutá las migraciones mediante Supabase CLI o SQL Editor. Creá los buckets `delivery-proofs`, `incident-evidence` y `profile-images` como privados y entregá contenido sólo mediante URLs firmadas desde un endpoint autorizado.
