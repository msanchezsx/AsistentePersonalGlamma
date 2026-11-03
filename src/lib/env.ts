import { z } from "zod";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

/**
 * Variables públicas (disponibles en el navegador). Next.js las incrusta en
 * el build, por eso se leen una por una y no con `process.env` completo.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function getPublicEnv(): PublicEnv | null {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Supabase llama a la clave pública "publishable" (sb_publishable_…) en
    // proyectos nuevos y "anon" en los anteriores: se acepta cualquiera.
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  return parsed.success ? parsed.data : null;
}

export function isSupabaseConfigured(): boolean {
  return getPublicEnv() !== null;
}

export function requirePublicEnv(): PublicEnv {
  const env = getPublicEnv();
  if (!env) {
    throw new Error(
      "Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example).",
    );
  }
  return env;
}

/** Lista de correos autorizados (solo servidor). */
export function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string): boolean {
  const allowed = getAllowedEmails();
  return allowed.length > 0 && allowed.includes(email.trim().toLowerCase());
}

export const APP_TIMEZONE = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE;
