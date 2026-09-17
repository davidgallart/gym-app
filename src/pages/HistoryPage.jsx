import React from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit3, Save, Trash2, X } from "lucide-react";
import { deleteWorkoutExercise, getWorkoutHistory, updateWorkoutExercise } from "../services/workoutService";
import { useToast } from "../components/ToastProvider";

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-ES");
}

function buildExerciseEditState(item) {
  return {
    workoutExerciseId: item.id,
    name: item.exercises?.name ?? "Ejercicio",
    sets: (item.workout_sets ?? [])
      .sort((a, b) => a.set_number - b.set_number)
      .map((set) => ({
        id: set.id,
        set_number: set.set_number,
        reps: String(set.reps ?? ""),
        weight: String(set.weight ?? ""),
      })),
  };
}

const HISTORY_ITEMS_PER_PAGE = 5;

function groupHistoryByDate(history) {
  const grouped = new Map();

  for (const workout of history) {
    const date = workout.workout_date;
    const current = grouped.get(date) ?? {
      date,
      exercises: [],
    };

    for (const item of workout.workout_exercises ?? []) {
      current.exercises.push({
        ...item,
        workoutId: workout.id,
        workoutCreatedAt: workout.created_at,
      });
    }

    grouped.set(date, current);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      exercises: group.exercises.sort((a, b) => {
        const createdA = new Date(a.workoutCreatedAt ?? 0).getTime();
        const createdB = new Date(b.workoutCreatedAt ?? 0).getTime();
        if (createdA !== createdB) return createdA - createdB;
        return (a.exercise_order ?? 0) - (b.exercise_order ?? 0);
      }),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [editingExerciseId, setEditingExerciseId] = useState(null);
  const [editExerciseState, setEditExerciseState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const { showToast } = useToast();

  const groupedHistory = useMemo(() => groupHistoryByDate(history), [history]);
  const totalHistoryPages = Math.max(1, Math.ceil(groupedHistory.length / HISTORY_ITEMS_PER_PAGE));
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_ITEMS_PER_PAGE;
    return groupedHistory.slice(start, start + HISTORY_ITEMS_PER_PAGE);
  }, [groupedHistory, historyPage]);

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyPage, totalHistoryPages]);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      const data = await getWorkoutHistory();
      setHistory(data);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function startEditExercise(item) {
    setEditingExerciseId(item.id);
    setEditExerciseState(buildExerciseEditState(item));
  }

  function cancelEdit() {
    setEditingExerciseId(null);
    setEditExerciseState(null);
  }

  function updateSet(setIndex, field, value) {
    setEditExerciseState((current) => ({
      ...current,
      sets: current.sets.map((set, index) => (index === setIndex ? { ...set, [field]: value } : set)),
    }));
  }

  async function handleSaveExerciseEdit() {
    if (!editingExerciseId || !editExerciseState) return;

    try {
      await updateWorkoutExercise(editingExerciseId, editExerciseState.sets);
      showToast("Ejercicio actualizado", "success");
      cancelEdit();
      await loadHistory();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function handleDeleteExercise(item) {
    const confirmed = window.confirm(`¿Borrar ${item.exercises?.name ?? "este ejercicio"} del historial?`);
    if (!confirmed) return;

    try {
      await deleteWorkoutExercise(item.id);
      showToast("Ejercicio borrado", "success");
      if (editingExerciseId === item.id) cancelEdit();
      await loadHistory();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  return (
    <div className="page">
      <section className="hero-card compact-hero">
        <div>
          <h2>Historial</h2>
        </div>
      </section>

      {groupedHistory.length === 0 && <p className="empty">Todavía no tienes entrenamientos guardados.</p>}

      {paginatedHistory.map((group) => (
        <section className="card history-card" key={group.date}>
          <div className="history-card-header">
            <div>
              <h3>{formatDate(group.date)}</h3>
              <p>{group.exercises.length} ejercicios</p>
            </div>
          </div>

          <div className="history-list">
            {group.exercises.map((item) => {
              const isEditing = editingExerciseId === item.id;

              return (
                <div className="history-item history-item-editable" key={item.id}>
                  <div className="history-item-top">
                    <strong>{item.exercises?.name}</strong>
                    <div className="item-actions">
                      {isEditing ? (
                        <>
                          <button className="secondary-button small-button" onClick={cancelEdit}>
                            <X size={16} /> Cancelar
                          </button>
                          <button className="primary-button small-button" onClick={handleSaveExerciseEdit}>
                            <Save size={16} /> Guardar
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="secondary-button small-button" onClick={() => startEditExercise(item)}>
                            <Edit3 size={16} /> Editar
                          </button>
                          <button className="danger-icon" onClick={() => handleDeleteExercise(item)} aria-label="Borrar ejercicio">
                            <Trash2 size={17} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing && editExerciseState ? (
                    <div className="edit-exercise-sets">
                      {editExerciseState.sets.map((set, setIndex) => (
                        <div className="edit-set-row" key={set.id}>
                          <span>Serie {set.set_number}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={set.weight}
                            onChange={(e) => updateSet(setIndex, "weight", e.target.value)}
                            placeholder="Kg"
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            value={set.reps}
                            onChange={(e) => updateSet(setIndex, "reps", e.target.value)}
                            placeholder="Reps"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {(item.workout_sets ?? [])
                        .sort((a, b) => a.set_number - b.set_number)
                        .map((set) => (
                          <span key={set.id}>
                            Serie {set.set_number}: {Number(set.weight)} kg x {set.reps}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}


      {groupedHistory.length > HISTORY_ITEMS_PER_PAGE && (
        <div className="pagination-controls" aria-label="Paginación historial">
          <button
            className="secondary-button small-button"
            onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
            disabled={historyPage === 1}
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <span>Página {historyPage} de {totalHistoryPages}</span>
          <button
            className="secondary-button small-button"
            onClick={() => setHistoryPage((page) => Math.min(totalHistoryPages, page + 1))}
            disabled={historyPage === totalHistoryPages}
          >
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
