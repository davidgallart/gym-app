import { supabase } from "../lib/supabaseClient";
import { sortExercisesByLastUsed } from "../lib/exerciseOrdering";

const EXERCISE_CACHE_TTL_MS = 60 * 1000;
let exercisesCache = null;
let exercisesCacheAt = 0;

function clearExercisesCache() {
  exercisesCache = null;
  exercisesCacheAt = 0;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Usuario no autenticado");
  return data.user.id;
}

export async function getExercises({ force = false } = {}) {
  const cacheIsFresh = exercisesCache && Date.now() - exercisesCacheAt < EXERCISE_CACHE_TTL_MS;
  if (!force && cacheIsFresh) {
    return exercisesCache;
  }

  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, created_at")
    .order("name", { ascending: true });

  if (error) throw error;
  exercisesCache = data ?? [];
  exercisesCacheAt = Date.now();
  return exercisesCache;
}

export async function getExerciseLastUsed() {
  const { data, error } = await supabase.rpc("get_exercise_last_used");
  if (error) throw error;
  return data ?? [];
}

export async function getExercisesForPicker() {
  const exercises = await getExercises();

  try {
    const lastUsed = await getExerciseLastUsed();
    return sortExercisesByLastUsed(exercises, lastUsed);
  } catch {
    return exercises;
  }
}

export async function createExercise({ name, muscleGroup }) {
  const userId = await currentUserId();

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      name: name.trim(),
      muscle_group: muscleGroup?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;
  clearExercisesCache();
  return data;
}

export async function updateExercise(exerciseId, { name, muscleGroup }) {
  const { data, error } = await supabase
    .from("exercises")
    .update({
      name: name.trim(),
      muscle_group: muscleGroup?.trim() || null,
    })
    .eq("id", exerciseId)
    .select()
    .single();

  if (error) throw error;
  clearExercisesCache();
  return data;
}

export async function deleteExercise(exerciseId) {
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId);

  if (error) throw error;
  clearExercisesCache();
}
