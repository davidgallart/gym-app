import { supabase } from "../lib/supabaseClient";

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

export async function getExercisePerformanceSummary(exerciseId) {
  const { data, error } = await supabase
    .from("workout_exercises")
    .select(`
      id,
      exercise_id,
      workouts (
        workout_date,
        created_at
      ),
      workout_sets (
        id,
        reps,
        weight,
        set_number
      )
    `)
    .eq("exercise_id", exerciseId);

  if (error) throw error;

  const workoutExercises = data ?? [];

  const latestWorkoutExercise = [...workoutExercises]
    .sort((a, b) => {
      const dateA = `${a.workouts?.workout_date ?? ""}T${a.workouts?.created_at ?? ""}`;
      const dateB = `${b.workouts?.workout_date ?? ""}T${b.workouts?.created_at ?? ""}`;
      return dateB.localeCompare(dateA);
    })[0];

  const lastPerformance = [...(latestWorkoutExercise?.workout_sets ?? [])]
    .sort((a, b) => a.set_number - b.set_number);

  const bestSet = workoutExercises
    .flatMap((workoutExercise) =>
      (workoutExercise.workout_sets ?? []).map((set) => ({
        ...set,
        workout_date: workoutExercise.workouts?.workout_date ?? null,
      }))
    )
    .sort((a, b) => {
      const weightDiff = Number(b.weight) - Number(a.weight);
      if (weightDiff !== 0) return weightDiff;

      const repsDiff = Number(b.reps) - Number(a.reps);
      if (repsDiff !== 0) return repsDiff;

      return String(b.workout_date ?? "").localeCompare(String(a.workout_date ?? ""));
    })[0] ?? null;

  return {
    lastPerformance,
    bestSet,
  };
}

export async function getLastPerformance(exerciseId) {
  const summary = await getExercisePerformanceSummary(exerciseId);
  return summary.lastPerformance;
}
