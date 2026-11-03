import { AppNav } from "@/components/app-nav";
import { LiveSync } from "@/components/live-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <AppNav />
      <LiveSync />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-10 lg:px-10">{children}</main>
    </div>
  );
}
