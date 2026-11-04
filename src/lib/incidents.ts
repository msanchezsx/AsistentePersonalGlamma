/**
 * Análisis de problemas (Fase 6): incidencias con 5 porqués, Ishikawa,
 * causas raíz y plan de acción. Sin dependencias de servidor.
 */
import { z } from "zod";

export const SEVERITY_LABELS = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" } as const;
export const INCIDENT_STATUS_LABELS = {
  open: "Abierto",
  analyzing: "En análisis",
  action_plan: "Plan de acción",
  monitoring: "En seguimiento",
  closed: "Cerrado",
} as const;
export const ACTION_TYPE_LABELS = {
  containment: "Contención",
  corrective: "Correctiva",
  preventive: "Preventiva",
} as const;
export const SOLUTION_STATUS_LABELS = {
  planned: "Planeada",
  in_progress: "En curso",
  done: "Hecha",
  cancelled: "Cancelada",
} as const;

export const ISHIKAWA = [
  ["metodo", "Método"],
  ["mano_de_obra", "Mano de obra"],
  ["maquinaria", "Maquinaria"],
  ["materiales", "Materiales"],
  ["medicion", "Medición"],
  ["medio_ambiente", "Medio ambiente"],
] as const;
export type IshikawaKey = (typeof ISHIKAWA)[number][0];

export type Analysis = {
  facts: string[];
  five_whys: { why: string; answer: string }[];
  ishikawa: Record<IshikawaKey, string[]>;
  root_causes: string[];
  recommendations: string[];
};

export type Incident = {
  id: string;
  title: string;
  description: string | null;
  severity: keyof typeof SEVERITY_LABELS;
  status: keyof typeof INCIDENT_STATUS_LABELS;
  analysis: Partial<Analysis>;
  occurred_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Solution = {
  id: string;
  incident_id: string;
  action_type: keyof typeof ACTION_TYPE_LABELS;
  description: string;
  owner_name: string | null;
  due_date: string | null;
  status: keyof typeof SOLUTION_STATUS_LABELS;
  result: string | null;
  created_at: string;
};

const MAX_LINES = 20;

/** Texto con una idea por renglón → lista limpia. */
export function lines(raw: FormDataEntryValue | null, maxLen = 500): string[] {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_LINES)
    .map((l) => l.slice(0, maxLen));
}

export function parseAnalysis(formData: FormData): Analysis {
  const whys: { why: string; answer: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const answer = String(formData.get(`why${i}`) ?? "").trim().slice(0, 500);
    if (answer) whys.push({ why: `¿Por qué ${i}?`, answer });
  }
  const ishikawa = Object.fromEntries(ISHIKAWA.map(([k]) => [k, lines(formData.get(`ish_${k}`))])) as Analysis["ishikawa"];
  return {
    facts: lines(formData.get("facts")),
    five_whys: whys,
    ishikawa,
    root_causes: lines(formData.get("root_causes")),
    recommendations: lines(formData.get("recommendations")),
  };
}

export const incidentSchema = z.object({
  title: z.string().trim().min(1, "Escribe el problema").max(300),
  description: z
    .string()
    .trim()
    .max(8000)
    .transform((v) => v || null),
  severity: z.enum(["low", "medium", "high", "critical"]),
  occurred_on: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v))
    .transform((v) => v || null),
});

export const solutionSchema = z.object({
  action_type: z.enum(["containment", "corrective", "preventive"]),
  description: z.string().trim().min(1).max(4000),
  owner_name: z
    .string()
    .trim()
    .max(160)
    .transform((v) => v || null),
  due_date: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v))
    .transform((v) => v || null),
});

/** Qué falta para un análisis completo (guía, no bloquea). */
export function analysisGaps(a: Partial<Analysis>, solutions: Pick<Solution, "action_type" | "status">[]): string[] {
  const gaps: string[] = [];
  if (!a.facts?.length) gaps.push("Registra los hechos (qué, cuándo, dónde, cuánto).");
  if ((a.five_whys?.length ?? 0) < 3) gaps.push("Completa al menos 3 porqués.");
  if (!a.root_causes?.length) gaps.push("Define la causa raíz.");
  const active = solutions.filter((s) => s.status !== "cancelled");
  if (!active.some((s) => s.action_type === "corrective")) gaps.push("Agrega una acción correctiva.");
  if (!active.some((s) => s.action_type === "preventive")) gaps.push("Agrega una acción preventiva para que no se repita.");
  return gaps;
}
