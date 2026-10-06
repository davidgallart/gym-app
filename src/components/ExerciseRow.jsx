import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Timer, TimerOff, Trash2, X } from "lucide-react";
import { getExercisePerformanceSummary } from "../services/exerciseService";
import { useToast } from "./ToastProvider";
import { useRestTimer } from "./RestTimerProvider";

const NO_GROUP_VALUE = "__NO_GROUP__";
const NO_GROUP_LABEL = "Sin grupo muscular";

const REST_ENABLED_KEY = "gym-rest-enabled";
const REST_DURATIONS_KEY = "gym-rest-durations";
const REST_DEFAULT_SECONDS = 90;
const REST_LARGE_GROUP_SECONDS = 120;
const REST_MIN_SECONDS = 15;
const REST_MAX_SECONDS = 300;
const REST_STEP_SECONDS = 15;
const LARGE_GROUP_KEYWORDS = ["pecho", "espalda", "pierna"];

function getDefaultRestSeconds(muscleGroup) {
  const group = (muscleGroup || "").toLowerCase();
  return LARGE_GROUP_KEYWORDS.some((keyword) => group.includes(keyword))
    ? REST_LARGE_GROUP_SECONDS
    : REST_DEFAULT_SECONDS;
}

function loadRestDurations() {
  try {
    const raw = localStorage.getItem(REST_DURATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getGroupValue(exercise) {
  return exercise.muscle_group?.trim() || NO_GROUP_VALUE;
}

function getGroupLabel(groupValue) {
  return groupValue === NO_GROUP_VALUE ? NO_GROUP_LABEL : groupValue;
}

export default function ExerciseRow({ index, item, exercises, onChange, onRemove, singleMode = false }) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("");
  const [lastPerformance, setLastPerformance] = useState([]);
  const [bestPerformance, setBestPerformance] = useState(null);
  const [loadingLastPerformance, setLoadingLastPerformance] = useState(false);
  const { showToast } = useToast();

  const [restEnabled, setRestEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(REST_ENABLED_KEY);
      return stored === null ? true : stored !== "0";
    } catch {
      return true;
    }
  });
  const [restDuration, setRestDuration] = useState(REST_DEFAULT_SECONDS);
  const { restRemaining, startRest, cancelRest } = useRestTimer();
  const prevExerciseIdRef = useRef(item.exerciseId);

  const muscleGroups = useMemo(() => {
    return Array.from(new Set(exercises.map(getGroupValue))).sort((a, b) =>
      getGroupLabel(a).localeCompare(getGroupLabel(b))
    );
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    if (!selectedMuscleGroup) return [];
    return exercises.filter((exercise) => getGroupValue(exercise) === selectedMuscleGroup);
  }, [exercises, selectedMuscleGroup]);

  useEffect(() => {
    if (!item.exerciseId) return;

    const selectedExercise = exercises.find((exercise) => exercise.id === item.exerciseId);
    if (selectedExercise) {
      setSelectedMuscleGroup(getGroupValue(selectedExercise));
    }
  }, [item.exerciseId, exercises]);

  useEffect(() => {
    if (!item.exerciseId) {
      setLastPerformance([]);
      setBestPerformance(null);
      return;
    }

    setLoadingLastPerformance(true);

    getExercisePerformanceSummary(item.exerciseId)
      .then(({ lastPerformance, bestSet }) => {
        setLastPerformance(lastPerformance);
        setBestPerformance(bestSet);
        if (lastPerformance.length > 0 || bestSet) {
          showToast("Marcas cargadas", "success");
        }
      })
      .catch((error) => {
        setLastPerformance([]);
        setBestPerformance(null);
        showToast(error.message, "error");
      })
      .finally(() => setLoadingLastPerformance(false));
  }, [item.exerciseId, showToast]);

  useEffect(() => {
    const exerciseChanged = prevExerciseIdRef.current !== item.exerciseId;
    prevExerciseIdRef.current = item.exerciseId;

    // Un descanso en marcha solo se cancela si el usuario cambia de ejercicio,
    // nunca al volver a Entreno (montaje) ni al recargar la lista de ejercicios.
    if (exerciseChanged) {
      cancelRest();
    }

    if (!item.exerciseId) {
      setRestDuration(REST_DEFAULT_SECONDS);
      return;
    }

    const durations = loadRestDurations();
    const stored = Number(durations[item.exerciseId]);
    if (stored) {
      setRestDuration(stored);
      return;
    }

    const selectedExercise = exercises.find((exercise) => exercise.id === item.exerciseId);
    setRestDuration(getDefaultRestSeconds(selectedExercise?.muscle_group ?? ""));
  }, [item.exerciseId, exercises]);

  function handleInputBlur(event, setIndex) {
    const set = item.sets[setIndex];
    if (!set) return;
    if (set.weight === "" || set.reps === "") return;

    const related = event.relatedTarget;
    if (related && typeof related.closest === "function") {
      if (related.closest(".rest-timer-bar") || related.closest(".exercise-header")) {
        return;
      }
    }

    if (restEnabled) startRest(restDuration);
  }

  function changeRestDuration(delta) {
    const next = Math.min(REST_MAX_SECONDS, Math.max(REST_MIN_SECONDS, restDuration + delta));
    setRestDuration(next);

    if (item.exerciseId) {
      const durations = loadRestDurations();
      durations[item.exerciseId] = next;
      localStorage.setItem(REST_DURATIONS_KEY, JSON.stringify(durations));
    }
  }

  function toggleRestEnabled() {
    const next = !restEnabled;
    setRestEnabled(next);
    localStorage.setItem(REST_ENABLED_KEY, next ? "1" : "0");
    if (!next) cancelRest();
  }

  function handleMuscleGroupChange(value) {
    setSelectedMuscleGroup(value);
    onChange(index, { ...item, exerciseId: "" });
  }

  function updateSet(setIndex, field, value) {
    const newSets = item.sets.map((set, i) => (i === setIndex ? { ...set, [field]: value } : set));
    onChange(index, { ...item, sets: newSets });
  }

  function addSet() {
    onChange(index, {
      ...item,
      sets: [...item.sets, { weight: "", reps: "" }],
    });
  }

  function removeSet(setIndex) {
    onChange(index, {
      ...item,
      sets: item.sets.filter((_, i) => i !== setIndex),
    });
  }

  return (
    <section className="card exercise-card">
      <div className="exercise-header">
        <div>
          <h3>{singleMode ? "Ejercicio" : `Ejercicio ${index + 1}`}</h3>
        </div>
        <div className="item-actions">
          <button
            type="button"
            className={`rest-toggle-button ${restEnabled ? "rest-toggle-on" : ""}`}
            onClick={toggleRestEnabled}
            aria-pressed={restEnabled}
            title={restEnabled ? "Desactivar descanso automático" : "Activar descanso automático"}
            aria-label={restEnabled ? "Desactivar descanso automático" : "Activar descanso automático"}
          >
            {restEnabled ? <Timer size={18} /> : <TimerOff size={18} />}
          </button>
          <button className="danger-icon" onClick={() => onRemove(index)} title={singleMode ? "Limpiar ejercicio" : "Eliminar ejercicio"}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="selector-stack">
        <label>
          Grupo muscular
          <select value={selectedMuscleGroup} onChange={(e) => handleMuscleGroupChange(e.target.value)}>
            <option value="">Selecciona grupo muscular</option>
            {muscleGroups.map((group) => (
              <option key={group} value={group}>{getGroupLabel(group)}</option>
            ))}
          </select>
        </label>

        <label>
          Ejercicio
          <select
            value={item.exerciseId}
            onChange={(e) => onChange(index, { ...item, exerciseId: e.target.value })}
            disabled={!selectedMuscleGroup}
          >
            <option value="">{selectedMuscleGroup ? "Selecciona ejercicio" : "Primero elige un grupo"}</option>
            {filteredExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
            ))}
          </select>
        </label>
      </div>

      {restEnabled && (
        <div className="rest-timer-bar">
          {restRemaining === null ? (
            <div className="rest-timer-settings">
              <span className="rest-timer-label">Descanso por serie</span>
              <div className="rest-timer-controls">
                <button type="button" className="rest-step-button" onClick={() => changeRestDuration(-REST_STEP_SECONDS)} aria-label="Reducir tiempo de descanso" title="Reducir descanso">
                  <Minus size={16} />
                </button>
                <span className="rest-timer-value">{restDuration}s</span>
                <button type="button" className="rest-step-button" onClick={() => changeRestDuration(REST_STEP_SECONDS)} aria-label="Aumentar tiempo de descanso" title="Aumentar descanso">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="rest-timer-counting">
              <div className="rest-countdown">
                <span role="timer" className="rest-countdown-number">{restRemaining}</span>
                <span className="rest-countdown-unit">s</span>
              </div>
              <button type="button" className="rest-cancel-button" onClick={cancelRest} aria-label="Cancelar descanso" title="Cancelar descanso">
                <X size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {loadingLastPerformance && (
        <div className="last-performance">
          <strong>Cargando última marca...</strong>
        </div>
      )}

      {!loadingLastPerformance && item.exerciseId && lastPerformance.length === 0 && (
        <div className="last-performance muted-last-performance">
          <strong>Última vez:</strong>
          <span>Todavía no hay marcas guardadas para este ejercicio.</span>
        </div>
      )}

      {!loadingLastPerformance && lastPerformance.length > 0 && (
        <div className="performance-summary">
          <div className="last-performance">
            <strong>Última sesión:</strong>
            {lastPerformance.map((set) => (
              <span key={`${set.set_number}-${set.weight}-${set.reps}`}>
                Serie {set.set_number}: {Number(set.weight)} kg x {set.reps} reps
              </span>
            ))}
          </div>

          {bestPerformance && (
            <div className="last-performance best-performance">
              <strong>Máximo registrado:</strong>
              <span>
                {Number(bestPerformance.weight)} kg x {bestPerformance.reps} reps
                {bestPerformance.workout_date ? ` · ${bestPerformance.workout_date}` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="sets-grid">
        {item.sets.map((set, setIndex) => (
          <div className="set-card" key={setIndex}>
            <div className="set-card-header">
              <strong>Serie {setIndex + 1}</strong>
              <button className="mini-danger-button" onClick={() => removeSet(setIndex)} title="Eliminar serie">
                <Trash2 size={15} />
              </button>
            </div>
            <input type="number" inputMode="decimal" placeholder="Kg" value={set.weight} onChange={(e) => updateSet(setIndex, "weight", e.target.value)} onBlur={(e) => handleInputBlur(e, setIndex)} />
            <input type="number" inputMode="numeric" placeholder="Reps" value={set.reps} onChange={(e) => updateSet(setIndex, "reps", e.target.value)} onBlur={(e) => handleInputBlur(e, setIndex)} />
          </div>
        ))}
      </div>

      <button className="secondary-button full-width-button" onClick={addSet}>
        <Plus size={18} /> Añadir serie
      </button>
    </section>
  );
}
