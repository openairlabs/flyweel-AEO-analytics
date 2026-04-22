"use client";

import { ChevronIcon } from "@/components/ui/Icons";
import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
  actions,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-[#111] border border-[#222]">
      <div className="p-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronIcon
            className={`w-4 h-4 text-[#666] transition-transform ${isOpen ? "rotate-90" : ""}`}
          />
          <span className="font-medium">{title}</span>
          {count !== undefined && (
            <span className="text-sm text-[#666]">({count})</span>
          )}
        </button>
        {actions && <div>{actions}</div>}
      </div>
      {isOpen && <div className="border-t border-[#222] ml-7">{children}</div>}
    </div>
  );
}
