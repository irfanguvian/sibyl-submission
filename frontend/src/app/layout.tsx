import type { Metadata } from "next";
import "./globals.css";
import { DashboardShell } from "@/components/dashboard-shell";
import { QueryProvider } from "@/providers/query-provider";

export const metadata: Metadata = {
  title: "Tuition Marketplace",
  description: "Connect parents with qualified tutors",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <DashboardShell>{children}</DashboardShell>
        </QueryProvider>
      </body>
    </html>
  );
}
