"use client";

import { getBrandColor } from "@/lib/colors";
import { useState } from "react";
import {
  Bar,
  BarChart,
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

interface RankingData {
  date: string;
  [brand: string]: string | number; // Dynamic brand keys with their avg rank
}

interface BrandInfo {
  name: string;
  isOwnBrand: boolean;
}

export function RankingOverTimeChart({
  data,
  brands,
}: {
  data: RankingData[];
  brands: BrandInfo[];
}) {
  const [mode, setMode] = useState<"bar" | "line">("line");

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-[#666]">
        No ranking data yet
      </div>
    );
  }

  const ownBrand = brands.find((b) => b.isOwnBrand);
  const competitors = brands.filter((b) => !b.isOwnBrand);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[#888] uppercase tracking-wider">
            Average Rank When Mentioned
          </h3>
          <InfoTooltip content="Average ranking position when the brand is mentioned in LLM responses. Lower is better (#1 = top recommendation). Only counts responses where the brand actually appears." />
        </div>
        <ChartToggle mode={mode} onChange={setMode} />
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "line" ? (
            <LineChart data={data}>
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
                reversed
                domain={[1, 5]}
                label={{
                  value: "Rank",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#666",
                  fontSize: 12,
                }}
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
                formatter={(value: number, name: string) => [
                  `#${value.toFixed(1)}`,
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
              {/* All brands with distinct colors */}
              {brands.map((brand) => {
                const color = getBrandColor(brand.name, brand.isOwnBrand);
                return (
                  <Line
                    key={brand.name}
                    type="monotone"
                    dataKey={brand.name}
                    stroke={color}
                    strokeWidth={brand.isOwnBrand ? 3 : 2}
                    dot={{
                      fill: color,
                      strokeWidth: 0,
                      r: brand.isOwnBrand ? 4 : 3,
                    }}
                    activeDot={{ r: 6, fill: color }}
                  />
                );
              })}
            </LineChart>
          ) : (
            <BarChart data={data}>
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
                reversed
                domain={[1, 5]}
                label={{
                  value: "Rank",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#666",
                  fontSize: 12,
                }}
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
                formatter={(value: number, name: string) => [
                  `#${value.toFixed(1)}`,
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
              {/* All brands with distinct colors */}
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
