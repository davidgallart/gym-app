import React from "react";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getExercisePerformanceSummary } from "../services/exerciseService";
import { useToast } from "./ToastProvider";

const NO_GROUP_VALUE = "__NO_GROUP__";
const NO_GROUP_LABEL = "Sin grupo muscular";

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
        <button className="danger-icon" onClick={() => onRemove(index)} title={singleMode ? "Limpiar ejercicio" : "Eliminar ejercicio"}>
          <Trash2 size={18} />
        </button>
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
            <input type="number" inputMode="decimal" placeholder="Kg" value={set.weight} onChange={(e) => updateSet(setIndex, "weight", e.target.value)} />
            <input type="number" inputMode="numeric" placeholder="Reps" value={set.reps} onChange={(e) => updateSet(setIndex, "reps", e.target.value)} />
          </div>
        ))}
      </div>

      <button className="secondary-button full-width-button" onClick={addSet}>
        <Plus size={18} /> Añadir serie
      </button>
    </section>
  );
}
