export function sortExercisesByLastUsed(exercises, lastUsedRows) {
  const lastUsedById = new Map(
    (lastUsedRows ?? []).map((row) => [row.exercise_id, row.last_used_date])
  );

  return [...exercises].sort((a, b) => {
    const lastUsedA = lastUsedById.get(a.id);
    const lastUsedB = lastUsedById.get(b.id);

    if (lastUsedA && lastUsedB) {
      const dateCompare = String(lastUsedB).localeCompare(String(lastUsedA));
      return dateCompare || a.name.localeCompare(b.name);
    }

    if (lastUsedA) return -1;
    if (lastUsedB) return 1;
    return a.name.localeCompare(b.name);
  });
}
