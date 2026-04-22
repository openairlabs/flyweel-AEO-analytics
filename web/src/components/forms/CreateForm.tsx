"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Field {
  name: string;
  label: string;
  type: "text" | "textarea" | "checkbox" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  hint?: string;
  transformType?: "comma-list"; // Split comma-separated string into array
}

interface CreateFormProps {
  endpoint: string;
  fields: Field[];
  submitLabel?: string;
  onSuccess?: () => void;
}

export function CreateForm({
  endpoint,
  fields,
  submitLabel = "Create",
  onSuccess,
}: CreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of fields) {
      initial[field.name] = field.type === "checkbox" ? false : "";
    }
    return initial;
  });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Transform values and convert empty strings to null
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      let value = values[field.name];
      if (field.transformType === "comma-list" && typeof value === "string") {
        value = value
          ? value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      } else if (value === "") {
        value = null;
      }
      data[field.name] = value;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        // Reset form
        const reset: Record<string, unknown> = {};
        for (const field of fields) {
          reset[field.name] = field.type === "checkbox" ? false : "";
        }
        setValues(reset);
        startTransition(() => {
          router.refresh();
        });
        onSuccess?.();
      } else {
        const result = await res.json();
        setError(result.error || "Failed to create");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const isSubmitting = loading || isPending;
  const requiredFieldsFilled = fields
    .filter((f) => f.required)
    .every((f) => {
      const val = values[f.name];
      return f.type === "checkbox" ? true : Boolean(val);
    });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-red-500 text-sm border border-red-500 p-2">
          {error}
        </div>
      )}

      {fields.map((field) => (
        <div key={field.name}>
          {field.type === "checkbox" ? (
            <div className="flex items-center gap-2">
              <input
                id={`create-${field.name}`}
                type="checkbox"
                checked={Boolean(values[field.name])}
                onChange={(e) =>
                  setValues({ ...values, [field.name]: e.target.checked })
                }
                className="w-4 h-4"
              />
              <label
                htmlFor={`create-${field.name}`}
                className="text-sm text-[#888]"
              >
                {field.label}
              </label>
            </div>
          ) : (
            <>
              <label
                htmlFor={`create-${field.name}`}
                className="block text-xs text-[#888] uppercase tracking-wider mb-1"
              >
                {field.label}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={`create-${field.name}`}
                  value={String(values[field.name] || "")}
                  onChange={(e) => {
                    setValues({ ...values, [field.name]: e.target.value });
                    setError("");
                  }}
                  required={field.required}
                  rows={4}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-black border border-[#333] text-white focus:border-white focus:outline-none resize-none"
                />
              ) : field.type === "select" ? (
                <select
                  id={`create-${field.name}`}
                  value={String(values[field.name] || "")}
                  onChange={(e) => {
                    setValues({ ...values, [field.name]: e.target.value });
                    setError("");
                  }}
                  required={field.required}
                  className="w-full px-3 py-2 pr-10 bg-black border border-[#333] text-white focus:border-white focus:outline-none"
                >
                  <option value="">Select...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`create-${field.name}`}
                  type="text"
                  value={String(values[field.name] || "")}
                  onChange={(e) => {
                    setValues({ ...values, [field.name]: e.target.value });
                    setError("");
                  }}
                  required={field.required}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-black border border-[#333] text-white focus:border-white focus:outline-none"
                />
              )}
              {field.hint && (
                <p className="text-xs text-[#666] mt-1">{field.hint}</p>
              )}
            </>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={isSubmitting || !requiredFieldsFilled}
        className="w-full bg-white text-black py-2 px-4 font-medium hover:bg-[#ddd] disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
