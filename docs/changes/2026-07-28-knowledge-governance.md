# 2026-07-28 — Gobierno de conocimiento y subagentes

## Estado

`implementado`

## Motivo y alcance

Se establece una fuente de contexto breve, real y mantenible para prevenir cambios sin conocer sus dependencias. Se define un protocolo de subagentes, una lectura obligatoria previa y documentación por cambio. No altera el comportamiento de la aplicación.

## Impacto

- Áreas afectadas: proceso de desarrollo, mantenimiento y revisión.
- Contratos/API: sin cambios.
- Datos/migraciones/RLS: sin cambios.
- Seguridad/privacidad: mejora el control de contexto; no modifica controles en ejecución.
- Compatibilidad y dependencias: sin dependencias nuevas.

## Archivos modificados

- `AGENTS.md` — protocolo obligatorio de contexto y documentación.
- `.agents/README.md` y `.agents/roles/*.md` — roles y secuencia de subagentes.
- `docs/knowledge/*.md` — árbol de conocimiento verificable por dominio.
- `docs/changes/*` — registro y plantilla de cambios.
- `README.md` — enlaces de inicio para mantenimiento.

## Validación

- Ejecutado: revisión de estructura del repositorio, documentación existente, migraciones y diff local antes de redactar el árbol.
- Pendiente: `npm run lint` no es necesario para cambios sólo de documentación; la aplicación no fue modificada.

## Rollback

Revertir únicamente los archivos de documentación y reglas listados arriba. No hay cambios de aplicación ni de datos.

## Conocimiento actualizado

- [Índice del árbol](../knowledge/README.md)
- [Arquitectura](../knowledge/architecture.md)
- [Pedidos](../knowledge/orders.md)
- [Cadetes](../knowledge/couriers.md)
