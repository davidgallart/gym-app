create or replace function public.get_exercise_last_used()
returns table (
  exercise_id uuid,
  last_used_date date
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    we.exercise_id,
    max(w.workout_date) as last_used_date
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  where w.user_id = auth.uid()
  group by we.exercise_id;
$$;

revoke all on function public.get_exercise_last_used() from public;
grant execute on function public.get_exercise_last_used() to authenticated;
