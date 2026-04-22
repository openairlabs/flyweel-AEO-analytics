"use client";

interface ChartToggleProps {
  mode: "bar" | "line";
  onChange: (mode: "bar" | "line") => void;
}

export function ChartToggle({ mode, onChange }: ChartToggleProps) {
  return (
    <div className="flex gap-1 text-xs">
      <button
        type="button"
        onClick={() => onChange("bar")}
        className={`px-2 py-1 border transition-colors ${
          mode === "bar"
            ? "border-white text-white"
            : "border-[#333] text-[#666] hover:border-[#666]"
        }`}
      >
        Bar
      </button>
      <button
        type="button"
        onClick={() => onChange("line")}
        className={`px-2 py-1 border transition-colors ${
          mode === "line"
            ? "border-white text-white"
            : "border-[#333] text-[#666] hover:border-[#666]"
        }`}
      >
        Line
      </button>
    </div>
  );
}
