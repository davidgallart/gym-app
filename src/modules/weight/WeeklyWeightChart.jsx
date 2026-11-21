import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDisplayDate, parseIsoDate } from "../../shared/lib/date";

function buildTickValues(points, yearMarkers, target = 4) {
  const count = points.length;
  if (count === 0) return [];
  if (count <= target) return points.map((point) => point.weekStart);

  const markerIndices = [];
  points.forEach((point, index) => {
    if (yearMarkers.has(point.weekStart)) markerIndices.push(index);
  });

  const indices = new Set(markerIndices);
  const slots = Math.max(0, target - markerIndices.length);

  for (let slot = 0; slot < slots; slot += 1) {
    const index = slots === 1
      ? Math.floor((count - 1) / 2)
      : Math.round((slot * (count - 1)) / (slots - 1));
    indices.add(index);
  }

  return [...indices].sort((a, b) => a - b).map((index) => points[index].weekStart);
}

function DateTick({ x, y, payload, index, visibleTicksCount, tickFormatter }) {
  const label = tickFormatter ? tickFormatter(payload.value, index) : payload.value;
  const textAnchor = index === 0
    ? "start"
    : index === visibleTicksCount - 1
      ? "end"
      : "middle";

  return (
    <text x={x} y={y} dy={13} textAnchor={textAnchor} fontSize={16} fill="var(--muted)">
      {label}
    </text>
  );
}

function WeeklyAverageDot(props) {
  const { cx, cy, payload } = props;

  if (cx === undefined || cy === undefined) return null;

  const fill = payload?.isProvisional ? "var(--chart-provisional)" : "var(--chart-score)";
  const stroke = payload?.isProvisional ? "var(--chart-provisional-ring)" : "var(--chart-score-ring)";

  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload?.isProvisional ? 6 : 5}
      fill={fill}
      stroke={stroke}
      strokeWidth={2}
    />
  );
}

export default function WeeklyWeightChart({ data }) {
  const points = data ?? [];
  const yearMarkers = new Set();
  let previousYear = null;

  points.forEach((point) => {
    const year = parseIsoDate(point.weekStart)?.getFullYear() ?? null;
    if (year !== null && previousYear !== null && year !== previousYear) {
      yearMarkers.add(point.weekStart);
    }
    if (year !== null) previousYear = year;
  });

  const ticks = buildTickValues(points, yearMarkers);

  function formatAxisDate(value) {
    if (yearMarkers.has(value)) {
      return String(parseIsoDate(value)?.getFullYear() ?? value);
    }
    return formatDisplayDate(value).slice(0, 5);
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="weekStart"
          ticks={ticks}
          interval={0}
          tickFormatter={formatAxisDate}
          tick={<DateTick />}
        />
        <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 14 }} />
        <Tooltip
          labelFormatter={(value) => formatDisplayDate(value)}
          formatter={(value, name, item) => [
            `${value} kg${item?.payload?.isProvisional ? " · provisional" : ""}`,
            "Media semanal",
          ]}
        />
        <Line
          type="monotone"
          dataKey="average"
          stroke="var(--chart-weight-line)"
          strokeWidth={3}
          name="Media semanal"
          dot={<WeeklyAverageDot />}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
