import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Qubere Customer Portal",
  description: "Customer portal for tracking customs clearance, shipments, entry summaries, and invoices.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0071E3",
        },
      }}
    >
      <html lang="en" className="h-full">
        <body className={`${inter.className} min-h-screen bg-[#F5F5F7] text-[#1D1D1F] antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
