"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface ToggleActiveButtonProps {
  endpoint: string;
  id: string;
  isActive: boolean;
}

export function ToggleActiveButton({
  endpoint,
  id,
  isActive,
}: ToggleActiveButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });

      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const isToggling = loading || isPending;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isToggling}
      className={`text-xs px-2 py-0.5 cursor-pointer transition-colors ${
        isActive
          ? "border border-green-500 text-green-500 hover:bg-green-500/10"
          : "border border-[#333] text-[#666] hover:border-[#666]"
      } ${isToggling ? "opacity-50" : ""}`}
    >
      {isToggling ? "..." : isActive ? "Active" : "Inactive"}
    </button>
  );
}
