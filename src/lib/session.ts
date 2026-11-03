import "server-only";

import { cache } from "react";
import { isSupabaseConfigured, APP_TIMEZONE } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string | null;
  email: string | null;
  displayName: string | null;
  timezone: string;
  preview: boolean;
};

/** Modo de vista previa de la interfaz: solo en desarrollo y sin Supabase. */
export function isUiPreview(): boolean {
  return process.env.NODE_ENV === "development" && process.env.UI_PREVIEW === "1" && !isSupabaseConfigured();
}

/** Usuario actual con su perfil básico (cacheado por request). */
export const getViewer = cache(async (): Promise<Viewer> => {
  if (isUiPreview()) {
    return { id: null, email: null, displayName: null, timezone: APP_TIMEZONE, preview: true };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { id: null, email: null, displayName: null, timezone: APP_TIMEZONE, preview: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name, timezone")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: profile?.preferred_name || profile?.full_name || null,
    timezone: profile?.timezone || APP_TIMEZONE,
    preview: false,
  };
});
