import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ListPlus, Minus, Plus, Timer, TimerOff, Trash2, X } from "lucide-react";
import { getRecentExerciseSessions } from "../../shared/api/workoutService";
import { formatOrdinal, formatSet, selectTopSets } from "../../shared/lib/performance";
import { formatDisplayDate } from "../../shared/lib/date";
import { filterExercisesByGroup, getGroupLabel, getGroupValue, getMuscleGroups } from "../../shared/lib/exerciseGroups";
import { useToast } from "../../shared/components/ToastProvider";
import { useRestTimer } from "./RestTimerProvider";
import ConfirmDialog from "../../shared/components/ConfirmDialog";

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

export default function ExerciseRow({
  index,
  item,
  exercises,
  onChange,
  onRemove,
  singleMode = false,
  onSaveAndSwitchExercise,
  workoutDate,
  onWorkoutDateChange,
  onGoToExercises,
}) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("");
  const [recentSessions, setRecentSessions] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
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
  const dateInputRef = useRef(null);
  const itemRef = useRef(item);
  const prefilledExerciseRef = useRef(null);

  const [confirmModal, setConfirmModal] = useState(null);

  const muscleGroups = useMemo(() => getMuscleGroups(exercises), [exercises]);

  const filteredExercises = useMemo(
    () => filterExercisesByGroup(exercises, selectedMuscleGroup),
    [exercises, selectedMuscleGroup]
  );

  useEffect(() => {
    if (!item.exerciseId) return;

    const selectedExercise = exercises.find((exercise) => exercise.id === item.exerciseId);
    if (selectedExercise) {
      setSelectedMuscleGroup(getGroupValue(selectedExercise));
    }
  }, [item.exerciseId, exercises]);

  useEffect(() => {
    itemRef.current = item;
  });

  useEffect(() => {
    if (!item.exerciseId) {
      setRecentSessions([]);
      prefilledExerciseRef.current = null;
      return;
    }

    let cancelled = false;
    setLoadingRecent(true);

    getRecentExerciseSessions(item.exerciseId, 2)
      .then((data) => {
        if (cancelled) return;

        setRecentSessions(data);

        if (prefilledExerciseRef.current === item.exerciseId) return;

        const current = itemRef.current;
        if (current.exerciseId !== item.exerciseId) return;

        const hasReps = current.sets.some((set) => set.reps !== "");
        if (hasReps) {
          prefilledExerciseRef.current = item.exerciseId;
          return;
        }

        const latestSession = data[0];
        const topSets = latestSession ? selectTopSets(latestSession.sets, 2) : [];
        if (topSets.length === 0) {
          prefilledExerciseRef.current = item.exerciseId;
          const hasWeights = current.sets.some((set) => set.weight !== "");
          if (hasWeights) {
            onChange(index, {
              ...current,
              sets: current.sets.map(() => ({ weight: "", reps: "" })),
            });
          }
          return;
        }

        const nextSets = topSets.map((set) => ({
          weight: String(set.weight),
          reps: "",
        }));

        while (nextSets.length < current.sets.length) {
          nextSets.push({ weight: "", reps: "" });
        }

        prefilledExerciseRef.current = item.exerciseId;
        onChange(index, { ...current, sets: nextSets });
      })
      .catch((error) => {
        if (cancelled) return;
        setRecentSessions([]);
        showToast(error.message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingRecent(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item.exerciseId, showToast]);

  useEffect(() => {
    const exerciseChanged = prevExerciseIdRef.current !== item.exerciseId;
    prevExerciseIdRef.current = item.exerciseId;

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

   if (restEnabled && restRemaining === null) startRest(restDuration);
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

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {}
    }

    input.focus();
    input.click();
  }

  function handleMuscleGroupChange(value) {
    const hasFilledSets = item.sets.some(
      (set) => set.weight !== "" && set.reps !== ""
    );

    if (!hasFilledSets) {
      setSelectedMuscleGroup(value);
      onChange(index, { ...item, exerciseId: "" });
      return;
    }

    const currentName = exercises.find((exercise) => exercise.id === item.exerciseId)?.name ?? "el ejercicio seleccionado";
    setConfirmModal({
      type: "group",
      nextValue: value,
      currentName,
      onSave: () => {
        onSaveAndSwitchExercise?.("");
        setSelectedMuscleGroup(value);
      },
      onDiscard: () => {
        setSelectedMuscleGroup(value);
        onChange(index, { ...item, exerciseId: "", sets: [{ weight: "", reps: "" }] });
      },
    });
  }

  function handleExerciseSelectChange(nextExerciseId) {
    if (nextExerciseId === item.exerciseId) return;

    const hasFilledSets = item.sets.some(
      (set) => set.weight !== "" && set.reps !== ""
    );

    if (!hasFilledSets) {
      onChange(index, { ...item, exerciseId: nextExerciseId });
      return;
    }

    const currentName = exercises.find((exercise) => exercise.id === item.exerciseId)?.name ?? "el ejercicio seleccionado";
    setConfirmModal({
      type: "exercise",
      nextValue: nextExerciseId,
      currentName,
      onSave: () => onSaveAndSwitchExercise?.(nextExerciseId),
      onDiscard: () => onChange(index, { ...item, exerciseId: nextExerciseId, sets: [{ weight: "", reps: "" }] }),
    });
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

  const formattedWorkoutDate = workoutDate ? formatDisplayDate(workoutDate) : "sin fecha";

  return (
    <>
      <section className="card exercise-card">
      <div className="exercise-header">
        <div>
          <h2>Entreno</h2>
        </div>
        <div className="item-actions">
          {onGoToExercises && (
            <button
              type="button"
              className="exercise-tool-button exercise-tool-button-yellow"
              onClick={onGoToExercises}
              title="Ejercicios"
              aria-label="Ir a ejercicios"
            >
              <ListPlus size={18} />
            </button>
          )}
          {workoutDate && onWorkoutDateChange && (
            <span className="date-tool">
              <button
                type="button"
                className="exercise-tool-button exercise-tool-button-blue"
                onClick={openDatePicker}
                title={`Fecha del entrenamiento: ${formattedWorkoutDate}`}
                aria-label={`Cambiar fecha del entrenamiento: ${formattedWorkoutDate}`}
              >
                <CalendarDays size={18} />
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={workoutDate}
                onChange={(event) => onWorkoutDateChange(event.target.value)}
                className="date-picker-input"
                tabIndex={-1}
                aria-hidden="true"
              />
            </span>
          )}
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
            onChange={(e) => handleExerciseSelectChange(e.target.value)}
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

      {loadingRecent && (
        <div className="last-performance">
          <strong>Cargando últimas marcas...</strong>
        </div>
      )}

      {!loadingRecent && item.exerciseId && recentSessions.length === 0 && (
        <div className="recent-sessions recent-sessions-empty">
          <span>No hay registro</span>
        </div>
      )}

      {!loadingRecent && recentSessions.length > 0 && (
        <div className="recent-sessions">
          {recentSessions.map((session, index) => (
            <div
              className={`recent-session${index === 0 ? " recent-session-latest" : ""}`}
              key={session.date}
            >
              <div className="recent-session-header">
                <span className="recent-session-date">
                  {index === 0 ? "Último día" : formatDisplayDate(session.date)}
                </span>
                {session.position && (
                  <span className="recent-session-order">
                    {formatOrdinal(session.position.session)}/{session.position.sessionTotal}
                    {" · "}
                    {formatOrdinal(session.position.group)}/{session.position.groupTotal}
                  </span>
                )}
              </div>
              <div className="recent-session-sets">
                {selectTopSets(session.sets).map((set, setIndex) => (
                  <span key={setIndex}>{formatSet(set, setIndex)}</span>
                ))}
              </div>
            </div>
          ))}
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

    {confirmModal && (
      <ConfirmDialog
        open={true}
        onClose={() => setConfirmModal(null)}
        title="Series sin guardar"
        message={`¿Quieres guardar estas series en "${confirmModal.currentName}"?`}
        actions={[
          {
            label: "Guardar y cambiar",
            variant: "success",
            onClick: confirmModal.onSave,
          },
          {
            label: `Descartar y cambiar${confirmModal.type === "group" ? " de grupo" : " de ejercicio"}`,
            variant: "danger",
            onClick: confirmModal.onDiscard,
          },
          {
            label: "Cancelar",
            variant: "warning",
            onClick: () => {},
          },
        ]}
      />
    )}
    </>
  );
}
