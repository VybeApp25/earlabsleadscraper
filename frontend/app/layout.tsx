import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "EAR Labs Scraper — Powered by WeOps",
  description: "Autonomous AI-powered lead generation and outreach platform by WeOps",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: "var(--surface-800)", border: "1px solid var(--surface-600)", color: "var(--text)" },
          }}
        />
      </body>
    </html>
  );
}
