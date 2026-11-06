import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Info, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { getExercises } from "../services/exerciseService";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  attachSessionPositions,
  getExerciseSessions,
  getExerciseSessionsPage,
} from "../services/workoutService";
import {
  PERFORMANCE_INFO,
  formatOrdinal,
  formatSessionDate,
  formatSet,
  getPerformanceTrend,
  getTrendSeries,
  selectTopSets,
} from "../lib/performance";
import { monthsAgoIsoDate } from "../lib/date";

const NO_GROUP_VALUE = "__NO_GROUP__";
const NO_GROUP_LABEL = "Sin grupo muscular";
const RECENT_SESSIONS = 4;
const CHART_BLOCK_SIZE = 20;
const SESSION_WINDOW_OPTIONS = [4, 8, 12, 20];
const MONTH_WINDOW_OPTIONS = [1, 2, 3, 4];

const TREND_LABELS = {
  improving: "Mejorando",
  declining: "Empeorando",
  maintaining: "Manteniendo",
};

function isMonthWindow(value) {
  return typeof value === "string" && value.endsWith("m");
}

function getMonthWindowCount(value) {
  return Number(value.slice(0, -1));
}

function getWindowLabel(windowSize) {
  if (windowSize === "all") return "de todo el historial";
  if (isMonthWindow(windowSize)) {
    const months = getMonthWindowCount(windowSize);
    return months === 1 ? "del último mes" : `de los últimos ${months} meses`;
  }
  return `de las últimas ${windowSize} sesiones`;
}

const ExerciseTrendChart = lazy(() => import("../components/charts/ExerciseTrendChart"));

function getGroupValue(exercise) {
  return exercise.muscle_group?.trim() || NO_GROUP_VALUE;
}

function getGroupLabel(groupValue) {
  return groupValue === NO_GROUP_VALUE ? NO_GROUP_LABEL : groupValue;
}

