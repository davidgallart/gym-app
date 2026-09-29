# Configuración manual de Web Push (Supabase Dashboard)

Todo es a mano desde el panel web de **https://supabase.com/dashboard** — no hace falta CLI.

---

## Paso 1 — Claves VAPID

El par de claves ya está generado:

- **Pública** (ya la he puesto en `src/lib/restNotifications.js`):
  `BLPMkORFUI9bjXxQdPI03uL7VS3ncH7X4w8pt-mw332Ze-Nek1FWfGQH2aBIiU7h_6PvS1yUjJRTR1PPf1mb2fA`

- **Privada**: la tienes en el chat donde te he entregado el resultado. **Cópiala ahora** porque abajo la pegarás en los Secrets.

> Si la pierdes, se regeneran con `npx web-push generate-vapid-keys` (esas **dos** clavés son un par: si cambias la pública también cambia la privada, y hay que actualizar el código y los secrets).
> **Importante**: la privada **jamás** va a git ni al código del cliente.

## Paso 2 — Secrets

Dashboard → tu proyecto → **Edge Functions** (menú lateral) → **Manage Secrets** → **Add secret** (3 veces):

| Nombre | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | la clave pública de arriba |
| `VAPID_PRIVATE_KEY` | la privada del chat |
| `VAPID_SUBJECT` | `mailto:tu@email.com` (tu correo real) |

## Paso 3 — Tablas

Dashboard → **SQL Editor** → **New query** → pega TODO el contenido de **`supabase/webpush-tables.sql`** (está en la carpeta `supabase/` del repo) → **Run**.

Si ves "Success. No rows returned" es correcto.

## Paso 4 — Edge Functions (3)

Dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor** (en el cuadro de creación).

Para cada una: escribe el **nombre exacto**, borra el código de ejemplo y pega el contenido de su archivo → **Deploy**.

| Nombre de la función | Archivo del repo |
|---|---|
| `save-subscription` | `supabase/functions/save-subscription/index.ts` |
| `schedule-rest-end` | `supabase/functions/schedule-rest-end/index.ts` |
| `cancel-rest-end` | `supabase/functions/cancel-rest-end/index.ts` |

Deja el toggle **Verify JWT activado** (el botón por defecto): tu app ya manda la clave anónima automáticamente.

## Paso 5 — Comprobación rápida (opcional)

En cada función recién desplegada, pestaña **Test** → envíalo con método **GET**. Debe responder **405 method not allowed**. Eso significa que la función está viva y desplegada (el 405 es el comportamiento esperado para GET).

## Paso 6 — Publicar la web

En tu PC:

```
pnpm run build
```

Sube la carpeta `dist/` a Netlify con tu flujo habitual (drag & drop o git). La URL debe seguir siendo `https://gym-tracker-davidgallart.netlify.app`.

## Paso 7 — Probar

1. **Escritorio (Chrome)**: abre la web desplegada → arranca un descanso de 90 s → minimiza la pestaña → a los 90 s debe llegar la notificación "Descanso terminado". Prueba también con la X (cancelar): **no** debe llegar nada.
2. **Móvil (Chrome Android)**: abre la URL → la primera vez que arranques un timer Chrome pedirá permiso de notificaciones (conceder) → arranca el descanso → **bloquea la pantalla** → a los 90/120 s debe sonar. Prueba incluso cerrando Chrome: sigue llegando (con internet).
3. **Regresión**: en `pnpm run dev` la campanita Web Audio sigue sonando igual (el push solo se activa en producción).

## Límites que debes saber

- **Plan free**: el aviso push solo se programa para descansos de **hasta 140 s** (límite real del plan). Los defaults 90/120 s funcionan; si subes el tiempo con el `+` por encima de 140 s, no habrá push (el contador en pantalla sigue funcionando con la app abierta). En plan de pago basta con subir `MAX_PUSH_DELAY_MS` en la función `schedule-rest-end`.
- Requiere **internet** en el momento del envío.
- El sonido es el de **notificación del sistema** de Chrome (con vibración), no la campanita Web Audio.
- En móviles **Xiaomi/Samsung/Huawei**, si no llega el aviso, excluye Chrome de la **optimización de batería** desde los ajustes del móvil.
- El editor del dashboard **no versiona** el código: los fuentes de verdad están en `supabase/functions/`. Si algún día editas una función desde el dashboard, copia después el cambio al repo.