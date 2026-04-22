"use client";

import { TrashIcon } from "@/components/ui/Icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface DeleteButtonProps {
  endpoint: string;
  id: string;
}

export function DeleteButton({ endpoint, id }: DeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this item?")) return;

    setLoading(true);
    try {
      const res = await fetch(`${endpoint}?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
    } finally {
      setLoading(false);
    }
  }

  const isDeleting = loading || isPending;

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-1.5 border border-[#333] text-[#666] hover:border-red-500 hover:text-red-500 disabled:opacity-50 transition-colors"
      title="Delete"
    >
      {isDeleting ? (
        <span className="block w-4 h-4 text-center text-xs">...</span>
      ) : (
        <TrashIcon />
      )}
    </button>
  );
}
