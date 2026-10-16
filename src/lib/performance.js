export function selectTopSets(sets, max = 3) {
  const ordered = [...sets].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (b.reps !== a.reps) return b.reps - a.reps;
    return b.set_number - a.set_number;
  });

  return ordered.slice(0, max).sort((a, b) => a.set_number - b.set_number);
}

export function formatSessionDate(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = String(dateStr).split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function formatSet(set, index) {
  return `S${index + 1}: ${set.weight}Kg x ${set.reps}`;
}

export function getPerformanceTrend(sessions) {
  if (!sessions || sessions.length < 2) return null;

  const bestOf = (session) =>
    session.sets.reduce((best, set) => {
      if (!best) return set;
      if (set.weight !== best.weight) return set.weight > best.weight ? set : best;
      return set.reps > best.reps ? set : best;
    }, null);

  const newestBest = bestOf(sessions[0]);
  const oldestBest = bestOf(sessions[sessions.length - 1]);

  if (!newestBest || !oldestBest) return null;

  if (newestBest.weight !== oldestBest.weight) {
    return newestBest.weight > oldestBest.weight ? "improving" : "declining";
  }
  if (newestBest.reps !== oldestBest.reps) {
    return newestBest.reps > oldestBest.reps ? "improving" : "declining";
  }
  return "maintaining";
}
