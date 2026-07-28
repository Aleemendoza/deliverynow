# 2026-07-28 — Redirección de sesión activa desde login

## Estado

`implementado`

## Motivo y alcance

Una persona con una sesión vigente podía navegar manualmente a `/auth/login` y ver el formulario de acceso. La ruta ahora verifica la sesión en el servidor antes de renderizar: si existe, redirige al inicio autorizado de su rol. El formulario cliente se separa de la página para que nunca se monte en ese caso.

## Impacto

- Áreas afectadas: acceso y navegación por rol.
- Contratos/API: sin cambios.
- Datos/migraciones/RLS: sin cambios; los roles se siguen resolviendo desde `profiles`.
- Seguridad/privacidad: elimina una ruta pública innecesaria para sesiones activas y mantiene la decisión de redirección en servidor, sin confiar en estado del cliente.
- Compatibilidad y dependencias: sin dependencias nuevas.

## Archivos modificados

- `src/app/auth/login/page.tsx` — guardia de sesión y redirección por rol en servidor.
- `src/components/auth/login-form.tsx` — formulario cliente separado de la decisión de acceso.
- `docs/knowledge/auth-and-security.md` — flujo de sesión activa documentado.

## Validación

- Ejecutado: lint acotado y `tsc --noEmit --incremental false`.
- Pendiente: prueba manual con sesiones de cliente, cadete y administrador; y con sesión vencida o inexistente.

## Rollback

Revertir los dos archivos de aplicación y esta documentación. No hay datos ni migraciones involucrados.

## Conocimiento actualizado

- [Identidad y seguridad](../knowledge/auth-and-security.md)
