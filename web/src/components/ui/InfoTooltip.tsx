"use client";

import { Info } from "lucide-react";
import { useState } from "react";

interface InfoTooltipProps {
  content: string;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="text-[#555] hover:text-[#888] transition-colors"
        aria-label="More information"
      >
        <Info className="w-4 h-4" />
      </button>
      {isVisible && (
        <div className="absolute z-50 left-6 top-0 w-64 p-3 bg-[#1a1a1a] border border-[#333] text-xs text-[#ccc] leading-relaxed shadow-lg">
          {content}
        </div>
      )}
    </div>
  );
}
