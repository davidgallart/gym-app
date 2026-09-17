import React, { Suspense, lazy } from "react";
import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { getExercises } from "../services/exerciseService";
import { getExerciseProgress } from "../services/workoutService";

const ProgressLineChart = lazy(() => import("../components/charts/ProgressLineChart"));

const NO_GROUP_VALUE = "__NO_GROUP__";
const NO_GROUP_LABEL = "Sin grupo muscular";

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
  const [progress, setProgress] = useState([]);
  const [message, setMessage] = useState("");

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
      setProgress([]);
      return;
    }

    const firstExercise = exercises.find((exercise) => getGroupValue(exercise) === selectedMuscleGroup);
    setSelectedExerciseId(firstExercise?.id ?? "");
  }, [selectedMuscleGroup, exercises]);

  useEffect(() => {
    if (!selectedExerciseId) {
      setProgress([]);
      return;
    }

    getExerciseProgress(selectedExerciseId)
      .then((data) => {
        setProgress(data);
        setMessage("");
      })
      .catch((error) => setMessage(error.message));
  }, [selectedExerciseId]);

  return (
    <div className="page">
      <section className="hero-card">
        <div className="section-header-row">
          <h2>Graficas de Progreso</h2>
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
              onChange={(e) => setSelectedExerciseId(e.target.value)}
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

      <section className="card chart-card">
        <h3>Peso máximo</h3>
        {progress.length === 0 ? (
          <p className="empty">No hay datos suficientes todavía.</p>
        ) : (
          <Suspense fallback={<p className="empty">Cargando gráfica...</p>}>
            <ProgressLineChart data={progress} dataKey="maxWeight" name="Peso máximo" />
          </Suspense>
        )}
      </section>

      <section className="card chart-card">
        <h3>Volumen estimado</h3>
        {progress.length === 0 ? (
          <p className="empty">No hay datos suficientes todavía.</p>
        ) : (
          <Suspense fallback={<p className="empty">Cargando gráfica...</p>}>
            <ProgressLineChart data={progress} dataKey="totalVolume" name="Volumen" />
          </Suspense>
        )}
      </section>
    </div>
  );
}
