export const NO_GROUP_VALUE = "__NO_GROUP__";
export const NO_GROUP_LABEL = "Sin grupo muscular";

export function getGroupValue(exercise) {
  return exercise?.muscle_group?.trim() || NO_GROUP_VALUE;
}

export function getGroupLabel(groupValue) {
  return groupValue === NO_GROUP_VALUE ? NO_GROUP_LABEL : groupValue;
}

export function getMuscleGroups(exercises) {
  return Array.from(new Set((exercises ?? []).map(getGroupValue))).sort((a, b) =>
    getGroupLabel(a).localeCompare(getGroupLabel(b))
  );
}

export function filterExercisesByGroup(exercises, groupValue) {
  if (!groupValue) return [];
  return (exercises ?? []).filter((exercise) => getGroupValue(exercise) === groupValue);
}
