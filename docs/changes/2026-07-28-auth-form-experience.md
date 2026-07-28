# 2026-07-28 — Experiencia profesional de acceso y registro

## Estado

`implementado`

## Motivo y alcance

Se reemplaza la interfaz básica de acceso y registro por formularios consistentes, accesibles y orientados a recuperación de errores. Los errores técnicos de Supabase o red ya no se exponen literalmente al usuario: se traducen a indicaciones accionables. El correo y los demás valores ingresados se mantienen al fallar una solicitud; los mensajes se eliminan al corregir un campo y el estado de carga concluye siempre al resolverse la operación.

El alcance no altera el proveedor de identidad, las rutas de callback, la sesión, la resolución de roles ni las políticas de datos.

## Impacto

- Áreas afectadas: pantallas de login, registro y experiencia de autocompletado de credenciales.
- Contratos/API: sin cambios; se conservan las llamadas de Supabase Auth existentes.
- Datos/migraciones/RLS: sin cambios.
- Seguridad/privacidad: se mantiene la contraseña en memoria sólo durante la vista activa para facilitar la corrección; no se persiste. Los formularios de identidad permiten de forma explícita el autocompletado estándar y gestores de contraseñas; el resto de la aplicación mantiene la política de privacidad de formularios.
- Compatibilidad y dependencias: sin dependencias nuevas.

## Archivos modificados

- `src/components/auth/auth-ui.tsx` — primitivas visuales, accesibles y reutilizables para autenticación.
- `src/app/auth/login/page.tsx` — login controlado, feedback contextual y estados transitorios.
- `src/app/auth/register/page.tsx` — registro validado, confirmación de correo y feedback contextual.
- `src/components/form-privacy.tsx` — excepción explícita para autocompletado de formularios de identidad.
- `docs/knowledge/auth-and-security.md` — comportamiento y ubicación del flujo documentados.

## Validación

- Ejecutado: revisión estática de los contratos de Supabase Auth, rutas de callback y protección por rol.
- Ejecutado: lint acotado de los archivos modificados, `tsc --noEmit --incremental false` y `git diff --check`, sin errores. El lint completo (`npm run lint`) quedó bloqueado por un error preexistente de `react-hooks/set-state-in-effect` en `src/components/courier/nearby-offers.tsx` (línea 20), fuera de este alcance.
- Pendiente: prueba manual en un entorno con Supabase configurado de credenciales inválidas, correo sin confirmar, red no disponible, alta nueva, cuenta existente y OAuth Google.

## Rollback

Revertir los archivos de interfaz y documentación listados. No se requiere reversión de datos, migraciones ni configuración de Supabase.

## Conocimiento actualizado

- [Identidad y seguridad](../knowledge/auth-and-security.md)
