# Despliegue

En Vercel configurá todas las variables de `.env.example`, aplicá las migraciones y configurá URLs de redirección de Supabase para producción. En Google Cloud habilitá Maps JavaScript, Places y Routes; restringí la clave pública por dominio y la de servidor por API e IP/entorno. Configurá el provider Google de Supabase con el callback real de Supabase, no el de Next.

Configurá Resend con un dominio verificado, VAPID y Sentry antes de activar notificaciones. Probá rutas, OAuth, RLS, PIN, subida privada y correos desde un entorno staging antes de producción.
