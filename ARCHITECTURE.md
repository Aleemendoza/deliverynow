# Arquitectura

Next.js App Router separa UI, dominio (`src/lib`) y adaptadores de infraestructura (`src/lib/supabase`). Las rutas API validan contratos Zod y son el límite de confianza; el cliente nunca recibe la service role key. PostgreSQL conserva el estado, snapshots de tarifa e historial inmutable. Supabase Realtime debe complementar, no sustituir, la consulta al recuperar foco.

La estimación de rutas debe invocar Google Routes exclusivamente desde el servidor. Cada pedido toma la tarifa vigente y la guarda como `price_snapshot` para preservar su valor histórico.
