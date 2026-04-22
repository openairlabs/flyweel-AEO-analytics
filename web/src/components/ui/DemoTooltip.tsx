"use client";

import { DEMO_MODE } from "@/lib/config";

const TOOLTIP_TEXT =
  "Deploy your own instance to unlock this action";

export function DemoTooltip({ children }: { children: React.ReactNode }) {
  if (!DEMO_MODE) return <>{children}</>;

  return (
    <div className="relative group/demo inline-flex">
      <div className="pointer-events-none opacity-50">{children}</div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#222] border border-[#444] text-xs text-[#ccc] whitespace-nowrap opacity-0 group-hover/demo:opacity-100 transition-opacity pointer-events-none z-50">
        {TOOLTIP_TEXT}
      </div>
    </div>
  );
}
