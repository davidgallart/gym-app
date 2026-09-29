import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY =
  "BLPMkORFUI9bjXxQdPI03uL7VS3ncH7X4w8pt-mw332Ze-Nek1FWfGQH2aBIiU7h_6PvS1yUjJRTR1PPf1mb2fA";

const REST_PUSH_ENABLED_KEY = "gym-push-subscribed";

// Plan free de Supabase: la tarea en background de la Edge Function
// tiene un tope de 150 s. Con margen, solo programamos descansos ≤ 140 s.
export const MAX_PUSH_DELAY_SECONDS = 140;

export function isPushAvailable() {
  return (
    import.meta.env.PROD &&
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(supabase)
  );
}

function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export async function initPush() {
  if (!isPushAvailable()) return false;

  try {
    if (localStorage.getItem(REST_PUSH_ENABLED_KEY) === "1") return true;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    localStorage.setItem(REST_PUSH_ENABLED_KEY, "1");

    const { error } = await supabase.functions.invoke("save-subscription", {
      body: subscription.toJSON(),
    });
    if (error) throw error;

    return true;
  } catch (error) {
    console.warn("Aviso push no disponible", error);
    return false;
  }
}

export async function scheduleRestEnd(endedAtMs) {
  if (!isPushAvailable()) return null;
  if (Date.now() + MAX_PUSH_DELAY_SECONDS * 1000 < endedAtMs) return null;

  const { data, error } = await supabase.functions.invoke("schedule-rest-end", {
    body: { endedAt: new Date(endedAtMs).toISOString() },
  });
  if (error) throw error;

  return typeof data?.jobId === "number" ? data.jobId : null;
}

export async function cancelRestEnd(jobId) {
  if (!jobId || !isPushAvailable()) return;

  try {
    await supabase.functions.invoke("cancel-rest-end", { body: { jobId } });
  } catch (error) {
    console.warn("No se pudo cancelar el aviso push", error);
  }
}