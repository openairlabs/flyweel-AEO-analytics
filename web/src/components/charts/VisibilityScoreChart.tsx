"use client";

import { getBrandColor } from "@/lib/colors";
import type { VisibilityScoreData } from "@/lib/metrics";
import { useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { InfoTooltip } from "../ui/InfoTooltip";
import { ChartToggle } from "./ChartToggle";

interface VisibilityScoreChartProps {
  data: VisibilityScoreData[];
  overTimeData?: Array<{ date: string; [brand: string]: string | number }>;
  brands: Array<{ name: string; isOwnBrand: boolean }>;
}

export function VisibilityScoreChart({
  data,
  overTimeData,
  brands,
}: VisibilityScoreChartProps) {
  const [mode, setMode] = useState<"bar" | "line">("bar");
  const [view, setView] = useState<"snapshot" | "trend">("trend");

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#666]">
        No data yet
      </div>
    );
  }

  const ownBrand = brands.find((b) => b.isOwnBrand);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[#888] uppercase tracking-wider">
            Visibility Score
          </h3>
          <InfoTooltip content="Combined metric factoring both mention frequency and ranking position. Formula: Share of Voice × Rank Score, where Rank Score = (total brands - avg rank + 1) ÷ total brands × 100. Score of 100 = mentioned in every response at #1. Higher is better." />
        </div>
        <div className="flex items-center gap-2">
          {overTimeData && overTimeData.length > 1 && (
            <>
              <select
                value={view}
                onChange={(e) =>
                  setView(e.target.value as "snapshot" | "trend")
                }
                className="px-2 py-1 bg-black border border-[#333] text-white text-xs focus:border-white focus:outline-none"
              >
                <option value="snapshot">Current</option>
                <option value="trend">Over Time</option>
              </select>
              {view === "trend" && (
                <ChartToggle mode={mode} onChange={setMode} />
              )}
            </>
          )}
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {view === "snapshot" ? (
            <BarChart data={data} layout="vertical">
              <XAxis
                type="number"
                stroke="#444"
                fontSize={12}
                tick={{ fill: "#666" }}
                domain={[0, 100]}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#444"
                fontSize={11}
                tick={{ fill: "#666" }}
                width={100}
                interval={0}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(17, 17, 17, 0.7)",
                  border: "1px solid #333",
                  borderRadius: 0,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#fff" }}
                formatter={(value: number) => [value.toFixed(1), "Score"]}
              />
              <Bar
                dataKey="score"
                label={{ position: "right", fill: "#666", fontSize: 12 }}
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
          ) : mode === "line" ? (
            <LineChart data={overTimeData}>
              <XAxis
                dataKey="date"
                stroke="#444"
                fontSize={12}
                tick={{ fill: "#666" }}
              />
              <YAxis
                stroke="#444"
                fontSize={12}
                tick={{ fill: "#666" }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(17, 17, 17, 0.7)",
                  border: "1px solid #333",
                  borderRadius: 0,
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#fff" }}
                formatter={(value: number, name: string) => [
                  value.toFixed(1),
                  name,
                ]}
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
                  <span
                    style={{
                      color: getBrandColor(value, value === ownBrand?.name),
                    }}
                  >
                    {value}
                  </span>
                )}
              />
              {brands.map((brand) => (
                <Line
                  key={brand.name}
                  type="monotone"
                  dataKey={brand.name}
                  stroke={getBrandColor(brand.name, brand.isOwnBrand)}
                  strokeWidth={brand.isOwnBrand ? 3 : 2}
                  dot={{
                    fill: getBrandColor(brand.name, brand.isOwnBrand),
                    strokeWidth: 0,
                    r: brand.isOwnBrand ? 4 : 3,
                  }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={overTimeData}>
              <XAxis
                dataKey="date"
                stroke="#444"
                fontSize={12}
                tick={{ fill: "#666" }}
              />
              <YAxis
                stroke="#444"
                fontSize={12}
                tick={{ fill: "#666" }}
                domain={[0, 100]}
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
                formatter={(value: number) => Number(value).toFixed(1)}
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
                  <span
                    style={{
                      color: getBrandColor(value, value === ownBrand?.name),
                    }}
                  >
                    {value}
                  </span>
                )}
              />
              {brands.map((brand) => (
                <Bar
                  key={brand.name}
                  dataKey={brand.name}
                  fill={getBrandColor(brand.name, brand.isOwnBrand)}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
