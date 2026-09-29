import { createClient } from "jsr:@supabase/supabase-js@2";

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
    const endpoint: unknown = body?.endpoint;
    const keys: unknown = body?.keys;

    if (typeof endpoint !== "string" || !endpoint || typeof keys !== "object" || keys === null) {
      return json({ error: "Se esperaba un objeto { endpoint, keys }" }, 400);
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { endpoint: endpoint as string, keys: keys as Record<string, unknown> },
        { onConflict: "endpoint" }
      );

    if (error) throw error;

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("save-subscription error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

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