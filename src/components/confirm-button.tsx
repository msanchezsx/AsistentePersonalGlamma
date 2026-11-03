"use client";

/** Botón de envío que pide confirmación antes de una acción destructiva. */
export function ConfirmButton({
  message,
  danger = false,
  children,
}: {
  message: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={`rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium ${danger ? "text-danger" : ""}`}
    >
      {children}
    </button>
  );
}
