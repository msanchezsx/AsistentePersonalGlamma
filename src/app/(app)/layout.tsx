import { AppNav } from "@/components/app-nav";
import { LiveSync } from "@/components/live-sync";
import { ReminderNotifier } from "@/components/reminder-notifier";
import { listUpcomingReminders } from "@/lib/briefing-server";
import { reminderUrl } from "@/lib/briefing";

// Todas las pantallas son privadas y leen datos del usuario.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const reminders = (await listUpcomingReminders()).map((r) => ({
    id: r.id,
    title: r.title || "Recordatorio",
    at: r.remind_at,
    url: reminderUrl(r),
  }));
  return (
    <div className="flex min-h-dvh">
      <AppNav />
      <LiveSync />
      <ReminderNotifier reminders={reminders} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-10 lg:px-10">{children}</main>
    </div>
  );
}