export default function ProgressPage({ onLogout }) {
  const [exercises, setExercises] = useState([]);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [rawSessions, setRawSessions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionsExerciseId, setSessionsExerciseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [chartVisible, setChartVisible] = useState(false);
  const [chartSessions, setChartSessions] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [windowSize, setWindowSize] = useState(8);
  const [infoOpen, setInfoOpen] = useState(false);
  const chartCacheRef = useRef(new Map());

  const muscleGroups = useMemo(() => {
    return Array.from(new Set(exercises.map(getGroupValue))).sort((a, b) =>
      getGroupLabel(a).localeCompare(getGroupLabel(b))
    );
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    if (!selectedMuscleGroup) return [];
    return exercises.filter((exercise) => getGroupValue(exercise) === selectedMuscleGroup);
  }, [exercises, selectedMuscleGroup]);

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId) ?? null;
  const total = rawSessions.length;
  const trend = getPerformanceTrend(sessions);
  const totalPages = Math.max(1, Math.ceil(total / RECENT_SESSIONS));

  const chartSeries = useMemo(() => getTrendSeries(chartSessions), [chartSessions]);
  const chartTrend = useMemo(() => getPerformanceTrend(chartSessions), [chartSessions]);
  const windowLabel = getWindowLabel(windowSize);

  useEffect(() => {
    getExercises()
      .then((data) => {
        setExercises(data);
        const firstGroup = data[0] ? getGroupValue(data[0]) : "";
        setSelectedMuscleGroup(firstGroup);
      })
      .catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!selectedMuscleGroup) {
      setSelectedExerciseId("");
      setPage(1);
      setChartVisible(false);
      setChartSessions([]);
      return;
    }

    const firstExercise = exercises.find((exercise) => getGroupValue(exercise) === selectedMuscleGroup);
    setSelectedExerciseId(firstExercise?.id ?? "");
    setPage(1);
    setChartVisible(false);
    setChartSessions([]);
  }, [selectedMuscleGroup, exercises]);

  useEffect(() => {
    chartCacheRef.current.clear();

    if (!selectedExerciseId) {
      setRawSessions([]);
      setSessions([]);
      setSessionsExerciseId("");
      setChartSessions([]);
      setChartVisible(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setRawSessions([]);
    setSessions([]);
    setSessionsExerciseId("");
    setChartSessions([]);
    setChartVisible(false);
    setWindowSize(8);

    getExerciseSessions(selectedExerciseId)
      .then((data) => {
        if (cancelled) return;
        setRawSessions(data);
        setSessionsExerciseId(selectedExerciseId);
        setMessage("");
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedExerciseId]);

  useEffect(() => {
    if (!selectedExerciseId || sessionsExerciseId !== selectedExerciseId) return;

    if (rawSessions.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const start = (page - 1) * RECENT_SESSIONS;
    setLoading(true);

    attachSessionPositions(rawSessions.slice(start, start + RECENT_SESSIONS))
      .then((pageSessions) => {
        if (cancelled) return;
        setSessions(pageSessions);
        setMessage("");
      })
      .catch((error) => {
        if (!cancelled) setMessage(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rawSessions, page, sessionsExerciseId, selectedExerciseId]);

  useEffect(() => {
    if (!chartVisible || !selectedExerciseId) {
      setChartLoading(false);
      return;
    }

    const exerciseId = selectedExerciseId;
    const since = isMonthWindow(windowSize)
      ? monthsAgoIsoDate(getMonthWindowCount(windowSize))
      : undefined;
    const cacheKey = `${exerciseId}:${windowSize}${since ? `:${since}` : ""}`;
    const cached = chartCacheRef.current.get(cacheKey);

    if (cached) {
      setChartSessions(cached);
      setChartLoading(false);
      return;
    }

    let cancelled = false;
    setChartLoading(true);
    setChartSessions([]);

    const load = async () => {
      try {
        if (windowSize === "all" || since) {
          let offset = 0;
          let accumulated = [];

          while (!cancelled) {
            const { sessions, hasMore } = await getExerciseSessionsPage(exerciseId, {
              limit: CHART_BLOCK_SIZE,
              offset,
              since,
            });

            if (cancelled) return;

            accumulated = [...accumulated, ...sessions];
            setChartSessions(accumulated);

            if (!hasMore) break;
            offset += CHART_BLOCK_SIZE;
          }

          if (cancelled) return;
          chartCacheRef.current.set(cacheKey, accumulated);
        } else {
          const limit = Number(windowSize);
          const { sessions } = await getExerciseSessionsPage(exerciseId, { limit, offset: 0 });

          if (cancelled) return;

          chartCacheRef.current.set(cacheKey, sessions);
          setChartSessions(sessions);
        }

        if (!cancelled) setMessage("");
      } catch (error) {
        if (cancelled) return;
        setMessage(error.message);
        setChartVisible(false);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [chartVisible, selectedExerciseId, windowSize]);

  function resetChart() {
    setChartVisible(false);
    setChartSessions([]);
    setWindowSize(8);
  }

  return (
    <div className="page">
      <section className="hero-card">
        <div className="section-header-row">
          <h2>Progreso</h2>
          {onLogout && (
            <button className="secondary-button small-button danger-button" onClick={onLogout}>
              <LogOut size={16} /> Salir
            </button>
          )}
        </div>
        <div className="selector-stack">
          <label>
            Grupo muscular
            <select
              value={selectedMuscleGroup}
              onChange={(e) => {
                setSelectedMuscleGroup(e.target.value);
                setPage(1);
                resetChart();
              }}
            >
              <option value="">Selecciona grupo muscular</option>
              {muscleGroups.map((group) => (
                <option key={group} value={group}>{getGroupLabel(group)}</option>
              ))}
            </select>
          </label>

          <label>
            Ejercicio
            <select
              value={selectedExerciseId}
              onChange={(e) => {
                setSelectedExerciseId(e.target.value);
                setPage(1);
                resetChart();
              }}
              disabled={!selectedMuscleGroup}
            >
              <option value="">{selectedMuscleGroup ? "Selecciona ejercicio" : "Primero elige un grupo"}</option>
              {filteredExercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="card">
        <div className="section-header-row">
          <h3>{selectedExercise ? selectedExercise.name : "Últimas sesiones"}</h3>
          {!loading && trend && (
            <span className={`trend-badge ${trend}`} title="Tendencia de las sesiones de esta página">
              {TREND_LABELS[trend]}
            </span>
          )}
        </div>

        {loading && <p className="empty">Cargando...</p>}

        {!loading && sessions.length === 0 && (
          <p className="empty">No hay datos todavía. Registra entrenos para ver tu progreso.</p>
        )}

        {!loading && sessions.length > 0 && (
          <div className="sessions-grid">
            {sessions.map((session, index) => (
              <div className="session-card" key={session.date}>
                <div className="session-card-header">
                  <strong>Día {(page - 1) * RECENT_SESSIONS + index + 1}</strong>
                  <span>{formatSessionDate(session.date)}</span>
                </div>
                {session.position && (
                  <p
                    className="session-order"
                    title={`${formatOrdinal(session.position.session)} de ${session.position.sessionTotal} en la sesión · ${session.position.group ? formatOrdinal(session.position.group) : "—"} de ${session.position.groupTotal} en ${session.position.groupName ?? "Sin grupo"}`}
                  >
                    {formatOrdinal(session.position.session)}/{session.position.sessionTotal}
                    {" · "}
                    {session.position.group ? formatOrdinal(session.position.group) : "—"}/{session.position.groupTotal}
                  </p>
                )}
                <div className="session-sets">
                  {selectTopSets(session.sets).map((set, setIndex) => (
                    <span className="session-set" key={setIndex}>
                      {formatSet(set, setIndex)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && sessions.length > 0 && totalPages > 1 && (
          <div className="pagination-controls" aria-label="Paginación de sesiones">
            <button
              className="secondary-button small-button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} /> Recientes
            </button>
            <span>Página {page} de {totalPages}</span>
            <button
              className="secondary-button small-button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Anteriores <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>

      <section className={`card ${chartVisible ? "chart-card" : ""}`}>
        <div className="section-header-row">
          <h3>Tendencia</h3>
          <div className="chart-header-controls">
            <button
              type="button"
              className="exercise-tool-button exercise-tool-button-gray"
              onClick={() => setInfoOpen(true)}
              aria-haspopup="dialog"
              title="Qué es el Rendimiento ajustado"
              aria-label="Qué es el Rendimiento ajustado"
            >
              <Info size={18} />
            </button>
            {chartVisible && chartTrend && (
              <span className={`trend-badge ${chartTrend}`} title={`Tendencia ${windowLabel}`}>
                {TREND_LABELS[chartTrend]}
              </span>
            )}
            {chartVisible && (
              <label className="chart-window">
                <span>Rango</span>
                <select value={windowSize} onChange={(e) => setWindowSize(e.target.value)}>
                  <optgroup label="Sesiones">
                    {SESSION_WINDOW_OPTIONS.map((size) => (
                      <option key={size} value={size}>Últimas {size} sesiones</option>
                    ))}
                  </optgroup>
                  <optgroup label="Tiempo">
                    {MONTH_WINDOW_OPTIONS.map((months) => (
                      <option key={`${months}m`} value={`${months}m`}>
                        {months === 1 ? "Último mes" : `Últimos ${months} meses`}
                      </option>
                    ))}
                  </optgroup>
                  <option value="all">Todo</option>
                </select>
              </label>
            )}
            <button
              className="secondary-button small-button"
              onClick={() => setChartVisible((visible) => !visible)}
              disabled={!selectedExerciseId || total < 2 || loading}
              title={total < 2 ? "Necesitas al menos 2 sesiones para ver la tendencia" : undefined}
            >
              {chartVisible ? "Ocultar gráfico" : "Ver gráfico"}
            </button>
          </div>
        </div>

        {!chartVisible && <p className="chart-hint">Pulsa “Ver gráfico” para cargar la evolución.</p>}

        {chartVisible && chartSessions.length < 2 && (
          <p className="empty">
            {chartLoading
              ? "Cargando gráfico..."
              : isMonthWindow(windowSize)
                ? "No hay suficientes sesiones en este rango."
                : "Necesitas al menos 2 sesiones para ver la tendencia."}
          </p>
        )}

        {chartVisible && chartSessions.length >= 2 && (
          <>
            {chartLoading && (
              <p className="chart-hint">
                Cargando historial… ({chartSessions.length} sesiones)
              </p>
            )}
            <div className="chart-legend-note">
              <span><i className="legend-dot score"></i>Rendimiento ajustado</span>
              <span><i className="legend-dot trend"></i>Tendencia</span>
            </div>
            <Suspense fallback={<p className="empty">Cargando gráfica...</p>}>
              <ExerciseTrendChart data={chartSeries} />
            </Suspense>
          </>
        )}
      </section>

      <ConfirmDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        message={PERFORMANCE_INFO}
      />
    </div>
  );
}
