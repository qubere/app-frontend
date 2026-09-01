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
      // signInUrl/signUpUrl are intentionally omitted here — they are already
      // set via NEXT_PUBLIC_CLERK_SIGN_IN_URL / NEXT_PUBLIC_CLERK_SIGN_UP_URL
      // env vars. Passing relative paths as props triggers Clerk v7's absolute-
      // URL validation in production/satellite mode and throws on sign-out.
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
