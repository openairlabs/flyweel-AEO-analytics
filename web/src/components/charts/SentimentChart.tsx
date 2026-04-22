"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface SentimentData {
  name: string;
  positive: number;
  negative: number;
  neutral: number;
}

export function SentimentChart({ data }: { data: SentimentData[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="name"
            fontSize={10}
            stroke="#444"
            tick={{ fill: "#888" }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <YAxis fontSize={12} stroke="#444" tick={{ fill: "#888" }} />
          <Tooltip
            cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
            contentStyle={{
              backgroundColor: "rgba(17, 17, 17, 0.7)",
              border: "1px solid #333",
              borderRadius: 0,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            labelStyle={{ color: "#fff" }}
            itemStyle={{ color: "#aaa" }}
          />
          <Legend
            wrapperStyle={{
              color: "#888",
              fontSize: 12,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
              padding: "8px 12px",
              borderRadius: 0,
            }}
          />
          <Bar
            dataKey="positive"
            stackId="a"
            fill="#22c55e"
            name="Positive"
            activeBar={{ fill: "#16a34a" }}
          />
          <Bar
            dataKey="neutral"
            stackId="a"
            fill="#666"
            name="Neutral"
            activeBar={{ fill: "#555" }}
          />
          <Bar
            dataKey="negative"
            stackId="a"
            fill="#ef4444"
            name="Negative"
            activeBar={{ fill: "#dc2626" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
