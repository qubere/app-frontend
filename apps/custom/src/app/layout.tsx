import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Qubere - Enterprise AI Trade Compliance Platform",
  description: "Secure, multi-tenant AI-native trade compliance and automated tariff management SaaS platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      // Keep all auth UI on our own Qubere-branded routes instead of the
      // unstyled Clerk Account Portal at accounts.qubere.ai.
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/app/dashboard"
      signUpFallbackRedirectUrl="/app/dashboard"
      afterSignOutUrl="/sign-in"
      appearance={{
        variables: {
          colorPrimary: "#0071E3",
        },
      }}
    >
      <html lang="en" className="h-full dark">
        <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-50 antialiased`}>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
