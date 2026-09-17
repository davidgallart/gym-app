import { supabase } from "../lib/supabaseClient";

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Usuario no autenticado");
  return data.user.id;
}

export async function saveWorkout({ workoutDate, exercises }) {
  const userId = await currentUserId();

  const validExercises = exercises.filter(
    (item) => item.exerciseId && item.sets.some((set) => set.reps !== "" && set.weight !== "")
  );

  if (validExercises.length < 1) {
    throw new Error("Rellena ejercicio, peso y repeticiones antes de guardar");
  }

  let { data: workout, error: findWorkoutError } = await supabase
    .from("workouts")
    .select("id, workout_date")
    .eq("user_id", userId)
    .eq("workout_date", workoutDate)
    .maybeSingle();

  if (findWorkoutError) throw findWorkoutError;

  if (!workout) {
    const { data: createdWorkout, error: workoutError } = await supabase
      .from("workouts")
      .insert({ user_id: userId, workout_date: workoutDate })
      .select()
      .single();

    if (workoutError) throw workoutError;
    workout = createdWorkout;
  }

  const { data: existingExercises, error: orderError } = await supabase
    .from("workout_exercises")
    .select("exercise_order")
    .eq("workout_id", workout.id);

  if (orderError) throw orderError;

  const maxOrder = Math.max(0, ...(existingExercises ?? []).map((item) => Number(item.exercise_order) || 0));

  for (let i = 0; i < validExercises.length; i++) {
    const exercise = validExercises[i];

    const { data: workoutExercise, error: workoutExerciseError } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: workout.id,
        exercise_id: exercise.exerciseId,
        exercise_order: maxOrder + i + 1,
      })
      .select()
      .single();

    if (workoutExerciseError) throw workoutExerciseError;

    const setsToInsert = exercise.sets
      .filter((set) => set.reps !== "" && set.weight !== "")
      .map((set, index) => ({
        workout_exercise_id: workoutExercise.id,
        set_number: index + 1,
        reps: Number(set.reps),
        weight: Number(set.weight),
      }));

    const { error: setsError } = await supabase.from("workout_sets").insert(setsToInsert);
    if (setsError) throw setsError;
  }

  return workout;
}

export async function getWorkoutHistory() {
  const { data, error } = await supabase
    .from("workouts")
    .select(`
      id,
      workout_date,
      created_at,
      workout_exercises (
        id,
        exercise_order,
        exercises ( id, name, muscle_group ),
        workout_sets ( id, set_number, reps, weight )
      )
    `)
    .order("workout_date", { ascending: false })
    .limit(80);

  if (error) throw error;
  return (data ?? []).filter((workout) => (workout.workout_exercises ?? []).length > 0);
}

export async function updateWorkout(workoutId, editState) {
  const { error: workoutError } = await supabase
    .from("workouts")
    .update({ workout_date: editState.workoutDate })
    .eq("id", workoutId);

  if (workoutError) throw workoutError;

  const sets = editState.exercises.flatMap((exercise) => exercise.sets);

  for (const set of sets) {
    const reps = Number(set.reps);
    const weight = Number(set.weight);

    if (!Number.isFinite(reps) || !Number.isFinite(weight)) {
      throw new Error("Peso y repeticiones deben ser números válidos");
    }

    const { error } = await supabase
      .from("workout_sets")
      .update({ reps, weight })
      .eq("id", set.id);

    if (error) throw error;
  }
}

export async function updateWorkoutExercise(workoutExerciseId, sets) {
  for (const set of sets) {
    const reps = Number(set.reps);
    const weight = Number(set.weight);

    if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) {
      throw new Error("Peso y repeticiones deben ser números válidos");
    }
  }

  const { error } = await supabase
    .from("workout_sets")
    .upsert(
      sets.map((set, index) => ({
        id: set.id,
        workout_exercise_id: workoutExerciseId,
        set_number: index + 1,
        reps: Number(set.reps),
        weight: Number(set.weight),
      })),
      { onConflict: "id" }
    );

  if (error) throw error;
}

export async function deleteWorkout(workoutId) {
  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId);

  if (error) throw error;
}

export async function deleteWorkoutExercise(workoutExerciseId) {
  const { error } = await supabase
    .from("workout_exercises")
    .delete()
    .eq("id", workoutExerciseId);

  if (error) throw error;
}

export async function getExerciseProgress(exerciseId) {
  const { data, error } = await supabase
    .from("workout_sets")
    .select(`
      reps,
      weight,
      workout_exercises!inner (
        exercise_id,
        workouts!inner ( workout_date )
      )
    `)
    .eq("workout_exercises.exercise_id", exerciseId);

  if (error) throw error;

  const grouped = new Map();

  for (const row of data ?? []) {
    const date = row.workout_exercises.workouts.workout_date;
    const estimatedVolume = Number(row.weight) * Number(row.reps);
    const current = grouped.get(date) ?? { date, maxWeight: 0, totalVolume: 0 };

    current.maxWeight = Math.max(current.maxWeight, Number(row.weight));
    current.totalVolume += estimatedVolume;

    grouped.set(date, current);
  }

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
