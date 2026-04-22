import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "EAR Labs Scraper — Powered by WeOps",
  description: "Autonomous AI-powered lead generation and outreach platform by WeOps",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const s = localStorage.getItem('ear-labs-store');
              const theme = s ? JSON.parse(s).state?.theme : 'dark';
              document.documentElement.classList.add(theme || 'dark');
            } catch(e) {
              document.documentElement.classList.add('dark');
            }
          `
        }} />
      </head>
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
