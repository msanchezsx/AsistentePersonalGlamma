import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { Splash } from "@/components/splash";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Asistente", template: "%s · Asistente" },
  description: "Asistente ejecutivo personal con inteligencia artificial.",
  applicationName: "Asistente",
  appleWebApp: { capable: true, title: "Asistente", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className="min-h-dvh antialiased">
        <Splash />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
