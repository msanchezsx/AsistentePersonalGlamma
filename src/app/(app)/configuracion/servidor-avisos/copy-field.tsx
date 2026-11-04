"use client";

import { useState } from "react";

export function CopyField({ name, value }: { name: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted">{name}</p>
      <div className="flex gap-2">
        <input readOnly value={value} aria-label={name} className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs" />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
