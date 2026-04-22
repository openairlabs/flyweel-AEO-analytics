"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MentionData {
  name: string;
  mentions: number;
  isOwnBrand: boolean;
}

export function MentionChart({ data }: { data: MentionData[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <XAxis type="number" stroke="#444" fontSize={12} />
          <YAxis
            dataKey="name"
            type="category"
            width={100}
            fontSize={11}
            stroke="#444"
            tick={{ fill: "#888" }}
            interval={0}
          />
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
          <Bar
            dataKey="mentions"
            label={{
              position: "right",
              fill: "#888",
              fontSize: 12,
            }}
            activeBar={{ fill: "#888" }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.isOwnBrand ? "#fff" : "#444"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
