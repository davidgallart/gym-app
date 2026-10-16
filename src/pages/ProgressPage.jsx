import React from "react";
import { useEffect, useMemo, useState } from "react";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { getExercises } from "../services/exerciseService";
import { getExerciseSessionStats } from "../services/workoutService";
import { formatSessionDate, formatSet, getPerformanceTrend, selectTopSets } from "../lib/performance";

const NO_GROUP_VALUE = "__NO_GROUP__";
const NO_GROUP_LABEL = "Sin grupo muscular";
const RECENT_SESSIONS = 4;

const TREND_LABELS = {
  improving: "Mejorando",
  declining: "Empeorando",
  maintaining: "Manteniendo",
};

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
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

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
  const trend = getPerformanceTrend(sessions);
  const totalPages = Math.max(1, Math.ceil(total / RECENT_SESSIONS));

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
      return;
    }

    const firstExercise = exercises.find((exercise) => getGroupValue(exercise) === selectedMuscleGroup);
    setSelectedExerciseId(firstExercise?.id ?? "");
    setPage(1);
  }, [selectedMuscleGroup, exercises]);

  useEffect(() => {
    if (!selectedExerciseId) {
      setSessions([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    getExerciseSessionStats(selectedExerciseId, RECENT_SESSIONS, (page - 1) * RECENT_SESSIONS)
      .then(({ sessions: pageSessions, total: totalSessions }) => {
        setSessions(pageSessions);
        setTotal(totalSessions);
        setMessage("");
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [selectedExerciseId, page]);

  return (
    <div className="page">
      <section className="hero-card">
        <div className="section-header-row">
          <h2>Progreso</h2>
          {onLogout && (
            <button className="secondary-button small-button" onClick={onLogout}>
              <LogOut size={16} /> Salir
            </button>
          )}
        </div>
        <div className="selector-stack">
          <label>
            Grupo muscular
            <select value={selectedMuscleGroup} onChange={(e) => setSelectedMuscleGroup(e.target.value)}>
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
          {trend && (
            <span className={`trend-badge ${trend}`}>{TREND_LABELS[trend]}</span>
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
    </div>
  );
}
