import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import AppShell from "@/components/AppShell";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Buddy",
  description: "A calm 15-minute study routine: see the idea, remember it, speed up, test calmly.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Study Buddy", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#F7F4EE", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
