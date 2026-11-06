import React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatOrdinal, formatSet } from "../../shared/lib/performance";

function ScoreDot({ cx, cy }) {
  if (cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={5} fill="var(--chart-score)" stroke="var(--chart-score-ring)" strokeWidth={2} />;
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const position = point.position;

  return (
    <div className="chart-tooltip">
      <strong>{point.date}</strong>
      <span>Índice: {Number(point.score).toFixed(1)}</span>
      {position && (
        <span>
          {formatOrdinal(position.session)}/{position.sessionTotal}
          {" · "}
          {position.group ? formatOrdinal(position.group) : "—"}/{position.groupTotal}
        </span>
      )}
      <span className="chart-tooltip-sets">
        {point.sets.map((set, index) => formatSet(set, index)).join(" · ")}
      </span>
    </div>
  );
}

export default function ExerciseTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" minTickGap={24} />
        <YAxis
          domain={["dataMin - 5", "dataMax + 5"]}
          allowDecimals={false}
          tickFormatter={(value) => Math.round(value)}
        />
        <Tooltip content={<TrendTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--chart-score)"
          strokeWidth={3}
          name="Rendimiento ajustado"
          dot={<ScoreDot />}
          activeDot={{ r: 7 }}
        />
        <Line
          type="linear"
          dataKey="trendValue"
          stroke="var(--chart-trend)"
          strokeDasharray="6 4"
          strokeWidth={2}
          name="Tendencia"
          dot={false}
          activeDot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
