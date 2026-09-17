import React, { useEffect, useState } from "react";
import { ArrowLeft, Dumbbell, Plus, RefreshCw, Trash2 } from "lucide-react";
import { createExercise, deleteExercise, getExercises, updateExercise } from "../services/exerciseService";
import { useToast } from "../components/ToastProvider";

export default function ExercisesPage({ onBackToWorkout }) {
  const [exercises, setExercises] = useState([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newMuscleGroup, setNewMuscleGroup] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editMuscleGroup, setEditMuscleGroup] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadExercises();
  }, []);

  async function loadExercises() {
    try {
      setLoading(true);
      const data = await getExercises();
      setExercises(data);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateExercise(e) {
    e.preventDefault();
    if (!newExerciseName.trim()) {
      showToast("Escribe el nombre del ejercicio", "error");
      return;
    }

    try {
      const created = await createExercise({ name: newExerciseName, muscleGroup: newMuscleGroup });
      setExercises((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewExerciseName("");
      setNewMuscleGroup("");
      showToast("Ejercicio creado", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function startEdit(exercise) {
    setEditingId(exercise.id);
    setEditName(exercise.name ?? "");
    setEditMuscleGroup(exercise.muscle_group ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditMuscleGroup("");
  }

  async function handleUpdateExercise(exerciseId) {
    if (!editName.trim()) {
      showToast("El nombre no puede estar vacío", "error");
      return;
    }

    try {
      const updated = await updateExercise(exerciseId, { name: editName, muscleGroup: editMuscleGroup });
      setExercises((current) => current.map((exercise) => (exercise.id === exerciseId ? updated : exercise)).sort((a, b) => a.name.localeCompare(b.name)));
      cancelEdit();
      showToast("Ejercicio actualizado", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleDeleteExercise(exerciseId) {
    const confirmed = window.confirm("¿Borrar este ejercicio? Si ya lo usaste en entrenos antiguos, Supabase puede bloquearlo por estar relacionado.");
    if (!confirmed) return;

    try {
      await deleteExercise(exerciseId);
      setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
      showToast("Ejercicio borrado", "success");
    } catch (error) {
      showToast("No se ha podido borrar. Puede tener entrenos asociados.", "error");
    }
  }

  return (
    <div className="page">
      <section className="hero-card compact-hero">
        <div className="hero-title-row">
          <div>
            <h2>Ejercicios</h2>
          </div>
          <div className="item-actions">
            {onBackToWorkout && (
              <button className="secondary-button small-button" onClick={onBackToWorkout}>
                <ArrowLeft size={16} /> Volver
              </button>
            )}
            <Dumbbell size={28} />
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Nuevo ejercicio</h3>
        <form className="inline-form" onSubmit={handleCreateExercise}>
          <input placeholder="Ej: Press banca" value={newExerciseName} onChange={(e) => setNewExerciseName(e.target.value)} />
          <input placeholder="Grupo muscular, opcional" value={newMuscleGroup} onChange={(e) => setNewMuscleGroup(e.target.value)} />
          <button className="primary-button"><Plus size={18} /> Crear</button>
        </form>
      </section>

      <section className="card">
        <div className="section-header-row">
          <div>
            <h3>Mis ejercicios</h3>
            <p>{exercises.length} ejercicios guardados</p>
          </div>
          <button className="icon-button" onClick={loadExercises} disabled={loading} aria-label="Actualizar">
            <RefreshCw size={18} />
          </button>
        </div>

        {exercises.length === 0 ? (
          <p className="empty">Todavía no tienes ejercicios creados.</p>
        ) : (
          <div className="exercise-list">
            {exercises.map((exercise) => (
              <div className="exercise-list-item" key={exercise.id}>
                {editingId === exercise.id ? (
                  <div className="edit-block">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <input value={editMuscleGroup} onChange={(e) => setEditMuscleGroup(e.target.value)} placeholder="Grupo muscular" />
                    <div className="split-actions">
                      <button className="secondary-button" type="button" onClick={cancelEdit}>Cancelar</button>
                      <button className="primary-button" type="button" onClick={() => handleUpdateExercise(exercise.id)}>Guardar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <strong>{exercise.name}</strong>
                      <span>{exercise.muscle_group || "Sin grupo muscular"}</span>
                    </div>
                    <div className="item-actions">
                      <button className="secondary-button small-button" onClick={() => startEdit(exercise)}>Editar</button>
                      <button className="danger-icon" onClick={() => handleDeleteExercise(exercise.id)} aria-label="Borrar ejercicio">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
