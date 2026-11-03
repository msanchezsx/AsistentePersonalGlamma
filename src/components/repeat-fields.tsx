"use client";

import { useState } from "react";
import { REPEAT_OPTIONS, type RepeatOption } from "@/lib/recurrence";

const inputCls =
  "w-full rounded-xl border border-border bg-bg px-3.5 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

/** Campos "Repetir" y "Hasta" compartidos por tareas y reuniones. */
export function RepeatFields({
  defaultRepeat,
  defaultUntil,
  errors,
  hint,
}: {
  defaultRepeat: RepeatOption;
  defaultUntil: string;
  errors: { repeat?: string; repeat_until?: string };
  hint: string;
}) {
  const [repeat, setRepeat] = useState<string>(defaultRepeat);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor="repeat" className="mb-1.5 block text-sm font-medium">
          Repetir
        </label>
        <select
          id="repeat"
          name="repeat"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          className={inputCls}
        >
          {REPEAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errors.repeat ? <p className="mt-1 text-xs text-danger">{errors.repeat}</p> : null}
      </div>
      <div>
        <label htmlFor="repeat_until" className="mb-1.5 block text-sm font-medium">
          Hasta (opcional)
        </label>
        <input
          id="repeat_until"
          name="repeat_until"
          type="date"
          defaultValue={defaultUntil}
          disabled={repeat === ""}
          className={`${inputCls} disabled:opacity-50`}
        />
        {errors.repeat_until ? <p className="mt-1 text-xs text-danger">{errors.repeat_until}</p> : null}
      </div>
      <p className="col-span-2 -mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
