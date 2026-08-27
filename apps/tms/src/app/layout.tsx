import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qubere TMS — AI Freight Execution Engine",
  description: "Autonomous end-to-end freight execution, rate shopping, tendering, tracking, and 3-way invoice matching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-surface-muted text-ink selection:bg-brand/20 selection:text-brand antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
