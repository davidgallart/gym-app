create extension if not exists pgcrypto;

create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    created_at timestamptz not null default now()
);

create table if not exists exercises (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    muscle_group text,
    created_at timestamptz not null default now()
);

create table if not exists workouts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    workout_date date not null default current_date,
    created_at timestamptz not null default now()
);

create table if not exists workout_exercises (
    id uuid primary key default gen_random_uuid(),
    workout_id uuid not null references workouts(id) on delete cascade,
    exercise_id uuid not null references exercises(id) on delete cascade,
    exercise_order int not null default 1
);

create table if not exists workout_sets (
    id uuid primary key default gen_random_uuid(),
    workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
    set_number int not null,
    reps int not null check (reps > 0),
    weight numeric(6,2) not null check (weight >= 0)
);

alter table profiles enable row level security;
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sets enable row level security;

create policy "Users can read own profile"
on profiles
for select
to authenticated
using (id = auth.uid());

create policy "Users can insert own profile"
on profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "Users can update own profile"
on profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can manage own exercises"
on exercises
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own workouts"
on workouts
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own workout exercises"
on workout_exercises
for all
to authenticated
using (
    exists (
        select 1
        from workouts
        where workouts.id = workout_exercises.workout_id
        and workouts.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from workouts
        where workouts.id = workout_exercises.workout_id
        and workouts.user_id = auth.uid()
    )
);

create policy "Users can manage own workout sets"
on workout_sets
for all
to authenticated
using (
    exists (
        select 1
        from workout_exercises we
        join workouts w on w.id = we.workout_id
        where we.id = workout_sets.workout_exercise_id
        and w.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from workout_exercises we
        join workouts w on w.id = we.workout_id
        where we.id = workout_sets.workout_exercise_id
        and w.user_id = auth.uid()
    )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create index if not exists idx_exercises_user_id on exercises(user_id);
create index if not exists idx_workouts_user_date on workouts(user_id, workout_date desc);
create index if not exists idx_workout_exercises_workout_id on workout_exercises(workout_id);
create index if not exists idx_workout_exercises_exercise_id on workout_exercises(exercise_id);
create index if not exists idx_workout_sets_exercise_id on workout_sets(workout_exercise_id);

-- Peso corporal diario
create table if not exists body_weight_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    weight_date date not null default current_date,
    weight numeric(6,2) not null check (weight > 0),
    created_at timestamptz not null default now(),
    unique (user_id, weight_date)
);

alter table body_weight_logs enable row level security;

drop policy if exists "Users can manage own body weights" on body_weight_logs;

create policy "Users can manage own body weights"
on body_weight_logs
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists idx_body_weight_user_date on body_weight_logs(user_id, weight_date desc);
