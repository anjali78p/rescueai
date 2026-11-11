import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "RescueAI: SOS that survives the network",
  description: "Offline-first disaster response with AI-assisted triage.",
  manifest: "/manifest.json",
};
export const viewport: Viewport = { themeColor: "#12262E", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Falls back to the system font when offline */}
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
