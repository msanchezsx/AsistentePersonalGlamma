"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Guarda lo compartido como nota (comunicación de WhatsApp) para consultarlo después. */
export async function saveSharedNote(formData: FormData): Promise<void> {
  const summary = String(formData.get("summary") ?? "").trim().slice(0, 8000);
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 500);
  if (!summary) redirect("/compartir?error=1");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("communications").insert({
    user_id: user.id,
    channel: "whatsapp",
    direction: "inbound",
    subject: subject || null,
    summary,
    occurred_at: new Date().toISOString(),
  });
  if (error) redirect("/compartir?error=1");
  revalidatePath("/compartir");
  redirect("/compartir?guardado=1");
}
