import { createClient } from "jsr:@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════
// Programa un push de "Descanso terminado" para una hora concreta.
//
// Respondemos 202 al momento y lanzamos el envío en background con
// EdgeRuntime.waitUntil(...), para no chocar con el idle-timeout de la
// respuesta.
//
// LÍMITE plan free: la tarea en background muere a los 150 s de vida de
// la función, así que solo aceptamos descansos de hasta 140 s.
// (En plan de pago el tope es 400 s; basta con subir MAX_PUSH_DELAY_MS.)
// ═══════════════════════════════════════════════════════════════════
const MAX_PUSH_DELAY_MS = 140_000;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204, headers: corsHeaders() });

  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const endedAtMs = Date.parse(String(body?.endedAt ?? ""));

    if (Number.isNaN(endedAtMs)) {
      return json({ error: "endedAt inválido (se espera ISO 8601)" }, 400);
    }

    const delay = endedAtMs - Date.now();

    if (delay <= 0) {
      return json({ error: "endedAt debe ser una fecha futura" }, 400);
    }
    if (delay > MAX_PUSH_DELAY_MS) {
      return json(
        { error: `endedAt demasiado lejano: máx ${Math.floor(MAX_PUSH_DELAY_MS / 1000)} s en el plan free` },
        400
      );
    }

    const { data, error } = await supabase
      .from("rest_jobs")
      .insert({ fire_at: new Date(endedAtMs).toISOString() })
      .select("id")
      .single();

    if (error) throw error;

    const jobId = Number((data as { id: number }).id);
    const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
      .EdgeRuntime?.waitUntil;

    const task = runRestJob(jobId, delay);
    if (waitUntil) {
      waitUntil(task);
    } else {
      task.catch(() => {});
    }

    return json({ jobId }, 202);
  } catch (err) {
    console.error("schedule-rest-end error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ── Tarea en background ─────────────────────────────────────────────

async function runRestJob(jobId: number, delay: number): Promise<void> {
  await sleep(delay);

  const { data: job } = await supabase
    .from("rest_jobs")
    .select("canceled_at, sent_at")
    .eq("id", jobId)
    .limit(1);

  const row = job?.[0] as { canceled_at: string | null; sent_at: string | null } | undefined;
  if (!row || row.canceled_at || row.sent_at) return;

  const sent = await sendRestEndPush();
  if (sent) {
    await supabase.from("rest_jobs").update({ sent_at: new Date().toISOString() }).eq("id", jobId);
  }
}

// ── Envío del push (VAPID JWT ES256, sin payload) ───────────────────

async function sendRestEndPush(): Promise<boolean> {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint")
    .limit(1);

  const endpoint = (data?.[0] as { endpoint: string } | undefined)?.endpoint;
  if (!endpoint) {
    console.warn("No hay ninguna suscripción push guardada");
    return false;
  }

  const key = await getPrivateKey();
  const jwt = await buildVapidJwt(key, new URL(endpoint).origin);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      TTL: "60",
      Authorization: `vapid t=${jwt}, k=${Deno.env.get("VAPID_PUBLIC_KEY") ?? ""}`,
    },
  });

  if (res.status === 404 || res.status === 410) {
    // La suscripción ya no es válida: la limpiamos.
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).catch(() => {});
    return false;
  }

  if (!res.ok) {
    console.error("El push falló:", res.status, await res.text());
    return false;
  }

  return true;
}

let privateKeyPromise: Promise<CryptoKey> | null = null;

function getPrivateKey(): Promise<CryptoKey> {
  if (!privateKeyPromise) {
    privateKeyPromise = (async () => {
      const publicB64 = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
      const privateB64 = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

      if (!publicB64 || !privateB64) {
        throw new Error("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en Edge Functions → Manage Secrets");
      }

      const pub = b64urlToBytes(publicB64);
      if (pub[0] !== 4) {
        throw new Error("Clave VAPID pública inválida (debe ser una P-256 en base64url)");
      }

      const jwk: JsonWebKey = {
        kty: "EC",
        crv: "P-256",
        x: bytesToB64url(pub.slice(1, 33)),
        y: bytesToB64url(pub.slice(33, 65)),
        d: privateB64,
      };

      return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    })();
  }
  return privateKeyPromise;
}

async function buildVapidJwt(key: CryptoKey, audience: string): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  };

  const headB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(header)));
  const payB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const input = new TextEncoder().encode(`${headB64}.${payB64}`);

  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, input));
  return `${headB64}.${payB64}.${bytesToB64url(rawSig(sig))}`;
}

// ── Utilidades ──────────────────────────────────────────────────────

function rawSig(sig: Uint8Array): Uint8Array {
  // Web Crypto suele devolver r||s (64 bytes, formato P1363)…
  if (sig.length === 64) return sig;

  // …pero por robustez convertimos DER (SEQUENCE{INTEGER,INTEGER}).
  const rLen = sig[3];
  let r = sig.slice(4, 4 + rLen);
  let offset = 4 + rLen;
  const sLen = sig[offset + 1];
  let s = sig.slice(offset + 2, offset + 2 + sLen);

  if (r.length === 33 && r[0] === 0) r = r.slice(1);
  if (s.length === 33 && s[0] === 0) s = s.slice(1);

  const pad32 = (n: Uint8Array): Uint8Array =>
    n.length >= 32 ? n : new Uint8Array([...new Array(32 - n.length).fill(0), ...n]);

  return new Uint8Array([...pad32(r), ...pad32(s)]);
}

function b64urlToBytes(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}