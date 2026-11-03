/** Etiquetas sin dependencias, seguras para componentes de cliente. */
export const TASK_STATUSES = ["pending", "in_progress", "waiting", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  waiting: "En espera",
  done: "Terminada",
  cancelled: "Cancelada",
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Crítica",
  2: "Alta",
  3: "Normal",
  4: "Baja",
  5: "Mínima",
};
