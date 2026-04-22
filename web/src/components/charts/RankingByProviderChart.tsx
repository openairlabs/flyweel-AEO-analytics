"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartToggle } from "./ChartToggle";

interface ProviderRankingData {
  provider: string;
  avgRank: number;
}

export function RankingByProviderChart({
  data,
}: {
  data: ProviderRankingData[];
}) {
  const [mode, setMode] = useState<"bar" | "line">("bar");

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[#666]">
        No provider data yet
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#888] uppercase tracking-wider">
          Ranking by Provider
        </h3>
        <ChartToggle mode={mode} onChange={setMode} />
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "bar" ? (
            <BarChart data={data}>
              <XAxis
                dataKey="provider"
                stroke="#444"
                fontSize={12}
                tick={{ fill: "#888" }}
              />
              <YAxis
                stroke="#444"
                fontSize={12}
                tick={{ fill: "#666" }}
                reversed
                domain={[1, "auto"]}
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
                itemStyle={{ color: "#fff" }}
                formatter={(value: number) => [
                  `#${value.toFixed(1)}`,
                  "Avg Rank",
                ]}
              />
              <Bar dataKey="avgRank" fill="#fff" />
            </BarChart>
          ) : (
            <LineChart data={data}>
              <XAxis
                dataKey="provider"
                stroke="#444"
                fontSize={12}
                tick={{ fill: "#888" }}
              />
              <YAxis
                stroke="#444"
                fontSize={12}
                tick={{ fill: "#666" }}
                reversed
                domain={[1, "auto"]}
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
                itemStyle={{ color: "#fff" }}
                formatter={(value: number) => [
                  `#${value.toFixed(1)}`,
                  "Avg Rank",
                ]}
              />
              <Line
                type="monotone"
                dataKey="avgRank"
                stroke="#fff"
                strokeWidth={2}
                dot={{ fill: "#fff", strokeWidth: 0, r: 4 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
