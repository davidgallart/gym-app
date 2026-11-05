drop policy if exists "Users can manage own workout exercises" on public.workout_exercises;

create policy "Users can manage own workout exercises"
on public.workout_exercises
for all
to authenticated
using (
  exists (
    select 1
    from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.exercises
    where exercises.id = workout_exercises.exercise_id
      and exercises.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.exercises
    where exercises.id = workout_exercises.exercise_id
      and exercises.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage own workout sets" on public.workout_sets;

create policy "Users can manage own workout sets"
on public.workout_sets
for all
to authenticated
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    join public.exercises e on e.id = we.exercise_id
    where we.id = workout_sets.workout_exercise_id
      and w.user_id = auth.uid()
      and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    join public.exercises e on e.id = we.exercise_id
    where we.id = workout_sets.workout_exercise_id
      and w.user_id = auth.uid()
      and e.user_id = auth.uid()
  )
);
