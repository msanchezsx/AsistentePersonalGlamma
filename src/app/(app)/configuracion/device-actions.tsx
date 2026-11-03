"use client";

import { useActionState } from "react";
import { approveDevice, revokeDevice, type DeviceActionState } from "./actions";

export function DeviceActions({
  deviceId,
  status,
  isCurrent,
}: {
  deviceId: string;
  status: string;
  isCurrent: boolean;
}) {
  const [approveState, approve, approving] = useActionState<DeviceActionState, FormData>(approveDevice, null);
  const [revokeState, revoke, revoking] = useActionState<DeviceActionState, FormData>(revokeDevice, null);
  const state = approveState ?? revokeState;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status === "pending" ? (
          <form action={approve}>
            <input type="hidden" name="deviceId" value={deviceId} />
            <button
              disabled={approving}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-text disabled:opacity-60"
            >
              Autorizar
            </button>
          </form>
        ) : null}
        {status !== "revoked" ? (
          <form
            action={revoke}
            onSubmit={(e) => {
              const msg = isCurrent
                ? "¿Revocar ESTE dispositivo? Perderás el acceso desde aquí."
                : "¿Revocar este dispositivo? Perderá el acceso de inmediato.";
              if (!confirm(msg)) e.preventDefault();
            }}
          >
            <input type="hidden" name="deviceId" value={deviceId} />
            <button
              disabled={revoking}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-danger disabled:opacity-60"
            >
              Revocar
            </button>
          </form>
        ) : null}
      </div>
      {state ? (
        <p role="status" className={`text-xs ${state.ok ? "text-ok" : "text-danger"}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
