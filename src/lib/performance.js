const MAX_SETS_PER_DAY = 3;
const REP_BONUS_FACTOR = 40;
const GROUP_DROP = 0.02;
const SYNERGY_DROP = 0.01;
const LEG_DROP = 0.01;
const MIN_EXPECTED_RATIO = 0.6;
const FLAT_BAND = 0.02;
const STRONG_RECENT = 0.05;

const SYNERGY_GROUPS = {
  pecho: ["hombro", "triceps"],
  hombro: ["pecho", "triceps"],
  triceps: ["pecho", "hombro"],
  espalda: ["biceps"],
  biceps: ["espalda"],
};

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

export function formatOrdinal(value) {
  return `${value}º`;
}

function setScore(set) {
  const weight = Number(set.weight) || 0;
  const reps = Number(set.reps) || 0;
  return weight > 0 ? weight * (1 + reps / REP_BONUS_FACTOR) : reps;
}

function normalizeGroup(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSynergyTargets(group) {
  const normalized = normalizeGroup(group);
  if (!normalized) return [];
  const key = Object.keys(SYNERGY_GROUPS).find((item) => normalized.includes(item));
  return key ? SYNERGY_GROUPS[key] : [];
}

function isSynergistic(currentGroup, previousGroup) {
  return getSynergyTargets(currentGroup).some((keyword) => previousGroup.includes(keyword));
}

function isLegGroup(group) {
  return normalizeGroup(group).includes("pierna");
}

function expectedRatio(position) {
  if (!position) return 1;

  const groupPenalty = GROUP_DROP * Math.max(0, (position.group ?? 1) - 1);
  const current = normalizeGroup(position.groupName);
  const previousGroups = position.previousGroups ?? [];
  const synergyCount = previousGroups.filter((group) => {
    const previous = normalizeGroup(group);
    if (!previous || !current || previous === current) return false;
    return isSynergistic(current, previous);
  }).length;

  // La pierna fatiga de forma global: si va antes, penaliza a los demás grupos.
  // Si el ejercicio actual también es de pierna, ya lo cuenta la posición de grupo.
  const legPenalty = isLegGroup(position.groupName)
    ? 0
    : LEG_DROP * previousGroups.filter((group) => isLegGroup(group)).length;

  const synergyPenalty = SYNERGY_DROP * synergyCount;
  return Math.max(MIN_EXPECTED_RATIO, 1 - groupPenalty - synergyPenalty - legPenalty);
}

function dayScore(session) {
  const validSets = (session?.sets ?? [])
    .map((set) => ({
      ...set,
      weight: Number(set.weight) || 0,
      reps: Number(set.reps) || 0,
      set_number: Number(set.set_number) || 0,
    }))
    .filter((set) => set.weight > 0 || set.reps > 0);

  const best = selectTopSets(validSets, MAX_SETS_PER_DAY);
  if (best.length === 0) return null;

  const expected = expectedRatio(session?.position);
  const adjusted = best.map((set) => setScore(set) / expected);

  return adjusted.reduce((sum, value) => sum + value, 0) / adjusted.length;
}

function getSlope(scores) {
  const count = scores.length;
  const mean = scores.reduce((sum, value) => sum + value, 0) / count;
  const xMean = (count - 1) / 2;
  let numerator = 0;
  let denominator = 0;

  scores.forEach((score, index) => {
    numerator += (index - xMean) * (score - mean);
    denominator += (index - xMean) ** 2;
  });

  return denominator ? numerator / denominator : 0;
}

export function getPerformanceTrend(sessions) {
  if (!sessions || sessions.length < 2) return null;

  const scores = [...sessions]
    .reverse()
    .map(dayScore)
    .filter((score) => score !== null);

  if (scores.length < 2) return null;

  const count = scores.length;
  const mean = scores.reduce((sum, value) => sum + value, 0) / count;
  if (mean === 0) return "maintaining";

  const slope = getSlope(scores);
  const overallRatio = (slope * (count - 1)) / mean;

  let recentRatio = null;
  if (count >= 4) {
    const recentMean = (scores[count - 2] + scores[count - 1]) / 2;
    const previousMean = (scores[count - 4] + scores[count - 3]) / 2;
    if (previousMean !== 0) {
      recentRatio = (recentMean - previousMean) / previousMean;
    }
  }

  if (recentRatio !== null) {
    if (recentRatio <= -STRONG_RECENT) return "declining";
    if (recentRatio >= STRONG_RECENT) return "improving";
  }

  if (overallRatio >= FLAT_BAND) return "improving";
  if (overallRatio <= -FLAT_BAND) return "declining";
  return "maintaining";
}

export function getTrendSeries(sessions) {
  const points = [...(sessions ?? [])]
    .reverse()
    .map((session) => ({
      date: session.date,
      label: formatSessionDate(session.date).slice(0, 5),
      score: dayScore(session),
      position: session.position ?? null,
      sets: selectTopSets(session.sets ?? [], MAX_SETS_PER_DAY),
    }))
    .filter((point) => point.score !== null)
    .map((point, index) => ({ ...point, index }));

  if (points.length < 2) {
    return points.map((point) => ({ ...point, trendValue: point.score }));
  }

  const scores = points.map((point) => point.score);
  const slope = getSlope(scores);
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const xMean = (scores.length - 1) / 2;
  const intercept = mean - slope * xMean;

  return points.map((point) => ({
    ...point,
    trendValue: intercept + slope * point.index,
  }));
}
