import { supabase } from "../lib/supabaseClient";
import { isIsoDate } from "../lib/date";

const POSITION_CHUNK_SIZE = 50;

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Usuario no autenticado");
  return data.user.id;
}

export async function saveWorkout({ workoutDate, exercises }) {
  if (!isIsoDate(workoutDate)) {
    throw new Error("La fecha del entrenamiento no es válida");
  }

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

export async function getWorkoutHistoryPage({ limit = 5, offset = 0 } = {}) {
  const { data, error, count } = await supabase
    .from("workouts")
    .select(`
      id,
      workout_date,
      created_at,
      workout_exercises!inner (
        id,
        exercise_order,
        exercises ( id, name, muscle_group ),
        workout_sets ( id, set_number, reps, weight )
      )
    `, { count: "exact" })
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { workouts: data ?? [], total: count ?? 0 };
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

export async function swapWorkoutExerciseOrder(firstId, firstOrder, secondId, secondOrder) {
  const { error: firstError } = await supabase
    .from("workout_exercises")
    .update({ exercise_order: secondOrder })
    .eq("id", firstId);

  if (firstError) throw firstError;

  const { error: secondError } = await supabase
    .from("workout_exercises")
    .update({ exercise_order: firstOrder })
    .eq("id", secondId);

  if (secondError) throw secondError;
}

function mapExerciseSessionRows(rows) {
  const byDate = new Map();

  for (const we of rows ?? []) {
    const date = we.workoutDate;
    if (!date) continue;

    const sets = (we.workout_sets ?? [])
      .filter((s) => s.reps !== "" && s.weight !== "" && Number(s.reps) > 0 && Number(s.weight) >= 0)
      .map((s) => ({
        set_number: s.set_number,
        reps: Number(s.reps),
        weight: Number(s.weight),
      }));

    if (sets.length === 0) continue;

    const existing = byDate.get(date) ?? {
      date,
      sets: [],
      workoutId: we.workout_id,
      workoutExerciseId: we.id,
      muscleGroup: we.exercises?.muscle_group?.trim() || null,
    };

    existing.sets.push(...sets);
    byDate.set(date, existing);
  }

  return Array.from(byDate.values())
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((session) => ({
      ...session,
      sets: session.sets.sort((a, b) => a.set_number - b.set_number),
    }));
}

async function fetchExerciseSessions(exerciseId) {
  if (!exerciseId) return [];

  const { data, error } = await supabase
    .from("workout_exercises")
    .select(`
      id,
      workout_id,
      exercise_order,
      exercises ( muscle_group ),
      workouts ( workout_date, created_at ),
      workout_sets ( id, set_number, reps, weight )
    `)
    .eq("exercise_id", exerciseId);

  if (error) throw error;

  return mapExerciseSessionRows(
    (data ?? []).map((we) => ({
      ...we,
      workoutDate: we.workouts?.workout_date,
    }))
  );
}

export async function getExerciseSessionsPage(exerciseId, { limit = 20, offset = 0 } = {}) {
  if (!exerciseId) return { sessions: [], hasMore: false };

  let workoutQuery = supabase
    .from("workouts")
    .select("id, workout_date, workout_exercises!inner(id)")
    .eq("workout_exercises.exercise_id", exerciseId)
    .order("workout_date", { ascending: false });

  if (limit) {
    workoutQuery = workoutQuery.range(offset, offset + limit - 1);
  }

  const { data: workouts, error: workoutsError } = await workoutQuery;
  if (workoutsError) throw workoutsError;

  const workoutIds = (workouts ?? []).map((workout) => workout.id);
  if (workoutIds.length === 0) {
    return { sessions: [], hasMore: false };
  }

  const workoutById = new Map((workouts ?? []).map((workout) => [workout.id, workout]));

  const { data, error } = await supabase
    .from("workout_exercises")
    .select(`
      id,
      workout_id,
      exercises ( muscle_group ),
      workout_sets ( id, set_number, reps, weight )
    `)
    .eq("exercise_id", exerciseId)
    .in("workout_id", workoutIds);

  if (error) throw error;

  const sessions = await attachPositions(
    mapExerciseSessionRows(
      (data ?? []).map((we) => ({
        ...we,
        workoutDate: workoutById.get(we.workout_id)?.workout_date,
      }))
    )
  );

  const hasMore = Boolean(limit) && workoutIds.length === limit;

  return { sessions, hasMore };
}

async function attachPositions(sessions) {
  if (!sessions.length) return sessions;

  const workoutIds = Array.from(new Set(sessions.map((session) => session.workoutId).filter(Boolean)));
  if (workoutIds.length === 0) return sessions;

  const siblingsByWorkout = new Map();

  for (let index = 0; index < workoutIds.length; index += POSITION_CHUNK_SIZE) {
    const chunk = workoutIds.slice(index, index + POSITION_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("workouts")
      .select(`
        id,
        workout_exercises ( id, exercise_order, exercises ( muscle_group ) )
      `)
      .in("id", chunk);

    if (error) throw error;

    for (const workout of data ?? []) {
      siblingsByWorkout.set(workout.id, workout.workout_exercises ?? []);
    }
  }

  for (const session of sessions) {
    const siblings = siblingsByWorkout.get(session.workoutId) ?? [];
    const ordered = [...siblings].sort((a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0));
    const sessionIndex = ordered.findIndex((item) => item.id === session.workoutExerciseId);
    if (sessionIndex < 0) continue;

    const groupName = session.muscleGroup;
    const groupItems = ordered.filter(
      (item) => (item.exercises?.muscle_group?.trim() || null) === groupName
    );
    const groupIndex = groupItems.findIndex((item) => item.id === session.workoutExerciseId);
    const previousGroups = ordered
      .slice(0, sessionIndex)
      .map((item) => item.exercises?.muscle_group?.trim() || null);

    session.position = {
      session: sessionIndex + 1,
      sessionTotal: ordered.length,
      group: groupIndex >= 0 ? groupIndex + 1 : null,
      groupTotal: groupItems.length,
      groupName,
      previousGroups,
    };
  }

  return sessions;
}

export async function getRecentExerciseSessions(exerciseId, limit = 4, offset = 0) {
  const all = await fetchExerciseSessions(exerciseId);
  return attachPositions(all.slice(offset, offset + limit));
}

export async function getExerciseSessions(exerciseId) {
  return fetchExerciseSessions(exerciseId);
}

export async function attachSessionPositions(sessions) {
  return attachPositions(sessions);
}
