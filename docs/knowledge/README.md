# Árbol de conocimiento

Índice operativo y verificable de Delivery Ya. Está diseñado para obtener contexto sin releer todo el repositorio. Su fuente de verdad es el código y las migraciones versionadas; cuando exista una diferencia, se debe corregir este árbol en el mismo cambio.

## Uso obligatorio

Antes de modificar algo, leé este índice, el dominio afectado y las entradas relacionadas en [`../changes/README.md`](../changes/README.md). Después, verificá los archivos concretos que vayas a modificar. No hace falta cargar dominios no relacionados.

## Mapa

| Área | Documento | Fuente principal |
| --- | --- | --- |
| Arquitectura y límites | [architecture.md](architecture.md) | `src/`, configuración Next |
| Pedidos y seguimiento | [orders.md](orders.md) | `src/features/orders`, rutas `api/orders` y `api/tracking` |
| Operación de cadetes | [couriers.md](couriers.md) | `src/app/courier`, `api/courier`, migraciones |
| Identidad y autorización | [auth-and-security.md](auth-and-security.md) | `src/lib/auth`, `src/proxy.ts`, RLS/RPC |
| Datos e integraciones | [data-and-integrations.md](data-and-integrations.md) | `supabase/`, `src/lib` |
| Contratos HTTP | [api.md](api.md) | `src/app/api` |

## Estado de la documentación

- Línea base revisada: **2026-07-28**, basada en el árbol de archivos y la documentación versionada.
- La cola autogestionada de pedidos para cadetes forma parte del código versionado. La aplicación de su migración y validación en cada entorno sigue **pendiente de verificar por entorno**; ver [couriers.md](couriers.md).
- La configuración real de Supabase, proveedores externos, RLS desplegado y secretos no puede inferirse desde este repositorio y permanece **pendiente de verificar por entorno**.
