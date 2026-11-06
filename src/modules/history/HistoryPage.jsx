import React from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Edit3, Save, Trash2, X } from "lucide-react";
import { deleteWorkoutExercise, getWorkoutHistoryPage, swapWorkoutExerciseOrder, updateWorkoutExercise } from "../../shared/api/workoutService";
import { useToast } from "../../shared/components/ToastProvider";
import ConfirmDialog from "../../shared/components/ConfirmDialog";
import { formatDisplayDate } from "../../shared/lib/date";
import "../../styles/modules/history.css";

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
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [editingExerciseId, setEditingExerciseId] = useState(null);
  const [editExerciseState, setEditExerciseState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [totalHistory, setTotalHistory] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingMove, setPendingMove] = useState(null);
  const { showToast } = useToast();

  const groupedHistory = useMemo(() => groupHistoryByDate(history), [history]);
  const totalHistoryPages = Math.max(1, Math.ceil(totalHistory / HISTORY_ITEMS_PER_PAGE));

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setLoading(true);
        setHistory([]);

        const { workouts, total } = await getWorkoutHistoryPage({
          limit: HISTORY_ITEMS_PER_PAGE,
          offset: (historyPage - 1) * HISTORY_ITEMS_PER_PAGE,
        });

        if (cancelled) return;

        const nextTotalPages = Math.max(1, Math.ceil(total / HISTORY_ITEMS_PER_PAGE));
        setTotalHistory(total);

        if (historyPage > nextTotalPages) {
          setHistoryPage(nextTotalPages);
          return;
        }

        setHistory(workouts);
      } catch (error) {
        if (cancelled) return;
        showToast(error.message, "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [historyPage, reloadKey, showToast]);

  function reloadHistory() {
    setReloadKey((current) => current + 1);
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
      reloadHistory();
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
      reloadHistory();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  function handleMoveExercise(group, itemIndex, direction) {
    const targetIndex = itemIndex + direction;
    if (targetIndex < 0 || targetIndex >= group.exercises.length) return;

    const item = group.exercises[itemIndex];
    const target = group.exercises[targetIndex];

    setPendingMove({
      item,
      target,
      itemName: item.exercises?.name ?? "este ejercicio",
      position: targetIndex + 1,
    });
  }

  async function handleConfirmMove() {
    if (!pendingMove) return;

    const { item, target } = pendingMove;
    setPendingMove(null);

    try {
      await swapWorkoutExerciseOrder(item.id, item.exercise_order, target.id, target.exercise_order);
      showToast("Orden actualizado", "success");
      reloadHistory();
    } catch (error) {
      showToast(error.message, "error");
      reloadHistory();
    }
  }

  return (
    <div className="page">
      <section className="hero-card compact-hero">
        <div>
          <h2>Historial</h2>
        </div>
      </section>

      {loading && <p className="empty">Cargando historial...</p>}

      {!loading && groupedHistory.length === 0 && (
        <p className="empty">Todavía no tienes entrenamientos guardados.</p>
      )}

      {!loading && groupedHistory.map((group) => (
        <section className="card history-card" key={group.date}>
          <div className="history-card-header">
            <div>
              <h3>{formatDisplayDate(group.date)}</h3>
              <p>{group.exercises.length} ejercicios</p>
            </div>
          </div>

          <div className="history-list">
            {group.exercises.map((item, itemIndex) => {
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
                          <button className="primary-button success-button small-button" onClick={handleSaveExerciseEdit}>
                            <Save size={16} /> Guardar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="move-icon"
                            onClick={() => handleMoveExercise(group, itemIndex, -1)}
                            disabled={itemIndex === 0}
                            aria-label="Subir ejercicio"
                            title="Subir ejercicio"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            className="move-icon"
                            onClick={() => handleMoveExercise(group, itemIndex, 1)}
                            disabled={itemIndex === group.exercises.length - 1}
                            aria-label="Bajar ejercicio"
                            title="Bajar ejercicio"
                          >
                            <ChevronDown size={16} />
                          </button>
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
                            Serie {set.set_number}: {Number(set.weight)}Kg x {set.reps}
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


      {!loading && totalHistoryPages > 1 && (
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

      {pendingMove && (
        <ConfirmDialog
          open={true}
          onClose={() => setPendingMove(null)}
          title="Guardar nuevo orden"
          message={`¿Guardar el nuevo orden? "${pendingMove.itemName}" pasará a la posición ${pendingMove.position} de la sesión.`}
          actions={[
            { label: "Guardar", variant: "success", onClick: handleConfirmMove },
            { label: "Cancelar", variant: "warning", onClick: () => {} },
          ]}
        />
      )}
    </div>
  );
}
