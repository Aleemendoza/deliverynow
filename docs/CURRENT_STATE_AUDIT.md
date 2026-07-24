# Auditoría del estado actual

Fecha: 2026-07-24  
Alcance: revisión estática completa del repositorio y verificación local iniciada. No se dispuso de acceso al proyecto remoto de Supabase ni se revelaron secretos de `.env`; las políticas y datos desplegados deben contrastarse antes de producción.

## Resumen ejecutivo

La aplicación tiene una base técnicamente aprovechable para el flujo público: App Router, TypeScript, Zod, React Hook Form, Google Places/Routes y un esquema inicial de Supabase. No está lista para operar una cadetería real. Los mayores riesgos son autorización inexistente en los paneles, operaciones de pedido no atómicas y pantallas que afirman capacidades aún no implementadas.

No corresponde una reescritura: se debe conservar el dominio, el wizard y la integración de estimación, y completar incrementalmente los límites de seguridad y la operación.

## Stack y estructura detectados

- Next.js 16.2.11, React 19.2.4, TypeScript 5, App Router y Tailwind CSS 4.
- Supabase SSR 0.12.3 y supabase-js 2.110.8. La clave de servicio sólo se lee en servidor; no se detectó exposición `NEXT_PUBLIC_` de esa clave.
- React Hook Form, Zod 4 y libphonenumber-js para el formulario.
- Vitest configurado, con pruebas de esquema, precio y radio de servicio. No hay Playwright ni pruebas de integración/RLS/E2E.
- Rutas públicas: `/`, `/solicitar`, `/seguimiento`, `/seguimiento/[trackingCode]`, contenido legal/comercial y autenticación. Rutas operativas esqueléticas: `/courier`, `/courier/orders`, `/admin`.
- API: creación/estimación de pedidos, consulta de tracking y callback OAuth.
- Migración inicial: `supabase/migrations/202607240001_initial_schema.sql`; seed inicial en `supabase/seed.sql`.

## Clasificación de hallazgos

### P0 — bloquean uso real o generan riesgo grave

1. **Paneles y rutas operativas sin autorización ni datos reales.** `/courier` y `/admin` son páginas públicas con métricas `—`; no verifican sesión, rol ni cargan datos. Un visitante puede acceder a URLs administrativas aunque no se filtren registros.
2. **Creación de pedidos no es atómica.** `createOrder` inserta dos direcciones, el pedido, paradas, historial y notificación como operaciones independientes con service role. Un fallo intermedio deja datos huérfanos e impide una recuperación confiable.
3. **Asignación insegura desde el punto de vista operativo.** Se selecciona el primer cadete activo, no uno online, disponible o de la zona; no se crea `order_assignment`, no se valida capacidad ni horario, y el estado salta directamente a `assigned`.
4. **Código de seguimiento con colisiones no manejadas.** `DNY-YYYY-xxxxx` es aleatorio y tiene una restricción única, pero no hay reintento frente a conflicto ni secuencia por año. Una colisión devuelve un error 503 al cliente.
5. **PIN inseguro y expuesto.** Se usa SHA-256 rápido sin salt ni limitación de intentos, el PIN se devuelve desde la API y se inserta la marca `pinSent: true` aunque el correo no se haya enviado. No existe endpoint de verificación, bloqueo ni evidencia alternativa autorizada.
6. **Tracking público no cumple el flujo declarado.** La API devuelve estado e historial sólo con el código; la página de detalle no consulta esa API ni solicita correo/PIN secundario. Falta rate limiting, normalización estricta y control de cache explícito.
7. **No existe manejo de transiciones de estado.** La función `canTransition` está aislada; no hay RPC/endpoint, autenticación, auditoría del actor, control de concurrencia, ni autorización de courier/admin.

### P1 — necesarios para un MVP confiable

1. La autenticación tiene login/registro/OAuth callback, pero no hay recuperación de contraseña, proxy de sesión, redirección por rol ni protección server-side de rutas.
2. La migración habilita RLS sólo en una parte de las tablas. `addresses`, `service_types`, `service_zones` y `pricing_rules` no tienen RLS declarado. Faltan políticas de `customers`, `couriers`, historial, evidencia, incidentes y auditoría; comentar que las escrituras ocurren por RPC no las implementa.
3. Los teléfonos se validan pero se guardan como fueron ingresados: falta normalización a E.164. Los dominios temporales, verificación de correo y validación real de horarios/capacidad no están implementados.
4. La estimación consulta Google Routes en servidor, una buena base, pero no valida zona/hora/servicio en backend ni registra todas las variables del precio. La semilla tampoco define recargos por servicio, por lo que quedan siempre en cero.
5. El wizard tiene cuatro pasos, no seis, y no precarga ni reutiliza datos de un usuario autenticado. Al persistir todo el borrador en `localStorage`, conserva datos personales sin expiración ni aviso.
6. `QuickEstimator` acepta texto libre y sólo lo pasa por query string; no calcula ni valida una ruta. El formulario tampoco consume esos parámetros, por lo que crea una expectativa falsa.
7. No hay notificaciones internas, Realtime, Web Push, worker ni reintentos. El correo es una única llamada directa a Resend y falla la creación después de haber persistido el pedido; la plantilla interpolaría direcciones sin escape HTML.
8. Faltan evidencias privadas, almacenamiento, carga MIME/tamaño, URLs firmadas, incidentes, cancelaciones, espera, historial de ingresos y auditoría administrativa.
9. La cabecera móvil muestra un icono de menú sin interacción y faltan enlaces requeridos (cómo funciona y contacto). El hero promete disponibilidad y seguimiento actualizados que hoy no se sustentan.

