"use client";

import { EditIcon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Field {
  name: string;
  label: string;
  type: "text" | "textarea" | "checkbox" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface EditButtonProps {
  endpoint: string;
  id: string;
  title: string;
  fields: Field[];
  initialValues: Record<string, unknown>;
}

export function EditButton({
  endpoint,
  id,
  title,
  fields,
  initialValues,
}: EditButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...values }),
      });

      if (res.ok) {
        setIsOpen(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        const result = await res.json();
        setError(result.error || "Failed to update");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setValues(initialValues);
    setError("");
    setIsOpen(true);
  }

  const isSubmitting = loading || isPending;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="p-1.5 border border-[#333] text-[#666] hover:border-white hover:text-white transition-colors"
        title="Edit"
      >
        <EditIcon />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={title}>
        {error && (
          <div className="text-red-500 text-sm border border-red-500 p-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              {field.type === "checkbox" ? (
                <div className="flex items-center gap-2">
                  <input
                    id={`edit-${field.name}`}
                    type="checkbox"
                    checked={Boolean(values[field.name])}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        [field.name]: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <label
                    htmlFor={`edit-${field.name}`}
                    className="text-sm text-[#888]"
                  >
                    {field.label}
                  </label>
                </div>
              ) : (
                <>
                  <label
                    htmlFor={`edit-${field.name}`}
                    className="block text-sm text-[#888] mb-1"
                  >
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={`edit-${field.name}`}
                      value={String(values[field.name] || "")}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [field.name]: e.target.value,
                        })
                      }
                      required={field.required}
                      rows={6}
                      className="w-full px-3 py-2 bg-black border border-[#333] text-white focus:border-white focus:outline-none resize-none"
                    />
                  ) : field.type === "select" ? (
                    <select
                      id={`edit-${field.name}`}
                      value={String(values[field.name] || "")}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [field.name]: e.target.value || null,
                        })
                      }
                      className="w-full px-3 py-2 pr-10 bg-black border border-[#333] text-white focus:border-white focus:outline-none"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`edit-${field.name}`}
                      type="text"
                      value={String(values[field.name] || "")}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [field.name]: e.target.value,
                        })
                      }
                      required={field.required}
                      className="w-full px-3 py-2 bg-black border border-[#333] text-white focus:border-white focus:outline-none"
                    />
                  )}
                </>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 px-4 py-2 border border-[#333] text-[#888] hover:border-white hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-white text-black hover:bg-[#ccc] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
