import { supabase } from "../lib/supabaseClient";

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Usuario no autenticado");
  return data.user.id;
}

export async function getBodyWeightLogs() {
  const { data, error } = await supabase
    .from("body_weight_logs")
    .select("id, weight_date, weight, created_at")
    .order("weight_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

function validateBodyWeightInput({ weightDate, weight }) {
  const numericWeight = Number(weight);

  if (!weightDate) throw new Error("Selecciona una fecha");
  if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
    throw new Error("Introduce un peso válido");
  }

  return numericWeight;
}

async function findBodyWeightByDate(userId, weightDate) {
  const { data, error } = await supabase
    .from("body_weight_logs")
    .select("id, weight_date, weight")
    .eq("user_id", userId)
    .eq("weight_date", weightDate)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveBodyWeight({ weightDate, weight }) {
  const userId = await currentUserId();
  const numericWeight = validateBodyWeightInput({ weightDate, weight });

  const existing = await findBodyWeightByDate(userId, weightDate);
  if (existing) {
    throw new Error("Ya tienes un peso guardado para ese día. Modifica el registro existente.");
  }

  const { data, error } = await supabase
    .from("body_weight_logs")
    .insert({
      user_id: userId,
      weight_date: weightDate,
      weight: numericWeight,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBodyWeight(logId, { weightDate, weight }) {
  const userId = await currentUserId();
  const numericWeight = validateBodyWeightInput({ weightDate, weight });

  const existing = await findBodyWeightByDate(userId, weightDate);
  if (existing && existing.id !== logId) {
    throw new Error("Ya tienes un peso guardado para ese día. Modifica ese registro o elige otra fecha.");
  }

  const { data, error } = await supabase
    .from("body_weight_logs")
    .update({
      weight_date: weightDate,
      weight: numericWeight,
    })
    .eq("id", logId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBodyWeight(logId) {
  const { error } = await supabase
    .from("body_weight_logs")
    .delete()
    .eq("id", logId);

  if (error) throw error;
}