### P2 — mejora importante, no bloqueante

1. `AddressPicker` carga Google Maps de forma perezosa, pero declara tipos locales incompletos, no permite arrastrar el marcador y sólo marca la dirección como confirmada al seleccionar Autocomplete.
2. Los schemas y varios componentes están excesivamente comprimidos en una sola línea, dificultando revisión, pruebas y mantenimiento.
3. La fórmula sólo modela base, distancia y servicio; faltan urgencia, horario, peso, espera, paradas y versiones completas de tarifa.
4. No hay estados de carga/error/vacío consistentes en las páginas operativas ni estrategia de reconexión/offline.
5. La identidad visual oscura/amarilla es coherente y ya evita excesos graves, aunque la landing aún no muestra estado operativo real ni beneficios respaldados.

### P3 — postergar

- B2B completo, cuentas comerciales, repetición de pedido, paneles administrativos extensos, métricas de producto, PWA instalable y push: diseñar las extensiones ahora, implementar después de cerrar P0/P1.
- Marketplace, chat, IA, geolocalización continua, cupones complejos, múltiples ciudades y app nativa: fuera del MVP.

## Estado por integración

| Área | Estado verificable |
| --- | --- |
| Google OAuth | Flujo cliente → Supabase → `/auth/callback` implementado. Requiere comprobar redirect URLs y proveedor en Supabase. |
| Google Maps/Places | Script perezoso y Autocomplete presentes. Requiere clave habilitada y no hay marcador ajustable. |
| Google Routes | Llamada server-side real y sin cache. Requiere clave/API habilitada; no se pudo ejecutar sin revelar configuración. |
| Supabase | Clientes servidor/navegador bien separados. El cliente de servicio evita RLS por diseño; necesita RPC transaccional para operaciones de dominio. |
| RLS | Esquema inicial parcial; no se pudo verificar la base desplegada. |
| Emails | Adaptador Resend mínimo; sin cola, plantillas completas ni registro de fallo. |
| Notificaciones / Push | No implementado. |
| Dashboard courier/admin | Placeholders; no operativo. |

## Calidad y verificación

- `npm run lint` finalizó correctamente (28.2 s) y `npm run test` aprobó 3 archivos / 9 pruebas (0.8 s).
- `npm run build` finalizó correctamente (16.1 s): compilación, TypeScript y generación de 20 rutas completadas. La ejecución conjunta anterior superó el límite local, pero el build aislado confirma que el proyecto compila en el estado auditado.
- No se inspeccionó consola de navegador: faltan un entorno ejecutando y claves de Maps/Supabase funcionales.
- No se detectaron secretos versionados; `.env.example` separa correctamente claves públicas y de servidor. Hay variables declaradas para Push/Sentry/Cron que aún no tienen implementación.

## Conservar, corregir, refactorizar, postergar

### Conservar

- App Router, tipos de dominio, Zod compartido, pruebas unitarias actuales, React Hook Form, `AddressPicker` como base y cálculo de Routes exclusivamente en servidor.
- Modelo con `order_stops`, snapshots de precio, historial y perfiles con rol en DB.

### Corregir

- P0/P1 anteriores antes de ampliar UI: transacción/RPC de pedido, tracking protegido, PIN, RLS, protección de rutas, autorización y operación de courier.

### Refactorizar

- Extraer servicios de pedido, repositorios Supabase y componentes del wizard; normalizar respuestas y errores API; formatear archivos comprimidos.

### Eliminar o postergar

- Placeholders y promesas visuales no respaldadas deben retirarse o convertirse en estados honestos hasta implementar su fuente real.

## Plan priorizado

1. **Estabilizar P0:** ejecutar checks de forma independiente, crear RPC transaccional de pedido con generación secuencial segura, validar disponibilidad y corregir PIN/tracking.
2. **Cerrar límites de seguridad:** proxy optimista y autorización server-side, RLS completo, RPC de transición con auditoría, rate limits y headers.
3. **Completar flujo público:** wizard de seis pasos, normalización de contacto, precio/disponibilidad backend, confirmación y tracking secundariamente verificado.
4. **Operación mínima:** bandeja de courier autenticada, aceptación/transiciones/evidencia; admin para consulta, asignación y auditoría.
5. **Confiabilidad:** cola/reintentos de correo, notificaciones internas, incidentes/cancelaciones/espera y pruebas de integración/RLS/E2E.

## Implementación posterior a la auditoría

Se incorporó la migración `202607240002_operational_integrations.sql` y los adaptadores de Google Routes, Supabase Auth/SSR, Resend y Web Push. La creación ahora se delega a una RPC transaccional y las transiciones se validan por otra RPC autenticada. La activación externa queda pendiente de aplicar migraciones y cargar las credenciales reales en Supabase, Google, Resend y VAPID.
