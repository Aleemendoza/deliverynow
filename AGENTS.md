<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Contexto obligatorio y documentación viva

Esta regla tiene prioridad operativa antes de cualquier modificación de la aplicación, migración, configuración, prueba o refactor.

1. Leé `docs/knowledge/README.md` y los documentos del dominio afectado antes de inspeccionar o editar código. Consultá también las entradas pertinentes de `docs/changes/`.
2. Contrastá la documentación con el código, esquema y migraciones que modificarás. La documentación acelera la comprensión; no sustituye la verificación cuando se altera un contrato.
3. Definí los impactos aguas arriba y aguas abajo: rutas/API, UI, dominio, base de datos/RLS, integraciones, seguridad y pruebas. Si el estado es incierto, registralo como incertidumbre; nunca lo presentes como hecho.
4. Preservá cambios no relacionados existentes en el árbol de trabajo. No los sobrescribas ni los documentes como propios.
5. Después de cada cambio funcional, de datos, seguridad, contrato o infraestructura: creá una entrada en `docs/changes/YYYY-MM-DD-slug.md`, agregala al índice de `docs/changes/README.md` y actualizá el documento de conocimiento afectado en el mismo cambio.
6. No cierres una tarea sin indicar qué documentación se actualizó y qué validación se ejecutó o quedó pendiente.

Los roles y el protocolo de colaboración para subagentes están en `.agents/README.md`. Todo subagente debe cumplir estas mismas reglas.

## Contexto obligatorio y documentación viva

Esta regla tiene prioridad operativa antes de cualquier modificación de la aplicación, migración, configuración, prueba o refactor.

1. Leé `docs/knowledge/README.md` y los documentos del dominio afectado antes de inspeccionar o editar código. Consultá también las entradas pertinentes de `docs/changes/`.
2. Contrastá la documentación con el código, esquema y migraciones que modificarás. La documentación acelera la comprensión; no sustituye la verificación cuando se altera un contrato.
3. Definí los impactos aguas arriba y aguas abajo: rutas/API, UI, dominio, base de datos/RLS, integraciones, seguridad y pruebas. Si el estado es incierto, registralo como incertidumbre; nunca lo presentes como hecho.
4. Preservá cambios no relacionados existentes en el árbol de trabajo. No los sobrescribas ni los documentes como propios.
5. Después de cada cambio funcional, de datos, seguridad, contrato o infraestructura: creá una entrada en `docs/changes/YYYY-MM-DD-slug.md`, agregala al índice de `docs/changes/README.md` y actualizá el documento de conocimiento afectado en el mismo cambio.
6. No cierres una tarea sin indicar qué documentación se actualizó y qué validación se ejecutó o quedó pendiente.

Los roles y el protocolo de colaboración para subagentes están en `.agents/README.md`. Todo subagente debe cumplir estas mismas reglas.
