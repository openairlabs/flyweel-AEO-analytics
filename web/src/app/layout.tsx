import { SidebarNav } from "@/components/ui/SidebarNav";
import { DEMO_MODE } from "@/lib/config";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEO Analytics",
  description: "Track how LLMs mention and position your brand vs competitors",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">
        <div className="min-h-screen flex">
          <aside className="w-64 bg-[#111] border-r border-[#222] p-6">
            <h1 className="text-lg font-bold text-white mb-1">AEO Analytics</h1>
            {DEMO_MODE && (
              <p className="text-xs text-[#555] mb-7">
                Read-only demo. Deploy your own to unlock all features.
              </p>
            )}
            {!DEMO_MODE && <div className="mb-8" />}
            <SidebarNav />
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
