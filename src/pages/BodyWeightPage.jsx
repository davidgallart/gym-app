import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit3, Save, Trash2, TrendingDown, TrendingUp, Minus, X } from "lucide-react";
import { useToast } from "../components/ToastProvider";
import { deleteBodyWeight, getBodyWeightLogs, saveBodyWeight, updateBodyWeight } from "../services/bodyWeightService";

const WEIGHT_LOGS_PER_PAGE = 10;
const WEEKLY_AVERAGES_PER_PAGE = 5;

function getToday() {
  return toIsoDate(new Date());
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(dateString) {
  return parseLocalDate(dateString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOf(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function buildWeeklyAverages(logs) {
  const grouped = new Map();
  const today = parseLocalDate(getToday());
  const todayIso = toIsoDate(today);

  for (const log of logs) {
    const monday = mondayOf(parseLocalDate(log.weight_date));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const key = toIsoDate(monday);
    const current = grouped.get(key) ?? {
      weekStart: key,
      weekEnd: toIsoDate(sunday),
      weights: [],
      dates: [],
    };

    current.weights.push(Number(log.weight));
    current.dates.push(log.weight_date);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((week) => {
      const avg = week.weights.reduce((sum, value) => sum + value, 0) / week.weights.length;
      const weekEndDate = parseLocalDate(week.weekEnd);
      const isCurrentWeek = week.weekStart === toIsoDate(mondayOf(today));
      const hasSundayLog = week.dates.includes(week.weekEnd);

      // Una semana se considera cerrada si ya ha pasado el domingo.
      // Si hoy es domingo, se considera cerrada en cuanto exista el peso de ese domingo.
      const isCompleted = today > weekEndDate || (todayIso === week.weekEnd && hasSundayLog);

      return {
        ...week,
        average: Number(avg.toFixed(2)),
        count: week.weights.length,
        label: `${formatDate(week.weekStart)} - ${formatDate(week.weekEnd)}`,
        isCurrentWeek,
        isCompleted,
        isProvisional: !isCompleted,
      };
    })
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function formatDiff(value) {
  if (value === null || value === undefined) return "Sin datos";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} kg`;
}

function TrendBadge({ value }) {
  if (value === null || value === undefined) {
    return <span className="trend-badge neutral"><Minus size={16} /> Sin datos</span>;
  }

  if (value < 0) {
    return <span className="trend-badge down"><TrendingDown size={16} /> {formatDiff(value)}</span>;
  }

  if (value > 0) {
    return <span className="trend-badge up"><TrendingUp size={16} /> {formatDiff(value)}</span>;
  }

  return <span className="trend-badge neutral"><Minus size={16} /> {formatDiff(value)}</span>;
}

const WeeklyWeightChart = lazy(() => import("../components/charts/WeeklyWeightChart"));

export default function BodyWeightPage() {
  const [logs, setLogs] = useState([]);
  const [weightDate, setWeightDate] = useState(getToday());
  const [weight, setWeight] = useState("");
  const [editingLogId, setEditingLogId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weightLogsPage, setWeightLogsPage] = useState(1);
  const [weeklyAveragesPage, setWeeklyAveragesPage] = useState(1);
  const { showToast } = useToast();

  const sortedLogs = useMemo(() => {
    return logs.slice().sort((a, b) => b.weight_date.localeCompare(a.weight_date));
  }, [logs]);
  const totalWeightLogPages = Math.max(1, Math.ceil(sortedLogs.length / WEIGHT_LOGS_PER_PAGE));
  const paginatedWeightLogs = useMemo(() => {
    const start = (weightLogsPage - 1) * WEIGHT_LOGS_PER_PAGE;
    return sortedLogs.slice(start, start + WEIGHT_LOGS_PER_PAGE);
  }, [sortedLogs, weightLogsPage]);

  const weeklyAverages = useMemo(() => buildWeeklyAverages(logs), [logs]);
  const sortedWeeklyAverages = useMemo(() => {
    return weeklyAverages.slice().sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }, [weeklyAverages]);
  const totalWeeklyAveragePages = Math.max(1, Math.ceil(sortedWeeklyAverages.length / WEEKLY_AVERAGES_PER_PAGE));
  const paginatedWeeklyAverages = useMemo(() => {
    const start = (weeklyAveragesPage - 1) * WEEKLY_AVERAGES_PER_PAGE;
    return sortedWeeklyAverages.slice(start, start + WEEKLY_AVERAGES_PER_PAGE);
  }, [sortedWeeklyAverages, weeklyAveragesPage]);
  const completedWeeks = useMemo(() => weeklyAverages.filter((week) => week.isCompleted), [weeklyAverages]);
  const provisionalWeek = weeklyAverages.find((week) => week.isProvisional) ?? null;

  const lastCompletedWeek = completedWeeks[completedWeeks.length - 1] ?? null;
  const previousCompletedWeek = completedWeeks[completedWeeks.length - 2] ?? null;
  const weekDiff = lastCompletedWeek && previousCompletedWeek
    ? Number((lastCompletedWeek.average - previousCompletedWeek.average).toFixed(2))
    : null;

  const monthDiff = completedWeeks.length >= 4
    ? Number((completedWeeks[completedWeeks.length - 1].average - completedWeeks[completedWeeks.length - 4].average).toFixed(2))
    : null;

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (weightLogsPage > totalWeightLogPages) {
      setWeightLogsPage(totalWeightLogPages);
    }
  }, [weightLogsPage, totalWeightLogPages]);

  useEffect(() => {
    if (weeklyAveragesPage > totalWeeklyAveragePages) {
      setWeeklyAveragesPage(totalWeeklyAveragePages);
    }
  }, [weeklyAveragesPage, totalWeeklyAveragePages]);

  async function loadLogs() {
    try {
      setLoading(true);
      const data = await getBodyWeightLogs();
      setLogs(data);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingLogId(null);
    setWeightDate(getToday());
    setWeight("");
  }

  function startEdit(log) {
    setEditingLogId(log.id);
    setWeightDate(log.weight_date);
    setWeight(String(Number(log.weight)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(e) {
    e.preventDefault();

    try {
      setSaving(true);
      if (editingLogId) {
        await updateBodyWeight(editingLogId, { weightDate, weight });
        showToast("Peso actualizado", "success");
      } else {
        await saveBodyWeight({ weightDate, weight });
        showToast("Peso guardado", "success");
      }
      resetForm();
      await loadLogs();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(logId) {
    const confirmed = window.confirm("¿Borrar este registro de peso?");
    if (!confirmed) return;

    try {
      await deleteBodyWeight(logId);
      if (editingLogId === logId) resetForm();
      showToast("Registro borrado", "success");
      await loadLogs();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  return (
    <div className="page">
      <section className="hero-card compact-hero">
        <div>
          <h2>Peso corporal</h2>
        </div>
      </section>

      <section className="card">
        <h3>{editingLogId ? "Modificar peso" : "Apuntar peso diario"}</h3>
        <form className="inline-form bodyweight-form" onSubmit={handleSave}>
          <label>
            Fecha
            <input type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value)} />
          </label>
          <label>
            Peso
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="Ej: 68.4"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          <div className="form-actions-row">
            {editingLogId && (
              <button type="button" className="secondary-button" onClick={resetForm}>
                <X size={18} /> Cancelar
              </button>
            )}
            <button className="primary-button" disabled={saving}>
              <Save size={18} /> {saving ? "Guardando..." : editingLogId ? "Actualizar" : "Guardar"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h3>Progreso por medias semanales</h3>
        <div className="weight-summary-grid">
          <div className="summary-box">
            <span>Última media cerrada</span>
            <strong>{lastCompletedWeek ? `${lastCompletedWeek.average} kg` : "Sin datos"}</strong>
            {lastCompletedWeek && lastCompletedWeek.count < 4 && (
              <small>Faltan datos: menos de 4 registros en esa semana.</small>
            )}
            {provisionalWeek && (
              <small className="provisional-note">Semana actual provisional: {provisionalWeek.average} kg</small>
            )}
          </div>
          <div className="summary-box">
            <span>Cambio semanal</span>
            <strong><TrendBadge value={weekDiff} /></strong>
          </div>
          <div className="summary-box">
            <span>Cambio aprox. mensual</span>
            <strong><TrendBadge value={monthDiff} /></strong>
          </div>
        </div>

        {weeklyAverages.length === 0 ? (
          <p className="empty">Todavía no hay pesos registrados.</p>
        ) : (
          <>
            <div className="weekly-list">
              {paginatedWeeklyAverages.map((week) => (
                <div className="weekly-row" key={week.weekStart}>
                  <div>
                    <strong>{week.label}</strong>
                    <span>{week.count} registros{week.isProvisional ? " · provisional" : ""}</span>
                    {week.isProvisional && <em>Semana actual: todavía no se usa para la última media ni para el cambio semanal.</em>}
                    {week.count < 4 && <em>Faltan datos para mejorar la precisión.</em>}
                  </div>
                  <b>{week.average} kg</b>
                </div>
              ))}
            </div>

            {sortedWeeklyAverages.length > WEEKLY_AVERAGES_PER_PAGE && (
              <div className="pagination-controls" aria-label="Paginación medias semanales">
                <button
                  className="secondary-button small-button"
                  onClick={() => setWeeklyAveragesPage((page) => Math.max(1, page - 1))}
                  disabled={weeklyAveragesPage === 1}
                >
                  <ChevronLeft size={16} /> Anterior
                </button>
                <span>Página {weeklyAveragesPage} de {totalWeeklyAveragePages}</span>
                <button
                  className="secondary-button small-button"
                  onClick={() => setWeeklyAveragesPage((page) => Math.min(totalWeeklyAveragePages, page + 1))}
                  disabled={weeklyAveragesPage === totalWeeklyAveragePages}
                >
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card chart-card">
        <h3>Gráfica de medias</h3>
        <div className="chart-legend-note">
          <span><i className="legend-dot final"></i>Semana cerrada</span>
          <span><i className="legend-dot provisional"></i>Semana actual provisional</span>
        </div>
        {weeklyAverages.length === 0 ? (
          <p className="empty">Guarda pesos diarios para ver la evolución semanal.</p>
        ) : (
          <Suspense fallback={<p className="empty">Cargando gráfica...</p>}>
            <WeeklyWeightChart data={weeklyAverages} />
          </Suspense>
        )}
      </section>

      <section className="card">
        <h3>Datos registrados</h3>
        {logs.length === 0 ? (
          <p className="empty">Todavía no has registrado ningún peso.</p>
        ) : (
          <>
          <div className="weight-log-list">
            {paginatedWeightLogs.map((log) => (
              <div className="weight-log-row" key={log.id}>
                <div>
                  <strong>{formatDate(log.weight_date)}</strong>
                  <span>{Number(log.weight)} kg</span>
                </div>
                <div className="item-actions">
                  <button className="secondary-button small-button" onClick={() => startEdit(log)}>
                    <Edit3 size={16} /> Editar
                  </button>
                  <button className="danger-icon" onClick={() => handleDelete(log.id)} aria-label="Borrar peso">
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {sortedLogs.length > WEIGHT_LOGS_PER_PAGE && (
            <div className="pagination-controls" aria-label="Paginación pesos registrados">
              <button
                className="secondary-button small-button"
                onClick={() => setWeightLogsPage((page) => Math.max(1, page - 1))}
                disabled={weightLogsPage === 1}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <span>Página {weightLogsPage} de {totalWeightLogPages}</span>
              <button
                className="secondary-button small-button"
                onClick={() => setWeightLogsPage((page) => Math.min(totalWeightLogPages, page + 1))}
                disabled={weightLogsPage === totalWeightLogPages}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          )}
          </>
        )}
      </section>
    </div>
  );
}
