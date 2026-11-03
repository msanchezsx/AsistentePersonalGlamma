"use client";

import { useEffect, useState } from "react";
import { formatLongDate, formatTime } from "@/lib/datetime";

export function LiveClock({ timeZone, initial }: { timeZone: string; initial: string }) {
  const [now, setNow] = useState(() => new Date(initial));
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="text-sm text-muted">
      <time dateTime={now.toISOString()}>
        {formatLongDate(now, timeZone)} · {formatTime(now, timeZone)}
      </time>
    </p>
  );
}
