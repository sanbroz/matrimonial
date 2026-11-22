import type { Metadata, Viewport } from "next";
import { platform } from "@/lib/platform-db";
import "./globals.css";

/** Browser-tab icon: the platform's uploaded favicon (versioned so a new upload shows at once). */
export async function generateMetadata(): Promise<Metadata> {
  let v = "0";
  try {
    const s = await platform.platformSettings.findUnique({ where: { id: 1 }, select: { updatedAt: true, faviconType: true } });
    if (s?.faviconType) v = String(s.updatedAt.getTime());
  } catch {
    /* no database while building */
  }
  return {
    title: { default: "Bureau CRM", template: "%s · Bureau CRM" },
    description: "Staff tool for the matrimonial bureau",
    robots: { index: false, follow: false },
    icons: { icon: v === "0" ? "/favicon.ico" : `/api/favicon?v=${v}` },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
