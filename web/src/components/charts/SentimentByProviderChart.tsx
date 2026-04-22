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
  provider: string;
  positive: number;
  neutral: number;
  negative: number;
}

export function SentimentByProviderChart({ data }: { data: SentimentData[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#666]">
        No sentiment data yet
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="provider"
            stroke="#444"
            fontSize={12}
            tick={{ fill: "#888" }}
          />
          <YAxis stroke="#444" fontSize={12} tick={{ fill: "#666" }} />
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
            itemStyle={{ color: "#fff" }}
          />
          <Legend
            wrapperStyle={{
              fontSize: 12,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
              padding: "8px 12px",
              borderRadius: 0,
            }}
            formatter={(value) => (
              <span style={{ color: "#888" }}>{value}</span>
            )}
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
