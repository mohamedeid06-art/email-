import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AliasForge — Bulk Email Alias Manager for SimpleLogin",
  description:
    "Enterprise SaaS dashboard for generating, routing, auditing, and exporting bulk SimpleLogin email aliases backed by PostgreSQL.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#060911] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
