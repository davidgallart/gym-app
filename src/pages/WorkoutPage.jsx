import React from "react";
import { useEffect, useRef, useState } from "react";
import { ListPlus, Save } from "lucide-react";
import ExerciseRow from "../components/ExerciseRow";
import { useToast } from "../components/ToastProvider";
import { getExercises } from "../services/exerciseService";
import { saveWorkout } from "../services/workoutService";

const DRAFT_KEY = "gym-current-exercise-draft";
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

function emptyExercise() {
  return {
    exerciseId: "",
    sets: [
      { weight: "", reps: "" },
    ],
  };
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function loadDraft() {
  try {
    const rawDraft = localStorage.getItem(DRAFT_KEY);
    if (!rawDraft) return null;

    const draft = JSON.parse(rawDraft);
    const isExpired = Date.now() - Number(draft.savedAt ?? 0) > DRAFT_TTL_MS;

    if (isExpired) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }

    return draft;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

function saveDraft(workoutDate, exercise) {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      savedAt: Date.now(),
      workoutDate,
      exercise,
    })
  );
}

export default function WorkoutPage({ onGoToExercises }) {
  const draft = loadDraft();
  const [exercises, setExercises] = useState([]);
  const [workoutDate, setWorkoutDate] = useState(draft?.workoutDate || getToday());
  const [currentExercise, setCurrentExercise] = useState(draft?.exercise || emptyExercise());
  const [saving, setSaving] = useState(false);
  const firstDraftWrite = useRef(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    if (firstDraftWrite.current) {
      firstDraftWrite.current = false;
      return;
    }

    saveDraft(workoutDate, currentExercise);
  }, [workoutDate, currentExercise]);

  async function loadExercises() {
    try {
      const data = await getExercises();
      setExercises(data);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function updateExercise(_index, value) {
    setCurrentExercise(value);
  }

  function resetCurrentExercise() {
    setCurrentExercise(emptyExercise());
    localStorage.removeItem(DRAFT_KEY);
  }

  async function handleSaveWorkout() {
    setSaving(true);

    try {
      await saveWorkout({ workoutDate, exercises: [currentExercise] });
      resetCurrentExercise();
      showToast("Ejercicio guardado en el entrenamiento de hoy", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <section className="hero-card compact-hero">
        <div className="section-header-row">
          <div>
            <h2>Nuevo ejercicio</h2>
          </div>
          <button className="secondary-button small-button" onClick={onGoToExercises}>
            <ListPlus size={16} /> Ejercicios
          </button>
        </div>
        <label>
          Fecha
          <input type="date" value={workoutDate} onChange={(e) => setWorkoutDate(e.target.value)} />
        </label>
      </section>

      {exercises.length === 0 && (
        <section className="card empty-workout-card">
          <h3>No tienes ejercicios</h3>
          <p>Primero crea al menos un ejercicio para poder registrar un entreno.</p>
          <button className="primary-button full-width-button" onClick={onGoToExercises}>
            <ListPlus size={18} /> Ir a ejercicios
          </button>
        </section>
      )}

      {exercises.length > 0 && (
        <ExerciseRow
          index={0}
          item={currentExercise}
          exercises={exercises}
          onChange={updateExercise}
          onRemove={resetCurrentExercise}
          singleMode
        />
      )}

      <div className="sticky-save-bar sticky-save-bar-single">
        
        <button className="btn primary-button save-button-full" onClick={handleSaveWorkout} disabled={saving || exercises.length === 0}>
          <Save size={18} /> {saving ? "Guardando..." : "Guardar ejercicio"}
        </button>
      </div>
    </div>
  );
}
