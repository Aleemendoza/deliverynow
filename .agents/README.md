# Protocolo de subagentes

Los subagentes no sustituyen la responsabilidad del agente que integra el cambio. Cada uno trabaja con un alcance explícito, preserva cambios ajenos y cumple el protocolo de contexto de `AGENTS.md`.

## Secuencia obligatoria

1. **Descubrimiento:** lee `docs/knowledge/README.md`, los dominios implicados y cambios relacionados. Releva contratos e impactos sin editar.
2. **Implementación:** modifica un alcance acotado después de recibir el relevamiento. No cambia contratos de otros dominios sin documentar el impacto y coordinarlo.
3. **Revisión:** revisa el diff contra el árbol de conocimiento, seguridad, migraciones, compatibilidad y cambios no relacionados.
4. **Calidad:** ejecuta las verificaciones proporcionales al riesgo y reporta resultados y límites.
5. **Integración:** crea la entrada en `docs/changes/`, actualiza el conocimiento afectado y verifica que los enlaces del índice sean correctos.

Un mismo agente puede desempeñar más de un rol sólo en tareas pequeñas; aun así debe seguir la secuencia.

## Roles disponibles

- [`roles/discovery.md`](roles/discovery.md): localiza el contexto mínimo fiable, dependencias e impactos; no edita.
- [`roles/implementer.md`](roles/implementer.md): realiza un cambio aislado y actualiza documentación vinculada.
- [`roles/reviewer.md`](roles/reviewer.md): busca regresiones funcionales, de autorización, datos y contratos.
- [`roles/qa.md`](roles/qa.md): selecciona y ejecuta pruebas; no declara validado lo que no ejecutó.

## Regla de veracidad

El árbol de conocimiento resume evidencia del repositorio. Todo dato no contrastado con código, migración o entorno se marca como **pendiente de verificar**. Un cambio sin documentación de impacto se considera incompleto.
