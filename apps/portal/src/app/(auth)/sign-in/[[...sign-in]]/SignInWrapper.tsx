"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SignIn, useUser } from "@clerk/nextjs";

export function SignInWrapper() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col justify-center items-center px-6 py-12 relative selection:bg-brand/20 selection:text-brand">
      <div className="mb-8 text-center max-w-md">
        <Link href="/" className="inline-flex items-center space-x-3 group mb-4">
          <div className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center text-white shadow-md shadow-brand/20 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-ink">Qubere</span>
        </Link>
        <h1 className="text-2xl font-bold text-ink">Sign In</h1>
        <p className="text-ink-muted text-sm mt-1">
          Access your customs clearance, shipment, and invoice portal
        </p>
      </div>

      <div className="qubere-card p-4 rounded-2xl border border-border shadow-lg max-w-md w-full">
        {!isLoaded || isSignedIn ? (
          <div className="py-6 text-center text-sm text-ink-muted">
            {isSignedIn ? "Redirecting…" : "Loading authentication…"}
          </div>
        ) : (
          <SignIn
            routing="path"
            path="/sign-in"
            fallbackRedirectUrl="/"
            appearance={{
              elements: {
                card: "bg-transparent shadow-none",
                headerTitle: "text-ink text-lg font-bold",
                headerSubtitle: "text-ink-muted text-sm",
                socialButtonsBlockButton: "bg-white border-border text-ink hover:bg-slate-50",
                formFieldLabel: "text-ink text-xs font-semibold",
                formFieldInput:
                  "bg-white border-border text-ink rounded-xl focus:border-brand focus:ring-1 focus:ring-brand",
                formButtonPrimary:
                  "bg-brand hover:bg-brand-hover text-white font-semibold rounded-full py-3 shadow-md shadow-brand/20 transition-all",
                footerActionLink: "text-brand hover:text-brand-hover font-semibold",
              },
            }}
          />
        )}
      </div>

      <p className="mt-6 text-center text-xs text-ink-muted max-w-md">
        Access is by invitation from your customs broker or account administrator.
      </p>
    </div>
  );
}
