-- ═══════════════════════════════════════════════════════════════════
-- Web Push: tablas necesarias.
--
-- Dónde ejecutarlo: Supabase Dashboard → SQL Editor → "New query" →
-- pegar este contenido → botón "Run".
--
-- Quedan con RLS activado y SIN políticas: desde el cliente web son
-- inaccesibles; solo las Edge Functions (service_role) pueden leerlas
-- y escribirlas, que es justo lo que queremos.
-- ═══════════════════════════════════════════════════════════════════

-- Suscripción(es) push del dispositivo (una por endpoint/origen).
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);

-- Avisos de fin de descanso programados.
create table if not exists public.rest_jobs (
  id          bigint generated always as identity primary key,
  fire_at     timestamptz not null,
  canceled_at timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.rest_jobs enable row level security;