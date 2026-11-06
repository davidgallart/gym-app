import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="weekStart" />
        <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip
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
