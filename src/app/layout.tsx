import type { Metadata, Viewport } from "next";
import { resolveFavicon } from "@/lib/favicon-server";
import "./globals.css";

/** Browser-tab icon: the bureau's own, else the platform's (versioned so a new upload shows at once). */
export async function generateMetadata(): Promise<Metadata> {
  const f = await resolveFavicon();
  return {
    title: { default: "Bureau CRM", template: "%s · Bureau CRM" },
    description: "Staff tool for the matrimonial bureau",
    robots: { index: false, follow: false },
    icons: { icon: f ? `/api/favicon?v=${f.version}` : "/favicon.ico" },
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
